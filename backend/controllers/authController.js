const asyncHandler   = require('express-async-handler');
const User           = require('../models/User');
const sendTokenCookie = require('../config/jwt');
const { sendResponse, sendError } = require('../utils/sendResponse');

/* ── Register ────────────────────────────────── */
const ALLOWED_ROLES = ['admin', 'editor', 'viewer'];

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password)
    return sendError(res, 400, 'Name, email and password are required');

  if (typeof email !== 'string' || typeof password !== 'string')
    return sendError(res, 400, 'Email and password must be strings');

  if (password.length < 8)
    return sendError(res, 400, 'Password must be at least 8 characters');

  /* Never take the role straight from the request body. The route already
     restricts this endpoint to admins, but validating here means a future
     routing change cannot silently reintroduce privilege escalation. */
  if (role !== undefined && !ALLOWED_ROLES.includes(role))
    return sendError(res, 400, 'Invalid role');

  const exists = await User.findOne({ email });
  if (exists) return sendError(res, 400, 'Email already registered');

  const user  = await User.create({ name, email, password, role: role || 'viewer' });
  const token = sendTokenCookie(res, user);

  sendResponse(res, 201, {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  }, 'Registered successfully');
});

/* ── Login ───────────────────────────────────── */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return sendError(res, 400, 'Email and password are required');

  /* Reject non-string input. Without this, a body like {"email":{"$gt":""}}
     reaches Mongo as a query operator rather than a value. */
  if (typeof email !== 'string' || typeof password !== 'string')
    return sendError(res, 400, 'Email and password must be strings');

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.correctPassword(password)))
    return sendError(res, 401, 'Invalid email or password');

  const token = sendTokenCookie(res, user);

  sendResponse(res, 200, {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  }, 'Logged in successfully');
});

/* ── Logout ──────────────────────────────────── */
exports.logout = (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  sendResponse(res, 200, null, 'Logged out successfully');
};

/* ── Get Current User ────────────────────────── */
exports.getMe = (req, res) => {
  const { _id, name, email, role, createdAt } = req.user;
  sendResponse(res, 200, { id: _id, name, email, role, createdAt });
};

/* ── Update Profile ──────────────────────────── */
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  if (req.body.password)
    return sendError(res, 400, 'Use /update-password to change your password');

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { name, email },
    { new: true, runValidators: true }
  );

  sendResponse(res, 200, {
    id: updated._id, name: updated.name, email: updated.email, role: updated.role,
  }, 'Profile updated');
});

/* ── Update Password ─────────────────────────── */
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return sendError(res, 400, 'Current password and new password are required');

  if (newPassword.length < 6)
    return sendError(res, 400, 'New password must be at least 6 characters');

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.correctPassword(currentPassword)))
    return sendError(res, 401, 'Current password is incorrect');

  user.password = newPassword;
  await user.save();

  const token = sendTokenCookie(res, user);
  sendResponse(res, 200, { token }, 'Password updated successfully');
});
