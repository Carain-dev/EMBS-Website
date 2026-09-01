const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    date: { type: String, default: '' },
    image: { type: String, default: '' },
    category: { type: String, default: '' },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

achievementSchema.index({ featured: 1, date: -1 });
achievementSchema.index({ category: 1 });

module.exports = mongoose.model('Achievement', achievementSchema);
