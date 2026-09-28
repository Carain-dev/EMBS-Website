const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Gallery      = require('../models/Gallery');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const isAdminRequest = (req) => req.query.drafts === 'true' || req.query.all === 'true' || /^Bearer /i.test(String(req.headers.authorization || ''));

const normalizeGalleryPayload = (payload = {}) => {
  const next = { ...payload };

  if (typeof next.title === 'string') next.title = next.title.trim();
  if (typeof next.caption === 'string') next.caption = next.caption.trim();
  if (typeof next.imageUrl === 'string') next.imageUrl = next.imageUrl.trim();

  if (Object.prototype.hasOwnProperty.call(next, 'published')) {
    next.published = normalizeBoolean(next.published);
  }

  if (next.published) {
    next.publishedAt = next.publishedAt ? new Date(next.publishedAt) : new Date();
  } else {
    next.publishedAt = null;
  }

  return next;
};

exports.getAll = asyncHandler(async (req, res) => {
  const eventFilter = req.query.event ? { event: req.query.event } : {};
  /* ?type=gallery|video narrows to a specific content type */
  const typeFilter  = req.query.type   ? { type: req.query.type }  : {};
  const filter = isAdminRequest(req)
    ? { ...eventFilter, ...typeFilter }
    : { ...eventFilter, ...typeFilter, published: true };
  const { rows, meta } = await paginate(Gallery, filter, { publishedAt: -1, order: 1, createdAt: -1 }, req.query, { path: 'event', select: 'title' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const item = await Gallery.findById(req.params.id).populate('event', 'title');
  if (!item) return sendError(res, 404, 'Gallery item not found');
  if (!isAdminRequest(req) && !item.published) {
    return sendError(res, 404, 'Gallery item not found');
  }
  sendResponse(res, 200, item);
});

exports.create = asyncHandler(async (req, res) => {
  const payload = normalizeGalleryPayload(req.body);
  const { title } = payload;
  if (!title) return sendError(res, 400, 'Title is required');

  /* For image-type items an image file or imageUrl is required.
     Video items only need a videoUrl, not an image upload. */
  const isVideo = payload.type === 'video';
  if (!isVideo && !req.file && !payload.imageUrl)
    return sendError(res, 400, 'An image is required');

  if (req.file) payload.imageUrl = req.file.path;
  const item = await Gallery.create(payload);
  sendResponse(res, 201, item, 'Gallery item created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const payload = normalizeGalleryPayload(req.body);
  if (req.file) payload.imageUrl = req.file.path;
  const item = await Gallery.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!item) return sendError(res, 404, 'Gallery item not found');
  sendResponse(res, 200, item, 'Gallery item updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const item = await Gallery.findByIdAndDelete(req.params.id);
  if (!item) return sendError(res, 404, 'Gallery item not found');
  sendResponse(res, 200, null, 'Gallery item deleted');
});
