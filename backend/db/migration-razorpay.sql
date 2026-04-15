-- Migration: Add Razorpay payment fields and check-in tracking
-- Run this against your Supabase SQL editor

-- 1. Add Razorpay fields to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS razorpay_signature TEXT,
  ADD COLUMN IF NOT EXISTS method VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order
  ON payments(razorpay_order_id);

-- 2. Add check-in timestamp to member_tickets
ALTER TABLE member_tickets
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_member_tickets_qr_code
  ON member_tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_member_tickets_qr_status
  ON member_tickets(qr_status);

-- 3. Insert policy for member_tickets (edge function uses service role,
--    but if client needs to insert during booking creation)
DROP POLICY IF EXISTS member_tickets_insert ON member_tickets;
CREATE POLICY member_tickets_insert ON member_tickets FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = member_tickets.booking_id
    AND bookings.user_id = auth.uid()
  )
);

-- 4. Insert policy for payments
DROP POLICY IF EXISTS payments_insert ON payments;
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = payments.booking_id
    AND bookings.user_id = auth.uid()
  )
);

-- 5. Update policy for payments (admin only for status changes)
DROP POLICY IF EXISTS payments_update ON payments;
CREATE POLICY payments_update ON payments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 6. RPC function for atomic check-in (called by edge function or admin client)
CREATE OR REPLACE FUNCTION checkin_ticket(p_ticket_id UUID)
RETURNS JSON AS $$
DECLARE
  v_ticket RECORD;
  v_member RECORD;
  v_booking RECORD;
BEGIN
  SELECT * INTO v_ticket FROM member_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.qr_status = 'used' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Already checked in',
      'checked_in_at', v_ticket.checked_in_at
    );
  END IF;

  IF v_ticket.qr_status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Ticket is cancelled');
  END IF;

  IF v_ticket.qr_status = 'expired' THEN
    RETURN json_build_object('success', false, 'error', 'Ticket has expired');
  END IF;

  IF v_ticket.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Ticket is not active');
  END IF;

  UPDATE member_tickets
  SET qr_status = 'used',
      status = 'used',
      checked_in_at = NOW(),
      checked_in_by = auth.uid()
  WHERE id = p_ticket_id;

  SELECT * INTO v_member FROM family_members WHERE id = v_ticket.member_id;
  SELECT * INTO v_booking FROM bookings WHERE id = v_ticket.booking_id;

  RETURN json_build_object(
    'success', true,
    'ticket_id', v_ticket.id,
    'member_name', v_member.full_name,
    'member_age', v_member.age,
    'member_gender', v_member.gender,
    'booking_id', v_booking.id,
    'event_id', v_ticket.event_id,
    'checked_in_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
