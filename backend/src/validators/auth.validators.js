const Joi = require('joi');

const passwordRules = Joi.string()
  .min(8)
  .max(128)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[0-9]/, 'number')
  .pattern(/[^A-Za-z0-9]/, 'special character')
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.name': 'Password must contain at least one {#name}',
  });

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().max(255).lowercase().required(),
  password: passwordRules,
});

// Public signup used by /store/register and /careers apply flow.
// role is restricted to external classes only — never admin/manager/employee.
const registerExternalSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().max(255).lowercase().required(),
  password: passwordRules,
  role: Joi.string().valid('customer', 'candidate').required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().max(255).lowercase().required(),
  password: Joi.string().max(128).required(),
});

const updateMeSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  password: passwordRules.optional(),
}).min(1);

module.exports = { registerSchema, registerExternalSchema, loginSchema, updateMeSchema };
