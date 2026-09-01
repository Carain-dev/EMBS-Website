const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title:            { type: String, required: true, trim: true },
    type:             { type: String, default: '' },
    date:             { type: String, required: true },
    venue:            { type: String, default: '' },
    mode:             { type: String, enum: ['online', 'offline', 'hybrid'], default: 'offline' },
    speaker:          { type: String, default: '' },
    registrationLink: { type: String, default: '' },
    description:      { type: String, default: '' },
    tags:             [{ type: String }],
    thumbnail:        { type: String, default: '' },
    speakerPhoto:     { type: String, default: '' },
    status:           { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' },
    featured:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* Queried by status and sorted by date on the events page. */
eventSchema.index({ status: 1, date: -1 });
eventSchema.index({ featured: 1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
