-- Migration: Production hardening — constraints, indexes, and audit logging
-- Run this against your Supabase SQL editor

-- ============================================================
-- 1. UNIQUE constraint on qr_code to prevent collisions
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_tickets_qr_code_unique
  ON member_tickets(qr_code);

-- ============================================================
-- 2. Prevent duplicate payment records per order
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_order_unique
  ON payments(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- ============================================================
-- 3. Prevent duplicate refund requests per booking
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_refund_requests_booking_pending
  ON refund_requests(booking_id)
  WHERE status = 'pending';

-- ============================================================
-- 4. Payment events audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL
    CHECK (event_type IN (
      'order_created', 'payment_initiated', 'payment_verified',
      'payment_failed', 'refund_initiated', 'refund_completed',
      'refund_failed', 'refund_rejected'
    )),
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_refund_id VARCHAR(255),
  amount NUMERIC(10, 2),
  status VARCHAR(50),
  metadata JSONB,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_booking_id ON payment_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events(created_at);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_events_select ON payment_events;
CREATE POLICY payment_events_select ON payment_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS payment_events_insert ON payment_events;
CREATE POLICY payment_events_insert ON payment_events FOR INSERT WITH CHECK (true);

-- ============================================================
-- 5. Add 'inactive' to member_tickets status CHECK constraint
-- ============================================================
ALTER TABLE member_tickets DROP CONSTRAINT IF EXISTS member_tickets_status_check;
ALTER TABLE member_tickets ADD CONSTRAINT member_tickets_status_check
  CHECK (status IN ('active', 'inactive', 'used', 'cancelled'));

-- ============================================================
-- 6. Booking status: ensure only valid transitions
-- ============================================================
CREATE OR REPLACE FUNCTION validate_booking_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot change status of a cancelled booking';
  END IF;

  IF OLD.payment_status = 'paid' AND NEW.payment_status = 'unpaid' THEN
    RAISE EXCEPTION 'Cannot revert paid booking to unpaid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_status_transition ON bookings;
CREATE TRIGGER booking_status_transition
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION validate_booking_status_transition();

-- ============================================================
-- 7. Check-in logging trigger
-- ============================================================
CREATE OR REPLACE FUNCTION log_checkin_event()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.qr_status = 'active' AND NEW.qr_status = 'used' THEN
    INSERT INTO payment_events (
      booking_id, event_type, actor_id, metadata
    ) VALUES (
      NEW.booking_id,
      'payment_verified',
      NEW.checked_in_by,
      jsonb_build_object(
        'ticket_id', NEW.id,
        'member_id', NEW.member_id,
        'checked_in_at', NEW.checked_in_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_checkin ON member_tickets;
CREATE TRIGGER on_ticket_checkin
  AFTER UPDATE ON member_tickets
  FOR EACH ROW EXECUTE FUNCTION log_checkin_event();

-- ============================================================
-- 8. Ensure member count constraints at DB level
-- ============================================================
CREATE OR REPLACE FUNCTION validate_member_count()
RETURNS TRIGGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO member_count
  FROM family_members
  WHERE booking_id = NEW.booking_id;

  IF member_count > 10 THEN
    RAISE EXCEPTION 'Maximum 10 members per booking';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_member_count ON family_members;
CREATE TRIGGER check_member_count
  AFTER INSERT ON family_members
  FOR EACH ROW EXECUTE FUNCTION validate_member_count();

-- ============================================================
-- 9. Add NOT NULL constraint on critical timestamp columns
-- ============================================================
ALTER TABLE bookings
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE payments
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;
