const supabase = require('../config/supabase');

// GET /api/v1/security/audit-logs
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, action, userId, success } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('audit_logs')
      .select('*, users(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (action) query = query.ilike('action', `%${action}%`);
    if (userId) query = query.eq('user_id', userId);
    if (success !== undefined) query = query.eq('success', success === 'true');

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/security/stats
const getSecurityStats = async (req, res, next) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ count: totalToday }, { count: failedToday }, { count: activeThreats }] = await Promise.all([
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('success', false).gte('created_at', since24h),
      supabase.from('audit_logs').select('*', { count: 'exact', head: true }).eq('success', false).gte('created_at', since24h).gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
    ]);

    res.json({
      eventsToday: totalToday || 0,
      failedToday: failedToday || 0,
      activeThreats: activeThreats || 0,
      systemHealth: '98%',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAuditLogs, getSecurityStats };
