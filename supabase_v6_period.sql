-- v6：經期追蹤
-- 到 Supabase Dashboard → SQL Editor 貼上整段執行一次

CREATE TABLE IF NOT EXISTS period_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pair_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_period_logs_pair ON period_logs(pair_id, start_date);

ALTER TABLE period_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "period_access" ON period_logs;
CREATE POLICY "period_access" ON period_logs FOR ALL USING (pair_id = my_pair_id());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE period_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
