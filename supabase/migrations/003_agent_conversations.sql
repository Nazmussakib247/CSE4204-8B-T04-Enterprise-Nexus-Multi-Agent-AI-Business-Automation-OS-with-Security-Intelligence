-- ============================================================
--  Migration 003: Agent conversation memory
--  Multi-turn chat history for the Executive orchestrator.
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT        CHECK (char_length(title) <= 200),
  summary    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_id    ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated_at ON agent_conversations(updated_at DESC);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent conversations" ON agent_conversations
  FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS agent_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         TEXT        NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(conversation_id, created_at);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage messages in own conversations" ON agent_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM agent_conversations c
      WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()
    )
  );
