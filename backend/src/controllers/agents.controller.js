const { createHrAgent } = require('../agents/hr.agent');
const { createFinanceAgent } = require('../agents/finance.agent');
const { createSupportAgent } = require('../agents/support.agent');
const { createAnalyticsAgent } = require('../agents/analytics.agent');
const { AiUnavailableError } = require('../ai/errors');
const supabase = require('../config/supabase');
const { writeAuditLog } = require('../utils/audit');

const AGENT_FACTORIES = {
  hr: createHrAgent,
  finance: createFinanceAgent,
  support: createSupportAgent,
  analytics: createAnalyticsAgent,
};

const MAX_MESSAGE_LENGTH = 2000;

// POST /api/v1/agents/:agent/chat — run one agent turn (tool loop + final answer)
const chat = async (req, res, next) => {
  try {
    const factory = AGENT_FACTORIES[req.params.agent];
    if (!factory) {
      return res.status(404).json({
        error: `Unknown agent "${req.params.agent}". Available: ${Object.keys(AGENT_FACTORIES).join(', ')}`,
      });
    }

    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(413).json({ error: `message too long (max ${MAX_MESSAGE_LENGTH} chars)` });
    }

    const agent = factory(req.user.id, req);

    let output;
    try {
      output = await agent.run(message.trim(), { userId: req.user.id, req });
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        return res.status(503).json({
          error: 'The AI agent is temporarily unavailable. Please try again later.',
          steps: agent.lastRunSteps || [],
        });
      }
      throw err;
    }

    writeAuditLog({
      userId: req.user.id,
      action: `agent:${req.params.agent}.chat`,
      resourceType: 'agent_chat',
      metadata: {
        message_preview: message.slice(0, 200),
        tool_calls: (agent.lastRunSteps || []).map((s) => s.tool),
      },
      req,
    });

    res.json({
      agent: req.params.agent,
      answer: output.answer,
      ...(output.sources ? { sources: output.sources } : {}),
      steps: agent.lastRunSteps || [],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/agents/activity — the user's own agent activity (audit trail)
const activity = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, action, resource_type, resource_id, metadata, success, created_at')
      .eq('user_id', req.user.id)
      .ilike('action', 'agent:%')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

module.exports = { chat, activity, AGENT_FACTORIES };
