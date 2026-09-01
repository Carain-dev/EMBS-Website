const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    caption: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

gallerySchema.index({ order: 1, createdAt: -1 });
gallerySchema.index({ event: 1 });

module.exports = mongoose.model('Gallery', gallerySchema);
