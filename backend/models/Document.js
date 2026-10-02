const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: '' },
    fileUrl: { type: String, required: true },
    originalFilename: { type: String, default: '' },  /* original uploaded filename, e.g. EMBS_Brochure_2025.pdf */
    mimeType: { type: String, default: '' },
    public: { type: Boolean, default: true },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

documentSchema.index({ published: 1, public: 1, order: 1, createdAt: -1 });
documentSchema.index({ category: 1 });

module.exports = mongoose.model('Document', documentSchema);
