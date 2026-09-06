const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { OFFICE_ROLES } = require('../middleware/roles');
const validate = require('../middleware/validate.middleware');
const { createReportSchema, updateReportSchema } = require('../validators/hr.validators');
const { upload } = require('../middleware/upload.middleware');
const { getReports, getReport, createReport, updateReport, deleteReport, getStats, uploadCV } = require('../controllers/hr.controller');

router.use(protect);
router.use(authorize(...OFFICE_ROLES));

router.get('/stats', getStats);
router.get('/reports', getReports);
router.get('/reports/:id', getReport);
router.post('/reports', validate(createReportSchema), createReport);
router.patch('/reports/:id', validate(updateReportSchema), updateReport);
router.delete('/reports/:id', deleteReport);
router.post('/upload', upload.single('cv'), uploadCV);

module.exports = router;
