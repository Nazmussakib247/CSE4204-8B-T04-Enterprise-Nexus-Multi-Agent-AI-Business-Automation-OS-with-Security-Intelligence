const supabase = require('../config/supabase');
const { writeAuditLog } = require('../utils/audit');

// GET /api/admin/users
const listUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('id, name, email, is_active, created_at, role_id, roles(name)', { count: 'exact' })
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

// PATCH /api/admin/users/:id/role
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });

    const { data: roleRow, error: roleErr } = await supabase
      .from('roles').select('id').eq('name', role).single();

    if (roleErr || !roleRow) return res.status(400).json({ error: `Role '${role}' not found` });

    const { data, error } = await supabase
      .from('users')
      .update({ role_id: roleRow.id, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, name, email, is_active, roles(name)')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });

    writeAuditLog({
      userId: req.user.id,
      action: 'admin.user.role_change',
      resourceType: 'user',
      resourceId: req.params.id,
      metadata: { new_role: role },
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
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active (boolean) required' });

    // Prevent self-deactivation
    if (req.params.id === req.user.id && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, name, email, is_active, roles(name)')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'User not found' });

    // Revoke all sessions if deactivating
    if (!is_active) {
      await supabase.from('user_sessions').delete().eq('user_id', req.params.id);
    }

    writeAuditLog({
      userId: req.user.id,
      action: is_active ? 'admin.user.activate' : 'admin.user.deactivate',
      resourceType: 'user',
      resourceId: req.params.id,
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

module.exports = { listUsers, updateUserRole, toggleUserStatus, listRoles };
