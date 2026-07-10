-- v5：Google 登入
-- 到 Supabase Dashboard → SQL Editor 貼上執行一次

-- users 加 email 欄位：用來認 Google 帳號。
-- 自動配對只認 email 非空的成員，舊的匿名測試配對一律略過，不會誤配。
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
