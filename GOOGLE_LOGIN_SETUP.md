# Google 登入設定教學（兩人份，免費）

照著做約 10 分鐘。做完跟 Claude 說一聲，就可以把邀請碼流程換成 Gmail 登入。

## 第 0 步：先拿到 Supabase 的 Callback URL

1. 開 [Supabase Dashboard](https://supabase.com/dashboard) → 選你的專案
2. 左側 **Authentication** → **Sign In / Providers** → 找到 **Google** 點開
3. 先不要填任何東西，**複製最下面的 Callback URL**，長得像：
   ```
   https://xxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```
   等一下 Google 那邊會用到。這個分頁先不要關。

## 第 1 步：Google Cloud Console 建立專案

1. 開 [console.cloud.google.com](https://console.cloud.google.com)，用你自己的 Gmail 登入
2. 上方專案選單 → **建立專案**，名稱隨便取（例如 `cosmic-calendar`）→ 建立
3. 確認左上角已切換到這個新專案

## 第 2 步：設定 OAuth 同意畫面

1. 左側選單 → **API 和服務** → **OAuth 同意畫面**（新版介面叫 **Google Auth Platform**）
2. 應用程式名稱：`Cosmic`（登入視窗上會顯示這個名字）
3. 使用者支援電子郵件：選你的 Gmail
4. 目標對象（Audience）：選 **外部 (External)**
5. 聯絡資訊：填你的 Gmail → 完成建立
6. 到 **目標對象 / 測試使用者（Test users）** 區塊 → **新增使用者** →
   把 **你和女友的兩個 Gmail** 都加進去
   （維持「測試中」狀態就好，不用送審查——測試名單內的帳號可以直接登入，剛好就你們兩個）

## 第 3 步：建立 OAuth 用戶端 ID

1. 左側 → **API 和服務** → **憑證** → **建立憑證** → **OAuth 用戶端 ID**
2. 應用程式類型：**網頁應用程式**
3. 名稱隨便取
4. **已授權的 JavaScript 來源** 加兩個：
   - `http://localhost:5173`（本機開發用）
   - 你的 Vercel 網址：`https://calendar-iota-pearl.vercel.app`
5. **已授權的重新導向 URI** 加一個：
   - 貼上第 0 步複製的 Supabase Callback URL
6. 建立 → 會跳出 **用戶端 ID** 和 **用戶端密鑰（Client Secret）**，兩個都複製起來

## 第 4 步：回 Supabase 啟用 Google

1. 回到第 0 步那個 Google Provider 設定頁
2. 開啟 **Enable Sign in with Google**
3. 貼上 **Client ID** 和 **Client Secret** → **Save**

## 第 5 步：設定網址白名單

1. Supabase 左側 **Authentication** → **URL Configuration**
2. **Site URL**：填 `https://calendar-iota-pearl.vercel.app`
3. **Redirect URLs** 加上：
   - `http://localhost:5173/**`
   - `https://calendar-iota-pearl.vercel.app/**`

## 完成後

跟 Claude 說「Google 設定好了」，會幫你改程式：

- 首頁換成「用 Google 登入」按鈕
- 程式裡寫死你們兩個人的 Gmail，登入後自動配對，不再需要邀請碼
- 換手機、清瀏覽器資料都不會掉資料——身分跟著 Gmail 走
