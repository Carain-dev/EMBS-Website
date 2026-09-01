const asyncHandler  = require('express-async-handler');
const mongoose      = require('mongoose');
const Achievement   = require('../models/Achievement');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await paginate(Achievement, {}, { date: -1 }, req.query);
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid achievement ID');
  const item = await Achievement.findById(req.params.id);
  if (!item) return sendError(res, 404, 'Achievement not found');
  sendResponse(res, 200, item);
});

exports.create = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');
  if (req.file) req.body.image = req.file.path;
  const item = await Achievement.create(req.body);
  sendResponse(res, 201, item, 'Achievement created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid achievement ID');
  if (req.file) req.body.image = req.file.path;
  const item = await Achievement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, 'Achievement not found');
  sendResponse(res, 200, item, 'Achievement updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid achievement ID');
  const item = await Achievement.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, 'Achievement not found');
  sendResponse(res, 200, null, 'Achievement deleted');
});
