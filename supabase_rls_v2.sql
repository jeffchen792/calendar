-- Proper RLS: use SECURITY DEFINER function to avoid recursion

-- 1. Enable anonymous auth (run first!)
-- Go to Supabase Dashboard → Authentication → Settings → Enable Anonymous Sign-ins

-- 2. Drop the old dangerous policies
DROP POLICY IF EXISTS "pair_access" ON pairs;
DROP POLICY IF EXISTS "user_access" ON users;
DROP POLICY IF EXISTS "event_access" ON events;
DROP POLICY IF EXISTS "note_access" ON notes;
DROP POLICY IF EXISTS "ping_access" ON pings;

-- 3. Security definer function — bypasses RLS on users table
CREATE OR REPLACE FUNCTION my_pair_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT pair_id FROM users WHERE id = auth.uid()
  UNION ALL
  SELECT pair_id FROM pairs WHERE code = current_setting('request.jwt.claims', true)::json->>'pair_code'
  LIMIT 1;
$$;

-- 4. Proper RLS policies using auth.uid() (no recursion)
CREATE POLICY "pair_access" ON pairs FOR ALL
  USING (id = my_pair_id());
CREATE POLICY "user_access" ON users FOR ALL
  USING (pair_id = my_pair_id());
CREATE POLICY "event_access" ON events FOR ALL
  USING (pair_id = my_pair_id());
CREATE POLICY "note_access" ON notes FOR ALL
  USING (pair_id = my_pair_id());
CREATE POLICY "ping_access" ON pings FOR ALL
  USING (pair_id = my_pair_id());
