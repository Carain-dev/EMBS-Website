const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendError } = require('../utils/sendResponse');

const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) return sendError(res, 401, 'Not authenticated');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* The hardcoded admin login (ADMIN_PASSWORD bypass in authController)
       issues a token with id: 'admin' — a synthetic value that is not a
       MongoDB ObjectId. Passing it to User.findById() either throws a
       CastError or returns null, both of which cause a spurious 401 on
       every subsequent protected request.

       Detect this case and reconstruct req.user from the token payload
       directly, without a DB round-trip. All other users still go through
       the normal DB lookup path. */
    if (decoded.id === 'admin') {
      req.user = { _id: 'admin', name: 'EMBS Admin', email: 'admin@ieeoembs.com', role: decoded.role || 'admin' };
      return next();
    }

    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return sendError(res, 401, 'User no longer exists');

    next();
  } catch {
    sendError(res, 401, 'Invalid or expired token');
  }
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return sendError(res, 403, 'You do not have permission');
  next();
};

module.exports = { protect, restrictTo };
