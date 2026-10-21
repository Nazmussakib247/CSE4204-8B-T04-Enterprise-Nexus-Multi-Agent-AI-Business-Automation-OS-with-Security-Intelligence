const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { getProviders, updateProviders } = require('../controllers/aiProviders.controller');
router.use(protect, authorize('admin'));
router.get('/', getProviders);
router.put('/', updateProviders);
module.exports = router;
