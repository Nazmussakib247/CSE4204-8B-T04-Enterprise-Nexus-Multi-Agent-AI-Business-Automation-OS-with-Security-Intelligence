const Joi = require('joi');

const createRecordSchema = Joi.object({
  category: Joi.string().max(100).required(),
  amount: Joi.number().positive().required(),
  expense_date: Joi.string().isoDate().required(),
  description: Joi.string().max(1000).allow('', null),
});

const updateRecordSchema = Joi.object({
  category: Joi.string().max(100),
  amount: Joi.number().positive(),
  expense_date: Joi.string().isoDate(),
  description: Joi.string().max(1000).allow('', null),
}).min(1);

module.exports = { createRecordSchema, updateRecordSchema };
