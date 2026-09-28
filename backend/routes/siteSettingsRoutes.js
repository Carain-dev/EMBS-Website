const router = require('express').Router();
const {
  getPublicSettings,
  getSettings,
  upsertSettings,
  upsertBranding,
} = require('../controllers/siteSettingsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const createUpload = require('../middleware/uploadMiddleware');

/* Logo and favicon are small images — use the standard image-only upload. */
const brandingUpload = createUpload('branding');

router.get('/public', getPublicSettings);
router.get('/', protect, restrictTo('admin', 'editor'), getSettings);
router.patch('/', protect, restrictTo('admin', 'editor'), upsertSettings);
router.patch(
  '/branding',
  protect,
  restrictTo('admin', 'editor'),
  brandingUpload.fields([
    { name: 'logo',           maxCount: 1 },
    { name: 'favicon',        maxCount: 1 },
    { name: 'podcastCover',   maxCount: 1 },
    { name: 'activitiesHero', maxCount: 1 },
    { name: 'blogHero',       maxCount: 1 },
    { name: 'membersHero',    maxCount: 1 },
    { name: 'aboutHero',      maxCount: 1 },
    { name: 'projectsHero',   maxCount: 1 },
  ]),
  upsertBranding
);

module.exports = router;
