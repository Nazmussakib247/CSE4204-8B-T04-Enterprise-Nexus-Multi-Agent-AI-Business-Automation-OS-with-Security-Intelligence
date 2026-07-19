const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getAuditLogs, getSecurityStats } = require('../controllers/security.controller');

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/audit-logs', getAuditLogs);
router.get('/stats', getSecurityStats);

module.exports = router;
