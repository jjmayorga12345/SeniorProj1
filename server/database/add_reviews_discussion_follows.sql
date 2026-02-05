-- Eventure: Reviews, Discussion, and Follow Organizers
-- Run once on your Postgres database (e.g. Neon).

-- event_reviews: ratings and optional comment/photo for past events
CREATE TABLE IF NOT EXISTS event_reviews (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NULL,
  photo_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reviews_event_id ON event_reviews (event_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_user_id ON event_reviews (user_id);

-- event_discussion: discussion posts per event (Q&A, carpools, etc.)
CREATE TABLE IF NOT EXISTS event_discussion (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_discussion_event_id ON event_discussion (event_id);
CREATE INDEX IF NOT EXISTS idx_event_discussion_created_at ON event_discussion (created_at);

-- follows: user follows organizer (get notified when organizer posts new event)
CREATE TABLE IF NOT EXISTS follows (
  follower_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows (following_id);
