const {
  supabaseAdmin,
  supabaseAnon,
  supabaseFromToken,
} = require('../config/supabase');

const EVENT_FIELDS =
  'id, title, description, venue, city, event_date, event_time, banner, status, capacity, created_at, updated_at';

const EVENT_FIELDS_WITH_PACKAGES = `${EVENT_FIELDS}, packages ( id, name, base_price, max_adults, max_kids, extra_adult_price )`;

const eventModel = {
  async listPublished({ upcoming = false, page = 1, limit = 20 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAnon
      .from('events')
      .select(EVENT_FIELDS_WITH_PACKAGES, { count: 'exact' })
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .range(from, to);

    if (upcoming) {
      const today = new Date().toISOString().slice(0, 10);
      query = query.gte('event_date', today);
    }

    const { data, error, count } = await query;
    if (error) throw error;
    return { rows: data || [], count: count || 0, page, limit };
  },

  async findPublishedById(id) {
    const { data, error } = await supabaseAnon
      .from('events')
      .select(EVENT_FIELDS_WITH_PACKAGES)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async findByIdAdmin(id) {
    const { data, error } = await supabaseAdmin
      .from('events')
      .select(EVENT_FIELDS_WITH_PACKAGES)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async listAllAdmin({ page = 1, limit = 50 } = {}) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('events')
      .select(EVENT_FIELDS_WITH_PACKAGES, { count: 'exact' })
      .order('event_date', { ascending: true })
      .range(from, to);

    if (error) throw error;
    return { rows: data || [], count: count || 0, page, limit };
  },

  async create(input) {
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert(input)
      .select(EVENT_FIELDS)
      .single();

    if (error) throw error;
    return data;
  },

  async update(id, patch) {
    const { data, error } = await supabaseAdmin
      .from('events')
      .update(patch)
      .eq('id', id)
      .select(EVENT_FIELDS)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async softDeleteById(id) {
    const { data, error } = await supabaseAdmin
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select(EVENT_FIELDS)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },
};

eventModel.supabaseFromToken = supabaseFromToken;

module.exports = eventModel;
