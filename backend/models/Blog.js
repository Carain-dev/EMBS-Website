const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    excerpt: { type: String, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    thumbnail: { type: String, default: '' },
    tags: [{ type: String }],
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

/* The public listing filters on published and sorts newest first. */
blogSchema.index({ published: 1, publishedAt: -1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
