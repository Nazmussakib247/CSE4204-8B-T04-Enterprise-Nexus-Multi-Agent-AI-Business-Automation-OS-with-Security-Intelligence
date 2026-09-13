const supabase = require('../config/supabase');
const { notifyN8n } = require('../utils/webhook');
const { sendEscalationEmail } = require('../utils/email');
const { writeAuditLog } = require('../utils/audit');
const { isOfficeUser } = require('../middleware/roles');

// GET /api/support/tickets
const getTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, urgency, sentiment, escalated } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('support_tickets')
      .select('*, support_messages(id, sender_id, sender_type, body, created_at)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (!isOfficeUser(req.user)) query = query.eq('user_id', req.user.id);

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
      .select('*, support_messages(id, sender_id, sender_type, body, created_at)')
      .eq('id', req.params.id);
    if (!isOfficeUser(req.user)) query = query.eq('user_id', req.user.id);
    const { data, error } = await query.single();

    if (error || !data) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /api/support/tickets — persist immediately; AI enrichment is async.
const createTicket = async (req, res, next) => {
  try {
    const { query, order_id, product_id } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    let linkedOrder = null;
    if (order_id) {
      let orderQuery = supabase.from('orders').select('id, customer_id, product_id, status, quantity, total, created_at').eq('id', order_id);
      if (!isOfficeUser(req.user)) orderQuery = orderQuery.eq('customer_id', req.user.id);
      const { data, error } = await orderQuery.single();
      if (error || !data) return res.status(400).json({ error: 'Linked order was not found or is not yours' });
      linkedOrder = data;
    }
    const linkedProductId = product_id || linkedOrder?.product_id || null;
    if (linkedProductId) {
      const { data: product, error } = await supabase.from('products').select('id, name').eq('id', linkedProductId).single();
      if (error || !product) return res.status(400).json({ error: 'Linked product was not found' });
      if (linkedOrder && linkedOrder.product_id !== linkedProductId) return res.status(400).json({ error: 'Linked product does not match the selected order' });
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: req.user.id,
        query,
        ai_status: 'pending',
        status: 'open',
        escalated: false,
        human_intervention_required: false,
        human_intervention_status: 'not_required',
        order_id: linkedOrder?.id || null,
        product_id: linkedProductId,
      })
      .select()
      .single();

    if (error) throw error;

    const { error: messageError } = await supabase.from('support_messages').insert({
      ticket_id: data.id, sender_id: req.user.id, sender_type: 'customer', body: query,
    });
    if (messageError) throw messageError;

    writeAuditLog({
      userId: req.user.id,
      action: 'support.ticket.create',
      resourceType: 'support_ticket',
      resourceId: data.id,
      metadata: { ai_status: 'pending', order_id: linkedOrder?.id || null, product_id: linkedProductId },
      req,
    });

    // This is deliberately non-blocking: a slow Gemini/Render/n8n call must
    // never make the customer's send action feel stuck.
    notifyN8n('store-support-retry', { ticket_id: data.id, user_id: req.user.id, query, order_id: linkedOrder?.id || null, product_id: linkedProductId, created_at: data.created_at });

    res.status(201).json({
      message: 'Support request sent. Our team will reply in this conversation.',
      data,
      ai_analysis: null,
    });
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

    let updateQuery = supabase.from('support_tickets').update(updates).eq('id', req.params.id);
    if (!isOfficeUser(req.user)) updateQuery = updateQuery.eq('user_id', req.user.id);
    const { data, error } = await updateQuery.select().single();

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
    let updateQuery = supabase
      .from('support_tickets')
      .update({
        escalated: true,
        status: 'escalated',
        human_intervention_required: true,
        human_intervention_reason: 'Manually escalated by support staff',
        human_intervention_status: 'pending',
      })
      .eq('id', req.params.id);
    if (!isOfficeUser(req.user)) updateQuery = updateQuery.eq('user_id', req.user.id);
    const { data, error } = await updateQuery.select().single();

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

// PATCH /api/support/tickets/:id/reply — office support reply visible to customer
const replyToTicket = async (req, res, next) => {
  try {
    const { response } = req.body;
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        human_response: response,
        human_response_by: req.user.id,
        human_response_at: new Date().toISOString(),
        human_intervention_status: 'handled',
        status: 'in_progress',
      })
      .eq('id', req.params.id)
      .select()
      .single();

    // Do not turn a database/schema error into a misleading 404. In
    // particular, a deployment whose database has not received migration 011
    // cannot store the human reply fields yet.
    if (error) {
      const missingReplyColumns = error.code === 'PGRST204'
        || /human_(response|intervention)/i.test(error.message || '');
      if (missingReplyColumns) {
        return res.status(503).json({
          error: 'Support reply storage is not ready. Apply Supabase migration 011_store_support_reply_lifecycle.sql, then try again.',
        });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Ticket not found' });
    const { error: messageError } = await supabase.from('support_messages').insert({
      ticket_id: data.id, sender_id: req.user.id, sender_type: 'staff', body: response,
    });
    if (messageError) throw messageError;
    writeAuditLog({ userId: req.user.id, action: 'support.ticket.reply', resourceType: 'support_ticket', resourceId: data.id, metadata: { response_length: response.length }, req });
    res.json({ message: 'Support reply sent to customer', data });
  } catch (err) { next(err); }
};

// POST /api/support/tickets/:id/messages — customer or office follow-up
const createMessage = async (req, res, next) => {
  try {
    let ticketQuery = supabase.from('support_tickets').select('id, user_id, status').eq('id', req.params.id);
    if (!isOfficeUser(req.user)) ticketQuery = ticketQuery.eq('user_id', req.user.id);
    const { data: ticket, error: ticketError } = await ticketQuery.single();
    if (ticketError || !ticket) return res.status(404).json({ error: 'Ticket not found' });

    const sender_type = isOfficeUser(req.user) ? 'staff' : 'customer';
    const { data, error } = await supabase.from('support_messages').insert({
      ticket_id: ticket.id, sender_id: req.user.id, sender_type, body: req.body.body,
    }).select().single();
    if (error) throw error;

    if (sender_type === 'customer') {
      await supabase.from('support_tickets').update({ status: 'open', human_intervention_required: true, human_intervention_status: 'pending', human_intervention_reason: 'Customer sent a follow-up message' }).eq('id', ticket.id);
    } else {
      await supabase.from('support_tickets').update({ status: 'in_progress', human_intervention_status: 'handled' }).eq('id', ticket.id);
    }
    writeAuditLog({ userId: req.user.id, action: 'support.ticket.message', resourceType: 'support_ticket', resourceId: ticket.id, metadata: { sender_type, length: req.body.body.length }, req });
    res.status(201).json({ message: 'Message sent', data });
  } catch (err) { next(err); }
};

// GET /api/support/sentiment-report
const getSentimentReport = async (req, res, next) => {
  try {
    let query = supabase
      .from('support_tickets')
      .select('sentiment, urgency, status, escalated, created_at');
    if (!isOfficeUser(req.user)) query = query.eq('user_id', req.user.id);
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
    let updateQuery = supabase
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', req.params.id);
    if (!isOfficeUser(req.user)) updateQuery = updateQuery.eq('user_id', req.user.id);
    const { data, error } = await updateQuery.select().single();

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

module.exports = { getTickets, getTicket, createTicket, updateTicket, escalateTicket, getSentimentReport, resolveTicket, replyToTicket, createMessage };
