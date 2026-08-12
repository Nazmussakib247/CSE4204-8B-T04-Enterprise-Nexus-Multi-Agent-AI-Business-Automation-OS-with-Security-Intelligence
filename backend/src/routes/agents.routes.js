const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { chat, activity } = require('../controllers/agents.controller');

router.use(protect);

router.get('/activity', activity);
router.post('/:agent/chat', chat);

module.exports = router;
