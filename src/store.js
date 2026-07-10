import { create } from "zustand";
import { supabase } from "./lib/supabase";

// ── Helpers ──
const local = (k, v) => { try { v != null ? localStorage.setItem(k, JSON.stringify(v)) : null; } catch {} return v == null ? JSON.parse(localStorage.getItem(k) || "null") : v; };

export function getRecurringDates(event, months = 3) {
  if (!event.repeat) return [];
  const dates = [];
  const start = new Date(event.date);
  const end = new Date(); end.setMonth(end.getMonth() + months);
  let d = new Date(start);
  while (d <= end) {
    if (d > start) dates.push(d.toISOString().slice(0, 10));
    if (event.repeat === "weekly") d.setDate(d.getDate() + 7);
    else if (event.repeat === "monthly") d.setMonth(d.getMonth() + 1);
    else break;
  }
  return dates;
}

// ── Anonymous Auth ──
async function ensureAuth() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) { console.error("anon auth failed:", error); return null; }
  return data.user;
}

// ── Supabase Realtime ──
let channels = [];

export async function subAll(pairId) {
  cleanup();
  if (!supabase || !pairId) return;
  channels = [
    supabase.channel("events").on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `pair_id=eq.${pairId}` }, () => fetchEvents(pairId)).subscribe(),
    supabase.channel("notes").on("postgres_changes", { event: "*", schema: "public", table: "notes", filter: `pair_id=eq.${pairId}` }, () => fetchNotes(pairId)).subscribe(),
    supabase.channel("pings").on("postgres_changes", { event: "INSERT", schema: "public", table: "pings", filter: `pair_id=eq.${pairId}` }, () => fetchPings(pairId)).subscribe(),
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

// ── Auth Store ──
export const useAuth = create((set) => ({
  user: local("cosmic_user"), partner: null, loading: !local("cosmic_user"),
  setUser: (u) => { local("cosmic_user", u); set({ user: u, loading: false }); },
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
    if (supabase) await supabase.from("pings").insert(p);
    set((s) => ({ pings: [{ ...p, id: crypto.randomUUID() }, ...s.pings] }));
  },
  clearPings: () => set({ pings: [] }),
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

export async function createPair(name) {
  if (!supabase) return fallbackCreatePair(name);

  const uid = await ensureAuth();
  if (!uid) return null;

  const code = crypto.randomUUID().slice(0, 8);
  const { data: pair, error: e1 } = await supabase.from("pairs").insert({ code }).select().single();
  if (e1) { console.error(e1); return null; }

  const { error: e2 } = await supabase.from("users").insert({ id: uid.id, name, pair_id: pair.id }).select().single();
  if (e2) { console.error(e2); return null; }

  // Re-fetch with session to get fresh RLS context
  subAll(pair.id);
  fetchEvents(pair.id);
  useAuth.getState().setUser({ id: uid.id, name, pairCode: code, pairId: pair.id });
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

function fallbackCreatePair(name) {
  const pairCode = crypto.randomUUID().slice(0, 8);
  const user = { id: crypto.randomUUID(), name, pairCode, pairId: null };
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
