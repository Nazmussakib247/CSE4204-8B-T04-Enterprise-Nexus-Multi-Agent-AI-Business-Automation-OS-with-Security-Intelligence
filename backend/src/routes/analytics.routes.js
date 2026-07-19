const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getReports, getReport, createReport, generateReport, getLatestKPI, deleteReport } = require('../controllers/analytics.controller');

router.use(protect);

router.get('/kpi', getLatestKPI);
router.get('/reports', getReports);
router.get('/reports/:id', getReport);
router.post('/reports', createReport);
router.post('/generate', generateReport);
router.delete('/reports/:id', deleteReport);

module.exports = router;
