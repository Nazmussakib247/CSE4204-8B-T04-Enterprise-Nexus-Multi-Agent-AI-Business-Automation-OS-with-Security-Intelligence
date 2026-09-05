const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createReviewSchema } = require('../validators/reviews.validators');
const { getProductReviews, createReview, getFlaggedReviews } = require('../controllers/reviews.controller');

router.get('/products/:productId', getProductReviews);
router.get('/flagged', protect, authorize('admin', 'manager', 'employee'), getFlaggedReviews);
router.post('/', protect, validate(createReviewSchema), createReview);

module.exports = router;
