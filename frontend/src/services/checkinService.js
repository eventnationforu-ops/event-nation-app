import { supabase } from '../lib/supabase';

export async function getCheckinStats(eventId) {
  let query = supabase
    .from('member_tickets')
    .select('id, qr_status, event_id, status');

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const total = data.length;
  const checkedIn = data.filter((t) => t.qr_status === 'used').length;
  const active = data.filter((t) => t.status === 'active' && t.qr_status !== 'used').length;
  const cancelled = data.filter((t) => t.status === 'cancelled').length;
  const inactive = data.filter((t) => t.status === 'inactive').length;

  return {
    total,
    checked_in: checkedIn,
    remaining: active,
    cancelled,
    inactive,
    percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
  };
}

export async function getCheckinStatsByEvent() {
  const { data: tickets, error } = await supabase
    .from('member_tickets')
    .select(`
      id, qr_status, status, event_id,
      bookings!inner ( events!inner ( id, title, event_date, venue, city ) )
    `);

  if (error) throw error;

  const eventMap = {};
  for (const ticket of tickets) {
    const event = ticket.bookings?.events;
    if (!event) continue;

    if (!eventMap[event.id]) {
      eventMap[event.id] = {
        event_id: event.id,
        title: event.title,
        event_date: event.event_date,
        venue: event.venue,
        city: event.city,
        total: 0,
        checked_in: 0,
        active: 0,
      };
    }

    eventMap[event.id].total++;
    if (ticket.qr_status === 'used') eventMap[event.id].checked_in++;
    if (ticket.status === 'active' && ticket.qr_status !== 'used') {
      eventMap[event.id].active++;
    }
  }

  return Object.values(eventMap).sort(
    (a, b) => new Date(a.event_date) - new Date(b.event_date)
  );
}

export async function getRecentCheckins(eventId, limit = 20) {
  let query = supabase
    .from('member_tickets')
    .select(`
      id, qr_code, checked_in_at,
      family_members ( full_name, age, gender ),
      bookings ( user_name )
    `)
    .eq('qr_status', 'used')
    .order('checked_in_at', { ascending: false })
    .limit(limit);

  if (eventId) {
    query = query.eq('event_id', eventId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
