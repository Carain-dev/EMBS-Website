const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title:            { type: String, required: true, trim: true },
    type:             { type: String, default: '' },
    date:             { type: String, required: true },
    time:             { type: String, default: '' },
    venue:            { type: String, default: '' },
    mode:             { type: String, enum: ['online', 'offline', 'hybrid'], default: 'offline' },
    speaker:          { type: String, default: '' },
    registrationLink: { type: String, default: '' },
    description:      { type: String, default: '' },
    tags:             [{ type: String }],
    thumbnail:        { type: String, default: '' },
    speakerPhoto:     { type: String, default: '' },
    status:           { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' },
    published:        { type: Boolean, default: false },
    featured:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

/* Queried by publication state and date on the public page, while keeping the
   existing status field for future-vs-past event categorization. */
eventSchema.index({ published: 1, status: 1, date: -1 });
eventSchema.index({ featured: 1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
