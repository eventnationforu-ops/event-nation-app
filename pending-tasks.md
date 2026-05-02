## Phase 1.2 (Events System — investigate before building)

- **Live `events` table schema differs from handoff spec.** Real columns: `id`, `title`, `description`, `venue`, `city`, `event_date date`, `event_time time`, `banner`, `created_at`. Missing: `price_inr`, `capacity`, `cover_image_url`, `status`, `updated_at`. Pricing lives in a separate `packages` table (per-event tiers with `base_price`, `max_adults`, `max_kids`, `extra_adult_price`). Decide in Phase 1.2: (a) migrate to handoff spec and drop `packages`, OR (b) keep package-tier model and rewrite Phase 1.3 booking logic accordingly. Recommend (b) — packages are richer and already populated with 7 rows.
- **No `status` column on events.** Handoff assumed `draft|published|sold_out|cancelled`. Real table has none. Phase 1.2 needs to add this column or drop the "published only" filter.
- **`/api/events` returns 500 on Render.** Route is registered correctly (proven by 401 on `/api/auth/me`), but `pg.Pool` query crashes. Almost certainly `DATABASE_URL` on Render points to Supabase direct connection (`db.<ref>.supabase.co:5432`) which Render's IPv6-out env can't reach. Fix options: (1) swap to Supavisor pooler URL `aws-0-...pooler.supabase.com:6543`, or (2) migrate event endpoints from `pg.Pool` to `@supabase/supabase-js` REST client (avoids the issue entirely + gives RLS for free). Decide in Phase 1.2.

## Phase 1.3 (Booking System — schema mismatches)

- **Two competing member tables exist:** `members` (with `is_child`, `id_proof_url`, `face_photo_url`) and `family_members` (with `name`, `age`, `gender`, `id_verification_status`, `admin_notes`). Handoff names `family_members` as canonical but its real schema differs from handoff spec (no `full_name`, `id_proof_type`, `id_proof_number`). Pick one in Phase 1.3 and drop the other.
- **Two competing ticket tables exist:** `tickets` (with `member_id`, `qr_code`) and `member_tickets` (with `booking_id`, `event_id`, `qr_code`, `qr_status`). Handoff names `member_tickets` as canonical but real schema lacks `family_member_id`, `ticket_code`, `checked_in_at`, `checked_in_by`. Pick one in Phase 3 (tickets) and drop the other.
- **Bookings table differs from handoff:** real table has duplicated `user_name`, `phone`, `email` columns (denormalized from auth.users) and a required `package_id`. No `payment_status` column on bookings — payment status lives in `payments` table. No `updated_at`. Decide whether to keep denormalized fields and `package_id` requirement.

## Phase 2 (Roles + Admin Panel)

- **`user_roles` schema is missing `super_admin`.** Real check constraint: `role = ANY (ARRAY['admin', 'user'])`. Handoff specified `user|admin|super_admin`. Either expand the constraint in Phase 2 or drop `super_admin` from the spec.
- **`user_roles` PK is `id` (uuid) not `user_id`.** Handoff spec used `user_id` as PK. The real table has a separate `id` primary key with `user_id` as a nullable FK. Decide whether to migrate or adapt.
- Grant admin role to `eventnationforu@gmail.com` after that account signs up.

## Phase 3 (Razorpay prerequisites — Ayush)

- Apply for Razorpay merchant account (KYC, business bank, etc.)
- Privacy Policy live URL
- Terms of Service live URL
- Refund & Cancellation Policy live URL
- Contact Us with physical address live URL
- All 4 URLs submitted in Razorpay merchant dashboard
- Reconciliation scripts (orphan payments, stale pending bookings)

## Phase 3 (Pre-launch infra)

- Automated Supabase DB backups (daily, 30-day retention)
- Document + test restore procedure once

## Phase 4 (Hardening)

- Custom SMTP via Resend, custom email templates with branding
- Domain DNS setup (SPF, DKIM, DMARC)
- Mirror password validation server-side if backend signup endpoint added
- Clean up dead code: `frontend/src/apiService.js`
- Migrate error shape to `{ error: { code, message } }`
- Persist `NODE_OPTIONS=--no-experimental-strip-types` properly (or downgrade dev machine to Node 20 LTS) so `expo start` doesn't need the env-var prefix every time
- Build EAS dev clients (after Apple Developer account approved) — required because iOS Expo Go is 1+ SDK behind. Currently locked to Expo SDK 54 only because of this.

## Phase 4 (Pre-launch ops)

- Create separate Supabase project: `event-nation-staging`
- Separate Render service for staging backend
- Document env var differences between staging and prod

## Phase 4 (Frontend cleanup, separate commits)

- Several uncommitted frontend changes from prior sessions: `frontend/app.json` (plugin removal), `frontend/app/(auth)/login.jsx`, `frontend/app/(tabs)/profile.jsx`, `frontend/src/components/RazorpayCheckout.jsx`, `frontend/src/context/AuthContext.js`, `frontend/src/lib/supabase.js`, new `frontend/src/api.js`, new `frontend/src/lib/secureStoreAdapter.js`. Need triage and commits per feature in Phase 1.2/1.3 work.
- Untracked dead code: `frontend/src/apiService.js` — confirm dead, then delete.

## Long-tail (post-MVP)

- Push notifications
- Coupon/referral codes
- Refund automation
- Analytics dashboard
- Multi-language support
- Social login (Google/Apple)
- WhatsApp Business API for booking confirmations
