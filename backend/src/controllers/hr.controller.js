const supabase = require('../config/supabase');
const { screenCV } = require('../utils/gemini');
const { notifyN8n } = require('../utils/webhook');
const { extractText } = require('../utils/fileExtract');
const { writeAuditLog } = require('../utils/audit');

// GET /api/hr/reports
const getReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, recommendation } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('hr_reports')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (recommendation) query = query.eq('recommendation', recommendation);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/hr/reports/:id
const getReport = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('hr_reports')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Report not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /api/hr/reports — text-based CV screening
const createReport = async (req, res, next) => {
  try {
    const { candidate_name, job_title, cv_text, extracted_profile } = req.body;

    if (!candidate_name || !job_title) {
      return res.status(400).json({ error: 'candidate_name and job_title are required' });
    }

    const aiResult = await screenCV({ candidate_name, job_title, cv_text: cv_text || '' });

    const { data, error } = await supabase
      .from('hr_reports')
      .insert({
        user_id: req.user.id,
        candidate_name,
        job_title,
        ai_score: aiResult.ai_score,
        confidence: aiResult.confidence,
        recommendation: aiResult.recommendation,
        narrative_summary: aiResult.narrative_summary,
        score_breakdown: aiResult.score_breakdown,
        extracted_profile: extracted_profile || null,
      })
      .select()
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'hr.report.create',
      resourceType: 'hr_report',
      resourceId: data.id,
      req,
    });

    notifyN8n('hr-report', {
      report_id: data.id,
      user_id: req.user.id,
      candidate_name: data.candidate_name,
      job_title: data.job_title,
      ai_score: data.ai_score,
      recommendation: data.recommendation,
    });

    res.status(201).json({ message: 'HR report created with AI screening', data, ai_analysis: aiResult });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/hr/reports/:id
const updateReport = async (req, res, next) => {
  try {
    const { candidate_name, job_title, recommendation, narrative_summary, extracted_profile } = req.body;
    const updates = {};
    if (candidate_name !== undefined) updates.candidate_name = candidate_name;
    if (job_title !== undefined) updates.job_title = job_title;
    if (recommendation !== undefined) updates.recommendation = recommendation;
    if (narrative_summary !== undefined) updates.narrative_summary = narrative_summary;
    if (extracted_profile !== undefined) updates.extracted_profile = extracted_profile;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('hr_reports')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Report not found' });

    writeAuditLog({
      userId: req.user.id,
      action: 'hr.report.update',
      resourceType: 'hr_report',
      resourceId: data.id,
      req,
    });

    res.json({ message: 'Report updated', data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/hr/reports/:id
const deleteReport = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('hr_reports')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'hr.report.delete',
      resourceType: 'hr_report',
      resourceId: req.params.id,
      req,
    });

    res.json({ message: 'Report deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /api/hr/stats
const getStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const [allRes, thisMonthRes, lastMonthRes] = await Promise.all([
      supabase.from('hr_reports').select('recommendation, ai_score').eq('user_id', req.user.id),
      supabase.from('hr_reports').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).gte('created_at', startOfThisMonth),
      supabase.from('hr_reports').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id).gte('created_at', startOfLastMonth).lt('created_at', startOfThisMonth),
    ]);

    if (allRes.error) throw allRes.error;
    const data = allRes.data;

    const thisMonth = thisMonthRes.count ?? 0;
    const lastMonth = lastMonthRes.count ?? 0;
    const trend = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : (thisMonth > 0 ? 100 : 0);

    const stats = {
      total: data.length,
      shortlisted: data.filter(r => r.recommendation === 'shortlist').length,
      rejected:    data.filter(r => r.recommendation === 'reject').length,
      review:      data.filter(r => r.recommendation === 'review').length,
      avg_score: data.length
        ? Math.round(data.reduce((s, r) => s + (r.ai_score || 0), 0) / data.length)
        : 0,
      this_month: thisMonth,
      last_month: lastMonth,
      trend_pct: trend,
    };

    res.json({ stats });
  } catch (err) {
    next(err);
  }
};

// POST /api/hr/upload — PDF/DOCX upload → extract text → AI screening
const uploadCV = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "cv".' });
    }

    const { candidate_name, job_title } = req.body;
    if (!candidate_name || !job_title) {
      return res.status(400).json({ error: 'candidate_name and job_title are required' });
    }

    let cvText = '';
    try {
      cvText = await extractText(req.file.buffer, req.file.mimetype);
    } catch (extractErr) {
      return res.status(422).json({ error: `Text extraction failed: ${extractErr.message}` });
    }

    if (!cvText || cvText.length < 20) {
      return res.status(422).json({
        error: 'Could not extract meaningful text from the file. Try pasting CV text manually.',
      });
    }

    const aiResult = await screenCV({ candidate_name, job_title, cv_text: cvText });

    const { data, error } = await supabase
      .from('hr_reports')
      .insert({
        user_id: req.user.id,
        candidate_name,
        job_title,
        ai_score: aiResult.ai_score,
        confidence: aiResult.confidence,
        recommendation: aiResult.recommendation,
        narrative_summary: aiResult.narrative_summary,
        score_breakdown: aiResult.score_breakdown,
        extracted_profile: {
          source: 'file_upload',
          filename: req.file.originalname,
          size_bytes: req.file.size,
          text_length: cvText.length,
        },
      })
      .select()
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'hr.cv.upload',
      resourceType: 'hr_report',
      resourceId: data.id,
      metadata: { filename: req.file.originalname, candidate_name, job_title },
      req,
    });

    notifyN8n('hr-report', {
      report_id: data.id,
      user_id: req.user.id,
      candidate_name,
      job_title,
      ai_score: data.ai_score,
      recommendation: data.recommendation,
      source: 'file_upload',
    });

    res.status(201).json({
      message: 'CV uploaded, extracted, and screened by AI',
      data,
      ai_analysis: aiResult,
      extracted_chars: cvText.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getReports, getReport, createReport, updateReport, deleteReport, getStats, uploadCV };
