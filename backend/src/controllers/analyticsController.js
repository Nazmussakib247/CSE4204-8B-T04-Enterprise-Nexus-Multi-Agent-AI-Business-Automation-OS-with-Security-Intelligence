const analyticsAgent        = require('../agents/AnalyticsAgent');
const AnalyticsModel        = require('../models/Analytics');
const TaskModel             = require('../models/Task');
const { success, error, paginate } = require('../utils/response');
const logger                = require('../utils/logger');

/** GET /api/analytics/kpi — live KPI data */
const getLiveKpi = async (req, res) => {
  const days = parseInt(req.query.days || '30');
  const kpi  = await AnalyticsModel.liveKpi(req.user.id, days);
  return success(res, { kpi });
};

/** GET /api/analytics/trends — 6-month trend */
const getSixMonthTrend = async (req, res) => {
  const trend = await AnalyticsModel.sixMonthTrend(req.user.id);
  return success(res, { trend });
};

/**
 * POST /api/analytics/reports
 * Generate an AI analytics report for a given period.
 */
const generateReport = async (req, res) => {
  const { date_period_start, date_period_end } = req.body;
  if (!date_period_start || !date_period_end)
    return error(res, 'date_period_start and date_period_end are required', 400);

  const task = await TaskModel.create({
    userId: req.user.id, agentType: 'analytics',
    payload: { date_period_start, date_period_end },
  });
  await TaskModel.updateStatus(task.id, 'running');

  try {
    const kpiData = await AnalyticsModel.liveKpi(req.user.id, 30);

    const aiResult = await analyticsAgent.invoke(
      { kpiData, datePeriodStart: date_period_start, datePeriodEnd: date_period_end },
      { userId: req.user.id, taskId: task.id }
    );

    const report = await AnalyticsModel.create({
      userId:           req.user.id,
      taskId:           task.id,
      datePeriodStart:  date_period_start,
      datePeriodEnd:    date_period_end,
      performanceRating:aiResult.performance_rating,
      overallScore:     aiResult.overall_score,
      aiInsights:       aiResult.ai_insights,
      actionItems:      aiResult.action_items,
      kpiSnapshot:      kpiData,
    });

    await TaskModel.updateStatus(task.id, 'completed', aiResult);
    return success(res, { report }, 'Analytics report generated', 201);
  } catch (err) {
    logger.error('Analytics report error', { error: err.message });
    await TaskModel.updateStatus(task.id, 'failed', { error: err.message });
    return error(res, 'Failed to generate analytics report', 500, err.message);
  }
};

/** GET /api/analytics/reports */
const listReports = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await AnalyticsModel.findByUser(req.user.id, pag);
  return success(res, { reports: data, meta: pag.meta(total) });
};

module.exports = { getLiveKpi, getSixMonthTrend, generateReport, listReports };
