const router = require('express').Router();
const { getStats } = require('../controllers/dashboardController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/stats', protect, restrictTo('admin', 'editor'), getStats);

module.exports = router;
