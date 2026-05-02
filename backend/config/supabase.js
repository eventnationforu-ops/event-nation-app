const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('FATAL: SUPABASE_URL is not set in environment');
  process.exit(1);
}
if (!SUPABASE_ANON_KEY) {
  console.error('FATAL: SUPABASE_ANON_KEY is not set in environment');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is not set in environment');
  process.exit(1);
}

const baseClientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  baseClientOptions
);

const supabaseAnon = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  baseClientOptions
);

function supabaseFromToken(token) {
  if (!token) {
    return supabaseAnon;
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...baseClientOptions,
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  supabaseFromToken,
};
