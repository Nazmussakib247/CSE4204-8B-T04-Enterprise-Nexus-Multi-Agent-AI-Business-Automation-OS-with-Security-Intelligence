const supabase = require('../config/supabase');

const REVENUE_STATUSES = new Set(['paid', 'shipped', 'delivered']);

/**
 * Aggregate booked storefront sales from orders without creating a fake
 * expense ledger entry. The checkout is mocked, but a paid mock order is
 * still business revenue for the Finance dashboard and Finance Agent.
 */
async function getStoreSalesSummary() {
  const { data, error } = await supabase
    .from('orders')
    .select('total, status, created_at');

  if (error) throw error;

  const bookedOrders = (data || []).filter((order) => REVENUE_STATUSES.has(order.status));
  const totalRevenue = bookedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const orderCount = bookedOrders.length;

  return {
    total_revenue: Math.round(totalRevenue * 100) / 100,
    order_count: orderCount,
    average_order_value: orderCount ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0,
  };
}

module.exports = { getStoreSalesSummary };
