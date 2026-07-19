const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'text/plain': '.txt',
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage(); // keep in memory — extract then discard

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOCX, DOC, TXT`), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// ── Finance uploads: invoices (PDF) + bulk expense sheets (CSV/XLS/XLSX) ──────
const FINANCE_TYPES = {
  'application/pdf': '.pdf',
  'text/csv': '.csv',
  'application/vnd.ms-excel': '.xls', // also sent for some .csv
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'application/octet-stream': '.bin', // some browsers send this for .csv/.xlsx
};

const financeFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExt = ['.pdf', '.csv', '.xls', '.xlsx', '.txt'];
  if (FINANCE_TYPES[file.mimetype] || allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, CSV, XLS, XLSX`), false);
  }
};

const uploadFinance = multer({ storage, fileFilter: financeFileFilter, limits: { fileSize: MAX_SIZE } });

module.exports = { upload, uploadFinance };
