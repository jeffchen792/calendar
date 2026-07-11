import { create } from "zustand";
import { supabase } from "./lib/supabase";

// ── Helpers ──
const local = (k, v) => { try { v != null ? localStorage.setItem(k, JSON.stringify(v)) : null; } catch {} return v == null ? JSON.parse(localStorage.getItem(k) || "null") : v; };

// 一律用本地時區組日期字串——toISOString() 是 UTC，
// 在台灣（UTC+8）凌晨前建立的 Date 會被算成前一天
export const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function getRecurringDates(event, months = 13) {
  if (!event.repeat) return [];
  const dates = [];
  const start = new Date(event.date + "T00:00:00");
  const end = new Date(); end.setMonth(end.getMonth() + months);
  let d = new Date(start);
  while (d <= end) {
    if (d > start) dates.push(fmtDate(d));
    if (event.repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (event.repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else if (event.repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
    else break;
  }
  return dates;
}

// ── 經期預測（純函式，僅供參考，非醫療用途）──
// 只根據記錄的開始日期推算平均週期，兩筆以下就用醫學常見值 28 天當預設
export function getPeriodInfo(logs, periodLength = 5) {
  if (!logs.length) return null;
  const starts = logs.map((l) => l.start_date).sort();
  const lastStart = starts[starts.length - 1];

  let avgCycle = 28;
  if (starts.length >= 2) {
    const diffs = [];
    for (let i = 1; i < starts.length; i++) {
      const d = Math.round((new Date(starts[i] + "T00:00:00") - new Date(starts[i - 1] + "T00:00:00")) / 86400000);
      if (d >= 15 && d <= 60) diffs.push(d); // 濾掉漏記/補記造成的離群值
    }
    if (diffs.length) avgCycle = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }

  const addDays = (dateStr, n) => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  };

  const recordedDays = {};
  starts.forEach((s) => { for (let i = 0; i < periodLength; i++) recordedDays[addDays(s, i)] = true; });

  const predictedDays = {};
  const predictedStarts = [];
  let next = addDays(lastStart, avgCycle);
  for (let c = 0; c < 3; c++) {
    predictedStarts.push(next);
    for (let i = 0; i < periodLength; i++) predictedDays[addDays(next, i)] = true;
    next = addDays(next, avgCycle);
  }

  return { avgCycle, periodLength, lastStart, nextStart: predictedStarts[0], starts, recordedDays, predictedDays };
}

// ── Anonymous Auth（僅剩無 Supabase 的本地 fallback 在用）──
async function ensureAuth() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) { console.error("anon auth failed:", error); return null; }
  return data.user;
}

// ── Google Auth ──
export async function signInWithGoogle() {
  if (!supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) console.error("google sign-in failed:", error);
}

// App 啟動與 OAuth 轉址回來時呼叫：
// 1. 有 users 資料列 → 直接載入身分
// 2. 第一次 Google 登入 → 自動建立配對，或加入對方已建立的配對（不需要邀請碼——
//    Google 測試名單只有你們兩個人，第三者根本登入不進來）
let authBusy = false;
export async function initAuth() {
  if (!supabase) {
    useAuth.setState({ user: local("cosmic_user"), loading: false });
    return;
  }
  if (authBusy) return;
  authBusy = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const au = session?.user;
    if (!au || au.is_anonymous) { useAuth.setState({ user: null, loading: false }); return; }

    const { data: row } = await supabase.from("users").select("*").eq("id", au.id).maybeSingle();
    if (row) {
      useAuth.getState().setUser({ id: row.id, name: row.name, pairId: row.pair_id });
      fetchPairInfo(row.pair_id);
      return;
    }

    // 第一次登入 → 自動配對
    const name = au.user_metadata?.full_name || au.user_metadata?.name || au.email?.split("@")[0] || "我";
    const { data: pairs } = await supabase.from("pairs").select("id, paired_at, users(id, email)");
    // 只認有 email 的成員（Google 帳號）；舊的匿名測試配對不算數
    const open = (pairs || []).find((p) => {
      const g = (p.users || []).filter((u) => u.email);
      return g.length === 1 && g[0].id !== au.id;
    });
    let pairId = open?.id;
    if (!pairId) {
      const { data: pair, error } = await supabase.from("pairs").insert({ code: crypto.randomUUID().slice(0, 8) }).select().single();
      if (error) { console.error("create pair failed:", error); useAuth.setState({ user: null, loading: false, authError: error.message }); return; }
      pairId = pair.id;
    }
    const { error: e2 } = await supabase.from("users").insert({ id: au.id, name, pair_id: pairId, email: au.email });
    if (e2) {
      console.error("provision user failed (還沒跑 supabase_v5_google.sql？):", e2);
      useAuth.setState({ user: null, loading: false, authError: e2.message });
      return;
    }
    useAuth.getState().setUser({ id: au.id, name, pairId });
    fetchPairInfo(pairId);
  } finally {
    authBusy = false;
  }
}

// ── Supabase Realtime ──
let channels = [];

export async function subAll(pairId) {
  cleanup();
  if (!supabase || !pairId) return;
  // 訂閱之前要先把既有資料抓回來——不然重新整理後畫面是空的，
  // 要等到有人改資料觸發 realtime 才會出現
  fetchEvents(pairId);
  fetchNotes(pairId);
  fetchLists(pairId);
  fetchPeriods(pairId);
  channels = [
    supabase.channel("events").on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `pair_id=eq.${pairId}` }, () => fetchEvents(pairId)).subscribe(),
    supabase.channel("notes").on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `pair_id=eq.${pairId}` }, () => fetchNotes(pairId)).subscribe(),
    supabase.channel("pings").on("postgres_changes", { event: "INSERT", schema: "public", table: "pings", filter: `pair_id=eq.${pairId}` }, () => fetchPings(pairId)).subscribe(),
    supabase.channel("list_items").on("postgres_changes", { event: "*", schema: "public", table: "list_items", filter: `pair_id=eq.${pairId}` }, () => fetchLists(pairId)).subscribe(),
    supabase.channel("period_logs").on("postgres_changes", { event: "*", schema: "public", table: "period_logs", filter: `pair_id=eq.${pairId}` }, () => fetchPeriods(pairId)).subscribe(),
  ];
}

function cleanup() { channels.forEach((c) => supabase?.removeChannel(c)); channels = []; }

async function fetchEvents(pairId) {
  if (!supabase) return;
  const { data } = await supabase.from("events").select("*").eq("pair_id", pairId).order("date", { ascending: true });
  if (data) useEvents.setState({ events: data });
}
async function fetchNotes(pairId) {
  if (!supabase) return;
  const { data } = await supabase.from("notes").select("*").eq("pair_id", pairId).order("created_at", { ascending: false });
  if (data) useNotes.setState({ notes: data });
}
async function fetchPings(pairId) {
  if (!supabase) return;
  const { data } = await supabase.from("pings").select("*").eq("pair_id", pairId).order("created_at", { ascending: false }).limit(30);
  if (data) useMissYou.setState({ pings: data });
}
async function fetchLists(pairId) {
  if (!supabase) return;
  const { data, error } = await supabase.from("list_items").select("*").eq("pair_id", pairId).order("created_at", { ascending: false });
  if (error) { console.error("fetchLists failed (還沒跑 supabase_v4_features.sql？):", error); return; }
  if (data) useLists.setState({ items: data });
}
async function fetchPeriods(pairId) {
  if (!supabase) return;
  const { data, error } = await supabase.from("period_logs").select("*").eq("pair_id", pairId).order("start_date", { ascending: true });
  if (error) { console.error("fetchPeriods failed (還沒跑 supabase_v6_period.sql？):", error); return; }
  if (data) usePeriod.setState({ logs: data });
}

// ── Auth Store ──
// 有 Supabase 時身分一律由 initAuth() 從 session 推導，不吃 localStorage 快取——
// 不然舊的匿名身分會殘留，造成看得到畫面但存不進資料的詭異狀態
export const useAuth = create((set) => ({
  user: supabase ? null : local("cosmic_user"), partner: null, loading: true, authError: "",
  setUser: (u) => { local("cosmic_user", u); set({ user: u, loading: false, authError: "" }); },
  setPartner: (p) => set({ partner: p }),
  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem("cosmic_user");
    set({ user: null, partner: null });
    cleanup();
  },
}));

// ── Events Store ──
export const useEvents = create((set) => ({
  events: [],
  setEvents: (e) => set({ events: e }),
  addEvent: async (e) => {
    if (supabase) {
      const { data, error } = await supabase.from("events").insert(e).select().single();
      if (error) { console.error("addEvent failed:", error); return { error: error.message }; }
      if (data) set((s) => ({ events: [data, ...s.events] }));
    } else {
      set((s) => ({ events: [{ ...e, id: crypto.randomUUID() }, ...s.events] }));
    }
    return {};
  },
  removeEvent: async (id) => {
    if (supabase) await supabase.from("events").delete().eq("id", id);
    set((s) => ({ events: s.events.filter((ev) => ev.id !== id) }));
  },
  reactEvent: async (id, emoji) => {
    if (supabase) await supabase.from("events").update({ emoji }).eq("id", id);
    set((s) => ({ events: s.events.map((ev) => ev.id === id ? { ...ev, emoji } : ev) }));
  },
}));

// ── Mood Store ──
export const useMood = create((set) => ({
  myMood: local("cosmic_mood"), partnerMood: null,
  setMyMood: async (m) => { local("cosmic_mood", m); set({ myMood: m }); },
  setPartnerMood: (m) => set({ partnerMood: m }),
}));

// ── Miss You Store ──
export const useMissYou = create((set) => ({
  pings: [],
  sendPing: async (p) => {
    // p 只能帶資料表真的有的欄位（pair_id / from_user），多餘欄位整筆會被拒
    if (supabase) {
      const { error } = await supabase.from("pings").insert(p);
      if (error) console.error("sendPing failed:", error);
    }
    set((s) => ({ pings: [{ ...p, id: crypto.randomUUID() }, ...s.pings] }));
  },
  clearPings: () => set({ pings: [] }),
}));

// ── Shared Lists Store（共同清單：想吃/想去/想看）──
export const useLists = create((set) => ({
  items: [],
  addItem: async (it) => {
    if (supabase) {
      const { data, error } = await supabase.from("list_items").insert(it).select().single();
      if (error) { console.error("addItem failed:", error); return { error: error.message }; }
      if (data) set((s) => ({ items: [data, ...s.items] }));
    } else {
      set((s) => ({ items: [{ ...it, id: crypto.randomUUID(), done: false }, ...s.items] }));
    }
    return {};
  },
  toggleItem: async (id, done) => {
    if (supabase) await supabase.from("list_items").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done } : i)) }));
  },
  removeItem: async (id) => {
    if (supabase) await supabase.from("list_items").delete().eq("id", id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },
}));

// ── Period Store（經期紀錄：只存「開始日」，週期預測由 getPeriodInfo 推算）──
export const usePeriod = create((set, get) => ({
  logs: [],
  toggleLog: async (date, pairId, createdBy) => {
    const existing = get().logs.find((l) => l.start_date === date);
    if (existing) {
      if (supabase) await supabase.from("period_logs").delete().eq("id", existing.id);
      set((s) => ({ logs: s.logs.filter((l) => l.id !== existing.id) }));
      return {};
    }
    if (supabase) {
      const { data, error } = await supabase.from("period_logs")
        .insert({ start_date: date, pair_id: pairId, created_by: createdBy }).select().single();
      if (error) { console.error("logPeriod failed:", error); return { error: error.message }; }
      if (data) set((s) => ({ logs: [...s.logs, data].sort((a, b) => a.start_date.localeCompare(b.start_date)) }));
    } else {
      set((s) => ({ logs: [...s.logs, { id: crypto.randomUUID(), start_date: date }].sort((a, b) => a.start_date.localeCompare(b.start_date)) }));
    }
    return {};
  },
}));

// ── Notes Store ──
export const useNotes = create((set) => ({
  notes: [],
  addNote: async (n) => {
    if (supabase) { const { data } = await supabase.from("notes").insert(n).select().single(); if (data) set((s) => ({ notes: [data, ...s.notes] })); }
    else set((s) => ({ notes: [{ ...n, id: crypto.randomUUID() }, ...s.notes] }));
  },
  setNotes: (n) => set({ notes: n }),
}));

// ── Pairing (with Anonymous Auth + proper RLS) ──

export async function createPair(name, pairedAt) {
  if (!supabase) return fallbackCreatePair(name, pairedAt);

  const uid = await ensureAuth();
  if (!uid) return null;

  const code = crypto.randomUUID().slice(0, 8);
  const { data: pair, error: e1 } = await supabase.from("pairs").insert({ code, paired_at: pairedAt }).select().single();
  if (e1) { console.error(e1); return null; }

  const { error: e2 } = await supabase.from("users").insert({ id: uid.id, name, pair_id: pair.id }).select().single();
  if (e2) { console.error(e2); return null; }

  // Re-fetch with session to get fresh RLS context
  subAll(pair.id);
  fetchEvents(pair.id);
  useAuth.getState().setUser({ id: uid.id, name, pairCode: code, pairId: pair.id, pairedAt });
  return code;
}

export async function joinPair(name, code) {
  if (!supabase) return fallbackJoinPair(name, code);

  const uid = await ensureAuth();
  if (!uid) return { error: "認證失敗" };

  const { data: pair, error: e1 } = await supabase.from("pairs").select().eq("code", code).single();
  if (e1 || !pair) return { error: "找不到這個邀請碼" };

  const { error: e2 } = await supabase.from("users").insert({ id: uid.id, name, pair_id: pair.id }).select().single();
  if (e2) { console.error(e2); return { error: "加入失敗" }; }

  subAll(pair.id);
  fetchEvents(pair.id);
  useAuth.getState().setUser({ id: uid.id, name, pairCode: code, pairId: pair.id });
  return { success: true };
}

// 從 Supabase 讀「配對層級」的 paired_at，同步覆蓋回本地 user 物件——
// 兩人都要看到同一個日期，不能各自存在自己的 localStorage 裡各說各話。
export async function fetchPairInfo(pairId) {
  if (!supabase || !pairId) return;
  const { data } = await supabase.from("pairs").select("paired_at").eq("id", pairId).single();
  if (data?.paired_at) {
    const u = useAuth.getState().user;
    if (u && u.pairedAt !== data.paired_at) {
      const nu = { ...u, pairedAt: data.paired_at };
      local("cosmic_user", nu);
      useAuth.getState().setUser(nu);
    }
  }
}

export async function updatePairedAt(pairId, date) {
  if (supabase && pairId) {
    const { error } = await supabase.from("pairs").update({ paired_at: date }).eq("id", pairId);
    if (error) console.error("updatePairedAt failed:", error);
  }
  const u = useAuth.getState().user;
  if (u) {
    const nu = { ...u, pairedAt: date };
    local("cosmic_user", nu);
    useAuth.getState().setUser(nu);
  }
}

function fallbackCreatePair(name, pairedAt) {
  const pairCode = crypto.randomUUID().slice(0, 8);
  const user = { id: crypto.randomUUID(), name, pairCode, pairId: null, pairedAt };
  local("cosmic_user", user);
  useAuth.getState().setUser(user);
  return pairCode;
}
function fallbackJoinPair(name, code) {
  const user = { id: crypto.randomUUID(), name, pairCode: code, pairId: null };
  local("cosmic_user", user);
  useAuth.getState().setUser(user);
  return { success: true };
}
