const Joi = require('joi');

const createTicketSchema = Joi.object({
  query: Joi.string().min(5).max(5000).required(),
  order_id: Joi.string().guid({ version: 'uuidv4' }).allow(null),
  product_id: Joi.string().guid({ version: 'uuidv4' }).allow(null),
});

const updateTicketSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'escalated'),
  query: Joi.string().min(5).max(5000),
}).min(1);

module.exports = { createTicketSchema, updateTicketSchema };
