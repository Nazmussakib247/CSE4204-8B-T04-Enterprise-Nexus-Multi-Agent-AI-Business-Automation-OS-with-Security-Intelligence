const orchestrator = require('../orchestrator/orchestrator');
const TaskModel    = require('../models/Task');
const { success, error, paginate } = require('../utils/response');

/**
 * POST /api/workflow/dispatch
 * Dispatch a single agent task.
 * Body: { agent_type, payload?, text? }
 */
const dispatch = async (req, res) => {
  const { agent_type, payload, text } = req.body;
  if (!agent_type) return error(res, 'agent_type is required', 400);

  const validAgents = ['hr', 'finance', 'support', 'analytics', 'executive'];
  if (!validAgents.includes(agent_type))
    return error(res, `agent_type must be one of: ${validAgents.join(', ')}`, 400);

  const { task, result } = await orchestrator.dispatchSingle({
    userId: req.user.id, agentType: agent_type, payload, text,
  });
  return success(res, { task, result }, 'Task dispatched', 201);
};

/**
 * GET /api/workflow/tasks — task pipeline for current user
 */
const getPipeline = async (req, res) => {
  const { page = 1, limit = 20, agent_type, status } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await TaskModel.findByUser(req.user.id, { ...pag, agentType: agent_type });
  return success(res, { tasks: data, meta: pag.meta(total) });
};

/**
 * GET /api/workflow/tasks/:id
 */
const getTask = async (req, res) => {
  const task = await TaskModel.findById(req.params.id);
  if (!task || task.user_id !== req.user.id)
    return error(res, 'Task not found', 404);
  return success(res, { task });
};

/**
 * POST /api/workflow/run/:name — run a named multi-agent workflow
 */
const runNamedWorkflow = async (req, res) => {
  const { name } = req.params;
  const payload  = req.body.payload || {};

  try {
    const results = await orchestrator.runNamedWorkflow(name, req.user.id, payload);
    return success(res, { workflow: name, results });
  } catch (err) {
    if (err.message.startsWith('Unknown workflow'))
      return error(res, err.message, 400);
    return error(res, 'Workflow execution failed', 500, err.message);
  }
};

/**
 * GET /api/workflow/definitions — list available named workflows
 */
const getDefinitions = async (req, res) => {
  const defs = Object.entries(orchestrator.WORKFLOW_DEFINITIONS).map(([name, def]) => ({
    name,
    description: def.description,
    mode:        def.mode,
    steps:       def.steps.map((s) => s.agentType),
  }));
  return success(res, { definitions: defs });
};

module.exports = { dispatch, getPipeline, getTask, runNamedWorkflow, getDefinitions };
