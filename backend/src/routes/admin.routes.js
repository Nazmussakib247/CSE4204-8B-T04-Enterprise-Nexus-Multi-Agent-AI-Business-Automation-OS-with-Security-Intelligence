const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { listUsers, updateUserRole, toggleUserStatus, listRoles } = require('../controllers/admin.controller');

router.use(protect);
router.use(authorize('admin'));

router.get('/users', listUsers);
router.get('/roles', listRoles);
router.patch('/users/:id/role', updateUserRole);
router.patch('/users/:id/status', toggleUserStatus);

module.exports = router;
