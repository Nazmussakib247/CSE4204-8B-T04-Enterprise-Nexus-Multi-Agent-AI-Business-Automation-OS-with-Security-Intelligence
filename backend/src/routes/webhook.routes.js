const express = require('express');
const router = express.Router();
const {
  verifySecret,
  taskUpdate,
  saveExecutiveBriefing,
  saveAnalyticsKPI,
  escalateTicket,
  saveJobApplicationScreening,
  saveStoreReviewAnalysis,
  saveStoreSupportAnalysis,
  getPendingTasks,
} = require('../controllers/webhook.controller');

// All webhook routes are protected by shared secret, NOT JWT
router.use(verifySecret);

router.post('/task-update',          taskUpdate);
router.post('/executive-briefing',   saveExecutiveBriefing);
router.post('/analytics-kpi',        saveAnalyticsKPI);
router.post('/support-escalate',     escalateTicket);
router.post('/job-application-screened', saveJobApplicationScreening);
router.post('/store-review-analysed', saveStoreReviewAnalysis);
router.post('/store-support-analysed', saveStoreSupportAnalysis);
router.get('/pending-tasks',         getPendingTasks);

module.exports = router;
