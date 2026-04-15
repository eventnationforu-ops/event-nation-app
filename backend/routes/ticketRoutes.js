const { Router } = require('express');
const ticketController = require('../controllers/ticketController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = Router();

router.get('/:bookingId', requireAuth, ticketController.getByBookingId);

module.exports = router;
