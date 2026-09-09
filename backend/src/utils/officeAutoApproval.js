const supabase = require('../config/supabase');
const logger = require('./logger');
const { writeAuditLog } = require('./audit');

const OFFICE_ROLES = ['admin', 'manager', 'employee'];
const AUTO_APPROVAL_DELAY_MS = 30_000;
const AUTO_APPROVAL_POLL_MS = 5_000;

// The decision is stored in the database, rather than held in a setTimeout.
// That means a Render restart cannot lose a pending request: the next worker
// pass finds every request that has been pending for at least 30 seconds.
const approveEligibleOfficeAccounts = async () => {
  const cutoff = new Date(Date.now() - AUTO_APPROVAL_DELAY_MS).toISOString();
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name')
    .in('name', OFFICE_ROLES);
  if (rolesError) throw rolesError;

  const roleIds = (roles || []).map((role) => role.id);
  if (!roleIds.length) return 0;

  const { data: pending, error: pendingError } = await supabase
    .from('users')
    .select('id, email, role_id')
    .in('role_id', roleIds)
    .eq('approval_status', 'pending')
    .eq('is_active', false)
    .lte('created_at', cutoff);
  if (pendingError) throw pendingError;

  for (const user of pending || []) {
    // Keep the pending condition on the update so an admin action that races
    // this worker is never overwritten.
    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: true,
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .eq('approval_status', 'pending')
      .eq('is_active', false)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (data) {
      writeAuditLog({
        action: 'auth.registration_auto_approved',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { delay_seconds: AUTO_APPROVAL_DELAY_MS / 1000, email: user.email },
      });
    }
  }
  return (pending || []).length;
};

const startOfficeAutoApprovalWorker = () => {
  const run = () => approveEligibleOfficeAccounts()
    .then((approved) => {
      if (approved) logger.info('Auto-approved pending office accounts', { approved });
    })
    .catch((err) => logger.error('Office auto-approval worker failed', { error: err.message }));

  run();
  const interval = setInterval(run, AUTO_APPROVAL_POLL_MS);
  interval.unref();
  return interval;
};

module.exports = {
  AUTO_APPROVAL_DELAY_MS,
  approveEligibleOfficeAccounts,
  startOfficeAutoApprovalWorker,
};
