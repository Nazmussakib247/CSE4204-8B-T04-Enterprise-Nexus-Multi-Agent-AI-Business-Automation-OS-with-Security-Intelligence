const financeAgent          = require('../agents/FinanceAgent');
const FinanceModel          = require('../models/Finance');
const TaskModel             = require('../models/Task');
const { success, error, paginate } = require('../utils/response');
const logger                = require('../utils/logger');

/**
 * POST /api/finance/records
 * Add an expense record and run AI anomaly detection.
 */
const addRecord = async (req, res) => {
  const { category, amount, date, description } = req.body;
  if (!category || amount == null || !date)
    return error(res, 'category, amount, and date are required', 400);

  const task = await TaskModel.create({
    userId: req.user.id, agentType: 'finance',
    payload: { category, amount, date, description },
  });
  await TaskModel.updateStatus(task.id, 'running');

  try {
    // Fetch recent records for context
    const { data: records } = await FinanceModel.findByUser(req.user.id, { limit: 50 });

    const aiResult = await financeAgent.invoke(
      { records, newRecord: { category, amount, date, description } },
      { userId: req.user.id, taskId: task.id }
    );

    const record = await FinanceModel.create({
      userId:     req.user.id,
      category,
      amount,
      date,
      description,
      severity:   aiResult.severity,
      aiAnalysis: aiResult.ai_analysis,
    });

    await TaskModel.updateStatus(task.id, 'completed', aiResult);
    return success(res, { record, ai_analysis: aiResult }, 'Expense recorded', 201);
  } catch (err) {
    logger.error('Finance record error', { error: err.message });
    await TaskModel.updateStatus(task.id, 'failed', { error: err.message });
    return error(res, 'Failed to process expense', 500, err.message);
  }
};

/** GET /api/finance/records */
const listRecords = async (req, res) => {
  const { page = 1, limit = 20, category, date_from, date_to } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await FinanceModel.findByUser(req.user.id, {
    ...pag, category, dateFrom: date_from, dateTo: date_to,
  });
  return success(res, { records: data, meta: pag.meta(total) });
};

/** GET /api/finance/dashboard */
const getDashboard = async (req, res) => {
  const summary = await FinanceModel.dashboardSummary(req.user.id);
  return success(res, { summary });
};

module.exports = { addRecord, listRecords, getDashboard };
