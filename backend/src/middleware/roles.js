/** Central role policy definitions for the office surface. */
const OFFICE_ROLES = Object.freeze(['admin', 'manager']);

const isOfficeUser = (user) => OFFICE_ROLES.includes(user?.role);

module.exports = { OFFICE_ROLES, isOfficeUser };
