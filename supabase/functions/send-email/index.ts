import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import {
  jsonResponse, optionsResponse, createServiceClient,
  authenticateUser, isValidUUID,
} from "../_shared/helpers.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@eventnation.app";

type EmailType =
  | "booking_confirmation"
  | "ticket_delivery"
  | "cancellation_confirmation"
  | "refund_status";

interface EmailPayload {
  type: EmailType;
  booking_id: string;
  extra?: Record<string, unknown>;
}

function generateBookingConfirmationHtml(booking: Record<string, unknown>, members: Record<string, unknown>[]): string {
  const memberList = members
    .map((m: Record<string, unknown>) => `<li>${m.full_name} (${m.age} yrs, ${m.gender})</li>`)
    .join("");

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#6C63FF;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">Booking Confirmed!</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px">
        <p>Hi <strong>${booking.user_name}</strong>,</p>
        <p>Your booking for <strong>${(booking as Record<string, Record<string, unknown>>).events?.title || "Event"}</strong> has been confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666">Booking ID</td><td style="padding:8px 0;font-weight:600">${(booking.id as string)?.slice(0, 8)}...</td></tr>
          <tr><td style="padding:8px 0;color:#666">Package</td><td style="padding:8px 0;font-weight:600">${(booking as Record<string, Record<string, unknown>>).packages?.name || "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Total Amount</td><td style="padding:8px 0;font-weight:700;color:#6C63FF">₹${Number(booking.total).toLocaleString("en-IN")}</td></tr>
        </table>
        <p><strong>Members:</strong></p>
        <ul>${memberList}</ul>
        <p style="color:#666;font-size:13px;margin-top:24px">Please upload government ID proofs for all members before the event. Show your QR code tickets at the venue for check-in.</p>
      </div>
    </div>`;
}

function generateTicketDeliveryHtml(booking: Record<string, unknown>, tickets: Record<string, unknown>[]): string {
  const ticketList = tickets
    .map((t: Record<string, unknown>) => `<li>Ticket ${(t.qr_code as string)?.slice(0, 8)} — Status: ${t.status}</li>`)
    .join("");

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#4CAF50;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">Your Tickets Are Ready!</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px">
        <p>Hi <strong>${booking.user_name}</strong>,</p>
        <p>Your tickets for <strong>${(booking as Record<string, Record<string, unknown>>).events?.title || "Event"}</strong> are now active.</p>
        <p><strong>Tickets:</strong></p>
        <ul>${ticketList}</ul>
        <p>Open the Event Nation app to view and share your QR code tickets.</p>
        <p style="color:#666;font-size:13px;margin-top:24px">Present your QR code at the event venue for check-in.</p>
      </div>
    </div>`;
}

function generateCancellationHtml(booking: Record<string, unknown>, refund: Record<string, unknown> | null): string {
  const refundInfo = refund
    ? `<p>Refund amount: <strong>₹${Number(refund.refund_amount).toLocaleString("en-IN")}</strong> (${refund.refund_percentage}% minus 5% processing fee)</p>`
    : `<p>No refund is applicable for this cancellation.</p>`;

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#EF5350;color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">Booking Cancelled</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px">
        <p>Hi <strong>${booking.user_name}</strong>,</p>
        <p>Your booking for <strong>${(booking as Record<string, Record<string, unknown>>).events?.title || "Event"}</strong> has been cancelled.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666">Booking ID</td><td style="padding:8px 0;font-weight:600">${(booking.id as string)?.slice(0, 8)}...</td></tr>
          <tr><td style="padding:8px 0;color:#666">Original Amount</td><td style="padding:8px 0;font-weight:600">₹${Number(booking.total).toLocaleString("en-IN")}</td></tr>
        </table>
        ${refundInfo}
        <p style="color:#666;font-size:13px;margin-top:24px">If you have any questions, please contact our support team.</p>
      </div>
    </div>`;
}

function generateRefundStatusHtml(booking: Record<string, unknown>, refund: Record<string, unknown>): string {
  const statusColor = refund.status === "approved" ? "#4CAF50" : "#EF5350";
  const statusText = refund.status === "approved" ? "Approved" : "Rejected";

  return `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:${statusColor};color:#fff;padding:24px;border-radius:12px 12px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">Refund ${statusText}</h1>
      </div>
      <div style="background:#f9f9f9;padding:24px;border:1px solid #eee;border-radius:0 0 12px 12px">
        <p>Hi <strong>${booking.user_name}</strong>,</p>
        <p>Your refund request for <strong>${(booking as Record<string, Record<string, unknown>>).events?.title || "Event"}</strong> has been <strong>${statusText.toLowerCase()}</strong>.</p>
        ${refund.status === "approved"
          ? `<p>Refund amount of <strong>₹${Number(refund.refund_amount).toLocaleString("en-IN")}</strong> will be credited to your original payment method within 5-7 business days.</p>`
          : `<p>Your booking remains active. If you have questions about this decision, please contact support.</p>`
        }
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const supabase = createServiceClient();

    const authResult = await authenticateUser(req, supabase);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const { allowed, retryAfterMs } = checkRateLimit(req, user.id, RATE_LIMITS.email);
    if (!allowed) return rateLimitResponse(retryAfterMs);

    const { type, booking_id, extra }: EmailPayload = await req.json();

    if (!type || !booking_id) {
      return jsonResponse({ error: "type and booking_id are required" }, 400);
    }
    if (!isValidUUID(booking_id)) {
      return jsonResponse({ error: "Invalid booking_id format" }, 400);
    }

    // Fetch booking with related data
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        events ( title, venue, city, event_date, event_time ),
        packages ( name ),
        family_members ( full_name, age, gender, is_child ),
        member_tickets ( id, qr_code, status, qr_status )
      `)
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return jsonResponse({ error: "Booking not found" }, 404);
    }

    let subject = "";
    let html = "";
    const toEmail = booking.email;

    switch (type) {
      case "booking_confirmation": {
        subject = `Booking Confirmed — ${booking.events?.title || "Event Nation"}`;
        html = generateBookingConfirmationHtml(booking, booking.family_members || []);
        break;
      }
      case "ticket_delivery": {
        subject = `Your Tickets — ${booking.events?.title || "Event Nation"}`;
        html = generateTicketDeliveryHtml(booking, booking.member_tickets || []);
        break;
      }
      case "cancellation_confirmation": {
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("*")
          .eq("booking_id", booking_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        subject = `Booking Cancelled — ${booking.events?.title || "Event Nation"}`;
        html = generateCancellationHtml(booking, refund);
        break;
      }
      case "refund_status": {
        const { data: refund } = await supabase
          .from("refund_requests")
          .select("*")
          .eq("booking_id", booking_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!refund) {
          return jsonResponse({ error: "No refund request found" }, 404);
        }

        subject = `Refund ${refund.status === "approved" ? "Approved" : "Update"} — ${booking.events?.title || "Event Nation"}`;
        html = generateRefundStatusHtml(booking, refund);
        break;
      }
      default:
        return jsonResponse({ error: `Unknown email type: ${type}` }, 400);
    }

    // Send email via Resend (or log if no API key configured)
    if (!RESEND_API_KEY) {
      console.log(`[EMAIL] Would send to ${toEmail}: ${subject}`);
      return jsonResponse({
        success: true,
        message: "Email logged (no RESEND_API_KEY configured)",
        to: toEmail,
        subject,
      });
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errBody = await emailResponse.text();
      return jsonResponse({ error: "Email send failed", details: errBody }, 502);
    }

    const emailResult = await emailResponse.json();

    return jsonResponse({
      success: true,
      email_id: emailResult.id,
      to: toEmail,
      subject,
    });
  } catch (err) {
    return jsonResponse(
      { error: "Internal server error", details: String(err) },
      500
    );
  }
});
