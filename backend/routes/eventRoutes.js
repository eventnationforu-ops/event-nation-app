const { Router } = require('express');
const eventController = require('../controllers/eventController');

const router = Router();

router.get('/', eventController.getAll);
router.get('/:id', eventController.getById);

module.exports = router;
