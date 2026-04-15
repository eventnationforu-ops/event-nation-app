import { supabase } from '../lib/supabase';
import { sendEmail } from './paymentService';

async function getAuthenticatedUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return user.id;
}

export async function getMyBookings() {
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      events ( title, venue, city, event_date, event_time, banner ),
      packages ( name )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getBookingById(id) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      events ( id, title, venue, city, event_date, event_time ),
      packages ( name, base_price ),
      family_members ( * ),
      member_tickets ( * )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function cancelBooking(bookingId) {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancel_pending' })
    .eq('id', bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createRefundRequest(bookingId, refundData) {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from('refund_requests')
    .insert({
      booking_id: bookingId,
      refund_percentage: refundData.refund_percentage,
      refund_amount: refundData.refund_amount,
      processing_fee: refundData.processing_fee,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('bookings')
    .update({ status: 'cancel_pending' })
    .eq('id', bookingId);

  try {
    await sendEmail({ type: 'cancellation_confirmation', bookingId });
  } catch {
    // Non-critical
  }

  return data;
}
