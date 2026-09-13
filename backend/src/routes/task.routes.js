const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { OFFICE_ROLES } = require('../middleware/roles');
const { getTasks, getTask, createTask, updateTaskStatus } = require('../controllers/task.controller');

router.use(protect);
router.use(authorize(...OFFICE_ROLES));

router.get('/', getTasks);
router.get('/:id', getTask);
router.post('/', createTask);
router.patch('/:id/status', updateTaskStatus);

module.exports = router;
