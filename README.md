# Cosmic ✦ 雙星日曆

情侶的共享星系日曆 — 你們的時間是一個共同的世界。

## 架構
```
你 ←→ Vercel (前端) ←→ Supabase (資料庫 + Realtime)
女友 ←→ Vercel (前端) ←→ Supabase (資料庫 + Realtime)
```
- **Vercel**：託管 React 前端，`calendar-iota-pearl.vercel.app`
- **Supabase**：Postgres 資料庫 + 即時同步，不用自己寫後端

## 技術棧
Vite + React 19 / Tailwind CSS v3 / Zustand / Supabase (Realtime)

## 功能
- [x] 雙人配對（邀請碼）
- [x] TimeTree 風格月曆 + 列表
- [x] 事件 CRUD（你/他/我們、週期性）
- [x] 表情回應
- [x] 心情天氣
- [x] 想你按鈕（光點 ping）
- [x] 去年的今天
- [x] 照片漂浮背景 + 視差
- [x] Supabase 即時同步

## Phase 2（之後）
- [ ] 雙星軌道 3D 場景
- [ ] 每日小紙條
- [ ] 紀念日合體動畫

## 環境變數
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

## 部署
```bash
git push  # → Vercel 自動部署
```
