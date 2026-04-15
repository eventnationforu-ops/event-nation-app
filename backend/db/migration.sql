-- Migration: Fix Supabase auth.users ownership
-- Links profiles, bookings, user_roles to auth.users(id).
-- Backfills existing bookings. Rewrites RLS to use auth.uid().
-- Safe to run multiple times (all statements are idempotent).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. RENAME old tables if needed
-- ============================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'family_members')
  THEN
    ALTER TABLE members RENAME TO family_members;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'member_tickets')
  THEN
    ALTER TABLE tickets RENAME TO member_tickets;
  END IF;
END $$;

-- ============================================
-- 2. PROFILES → FK to auth.users
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop old self-generated default if present, re-point PK to auth.users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 3. USER_ROLES → FK to auth.users
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Drop old FK to profiles if exists, add FK to auth.users
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_user_id_fkey' AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_fkey;
  END IF;
  ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. BOOKINGS → user_id FK to auth.users
-- ============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';

-- Drop old FK to profiles if exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bookings_user_id_fkey' AND table_name = 'bookings'
  ) THEN
    ALTER TABLE bookings DROP CONSTRAINT bookings_user_id_fkey;
  END IF;
END $$;

-- Add FK to auth.users
ALTER TABLE bookings
  ADD CONSTRAINT bookings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill orphaned bookings to the known Supabase user
UPDATE bookings
SET user_id = '80b02701-7382-4f0c-bab0-8616ffd81a92'
WHERE user_id IS NULL;

-- payment_status check constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_payment_status_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
      CHECK (payment_status IN ('unpaid', 'paid', 'refunded', 'partial_refund'));
  END IF;
END $$;

-- ============================================
-- 5. FAMILY_MEMBERS → new columns
-- ============================================
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS id_verification_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS admin_notes TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_members_id_verification_status_check'
  ) THEN
    ALTER TABLE family_members ADD CONSTRAINT family_members_id_verification_status_check
      CHECK (id_verification_status IN ('pending', 'verified', 'rejected'));
  END IF;
END $$;

-- ============================================
-- 6. MEMBER_TICKETS → new columns
-- ============================================
ALTER TABLE member_tickets ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE;
ALTER TABLE member_tickets ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);
ALTER TABLE member_tickets ADD COLUMN IF NOT EXISTS qr_status VARCHAR(20) DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_tickets_qr_status_check'
  ) THEN
    ALTER TABLE member_tickets ADD CONSTRAINT member_tickets_qr_status_check
      CHECK (qr_status IN ('active', 'used', 'cancelled', 'expired'));
  END IF;
END $$;

-- Backfill booking_id and event_id from family_members → bookings
UPDATE member_tickets
SET booking_id = fm.booking_id
FROM family_members fm
WHERE member_tickets.member_id = fm.id
  AND member_tickets.booking_id IS NULL;

UPDATE member_tickets
SET event_id = b.event_id
FROM family_members fm
JOIN bookings b ON b.id = fm.booking_id
WHERE member_tickets.member_id = fm.id
  AND member_tickets.event_id IS NULL;

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_family_members_booking_id ON family_members(booking_id);
CREATE INDEX IF NOT EXISTS idx_member_tickets_member_id ON member_tickets(member_id);
CREATE INDEX IF NOT EXISTS idx_member_tickets_booking_id ON member_tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_member_tickets_event_id ON member_tickets(event_id);

-- ============================================
-- 8. AUTO-CREATE PROFILE ON SIGNUP
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
-- 9. ENABLE RLS
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. RLS POLICIES (auth.uid())
-- ============================================

-- Drop old policies that used current_setting
DO $$ BEGIN
  DROP POLICY IF EXISTS profiles_owner_select ON profiles;
  DROP POLICY IF EXISTS bookings_owner_select ON bookings;
  DROP POLICY IF EXISTS family_members_owner_select ON family_members;
  DROP POLICY IF EXISTS member_tickets_owner_select ON member_tickets;
END $$;

-- Profiles
DROP POLICY IF EXISTS profiles_select ON profiles;
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (id = auth.uid());

-- Bookings
DROP POLICY IF EXISTS bookings_select ON bookings;
CREATE POLICY bookings_select ON bookings FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS bookings_insert ON bookings;
CREATE POLICY bookings_insert ON bookings FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS bookings_update ON bookings;
CREATE POLICY bookings_update ON bookings FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Family members
DROP POLICY IF EXISTS family_members_select ON family_members;
CREATE POLICY family_members_select ON family_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = family_members.booking_id
    AND (bookings.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')))
);

DROP POLICY IF EXISTS family_members_insert ON family_members;
CREATE POLICY family_members_insert ON family_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = family_members.booking_id AND bookings.user_id = auth.uid())
);

DROP POLICY IF EXISTS family_members_update ON family_members;
CREATE POLICY family_members_update ON family_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = family_members.booking_id
    AND (bookings.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')))
);

-- Member tickets
DROP POLICY IF EXISTS member_tickets_select ON member_tickets;
CREATE POLICY member_tickets_select ON member_tickets FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = member_tickets.booking_id
    AND (bookings.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')))
);

DROP POLICY IF EXISTS member_tickets_update ON member_tickets;
CREATE POLICY member_tickets_update ON member_tickets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = member_tickets.booking_id
    AND (bookings.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')))
);

-- Payments
DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = payments.booking_id
    AND (bookings.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')))
);

-- Refund requests
DROP POLICY IF EXISTS refund_requests_select ON refund_requests;
CREATE POLICY refund_requests_select ON refund_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = refund_requests.booking_id
    AND (bookings.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')))
);

DROP POLICY IF EXISTS refund_requests_insert ON refund_requests;
CREATE POLICY refund_requests_insert ON refund_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = refund_requests.booking_id AND bookings.user_id = auth.uid())
);
