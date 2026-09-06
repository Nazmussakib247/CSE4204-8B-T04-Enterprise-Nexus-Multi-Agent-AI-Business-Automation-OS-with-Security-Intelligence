const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { OFFICE_ROLES } = require('../middleware/roles');
const validate = require('../middleware/validate.middleware');
const { upload } = require('../middleware/upload.middleware');
const { createJobSchema, updateJobSchema, bulkNotifySchema, updateApplicationSchema } = require('../validators/jobs.validators');
const jobs = require('../controllers/jobs.controller');

router.get('/', jobs.getOpenJobs);
router.get('/admin/all', protect, authorize(...OFFICE_ROLES), jobs.getJobsForStaff);
router.post('/', protect, authorize(...OFFICE_ROLES), validate(createJobSchema), jobs.createJob);
router.patch('/:id', protect, authorize(...OFFICE_ROLES), validate(updateJobSchema), jobs.updateJob);
router.delete('/:id', protect, authorize(...OFFICE_ROLES), jobs.deleteJob);
router.get('/:id/applications', protect, authorize(...OFFICE_ROLES), jobs.getApplications);
router.post('/:id/applications/confirm-notify', protect, authorize(...OFFICE_ROLES), validate(bulkNotifySchema), jobs.confirmAndNotify);
router.patch('/:id/applications/:applicationId', protect, authorize(...OFFICE_ROLES), validate(updateApplicationSchema), jobs.updateApplication);
router.delete('/:id/applications/:applicationId', protect, authorize(...OFFICE_ROLES), jobs.deleteApplication);
router.post('/:id/applications', protect, upload.single('cv'), jobs.createApplication);
router.get('/:id', jobs.getJob);

module.exports = router;
