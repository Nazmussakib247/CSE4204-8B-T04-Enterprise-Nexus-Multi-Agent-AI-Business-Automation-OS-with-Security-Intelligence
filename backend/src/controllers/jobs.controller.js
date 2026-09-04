const crypto = require('crypto');
const supabase = require('../config/supabase');
const { screenCV } = require('../utils/gemini');
const { extractText } = require('../utils/fileExtract');
const { notifyN8n } = require('../utils/webhook');
const { sendApplicationNotificationEmail } = require('../utils/email');
const { writeAuditLog } = require('../utils/audit');

const STAFF_ROLES = ['admin', 'manager', 'employee'];
const isStaff = (user) => STAFF_ROLES.includes(user.role);
const confidenceBand = (value) => value >= 0.8 ? 'high' : value >= 0.5 ? 'medium' : 'low';

const withSignedCvUrl = async (application) => {
  if (!application?.cv_url?.startsWith('storage://job-cvs/')) return application;
  const path = application.cv_url.replace('storage://job-cvs/', '');
  const { data } = await supabase.storage.from('job-cvs').createSignedUrl(path, 60 * 10);
  return { ...application, cv_url: data?.signedUrl || null };
};

const getOpenJobs = async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('job_postings').select('*').eq('status', 'open').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

const getJob = async (req, res, next) => {
  try {
    let query = supabase.from('job_postings').select('*').eq('id', req.params.id);
    if (!req.user || !isStaff(req.user)) query = query.eq('status', 'open');
    const { data, error } = await query.single();
    if (error || !data) return res.status(404).json({ error: 'Job not found' });
    res.json({ data });
  } catch (err) { next(err); }
};

const getJobsForStaff = async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from('job_postings').select('*, job_applications(count)').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

const createJob = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('job_postings').insert({ ...req.body, posted_by: req.user.id }).select().single();
    if (error) throw error;
    writeAuditLog({ userId: req.user.id, action: 'job.create', resourceType: 'job_posting', resourceId: data.id, req });
    res.status(201).json({ message: 'Job created', data });
  } catch (err) { next(err); }
};

const updateJob = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('job_postings').update({ ...req.body, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Job not found' });
    writeAuditLog({ userId: req.user.id, action: 'job.update', resourceType: 'job_posting', resourceId: data.id, req });
    res.json({ message: 'Job updated', data });
  } catch (err) { next(err); }
};

const deleteJob = async (req, res, next) => {
  try {
    const { error } = await supabase.from('job_postings').delete().eq('id', req.params.id);
    if (error) throw error;
    writeAuditLog({ userId: req.user.id, action: 'job.delete', resourceType: 'job_posting', resourceId: req.params.id, req });
    res.json({ message: 'Job deleted' });
  } catch (err) { next(err); }
};

const createApplication = async (req, res, next) => {
  try {
    if (req.user.role !== 'candidate') return res.status(403).json({ error: 'A candidate account is required to apply' });
    if (!req.file) return res.status(400).json({ error: 'A CV file is required (field name: cv)' });
    const { data: job, error: jobError } = await supabase.from('job_postings').select('*').eq('id', req.params.id).eq('status', 'open').single();
    if (jobError || !job) return res.status(404).json({ error: 'Job not found or no longer open' });

    const { data: existing } = await supabase.from('job_applications').select('id').eq('job_id', job.id).eq('candidate_id', req.user.id).maybeSingle();
    if (existing) return res.status(409).json({ error: 'You have already applied for this job' });

    let cvText;
    try { cvText = await extractText(req.file.buffer, req.file.mimetype); }
    catch (err) { return res.status(422).json({ error: `CV text extraction failed: ${err.message}` }); }
    if (cvText.length < 20) return res.status(422).json({ error: 'Could not extract meaningful text from this CV' });

    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${job.id}/${req.user.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from('job-cvs').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw uploadError;

    const ai = await screenCV({ candidate_name: req.user.name, job_title: job.title, cv_text: cvText, required_skills: job.required_skills, screening_criteria: job.screening_criteria });
    const skillScores = (job.required_skills || []).map(({ skill, weight }) => ({ skill, weight, score: Math.max(0, Math.min(100, Number(ai.skill_scores.find((entry) => entry.skill.toLowerCase() === skill.toLowerCase())?.score) || 0)) }));
    const weightedScore = Math.round(skillScores.reduce((sum, item) => sum + (item.weight * item.score), 0) / 100);
    const { data, error } = await supabase.from('job_applications').insert({
      job_id: job.id, candidate_id: req.user.id, cv_url: `storage://job-cvs/${storagePath}`,
      ai_score: weightedScore, ai_confidence: confidenceBand(Number(ai.confidence)), ai_recommendation: ai.recommendation,
      skill_scores: skillScores, narrative_summary: ai.narrative_summary, status: 'ai_screened',
    }).select('*, users!job_applications_candidate_id_fkey(name, email)').single();
    if (error) throw error;
    writeAuditLog({ userId: req.user.id, action: 'job.application.create', resourceType: 'job_application', resourceId: data.id, metadata: { job_id: job.id, ai_score: weightedScore }, req });
    notifyN8n('job-application', { application_id: data.id, job_id: job.id, candidate_id: req.user.id, ai_score: weightedScore, recommendation: ai.recommendation });
    res.status(201).json({ message: 'Application submitted and screened', data: await withSignedCvUrl(data) });
  } catch (err) { next(err); }
};

const getApplications = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('job_applications').select('*, users!job_applications_candidate_id_fkey(name, email)').eq('job_id', req.params.id).order('ai_score', { ascending: false });
    if (error) throw error;
    res.json({ data: await Promise.all(data.map(withSignedCvUrl)), total: data.length });
  } catch (err) { next(err); }
};

const updateApplication = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('job_applications')
      .update({ status: req.body.status, updated_at: new Date().toISOString() })
      .eq('id', req.params.applicationId).eq('job_id', req.params.id)
      .select('*, users!job_applications_candidate_id_fkey(name, email)').single();
    if (error || !data) return res.status(404).json({ error: 'Application not found' });
    writeAuditLog({ userId: req.user.id, action: 'job.application.update', resourceType: 'job_application', resourceId: data.id, metadata: { status: data.status }, req });
    res.json({ message: 'Application updated', data: await withSignedCvUrl(data) });
  } catch (err) { next(err); }
};

const deleteApplication = async (req, res, next) => {
  try {
    let query = supabase.from('job_applications').delete().eq('id', req.params.applicationId).eq('job_id', req.params.id);
    if (!isStaff(req.user)) query = query.eq('candidate_id', req.user.id);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Application not found' });
    writeAuditLog({ userId: req.user.id, action: 'job.application.delete', resourceType: 'job_application', resourceId: data.id, req });
    res.json({ message: 'Application deleted' });
  } catch (err) { next(err); }
};

const confirmAndNotify = async (req, res, next) => {
  try {
    const { application_ids, message } = req.body;
    const { data: job, error: jobError } = await supabase.from('job_postings').select('id, title').eq('id', req.params.id).single();
    if (jobError || !job) return res.status(404).json({ error: 'Job not found' });
    const { data: applications, error } = await supabase.from('job_applications').select('id, candidate_id, users!job_applications_candidate_id_fkey(name, email)').eq('job_id', job.id).in('id', application_ids);
    if (error) throw error;
    if (applications.length !== application_ids.length) return res.status(400).json({ error: 'One or more applications do not belong to this job' });
    await supabase.from('job_applications').update({ status: 'hr_confirmed', updated_at: new Date().toISOString() }).in('id', application_ids);
    const results = await Promise.allSettled(applications.map((application) => sendApplicationNotificationEmail({ to: application.users.email, candidateName: application.users.name, jobTitle: job.title, message })));
    const notifiedIds = applications.filter((_, index) => results[index].status === 'fulfilled').map((application) => application.id);
    if (notifiedIds.length) await supabase.from('job_applications').update({ status: 'notified', notified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', notifiedIds);
    writeAuditLog({ userId: req.user.id, action: 'job.application.confirm_notify', resourceType: 'job_posting', resourceId: job.id, metadata: { requested: application_ids.length, notified: notifiedIds.length }, req });
    res.json({ message: `${notifiedIds.length} applicant(s) notified`, notified: notifiedIds.length, failed: application_ids.length - notifiedIds.length });
  } catch (err) { next(err); }
};

module.exports = { getOpenJobs, getJob, getJobsForStaff, createJob, updateJob, deleteJob, createApplication, getApplications, updateApplication, deleteApplication, confirmAndNotify };
