import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import {
  corsHeaders, jsonResponse, optionsResponse, createServiceClient,
  authenticateUser, sanitizeString, isValidUUID, isValidPhone, isValidEmail,
} from "../_shared/helpers.ts";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

const GST_RATE = 0.18;
const MAX_MEMBERS_PER_BOOKING = 10;

interface MemberInput {
  full_name: string;
  age: number;
  gender: string;
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
    const { allowed, retryAfterMs } = checkRateLimit(req, user.id, RATE_LIMITS.payment);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    // ── Parse & validate input ───────────────────────────
    const body = await req.json();
    const { event_id, package_id, members, user_name, phone, email } = body;

    if (!isValidUUID(event_id) || !isValidUUID(package_id)) {
      return jsonResponse({ error: "Valid event_id and package_id (UUID) are required" }, 400);
    }
    if (!Array.isArray(members) || members.length === 0) {
      return jsonResponse({ error: "At least one member is required" }, 400);
    }
    if (members.length > MAX_MEMBERS_PER_BOOKING) {
      return jsonResponse({ error: `Maximum ${MAX_MEMBERS_PER_BOOKING} members per booking` }, 400);
    }

    const safeName = sanitizeString(user_name);
    const safePhone = sanitizeString(phone, 15);
    const safeEmail = sanitizeString(email);

    if (!safeName) return jsonResponse({ error: "user_name is required" }, 400);
    if (!isValidPhone(safePhone)) return jsonResponse({ error: "Valid phone number is required" }, 400);
    if (!isValidEmail(safeEmail)) return jsonResponse({ error: "Valid email is required" }, 400);

    const sanitizedMembers: MemberInput[] = [];
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const name = sanitizeString(m.full_name);
      if (!name) return jsonResponse({ error: `Member ${i + 1}: full_name is required` }, 400);
      if (typeof m.age !== "number" || !Number.isInteger(m.age) || m.age <= 0 || m.age > 150) {
        return jsonResponse({ error: `Member ${i + 1}: valid age (1-150) is required` }, 400);
      }
      if (!["male", "female", "other"].includes(m.gender)) {
        return jsonResponse({ error: `Member ${i + 1}: gender must be male, female, or other` }, 400);
      }
      sanitizedMembers.push({ full_name: name, age: m.age, gender: m.gender });
    }

    // ── Business rules ───────────────────────────────────
    const adults = sanitizedMembers.filter((m) => m.age >= 12);
    const kids = sanitizedMembers.filter((m) => m.age < 12);

    if (adults.length < 2) {
      return jsonResponse({ error: "At least 2 adults (age 12+) are required" }, 400);
    }
    if (kids.length > 2) {
      return jsonResponse({ error: "Maximum 2 kids (under 12) allowed per booking" }, 400);
    }

    // ── Fetch package (server-side pricing) ──────────────
    const { data: pkg, error: pkgError } = await supabase
      .from("packages")
      .select("*")
      .eq("id", package_id)
      .eq("event_id", event_id)
      .single();

    if (pkgError || !pkg) {
      return jsonResponse({ error: "Package not found for this event" }, 404);
    }

    // ── Verify event exists and is upcoming ──────────────
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, event_date")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return jsonResponse({ error: "Event not found" }, 404);
    }

    const eventDate = new Date(event.event_date + "T23:59:59");
    if (eventDate < new Date()) {
      return jsonResponse({ error: "Cannot book a past event" }, 400);
    }

    // ── Server-side pricing ──────────────────────────────
    const includedAdults = Math.min(adults.length, pkg.max_adults);
    const extraAdults = Math.max(0, adults.length - pkg.max_adults);

    const subtotal = Number(pkg.base_price) + extraAdults * Number(pkg.extra_adult_price);
    const gst = Math.round(subtotal * GST_RATE * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;
    const amountInPaise = Math.round(total * 100);

    if (amountInPaise < 100) {
      return jsonResponse({ error: "Order amount must be at least ₹1" }, 400);
    }

    // ── Create pending booking ───────────────────────────
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        user_name: safeName,
        phone: safePhone,
        email: safeEmail,
        event_id,
        package_id,
        subtotal,
        gst,
        total,
        status: "pending",
        payment_status: "unpaid",
      })
      .select("id")
      .single();

    if (bookingError || !booking) {
      return jsonResponse({ error: "Failed to create booking", details: bookingError?.message }, 500);
    }

    // Helper: clean up on any downstream failure
    async function rollbackBooking() {
      await supabase.from("member_tickets").delete().eq("booking_id", booking.id);
      await supabase.from("family_members").delete().eq("booking_id", booking.id);
      await supabase.from("payments").delete().eq("booking_id", booking.id);
      await supabase.from("bookings").delete().eq("id", booking.id);
    }

    // ── Insert family members ────────────────────────────
    const memberRows = sanitizedMembers.map((m) => ({
      booking_id: booking.id,
      full_name: m.full_name,
      age: m.age,
      gender: m.gender,
      is_child: m.age < 12,
      id_verification_status: "pending",
    }));

    const { data: insertedMembers, error: memberError } = await supabase
      .from("family_members")
      .insert(memberRows)
      .select("id");

    if (memberError || !insertedMembers?.length) {
      await rollbackBooking();
      return jsonResponse({ error: "Failed to create family members", details: memberError?.message }, 500);
    }

    // ── Insert inactive tickets ──────────────────────────
    const ticketRows = insertedMembers.map((m) => ({
      booking_id: booking.id,
      member_id: m.id,
      event_id,
      qr_code: crypto.randomUUID(),
      qr_status: "active",
      status: "inactive",
    }));

    const { error: ticketError } = await supabase
      .from("member_tickets")
      .insert(ticketRows);

    if (ticketError) {
      await rollbackBooking();
      return jsonResponse({ error: "Failed to create tickets", details: ticketError.message }, 500);
    }

    // ── Create Razorpay order ────────────────────────────
    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    let razorpayOrder: Record<string, unknown>;

    try {
      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${razorpayAuth}`,
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: booking.id,
          notes: { booking_id: booking.id, user_id: user.id, event_id },
        }),
      });

      if (!orderResponse.ok) {
        const errBody = await orderResponse.text();
        await rollbackBooking();
        return jsonResponse({ error: "Razorpay order creation failed", details: errBody }, 502);
      }
      razorpayOrder = await orderResponse.json();
    } catch (fetchErr) {
      await rollbackBooking();
      return jsonResponse({ error: "Failed to connect to payment gateway" }, 502);
    }

    // ── Store payment record ─────────────────────────────
    const { error: paymentInsertError } = await supabase.from("payments").insert({
      booking_id: booking.id,
      amount: total,
      status: "pending",
      razorpay_order_id: razorpayOrder.id,
    });

    if (paymentInsertError) {
      await rollbackBooking();
      return jsonResponse({ error: "Failed to record payment", details: paymentInsertError.message }, 500);
    }

    return jsonResponse({
      order_id: razorpayOrder.id,
      amount: amountInPaise,
      currency: "INR",
      booking_id: booking.id,
      key_id: RAZORPAY_KEY_ID,
      prefill: { name: safeName, email: safeEmail, contact: safePhone },
      pricing: {
        adults_count: adults.length,
        kids_count: kids.length,
        included_adults: includedAdults,
        extra_adults: extraAdults,
        subtotal,
        gst,
        total,
      },
    });
  } catch (err) {
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
