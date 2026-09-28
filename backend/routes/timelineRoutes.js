const router = require('express').Router();
const {
  getAll, getOne, create, update, remove,
} = require('../controllers/timelineController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/',      getAll);
router.get('/:id',   getOne);
router.post('/',     protect, restrictTo('admin', 'editor'), create);
router.patch('/:id', protect, restrictTo('admin', 'editor'), update);
router.delete('/:id', protect, restrictTo('admin'), remove);

module.exports = router;
