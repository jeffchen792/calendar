import { useState, useMemo, useEffect } from "react";
import { useAuth, useEvents, useMood, useMissYou, getRecurringDates } from "../store";
import FloatingPhotos from "../components/FloatingPhotos";

const C = {
  you: { border: "border-you", text: "text-you", bg: "bg-you/15", dot: "bg-you" },
  me: { border: "border-me", text: "text-me", bg: "bg-me/15", dot: "bg-me" },
  us: { border: "border-us", text: "text-us", bg: "bg-us/15", dot: "bg-us" },
};
const LABEL = { you: "你", me: "他", us: "我們" };
const MOODS = { sunny: "☀️", cloudy: "☁️", rainy: "🌧️", stormy: "⛈️" };
const REACTIONS = ["❤️", "😂", "🥺", "🎉", "💪"];

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

export default function Dashboard() {
  const { user, partner, setUser } = useAuth();
  const { events, addEvent, removeEvent, reactEvent } = useEvents();
  const { myMood, setMyMood, partnerMood } = useMood();
  const { pings, sendPing, clearPings } = useMissYou();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState("month");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ title: "", type: "us", repeat: null, notes: "" });
  const [showMood, setShowMood] = useState(false);

  // Load saved mood
  useEffect(() => { setMyMood(localStorage.getItem("cosmic_mood") || null); }, []);

  // Fetch partner info + subscribe to realtime
  useEffect(() => {
    const u = user;
    if (!u?.pairId) return;
    import("../store").then(({ subAll, useAuth: a }) => {
      subAll(u.pairId);
      // Fetch partner
      import("../lib/supabase").then(({ supabase: sb }) => {
        if (!sb) return;
        sb.from("users").select("*").eq("pair_id", u.pairId).neq("id", u.id).single().then(({ data }) => {
          if (data) a.getState().setPartner(data);
        });
      });
    });
  }, [user?.pairId]);

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const weekDays = ["日","一","二","三","四","五","六"];
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayStr = today.toISOString().slice(0, 10);

  // Merge recurring events
  const allEvents = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      const add = (date) => {
        if (!map[date]) map[date] = [];
        map[date].push(ev);
      };
      add(ev.date);
      if (ev.repeat) getRecurringDates(ev).forEach((d) => add(d));
    });
    return map;
  }, [events]);

  // "This day last year"
  const oneYearAgo = useMemo(() => {
    const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
    return { date: d.toISOString().slice(0, 10), events: allEvents[d.toISOString().slice(0, 10)] || [] };
  }, [allEvents]);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const handleAdd = () => {
    if (!form.title || !selectedDate) return;
    addEvent({ id: crypto.randomUUID(), title: form.title, date: selectedDate, type: form.type, repeat: form.repeat, notes: form.notes, emoji: null, createdAt: new Date().toISOString() });
    setForm({ title: "", type: "us", repeat: null, notes: "" });
    setShowAdd(false); setSelectedDate(null);
  };

  return (
    /* 根元素不可加不透明背景（bg-cosmic-bg 已由 body 提供）——
       否則 -z-10 的 FloatingPhotos 會被畫到背景後面而完全看不見 */
    <div className="min-h-screen pb-24 relative">
      <FloatingPhotos />

      {/* Miss-you ping animation */}
      {pings.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none" onClick={clearPings}>
          {pings.map((p) => (
            <span key={p.id} className="absolute text-2xl animate-bounce opacity-0"
              style={{ animation: `pingFly 2s ease-out forwards`, animationDelay: "0s" }}>
              💫
            </span>
          ))}
        </div>
      )}

      {/* Header */}
      <header className="glass mx-3 mt-3 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMood(!showMood)} className="text-xl" title="心情">
            {myMood ? MOODS[myMood] : "🌤️"}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-you" />
            <span className="text-star text-sm font-medium">{user?.name}</span>
            {myMood && <span className="text-xs">{MOODS[myMood]}</span>}
          </div>
          <span className="text-star-dim text-xs">✦</span>
          <div className="flex items-center gap-1.5">
            {partnerMood && <span className="text-xs">{MOODS[partnerMood]}</span>}
            <span className="text-star text-sm font-medium">{partner?.name || "???"}</span>
            <span className="w-3 h-3 rounded-full bg-me" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => sendPing({ id: crypto.randomUUID(), from: user?.name, at: new Date().toISOString() })}
            className="text-sm hover:scale-110 transition-transform" title="想你">💫</button>
          <button onClick={() => { localStorage.removeItem("cosmic_user"); setUser(null); }}
            className="text-star-dim hover:text-star text-xs">登出</button>
        </div>
      </header>

      {/* Mood picker */}
      {showMood && (
        <div className="glass mx-3 mt-2 p-3 flex gap-3 justify-center">
          {Object.entries(MOODS).map(([key, emoji]) => (
            <button key={key} onClick={() => { setMyMood(key); setShowMood(false); }}
              className={`text-2xl p-1.5 rounded-lg transition-all ${myMood === key ? "bg-white/10 scale-125" : "opacity-50 hover:opacity-100"}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* "This day last year" banner */}
      {oneYearAgo.events.length > 0 && (
        <div className="glass mx-3 mt-3 p-3 border-l-2 border-gold/50">
          <p className="text-xs text-star-dim">去年的今天</p>
          {oneYearAgo.events.map((ev) => (
            <p key={ev.id} className="text-sm text-star mt-1">{ev.title}</p>
          ))}
        </div>
      )}

      {/* Month navigator */}
      <div className="flex items-center justify-between mx-3 mt-4 px-2">
        <button onClick={prevMonth} className="text-star-dim hover:text-star text-xl px-2">‹</button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-display font-bold text-star">{year}年 {monthNames[month]}</h2>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="text-xs px-2 py-1 rounded-full border border-white/10 text-star-dim hover:text-star">今天</button>
        </div>
        <button onClick={nextMonth} className="text-star-dim hover:text-star text-xl px-2">›</button>
      </div>

      {/* Calendar grid */}
      <div className="mx-2 mt-3">
        <div className="grid grid-cols-7 text-center mb-1">
          {weekDays.map((d, i) => (
            <div key={i} className={`text-xs py-1 ${i === 0 || i === 6 ? "text-star-dim/50" : "text-star-dim/70"}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden">
          {days.map((date, i) => {
            if (!date) return <div key={`e${i}`} className="aspect-square bg-transparent" />;
            const ds = date.toISOString().slice(0, 10);
            const isToday = ds === todayStr;
            const dayEvents = allEvents[ds] || [];
            return (
              <div key={ds} onClick={() => { setSelectedDate(ds); setShowAdd(true); }}
                className={`aspect-square bg-cosmic-deep/55 p-1 cursor-pointer hover:bg-white/5 transition-colors relative ${isToday ? "ring-1 ring-glow-purple/50 ring-inset" : ""}`}>
                <span className={`text-xs ${isToday ? "text-glow-purple font-bold" : "text-star-dim/60"}`}>{date.getDate()}</span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${C[ev.type]?.dot || "bg-white/30"}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div className="mx-3 mt-6 space-y-2">
        {Object.entries(allEvents).sort(([a],[b]) => a.localeCompare(b)).map(([date, evs]) => (
          <div key={date} className="glass p-3">
            <div className="text-xs text-star-dim mb-2">{date} ({new Date(date).toLocaleDateString("zh-TW", { weekday: "short" })})</div>
            {evs.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 py-1.5 border-t border-white/5 group">
                <span className={`w-2 h-2 rounded-full ${C[ev.type]?.dot}`} />
                <span className="text-star text-sm flex-1">{ev.title}</span>
                {ev.repeat && <span className="text-[9px] text-star-dim/50 mr-1">↻{ev.repeat === "weekly" ? "週" : "月"}</span>}
                {/* Emoji reactions */}
                {ev.emoji && <span className="text-xs">{ev.emoji}</span>}
                <div className="hidden group-hover:flex items-center gap-0.5">
                  {REACTIONS.map((e) => (
                    <button key={e} onClick={() => reactEvent(ev.id, e)} className="text-xs hover:scale-125 transition-transform">{e}</button>
                  ))}
                </div>
                <span className={`text-[10px] ${C[ev.type]?.text}`}>{LABEL[ev.type]}</span>
                <button onClick={() => removeEvent(ev.id)} className="text-star-dim hover:text-red-400 text-xs ml-1">×</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add event modal */}
      {showAdd && selectedDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="glass p-5 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-star">新增事件</h3>
            <p className="text-xs text-star-dim">{selectedDate}</p>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="事件標題" className="w-full px-3 py-2.5 bg-white/5 rounded-lg text-star placeholder-star-dim/50 outline-none" autoFocus />
            <div className="flex gap-2">
              {["you","me","us"].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 rounded-lg text-sm border ${form.type === t ? `${C[t].border} ${C[t].bg} ${C[t].text}` : "border-white/10 text-star-dim"}`}>{LABEL[t]}</button>
              ))}
            </div>
            <div className="flex gap-2">
              {[{ k: null, v: "單次" }, { k: "weekly", v: "每週" }, { k: "monthly", v: "每月" }].map(({ k, v }) => (
                <button key={v} onClick={() => setForm({ ...form, repeat: k })}
                  className={`flex-1 py-2 rounded-lg text-sm border ${form.repeat === k ? "border-glow-purple bg-us/15 text-glow-purple" : "border-white/10 text-star-dim"}`}>{v}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setSelectedDate(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-star-dim text-sm">取消</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-glow-purple to-glow-pink text-white font-semibold text-sm">新增</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom legend */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-cosmic-bg/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex gap-2">
          {["you","me","us"].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-xs text-star-dim">
              <span className={`w-2 h-2 rounded-full ${C[t].dot}`} />{LABEL[t]}
            </div>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-star-dim">{Object.values(allEvents).flat().length} 個事件</span>
        </div>
      </div>

      <style>{`
        @keyframes pingFly { 0% { opacity:1; transform: translateY(0) scale(0.5); } 50% { opacity:0.8; transform: translateY(-60px) scale(1.2); } 100% { opacity:0; transform: translateY(-120px) scale(0.3); } }
      `}</style>
    </div>
  );
}
