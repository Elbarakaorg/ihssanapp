-- DEVELOPMENT ONLY. Fictional listings so the care directory map has pins.
-- Run in the Supabase SQL editor. Never run against real production data.
-- Uses the first existing user as the verifier (create an account first).
with reviewer as (select id from auth.users order by created_at limit 1)
insert into public.care_providers
  (kind, name, specialty, city, address, phone, opening_hours, latitude, longitude, status, verified_by, verified_at)
select v.kind, v.name, v.specialty, v.city, v.address, v.phone, v.hours, v.lat, v.lng, 'verified', reviewer.id, now()
from reviewer,
(values
  ('doctor',   'Dr. Test Alaoui (fictional)',   'General medicine', 'Casablanca', 'Boulevard Zerktouni',     '+212 600 000 001', 'Mon-Fri 09:00-17:00', 33.5883, -7.6310),
  ('pharmacy', 'Pharmacie Test Atlas (fictional)', null,         'Casablanca', 'Rue Moulay Youssef',       '+212 600 000 002', 'Daily 08:30-21:00',   33.5922, -7.6187),
  ('doctor',   'Dr. Test Bennani (fictional)',  'Cardiology',       'Rabat',      'Avenue Mohammed V',        '+212 600 000 003', 'Mon-Sat 10:00-18:00', 34.0209, -6.8416),
  ('pharmacy', 'Pharmacie Test Agdal (fictional)', null,         'Rabat',      'Rue Oued Fes, Agdal',      '+212 600 000 004', 'Daily 09:00-22:00',   33.9934, -6.8499),
  ('doctor',   'Dr. Test Idrissi (fictional)',  'Pediatrics',       'Marrakech',  'Avenue Mohammed VI',       '+212 600 000 005', 'Mon-Fri 09:00-16:00', 31.6295, -7.9811),
  ('pharmacy', 'Pharmacie Test Gueliz (fictional)', null,        'Marrakech',  'Rue de la Liberte, Gueliz','+212 600 000 006', 'Daily 08:00-23:00',   31.6350, -8.0089)
) as v(kind, name, specialty, city, address, phone, hours, lat, lng);
