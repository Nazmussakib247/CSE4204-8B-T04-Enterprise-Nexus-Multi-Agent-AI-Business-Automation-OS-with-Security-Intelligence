const XLSX = require('xlsx');
const supabase = require('../config/supabase');
const { detectAnomaly, parseInvoice } = require('../utils/gemini');
const { extractText } = require('../utils/fileExtract');
const { notifyN8n } = require('../utils/webhook');
const { writeAuditLog } = require('../utils/audit');

// Insert one finance record with AI anomaly analysis (shared by manual + upload flows)
const insertRecordWithAnomaly = async (userId, { category, amount, expense_date, description }) => {
  const aiResult = await detectAnomaly({ category, amount, description, expense_date });
  const { data, error } = await supabase
    .from('finance_records')
    .insert({
      user_id: userId,
      category,
      amount,
      expense_date,
      description: description || null,
      severity: aiResult.severity,
      ai_analysis: aiResult.ai_analysis,
    })
    .select()
    .single();
  if (error) throw error;

  if (['high', 'critical'].includes(aiResult.severity)) {
    notifyN8n('finance-anomaly', {
      record_id: data.id, user_id: userId, category: data.category,
      amount: data.amount, expense_date: data.expense_date,
      severity: aiResult.severity, ai_analysis: aiResult.ai_analysis,
    });
  }
  return { data, aiResult };
};

// Find a value in a row object by trying several possible column names (case-insensitive)
const pick = (row, keys) => {
  const lower = {};
  Object.keys(row).forEach((k) => { lower[k.trim().toLowerCase()] = row[k]; });
  for (const key of keys) {
    const v = lower[key];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

// Normalise a spreadsheet date cell to YYYY-MM-DD
const normaliseDate = (val) => {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'number') { // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const d = new Date(String(val));
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
};

// GET /api/finance/records
const getRecords = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, severity, from, to } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('finance_records')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('expense_date', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (category) query = query.eq('category', category);
    if (severity) query = query.eq('severity', severity);
    if (from) query = query.gte('expense_date', from);
    if (to) query = query.lte('expense_date', to);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/finance/records/:id
const getRecord = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('finance_records')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Record not found' });
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /api/finance/records — Gemini anomaly detection
const createRecord = async (req, res, next) => {
  try {
    const { category, amount, expense_date, description } = req.body;

    if (!category || !amount || !expense_date) {
      return res.status(400).json({ error: 'category, amount, and expense_date are required' });
    }

    const aiResult = await detectAnomaly({ category, amount, description, expense_date });

    const { data, error } = await supabase
      .from('finance_records')
      .insert({
        user_id: req.user.id,
        category,
        amount,
        expense_date,
        description: description || null,
        severity: aiResult.severity,
        ai_analysis: aiResult.ai_analysis,
      })
      .select()
      .single();

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'finance.record.create',
      resourceType: 'finance_record',
      resourceId: data.id,
      metadata: { category, amount, severity: aiResult.severity },
      req,
    });

    if (['high', 'critical'].includes(aiResult.severity)) {
      notifyN8n('finance-anomaly', {
        record_id: data.id,
        user_id: req.user.id,
        category: data.category,
        amount: data.amount,
        expense_date: data.expense_date,
        severity: aiResult.severity,
        ai_analysis: aiResult.ai_analysis,
      });
    }

    res.status(201).json({ message: 'Finance record created with AI analysis', data, ai_analysis: aiResult });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/finance/records/:id
const updateRecord = async (req, res, next) => {
  try {
    const { category, amount, expense_date, description } = req.body;
    const updates = {};
    if (category !== undefined) updates.category = category;
    if (amount !== undefined) updates.amount = amount;
    if (expense_date !== undefined) updates.expense_date = expense_date;
    if (description !== undefined) updates.description = description;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('finance_records')
      .update(updates)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Record not found' });

    writeAuditLog({
      userId: req.user.id,
      action: 'finance.record.update',
      resourceType: 'finance_record',
      resourceId: data.id,
      req,
    });

    res.json({ message: 'Record updated', data });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/finance/records/:id
const deleteRecord = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('finance_records')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'finance.record.delete',
      resourceType: 'finance_record',
      resourceId: req.params.id,
      req,
    });

    res.json({ message: 'Record deleted' });
  } catch (err) {
    next(err);
  }
};

// GET /api/finance/anomalies — high/critical severity only
const getAnomalies = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('finance_records')
      .select('*')
      .eq('user_id', req.user.id)
      .in('severity', ['high', 'critical'])
      .order('expense_date', { ascending: false });

    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/finance/summary — aggregate stats
const getSummary = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('finance_records')
      .select('category, amount, severity')
      .eq('user_id', req.user.id);

    if (error) throw error;

    const by_category = {};
    let total_spend = 0;
    let anomaly_count = 0;

    for (const r of data) {
      by_category[r.category] = (by_category[r.category] || 0) + Number(r.amount);
      total_spend += Number(r.amount);
      if (['high', 'critical'].includes(r.severity)) anomaly_count++;
    }

    res.json({
      total_spend: Math.round(total_spend * 100) / 100,
      by_category,
      anomaly_count,
      record_count: data.length,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/finance/upload/invoice — parse a PDF invoice/receipt into one record (FR-11)
const uploadInvoice = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "invoice".' });
    }

    let text = '';
    try {
      text = await extractText(req.file.buffer, req.file.mimetype);
    } catch (extractErr) {
      return res.status(422).json({ error: `Could not read the invoice: ${extractErr.message}` });
    }

    if (!text || text.length < 15) {
      return res.status(422).json({ error: 'Could not extract text from this invoice. Try a text-based PDF.' });
    }

    const parsed = await parseInvoice({ invoice_text: text });
    if (!parsed.amount || parsed.amount <= 0) {
      return res.status(422).json({ error: 'Could not detect a valid amount on this invoice. Please enter it manually.', parsed });
    }

    const { data, aiResult } = await insertRecordWithAnomaly(req.user.id, {
      category: parsed.category || 'Other',
      amount: parsed.amount,
      expense_date: parsed.expense_date,
      description: parsed.vendor ? `${parsed.vendor} — ${parsed.description}` : parsed.description,
    });

    writeAuditLog({
      userId: req.user.id,
      action: 'finance.invoice.upload',
      resourceType: 'finance_record',
      resourceId: data.id,
      metadata: { filename: req.file.originalname, amount: parsed.amount, vendor: parsed.vendor },
      req,
    });

    res.status(201).json({ message: 'Invoice parsed and recorded', data, parsed, ai_analysis: aiResult });
  } catch (err) {
    next(err);
  }
};

// POST /api/finance/upload/bulk — import many expenses from CSV/XLS/XLSX (FR-11)
const bulkUploadExpenses = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use field name "file".' });
    }

    let rows;
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch (parseErr) {
      return res.status(422).json({ error: `Could not parse the file: ${parseErr.message}` });
    }

    if (!rows || !rows.length) {
      return res.status(422).json({ error: 'The file has no data rows. Expected columns: category, amount, date, description.' });
    }

    const MAX_ROWS = 200;
    if (rows.length > MAX_ROWS) {
      return res.status(413).json({ error: `Too many rows (${rows.length}). Please upload at most ${MAX_ROWS} at a time.` });
    }

    const inserted = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const category = pick(row, ['category', 'type', 'expense category']);
      const amountRaw = pick(row, ['amount', 'total', 'cost', 'price', 'value']);
      const dateRaw = pick(row, ['expense_date', 'date', 'expense date', 'transaction date']);
      const description = pick(row, ['description', 'desc', 'notes', 'memo', 'details']);

      const amount = Number(String(amountRaw ?? '').replace(/[^0-9.-]/g, ''));
      const expense_date = normaliseDate(dateRaw);

      if (!category || !amount || amount <= 0 || !expense_date) {
        errors.push({ row: i + 2, reason: 'Missing/invalid category, amount, or date', data: row });
        continue;
      }

      try {
        const { data } = await insertRecordWithAnomaly(req.user.id, {
          category: String(category), amount, expense_date, description: description ? String(description) : null,
        });
        inserted.push(data);
      } catch (rowErr) {
        errors.push({ row: i + 2, reason: rowErr.message, data: row });
      }
    }

    writeAuditLog({
      userId: req.user.id,
      action: 'finance.bulk.upload',
      resourceType: 'finance_record',
      metadata: { filename: req.file.originalname, inserted: inserted.length, failed: errors.length },
      req,
    });

    res.status(201).json({
      message: `Imported ${inserted.length} of ${rows.length} rows`,
      inserted_count: inserted.length,
      failed_count: errors.length,
      errors: errors.slice(0, 20),
      data: inserted,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRecords, getRecord, createRecord, updateRecord, deleteRecord, getAnomalies, getSummary, uploadInvoice, bulkUploadExpenses };
