const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { OFFICE_ROLES } = require('../middleware/roles');
const { chat, activity } = require('../controllers/agents.controller');

router.use(protect);
router.use(authorize(...OFFICE_ROLES));

router.get('/activity', activity);
router.post('/:agent/chat', chat);

module.exports = router;
