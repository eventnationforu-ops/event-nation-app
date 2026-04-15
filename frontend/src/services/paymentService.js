import { supabase } from '../lib/supabase';

async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });

  if (error) {
    const message =
      typeof error === 'object' && error.message
        ? error.message
        : typeof error === 'string'
        ? error
        : 'Request failed';
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function createRazorpayOrder({
  eventId,
  packageId,
  members,
  userName,
  phone,
  email,
}) {
  return invokeFunction('create-razorpay-order', {
    event_id: eventId,
    package_id: packageId,
    members,
    user_name: userName,
    phone,
    email,
  });
}

export async function verifyRazorpayPayment({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  bookingId,
}) {
  return invokeFunction('verify-razorpay-payment', {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
    booking_id: bookingId,
  });
}

export async function checkinTicket(ticketId) {
  return invokeFunction('checkin-qr', {
    ticket_id: ticketId,
  });
}

export async function processRefund({ refundId, action }) {
  return invokeFunction('process-refund', {
    refund_id: refundId,
    action,
  });
}

export async function sendEmail({ type, bookingId }) {
  return invokeFunction('send-email', {
    type,
    booking_id: bookingId,
  });
}
