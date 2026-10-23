const express = require('express');
const router = express.Router();
const {
  getProducts, getProductBySlug, getAllProductsForStaff, createProduct, updateProduct, deleteProduct,
} = require('../controllers/products.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { createProductSchema, updateProductSchema } = require('../validators/products.validators');

// Public — no auth (careers-style open storefront)
router.get('/', getProducts);

// Staff-only routes (must be registered before the public /:slug catch-all)
router.get('/admin/all', protect, authorize('admin', 'manager'), getAllProductsForStaff);
router.post('/', protect, authorize('admin', 'manager'), validate(createProductSchema), createProduct);
router.patch('/:id', protect, authorize('admin', 'manager'), validate(updateProductSchema), updateProduct);
router.delete('/:id', protect, authorize('admin', 'manager'), deleteProduct);

// Public — product detail by slug
router.get('/:slug', getProductBySlug);

module.exports = router;
