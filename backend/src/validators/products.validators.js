const Joi = require('joi');

const skillLike = Joi.object({ label: Joi.string().required(), value: Joi.string().required() });

const createProductSchema = Joi.object({
  slug: Joi.string().min(2).max(100).pattern(/^[a-z0-9-]+$/).required()
    .messages({ 'string.pattern.base': 'slug may only contain lowercase letters, numbers and hyphens' }),
  name: Joi.string().min(2).max(200).required(),
  tagline: Joi.string().max(200).allow('', null),
  description: Joi.string().allow('', null),
  price: Joi.number().positive().required(),
  icon: Joi.string().max(60).default('inventory_2'),
  highlights: Joi.array().items(Joi.string()).default([]),
  specs: Joi.array().items(skillLike).default([]),
  status: Joi.string().valid('active', 'draft', 'discontinued').default('active'),
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  tagline: Joi.string().max(200).allow('', null),
  description: Joi.string().allow('', null),
  price: Joi.number().positive(),
  icon: Joi.string().max(60),
  highlights: Joi.array().items(Joi.string()),
  specs: Joi.array().items(skillLike),
  status: Joi.string().valid('active', 'draft', 'discontinued'),
}).min(1);

module.exports = { createProductSchema, updateProductSchema };
