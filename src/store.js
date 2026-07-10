import { create } from "zustand";

// ── Auth ──
export const useAuth = create((set) => ({
  user: null, partner: null, loading: true,
  setUser: (u) => set({ user: u, loading: false }),
  setPartner: (p) => set({ partner: p }),
  logout: () => set({ user: null, partner: null }),
}));

// ── Events ──
// repeat: null | "weekly" | "monthly"
// emoji: null | "❤️" | "😂" | "🥺" (partner's reaction)
export const useEvents = create((set) => ({
  events: [],
  setEvents: (e) => set({ events: e }),
  addEvent: (e) => set((s) => ({ events: [e, ...s.events] })),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((ev) => ev.id !== id) })),
  reactEvent: (id, emoji) => set((s) => ({
    events: s.events.map((ev) => ev.id === id ? { ...ev, emoji } : ev),
  })),
}));

// ── Mood (心情天氣) ──
export const useMood = create((set) => ({
  myMood: null, partnerMood: null,  // "sunny"|"cloudy"|"rainy"|"stormy"
  setMyMood: (m) => { set({ myMood: m }); localStorage.setItem("cosmic_mood", m); },
  setPartnerMood: (m) => set({ partnerMood: m }),
}));

// ── Miss You (想你光點) ──
export const useMissYou = create((set) => ({
  pings: [],        // { id, from, at }
  sendPing: (p) => set((s) => ({ pings: [...s.pings, p] })),
  clearPings: () => set({ pings: [] }),
}));

// ── Notes (小紙條) ──
export const useNotes = create((set) => ({
  notes: [],
  addNote: (n) => set((s) => ({ notes: [n, ...s.notes] })),
  setNotes: (n) => set({ notes: n }),
}));

// ── Helpers ──
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
