const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Blog         = require('../models/Blog');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getAll = asyncHandler(async (req, res) => {
  const filter = req.query.drafts === 'true' ? {} : { published: true };
  const { rows, meta } = await paginate(Blog, filter, { publishedAt: -1 }, req.query, { path: 'author', select: 'name' });
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');
  const post = await Blog.findById(req.params.id).populate('author', 'name');
  if (!post) return sendError(res, 404, 'Post not found');
  sendResponse(res, 200, post);
});

exports.create = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content)
    return sendError(res, 400, 'Title and content are required');
  if (req.body.published) req.body.publishedAt = new Date();
  if (req.file) req.body.thumbnail = req.file.path;
  const post = await Blog.create({ ...req.body, author: req.user._id });
  sendResponse(res, 201, post, 'Post created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');
  if (req.body.published) req.body.publishedAt = new Date();
  if (req.file) req.body.thumbnail = req.file.path;
  const post = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!post) return sendError(res, 404, 'Post not found');
  sendResponse(res, 200, post, 'Post updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid post ID');
  const post = await Blog.findByIdAndDelete(req.params.id);
  if (!post) return sendError(res, 404, 'Post not found');
  sendResponse(res, 200, null, 'Post deleted');
});
