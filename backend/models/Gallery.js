const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    caption: { type: String, default: '' },
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    /* type: 'gallery' = event photo grid; 'video' = highlighted video.
       Defaults to 'gallery' so all existing records are unaffected. */
    type: { type: String, enum: ['gallery', 'video'], default: 'gallery' },
    /* videoUrl: YouTube or other video URL for type='video' items. */
    videoUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

gallerySchema.index({ published: 1, publishedAt: -1, createdAt: -1 });
gallerySchema.index({ order: 1, createdAt: -1 });
gallerySchema.index({ event: 1 });
gallerySchema.index({ type: 1, published: 1, order: 1 });

module.exports = mongoose.model('Gallery', gallerySchema);
