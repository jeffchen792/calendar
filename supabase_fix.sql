-- Fix: simplified RLS to avoid infinite recursion with anon key

-- Drop old policies first
DROP POLICY IF EXISTS "pair_access" ON pairs;
DROP POLICY IF EXISTS "user_access" ON users;
DROP POLICY IF EXISTS "event_access" ON events;
DROP POLICY IF EXISTS "note_access" ON notes;
DROP POLICY IF EXISTS "ping_access" ON pings;

-- Simple policies: allow all with anon key (dev mode)
CREATE POLICY "pair_access" ON pairs FOR ALL USING (true);
CREATE POLICY "user_access" ON users FOR ALL USING (true);
CREATE POLICY "event_access" ON events FOR ALL USING (true);
CREATE POLICY "note_access" ON notes FOR ALL USING (true);
CREATE POLICY "ping_access" ON pings FOR ALL USING (true);
