-- Seed data for development/testing
-- Profile rows require a matching auth.users entry in Supabase.
-- The admin user below must be created via Supabase Auth first.

-- Admin profile (must match a real Supabase auth.users row)
INSERT INTO profiles (id, full_name, phone, email) VALUES
  ('80b02701-7382-4f0c-bab0-8616ffd81a92', 'Admin User', '+91-9999999999', 'admin@eventnation.in')
ON CONFLICT (id) DO NOTHING;

-- Assign admin role
INSERT INTO user_roles (user_id, role) VALUES
  ('80b02701-7382-4f0c-bab0-8616ffd81a92', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Sample Events
INSERT INTO events (id, title, description, venue, city, event_date, event_time, banner) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Bollywood Night 2026', 'A grand Bollywood music and dance night featuring top artists.', 'JLN Stadium', 'Delhi', '2026-06-15', '18:00', 'https://example.com/banners/bollywood-night.jpg'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Tech Summit India', 'India''s largest technology conference with 50+ speakers.', 'HICC Convention Centre', 'Hyderabad', '2026-07-20', '09:00', 'https://example.com/banners/tech-summit.jpg'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Comedy Fest', 'Stand-up comedy festival with India''s best comedians.', 'Phoenix Marketcity', 'Mumbai', '2026-05-10', '19:30', 'https://example.com/banners/comedy-fest.jpg')
ON CONFLICT (id) DO NOTHING;

-- Packages for Bollywood Night
INSERT INTO packages (event_id, name, base_price, max_adults, max_kids, extra_adult_price) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Platinum', 5000.00, 2, 2, 2500.00),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Gold', 3000.00, 2, 2, 1500.00),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Silver', 1500.00, 2, 2, 750.00);

-- Packages for Tech Summit
INSERT INTO packages (event_id, name, base_price, max_adults, max_kids, extra_adult_price) VALUES
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'VIP', 8000.00, 2, 2, 4000.00),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Standard', 4000.00, 2, 2, 2000.00);

-- Packages for Comedy Fest
INSERT INTO packages (event_id, name, base_price, max_adults, max_kids, extra_adult_price) VALUES
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Premium', 2000.00, 2, 2, 1000.00),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Regular', 800.00, 2, 2, 400.00);
