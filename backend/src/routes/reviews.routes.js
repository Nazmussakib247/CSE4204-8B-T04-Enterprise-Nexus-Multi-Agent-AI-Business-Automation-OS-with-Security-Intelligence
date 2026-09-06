const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { OFFICE_ROLES } = require('../middleware/roles');
const validate = require('../middleware/validate.middleware');
const { createReviewSchema, replyReviewSchema } = require('../validators/reviews.validators');
const { getProductReviews, createReview, getFlaggedReviews, replyToReview } = require('../controllers/reviews.controller');

router.get('/products/:productId', getProductReviews);
router.get('/flagged', protect, authorize(...OFFICE_ROLES), getFlaggedReviews);
router.post('/', protect, validate(createReviewSchema), createReview);
router.patch('/:id/reply', protect, authorize(...OFFICE_ROLES), validate(replyReviewSchema), replyToReview);

module.exports = router;
