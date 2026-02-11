-- Admin-managed categories (used in filters and event form)
-- Run once on your Postgres database.

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories (sort_order, name);

-- Seed from existing events so current categories appear
INSERT INTO categories (name, sort_order)
SELECT DISTINCT category, 0
FROM events
WHERE category IS NOT NULL AND TRIM(category) != ''
ON CONFLICT (name) DO NOTHING;
