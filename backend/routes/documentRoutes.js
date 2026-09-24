const router = require('express').Router();
const { getPublicDocuments, getAll, getOne, create, update, remove } = require('../controllers/documentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const createUpload = require('../middleware/uploadMiddleware');

const upload = createUpload('documents', 'raw');

router.get('/public', getPublicDocuments);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', protect, restrictTo('admin', 'editor'), upload.single('file'), create);
router.patch('/:id', protect, restrictTo('admin', 'editor'), upload.single('file'), update);
router.delete('/:id', protect, restrictTo('admin'), remove);

module.exports = router;
