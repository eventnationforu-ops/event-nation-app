import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import {
  jsonResponse, optionsResponse, createServiceClient,
  authenticateUser, requireAdmin, sanitizeString,
} from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const supabase = createServiceClient();

    // ── Auth + Admin ─────────────────────────────────────
    const authResult = await authenticateUser(req, supabase);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const adminCheck = await requireAdmin(user.id, supabase);
    if (adminCheck instanceof Response) return adminCheck;

    // ── Rate limit ────────────────────────────────────────
    const { allowed, retryAfterMs } = checkRateLimit(req, user.id, RATE_LIMITS.checkin);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // ── Parse input ──────────────────────────────────────
    const body = await req.json();
    const ticketId = sanitizeString(body.ticket_id, 100);

    if (!ticketId) {
      return jsonResponse({ error: "ticket_id is required (string)" }, 400);
    }

    // ── Look up ticket with related data ─────────────────
    const { data: ticket, error: ticketError } = await supabase
      .from("member_tickets")
      .select(`
        id, qr_code, qr_status, status, checked_in_at, booking_id, member_id,
        family_members ( full_name, age, gender, is_child ),
        bookings (
          user_name, email, phone, status, payment_status,
          events ( title, event_date )
        )
      `)
      .eq("qr_code", ticketId)
      .single();

    if (ticketError || !ticket) {
      return jsonResponse({ success: false, error: "Ticket not found" }, 404);
    }

    // ── State validation chain ───────────────────────────
    if (ticket.qr_status === "used") {
      return jsonResponse({
        success: false, error: "Already checked in",
        checked_in_at: ticket.checked_in_at,
        member: ticket.family_members,
      }, 409);
    }

    if (ticket.qr_status === "cancelled" || ticket.status === "cancelled") {
      return jsonResponse({ success: false, error: "Ticket is cancelled" }, 400);
    }

    if (ticket.qr_status === "expired") {
      return jsonResponse({ success: false, error: "Ticket has expired" }, 400);
    }

    if (ticket.status !== "active") {
      return jsonResponse(
        { success: false, error: "Ticket is not active — payment may be pending" }, 400
      );
    }

    if (ticket.bookings?.payment_status !== "paid") {
      return jsonResponse(
        { success: false, error: "Booking payment not confirmed" }, 400
      );
    }

    if (ticket.bookings?.status === "cancelled") {
      return jsonResponse(
        { success: false, error: "Booking has been cancelled" }, 400
      );
    }

    // ── Atomic check-in with conditional update ──────────
    // Only succeeds if qr_status is still "active" (prevents race conditions)
    const now = new Date().toISOString();

    const { data: updatedRows, error: updateError } = await supabase
      .from("member_tickets")
      .update({
        qr_status: "used",
        status: "used",
        checked_in_at: now,
        checked_in_by: user.id,
      })
      .eq("id", ticket.id)
      .eq("qr_status", "active")
      .select("id");

    if (updateError) {
      return jsonResponse(
        { success: false, error: "Failed to update ticket", details: updateError.message }, 500
      );
    }

    // If no rows were updated, another request beat us to it
    if (!updatedRows || updatedRows.length === 0) {
      return jsonResponse({
        success: false,
        error: "Already checked in (concurrent scan)",
        member: ticket.family_members,
      }, 409);
    }

    return jsonResponse({
      success: true,
      ticket_id: ticket.id,
      member: ticket.family_members,
      booking: {
        user_name: ticket.bookings?.user_name,
        event: ticket.bookings?.events?.title,
        event_date: ticket.bookings?.events?.event_date,
      },
      checked_in_at: now,
    });
  } catch (err) {
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
