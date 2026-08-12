-- ============================================================
--  Migration 004: RAG — pgvector documents + semantic search
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  chunk_index INTEGER     NOT NULL DEFAULT 0,
  embedding   vector(768),
  source_type TEXT        NOT NULL CHECK (source_type IN ('hr', 'finance', 'support', 'knowledge_base')),
  source_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One logical source maps to N chunks; re-embedding replaces them atomically.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_source_chunk
  ON documents(source_type, source_id, chunk_index)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_source  ON documents(source_type, source_id);

-- ANN index for cosine similarity (ivfflat needs ANALYZE after bulk loads)
CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own documents and the knowledge base" ON documents
  FOR SELECT USING (user_id = auth.uid() OR source_type = 'knowledge_base');
CREATE POLICY "Users manage own documents" ON documents
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
--  match_documents — ranked semantic retrieval.
--  Personal chunks are scoped to p_user_id; knowledge_base
--  chunks are shared with every authenticated user.
-- ============================================================
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_count     int  DEFAULT 5,
  p_user_id       uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  title       text,
  content     text,
  chunk_index int,
  source_type text,
  source_id   text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    d.id,
    d.title,
    d.content,
    d.chunk_index,
    d.source_type,
    d.source_id,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.embedding IS NOT NULL
    AND (d.user_id = p_user_id OR d.source_type = 'knowledge_base')
  ORDER BY d.embedding <=> query_embedding
  LIMIT LEAST(match_count, 50);
$$;
