# Calendar 踩坑記錄

## 架構
```
女友手機 ──→ Vercel (靜態網站) ──→ Supabase (資料庫 + 即時同步)
  你手機 ──→ Vercel (靜態網站) ──→ Supabase (資料庫 + 即時同步)
```
- **Vercel**：託管前端（React + Vite），提供 HTTPS 網址
- **Supabase**：後端資料庫，即時 sync（Realtime），不用自己寫 server

## 坑 1：Vercel SSO 擋住公開存取
症狀：`jeff-calendar.vercel.app` 和 deploy preview 都要登入 Vercel 才能看。
解法：Vercel Dashboard → Settings → Deployment Protection → 關掉 Vercel Authentication。

## 坑 2：Supabase RLS 無限遞迴
症狀：`createPair` 報 `infinite recursion detected in policy for relation "users"`（500）。
原因：RLS policy 裡 `pair_id IN (SELECT pair_id FROM users WHERE id = auth.uid())` 在 anon key（`auth.uid() IS NULL`）下仍被 evaluate，造成遞迴。
解法：anon key 模式用最簡單的 `CREATE POLICY ... FOR ALL USING (true)`。

## 坑 3：邀請碼被 App 路由跳掉
症狀：`createPair` 成功後直接跳到 Dashboard，`showCode` 步驟被跳過。
原因：`createPair` 呼叫 `useAuth.setUser()`，App.jsx 看到 user 非空就 redirect `/dashboard`。
解法：在 Dashboard header 下方加邀請碼 banner，直到 partner 加入才消失。

## 坑 4：Supabase env var 命名
Vite 的 env var 必須 `VITE_` 前綴：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
用 `vercel env add` CLI 加比在 dashboard 手動加快。

## 部署指令
```bash
# 加環境變數
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production

# 部署
vercel --prod --yes
```
