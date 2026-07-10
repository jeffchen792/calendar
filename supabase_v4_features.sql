-- v4：事件時間 + 共同清單
-- 到 Supabase Dashboard → SQL Editor 貼上整段執行一次

-- 事件加上時間欄位（選填）
ALTER TABLE events ADD COLUMN IF NOT EXISTS time TIME;

-- 共同清單（想吃 / 想去 / 想看 / 其他）
CREATE TABLE IF NOT EXISTS list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  category TEXT DEFAULT 'other' CHECK (category IN ('eat','go','watch','other')),
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_list_items_pair ON list_items(pair_id, done);

-- RLS：沿用 v3 的 my_pair_id()，只看得到自己配對的清單
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "list_access" ON list_items;
CREATE POLICY "list_access" ON list_items FOR ALL USING (pair_id = my_pair_id());

-- 即時同步
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
