import { create } from "zustand";

// ── Auth ──
export const useAuth = create((set) => ({
  user: null,          // { id, name, partnerId, pairedAt }
  partner: null,       // partner's user object (synced after pairing)
  loading: true,
  setUser: (u) => set({ user: u, loading: false }),
  setPartner: (p) => set({ partner: p }),
  logout: () => set({ user: null, partner: null }),
}));

// ── Events ──
export const useEvents = create((set) => ({
  events: [],          // { id, title, date, type: "you"|"me"|"us", notes, createdAt }
  setEvents: (e) => set({ events: e }),
  addEvent: (e) => set((s) => ({ events: [e, ...s.events] })),
  removeEvent: (id) => set((s) => ({ events: s.events.filter((ev) => ev.id !== id) })),
}));

// ── Notes (小紙條) ──
export const useNotes = create((set) => ({
  notes: [],
  addNote: (n) => set((s) => ({ notes: [n, ...s.notes] })),
  setNotes: (n) => set({ notes: n }),
}));
