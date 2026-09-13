const supabase = require('../config/supabase');
const { writeAuditLog } = require('../utils/audit');

const getActiveAdminCount = async () => {
  const { count, error } = await supabase
    .from('users')
    .select('id, roles!inner(name)', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('roles.name', 'admin');
  if (error) throw error;
  return count || 0;
};

const getTargetUser = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, is_active, approval_status, role_id, roles(name)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data;
};

// GET /api/admin/users
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, name, email, is_active, approval_status, approved_at, created_at, role_id, roles(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/approve
const approveUser = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'reason is required for approval' });

    const target = await getTargetUser(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.approval_status === 'approved' && target.is_active) {
      return res.status(400).json({ error: 'Account is already approved' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: true,
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: req.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('id, name, email, is_active, approval_status, roles(name)')
      .single();
    if (error) throw error;

    writeAuditLog({
      userId: req.user.id,
      action: 'admin.user.approve',
      resourceType: 'user',
      resourceId: req.params.id,
      metadata: { requested_role: target.roles?.name || null, reason: String(reason).trim() },
      req,
    });
    res.json({ message: 'Account approved', data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res, next) => {
  try {
    const { role, reason } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'reason is required for role changes' });

    const target = await getTargetUser(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const { data: roleRow, error: roleErr } = await supabase
      .from('roles').select('id').eq('name', role).single();

    if (roleErr || !roleRow) return res.status(400).json({ error: `Role '${role}' not found` });

    const oldRole = target.roles?.name || null;
    if (oldRole === role) return res.json({ message: 'Role unchanged', data: target });
    if (req.params.id === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot remove your own admin access' });
    }
    if (target.is_active && oldRole === 'admin' && role !== 'admin' && await getActiveAdminCount() <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last active admin' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role_id: roleRow.id, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, name, email, is_active, roles(name)')
      .single();

    if (error) throw error;
    writeAuditLog({
      userId: req.user.id,
      action: 'admin.user.role_change',
      resourceType: 'user',
      resourceId: req.params.id,
      metadata: { old_role: oldRole, new_role: role, reason: String(reason).trim() },
      req,
    });

    res.json({ message: 'Role updated', data });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/status
const toggleUserStatus = async (req, res, next) => {
  try {
    const { is_active, reason } = req.body;
    if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active (boolean) required' });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'reason is required for access changes' });

    const target = await getTargetUser(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Prevent self-deactivation
    if (req.params.id === req.user.id && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    if (!is_active && target.is_active && target.roles?.name === 'admin' && await getActiveAdminCount() <= 1) {
      return res.status(400).json({ error: 'Cannot deactivate the last active admin' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, name, email, is_active, roles(name)')
      .single();

    if (error) throw error;
    // Revoke all sessions if deactivating
    if (!is_active) {
      await supabase.from('user_sessions').delete().eq('user_id', req.params.id);
    }

    writeAuditLog({
      userId: req.user.id,
      action: is_active ? 'admin.user.activate' : 'admin.user.deactivate',
      resourceType: 'user',
      resourceId: req.params.id,
      metadata: { old_is_active: target.is_active, new_is_active: is_active, old_role: target.roles?.name || null, reason: String(reason).trim() },
      req,
    });

    res.json({ message: `User ${is_active ? 'activated' : 'deactivated'}`, data });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/roles
const listRoles = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('roles').select('id, name, description').order('name');
    if (error) throw error;
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, updateUserRole, toggleUserStatus, approveUser, listRoles };
