const supabase = require('../config/supabase');
const { analyseSentiment } = require('../utils/gemini');
const { generateJson } = require('../ai/client');
const { writeAuditLog } = require('../utils/audit');
const { notifyN8n } = require('../utils/webhook');

const REVIEW_REPLY_SCHEMA = { type: 'object', properties: { reply: { type: 'string' }, needs_human: { type: 'boolean' }, reason: { type: 'string' } }, required: ['reply', 'needs_human', 'reason'] };
const REVIEW_SELECT = 'id, product_id, customer_id, rating, comment, sentiment, urgency, ai_status, support_reply, support_replied_at, created_at, users!product_reviews_customer_id_fkey(name), product_review_messages(id, sender_id, sender_type, body, created_at)';

const getProductReviews = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('product_reviews').select(REVIEW_SELECT).eq('product_id', req.params.productId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

async function analyseReview(comment) {
  try { return { analysis: await analyseSentiment({ query: comment }), ai_status: 'completed' }; }
  catch (error) { console.warn('[reviews] AI analysis deferred:', error.message); return { analysis: null, ai_status: 'pending' }; }
}

const createReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'A customer account is required to leave a review' });
    const { product_id, rating, comment } = req.body;
    const { data: product, error: productError } = await supabase.from('products').select('id, name, status').eq('id', product_id).single();
    if (productError || !product || product.status !== 'active') return res.status(404).json({ error: 'Product not found' });
    const { data: existing } = await supabase.from('product_reviews').select('id').eq('product_id', product_id).eq('customer_id', req.user.id).maybeSingle();
    if (existing) return res.status(409).json({ error: 'You already reviewed this product. Edit your existing review instead.' });
    const { analysis: ai, ai_status } = await analyseReview(comment);
    const flagged = ai?.sentiment === 'negative' || ai?.urgency === 'high';
    const { data, error } = await supabase.from('product_reviews').insert({ product_id, customer_id: req.user.id, rating, comment, sentiment: ai?.sentiment || null, urgency: ai?.urgency || null, ai_status, flagged_as_complaint: flagged, human_intervention_required: flagged, human_intervention_reason: flagged ? 'Negative sentiment or high urgency detected by AI' : null, human_intervention_status: flagged ? 'pending' : 'not_required' }).select(REVIEW_SELECT).single();
    if (error) throw error;
    writeAuditLog({ userId: req.user.id, action: 'product.review.create', resourceType: 'product_review', resourceId: data.id, metadata: { product_id, rating, flagged }, req });
    notifyN8n('store-review', { review_id: data.id, product_id, product_name: product.name, customer_id: req.user.id, rating, comment, ai_status });
    res.status(201).json({ message: flagged ? 'Review submitted and flagged for Support review' : ai_status === 'pending' ? 'Review submitted. AI analysis will run shortly.' : 'Review submitted', data, ai_analysis: ai });
  } catch (err) { next(err); }
};

const updateReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'A customer account is required' });
    const { rating, comment } = req.body;
    const { analysis: ai, ai_status } = await analyseReview(comment);
    const flagged = ai?.sentiment === 'negative' || ai?.urgency === 'high';
    const { data, error } = await supabase.from('product_reviews').update({ rating, comment, sentiment: ai?.sentiment || null, urgency: ai?.urgency || null, ai_status, flagged_as_complaint: flagged, human_intervention_required: flagged, human_intervention_status: flagged ? 'pending' : 'not_required' }).eq('id', req.params.id).eq('customer_id', req.user.id).select(REVIEW_SELECT).single();
    if (error || !data) return res.status(404).json({ error: 'Review not found' });
    writeAuditLog({ userId: req.user.id, action: 'product.review.update', resourceType: 'product_review', resourceId: data.id, metadata: { rating }, req });
    res.json({ message: 'Review updated', data });
  } catch (err) { next(err); }
};

const getFlaggedReviews = async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('product_reviews').select('*, products(name, slug), users!product_reviews_customer_id_fkey(name, email), product_review_messages(id, sender_id, sender_type, body, created_at)').eq('flagged_as_complaint', true).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

const replyToReview = async (req, res, next) => {
  try {
    const { response } = req.body;
    const { data, error } = await supabase.from('product_reviews').update({ support_reply: response, support_replied_by: req.user.id, support_replied_at: new Date().toISOString(), human_intervention_required: false, human_intervention_status: 'handled' }).eq('id', req.params.id).select('*, products(name, slug), users!product_reviews_customer_id_fkey(name, email)').single();
    if (error || !data) return res.status(404).json({ error: 'Review not found' });
    const { error: messageError } = await supabase.from('product_review_messages').insert({ review_id: data.id, sender_id: req.user.id, sender_type: 'staff', body: response });
    if (messageError) throw messageError;
    writeAuditLog({ userId: req.user.id, action: 'product.review.reply', resourceType: 'product_review', resourceId: data.id, metadata: { response_length: response.length }, req });
    res.json({ message: 'Support reply published', data });
  } catch (err) { next(err); }
};

const replyToReviewCustomer = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'A customer account is required' });
    const body = req.body.body.trim();
    const { data: review, error: reviewError } = await supabase.from('product_reviews').select('id, customer_id, comment, support_reply, products(name)').eq('id', req.params.id).single();
    if (reviewError || !review || review.customer_id !== req.user.id) return res.status(404).json({ error: 'Review not found' });
    const { data: customerMessage, error } = await supabase.from('product_review_messages').insert({ review_id: review.id, sender_id: req.user.id, sender_type: 'customer', body }).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Reply received', data: customerMessage });
    void (async () => {
      try {
        const ai = await generateJson({ preferProvider: 'groq', systemInstruction: 'You are a professional e-commerce support agent. Reply briefly and helpfully using only the review context. Escalate payment, fraud, safety, legal, account access, or unresolved serious complaints to a human. Return JSON only.', prompt: JSON.stringify({ product: review.products?.name, original_review: review.comment, previous_support_reply: review.support_reply, customer_follow_up: body }), responseSchema: REVIEW_REPLY_SCHEMA });
        const needsHuman = Boolean(ai.needs_human);
        const reply = needsHuman ? `${ai.reply}\n\nA support specialist has been notified and will reply here because this issue needs human review.` : ai.reply;
        await supabase.from('product_review_messages').insert({ review_id: review.id, sender_type: 'ai', body: reply });
        await supabase.from('product_reviews').update({ human_intervention_required: needsHuman, human_intervention_status: needsHuman ? 'pending' : 'not_required', human_intervention_reason: needsHuman ? (ai.reason || 'Support Agent requested human review') : null }).eq('id', review.id);
      } catch (aiError) {
        console.warn('[reviews] customer reply AI deferred:', aiError.message);
        await supabase.from('product_review_messages').insert({ review_id: review.id, sender_type: 'ai', body: 'Thanks for your follow-up. Our support team has received it and will reply shortly.' });
      }
    })();
  } catch (err) { next(err); }
};

module.exports = { getProductReviews, createReview, updateReview, getFlaggedReviews, replyToReview, replyToReviewCustomer };
