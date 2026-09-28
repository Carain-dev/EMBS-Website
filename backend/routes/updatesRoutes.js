const router = require('express').Router();
const { getUpdates } = require('../controllers/updatesController');

/* Public — no auth required. The controller only returns publicly
   visible items, so no authentication is needed here. */
router.get('/', getUpdates);

module.exports = router;
