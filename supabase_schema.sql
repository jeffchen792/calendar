-- Run this in Supabase SQL Editor

-- Pairs: one row per couple
CREATE TABLE pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Users: each person in a pair
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT DEFAULT 'us' CHECK (type IN ('you','me','us')),
  repeat TEXT,
  emoji TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notes / 小紙條
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  from_user UUID REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Miss-you pings
CREATE TABLE pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  from_user UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_events_pair_date ON events(pair_id, date);
CREATE INDEX idx_users_pair ON users(pair_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE events, notes, pings;

-- Enable RLS
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pings ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see their own pair's data
CREATE POLICY "pair_access" ON pairs FOR ALL USING (
  id IN (SELECT pair_id FROM users WHERE id = auth.uid())
  OR auth.uid() IS NULL  -- allow anon key access (dev mode)
);

CREATE POLICY "user_access" ON users FOR ALL USING (
  pair_id IN (SELECT pair_id FROM users WHERE id = auth.uid())
  OR auth.uid() IS NULL
);

CREATE POLICY "event_access" ON events FOR ALL USING (
  pair_id IN (SELECT pair_id FROM users WHERE id = auth.uid())
  OR auth.uid() IS NULL
);

CREATE POLICY "note_access" ON notes FOR ALL USING (
  pair_id IN (SELECT pair_id FROM users WHERE id = auth.uid())
  OR auth.uid() IS NULL
);

CREATE POLICY "ping_access" ON pings FOR ALL USING (
  pair_id IN (SELECT pair_id FROM users WHERE id = auth.uid())
  OR auth.uid() IS NULL
);
