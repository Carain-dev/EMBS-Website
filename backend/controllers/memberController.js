const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Member       = require('../models/Member');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/* ── Get All Members ─────────────────────────── */
exports.getAll = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { active: true };
  const { rows, meta } = await paginate(Member, filter, { order: 1 }, req.query);
  sendResponse(res, 200, rows, 'Success', meta);
});

/* ── Get Single Member ───────────────────────── */
exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid member ID');

  const member = await Member.findById(req.params.id);
  if (!member) return sendError(res, 404, 'Member not found');

  sendResponse(res, 200, member);
});

/* ── Create Member ───────────────────────────── */
exports.create = asyncHandler(async (req, res) => {
  const { name, role } = req.body;
  if (!name || !role)
    return sendError(res, 400, 'Name and role are required');

  if (req.file) req.body.photo = req.file.path;

  const member = await Member.create(req.body);
  sendResponse(res, 201, member, 'Member created');
});

/* ── Update Member ───────────────────────────── */
exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid member ID');

  if (req.file) req.body.photo = req.file.path;

  const member = await Member.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  if (!member) return sendError(res, 404, 'Member not found');

  sendResponse(res, 200, member, 'Member updated');
});

/* ── Delete Member ───────────────────────────── */
exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid member ID');

  const member = await Member.findByIdAndDelete(req.params.id);
  if (!member) return sendError(res, 404, 'Member not found');

  sendResponse(res, 200, null, 'Member deleted');
});
