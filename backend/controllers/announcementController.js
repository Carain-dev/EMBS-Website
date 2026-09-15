const asyncHandler   = require('express-async-handler');
const mongoose       = require('mongoose');
const Announcement   = require('../models/Announcement');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getAll = asyncHandler(async (req, res) => {
  const items = await Announcement.find({
    $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
  }).sort({ pinned: -1, createdAt: -1 });
  sendResponse(res, 200, items);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid announcement ID');
  const item = await Announcement.findById(req.params.id);
  if (!item) return sendError(res, 404, 'Announcement not found');
  sendResponse(res, 200, item);
});

exports.create = asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body)
    return sendError(res, 400, 'Title and body are required');
  if (req.file) req.body.attachmentUrl = req.file.path;
  const item = await Announcement.create(req.body);
  sendResponse(res, 201, item, 'Announcement created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid announcement ID');
  if (req.file) req.body.attachmentUrl = req.file.path;
  const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, 'Announcement not found');
  sendResponse(res, 200, item, 'Announcement updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid announcement ID');
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, 'Announcement not found');
  sendResponse(res, 200, null, 'Announcement deleted');
});
