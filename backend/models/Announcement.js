const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },

    /* Optional destination for the "Apply Now" button, e.g. a Google Form for
       recruitment or a registration page. The frontend referenced this field
       before it existed, so the button always fell back to href="#". */
    link: { type: String, default: '' },

    pinned: { type: Boolean, default: false },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

/* getAll filters on expiresAt and sorts pinned first. */
announcementSchema.index({ expiresAt: 1 });
announcementSchema.index({ pinned: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
