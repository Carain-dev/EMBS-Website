const asyncHandler = require('express-async-handler');
const mongoose     = require('mongoose');
const Podcast      = require('../models/Podcast');
const { paginate } = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getAll = asyncHandler(async (req, res) => {
  const { rows, meta } = await paginate(Podcast, {}, { episodeNumber: -1 }, req.query);
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid episode ID');
  const episode = await Podcast.findById(req.params.id);
  if (!episode) return sendError(res, 404, 'Episode not found');
  sendResponse(res, 200, episode);
});

exports.create = asyncHandler(async (req, res) => {
  const { title, episodeNumber } = req.body;
  if (!title || !episodeNumber)
    return sendError(res, 400, 'Title and episode number are required');
  if (req.file) req.body.thumbnail = req.file.path;
  const episode = await Podcast.create(req.body);
  sendResponse(res, 201, episode, 'Episode created');
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid episode ID');
  if (req.file) req.body.thumbnail = req.file.path;
  const episode = await Podcast.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!episode) return sendError(res, 404, 'Episode not found');
  sendResponse(res, 200, episode, 'Episode updated');
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid episode ID');
  const episode = await Podcast.findByIdAndDelete(req.params.id);
  if (!episode) return sendError(res, 404, 'Episode not found');
  sendResponse(res, 200, null, 'Episode deleted');
});
