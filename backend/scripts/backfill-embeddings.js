#!/usr/bin/env node
/**
 * Backfill pgvector embeddings for existing hr_reports, finance_records,
 * and support_tickets.
 *
 * Usage: node scripts/backfill-embeddings.js [--table hr|finance|support] [--limit N]
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 */
require('dotenv').config();
const supabase = require('../src/config/supabase');
const {
  upsertDocument,
  hrReportText,
  financeRecordText,
  supportTicketText,
} = require('../src/ai/embeddings');

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};
const only = argValue('--table');
const limit = Number(argValue('--limit')) || 1000;

const TABLES = {
  hr: {
    table: 'hr_reports',
    sourceType: 'hr',
    toDoc: (r) => ({ title: `${r.candidate_name} — ${r.job_title}`, content: hrReportText(r) }),
  },
  finance: {
    table: 'finance_records',
    sourceType: 'finance',
    toDoc: (r) => ({ title: `${r.category} — ${r.expense_date}`, content: financeRecordText(r) }),
  },
  support: {
    table: 'support_tickets',
    sourceType: 'support',
    toDoc: (r) => ({ title: String(r.query).slice(0, 120), content: supportTicketText(r) }),
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const backfillTable = async (key) => {
  const { table, sourceType, toDoc } = TABLES[key];
  console.log(`\n── Backfilling ${table} (max ${limit}) ──`);

  const { data: rows, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`${table} fetch failed: ${error.message}`);

  let ok = 0;
  let failed = 0;
  for (const [i, row] of rows.entries()) {
    try {
      const { title, content } = toDoc(row);
      const chunks = await upsertDocument({
        userId: row.user_id,
        title,
        content,
        sourceType,
        sourceId: row.id,
      });
      ok += 1;
      process.stdout.write(`\r  ${i + 1}/${rows.length} embedded (${chunks} chunk(s)) — ok=${ok} failed=${failed}   `);
      await sleep(120); // stay well under embedding rate limits
    } catch (err) {
      failed += 1;
      console.error(`\n  ! ${table} row ${row.id}: ${err.message}`);
    }
  }
  console.log(`\n  done: ${ok} embedded, ${failed} failed`);
};

(async () => {
  const keys = only ? [only] : Object.keys(TABLES);
  for (const key of keys) {
    if (!TABLES[key]) {
      console.error(`Unknown table "${key}". Use: ${Object.keys(TABLES).join(' | ')}`);
      process.exit(1);
    }
    await backfillTable(key);
  }
  console.log('\nBackfill complete. Consider running ANALYZE documents; for ivfflat.');
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
