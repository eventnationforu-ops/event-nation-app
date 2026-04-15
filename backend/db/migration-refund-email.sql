-- Migration: Add refund processing and email tracking fields
-- Run this against your Supabase SQL editor

-- 1. Add admin tracking fields to refund_requests
ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS razorpay_refund_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_refund_requests_admin_id
  ON refund_requests(admin_id);

-- 2. Email log table for tracking notifications
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL
    CHECK (email_type IN (
      'booking_confirmation',
      'ticket_delivery',
      'cancellation_confirmation',
      'refund_status'
    )),
  recipient VARCHAR(255) NOT NULL,
  subject TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'pending')),
  external_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_booking_id ON email_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_logs_select ON email_logs;
CREATE POLICY email_logs_select ON email_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS email_logs_insert ON email_logs;
CREATE POLICY email_logs_insert ON email_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  OR EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = email_logs.booking_id
    AND bookings.user_id = auth.uid()
  )
);

-- 3. Update refund_requests RLS to allow admin updates
DROP POLICY IF EXISTS refund_requests_update ON refund_requests;
CREATE POLICY refund_requests_update ON refund_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Events table should be public-readable (no auth required for listing)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_select ON events;
CREATE POLICY events_select ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS events_insert ON events;
CREATE POLICY events_insert ON events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS events_update ON events;
CREATE POLICY events_update ON events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Packages should be public-readable
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS packages_select ON packages;
CREATE POLICY packages_select ON packages FOR SELECT USING (true);

DROP POLICY IF EXISTS packages_insert ON packages;
CREATE POLICY packages_insert ON packages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 6. User roles select policy (users can check their own role)
DROP POLICY IF EXISTS user_roles_select ON user_roles;
CREATE POLICY user_roles_select ON user_roles FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);
