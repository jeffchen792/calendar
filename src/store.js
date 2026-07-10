import { create } from "zustand";
import { supabase } from "./lib/supabase";

// ── Helpers ──
const local = (k, v) => { try { v != null ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.getItem(k); } catch {} return v == null ? JSON.parse(localStorage.getItem(k) || "null") : v; };

export function getRecurringDates(event, months = 3) {
  if (!event.repeat) return [];
  const dates = [];
  const start = new Date(event.date);
  const end = new Date();
  end.setMonth(end.getMonth() + months);
  let d = new Date(start);
  while (d <= end) {
    if (d > start) dates.push(d.toISOString().slice(0, 10));
    if (event.repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (event.repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else break;
  }
  return dates;
}

// ── Supabase Realtime Subscriptions ──
let channels = [];

export function subAll(pairId) {
  cleanup();
  if (!supabase || !pairId) return;
  channels = [
    supabase.channel("events").on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `pair_id=eq.${pairId}` }, () => fetchEvents(pairId)).subscribe(),
    supabase.channel("notes").on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `pair_id=eq.${pairId}` }, () => fetchNotes(pairId)).subscribe(),
    supabase.channel("pings").on("postgres_changes", { event: "INSERT", schema: "public", table: "pings", filter: `pair_id=eq.${pairId}` }, () => fetchPings(pairId)).subscribe(),
  ];
}

function cleanup() { channels.forEach((c) => supabase?.removeChannel(c)); channels = []; }

// ── Fetch helpers ──
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

// ── Auth ──
export const useAuth = create((set) => ({
  user: local("cosmic_user"), partner: null, loading: !local("cosmic_user"),
  setUser: (u) => { local("cosmic_user", u); set({ user: u, loading: false }); },
  setPartner: (p) => set({ partner: p }),
  logout: () => { localStorage.removeItem("cosmic_user"); set({ user: null, partner: null }); cleanup(); },
}));

// ── Events ──
export const useEvents = create((set) => ({
  events: [],
  setEvents: (e) => set({ events: e }),
  addEvent: async (e) => {
    if (supabase) {
      const { data } = await supabase.from("events").insert(e).select().single();
      if (data) set((s) => ({ events: [data, ...s.events] }));
    } else {
      set((s) => ({ events: [{ ...e, id: crypto.randomUUID() }, ...s.events] }));
    }
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

// ── Mood ──
export const useMood = create((set) => ({
  myMood: local("cosmic_mood"), partnerMood: null,
  setMyMood: async (m) => {
    local("cosmic_mood", m);
    set({ myMood: m });
    if (supabase) {
      const user = useAuth.getState().user;
      if (user?.id) await supabase.from("users").update({ mood: m }).eq("id", user.id);
    }
  },
  setPartnerMood: (m) => set({ partnerMood: m }),
}));

// ── Miss You ──
export const useMissYou = create((set) => ({
  pings: [],
  sendPing: async (p) => {
    if (supabase) await supabase.from("pings").insert(p);
    set((s) => ({ pings: [{ ...p, id: crypto.randomUUID() }, ...s.pings] }));
  },
  clearPings: () => set({ pings: [] }),
}));

// ── Notes ──
export const useNotes = create((set) => ({
  notes: [],
  addNote: async (n) => {
    if (supabase) {
      const { data } = await supabase.from("notes").insert(n).select().single();
      if (data) set((s) => ({ notes: [data, ...s.notes] }));
    } else {
      set((s) => ({ notes: [{ ...n, id: crypto.randomUUID() }, ...s.notes] }));
    }
  },
  setNotes: (n) => set({ notes: n }),
}));

// ── Pairing — now uses Supabase ──

export async function createPair(name) {
  if (!supabase) return fallbackCreatePair(name);
  // 1. Create pair
  const { data: pair } = await supabase.from("pairs").insert({ code: crypto.randomUUID().slice(0, 8) }).select().single();
  if (!pair) return null;
  // 2. Create user
  const { data: user } = await supabase.from("users").insert({ name, pair_id: pair.id }).select().single();
  if (!user) return null;
  // 3. Subscribe & save
  subAll(pair.id);
  fetchEvents(pair.id);
  useAuth.getState().setUser({ ...user, pairCode: pair.code, pairId: pair.id });
  return pair.code;
}

export async function joinPair(name, code) {
  if (!supabase) return fallbackJoinPair(name, code);
  // 1. Find pair
  const { data: pair } = await supabase.from("pairs").select().eq("code", code).single();
  if (!pair) return { error: "找不到這個邀請碼" };
  // 2. Create user in this pair
  const { data: user } = await supabase.from("users").insert({ name, pair_id: pair.id }).select().single();
  if (!user) return { error: "加入失敗" };
  // 3. Subscribe & save
  subAll(pair.id);
  fetchEvents(pair.id);
  useAuth.getState().setUser({ ...user, pairCode: code, pairId: pair.id });
  return { success: true };
}

// Fallback: no Supabase configured, use localStorage only
function fallbackCreatePair(name) {
  const pairCode = crypto.randomUUID().slice(0, 8);
  const user = { id: crypto.randomUUID(), name, pairCode, paired: false };
  local("cosmic_user", user);
  useAuth.getState().setUser(user);
  return pairCode;
}

function fallbackJoinPair(name, code) {
  const user = { id: crypto.randomUUID(), name, pairCode: code, paired: true };
  local("cosmic_user", user);
  useAuth.getState().setUser(user);
  return { success: true };
}
