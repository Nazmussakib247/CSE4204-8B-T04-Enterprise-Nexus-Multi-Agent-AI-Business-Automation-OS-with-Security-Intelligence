const supabase = require('../config/supabase');

// GET /api/search?q=term&limit=10
const globalSearch = async (req, res, next) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ results: [] });
    }

    const term = q.trim().toLowerCase();
    const n = Number(limit);
    const uid = req.user.id;

    const [hr, finance, support] = await Promise.all([
      supabase
        .from('hr_reports')
        .select('id, candidate_name, job_title, recommendation, ai_score, created_at')
        .eq('user_id', uid)
        .or(`candidate_name.ilike.%${term}%,job_title.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(n),

      supabase
        .from('finance_records')
        .select('id, category, amount, severity, expense_date, description')
        .eq('user_id', uid)
        .or(`category.ilike.%${term}%,description.ilike.%${term}%`)
        .order('expense_date', { ascending: false })
        .limit(n),

      supabase
        .from('support_tickets')
        .select('id, query, intent, urgency, sentiment, status, created_at')
        .eq('user_id', uid)
        .or(`query.ilike.%${term}%,intent.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(n),
    ]);

    const results = [
      ...(hr.data ?? []).map(r => ({
        type: 'hr',
        id: r.id,
        title: r.candidate_name,
        subtitle: r.job_title,
        meta: r.recommendation,
        link: `/hr/${r.id}`,
      })),
      ...(finance.data ?? []).map(r => ({
        type: 'finance',
        id: r.id,
        title: r.category,
        subtitle: r.description || `$${Number(r.amount).toLocaleString()}`,
        meta: r.severity,
        link: `/finance/${r.id}`,
      })),
      ...(support.data ?? []).map(r => ({
        type: 'support',
        id: r.id,
        title: r.query.slice(0, 80),
        subtitle: r.intent || r.sentiment,
        meta: r.status,
        link: `/support/${r.id}`,
      })),
    ];

    res.json({ results, query: q });
  } catch (err) {
    next(err);
  }
};

module.exports = { globalSearch };
