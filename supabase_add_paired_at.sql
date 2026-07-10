-- 補上 pairs 表缺少的 paired_at 欄位。
-- 目前「在一起的第一天」只存在使用者自己的 localStorage，
-- 兩人看到的日期完全沒有同步——這行 migration 讓它變成配對層級的共享資料。
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS paired_at DATE;
