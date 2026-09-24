const asyncHandler  = require('express-async-handler');
const mongoose      = require('mongoose');
const Achievement   = require('../models/Achievement');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const isAdminRequest = (req) => /^Bearer /i.test(String(req.headers.authorization || '')) || req.query.all === 'true';

const normalizeAchievementPayload = (payload = {}) => {
  const next = { ...payload };

  if (typeof next.title === 'string') next.title = next.title.trim();
  if (typeof next.description === 'string') next.description = next.description.trim();
  if (typeof next.category === 'string') next.category = next.category.trim();
  if (typeof next.date === 'string') next.date = next.date.trim();

  if (Object.prototype.hasOwnProperty.call(next, 'featured')) {
    next.featured = normalizeBoolean(next.featured);
  }

  return next;
};

exports.getAll = asyncHandler(async (req, res) => {
  const filter = isAdminRequest(req) ? {} : { featured: true };
  const { rows, meta } = await paginate(Achievement, filter, { date: -1 }, req.query);
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid achievement ID');
  const item = await Achievement.findById(req.params.id);
  if (!item) return sendError(res, 404, 'Achievement not found');
  if (!isAdminRequest(req) && !item.featured) return sendError(res, 404, 'Achievement not found');
  sendResponse(res, 200, item);
});

exports.create = asyncHandler(async (req, res) => {
  const payload = normalizeAchievementPayload(req.body);
  const { title } = payload;
  if (!title) return sendError(res, 400, 'Title is required');
  if (req.file) payload.image = req.file.path;
  const item = await Achievement.create(payload);
  sendResponse(res, 201, item, 'Achievement created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid achievement ID');
  const payload = normalizeAchievementPayload(req.body);
  if (req.file) payload.image = req.file.path;
  const item = await Achievement.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, 'Achievement not found');
  sendResponse(res, 200, item, 'Achievement updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid achievement ID');
  const item = await Achievement.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, 'Achievement not found');
  sendResponse(res, 200, null, 'Achievement deleted');
});
