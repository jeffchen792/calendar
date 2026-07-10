-- Fix: pairs & users: open for bootstrapping; events/notes/pings: locked by pair_id
DROP POLICY IF EXISTS "pair_access" ON pairs;
DROP POLICY IF EXISTS "user_access" ON users;
DROP POLICY IF EXISTS "event_access" ON events;
DROP POLICY IF EXISTS "note_access" ON notes;
DROP POLICY IF EXISTS "ping_access" ON pings;

-- Bootstrapping tables: open (no sensitive data in pairs/users)
CREATE POLICY "pair_access" ON pairs FOR ALL USING (true);
CREATE POLICY "user_access" ON users FOR ALL USING (true);

-- Data tables: SECURITY DEFINER function to find user's pair
CREATE OR REPLACE FUNCTION my_pair_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
AS $$ SELECT pair_id FROM users WHERE id = auth.uid() LIMIT 1; $$;

CREATE POLICY "event_access" ON events FOR ALL USING (pair_id = my_pair_id());
CREATE POLICY "note_access" ON notes FOR ALL USING (pair_id = my_pair_id());
CREATE POLICY "ping_access" ON pings FOR ALL USING (pair_id = my_pair_id());
