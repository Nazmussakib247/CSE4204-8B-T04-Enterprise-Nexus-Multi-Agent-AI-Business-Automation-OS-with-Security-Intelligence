const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { upload } = require('../middleware/upload.middleware');
const { createJobSchema, updateJobSchema, bulkNotifySchema, updateApplicationSchema } = require('../validators/jobs.validators');
const jobs = require('../controllers/jobs.controller');

router.get('/', jobs.getOpenJobs);
router.get('/admin/all', protect, authorize('admin', 'manager', 'employee'), jobs.getJobsForStaff);
router.post('/', protect, authorize('admin', 'manager', 'employee'), validate(createJobSchema), jobs.createJob);
router.patch('/:id', protect, authorize('admin', 'manager', 'employee'), validate(updateJobSchema), jobs.updateJob);
router.delete('/:id', protect, authorize('admin', 'manager'), jobs.deleteJob);
router.get('/:id/applications', protect, authorize('admin', 'manager', 'employee'), jobs.getApplications);
router.post('/:id/applications/confirm-notify', protect, authorize('admin', 'manager', 'employee'), validate(bulkNotifySchema), jobs.confirmAndNotify);
router.patch('/:id/applications/:applicationId', protect, authorize('admin', 'manager', 'employee'), validate(updateApplicationSchema), jobs.updateApplication);
router.delete('/:id/applications/:applicationId', protect, jobs.deleteApplication);
router.post('/:id/applications', protect, upload.single('cv'), jobs.createApplication);
router.get('/:id', jobs.getJob);

module.exports = router;
