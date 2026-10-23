const supabase = require('../config/supabase');

// Career applications live in job_applications, while the HR dashboard reads
// hr_reports. This bridge keeps both views consistent and is safe to retry.
const syncApplicationToHrReport = async (application) => {
  if (!application?.candidate_id || !application?.job_id) return null;

  const confidenceValue = typeof application.ai_confidence === 'number'
    ? Math.max(0, Math.min(1, application.ai_confidence))
    : ({ high: 0.9, medium: 0.7, low: 0.4 }[application.ai_confidence] ?? null);

  const [{ data: job }, { data: candidate }] = await Promise.all([
    supabase.from('job_postings').select('title').eq('id', application.job_id).maybeSingle(),
    supabase.from('users').select('name').eq('id', application.candidate_id).maybeSingle(),
  ]);

  const marker = { source: 'job_application', application_id: application.id };
  const { data: existing, error: lookupError } = await supabase
    .from('hr_reports')
    .select('id')
    .eq('user_id', application.candidate_id)
    .contains('extracted_profile', marker)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const report = {
    user_id: application.candidate_id,
    candidate_name: String(candidate?.name || 'Applicant').trim().slice(0, 200),
    job_title: String(job?.title || 'Job application').trim().slice(0, 200),
    ai_score: Number.isInteger(application.ai_score) ? application.ai_score : null,
    confidence: confidenceValue,
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

const syncAllJobApplicationsToHrReports = async () => {
  const { data, error } = await supabase
    .from('job_applications')
    .select('id, candidate_id, job_id, ai_score, ai_confidence, ai_recommendation, skill_scores, narrative_summary')
    .not('status', 'eq', 'pending');
  if (error) throw error;
  return Promise.all((data || []).map(syncApplicationToHrReport));
};

module.exports = { syncApplicationToHrReport, syncAllJobApplicationsToHrReports };
