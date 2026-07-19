const Joi = require('joi');

const createTicketSchema = Joi.object({
  query: Joi.string().min(5).max(5000).required(),
});

const updateTicketSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'escalated'),
  query: Joi.string().min(5).max(5000),
}).min(1);

module.exports = { createTicketSchema, updateTicketSchema };
