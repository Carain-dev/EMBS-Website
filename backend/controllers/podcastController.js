const asyncHandler      = require('express-async-handler');
const mongoose          = require('mongoose');
const Podcast           = require('../models/Podcast');
const { paginate }      = require('../utils/paginate');
const { sendResponse, sendError } = require('../utils/sendResponse');
const notifySubscribers = require('../utils/notifySubscribers');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1' || value === 'yes' || value === 'on';
const isAdminRequest = (req) => req.query.drafts === 'true' || req.query.all === 'true' || /^Bearer /i.test(String(req.headers.authorization || ''));

const normalizePodcastPayload = (payload = {}) => {
  const next = { ...payload };

  if (typeof next.title === 'string') next.title = next.title.trim();
  if (typeof next.description === 'string') next.description = next.description.trim();
  if (typeof next.guestName === 'string') next.guestName = next.guestName.trim();
  if (typeof next.guestDesignation === 'string') next.guestDesignation = next.guestDesignation.trim();
  if (typeof next.duration === 'string') next.duration = next.duration.trim();
  if (typeof next.audioUrl === 'string') next.audioUrl = next.audioUrl.trim();
  if (typeof next.spotifyUrl === 'string') next.spotifyUrl = next.spotifyUrl.trim();
  if (typeof next.youtubeUrl === 'string') next.youtubeUrl = next.youtubeUrl.trim();

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
  const isAdmin = isAdminRequest(req);
  const filter = isAdmin ? {} : { published: true };
  const { rows, meta } = await paginate(Podcast, filter, { publishedAt: -1, episodeNumber: -1 }, req.query);
  sendResponse(res, 200, rows, 'Success', meta);
});

exports.getOne = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid episode ID');
  const episode = await Podcast.findById(req.params.id);
  if (!episode) return sendError(res, 404, 'Episode not found');
  if (!isAdminRequest(req) && !episode.published) {
    return sendError(res, 404, 'Episode not found');
  }
  sendResponse(res, 200, episode);
});

exports.create = asyncHandler(async (req, res) => {
  const payload = normalizePodcastPayload(req.body);
  const { title, episodeNumber } = payload;
  if (!title || !episodeNumber)
    return sendError(res, 400, 'Title and episode number are required');
  if (req.file) payload.thumbnail = req.file.path;
  const episode = await Podcast.create(payload);
  sendResponse(res, 201, episode, 'Episode created');

  /* Fire-and-forget: notify subscribers only when created as published */
  if (episode.published) notifySubscribers('podcast', episode.toObject ? episode.toObject() : episode);
});

exports.update = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid episode ID');
  const payload = normalizePodcastPayload(req.body);
  if (req.file) payload.thumbnail = req.file.path;

  /* Read previous published state before overwriting */
  const prev = await Podcast.findById(req.params.id).select('published').lean();
  const wasPublished = prev ? prev.published : false;

  const episode = await Podcast.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!episode) return sendError(res, 404, 'Episode not found');
  sendResponse(res, 200, episode, 'Episode updated');

  /* Notify only on draft → published transition */
  if (!wasPublished && episode.published) {
    notifySubscribers('podcast', episode.toObject ? episode.toObject() : episode);
  }
});

exports.remove = asyncHandler(async (req, res) => {
  if (!isValidId(req.params.id)) return sendError(res, 400, 'Invalid episode ID');
  const episode = await Podcast.findByIdAndDelete(req.params.id);
  if (!episode) return sendError(res, 404, 'Episode not found');
  sendResponse(res, 200, null, 'Episode deleted');
});
