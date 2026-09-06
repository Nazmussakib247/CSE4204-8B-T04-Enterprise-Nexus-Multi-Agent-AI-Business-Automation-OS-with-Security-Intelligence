const Joi = require('joi');

const createReviewSchema = Joi.object({
  product_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().min(1).max(2000).required(),
});

const replyReviewSchema = Joi.object({
  response: Joi.string().trim().min(3).max(2000).required(),
});

module.exports = { createReviewSchema, replyReviewSchema };
