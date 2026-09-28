const asyncHandler    = require('express-async-handler');
const mongoose        = require('mongoose');
const TimelineEntry   = require('../models/TimelineEntry');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeBoolean = (v) =>
  v === true || v === 'true' || v === 1 || v === '1' || v === 'on' || v === 'yes';

const isAdminRequest = (req) =>
  /^Bearer /i.test(String(req.headers.authorization || '')) ||
  req.query.all === 'true';

/* ── Normalize payload ────────────────────────── */
const normalizePayload = (body = {}) => {
  const next = { ...body };
  if (typeof next.year        === 'string') next.year        = next.year.trim();
  if (typeof next.title       === 'string') next.title       = next.title.trim();
  if (typeof next.description === 'string') next.description = next.description.trim();
  if (next.order !== undefined)             next.order       = Number(next.order) || 0;
  if (Object.prototype.hasOwnProperty.call(next, 'active')) {
    next.active = normalizeBoolean(next.active);
  }
  return next;
};

/* ── GET all — public: active only; admin: all ── */
exports.getAll = asyncHandler(async (req, res) => {
  const filter = isAdminRequest(req) ? {} : { active: true };
  const entries = await TimelineEntry.find(filter).sort({ order: 1, year: 1 });
  sendResponse(res, 200, entries, 'Success');
});

/* ── GET single ──────────────────────────────── */
exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid timeline entry ID');

  const entry = await TimelineEntry.findById(req.params.id);
  if (!entry) return sendError(res, 404, 'Timeline entry not found');

  if (!isAdminRequest(req) && !entry.active)
    return sendError(res, 404, 'Timeline entry not found');

  sendResponse(res, 200, entry);
});

/* ── POST — create ───────────────────────────── */
exports.create = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);
  if (!payload.year)  return sendError(res, 400, 'Year is required');
  if (!payload.title) return sendError(res, 400, 'Title is required');

  const entry = await TimelineEntry.create(payload);
  sendResponse(res, 201, entry, 'Timeline entry created');
});

/* ── PATCH — update ──────────────────────────── */
exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid timeline entry ID');

  const payload = normalizePayload(req.body);

  const entry = await TimelineEntry.findByIdAndUpdate(
    req.params.id,
    payload,
    { new: true, runValidators: true }
  );
  if (!entry) return sendError(res, 404, 'Timeline entry not found');

  sendResponse(res, 200, entry, 'Timeline entry updated');
});

/* ── DELETE ──────────────────────────────────── */
exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id))
    return sendError(res, 400, 'Invalid timeline entry ID');

  const entry = await TimelineEntry.findByIdAndDelete(req.params.id);
  if (!entry) return sendError(res, 404, 'Timeline entry not found');

  sendResponse(res, 200, null, 'Timeline entry deleted');
});
