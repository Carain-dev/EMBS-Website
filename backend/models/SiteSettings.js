const mongoose = require('mongoose');

const socialLinksSchema = new mongoose.Schema(
  {
    linkedin: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    spotify: { type: String, default: '' },
    x: { type: String, default: '' },
    facebook: { type: String, default: '' },
  },
  { _id: false }
);

const registrationLinksSchema = new mongoose.Schema(
  {
    events: { type: String, default: '' },
    membership: { type: String, default: '' },
    ieeeDay: { type: String, default: '' },
    other: { type: Map, of: String, default: {} },
  },
  { _id: false }
);

const brochureLinksSchema = new mongoose.Schema(
  {
    chapter: { type: String, default: '' },
    membership: { type: String, default: '' },
    annualReport: { type: String, default: '' },
    other: { type: Map, of: String, default: {} },
  },
  { _id: false }
);

const siteSettingsSchema = new mongoose.Schema(
  {
    siteName: { type: String, default: 'IEEE EMBS Student Chapter' },
    chapterName: { type: String, default: 'IEEE Engineering in Medicine and Biology Society' },
    institution: { type: String, default: '' },
    department: { type: String, default: '' },
    officialEmail: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    facultyContact: { type: String, default: '' },
    mapUrl: { type: String, default: '' },
    footerText: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    socialLinks: { type: socialLinksSchema, default: () => ({}) },
    registrationLinks: { type: registrationLinksSchema, default: () => ({}) },
    brochureLinks: { type: brochureLinksSchema, default: () => ({}) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

siteSettingsSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
