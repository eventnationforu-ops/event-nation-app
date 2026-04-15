const { AppError } = require('../middleware/errorHandler');
const { MAX_KIDS_ALLOWED, MAX_CHILD_AGE } = require('./pricingEngine');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
  return UUID_REGEX.test(str);
}

function validateMembers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    throw new AppError('Members list is required and must not be empty', 400);
  }

  const adults = members.filter((m) => m.age > MAX_CHILD_AGE);
  const kids = members.filter((m) => m.age <= MAX_CHILD_AGE);

  if (adults.length < 2) {
    throw new AppError('Minimum 2 adults are required', 400);
  }

  if (kids.length > MAX_KIDS_ALLOWED) {
    throw new AppError(`Maximum ${MAX_KIDS_ALLOWED} kids (age <= ${MAX_CHILD_AGE}) allowed`, 400);
  }

  for (const member of members) {
    if (!member.name || typeof member.name !== 'string' || !member.name.trim()) {
      throw new AppError('Each member must have a valid name', 400);
    }
    if (typeof member.age !== 'number' || member.age < 0 || member.age > 150) {
      throw new AppError('Each member must have a valid age (0-150)', 400);
    }
    if (!member.gender || !['male', 'female', 'other'].includes(member.gender.toLowerCase())) {
      throw new AppError('Each member must have a valid gender (male, female, other)', 400);
    }
  }
}

function validateBookingInput(body) {
  const { event_id, package_id, members, user_name, phone, email } = body;

  if (!event_id || !isValidUUID(event_id)) {
    throw new AppError('Valid event_id is required', 400);
  }
  if (!package_id || !isValidUUID(package_id)) {
    throw new AppError('Valid package_id is required', 400);
  }
  if (!user_name || typeof user_name !== 'string' || !user_name.trim()) {
    throw new AppError('user_name is required', 400);
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    throw new AppError('phone is required', 400);
  }
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new AppError('email is required', 400);
  }

  validateMembers(members);
}

function validatePreviewInput(body) {
  const { event_id, package_id, members } = body;

  if (!event_id || !isValidUUID(event_id)) {
    throw new AppError('Valid event_id is required', 400);
  }
  if (!package_id || !isValidUUID(package_id)) {
    throw new AppError('Valid package_id is required', 400);
  }

  validateMembers(members);
}

module.exports = {
  isValidUUID,
  validateMembers,
  validateBookingInput,
  validatePreviewInput,
};
