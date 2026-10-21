const supabase = require('../config/supabase');
const logger = require('./logger');
const { getOrCreateBriefing } = require('./executiveBriefing');

// The worker is deliberately idempotent: getOrCreateBriefing persists one daily
// snapshot per office user, so hourly checks never produce duplicate AI calls.
const runDailyExecutiveBriefings = async () => {
  const { data: roles, error: rolesError } = await supabase.from('roles').select('id').in('name', ['admin', 'manager']);
  if (rolesError) throw rolesError;
  const ids = (roles || []).map((role) => role.id);
  if (!ids.length) return 0;
  const { data: users, error: usersError } = await supabase.from('users').select('id').in('role_id', ids).eq('is_active', true);
  if (usersError) throw usersError;
  const outcomes = await Promise.allSettled((users || []).map((user) => getOrCreateBriefing(user.id, 'daily')));
  const created = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
  const failed = outcomes.filter((outcome) => outcome.status === 'rejected');
  if (failed.length) logger.warn('Some Executive intelligence briefings could not be generated', { failed: failed.length });
  return created;
};

const startExecutiveBriefingWorker = () => {
  const run = () => runDailyExecutiveBriefings()
    .then((count) => { if (count) logger.info('Executive daily intelligence check complete', { users: count }); })
    .catch((error) => logger.error('Executive intelligence worker failed', { error: error.message }));
  run();
  const interval = setInterval(run, 60 * 60 * 1000);
  interval.unref();
  return interval;
};

module.exports = { runDailyExecutiveBriefings, startExecutiveBriefingWorker };
