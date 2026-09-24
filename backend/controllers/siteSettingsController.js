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

  if (req.user) payload.updatedBy = req.user._id;

  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: payload },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  sendResponse(res, 200, normalizeSettings(settings.toObject ? settings.toObject() : settings), 'Site settings updated');
});
