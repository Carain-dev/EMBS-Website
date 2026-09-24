const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    caption: { type: String, default: '' },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

gallerySchema.index({ published: 1, publishedAt: -1, createdAt: -1 });
gallerySchema.index({ order: 1, createdAt: -1 });
gallerySchema.index({ event: 1 });

module.exports = mongoose.model('Gallery', gallerySchema);
