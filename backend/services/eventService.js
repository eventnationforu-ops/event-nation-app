const eventModel = require('../models/eventModel');
const { AppError } = require('../middleware/errorHandler');

const EVENT_STATUSES = ['draft', 'published', 'sold_out', 'cancelled'];

function parseBoolFlag(value) {
  return value === true || value === 'true' || value === '1';
}

function parsePagination(query, { defaultLimit, maxLimit }) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit };
}

function validateCreateInput(body) {
  const errors = [];
  const required = ['title', 'venue', 'city', 'event_date', 'event_time'];
  required.forEach((field) => {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      errors.push(`${field} is required`);
    }
  });

  if (body.status && !EVENT_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${EVENT_STATUSES.join(', ')}`);
  }

  if (body.capacity != null) {
    const cap = Number(body.capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      errors.push('capacity must be a positive integer or omitted');
    }
  }

  return errors;
}

function validateUpdateInput(body) {
  const errors = [];
  const allowed = [
    'title',
    'description',
    'venue',
    'city',
    'event_date',
    'event_time',
    'banner',
    'status',
    'capacity',
  ];

  const patch = {};
  Object.keys(body).forEach((key) => {
    if (!allowed.includes(key)) return;
    patch[key] = body[key];
  });

  if (patch.status && !EVENT_STATUSES.includes(patch.status)) {
    errors.push(`status must be one of: ${EVENT_STATUSES.join(', ')}`);
  }

  if (patch.capacity !== undefined && patch.capacity !== null) {
    const cap = Number(patch.capacity);
    if (!Number.isInteger(cap) || cap <= 0) {
      errors.push('capacity must be a positive integer, null, or omitted');
    }
  }

  return { patch, errors };
}

const eventService = {
  async listPublic(query) {
    const { page, limit } = parsePagination(query, {
      defaultLimit: 20,
      maxLimit: 50,
    });
    const upcoming = parseBoolFlag(query.upcoming);
    const result = await eventModel.listPublished({ upcoming, page, limit });
    return {
      data: result.rows,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.count,
        total_pages: Math.max(1, Math.ceil(result.count / result.limit)),
      },
    };
  },

  async listAdmin(query) {
    const { page, limit } = parsePagination(query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const result = await eventModel.listAllAdmin({ page, limit });
    return {
      data: result.rows,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.count,
        total_pages: Math.max(1, Math.ceil(result.count / result.limit)),
      },
    };
  },

  async getPublic(id) {
    const event = await eventModel.findPublishedById(id);
    if (!event) throw new AppError('Event not found', 404);
    return event;
  },

  async getForAdmin(id) {
    const event = await eventModel.findByIdAdmin(id);
    if (!event) throw new AppError('Event not found', 404);
    return event;
  },

  async create(body) {
    const errors = validateCreateInput(body);
    if (errors.length) throw new AppError(errors.join('; '), 400);

    const input = {
      title: body.title.trim(),
      description: body.description?.trim() || null,
      venue: body.venue.trim(),
      city: body.city.trim(),
      event_date: body.event_date,
      event_time: body.event_time,
      banner: body.banner?.trim() || null,
      status: body.status || 'draft',
    };
    if (body.capacity != null) input.capacity = Number(body.capacity);

    return eventModel.create(input);
  },

  async update(id, body) {
    const { patch, errors } = validateUpdateInput(body);
    if (errors.length) throw new AppError(errors.join('; '), 400);
    if (!Object.keys(patch).length) {
      throw new AppError('No updatable fields provided', 400);
    }
    if (patch.capacity != null) patch.capacity = Number(patch.capacity);

    const updated = await eventModel.update(id, patch);
    if (!updated) throw new AppError('Event not found', 404);
    return updated;
  },

  async softDelete(id) {
    const updated = await eventModel.softDeleteById(id);
    if (!updated) throw new AppError('Event not found', 404);
    return updated;
  },
};

module.exports = eventService;
