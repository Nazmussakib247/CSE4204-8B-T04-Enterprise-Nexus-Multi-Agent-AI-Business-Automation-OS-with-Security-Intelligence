const supabase = require('../config/supabase');
const { analyseSentiment } = require('../utils/gemini');
const { generateJson } = require('../ai/client');
const { writeAuditLog } = require('../utils/audit');

const REVIEW_REPLY_SCHEMA = { type: 'object', properties: { reply: { type: 'string' }, needs_human: { type: 'boolean' }, reason: { type: 'string' } }, required: ['reply', 'needs_human', 'reason'] };
const PUBLIC_REVIEW_SELECT = 'id, product_id, customer_id, order_id, rating, comment, support_reply, support_replied_at, created_at, users!product_reviews_customer_id_fkey(name), product_review_messages(id, sender_id, sender_type, body, created_at)';

const getProductReviews = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('product_reviews').select(PUBLIC_REVIEW_SELECT).eq('product_id', req.params.productId).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

const getReviewEligibility = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.json({ data: [] });
    const { data: orders, error: orderError } = await supabase.from('orders').select('id, quantity, status, created_at').eq('customer_id', req.user.id).eq('product_id', req.params.productId).in('status', ['paid', 'shipped', 'delivered']).order('created_at', { ascending: false });
    if (orderError) throw orderError;
    const orderIds = (orders || []).map(order => order.id);
    if (!orderIds.length) return res.json({ data: [] });
    const { data: reviews, error: reviewError } = await supabase.from('product_reviews').select('order_id').eq('customer_id', req.user.id).in('order_id', orderIds);
    if (reviewError) throw reviewError;
    const reviewedOrders = new Set((reviews || []).map(review => review.order_id).filter(Boolean));
    const eligible = orders.filter(order => !reviewedOrders.has(order.id)).map(order => ({ id: order.id, purchased_at: order.created_at }));
    res.json({ data: eligible });
  } catch (err) { next(err); }
};

async function analyseReview(comment) {
  try { return { analysis: await analyseSentiment({ query: comment }), ai_status: 'completed' }; }
  catch (error) { console.warn('[reviews] AI analysis deferred:', error.message); return { analysis: null, ai_status: 'pending' }; }
}

const defaultReviewReply = ({ rating, flagged, productName }) => {
  if (flagged) return `Thanks for sharing your feedback about ${productName}. We’re sorry it did not meet your expectations. Our support team has been notified and will review this personally.`;
  if (rating >= 4) return `Thank you for reviewing ${productName}. We’re glad you had a positive experience and appreciate you taking the time to share it.`;
  return `Thank you for your honest feedback about ${productName}. We’ve shared it with our support team and will use it to improve your experience.`;
};

const publishAutomatedReply = async ({ reviewId, productName, rating, comment, flagged }) => {
  const fallback = defaultReviewReply({ rating, flagged, productName });
  const repliedAt = new Date().toISOString();
  const { error: replyError } = await supabase.from('product_reviews').update({ support_reply: fallback, support_replied_at: repliedAt }).eq('id', reviewId);
  if (replyError) throw replyError;
  let message = { id: `legacy-${reviewId}`, sender_type: 'ai', body: fallback, created_at: repliedAt };
  try {
    const { data, error: messageError } = await supabase
      .from('product_review_messages')
      .insert({ review_id: reviewId, sender_type: 'ai', body: fallback })
      .select('id, sender_type, body, created_at')
      .single();
    if (!messageError && data) message = data;
    else if (messageError) console.warn('[reviews] support reply thread unavailable:', messageError.message);
  } catch (messageError) {
    console.warn('[reviews] support reply thread unavailable:', messageError.message);
  }

  // The durable fallback is visible immediately. Improve it in the background
  // when Groq is available without making review submission depend on AI uptime.
  void (async () => {
    try {
      const ai = await generateJson({
        preferProvider: 'groq',
        systemInstruction: 'You are a concise, empathetic e-commerce support agent. Reply to a product review in 1-2 sentences. Never invent product facts. For a negative or urgent review, acknowledge the issue and say a support specialist will review it. Return JSON only.',
        prompt: JSON.stringify({ product: productName, rating, review: comment, needs_human: flagged }),
        responseSchema: { type: 'object', properties: { reply: { type: 'string' } }, required: ['reply'] },
      });
      const reply = String(ai.reply || '').trim();
      if (reply.length < 3) return;
      if (!message.id.startsWith('legacy-')) await supabase.from('product_review_messages').update({ body: reply }).eq('id', message.id);
      await supabase.from('product_reviews').update({ support_reply: reply, support_replied_at: new Date().toISOString() }).eq('id', reviewId);
    } catch (error) {
      console.warn('[reviews] automated support reply refinement deferred:', error.message);
    }
  })();

  return { ...message, body: fallback };
};

const createReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'A customer account is required to leave a review' });
    const { product_id, order_id, rating, comment } = req.body;
    const { data: product, error: productError } = await supabase.from('products').select('id, name, status').eq('id', product_id).single();
    if (productError || !product || product.status !== 'active') return res.status(404).json({ error: 'Product not found' });
    const { data: order, error: orderError } = await supabase.from('orders').select('id, product_id, customer_id, quantity, status').eq('id', order_id).eq('product_id', product_id).eq('customer_id', req.user.id).in('status', ['paid', 'shipped', 'delivered']).maybeSingle();
    if (orderError || !order) return res.status(403).json({ error: 'You can review a product only after purchasing it.' });
    const { count: reviewCount, error: countError } = await supabase.from('product_reviews').select('id', { count: 'exact', head: true }).eq('order_id', order_id).eq('customer_id', req.user.id);
    if (countError) throw countError;
    if ((reviewCount || 0) >= 1) return res.status(409).json({ error: 'You already reviewed this purchase. You can edit that review instead.' });
    const { analysis: ai, ai_status } = await analyseReview(comment);
    const flagged = ai?.sentiment === 'negative' || ai?.urgency === 'high';
    const { data, error } = await supabase.from('product_reviews').insert({ product_id, customer_id: req.user.id, order_id, rating, comment, sentiment: ai?.sentiment || null, urgency: ai?.urgency || null, ai_status, flagged_as_complaint: flagged, human_intervention_required: flagged, human_intervention_reason: flagged ? 'Negative sentiment or high urgency detected by AI' : null, human_intervention_status: flagged ? 'pending' : 'not_required' }).select(PUBLIC_REVIEW_SELECT).single();
    if (error) throw error;
    try {
      const automatedReply = await publishAutomatedReply({ reviewId: data.id, productName: product.name, rating, comment, flagged });
      data.support_reply = automatedReply.body;
      data.support_replied_at = new Date().toISOString();
      data.product_review_messages = [...(data.product_review_messages || []), automatedReply];
    } catch (replyError) {
      // Never roll back a valid customer review because the optional reply
      // thread is unavailable during a deployment or migration.
      console.warn('[reviews] automated support reply unavailable:', replyError.message);
    }
    writeAuditLog({ userId: req.user.id, action: 'product.review.create', resourceType: 'product_review', resourceId: data.id, metadata: { product_id, rating, flagged }, req });
    res.status(201).json({ message: flagged ? 'Review submitted and sent for support review' : 'Review submitted with an automated support reply', data });
  } catch (err) { next(err); }
};

const updateReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'A customer account is required' });
    const { rating, comment } = req.body;
    const { analysis: ai, ai_status } = await analyseReview(comment);
    const flagged = ai?.sentiment === 'negative' || ai?.urgency === 'high';
    const { data, error } = await supabase.from('product_reviews').update({ rating, comment, sentiment: ai?.sentiment || null, urgency: ai?.urgency || null, ai_status, flagged_as_complaint: flagged, human_intervention_required: flagged, human_intervention_status: flagged ? 'pending' : 'not_required' }).eq('id', req.params.id).eq('customer_id', req.user.id).select(PUBLIC_REVIEW_SELECT).single();
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

module.exports = { getProductReviews, getReviewEligibility, createReview, updateReview, getFlaggedReviews, replyToReview, replyToReviewCustomer };
