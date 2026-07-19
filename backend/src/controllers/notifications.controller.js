const supabase = require('../config/supabase');

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (unread_only === 'true') query = query.eq('read', false);

    const { data, error, count } = await query;
    if (error) throw error;

    const unreadCount = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    res.json({ data, total: count, unread_count: unreadCount.count ?? 0, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false);

    if (error) throw error;
    res.json({ message: 'All marked as read' });
  } catch (err) {
    next(err);
  }
};

// Helper used by other controllers to create a notification
const createNotification = async ({ userId, type = 'info', title, message, link }) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type, title, message, link });
  } catch {
    // Non-fatal — never let notification creation break the main flow
  }
};

module.exports = { getNotifications, markRead, markAllRead, createNotification };
