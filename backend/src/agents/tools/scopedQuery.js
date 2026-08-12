/**
 * scopedQuery — the ONLY way agent tools may touch the database.
 *
 * Every builder it returns is pre-filtered with .eq('user_id', userId), so a
 * prompt-injected or misbehaving agent can never read or write another
 * user's rows. Do not import config/supabase directly from agent tools.
 */
const supabase = require('../../config/supabase');

/**
 * @param {string} table   table name
 * @param {string} userId  owning user — REQUIRED
 * @returns {{ select: Function, update: Function, insert: Function }}
 */
const scopedQuery = (table, userId) => {
  if (!userId) throw new Error(`scopedQuery(${table}) requires a userId`);
  return {
    /** SELECT pre-scoped to the user. Chain further filters freely. */
    select: (columns = '*', options = undefined) =>
      supabase.from(table).select(columns, options).eq('user_id', userId),

    /** UPDATE pre-scoped to the user. Chain .eq('id', ...) etc. */
    update: (values) => supabase.from(table).update(values).eq('user_id', userId),

    /** INSERT with user_id forced onto every row. */
    insert: (values) => {
      const rows = Array.isArray(values) ? values : [values];
      return supabase.from(table).insert(rows.map((r) => ({ ...r, user_id: userId })));
    },
  };
};

module.exports = { scopedQuery };
