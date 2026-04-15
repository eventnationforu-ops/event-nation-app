import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import {
  jsonResponse, optionsResponse, createServiceClient,
  authenticateUser, isValidUUID,
} from "../_shared/helpers.ts";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const payload = new TextEncoder().encode(`${orderId}|${paymentId}`);
  const secret = new TextEncoder().encode(RAZORPAY_KEY_SECRET);

  const key = await crypto.subtle.importKey(
    "raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const signed = await crypto.subtle.sign("HMAC", key, payload);
  const expected = toHex(signed);

  if (expected.length !== signature.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const supabase = createServiceClient();

    // ── Auth ──────────────────────────────────────────────
    const authResult = await authenticateUser(req, supabase);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    // ── Rate limit ────────────────────────────────────────
    const { allowed, retryAfterMs } = checkRateLimit(req, user.id, RATE_LIMITS.verification);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // ── Parse & validate ─────────────────────────────────
    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, booking_id } = body;

    if (typeof razorpay_order_id !== "string" || !razorpay_order_id.startsWith("order_")) {
      return jsonResponse({ error: "Invalid razorpay_order_id format" }, 400);
    }
    if (typeof razorpay_payment_id !== "string" || !razorpay_payment_id.startsWith("pay_")) {
      return jsonResponse({ error: "Invalid razorpay_payment_id format" }, 400);
    }
    if (typeof razorpay_signature !== "string" || razorpay_signature.length !== 64) {
      return jsonResponse({ error: "Invalid razorpay_signature format" }, 400);
    }
    if (!isValidUUID(booking_id)) {
      return jsonResponse({ error: "Invalid booking_id format" }, 400);
    }

    // ── Verify booking belongs to this user and is pending ─
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, user_id, payment_status, status, total")
      .eq("id", booking_id)
      .eq("user_id", user.id)
      .single();

    if (bookingError || !booking) {
      return jsonResponse({ error: "Booking not found or unauthorized" }, 404);
    }

    // ── Idempotency: already paid ────────────────────────
    if (booking.payment_status === "paid") {
      return jsonResponse({
        success: true, booking_id, status: "confirmed",
        payment_status: "paid", message: "Already verified",
      });
    }

    // Reject if booking was cancelled
    if (booking.status === "cancelled") {
      return jsonResponse({ error: "Booking has been cancelled" }, 400);
    }

    // ── Verify payment record matches ────────────────────
    const { data: payment } = await supabase
      .from("payments")
      .select("id, razorpay_order_id, status, amount")
      .eq("booking_id", booking_id)
      .eq("razorpay_order_id", razorpay_order_id)
      .single();

    if (!payment) {
      return jsonResponse({ error: "No matching payment record found for this order" }, 404);
    }

    // Reject duplicate verification on already-completed payment
    if (payment.status === "completed") {
      return jsonResponse({
        success: true, booking_id, status: "confirmed",
        payment_status: "paid", message: "Payment already completed",
      });
    }
    if (payment.status === "failed") {
      return jsonResponse({ error: "This payment was previously marked as failed" }, 400);
    }

    // ── Cross-check: payment amount matches booking total ─
    if (Math.abs(Number(payment.amount) - Number(booking.total)) > 0.01) {
      return jsonResponse({ error: "Payment amount mismatch" }, 400);
    }

    // ── Verify Razorpay HMAC-SHA256 signature ────────────
    const isValid = await verifyRazorpaySignature(
      razorpay_order_id, razorpay_payment_id, razorpay_signature
    );

    if (!isValid) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return jsonResponse({ error: "Invalid payment signature — verification failed" }, 400);
    }

    // ── Signature valid → activate booking atomically ────
    // Use conditional update to prevent race: only update if still pending/unpaid
    const { data: updatedBooking, error: bookingUpdateErr } = await supabase
      .from("bookings")
      .update({ status: "confirmed", payment_status: "paid" })
      .eq("id", booking_id)
      .eq("payment_status", "unpaid")
      .select("id")
      .single();

    if (bookingUpdateErr || !updatedBooking) {
      // Another request already confirmed it — idempotent success
      return jsonResponse({
        success: true, booking_id, status: "confirmed",
        payment_status: "paid", message: "Already confirmed by concurrent request",
      });
    }

    // Activate tickets
    const { error: ticketErr } = await supabase
      .from("member_tickets")
      .update({ status: "active" })
      .eq("booking_id", booking_id)
      .eq("status", "inactive");

    if (ticketErr) {
      return jsonResponse({
        error: "Booking confirmed but ticket activation failed — contact support",
        booking_id,
        details: ticketErr.message,
      }, 500);
    }

    // Update payment record
    const { error: paymentUpdateErr } = await supabase
      .from("payments")
      .update({
        status: "completed",
        razorpay_payment_id,
        razorpay_signature,
      })
      .eq("id", payment.id);

    if (paymentUpdateErr) {
      return jsonResponse({
        error: "Booking confirmed but payment record update failed — contact support",
        booking_id,
        details: paymentUpdateErr.message,
      }, 500);
    }

    // ── Fire-and-forget emails ───────────────────────────
    try {
      const authHeader = req.headers.get("Authorization")!;
      const emailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
      const emailHeaders = { "Content-Type": "application/json", Authorization: authHeader };
      fetch(emailUrl, {
        method: "POST", headers: emailHeaders,
        body: JSON.stringify({ type: "booking_confirmation", booking_id }),
      }).catch(() => {});
      fetch(emailUrl, {
        method: "POST", headers: emailHeaders,
        body: JSON.stringify({ type: "ticket_delivery", booking_id }),
      }).catch(() => {});
    } catch {
      // Non-critical
    }

    return jsonResponse({
      success: true, booking_id,
      status: "confirmed", payment_status: "paid",
    });
  } catch (err) {
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
