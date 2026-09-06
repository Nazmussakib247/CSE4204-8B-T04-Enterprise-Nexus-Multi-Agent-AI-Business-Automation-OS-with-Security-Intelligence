const supabase = require('../config/supabase');
const { analyseSentiment } = require('../utils/gemini');
const { writeAuditLog } = require('../utils/audit');

const getProductReviews = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, rating, comment, sentiment, urgency, ai_status, support_reply, support_replied_at, created_at, users!product_reviews_customer_id_fkey(name)')
      .eq('product_id', req.params.productId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

const createReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'A customer account is required to leave a review' });
    const { product_id, rating, comment } = req.body;
    const { data: product, error: productError } = await supabase.from('products').select('id, name, status').eq('id', product_id).single();
    if (productError || !product || product.status !== 'active') return res.status(404).json({ error: 'Product not found' });
    // A review is customer data first.  AI enrichment must never make a
    // legitimate customer submission disappear when Gemini/n8n is offline.
    // Pending rows are picked up by the store-review n8n workflow later.
    let ai = null;
    let aiStatus = 'completed';
    try {
      ai = await analyseSentiment({ query: comment });
    } catch (aiError) {
      aiStatus = 'pending';
      console.warn('[reviews] AI analysis deferred:', aiError.message);
    }

    const flagged = ai?.sentiment === 'negative' || ai?.urgency === 'high';
    const { data, error } = await supabase.from('product_reviews').insert({
      product_id, customer_id: req.user.id, rating, comment,
      sentiment: ai?.sentiment || null,
      urgency: ai?.urgency || null,
      ai_status: aiStatus,
      flagged_as_complaint: flagged,
      human_intervention_required: flagged,
      human_intervention_reason: flagged ? 'Negative sentiment or high urgency detected by AI' : null,
      human_intervention_status: flagged ? 'pending' : 'not_required',
    }).select('*, users!product_reviews_customer_id_fkey(name)').single();
    if (error) throw error;
    writeAuditLog({ userId: req.user.id, action: 'product.review.create', resourceType: 'product_review', resourceId: data.id, metadata: { product_id, rating, flagged }, req });
    res.status(201).json({
      message: flagged
        ? 'Review submitted and flagged for Support review'
        : aiStatus === 'pending'
          ? 'Review submitted. AI analysis will run shortly.'
          : 'Review submitted',
      data,
      ai_analysis: ai,
    });
  } catch (err) { next(err); }
};

const getFlaggedReviews = async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*, products(name, slug), users!product_reviews_customer_id_fkey(name, email)')
      .eq('flagged_as_complaint', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

const replyToReview = async (req, res, next) => {
  try {
    const { response } = req.body;
    const { data, error } = await supabase
      .from('product_reviews')
      .update({
        support_reply: response,
        support_replied_by: req.user.id,
        support_replied_at: new Date().toISOString(),
        human_intervention_required: false,
        human_intervention_status: 'handled',
      })
      .eq('id', req.params.id)
      .select('*, products(name, slug), users!product_reviews_customer_id_fkey(name, email)')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Review not found' });
    writeAuditLog({ userId: req.user.id, action: 'product.review.reply', resourceType: 'product_review', resourceId: data.id, metadata: { response_length: response.length }, req });
    res.json({ message: 'Support reply published', data });
  } catch (err) { next(err); }
};

module.exports = { getProductReviews, createReview, getFlaggedReviews, replyToReview };
