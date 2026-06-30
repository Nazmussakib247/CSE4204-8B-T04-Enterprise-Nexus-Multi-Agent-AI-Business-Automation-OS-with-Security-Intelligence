const executiveAgent        = require('../agents/ExecutiveAgent');
const ExecutiveModel        = require('../models/Executive');
const AnalyticsModel        = require('../models/Analytics');
const FinanceModel          = require('../models/Finance');
const HRModel               = require('../models/HR');
const SupportModel          = require('../models/Support');
const TaskModel             = require('../models/Task');
const { success, error, paginate } = require('../utils/response');
const logger                = require('../utils/logger');

/**
 * POST /api/executive/briefing
 * Generate a board-level executive briefing (admin only).
 */
const generateBriefing = async (req, res) => {
  const { date } = req.body;

  const task = await TaskModel.create({
    userId: req.user.id, agentType: 'executive', payload: { date },
  });
  await TaskModel.updateStatus(task.id, 'running');

  try {
    // Gather cross-domain summaries in parallel
    const [hrData, financeData, supportData, analyticsData] = await Promise.all([
      HRModel.getBatchRankings(req.user.id, { limit: 10 }),
      FinanceModel.dashboardSummary(req.user.id),
      SupportModel.findByUser(req.user.id, { limit: 10 }),
      AnalyticsModel.liveKpi(req.user.id, 30),
    ]);

    const aiResult = await executiveAgent.invoke(
      {
        hrSummary:        hrData,
        financeSummary:   financeData,
        supportSummary:   supportData.data,
        analyticsSummary: analyticsData,
        date,
      },
      { userId: req.user.id, taskId: task.id }
    );

    const report = await ExecutiveModel.create({
      userId:             req.user.id,
      taskId:             task.id,
      date:               date || new Date().toISOString().split('T')[0],
      briefingText:       aiResult.briefing_text,
      agentOutputs:       { hr: hrData, finance: financeData, support: supportData.data, analytics: analyticsData },
      performanceSummary: aiResult.performance_summary,
    });

    await TaskModel.updateStatus(task.id, 'completed', aiResult);
    return success(res, { report, recommendations: aiResult.recommendations }, 'Executive briefing generated', 201);
  } catch (err) {
    logger.error('Executive briefing error', { error: err.message });
    await TaskModel.updateStatus(task.id, 'failed', { error: err.message });
    return error(res, 'Failed to generate executive briefing', 500, err.message);
  }
};

/** GET /api/executive/briefings */
const listBriefings = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await ExecutiveModel.findByUser(req.user.id, pag);
  return success(res, { briefings: data, meta: pag.meta(total) });
};

/** GET /api/executive/briefings/:id */
const getBriefing = async (req, res) => {
  const report = await ExecutiveModel.findById(req.params.id);
  if (!report) return error(res, 'Briefing not found', 404);
  return success(res, { report });
};

module.exports = { generateBriefing, listBriefings, getBriefing };
