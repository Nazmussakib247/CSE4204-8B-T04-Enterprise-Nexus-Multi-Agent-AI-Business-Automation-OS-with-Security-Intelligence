const Joi = require('joi');

const createOrderSchema = Joi.object({
  product_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  quantity: Joi.number().integer().min(1).max(20).default(1),
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'paid', 'shipped', 'delivered', 'cancelled').required(),
});

module.exports = { createOrderSchema, updateOrderStatusSchema };
