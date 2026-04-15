const { Router } = require('express');
const packageController = require('../controllers/packageController');

const router = Router();

router.get('/:eventId', packageController.getByEventId);

module.exports = router;
