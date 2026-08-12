/**
 * retrieve_knowledge — shared RAG tool.
 *
 * Embeds the query and calls the match_documents RPC: the user's own
 * embedded records plus the shared knowledge base, ranked by cosine
 * similarity. Read-only.
 */
const { z } = require('zod');
const { tool } = require('@langchain/core/tools');
const supabase = require('../../config/supabase');
const { embedText } = require('../../ai/embeddings');

const DEFAULT_TOP_K = 5;

/** Raw retrieval helper (also used by draft_reply grounding). */
const retrieveChunks = async (userId, query, topK = DEFAULT_TOP_K) => {
  const embedding = await embedText(query);
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_count: topK,
    p_user_id: userId,
  });
  if (error) throw new Error(`match_documents failed: ${error.message}`);
  return (data || []).map((d) => ({
    title: d.title,
    snippet: String(d.content || '').slice(0, 400),
    source_type: d.source_type,
    similarity: Math.round((d.similarity || 0) * 1000) / 1000,
  }));
};

const makeRetrieveKnowledgeTool = (userId) =>
  tool(
    async ({ query }) => {
      const chunks = await retrieveChunks(userId, query, DEFAULT_TOP_K);
      return JSON.stringify({ count: chunks.length, chunks });
    },
    {
      name: 'retrieve_knowledge',
      description:
        'Semantic search over the knowledge base and the user\'s own records (top-5 chunks by similarity). Use to ground answers in documented facts, policies, or past records.',
      schema: z.object({
        query: z.string().min(3).describe('What to look up, phrased as a natural-language query'),
      }),
    }
  );

module.exports = { makeRetrieveKnowledgeTool, retrieveChunks, DEFAULT_TOP_K };
