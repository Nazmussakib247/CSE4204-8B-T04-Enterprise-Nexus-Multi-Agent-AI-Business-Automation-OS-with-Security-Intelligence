const supabase = require('../config/supabase');
const { analyseSentiment } = require('../utils/gemini');
const { notifyN8n } = require('../utils/webhook');
const { sendEscalationEmail } = require('../utils/email');
const { writeAuditLog } = require('../utils/audit');
const STAFF_ROLES = ['admin', 'manager', 'employee'];
const isStaff = (user) => STAFF_ROLES.includes(user.role);

// GET /api/support/tickets
const getTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, urgency, sentiment, escalated } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('support_tickets')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (!isStaff(req.user)) query = query.eq('user_id', req.user.id);

    if (status) query = query.eq('status', status);
    if (urgency) query = query.eq('urgency', urgency);
    if (sentiment) query = query.eq('sentiment', sentiment);
    if (escalated !== undefined) query = query.eq('escalated', escalated === 'true');

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/support/tickets/:id
const getTicket = async (req, res, next) => {
  try {
    let query = supabase
      .from('support_tickets')
      .select('*')
      .eq('id', req.params.id);
    if (!isStaff(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.single();

    if (error || !data) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /api/support/tickets — Gemini sentiment analysis
const createTicket = async (req, res, next) => {
  try {
    const { query, order_id, product_id } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    let linkedOrder = null;
    let linkedProduct = null;
    if (order_id) {
      let orderQuery = supabase.from('orders').select('id, customer_id, product_id, status, quantity, total, created_at').eq('id', order_id);
      if (!isStaff(req.user)) orderQuery = orderQuery.eq('customer_id', req.user.id);
      const { data, error } = await orderQuery.single();
      if (error || !data) return res.status(400).json({ error: 'Linked order was not found or is not yours' });
      linkedOrder = data;
    }
    const linkedProductId = product_id || linkedOrder?.product_id || null;
    if (linkedProductId) {
      const { data: product, error } = await supabase.from('products').select('id, name').eq('id', linkedProductId).single();
      if (error || !product) return res.status(400).json({ error: 'Linked product was not found' });
      if (linkedOrder && linkedOrder.product_id !== linkedProductId) return res.status(400).json({ error: 'Linked product does not match the selected order' });
      linkedProduct = product;
    }

    // Give the AI the order/product context so its auto-reply is grounded in
    // the actual purchase, not just the raw complaint text.
    const contextLines = [];
    if (linkedProduct) contextLines.push(`Product: ${linkedProduct.name}`);
    if (linkedOrder) {
      contextLines.push(`Order #${linkedOrder.id.slice(0, 8)} — status: ${linkedOrder.status}, quantity: ${linkedOrder.quantity}, placed: ${new Date(linkedOrder.created_at).toISOString().slice(0, 10)}`);
    }
    const aiQuery = contextLines.length
      ? `${query}\n\n[Order context — use this to ground your reply, e.g. reference the order status directly]\n${contextLines.join('\n')}`
      : query;

    const aiResult = await analyseSentiment({ query: aiQuery });

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: req.user.id,
        query,
        ai_response: aiResult.ai_response,
        intent: aiResult.intent,
        urgency: aiResult.urgency,
        sentiment: aiResult.sentiment,
        confidence: aiResult.confidence,
        status: 'open',
        escalated: aiResult.urgency === 'high',
        order_id: linkedOrder?.id || null,
        product_id: linkedProductId,
      })
      .select()
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'support.ticket.create',
      resourceType: 'support_ticket',
      resourceId: data.id,
      metadata: { urgency: aiResult.urgency, sentiment: aiResult.sentiment, order_id: linkedOrder?.id || null, product_id: linkedProductId },
      req,
    });

    notifyN8n('support-ticket', {
      ticket_id: data.id,
      user_id: req.user.id,
      urgency: aiResult.urgency,
      sentiment: aiResult.sentiment,
      intent: aiResult.intent,
      escalated: data.escalated,
      created_at: data.created_at,
    });

    res.status(201).json({ message: 'Ticket created with AI analysis', data, ai_analysis: aiResult });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/support/tickets/:id
const updateTicket = async (req, res, next) => {
  try {
    const { status, query: ticketQuery } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (ticketQuery !== undefined) updates.query = ticketQuery;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ticket not found' });

    writeAuditLog({
      userId: req.user.id,
      action: 'support.ticket.update',
      resourceType: 'support_ticket',
      resourceId: data.id,
      metadata: updates,
      req,
    });

    res.json({ message: 'Ticket updated', data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/support/tickets/:id/escalate
const escalateTicket = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ escalated: true, status: 'escalated', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ticket not found' });

    writeAuditLog({
      userId: req.user.id,
      action: 'support.ticket.escalate',
      resourceType: 'support_ticket',
      resourceId: data.id,
      metadata: { urgency: data.urgency },
      req,
    });

    // Send escalation email — fire and forget
    if (process.env.ESCALATION_EMAIL) {
      sendEscalationEmail({
        to: process.env.ESCALATION_EMAIL,
        ticketId: data.id,
        subject: data.query?.substring(0, 80) || 'Support Ticket',
        priority: data.urgency || 'high',
        description: data.query || '',
        assigneeName: req.user.name,
      }).catch(() => {});
    }

    notifyN8n('support-escalation', {
      ticket_id: data.id,
      user_id: req.user.id,
      urgency: data.urgency,
    });

    res.json({ message: 'Ticket escalated', data });
  } catch (err) {
    next(err);
  }
};

// GET /api/support/sentiment-report
const getSentimentReport = async (req, res, next) => {
  try {
    let query = supabase
      .from('support_tickets')
      .select('sentiment, urgency, status, escalated, created_at');
    if (!isStaff(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query;

    if (error) throw error;

    const report = {
      total: data.length,
      by_sentiment: {
        positive: data.filter(t => t.sentiment === 'positive').length,
        neutral:  data.filter(t => t.sentiment === 'neutral').length,
        negative: data.filter(t => t.sentiment === 'negative').length,
      },
      by_urgency: {
        low:    data.filter(t => t.urgency === 'low').length,
        medium: data.filter(t => t.urgency === 'medium').length,
        high:   data.filter(t => t.urgency === 'high').length,
      },
      escalated: data.filter(t => t.escalated).length,
      open:      data.filter(t => t.status === 'open').length,
      resolved:  data.filter(t => t.status === 'resolved').length,
    };

    res.json({ report });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/support/tickets/:id/resolve
const resolveTicket = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ticket not found' });

    writeAuditLog({
      userId: req.user.id,
      action: 'support.ticket.resolve',
      resourceType: 'support_ticket',
      resourceId: data.id,
      req,
    });

    res.json({ message: 'Ticket resolved', data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTickets, getTicket, createTicket, updateTicket, escalateTicket, getSentimentReport, resolveTicket };
