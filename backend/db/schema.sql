-- Event Nation Database Schema (Supabase)
-- Profiles.id and all user_id FKs reference auth.users(id).
-- RLS policies use auth.uid().
-- Run: node db/init.js

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES (mirrors Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================
-- 2. USER ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- ============================================
-- 3. EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  venue VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  banner TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. PACKAGES
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL,
  max_adults INTEGER NOT NULL DEFAULT 2,
  max_kids INTEGER NOT NULL DEFAULT 2,
  extra_adult_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packages_event_id ON packages(event_id);

-- ============================================
-- 5. BOOKINGS
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id),
  package_id UUID NOT NULL REFERENCES packages(id),
  subtotal NUMERIC(10, 2) NOT NULL,
  gst NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'cancel_pending')),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial_refund')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- ============================================
-- 6. FAMILY MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR(20) NOT NULL,
  is_child BOOLEAN NOT NULL DEFAULT FALSE,
  id_proof_url TEXT,
  face_photo_url TEXT,
  id_verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (id_verification_status IN ('pending', 'verified', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_members_booking_id ON family_members(booking_id);

-- ============================================
-- 7. MEMBER TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS member_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id),
  qr_code VARCHAR(255) NOT NULL,
  qr_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (qr_status IN ('active', 'used', 'cancelled', 'expired')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_tickets_member_id ON member_tickets(member_id);
CREATE INDEX IF NOT EXISTS idx_member_tickets_booking_id ON member_tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_member_tickets_event_id ON member_tickets(event_id);

-- ============================================
-- 8. PAYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);

-- ============================================
-- 9. REFUND REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  refund_percentage NUMERIC(5, 2) NOT NULL,
  refund_amount NUMERIC(10, 2) NOT NULL,
  processing_fee NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_booking_id ON refund_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

-- ============================================
-- 10. AUTO-CREATE PROFILE ON SIGNUP (trigger)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 11. RLS POLICIES (all use auth.uid())
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- Profiles --------------------------------------------------------
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (
  id = auth.uid()
);

-- Bookings --------------------------------------------------------
DROP POLICY IF EXISTS bookings_select ON bookings;
CREATE POLICY bookings_select ON bookings FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS bookings_insert ON bookings;
CREATE POLICY bookings_insert ON bookings FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS bookings_update ON bookings;
CREATE POLICY bookings_update ON bookings FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Family members --------------------------------------------------
DROP POLICY IF EXISTS family_members_select ON family_members;
CREATE POLICY family_members_select ON family_members FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = family_members.booking_id
    AND (bookings.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  )
);

DROP POLICY IF EXISTS family_members_insert ON family_members;
CREATE POLICY family_members_insert ON family_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = family_members.booking_id
    AND bookings.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS family_members_update ON family_members;
CREATE POLICY family_members_update ON family_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = family_members.booking_id
    AND (bookings.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  )
);

-- Member tickets --------------------------------------------------
DROP POLICY IF EXISTS member_tickets_select ON member_tickets;
CREATE POLICY member_tickets_select ON member_tickets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = member_tickets.booking_id
    AND (bookings.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  )
);

DROP POLICY IF EXISTS member_tickets_update ON member_tickets;
CREATE POLICY member_tickets_update ON member_tickets FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = member_tickets.booking_id
    AND (bookings.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  )
);

-- Payments --------------------------------------------------------
DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = payments.booking_id
    AND (bookings.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  )
);

-- Refund requests -------------------------------------------------
DROP POLICY IF EXISTS refund_requests_select ON refund_requests;
CREATE POLICY refund_requests_select ON refund_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = refund_requests.booking_id
    AND (bookings.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  )
);

DROP POLICY IF EXISTS refund_requests_insert ON refund_requests;
CREATE POLICY refund_requests_insert ON refund_requests FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = refund_requests.booking_id
    AND bookings.user_id = auth.uid()
  )
);
