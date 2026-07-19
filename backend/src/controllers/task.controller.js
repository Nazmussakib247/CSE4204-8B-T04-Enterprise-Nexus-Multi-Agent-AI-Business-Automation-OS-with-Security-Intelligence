const supabase = require('../config/supabase');

// GET /api/tasks
const getTasks = async (req, res, next) => {
  try {
    const { agent_type, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (agent_type) query = query.eq('agent_type', agent_type);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/:id
const getTask = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Task not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /api/tasks
const createTask = async (req, res, next) => {
  try {
    const { agent_type, load } = req.body;

    if (!agent_type) return res.status(400).json({ error: 'agent_type is required' });

    const validAgents = ['hr', 'finance', 'support', 'analytics', 'executive'];
    if (!validAgents.includes(agent_type)) {
      return res.status(400).json({ error: `agent_type must be one of: ${validAgents.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: req.user.id, agent_type, status: 'pending', load })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Task queued', data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tasks/:id/status
const updateTaskStatus = async (req, res, next) => {
  try {
    const { status, result } = req.body;
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
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task updated', data });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTasks, getTask, createTask, updateTaskStatus };
