const router = require('express').Router();
const { getPublicSettings, getSettings, upsertSettings } = require('../controllers/siteSettingsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/public', getPublicSettings);
router.get('/', protect, restrictTo('admin', 'editor'), getSettings);
router.patch('/', protect, restrictTo('admin', 'editor'), upsertSettings);

module.exports = router;
