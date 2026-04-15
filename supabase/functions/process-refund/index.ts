import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import {
  jsonResponse, optionsResponse, createServiceClient,
  authenticateUser, requireAdmin, isValidUUID,
} from "../_shared/helpers.ts";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

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
    const { allowed, retryAfterMs } = checkRateLimit(req, user.id, RATE_LIMITS.refund);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // ── Parse input ──────────────────────────────────────
    const body = await req.json();
    const { refund_id, action } = body;

    if (!isValidUUID(refund_id)) {
      return jsonResponse({ error: "Valid refund_id (UUID) is required" }, 400);
    }
    if (!["approve", "reject"].includes(action)) {
      return jsonResponse({ error: "action must be 'approve' or 'reject'" }, 400);
    }

    // ── Fetch refund request ─────────────────────────────
    const { data: refundReq, error: refundError } = await supabase
      .from("refund_requests")
      .select("*, bookings(id, user_id, total, status, payment_status)")
      .eq("id", refund_id)
      .single();

    if (refundError || !refundReq) {
      return jsonResponse({ error: "Refund request not found" }, 404);
    }

    if (refundReq.status !== "pending") {
      return jsonResponse({ error: `Refund already ${refundReq.status}`, status: refundReq.status }, 409);
    }

    const bookingId = refundReq.booking_id;

    // Verify booking is in a refundable state
    if (refundReq.bookings?.payment_status !== "paid") {
      return jsonResponse({ error: "Booking payment is not in 'paid' status — cannot process refund" }, 400);
    }

    // ── Reject flow ──────────────────────────────────────
    if (action === "reject") {
      const { error: rejectErr } = await supabase
        .from("refund_requests")
        .update({ status: "rejected", admin_id: user.id, processed_at: new Date().toISOString() })
        .eq("id", refund_id)
        .eq("status", "pending");

      if (rejectErr) {
        return jsonResponse({ error: "Failed to reject refund", details: rejectErr.message }, 500);
      }

      await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingId)
        .eq("status", "cancel_pending");

      return jsonResponse({ success: true, action: "rejected", refund_id, booking_id: bookingId });
    }

    // ── Approve flow: Process Razorpay refund ────────────
    const { data: payment } = await supabase
      .from("payments")
      .select("id, razorpay_payment_id, razorpay_order_id, status, amount")
      .eq("booking_id", bookingId)
      .eq("status", "completed")
      .single();

    if (!payment?.razorpay_payment_id) {
      return jsonResponse({ error: "No completed Razorpay payment found for this booking" }, 400);
    }

    const refundAmount = Number(refundReq.refund_amount);
    const refundAmountPaise = Math.round(refundAmount * 100);

    if (refundAmountPaise <= 0) {
      return jsonResponse({ error: "Refund amount must be positive" }, 400);
    }

    // Sanity: refund cannot exceed the paid amount
    if (refundAmount > Number(payment.amount)) {
      return jsonResponse({ error: "Refund amount exceeds paid amount" }, 400);
    }

    // Call Razorpay Refund API
    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

    let razorpayRefund: Record<string, unknown>;
    try {
      const refundResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${razorpayAuth}`,
          },
          body: JSON.stringify({
            amount: refundAmountPaise,
            notes: {
              refund_request_id: refund_id,
              booking_id: bookingId,
              reason: "Cancellation refund",
            },
          }),
        }
      );

      if (!refundResponse.ok) {
        const errBody = await refundResponse.text();
        return jsonResponse({ error: "Razorpay refund failed", details: errBody }, 502);
      }
      razorpayRefund = await refundResponse.json();
    } catch (fetchErr) {
      return jsonResponse({ error: "Failed to connect to Razorpay for refund" }, 502);
    }

    // ── Update all records with conditional checks ───────
    const { error: refundUpdateErr } = await supabase
      .from("refund_requests")
      .update({
        status: "approved",
        razorpay_refund_id: razorpayRefund.id,
        admin_id: user.id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", refund_id)
      .eq("status", "pending");

    if (refundUpdateErr) {
      return jsonResponse({
        error: "Razorpay refund succeeded but DB update failed — MANUAL INTERVENTION REQUIRED",
        razorpay_refund_id: razorpayRefund.id,
        details: refundUpdateErr.message,
      }, 500);
    }

    const refundPercentage = Number(refundReq.refund_percentage);
    const paymentStatus = refundPercentage >= 90 ? "refunded" : "partial_refund";

    await supabase
      .from("bookings")
      .update({ status: "cancelled", payment_status: paymentStatus })
      .eq("id", bookingId);

    await supabase
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", payment.id);

    await supabase
      .from("member_tickets")
      .update({ status: "cancelled", qr_status: "cancelled" })
      .eq("booking_id", bookingId);

    return jsonResponse({
      success: true,
      action: "approved",
      refund_id,
      booking_id: bookingId,
      razorpay_refund_id: razorpayRefund.id,
      refund_amount: refundAmount,
      payment_status: paymentStatus,
    });
  } catch (err) {
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
