const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrder, updateOrderStatus } = require('../controllers/orders.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createOrderSchema, updateOrderStatusSchema } = require('../validators/orders.validators');

// All order routes require a logged-in account (customer or staff)
router.use(protect);

router.post('/', validate(createOrderSchema), createOrder);
router.get('/', getOrders);
router.get('/:id', getOrder);
router.patch('/:id/status', authorize('admin', 'manager'), validate(updateOrderStatusSchema), updateOrderStatus);

module.exports = router;
