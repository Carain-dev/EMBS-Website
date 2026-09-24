const Event = require('../models/Event');
const { paginate } = require('../utils/paginate');
const mongoose = require('mongoose');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const hasAdminHeader = (req) => /^Bearer /i.test(String(req.headers.authorization || '')) || req.query.all === 'true';

exports.getEvents = async (req, res, next) => {
  try {
    const filter = req.query.all === 'true' ? {} : { published: true };
    const { rows, meta } = await paginate(Event, filter, { createdAt: -1 }, req.query);
    res.status(200).json({ success: true, data: rows, ...(meta && { meta }) });
  } catch (err) { next(err); }
};

exports.getEvent = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid event ID' });

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const isAdminRequest = hasAdminHeader(req);
    if (!isAdminRequest && !event.published)
      return res.status(404).json({ success: false, message: 'Event not found' });

    res.status(200).json({ success: true, data: event });
  } catch (err) { next(err); }
};

exports.createEvent = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    const { title, date } = payload;
    if (!title || !date)
      return res.status(400).json({ success: false, message: 'title and date are required' });

    payload.published = normalizeBoolean(payload.published);
    payload.status = payload.status || (new Date(date) > new Date() ? 'upcoming' : 'completed');

    if (req.files?.thumbnail)    payload.thumbnail    = req.files.thumbnail[0].path;
    if (req.files?.speakerPhoto) payload.speakerPhoto = req.files.speakerPhoto[0].path;

    const event = await Event.create(payload);
    res.status(201).json({ success: true, data: event });
  } catch (err) { next(err); }
};

exports.updateEvent = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid event ID' });

    const payload = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(payload, 'published'))
      payload.published = normalizeBoolean(payload.published);
    if (payload.date && !payload.status)
      payload.status = new Date(payload.date) > new Date() ? 'upcoming' : 'completed';
    if (req.files?.thumbnail)    payload.thumbnail    = req.files.thumbnail[0].path;
    if (req.files?.speakerPhoto) payload.speakerPhoto = req.files.speakerPhoto[0].path;

    const event = await Event.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.status(200).json({ success: true, data: event });
  } catch (err) { next(err); }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.status(200).json({ success: true, message: 'Event deleted' });
  } catch (err) { next(err); }
};
