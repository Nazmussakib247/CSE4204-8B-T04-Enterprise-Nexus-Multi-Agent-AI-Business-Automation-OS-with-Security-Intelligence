const UserModel          = require('../models/User');
const { success, error, paginate } = require('../utils/response');

/** GET /api/users/me */
const getProfile = async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) return error(res, 'User not found', 404);
  return success(res, { user });
};

/** PUT /api/users/me */
const updateProfile = async (req, res) => {
  const { name, email } = req.body;
  const updated = await UserModel.update(req.user.id, { name, email });
  return success(res, { user: updated });
};

/** PUT /api/users/me/password */
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return error(res, 'current_password and new_password are required', 400);

  const user = await UserModel.findByEmail(req.user.email);
  const valid = await UserModel.comparePassword(current_password, user.password_hash);
  if (!valid) return error(res, 'Current password is incorrect', 400);

  if (new_password.length < 8)
    return error(res, 'New password must be at least 8 characters', 400);

  await UserModel.updatePassword(req.user.id, new_password);
  return success(res, {}, 'Password updated successfully');
};

// ── ADMIN ONLY ─────────────────────────────────────────────────────────────

/** GET /api/users  (admin) */
const listUsers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pag = paginate(page, limit);
  const { data, total } = await UserModel.findAll(pag);
  return success(res, { users: data, meta: pag.meta(total) });
};

/** GET /api/users/:id  (admin) */
const getUserById = async (req, res) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) return error(res, 'User not found', 404);
  return success(res, { user });
};

/** PUT /api/users/:id  (admin) */
const updateUser = async (req, res) => {
  const { name, email, role, is_active } = req.body;
  let roleId;
  if (role) {
    roleId = await UserModel.getRoleIdByName(role);
    if (!roleId) return error(res, `Role "${role}" not found`, 400);
  }
  const updated = await UserModel.update(req.params.id, { name, email, roleId, isActive: is_active });
  if (!updated) return error(res, 'User not found', 404);
  return success(res, { user: updated });
};

/** DELETE /api/users/:id  (admin) */
const deleteUser = async (req, res) => {
  // Prevent self-deletion
  if (req.params.id === req.user.id)
    return error(res, 'Cannot delete your own account', 400);

  const deleted = await UserModel.delete(req.params.id);
  if (!deleted) return error(res, 'User not found', 404);
  return success(res, {}, 'User deleted');
};

module.exports = { getProfile, updateProfile, changePassword, listUsers, getUserById, updateUser, deleteUser };
