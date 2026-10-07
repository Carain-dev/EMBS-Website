const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/* Public GET endpoints serve two audiences: visitors (published content only)
   and the admin panel (drafts too). The admin view used to be granted to any
   request that merely *looked* authenticated — `?all=true`, `?drafts=true` or
   any `Authorization: Bearer …` header — without checking the token, so anyone
   could read unpublished content. These helpers verify the token the same way
   `protect` does before the admin view is granted. */

const STAFF_ROLES = ['admin', 'editor'];

const tokensFrom = (req) => {
  const out = [];
  if (req.cookies && req.cookies.token) out.push(req.cookies.token);
  const h = String(req.headers.authorization || '');
  if (/^Bearer /i.test(h)) out.push(h.slice(7).trim());
  return out.filter(Boolean);
};

/* Role of the caller from a valid, unexpired token whose user still exists;
   null for anonymous or invalid credentials. Never throws. */
const getRequestRole = async (req) => {
  if (req._authRole !== undefined) return req._authRole;
  let role = null;
  for (const token of tokensFrom(req)) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      /* Built-in admin login (see authController / authMiddleware). */
      if (decoded.id === 'admin') { role = decoded.role || 'admin'; break; }
      const user = await User.findById(decoded.id).select('role').lean();
      if (user) { role = user.role; break; }
    } catch { /* invalid or expired token: try the next one */ }
  }
  req._authRole = role;
  return role;
};

/* Decide whether a public GET should return the admin view.
     flags   — query flags this endpoint has always used to ask for drafts
     header  — whether a Bearer token alone has always asked for it
   Returns { admin: true } for verified staff, { admin: false } for the public
   view, or { admin: false, deny: 401|403 } when the caller explicitly asked
   for drafts without valid staff credentials. */
const resolveAdminView = async (req, { flags = ['all', 'drafts'], header = true } = {}) => {
  const flagged = flags.some((f) => req.query[f] === 'true');
  const hasCredential = tokensFrom(req).length > 0;
  if (!flagged && !(header && hasCredential)) return { admin: false };

  const role = await getRequestRole(req);
  if (STAFF_ROLES.includes(role)) return { admin: true };
  if (flagged) return { admin: false, deny: role ? 403 : 401 };
  return { admin: false };
};

const denyMessage = (code) => (code === 403 ? 'You do not have permission' : 'Not authenticated');

module.exports = { getRequestRole, resolveAdminView, denyMessage, STAFF_ROLES };
