const asyncHandler = require('../middleware/asyncHandler');
const eventService = require('../services/eventService');
const { isValidUUID } = require('../utils/validators');
const { AppError } = require('../middleware/errorHandler');

const eventController = {
  list: asyncHandler(async (req, res) => {
    const result = await eventService.listPublic(req.query);
    res.json({ success: true, ...result });
  }),

  getById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) throw new AppError('Invalid event ID', 400);

    const event = await eventService.getPublic(id);
    res.json({ success: true, data: event });
  }),

  getByIdAdmin: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) throw new AppError('Invalid event ID', 400);
    const event = await eventService.getForAdmin(id);
    res.json({ success: true, data: event });
  }),

  adminList: asyncHandler(async (req, res) => {
    const result = await eventService.listAdmin(req.query);
    res.json({ success: true, ...result });
  }),

  create: asyncHandler(async (req, res) => {
    const event = await eventService.create(req.body || {});
    res.status(201).json({ success: true, data: event });
  }),

  update: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) throw new AppError('Invalid event ID', 400);
    const event = await eventService.update(id, req.body || {});
    res.json({ success: true, data: event });
  }),

  softDelete: asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isValidUUID(id)) throw new AppError('Invalid event ID', 400);
    const event = await eventService.softDelete(id);
    res.json({ success: true, data: event });
  }),
};

module.exports = eventController;
