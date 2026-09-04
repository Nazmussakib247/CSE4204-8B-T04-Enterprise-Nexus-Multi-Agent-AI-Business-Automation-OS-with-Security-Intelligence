const Joi = require('joi');

const skillSchema = Joi.object({
  skill: Joi.string().trim().min(1).max(100).required(),
  weight: Joi.number().integer().min(1).max(100).required(),
});

const jobFields = {
  title: Joi.string().trim().min(2).max(200),
  department: Joi.string().trim().max(100).allow('', null),
  description: Joi.string().trim().min(10).max(20000),
  screening_criteria: Joi.string().trim().min(10).max(10000),
  required_skills: Joi.array().items(skillSchema).min(1).max(30),
  status: Joi.string().valid('draft', 'open', 'closed'),
};

const weightsMustTotal100 = (value, helpers) => {
  if (value.required_skills && value.required_skills.reduce((total, skill) => total + skill.weight, 0) !== 100) {
    return helpers.error('any.invalid');
  }
  return value;
};

const createJobSchema = Joi.object(jobFields).fork(['title', 'description', 'screening_criteria', 'required_skills'], (schema) => schema.required())
  .custom(weightsMustTotal100)
  .messages({ 'any.invalid': 'required skill weights must total 100' });

const updateJobSchema = Joi.object(jobFields).min(1)
  .custom(weightsMustTotal100)
  .messages({ 'any.invalid': 'required skill weights must total 100' });

const bulkNotifySchema = Joi.object({
  application_ids: Joi.array().items(Joi.string().guid({ version: 'uuidv4' })).min(1).max(100).unique().required(),
  message: Joi.string().trim().max(3000).allow('', null),
});

const updateApplicationSchema = Joi.object({
  status: Joi.string().valid('applied', 'ai_screened', 'hr_confirmed', 'notified').required(),
});

module.exports = { createJobSchema, updateJobSchema, bulkNotifySchema, updateApplicationSchema };
