const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    batch: { type: String, default: '' },
    photo: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    email: { type: String, default: '' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/* The directory lists active members in display order. */
memberSchema.index({ active: 1, order: 1 });

module.exports = mongoose.model('Member', memberSchema);
