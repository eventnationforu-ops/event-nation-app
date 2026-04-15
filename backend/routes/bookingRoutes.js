const { Router } = require('express');
const bookingController = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

router.post('/preview', bookingController.preview);

router.post('/create', requireAuth, bookingController.create);
router.post('/confirm', requireAuth, bookingController.confirm);
router.post('/cancel', requireAuth, bookingController.cancel);
router.get('/my', requireAuth, bookingController.myBookings);

module.exports = router;
