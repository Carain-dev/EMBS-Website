const asyncHandler = require('express-async-handler');
const SiteSettings = require('../models/SiteSettings');
const { sendResponse, sendError } = require('../utils/sendResponse');

const DEFAULT_SETTINGS = {
  siteName: 'IEEE EMBS Student Chapter',
  chapterName: 'IEEE Engineering in Medicine and Biology Society',
  institution: '',
  department: '',
  officialEmail: '',
  phone: '',
  address: '',
  facultyContact: '',
  mapUrl: '',
  footerText: '',
  logoUrl: '',
  faviconUrl: '',
  websiteUrl: '',
  chapterDescription: '',
  vision: '',
  mission: '',
  establishedYear: '',
  podcastCoverUrl: '',
  galleryFeaturedHeading: '',
  galleryFeaturedDesc: '',
  activitiesHeroImageUrl: '',
  blogHeroImageUrl: '',
  membersHeroImageUrl: '',
  aboutHeroImageUrl: '',
  projectsHeroImageUrl: '',
  socialLinks: {
    linkedin: '',
    instagram: '',
    youtube: '',
    spotify: '',
    x: '',
    facebook: '',
  },
  registrationLinks: {
    events: '',
    membership: '',
    ieeeDay: '',
    other: {},
  },
  brochureLinks: {
    chapter: '',
    membership: '',
    annualReport: '',
    other: {},
  },
};

const normalizeSettings = (settings = {}) => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  socialLinks: { ...DEFAULT_SETTINGS.socialLinks, ...(settings.socialLinks || {}) },
  registrationLinks: { ...DEFAULT_SETTINGS.registrationLinks, ...(settings.registrationLinks || {}) },
  brochureLinks: { ...DEFAULT_SETTINGS.brochureLinks, ...(settings.brochureLinks || {}) },
});

exports.getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne().lean();
  sendResponse(res, 200, normalizeSettings(settings || {}));
});

exports.getSettings = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne().lean();
  sendResponse(res, 200, normalizeSettings(settings || {}));
});

exports.upsertSettings = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  /* Only store updatedBy when the user is a real MongoDB ObjectId.
     The hardcoded ADMIN_PASSWORD bypass sets req.user._id = 'admin'
     (a plain string), which is not a valid ObjectId and would cause
     a Mongoose CastError on the updatedBy ref field. */
  if (req.user && req.user._id && req.user._id !== 'admin') {
    payload.updatedBy = req.user._id;
  } else {
    // Avoid sending an invalid value; leave any existing updatedBy untouched.
    delete payload.updatedBy;
  }

  /* Strip fields that must not be mass-assigned via the settings form. */
  delete payload._id;
  delete payload.__v;
  delete payload.createdAt;
  delete payload.updatedAt;

  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: payload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  sendResponse(res, 200, normalizeSettings(settings.toObject ? settings.toObject() : settings), 'Site settings updated');
});

/* ── Upload branding assets (logo / favicon) ─────────────────────────────────
   Accepts multipart/form-data with up to two image fields: `logo` and `favicon`.
   multer-storage-cloudinary stores each file and returns a CDN URL in
   req.files[fieldName][0].path.  We $set only the fields that were actually
   uploaded so a logo-only upload does not accidentally wipe the favicon URL. */
exports.upsertBranding = asyncHandler(async (req, res) => {
  const patch = {};

  if (req.files && req.files.logo && req.files.logo[0]) {
    patch.logoUrl = req.files.logo[0].path;
  }
  if (req.files && req.files.favicon && req.files.favicon[0]) {
    patch.faviconUrl = req.files.favicon[0].path;
  }
  if (req.files && req.files.podcastCover && req.files.podcastCover[0]) {
    patch.podcastCoverUrl = req.files.podcastCover[0].path;
  }

  /* ── Page hero images ── */
  const heroFields = [
    ['activitiesHero', 'activitiesHeroImageUrl'],
    ['blogHero',       'blogHeroImageUrl'],
    ['membersHero',    'membersHeroImageUrl'],
    ['aboutHero',      'aboutHeroImageUrl'],
    ['projectsHero',   'projectsHeroImageUrl'],
  ];
  heroFields.forEach(([field, urlKey]) => {
    if (req.files && req.files[field] && req.files[field][0]) {
      patch[urlKey] = req.files[field][0].path;
    }
    /* Allow explicit clear: send urlKey='' in body to delete the image */
    if (req.body[urlKey] === '') patch[urlKey] = '';
  });

  /* Also accept any plain text fields sent alongside (e.g. websiteUrl) */
  const textFields = ['websiteUrl', 'siteName'];
  textFields.forEach(f => {
    if (typeof req.body[f] === 'string') patch[f] = req.body[f].trim();
  });

  /* Allow explicit clear of podcastCoverUrl (admin removes the image) */
  if (req.body.podcastCoverUrl === '') patch.podcastCoverUrl = '';

  if (Object.keys(patch).length === 0) {
    return sendError(res, 400, 'No branding fields to update');
  }

  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: patch },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  sendResponse(res, 200, normalizeSettings(settings.toObject ? settings.toObject() : settings), 'Branding updated');
});
