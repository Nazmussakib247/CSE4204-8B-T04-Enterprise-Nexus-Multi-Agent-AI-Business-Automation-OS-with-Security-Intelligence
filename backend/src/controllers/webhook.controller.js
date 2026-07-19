/**
 * Webhook Controller — receives callbacks FROM n8n
 * Routes: /api/webhook/*
 * Auth: x-nexus-secret header (not JWT)
 */
const supabase = require('../config/supabase');

const N8N_SECRET = process.env.N8N_SECRET || 'nexus-n8n-secret';

// Middleware: verify shared secret
const verifySecret = (req, res, next) => {
  const secret = req.headers['x-nexus-secret'];
  if (secret !== N8N_SECRET) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }
  next();
};

// POST /api/webhook/task-update
// n8n calls this to update a task's status + result
const taskUpdate = async (req, res, next) => {
  try {
    const { task_id, status, result } = req.body;

    if (!task_id || !status) {
      return res.status(400).json({ error: 'task_id and status are required' });
    }

    const validStatuses = ['pending', 'running', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const updates = { status };
    if (result) updates.result = result;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', task_id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Task not found' });

    res.json({ message: 'Task updated by n8n', data });
  } catch (err) {
    next(err);
  }
};

// POST /api/webhook/executive-briefing
// n8n calls this to save a generated executive briefing
const saveExecutiveBriefing = async (req, res, next) => {
  try {
    const { user_id, performance_summary, task_id } = req.body;

    if (!user_id || !performance_summary) {
      return res.status(400).json({ error: 'user_id and performance_summary are required' });
    }

    const { data, error } = await supabase
      .from('executive_reports')
      .insert({ user_id, performance_summary })
      .select()
      .single();

    if (error) throw error;

    // Update the triggering task if provided
    if (task_id) {
      await supabase.from('tasks').update({
        status: 'completed',
        result: JSON.stringify({ report_id: data.id }),
        completed_at: new Date().toISOString(),
      }).eq('id', task_id);
    }

    res.status(201).json({ message: 'Executive briefing saved', data });
  } catch (err) {
    next(err);
  }
};

// POST /api/webhook/analytics-kpi
// n8n calls this to save a generated analytics/KPI report
const saveAnalyticsKPI = async (req, res, next) => {
  try {
    const { user_id, performance_rating, overall_score, ai_insights, action_items, kpi_snapshot, task_id } = req.body;

    if (!user_id || overall_score === undefined) {
      return res.status(400).json({ error: 'user_id and overall_score are required' });
    }

    const { data, error } = await supabase
      .from('analytics_reports')
      .insert({
        user_id,
        performance_rating: performance_rating || 'good',
        overall_score,
        ai_insights: ai_insights || '',
        action_items: action_items || [],
        kpi_snapshot: kpi_snapshot || {},
      })
      .select()
      .single();

    if (error) throw error;

    if (task_id) {
      await supabase.from('tasks').update({
        status: 'completed',
        result: JSON.stringify({ report_id: data.id }),
        completed_at: new Date().toISOString(),
      }).eq('id', task_id);
    }

    res.status(201).json({ message: 'Analytics KPI report saved', data });
  } catch (err) {
    next(err);
  }
};

// POST /api/webhook/support-escalate
// n8n calls this to escalate a support ticket
const escalateTicket = async (req, res, next) => {
  try {
    const { ticket_id, user_id } = req.body;

    if (!ticket_id) return res.status(400).json({ error: 'ticket_id is required' });

    let query = supabase
      .from('support_tickets')
      .update({ escalated: true, status: 'escalated' })
      .eq('id', ticket_id);

    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query.select().single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Ticket not found' });

    res.json({ message: 'Ticket escalated by n8n', data });
  } catch (err) {
    next(err);
  }
};

// GET /api/webhook/pending-tasks
// n8n polls this to pick up pending tasks (alternative to push)
const getPendingTasks = async (req, res, next) => {
  try {
    const { agent_type } = req.query;

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (agent_type) query = query.eq('agent_type', agent_type);

    const { data, error } = await query;
    if (error) throw error;

    // Mark them as 'running' so they don't get picked up twice
    if (data && data.length > 0) {
      const ids = data.map(t => t.id);
      await supabase.from('tasks').update({ status: 'running' }).in('id', ids);
    }

    res.json({ data: data || [] });
  } catch (err) {
    next(err);
  }
};

module.exports = { verifySecret, taskUpdate, saveExecutiveBriefing, saveAnalyticsKPI, escalateTicket, getPendingTasks };
