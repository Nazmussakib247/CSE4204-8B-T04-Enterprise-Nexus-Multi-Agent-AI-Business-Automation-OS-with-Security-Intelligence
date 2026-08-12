/**
 * Conversation memory for the Executive orchestrator.
 *
 * agent_conversations — one row per chat thread (title + rolling summary)
 * agent_messages      — user / assistant / tool turns
 *
 * All reads/writes verify conversation ownership against user_id.
 */
const supabase = require('../config/supabase');
const { generateJson } = require('../ai/client');
const logger = require('../utils/logger');

const CONTEXT_MESSAGES = 10;

/** Load an existing conversation (ownership-checked) or create a new one. */
const getOrCreateConversation = async (userId, conversationId, firstQuestion) => {
  if (conversationId) {
    const { data, error } = await supabase
      .from('agent_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    if (error || !data) return null;
    return data;
  }

  const { data, error } = await supabase
    .from('agent_conversations')
    .insert({ user_id: userId, title: String(firstQuestion).slice(0, 120) })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Last N messages (chronological) for prompt context. */
const loadRecentMessages = async (conversationId, limit = CONTEXT_MESSAGES) => {
  const { data, error } = await supabase
    .from('agent_messages')
    .select('role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
};

/** Append one or more messages to a conversation. */
const appendMessages = async (conversationId, messages) => {
  const rows = messages.map((m) => ({
    conversation_id: conversationId,
    role: m.role,
    content: m.content,
    metadata: m.metadata || null,
  }));
  const { error } = await supabase.from('agent_messages').insert(rows);
  if (error) throw error;
};

/**
 * Update the rolling summary after an exchange. Non-fatal: if the AI is
 * unavailable the old summary is kept and we only bump updated_at.
 */
const updateRollingSummary = async (conversation, question, answer) => {
  let summary = conversation.summary || null;
  try {
    const result = await generateJson({
      systemInstruction: 'You maintain terse running summaries of business conversations.',
      prompt: `Update this rolling conversation summary in <= 120 words. Keep facts, decisions, and open questions; drop pleasantries.

CURRENT SUMMARY:
${conversation.summary || '(none yet)'}

NEW EXCHANGE:
user: ${String(question).slice(0, 1000)}
assistant: ${String(answer).slice(0, 1500)}

Return {"summary": "..."}.`,
      responseSchema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    });
    summary = result.summary;
  } catch (err) {
    logger.warn('[Memory] rolling summary update skipped (AI unavailable)', { error: err.message });
  }

  const { error } = await supabase
    .from('agent_conversations')
    .update({ summary, updated_at: new Date().toISOString() })
    .eq('id', conversation.id);
  if (error) logger.warn('[Memory] failed to persist summary', { error: error.message });
  return summary;
};

/** Conversation list for the sidebar. */
const listConversations = async (userId) => {
  const { data, error } = await supabase
    .from('agent_conversations')
    .select('id, title, summary, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
};

/** Full message history (ownership-checked). Returns null if not owner. */
const getConversationMessages = async (userId, conversationId) => {
  const { data: conv, error: convError } = await supabase
    .from('agent_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();
  if (convError || !conv) return null;

  const { data, error } = await supabase
    .from('agent_messages')
    .select('id, role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return data || [];
};

/** Render summary + recent turns into a prompt preamble. */
const buildContextPrompt = (conversation, recentMessages, question) => {
  const history = recentMessages
    .filter((m) => m.role !== 'tool')
    .map((m) => `${m.role}: ${String(m.content).slice(0, 500)}`)
    .join('\n');

  return `CONVERSATION SUMMARY:
${conversation.summary || '(none yet — new conversation)'}

RECENT MESSAGES:
${history || '(none)'}

NEW QUESTION: ${question}`;
};

module.exports = {
  getOrCreateConversation,
  loadRecentMessages,
  appendMessages,
  updateRollingSummary,
  listConversations,
  getConversationMessages,
  buildContextPrompt,
  CONTEXT_MESSAGES,
};
