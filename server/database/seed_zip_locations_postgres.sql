-- ============================================
-- Seed ZIP code locations (Postgres)
-- Run after postgres_bootstrap.sql
-- Uses ON CONFLICT DO NOTHING (equivalent to INSERT IGNORE)
-- ============================================

INSERT INTO zip_locations (zip_code, lat, lng, city, state) VALUES
('10001', 40.7506, -73.9973, 'New York', 'NY'),
('10002', 40.7158, -73.9870, 'New York', 'NY'),
('90210', 34.0901, -118.4065, 'Beverly Hills', 'CA'),
('94102', 37.7749, -122.4194, 'San Francisco', 'CA'),
('60601', 41.8781, -87.6298, 'Chicago', 'IL'),
('02101', 42.3601, -71.0589, 'Boston', 'MA'),
('75201', 32.7767, -96.7970, 'Dallas', 'TX'),
('30301', 33.7490, -84.3880, 'Atlanta', 'GA'),
('98101', 47.6062, -122.3321, 'Seattle', 'WA'),
('80202', 39.7392, -104.9903, 'Denver', 'CO'),
('02910', 41.8236, -71.4222, 'Providence', 'RI'),
('02806', 41.7001, -71.4162, 'Barrington', 'RI'),
('02818', 41.4901, -71.3128, 'East Greenwich', 'RI'),
('02840', 41.4882, -71.5346, 'Narragansett', 'RI'),
('02885', 41.4840, -71.4128, 'Warwick', 'RI'),
('02886', 41.7001, -71.4162, 'Warwick', 'RI'),
('02888', 41.8236, -71.4222, 'West Warwick', 'RI'),
('02895', 41.4901, -71.3128, 'Westerly', 'RI'),
('33101', 25.7617, -80.1918, 'Miami', 'FL'),
('77001', 29.7604, -95.3698, 'Houston', 'TX'),
('85001', 33.4484, -112.0740, 'Phoenix', 'AZ'),
('97201', 45.5152, -122.6784, 'Portland', 'OR'),
('78701', 30.2672, -97.7431, 'Austin', 'TX'),
('20001', 38.9072, -77.0369, 'Washington', 'DC'),
('19101', 39.9526, -75.1652, 'Philadelphia', 'PA'),
('48201', 42.3314, -83.0458, 'Detroit', 'MI'),
('55401', 44.9778, -93.2650, 'Minneapolis', 'MN'),
('70112', 29.9511, -90.0715, 'New Orleans', 'LA')
ON CONFLICT (zip_code) DO NOTHING;
