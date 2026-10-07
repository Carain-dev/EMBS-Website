const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Blog         = require('../models/Blog');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const { resolveAdminView, denyMessage } = require('../utils/requestAuth');

/* The built-in admin login has the synthetic id 'admin', which is not a User
   ObjectId; storing it as `author` failed every save from the admin panel. */
const authorId = (req) => (req.user && mongoose.Types.ObjectId.isValid(req.user._id) ? req.user._id : undefined);

const normalizeBlogPayload = (payload = {}) => {
  const next = { ...payload };

  if (typeof next.title === 'string') next.title = next.title.trim();
  if (typeof next.content === 'string') next.content = next.content.trim();
  if (typeof next.excerpt === 'string') next.excerpt = next.excerpt.trim();
  if (typeof next.author === 'string') next.author = next.author.trim();

  if (Object.prototype.hasOwnProperty.call(next, 'published')) {
    next.published = normalizeBoolean(next.published);
  }

  if (Array.isArray(next.tags)) {
    next.tags = next.tags.map(tag => String(tag || '').trim()).filter(Boolean);
  } else if (typeof next.tags === 'string') {
    next.tags = next.tags.split(',').map(tag => tag.trim()).filter(Boolean);
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
  const prev = await Blog.findById(id).select('publishedAt').lean();
  payload.publishedAt = (prev && prev.publishedAt) || new Date();
};

exports.getAll = asyncHandler(async (req, res) => {
  const view = await resolveAdminView(req);
  if (view.deny) return sendError(res, view.deny, denyMessage(view.deny));
  const filter = view.admin ? {} : { published: true };
  const { rows, meta } = await paginate(Blog, filter, { publishedAt: -1, createdAt: -1 }, req.query, { path: 'author', select: 'name' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');
  const post = await Blog.findById(req.params.id).populate('author', 'name');
  if (!post) return sendError(res, 404, 'Post not found');

  if (!post.published && !(await resolveAdminView(req)).admin) {
    return sendError(res, 404, 'Post not found');
  }

  sendResponse(res, 200, post);
});

exports.create = asyncHandler(async (req, res) => {
  const payload = normalizeBlogPayload(req.body);
  const { title, content } = payload;
  if (!title || !content)
    return sendError(res, 400, 'Title and content are required');
  if (req.file) payload.thumbnail = req.file.path;
  if (payload.published && !payload.publishedAt) payload.publishedAt = new Date();
  if (payload.publishedAt === undefined) delete payload.publishedAt;
  if (authorId(req)) payload.author = authorId(req);
  const post = await Blog.create(payload);
  sendResponse(res, 201, post, 'Post created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');

  const payload = normalizeBlogPayload(req.body);
  if (req.file) payload.thumbnail = req.file.path;
  if (authorId(req) && !payload.author) payload.author = authorId(req);
  await keepPublishedAt(req.params.id, payload);

  const post = await Blog.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!post) return sendError(res, 404, 'Post not found');
  sendResponse(res, 200, post, 'Post updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');
  const post = await Blog.findByIdAndDelete(req.params.id);
  if (!post) return sendError(res, 404, 'Post not found');
  sendResponse(res, 200, null, 'Post deleted');
});
