// ── Finance ─────────────────────────────────────────────
const financeRouter = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { addRecord, listRecords, getDashboard } = require('../controllers/financeController');

financeRouter.post('/records',    authenticate, addRecord);
financeRouter.get ('/records',    authenticate, listRecords);
financeRouter.get ('/dashboard',  authenticate, getDashboard);

// ── Support ─────────────────────────────────────────────
const supportRouter = require('express').Router();
const { submitQuery, listTickets, updateStatus } = require('../controllers/supportController');

supportRouter.post('/tickets',              authenticate, submitQuery);
supportRouter.get ('/tickets',              authenticate, listTickets);
supportRouter.patch('/tickets/:id/status',  authenticate, updateStatus);

// ── Analytics ───────────────────────────────────────────
const analyticsRouter = require('express').Router();
const { getLiveKpi, getSixMonthTrend, generateReport, listReports } = require('../controllers/analyticsController');

analyticsRouter.get ('/kpi',        authenticate, getLiveKpi);
analyticsRouter.get ('/trends',     authenticate, getSixMonthTrend);
analyticsRouter.post('/reports',    authenticate, generateReport);
analyticsRouter.get ('/reports',    authenticate, listReports);

// ── Workflow ─────────────────────────────────────────────
const workflowRouter = require('express').Router();
const { dispatch, getPipeline, getTask, runNamedWorkflow, getDefinitions } = require('../controllers/workflowController');

workflowRouter.post('/dispatch',        authenticate, dispatch);
workflowRouter.get ('/tasks',           authenticate, getPipeline);
workflowRouter.get ('/tasks/:id',       authenticate, getTask);
workflowRouter.post('/run/:name',       authenticate, runNamedWorkflow);
workflowRouter.get ('/definitions',     authenticate, getDefinitions);

// ── Executive (admin only) ───────────────────────────────
const executiveRouter = require('express').Router();
const { generateBriefing, listBriefings, getBriefing } = require('../controllers/executiveController');

executiveRouter.post('/briefings',        authenticate, authorize('admin'), generateBriefing);
executiveRouter.get ('/briefings',        authenticate, authorize('admin'), listBriefings);
executiveRouter.get ('/briefings/:id',    authenticate, authorize('admin'), getBriefing);

// ── System ───────────────────────────────────────────────
const systemRouter = require('express').Router();
const { healthLive, healthDeep, getTokenStats, evictCache } = require('../controllers/systemController');

systemRouter.get ('/health',           healthLive);
systemRouter.get ('/health/deep',      authenticate, healthDeep);
systemRouter.get ('/tokens',           authenticate, authorize('admin'), getTokenStats);
systemRouter.delete('/cache',          authenticate, authorize('admin'), evictCache);

module.exports = { financeRouter, supportRouter, analyticsRouter, workflowRouter, executiveRouter, systemRouter };
