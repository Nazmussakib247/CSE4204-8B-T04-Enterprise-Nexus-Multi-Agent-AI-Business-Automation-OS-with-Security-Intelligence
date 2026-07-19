const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { getTasks, getTask, createTask, updateTaskStatus } = require('../controllers/task.controller');

router.use(protect);

router.get('/', getTasks);
router.get('/:id', getTask);
router.post('/', createTask);
router.patch('/:id/status', updateTaskStatus);

module.exports = router;
