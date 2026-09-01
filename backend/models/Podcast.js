const mongoose = require('mongoose');

const podcastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    episodeNumber: { type: Number, required: true },
    duration: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    audioUrl:          { type: String, default: '' },
    spotifyUrl:        { type: String, default: '' },
    youtubeUrl:        { type: String, default: '' },
    guestName:         { type: String, default: '' },
    guestDesignation:  { type: String, default: '' },
    publishedAt:       { type: String, default: '' },
  },
  { timestamps: true }
);

podcastSchema.index({ episodeNumber: -1 });

module.exports = mongoose.model('Podcast', podcastSchema);
