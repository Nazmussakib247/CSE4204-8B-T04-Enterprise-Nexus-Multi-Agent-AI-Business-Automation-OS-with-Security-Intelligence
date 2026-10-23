const supabase = require('../config/supabase');
const { writeAuditLog } = require('../utils/audit');

// GET /api/products — public storefront listing (active only, no auth required)
const getProducts = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, slug, name, tagline, price, icon, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:slug — public product detail (active only)
const getProductBySlug = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('status', 'active')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Product not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/admin/all — staff-only, includes draft/discontinued
const getAllProductsForStaff = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/products — staff only (admin/manager)
const createProduct = async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('products').select('id').eq('slug', req.body.slug).single();
    if (existing) return res.status(409).json({ error: 'A product with this slug already exists' });

    const { data, error } = await supabase
      .from('products')
      .insert({ ...req.body, created_by: req.user.id })
      .select()
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id, action: 'product.create', resourceType: 'product', resourceId: data.id,
      metadata: { name: data.name, price: data.price }, req,
    });

    res.status(201).json({ message: 'Product created', data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/products/:id — staff only
const updateProduct = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Product not found' });

    writeAuditLog({ userId: req.user.id, action: 'product.update', resourceType: 'product', resourceId: data.id, req });

    res.json({ message: 'Product updated', data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id — staff only
const deleteProduct = async (req, res, next) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;

    writeAuditLog({ userId: req.user.id, action: 'product.delete', resourceType: 'product', resourceId: req.params.id, req });

    res.json({ message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProductBySlug, getAllProductsForStaff, createProduct, updateProduct, deleteProduct };
