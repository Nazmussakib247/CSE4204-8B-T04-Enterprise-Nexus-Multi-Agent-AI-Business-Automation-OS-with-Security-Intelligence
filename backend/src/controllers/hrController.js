const hrAgent               = require('../agents/HRAgent');
const HRModel               = require('../models/HR');
const TaskModel             = require('../models/Task');
const { success, error, paginate } = require('../utils/response');
const logger                = require('../utils/logger');

/**
 * POST /api/hr/screen
 * Upload CV text + job info and run AI screening.
 * Body: { cv_text, job_title, job_description }
 */
const screenCV = async (req, res) => {
  const { cv_text, job_title, job_description } = req.body;
  if (!cv_text) return error(res, 'cv_text is required', 400);

  // Create task record
  const task = await TaskModel.create({
    userId:    req.user.id,
    agentType: 'hr',
    payload:   { job_title, job_description },
    text:      cv_text,
  });
  await TaskModel.updateStatus(task.id, 'running');

  try {
    const aiResult = await hrAgent.invoke(
      { cvText: cv_text, jobTitle: job_title, jobDescription: job_description },
      { userId: req.user.id, taskId: task.id }
    );

    const report = await HRModel.create({
      userId:           req.user.id,
      taskId:           task.id,
      candidateName:    aiResult.candidate_name,
      jobTitle:         aiResult.job_title,
      aiScore:          aiResult.ai_score,
      confidence:       aiResult.confidence,
      recommendation:   aiResult.recommendation,
      narrativeSummary: aiResult.narrative_summary,
      scoreBreakdown:   aiResult.score_breakdown,
      extractedProfile: aiResult.extracted_profile,
    });

    await TaskModel.updateStatus(task.id, 'completed', aiResult);
    return success(res, { report, task_id: task.id }, 'CV screened successfully', 201);
  } catch (err) {
    logger.error('HR screening error', { error: err.message });
    await TaskModel.updateStatus(task.id, 'failed', { error: err.message });
    return error(res, 'AI screening failed', 500, err.message);
  }
};

/**
 * GET /api/hr/reports
 * List this user's HR screening history.
 */
const listReports = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await HRModel.findByUser(req.user.id, pag);
  return success(res, { reports: data, meta: pag.meta(total) });
};

/**
 * GET /api/hr/reports/:id
 */
const getReport = async (req, res) => {
  const report = await HRModel.findById(req.params.id);
  if (!report || report.user_id !== req.user.id)
    return error(res, 'Report not found', 404);
  return success(res, { report });
};

/**
 * GET /api/hr/rankings
 * Return all candidates ranked by AI score.
 */
const getBatchRankings = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pag = paginate(page, limit);
  const rankings = await HRModel.getBatchRankings(req.user.id, pag);
  return success(res, { rankings });
};

module.exports = { screenCV, listReports, getReport, getBatchRankings };
