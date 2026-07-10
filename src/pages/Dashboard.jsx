import { useState } from "react";
import { useAuth, useEvents } from "../store";

const COLORS = { you: "border-you text-you", me: "border-me text-me", us: "border-us text-us" };
const BG = { you: "bg-you/10", me: "bg-me/10", us: "bg-us/10" };

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const { events, addEvent, removeEvent } = useEvents();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", type: "us", notes: "" });

  const handleAdd = () => {
    if (!form.title || !form.date) return;
    addEvent({ id: crypto.randomUUID(), ...form, createdAt: new Date().toISOString() });
    setForm({ title: "", date: "", type: "us", notes: "" });
    setShowAdd(false);
  };

  // Simple countdown
  const daysTogether = user?.pairedAt ? Math.floor((Date.now() - new Date(user.pairedAt)) / 86400000) : 1;

  return (
    <div className="min-h-screen bg-cosmic-bg pb-20">
      {/* Header */}
      <header className="glass mx-4 mt-4 p-4 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-lg">
            <span className="text-you">{user?.name}</span>
            <span className="text-star-dim mx-2">✦</span>
            <span className="text-me">{user?.partner?.name || "???"}</span>
          </h1>
          <p className="text-star-dim text-xs mt-1">第 {daysTogether} 天</p>
        </div>
        <button onClick={() => { localStorage.removeItem("cosmic_user"); setUser(null); }}
          className="text-star-dim hover:text-star text-sm">登出</button>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mx-4 mt-4">
        {[
          { label: "你的", count: events.filter((e) => e.type === "you").length, color: "text-you" },
          { label: "他的", count: events.filter((e) => e.type === "me").length, color: "text-me" },
          { label: "共同的", count: events.filter((e) => e.type === "us").length, color: "text-us" },
        ].map((s) => (
          <div key={s.label} className="glass p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-star-dim text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Events list */}
      <div className="mx-4 mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-star">星系事件</h2>
          <button onClick={() => setShowAdd(!showAdd)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-star hover:text-white transition-colors">
            {showAdd ? "−" : "+"}
          </button>
        </div>

        {showAdd && (
          <div className="glass p-4 space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="事件標題" className="w-full px-3 py-2 bg-white/5 rounded-lg text-star placeholder-star-dim/50 outline-none" autoFocus />
            <input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              type="date" className="w-full px-3 py-2 bg-white/5 rounded-lg text-star outline-none" />
            <div className="flex gap-2">
              {["you", "me", "us"].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all ${form.type === t ? `${COLORS[t]} ${BG[t]}` : "border-white/10 text-star-dim"}`}>
                  {t === "you" ? "你" : t === "me" ? "他" : "我們"}
                </button>
              ))}
            </div>
            <button onClick={handleAdd} className="btn-primary w-full text-white">新增事件</button>
          </div>
        )}

        {events.length === 0 && !showAdd && (
          <p className="text-star-dim text-center py-12">尚無事件，點上方 + 新增</p>
        )}

        {events
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((ev) => (
            <div key={ev.id} className={`glass p-4 border-l-2 ${COLORS[ev.type] || "border-white/10"} flex items-start justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-star-dim">{ev.date}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${BG[ev.type]} ${COLORS[ev.type]}`}>
                    {ev.type === "you" ? "你" : ev.type === "me" ? "他" : "我們"}
                  </span>
                </div>
                <p className="text-star mt-1">{ev.title}</p>
              </div>
              <button onClick={() => removeEvent(ev.id)} className="text-star-dim hover:text-red-400 text-sm">×</button>
            </div>
          ))}
      </div>
    </div>
  );
}
