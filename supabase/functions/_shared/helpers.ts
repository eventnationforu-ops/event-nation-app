import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function optionsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export async function authenticateUser(
  req: Request,
  supabase: SupabaseClient
): Promise<{ user: { id: string; email?: string } } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or malformed authorization" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: "Invalid or expired token" }, 401);
  }

  return { user };
}

export async function requireAdmin(
  userId: string,
  supabase: SupabaseClient
): Promise<true | Response> {
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return jsonResponse({ error: "Admin access required" }, 403);
  }
  return true;
}

export function sanitizeString(val: unknown, maxLen = 255): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen).replace(/[<>]/g, "");
}

export function isValidUUID(val: unknown): val is string {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export function isValidPhone(val: unknown): val is string {
  if (typeof val !== "string") return false;
  return /^\d{10,15}$/.test(val.trim());
}

export function isValidEmail(val: unknown): val is string {
  if (typeof val !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}
