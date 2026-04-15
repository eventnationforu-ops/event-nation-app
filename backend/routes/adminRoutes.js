const { Router } = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/bookings', adminController.getAllBookings);
router.get('/bookings/:id', adminController.getBookingDetails);
router.post('/member/verify', adminController.verifyMember);
router.post('/payment/status', adminController.updatePaymentStatus);
router.post('/refund/approve', adminController.approveRefund);
router.post('/refund/reject', adminController.rejectRefund);

module.exports = router;
