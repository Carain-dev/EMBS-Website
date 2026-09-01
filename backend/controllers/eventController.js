const Event = require('../models/Event');
const { paginate } = require('../utils/paginate');
const mongoose = require('mongoose');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.getEvents = async (req, res, next) => {
  try {
    const { rows, meta } = await paginate(Event, {}, { createdAt: -1 }, req.query);
    res.status(200).json({ success: true, data: rows, ...(meta && { meta }) });
  } catch (err) { next(err); }
};

exports.getEvent = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.status(200).json({ success: true, data: event });
  } catch (err) { next(err); }
};

exports.createEvent = async (req, res, next) => {
  try {
    const { title, date } = req.body;
    if (!title || !date)
      return res.status(400).json({ success: false, message: 'title and date are required' });

    if (req.files?.thumbnail)    req.body.thumbnail    = req.files.thumbnail[0].path;
    if (req.files?.speakerPhoto)  req.body.speakerPhoto = req.files.speakerPhoto[0].path;

    const event = await Event.create(req.body);
    res.status(201).json({ success: true, data: event });
  } catch (err) { next(err); }
};

exports.updateEvent = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    if (req.files?.thumbnail)    req.body.thumbnail    = req.files.thumbnail[0].path;
    if (req.files?.speakerPhoto)  req.body.speakerPhoto = req.files.speakerPhoto[0].path;
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
