const supabase = require('../config/supabase');
const { writeAuditLog } = require('../utils/audit');

// POST /api/orders — customer places a mock order (no real payment gateway)
const createOrder = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'A customer account is required to place an order' });
    }
    const { product_id, quantity = 1 } = req.body;

    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, price, status')
      .eq('id', product_id)
      .single();

    if (productErr || !product) return res.status(404).json({ error: 'Product not found' });
    if (product.status !== 'active') return res.status(400).json({ error: 'This product is not available for purchase' });

    // Total is computed server-side from the current price — never trust a client-sent total.
    const total = Math.round(product.price * quantity * 100) / 100;

    const { data, error } = await supabase
      .from('orders')
      .insert({
        customer_id: req.user.id,
        product_id,
        quantity,
        total,
        status: 'paid', // mocked checkout — instantly "paid", no real gateway
      })
      .select('*, products(name, icon, slug)')
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id, action: 'order.create', resourceType: 'order', resourceId: data.id,
      metadata: { product: product.name, quantity, total }, req,
    });

    res.status(201).json({ message: 'Order placed', data });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders — customer's own orders (staff can pass ?all=1 to see everything)
const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, all } = req.query;
    const offset = (page - 1) * limit;
    const isStaff = ['admin', 'manager'].includes(req.user.role);

    let query = supabase
      .from('orders')
      .select('*, products(name, icon, slug)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (!(isStaff && all)) query = query.eq('customer_id', req.user.id);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/orders/:id
const getOrder = async (req, res, next) => {
  try {
    const isStaff = ['admin', 'manager'].includes(req.user.role);
    let query = supabase.from('orders').select('*, products(name, icon, slug)').eq('id', req.params.id);
    if (!isStaff) query = query.eq('customer_id', req.user.id);

    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/orders/:id/status — staff only (simulate shipped/delivered progression)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: req.body.status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found' });

    writeAuditLog({
      userId: req.user.id, action: 'order.status.update', resourceType: 'order', resourceId: data.id,
      metadata: { status: req.body.status }, req,
    });

    res.json({ message: 'Order status updated', data });
  } catch (err) {
    next(err);
  }
};

module.exports = { createOrder, getOrders, getOrder, updateOrderStatus };
