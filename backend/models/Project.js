const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    thumbnail: { type: String, default: '' },

    // Drives the category filter chips on projects.html. Older records stored
    // the category in `tags[0]`, so the frontend falls back to that.
    category: { type: String, default: '', trim: true },

    status: {
      type: String,
      enum: ['ongoing', 'completed', 'published'],
      default: 'ongoing',
    },

    // Shown in the card meta rows and on the project detail page.
    mentor: { type: String, default: '', trim: true },
    teamMembers: [{ type: String, trim: true }],

    repoUrl: { type: String, default: '' },
    liveUrl: { type: String, default: '' },
    paperUrl: { type: String, default: '' },

    tags: [{ type: String }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Member' }],
    featured: { type: Boolean, default: false },

    visibility: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
    },
  },
  { timestamps: true }
);

/* Category chips filter on category; visibility hides drafts. */
projectSchema.index({ visibility: 1, createdAt: -1 });
projectSchema.index({ category: 1 });
projectSchema.index({ featured: 1 });

module.exports = mongoose.model('Project', projectSchema);
