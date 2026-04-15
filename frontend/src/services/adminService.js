import { supabase } from '../lib/supabase';

export async function checkAdmin(userId) {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return !!data;
}

export async function getAllBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      events ( title, venue, city, event_date ),
      packages ( name )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBookingWithMembers(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      events ( title, venue, city, event_date, event_time ),
      packages ( name, base_price ),
      family_members ( * ),
      member_tickets ( * )
    `)
    .eq('id', bookingId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMemberVerification(memberId, status, adminNotes) {
  const { data, error } = await supabase
    .from('family_members')
    .update({
      id_verification_status: status,
      admin_notes: adminNotes || null,
    })
    .eq('id', memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBookingPaymentStatus(bookingId, paymentStatus) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ payment_status: paymentStatus })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBookingStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPendingRefunds() {
  const { data, error } = await supabase
    .from('refund_requests')
    .select(`
      *,
      bookings (
        id, user_name, email, total, status,
        events ( title, event_date )
      )
    `)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function approveRefund(refundId, bookingId) {
  const { error: refundError } = await supabase
    .from('refund_requests')
    .update({ status: 'approved' })
    .eq('id', refundId);
  if (refundError) throw refundError;

  const { error: bookingError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', payment_status: 'refunded' })
    .eq('id', bookingId);
  if (bookingError) throw bookingError;

  await supabase
    .from('member_tickets')
    .update({ status: 'cancelled', qr_status: 'cancelled' })
    .eq('booking_id', bookingId);
}

export async function rejectRefund(refundId, bookingId) {
  const { error: refundError } = await supabase
    .from('refund_requests')
    .update({ status: 'rejected' })
    .eq('id', refundId);
  if (refundError) throw refundError;

  await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('status', 'cancel_pending');
}
