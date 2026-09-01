const router = require('express').Router();
const {
  register,
  login,
  logout,
  getMe,
  updateMe,
  updatePassword,
} = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/* Registration is an admin-only action, not a public sign-up. Left open, any
   visitor could POST {"role":"admin"} here and mint themselves an account with
   full access to the admin panel. */
router.post('/register',        protect, restrictTo('admin'), register);
router.post('/login',           login);
router.post('/logout',          logout);
router.get('/me',               protect, getMe);
router.patch('/update-me',      protect, updateMe);
router.patch('/update-password', protect, updatePassword);

module.exports = router;
