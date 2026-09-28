const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema(
  {
    year:        { type: String, required: true, trim: true },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    order:       { type: Number, default: 0 },
    active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* Public fetch: active entries in display order. */
timelineEntrySchema.index({ active: 1, order: 1 });

module.exports = mongoose.model('TimelineEntry', timelineEntrySchema);
