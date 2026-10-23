const Joi = require('joi');

const createReportSchema = Joi.object({
  candidate_name: Joi.string().min(2).max(200).required(),
  job_title: Joi.string().min(2).max(200).required(),
  cv_text: Joi.string().max(50000).allow('', null),
  extracted_profile: Joi.object().allow(null),
});

const updateReportSchema = Joi.object({
  candidate_name: Joi.string().min(2).max(200),
  job_title: Joi.string().min(2).max(200),
  recommendation: Joi.string().valid('shortlist', 'reject', 'review'),
  narrative_summary: Joi.string().max(5000).allow('', null),
  extracted_profile: Joi.object().allow(null),
}).min(1);

module.exports = { createReportSchema, updateReportSchema };
