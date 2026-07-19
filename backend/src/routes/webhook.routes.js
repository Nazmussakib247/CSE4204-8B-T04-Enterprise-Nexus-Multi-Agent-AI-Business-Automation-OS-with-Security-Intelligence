const express = require('express');
const router = express.Router();
const {
  verifySecret,
  taskUpdate,
  saveExecutiveBriefing,
  saveAnalyticsKPI,
  escalateTicket,
  getPendingTasks,
} = require('../controllers/webhook.controller');

// All webhook routes are protected by shared secret, NOT JWT
router.use(verifySecret);

router.post('/task-update',          taskUpdate);
router.post('/executive-briefing',   saveExecutiveBriefing);
router.post('/analytics-kpi',        saveAnalyticsKPI);
router.post('/support-escalate',     escalateTicket);
router.get('/pending-tasks',         getPendingTasks);

module.exports = router;
