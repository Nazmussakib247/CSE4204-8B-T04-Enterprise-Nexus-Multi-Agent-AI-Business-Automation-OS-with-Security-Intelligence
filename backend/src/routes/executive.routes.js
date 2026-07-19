const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getReports, getLatestReport, getReport, createReport, getDailyBriefing, exportBriefingPdf, askAI } = require('../controllers/executive.controller');

router.use(protect);

router.get('/briefing/pdf', exportBriefingPdf);
router.get('/briefing', getDailyBriefing);
router.get('/reports/latest', getLatestReport);
router.get('/reports', getReports);
router.get('/reports/:id', getReport);
router.post('/reports', authorize('admin', 'manager'), createReport);
router.post('/ask', askAI);

module.exports = router;
