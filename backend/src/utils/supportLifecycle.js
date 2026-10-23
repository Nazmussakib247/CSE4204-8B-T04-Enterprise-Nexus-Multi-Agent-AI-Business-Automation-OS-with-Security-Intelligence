const supabase = require('../config/supabase');
const logger = require('./logger');

const SUPPORT_AUTO_CLOSE_MS = 60 * 60 * 1000;
const SUPPORT_AUTO_CLOSE_POLL_MS = 5 * 60 * 1000;

/**
 * Close conversations where the latest support/AI message has been waiting
 * for a customer response for an hour. The check is idempotent and derives
 * its state from support_messages, so a process restart cannot lose timers.
 */
const closeInactiveSupportTickets = async () => {
  const cutoff = new Date(Date.now() - SUPPORT_AUTO_CLOSE_MS).toISOString();
  const { data: tickets, error: ticketError } = await supabase
    .from('support_tickets')
    .select('id')
    .in('status', ['open', 'in_progress', 'escalated']);
  if (ticketError) throw ticketError;
  if (!tickets?.length) return 0;

  const ids = tickets.map((ticket) => ticket.id);
  const { data: messages, error: messageError } = await supabase
    .from('support_messages')
    .select('ticket_id, sender_type, created_at')
    .in('ticket_id', ids)
    .order('created_at', { ascending: false });
  if (messageError) throw messageError;

  const latestByTicket = new Map();
  for (const message of messages || []) {
    if (!latestByTicket.has(message.ticket_id)) latestByTicket.set(message.ticket_id, message);
  }

  const candidates = ids.filter((id) => {
    const latest = latestByTicket.get(id);
    return latest && latest.sender_type !== 'customer' && latest.created_at <= cutoff;
  });

  let closed = 0;
  for (const id of candidates) {
    // Keep the status predicate so a customer reply racing this worker wins.
    const { data, error } = await supabase
      .from('support_tickets')
      .update({ status: 'resolved', human_intervention_status: 'handled' })
      .eq('id', id)
      .in('status', ['open', 'in_progress', 'escalated'])
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data) closed += 1;
  }
  return closed;
};

const startSupportAutoCloseWorker = () => {
  const run = () => closeInactiveSupportTickets()
    .then((closed) => { if (closed) logger.info('Auto-closed inactive support tickets', { closed }); })
    .catch((error) => logger.error('Support auto-close worker failed', { error: error.message }));
  run();
  const interval = setInterval(run, SUPPORT_AUTO_CLOSE_POLL_MS);
  interval.unref();
  return interval;
};

module.exports = { SUPPORT_AUTO_CLOSE_MS, closeInactiveSupportTickets, startSupportAutoCloseWorker };
