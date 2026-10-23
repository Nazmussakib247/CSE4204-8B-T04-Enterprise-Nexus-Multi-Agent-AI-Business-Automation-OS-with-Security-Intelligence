const supabase = require('../config/supabase');

// Career applications live in job_applications, while the HR dashboard reads
// hr_reports. This bridge keeps both views consistent and is safe to retry.
const syncApplicationToHrReport = async (application, ownerUserId = null) => {
  if (!application?.id || !application?.job_id) return null;

  // Public career applications intentionally have no candidate account
  // (candidate_id is nullable). Reports still belong to the staff member who
  // posted the job, so they remain visible in the HR dashboard.
  const [{ data: job }, { data: candidate }] = await Promise.all([
    supabase.from('job_postings').select('title, posted_by').eq('id', application.job_id).maybeSingle(),
    application.candidate_id
      ? supabase.from('users').select('name').eq('id', application.candidate_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const ownerId = ownerUserId || application.owner_user_id || job?.posted_by || application.candidate_id;
  if (!ownerId) return null;

  const marker = { source: 'job_application', application_id: application.id };
  const { data: existing, error: lookupError } = await supabase
    .from('hr_reports')
    .select('id')
    .eq('user_id', ownerId)
    .contains('extracted_profile', marker)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const report = {
    user_id: ownerId,
    candidate_name: String(application.applicant_name || candidate?.name || 'Applicant').trim().slice(0, 200),
    job_title: String(job?.title || 'Job application').trim().slice(0, 200),
    ai_score: Number.isInteger(application.ai_score) ? application.ai_score : null,
    recommendation: ['shortlist', 'review', 'reject'].includes(application.ai_recommendation) ? application.ai_recommendation : 'review',
    narrative_summary: application.narrative_summary || null,
    score_breakdown: Array.isArray(application.skill_scores) ? application.skill_scores : null,
    extracted_profile: marker,
  };

  const query = existing
    ? supabase.from('hr_reports').update(report).eq('id', existing.id)
    : supabase.from('hr_reports').insert(report);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
};

const syncAllJobApplicationsToHrReports = async (ownerUserId = null) => {
  const { data, error } = await supabase
    .from('job_applications')
    .select('id, candidate_id, job_id, applicant_name, ai_score, ai_recommendation, skill_scores, narrative_summary')
    .not('status', 'eq', 'pending');
  if (error) throw error;
  return Promise.all((data || []).map((application) => syncApplicationToHrReport(application, ownerUserId)));
};

module.exports = { syncApplicationToHrReport, syncAllJobApplicationsToHrReports };
