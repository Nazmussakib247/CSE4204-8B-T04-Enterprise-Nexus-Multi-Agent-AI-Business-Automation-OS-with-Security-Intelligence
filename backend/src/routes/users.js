const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getProfile, updateProfile, changePassword,
  listUsers, getUserById, updateUser, deleteUser,
} = require('../controllers/userController');

// ── Authenticated User ──────────────────────────────────
router.get ('/me',          authenticate, getProfile);
router.put ('/me',          authenticate, updateProfile);
router.put ('/me/password', authenticate, changePassword);

// ── Admin Only ──────────────────────────────────────────
router.get ('/',     authenticate, authorize('admin'), listUsers);
router.get ('/:id',  authenticate, authorize('admin'), getUserById);
router.put ('/:id',  authenticate, authorize('admin'), updateUser);
router.delete('/:id',authenticate, authorize('admin'), deleteUser);

module.exports = router;
