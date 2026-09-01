const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Gallery      = require('../models/Gallery');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getAll = asyncHandler(async (req, res) => {
  const query = req.query.event ? { event: req.query.event } : {};
  const { rows, meta } = await paginate(Gallery, query, { order: 1 }, req.query, { path: 'event', select: 'title' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const item = await Gallery.findById(req.params.id).populate('event', 'title');
  if (!item) return sendError(res, 404, 'Gallery item not found');
  sendResponse(res, 200, item);
});

exports.create = asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) return sendError(res, 400, 'Title is required');
  if (!req.file && !req.body.imageUrl)
    return sendError(res, 400, 'An image is required');
  if (req.file) req.body.imageUrl = req.file.path;   // Cloudinary secure URL
  const item = await Gallery.create(req.body);
  sendResponse(res, 201, item, 'Gallery item created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  if (req.file) req.body.imageUrl = req.file.path;   // Cloudinary secure URL
  const item = await Gallery.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, 'Gallery item not found');
  sendResponse(res, 200, item, 'Gallery item updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const item = await Gallery.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, 'Gallery item not found');
  sendResponse(res, 200, null, 'Gallery item deleted');
});
