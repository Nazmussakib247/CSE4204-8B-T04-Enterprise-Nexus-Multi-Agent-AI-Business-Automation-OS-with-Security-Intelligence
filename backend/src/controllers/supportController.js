const supportAgent          = require('../agents/SupportAgent');
const SupportModel          = require('../models/Support');
const TaskModel             = require('../models/Task');
const { success, error, paginate } = require('../utils/response');
const logger                = require('../utils/logger');

/** POST /api/support/tickets */
const submitQuery = async (req, res) => {
  const { query } = req.body;
  if (!query) return error(res, 'query is required', 400);

  const task = await TaskModel.create({
    userId: req.user.id, agentType: 'support',
    text: query,
  });
  await TaskModel.updateStatus(task.id, 'running');

  try {
    const { data: history } = await SupportModel.findByUser(req.user.id, { limit: 10 });

    const aiResult = await supportAgent.invoke(
      { query, ticketHistory: history },
      { userId: req.user.id, taskId: task.id }
    );

    const ticket = await SupportModel.create({
      userId:     req.user.id,
      taskId:     task.id,
      textQuery:  query,
      aiResponse: aiResult.ai_response,
      intent:     aiResult.intent,
      urgency:    aiResult.urgency,
      sentiment:  aiResult.sentiment,
      confidence: aiResult.confidence,
      escalated:  aiResult.escalated,
    });

    await TaskModel.updateStatus(task.id, 'completed', aiResult);
    return success(res, { ticket }, 'Support ticket created', 201);
  } catch (err) {
    logger.error('Support ticket error', { error: err.message });
    await TaskModel.updateStatus(task.id, 'failed', { error: err.message });
    return error(res, 'Failed to process support query', 500, err.message);
  }
};

/** GET /api/support/tickets */
const listTickets = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await SupportModel.findByUser(req.user.id, { ...pag, status });
  return success(res, { tickets: data, meta: pag.meta(total) });
};

/** PATCH /api/support/tickets/:id/status */
const updateStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ['open', 'resolved', 'escalated'];
  if (!allowed.includes(status))
    return error(res, `status must be one of: ${allowed.join(', ')}`, 400);

  const ticket = await SupportModel.updateStatus(req.params.id, req.user.id, status);
  if (!ticket) return error(res, 'Ticket not found', 404);
  return success(res, { ticket });
};

module.exports = { submitQuery, listTickets, updateStatus };
