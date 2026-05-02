const { Router } = require('express');
const eventController = require('../controllers/eventController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = Router();

router.get('/', eventController.list);
router.get('/admin', requireAuth, requireAdmin, eventController.adminList);
router.get('/admin/:id', requireAuth, requireAdmin, eventController.getByIdAdmin);
router.get('/:id', eventController.getById);

router.post('/', requireAuth, requireAdmin, eventController.create);
router.patch('/:id', requireAuth, requireAdmin, eventController.update);
router.delete('/:id', requireAuth, requireAdmin, eventController.softDelete);

module.exports = router;
