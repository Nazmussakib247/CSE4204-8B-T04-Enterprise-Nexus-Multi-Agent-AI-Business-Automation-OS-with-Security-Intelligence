const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { uploadFinance } = require('../middleware/upload.middleware');
const { createRecordSchema, updateRecordSchema } = require('../validators/finance.validators');
const {
  getRecords, getRecord, createRecord, updateRecord, deleteRecord, getAnomalies, getSummary,
  uploadInvoice, bulkUploadExpenses,
} = require('../controllers/finance.controller');

router.use(protect);

router.get('/summary', getSummary);
router.get('/anomalies', getAnomalies);
router.get('/records', getRecords);
router.get('/records/:id', getRecord);
router.post('/records', validate(createRecordSchema), createRecord);
router.post('/upload/invoice', uploadFinance.single('invoice'), uploadInvoice);
router.post('/upload/bulk', uploadFinance.single('file'), bulkUploadExpenses);
router.patch('/records/:id', authorize('admin', 'manager'), validate(updateRecordSchema), updateRecord);
router.delete('/records/:id', authorize('admin'), deleteRecord);

module.exports = router;
