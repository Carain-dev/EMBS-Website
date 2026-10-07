const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Gallery      = require('../models/Gallery');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const { resolveAdminView, denyMessage } = require('../utils/requestAuth');

const normalizeGalleryPayload = (payload = {}) => {
  const next = { ...payload };

  if (typeof next.title === 'string') next.title = next.title.trim();
  if (typeof next.caption === 'string') next.caption = next.caption.trim();
  if (typeof next.imageUrl === 'string') next.imageUrl = next.imageUrl.trim();

  if (Object.prototype.hasOwnProperty.call(next, 'published')) {
    next.published = normalizeBoolean(next.published);
  }

  /* Only touch publishedAt when the request sets `published`. A partial update
     (e.g. just a caption) used to null it, and every re-save of a published
     item reset it to "now". The update handler keeps the original date. */
  if (Object.prototype.hasOwnProperty.call(next, 'published')) {
    if (!next.published) next.publishedAt = null;
    else if (next.publishedAt) next.publishedAt = new Date(next.publishedAt);
    else next.publishedAt = undefined;
  }

  return next;
};

/* Re-publishing keeps the first publish date; publishing a draft stamps now. */
const keepPublishedAt = async (id, payload) => {
  if (!payload.published || payload.publishedAt) {
    if (payload.publishedAt === undefined) delete payload.publishedAt;
    return;
  }
  const prev = await Gallery.findById(id).select('publishedAt').lean();
  payload.publishedAt = (prev && prev.publishedAt) || new Date();
};

exports.getAll = asyncHandler(async (req, res) => {
  /* Query values must be plain strings: `?event[$ne]=x` arrives as an object
     and would otherwise be applied as a Mongo operator, and a malformed id
     surfaced Mongoose's internal CastError as a 500. */
  const { event, type } = req.query;
  if (event !== undefined && (typeof event !== 'string' || !isValidId(event)))
    return sendError(res, 400, 'Invalid event ID');
  if (type !== undefined && typeof type !== 'string')
    return sendError(res, 400, 'Invalid type');
  const eventFilter = event ? { event } : {};
  /* ?type=gallery|video narrows to a specific content type */
  const typeFilter  = type   ? { type }  : {};
  const view = await resolveAdminView(req);
  if (view.deny) return sendError(res, view.deny, denyMessage(view.deny));
  const filter = view.admin
    ? { ...eventFilter, ...typeFilter }
    : { ...eventFilter, ...typeFilter, published: true };
  const { rows, meta } = await paginate(Gallery, filter, { publishedAt: -1, order: 1, createdAt: -1 }, req.query, { path: 'event', select: 'title' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const item = await Gallery.findById(req.params.id).populate('event', 'title');
  if (!item) return sendError(res, 404, 'Gallery item not found');
  if (!item.published && !(await resolveAdminView(req)).admin) {
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
  if (payload.published && !payload.publishedAt) payload.publishedAt = new Date();
  if (payload.publishedAt === undefined) delete payload.publishedAt;
  const item = await Gallery.create(payload);
  sendResponse(res, 201, item, 'Gallery item created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid gallery item ID');
  const payload = normalizeGalleryPayload(req.body);
  if (req.file) payload.imageUrl = req.file.path;
  await keepPublishedAt(req.params.id, payload);
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
