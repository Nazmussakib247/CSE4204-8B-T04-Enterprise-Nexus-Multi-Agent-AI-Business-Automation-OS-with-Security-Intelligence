const router   = require('express').Router();
const { authenticate } = require('../middleware/auth');
const multer   = require('multer');
const { screenCV, listReports, getReport, getBatchRankings } = require('../controllers/hrController');

// multer — memory storage (parse CV text from uploaded .txt/.pdf in future)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10')) * 1024 * 1024 },
});

router.post('/screen',          authenticate, screenCV);      // body: cv_text, job_title, job_description
router.get ('/reports',         authenticate, listReports);
router.get ('/reports/:id',     authenticate, getReport);
router.get ('/rankings',        authenticate, getBatchRankings);

module.exports = router;
