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

// POST /api/webhook/job-application-screened
// n8n calls this after its screening/routing workflow has completed.
const saveJobApplicationScreening = async (req, res, next) => {
  try {
    const { application_id, ai_score, ai_confidence, ai_recommendation, skill_scores, narrative_summary, status = 'ai_screened' } = req.body;
    if (!application_id) return res.status(400).json({ error: 'application_id is required' });
    const updates = { status, updated_at: new Date().toISOString() };
    if (Number.isInteger(ai_score) && ai_score >= 0 && ai_score <= 100) updates.ai_score = ai_score;
    if (['low', 'medium', 'high'].includes(ai_confidence)) updates.ai_confidence = ai_confidence;
    if (['shortlist', 'review', 'reject'].includes(ai_recommendation)) updates.ai_recommendation = ai_recommendation;
    if (Array.isArray(skill_scores)) updates.skill_scores = skill_scores;
    if (typeof narrative_summary === 'string') updates.narrative_summary = narrative_summary;
    const { data, error } = await supabase.from('job_applications').update(updates).eq('id', application_id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Job application not found' });
    res.json({ message: 'Job application screening saved', data });
  } catch (err) { next(err); }
};

// POST /api/webhook/store-review-analysed
// n8n persists the review sentiment and its Support Agent response.
const saveStoreReviewAnalysis = async (req, res, next) => {
  try {
    const { review_id, sentiment, urgency, support_reply } = req.body;
    if (!review_id) return res.status(400).json({ error: 'review_id is required' });
    if (!['positive', 'neutral', 'negative'].includes(sentiment) || !['low', 'medium', 'high'].includes(urgency)) {
      return res.status(400).json({ error: 'sentiment and urgency have invalid values' });
    }
    if (typeof support_reply !== 'string' || support_reply.trim().length < 3 || support_reply.length > 2000) {
      return res.status(400).json({ error: 'support_reply must contain 3 to 2000 characters' });
    }
    const flagged = sentiment === 'negative' || urgency === 'high';
    const { data, error } = await supabase
      .from('product_reviews')
      .update({
        sentiment,
        urgency,
        ai_status: 'completed',
        flagged_as_complaint: flagged,
        human_intervention_required: flagged,
        human_intervention_reason: flagged ? 'Negative sentiment or high urgency detected by Support Agent' : null,
        human_intervention_status: flagged ? 'pending' : 'not_required',
        support_reply: support_reply.trim(),
        support_replied_at: new Date().toISOString(),
      })
      .eq('id', review_id)
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Product review not found' });
    res.json({ message: 'Store review analysis saved', data });
  } catch (err) { next(err); }
};

// POST /api/webhook/store-support-analysed
// n8n enriches a ticket after it has already been saved for the customer.
const saveStoreSupportAnalysis = async (req, res, next) => {
  try {
    const { ticket_id, sentiment, urgency, intent, confidence, ai_response } = req.body;
    if (!ticket_id) return res.status(400).json({ error: 'ticket_id is required' });
    if (!['positive', 'neutral', 'negative'].includes(sentiment) || !['low', 'medium', 'high'].includes(urgency)) {
      return res.status(400).json({ error: 'sentiment and urgency have invalid values' });
    }
    if (typeof intent !== 'string' || !intent.trim() || typeof ai_response !== 'string' || ai_response.trim().length < 3 || ai_response.length > 2000) {
      return res.status(400).json({ error: 'intent and ai_response are required' });
    }
    const requiresHuman = urgency === 'high';
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        sentiment,
        urgency,
        intent: intent.trim(),
        confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
        ai_response: ai_response.trim(),
        ai_status: 'completed',
        escalated: requiresHuman,
        human_intervention_required: requiresHuman,
        human_intervention_reason: requiresHuman ? 'High urgency detected by Support Agent' : null,
        human_intervention_status: requiresHuman ? 'pending' : 'not_required',
        status: requiresHuman ? 'escalated' : 'open',
      })
      .eq('id', ticket_id)
      .in('ai_status', ['pending', 'failed'])
      .select()
      .single();
    if (error || !data) return res.status(404).json({ error: 'Pending support ticket not found' });
    const { error: messageError } = await supabase.from('support_messages').insert({
      ticket_id: data.id,
      sender_type: 'ai',
      body: ai_response.trim(),
    });
    if (messageError) throw messageError;
    res.json({ message: 'Store support analysis saved', data });
  } catch (err) { next(err); }
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

module.exports = { verifySecret, taskUpdate, saveExecutiveBriefing, saveAnalyticsKPI, escalateTicket, saveJobApplicationScreening, saveStoreReviewAnalysis, saveStoreSupportAnalysis, getPendingTasks };
