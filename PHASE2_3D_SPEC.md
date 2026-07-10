# Phase 2/3 執行規格：雙星軌道場景・每日小紙條・紀念日合體動畫

> 給 DeepSeek 的施工文件。架構決策已定案，照做即可，不要自行變更。
> 除錯時遵守 root-cause-first skill v3：先觀察、填除錯日誌表、驗證了才改。
> 每完成一個階段就停下來驗收，不要一次做完三個才測。

---

## 零、鐵則（違反任何一條 = 重做）

1. **Canvas 子樹絕不訂閱高頻變化的 React state。** 動畫資料（時間、進度、滑鼠）
   一律寫入 mutable 物件，由 `useFrame` 讀取。zustand 只用於低頻資料
   （事件列表、配對狀態），而且訂閱點放在 Canvas「外面」，用 props 傳入純資料。
2. **禁止 `events={() => undefined}`**（會靜默殺死 render loop）。
   本場景不需要 R3F 事件，Canvas 外層 div 加 `pointer-events-none` 即可；
   星球點擊用 DOM 按鈕疊在上面做，不用 raycasting。
3. **禁止把 three 實例 spread 進 JSX**（`<bufferGeometry {...geo}/>` ❌），
   用 `geometry={geo}` / `<primitive>`。
4. **`prefers-reduced-motion` 只降效果、不砍功能**（開發者本人的 Mac 就開著這個設定，
   砍掉的話他自己永遠看不到）。降級 = 粒子減半、關 bloom；星球、軌道、紙條功能照常。
5. **不裝新套件。** 現有 `@react-three/fiber@9.6.1`、`@react-three/drei`、`three@0.185`
   夠用。不要裝 postprocessing（手機效能不夠，且它有 re-render 崩潰前科）。
6. 效能預算：手機優先。`dpr={[1, 1.5]}`、同屏粒子總數 ≤ 300、
   所有重複小球用 `InstancedMesh` 或共用 geometry/material。
7. 每個功能做完：跑「驗收標準」全部項目 + 回歸測試
   （月曆新增/刪除事件、照片背景顯示、lightbox 開關都要重測）。
8. 暫時的 debug 碼標 `// TEMP DEBUG`，驗收前全部移除。

---

## 一、架構決策（已定案）

### 視圖切換，不是背景疊加
照片背景（FloatingPhotos）已佔據月曆視圖的背景層。3D 星空是**獨立視圖**：

- `Dashboard` 現有的 `view` state（`month | list`）加一個 `"cosmos"`
- view 切到 cosmos 時：隱藏月曆 grid 與 FloatingPhotos，全螢幕顯示 `<CosmosView />`
- 底部 view toggle 三個選項：`月曆 / 列表 / 星空`

### 新增檔案結構
```
src/components/cosmos/
  CosmosView.jsx      — 容器：Canvas 設定、DOM 覆蓋層（HUD、紙條輸入框）
  BinaryStars.jsx     — 兩顆主星 + 互繞軌道 + 事件行星
  NoteSparks.jsx      — 小紙條光點（飛向對方星球）
  MergeCelebration.jsx— 紀念日合體動畫
  cosmosState.js      — mutable 動畫狀態（非 React state）
```

### 資料流（嚴格遵守）
```
Supabase / zustand（低頻）          mutable cosmosState（每幀）
  events, notes, anniversary  ──►   CosmosView 外層讀取，
  （React 世界）                     轉成純陣列 props 傳進 Canvas
                                    ↓
                              useFrame 內只讀 cosmosState 與 props，
                              絕不呼叫 setState / zustand
```

`cosmosState.js` 內容：
```js
// 每幀讀寫的動畫狀態。絕不 import 進任何 setState 流程。
export const cosmosState = {
  mergeProgress: 0,      // 0~1，紀念日合體進度
  sparkQueue: [],        // 待發射的紙條光點 {fromMe: bool, id}
};
```

---

## 二、階段 A：雙星軌道場景（先做這個，做完驗收再往下）

### 場景規格
- 背景 `#050310`，`fog` 不要加（場景小，加了只會變糊）
- 相機：`position [0, 4, 14]`，`fov 45`，微俯視
- 兩顆主星：半徑 0.8 球體，圍繞原點互繞（半徑 3.2 的圓軌道，角速度 0.15 rad/s，相位差 π）
  - 你星：`#f472b6`（tailwind `you`），emissive 同色 `emissiveIntensity 0.6`
  - 他星：`#60a5fa`（tailwind `me`），同上
  - 位置計算在 `useFrame` 內用 `clock.elapsedTime`，不要用 state
- 軌道線：`torusGeometry` 半徑 3.2、tube 0.012，`meshBasicMaterial` 白色 `opacity 0.15`，
  平放（rotation.x = π/2）
- 事件行星：從 props 收 `events` 陣列（`{id, title, date, type}`），
  取「今天起 60 天內」的事件，每個是半徑 0.18 的小球：
  - 軌道半徑 = 5 + (事件距今天數 / 60) * 6 → 越近的事件離雙星越近
  - 角度 = 以 event.id 字串 hash 出固定角度（不要 random，避免每次 render 跳位置）
  - 顏色按 type：you `#f472b6` / me `#60a5fa` / us `#c084fc`
  - 所有行星共用一個 sphereGeometry 和三個 material（you/me/us 各一）
- 背景星塵：`<points>` 250 顆，位置 useMemo 生成一次，
  `pointsMaterial size 0.06, opacity 0.6, depthWrite: false`
- 光源：`ambientLight 0.4` + 兩顆主星各掛一個 `pointLight`（intensity 1, distance 8, 顏色同星球）
- 燈自動跟星球走：pointLight 放在星球的 group 裡

### DOM 覆蓋層（HUD）
Canvas 上方疊 DOM（`absolute` 定位、`pointer-events-auto`）：
- 左上：在一起天數（從 zustand/props 讀 pairedAt 算）
- 下方中央：最近 3 個事件的文字列表（點了跳回月曆 view 並開啟該日期）

### 驗收標準（全過才算完成）
- [ ] 切到星空 view：兩顆星在互繞、事件行星出現、星塵可見
- [ ] 新增一個 3 天後的事件 → 切回星空，多一顆行星且位置靠內圈
- [ ] 手機視窗（375px）下 FPS 目測順暢、無 console 錯誤
- [ ] `window.addEventListener('error')` 掛著操作 2 分鐘，`__errs` 為空
- [ ] 切回月曆 view：月曆、照片背景、lightbox 全部正常（回歸）
- [ ] 反覆切換 view 10 次無記憶體暴漲（DevTools Performance monitor 看 JS heap）

---

## 三、階段 B：每日小紙條（光點飛向對方星球）

### 資料層
- `notes` 表已存在（supabase_schema.sql），store.js 已有 `useNotes`
- 補上 Supabase 讀寫：載入時抓最近 30 天 notes；
  Realtime 訂閱 `notes` 表 INSERT（照 events 的現有訂閱模式抄）

### UI 流程
1. 星空 view 右下角一顆「✉️ 寫紙條」DOM 按鈕 → 彈出輸入框（textarea + 送出）
2. 送出 → insert 進 Supabase → 同時 `cosmosState.sparkQueue.push({fromMe: true, id})`
3. `NoteSparks` 的 `useFrame` 每幀檢查 sparkQueue，取出的光點從「我的星球」
   沿貝茲曲線飛向「對方星球」，飛行 2 秒，到達時對方星球 scale 彈一下
   （1.0 → 1.15 → 1.0，用 damp，不要 spring 套件）
4. 對方裝置收到 Realtime INSERT → 同樣 push 進 sparkQueue（fromMe: false，反向飛）
5. 點擊對方星球位置的 DOM 熱區 → 顯示今天收到的紙條內容（DOM 面板，不做 3D 文字）

### 實作要點
- 光點 = 半徑 0.1 的球 + 同色 pointLight（intensity 0.6, distance 3），共用 geometry
- 同時在飛的光點上限 5 顆，超過的排隊
- 貝茲曲線：起點/終點每幀重算（星球在動），控制點取兩星中點上方 y+2.5
- **飛行進度存在光點物件自己身上**（`spark.t += delta / 2`），不是 React state

### 驗收標準
- [ ] 送出紙條 → 光點從我方星球飛到對方星球 + 彈跳
- [ ] 開兩個瀏覽器分頁（同一對 pair）→ A 送紙條，B 的畫面 3 秒內光點飛入
- [ ] 連續送 8 張 → 最多 5 顆同時在飛，其餘排隊，無掉幀無報錯
- [ ] 點對方星球 → 顯示今日紙條列表
- [ ] 回歸：階段 A 的驗收全部重跑一次

---

## 四、階段 C：紀念日合體動畫

### 觸發邏輯（Canvas 外）
- 紀念日資料：events 裡 `type === 'us'` 且 title 含「紀念日」，或 repeat 為年度的事件
  中「距今最近的下一個」
- CosmosView 外層計算 `daysLeft`；**只在組件 mount 和日期變更時算一次**，
  結果當 props 傳入（低頻資料，可以用 React state）
- `daysLeft <= 7` 進入「靠近模式」；`daysLeft === 0`（當天）進入「合體模式」

### 動畫規格
- 靠近模式：軌道半徑從 3.2 隨天數線性縮到 1.6
  （`radius = 1.6 + (daysLeft / 7) * 1.6`），useFrame 內 damp 過渡
- 合體模式（當天首次切到星空 view 時播放，一次性）：
  1. 0–2s：兩星軌道半徑 damp 收斂到 0.6，角速度 ×3
  2. 2–3s：爆發 120 顆粒子（金色 `#fbbf24`，tailwind `gold`），
     從中心向球面隨機方向擴散，opacity 隨 progress 淡出
     —— 粒子用一個 `InstancedMesh`，位置/縮放在 useFrame 內寫 instanceMatrix
  3. 3s 後：兩星保持近距離互繞（半徑 1.2），中央浮現 DOM 文字
     「在一起 N 年 ✦ YYYY-MM-DD」
- 動畫進度存 `cosmosState.mergeProgress`，由 useFrame 推進；
  「今天播過了」記在 `localStorage`（key: `merge_played_YYYY-MM-DD`），避免每次切 view 重播
- 提供測試後門：URL 加 `?merge=test` 強制當天模式（寫在 CosmosView，上線不用拆，
  但要在 TROUBLESHOOTING.md 記一筆）

### 驗收標準
- [ ] `?merge=test` → 完整播放收斂→爆發→文字浮現，全程無報錯
- [ ] 同一天第二次進星空 view 不重播（localStorage 生效），但兩星維持近距離狀態
- [ ] 把系統時間概念排除：測試靠 `?merge=test`，不要改機器時間
- [ ] 動畫中切回月曆再切回來 → 不崩潰、狀態合理（動畫跳到結束態即可）
- [ ] 回歸：階段 A、B 驗收重跑

---

## 五、交付與記錄

1. 每階段完成後 commit 一次，訊息寫清楚階段與功能
2. 踩到任何坑：症狀 → 誤診（如有）→ 真因 → 修法，寫進 TROUBLESHOOTING.md
3. 三階段全部完成後，更新 README.md 的 Phase 2/3 勾選狀態
4. 不要 push；等使用者本人驗收後自行 push
