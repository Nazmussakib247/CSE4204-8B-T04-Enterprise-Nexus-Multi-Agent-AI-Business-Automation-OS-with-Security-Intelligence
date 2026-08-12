/**
 * Embeddings layer — Gemini text-embedding-004 (768 dims) + pgvector storage.
 *
 * embedText / embedBatch  → vectors (throws AiUnavailableError on failure)
 * chunkText               → ~500-token chunks with overlap
 * upsertDocument          → replace all chunks for one logical source
 * safeEmbed*              → fire-and-forget wrappers for controller hooks
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { AiUnavailableError } = require('./errors');

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';
const EMBEDDING_DIMS = 768;

// ~500 tokens ≈ 2000 chars; 10% overlap keeps context across boundaries
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

let _genAI = null;
const getModel = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiUnavailableError('GEMINI_API_KEY is not configured', { reason: 'not_configured' });
  }
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
};

const withRetry = async (fn, attempts = 3) => {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, 400 * 2 ** (i - 1)));
    }
  }
  throw new AiUnavailableError(`Embedding failed: ${lastErr?.message}`, { cause: lastErr, attempts });
};

/** Embed one text. Returns number[768]. */
const embedText = async (text) => {
  const model = getModel();
  const result = await withRetry(() =>
    model.embedContent({
      content: { parts: [{ text: String(text).slice(0, 9000) }] },
      // newer models (gemini-embedding-001) default to 3072 dims — pin to the
      // vector(768) column; text-embedding-004 is natively 768 and ignores this
      outputDimensionality: EMBEDDING_DIMS,
    })
  );
  const values = result?.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
    throw new AiUnavailableError(`Embedding returned unexpected shape (${values?.length ?? 'none'} dims)`);
  }
  return values;
};

/** Embed many texts (batched — up to 100 per API call). */
const embedBatch = async (texts) => {
  const model = getModel();
  const out = [];
  for (let i = 0; i < texts.length; i += 100) {
    const slice = texts.slice(i, i + 100);
    const result = await withRetry(() =>
      model.batchEmbedContents({
        requests: slice.map((t) => ({
          content: { parts: [{ text: String(t).slice(0, 9000) }] },
          outputDimensionality: EMBEDDING_DIMS,
        })),
      })
    );
    const vectors = (result?.embeddings || []).map((e) => e.values);
    if (vectors.length !== slice.length) {
      throw new AiUnavailableError('Batch embedding count mismatch');
    }
    out.push(...vectors);
  }
  return out;
};

/**
 * Split text into ~CHUNK_SIZE-char chunks with CHUNK_OVERLAP, preferring
 * paragraph then sentence boundaries so chunks stay coherent.
 */
const chunkText = (text, { chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {}) => {
  const clean = String(text).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    if (end < clean.length) {
      // Prefer to break on a paragraph, then a sentence, inside the last 40%
      const window = clean.slice(start, end);
      const minBreak = Math.floor(chunkSize * 0.6);
      const parBreak = window.lastIndexOf('\n\n');
      const sentBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'));
      if (parBreak > minBreak) end = start + parBreak;
      else if (sentBreak > minBreak) end = start + sentBreak + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
};

/**
 * Replace all chunks for one logical source with fresh embeddings.
 * @returns {Promise<number>} number of chunks stored
 */
const upsertDocument = async ({ userId, title, content, sourceType, sourceId }) => {
  if (!userId || !sourceType) throw new Error('upsertDocument requires userId and sourceType');
  const chunks = chunkText(content);
  if (!chunks.length) return 0;

  const vectors = await embedBatch(chunks);

  if (sourceId) {
    const { error: delError } = await supabase
      .from('documents')
      .delete()
      .eq('source_type', sourceType)
      .eq('source_id', String(sourceId));
    if (delError) throw new Error(`documents delete failed: ${delError.message}`);
  }

  const rows = chunks.map((chunk, i) => ({
    user_id: userId,
    title: String(title).slice(0, 300),
    content: chunk,
    chunk_index: i,
    embedding: vectors[i],
    source_type: sourceType,
    source_id: sourceId ? String(sourceId) : null,
  }));

  const { error } = await supabase.from('documents').insert(rows);
  if (error) throw new Error(`documents insert failed: ${error.message}`);
  return rows.length;
};

// ── Record → text renderers ──────────────────────────────────

const hrReportText = (r) => `CV screening report for ${r.candidate_name} (${r.job_title}).
Recommendation: ${r.recommendation || 'pending'}. AI score: ${r.ai_score ?? 'n/a'}.
Summary: ${r.narrative_summary || 'none'}`;

const financeRecordText = (r) => `Expense record: ${r.category}, amount ${r.amount}, date ${r.expense_date}.
Severity: ${r.severity || 'unrated'}. Description: ${r.description || 'none'}.
Analysis: ${r.ai_analysis || 'none'}`;

const supportTicketText = (t) => `Support ticket: ${t.query}
Intent: ${t.intent || 'unknown'}. Urgency: ${t.urgency || 'unknown'}. Sentiment: ${t.sentiment || 'unknown'}.
Status: ${t.status}. AI response: ${t.ai_response || 'none'}`;

// ── Fire-and-forget hooks for controllers (never throw) ─────

const safeEmbed = (label, fn) => {
  fn().catch((err) => logger.warn(`[Embeddings] ${label} embedding skipped`, { error: err.message }));
};

const safeEmbedHrReport = (report) =>
  safeEmbed(`hr_report ${report.id}`, () =>
    upsertDocument({
      userId: report.user_id,
      title: `${report.candidate_name} — ${report.job_title}`,
      content: hrReportText(report),
      sourceType: 'hr',
      sourceId: report.id,
    })
  );

const safeEmbedFinanceRecord = (record) =>
  safeEmbed(`finance_record ${record.id}`, () =>
    upsertDocument({
      userId: record.user_id,
      title: `${record.category} — ${record.expense_date}`,
      content: financeRecordText(record),
      sourceType: 'finance',
      sourceId: record.id,
    })
  );

const safeEmbedSupportTicket = (ticket) =>
  safeEmbed(`support_ticket ${ticket.id}`, () =>
    upsertDocument({
      userId: ticket.user_id,
      title: String(ticket.query).slice(0, 120),
      content: supportTicketText(ticket),
      sourceType: 'support',
      sourceId: ticket.id,
    })
  );

module.exports = {
  embedText,
  embedBatch,
  chunkText,
  upsertDocument,
  safeEmbedHrReport,
  safeEmbedFinanceRecord,
  safeEmbedSupportTicket,
  hrReportText,
  financeRecordText,
  supportTicketText,
  EMBEDDING_MODEL,
  EMBEDDING_DIMS,
};
