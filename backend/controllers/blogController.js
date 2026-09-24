const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Blog         = require('../models/Blog');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const isAdminRequest = (req) => req.query.drafts === 'true' || req.query.all === 'true' || /^Bearer /i.test(String(req.headers.authorization || ''));

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

  if (next.published) {
    next.publishedAt = next.publishedAt ? new Date(next.publishedAt) : new Date();
  } else {
    next.publishedAt = null;
  }

  return next;
};

exports.getAll = asyncHandler(async (req, res) => {
  const isAdmin = isAdminRequest(req);
  const filter = isAdmin ? {} : { published: true };
  const { rows, meta } = await paginate(Blog, filter, { publishedAt: -1, createdAt: -1 }, req.query, { path: 'author', select: 'name' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');
  const post = await Blog.findById(req.params.id).populate('author', 'name');
  if (!post) return sendError(res, 404, 'Post not found');

  if (!isAdminRequest(req) && !post.published) {
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
  if (req.user && req.user._id) payload.author = req.user._id;
  const post = await Blog.create(payload);
  sendResponse(res, 201, post, 'Post created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');

  const payload = normalizeBlogPayload(req.body);
  if (req.file) payload.thumbnail = req.file.path;
  if (req.user && req.user._id && !payload.author) payload.author = req.user._id;

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
