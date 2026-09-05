const supabase = require('../config/supabase');
const { analyseSentiment } = require('../utils/gemini');
const { writeAuditLog } = require('../utils/audit');

const getProductReviews = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, rating, comment, sentiment, urgency, created_at, users!product_reviews_customer_id_fkey(name)')
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
    const ai = await analyseSentiment({ query: comment });
    const flagged = ai.sentiment === 'negative' || ai.urgency === 'high';
    const { data, error } = await supabase.from('product_reviews').insert({
      product_id, customer_id: req.user.id, rating, comment,
      sentiment: ai.sentiment, urgency: ai.urgency, flagged_as_complaint: flagged,
    }).select('*, users!product_reviews_customer_id_fkey(name)').single();
    if (error) throw error;
    writeAuditLog({ userId: req.user.id, action: 'product.review.create', resourceType: 'product_review', resourceId: data.id, metadata: { product_id, rating, flagged }, req });
    res.status(201).json({ message: flagged ? 'Review submitted and flagged for Support review' : 'Review submitted', data, ai_analysis: ai });
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

module.exports = { getProductReviews, createReview, getFlaggedReviews };
