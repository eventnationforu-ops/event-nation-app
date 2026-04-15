import { supabase } from '../lib/supabase';

export async function getEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getEventById(id) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function getPackagesByEventId(eventId) {
  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .eq('event_id', eventId)
    .order('base_price', { ascending: true });
  if (error) throw error;
  return data;
}
