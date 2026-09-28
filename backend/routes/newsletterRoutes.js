const router = require('express').Router();
const { subscribe, getAll, remove, sendNewsletter } = require('../controllers/newsletterController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/subscribe',   subscribe);
router.get('/',             protect, restrictTo('admin'), getAll);
router.delete('/unsubscribe', remove);
router.post('/send',        protect, restrictTo('admin'), sendNewsletter);

module.exports = router;
