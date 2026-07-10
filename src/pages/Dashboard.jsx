import { useState, useMemo } from "react";
import { useAuth, useEvents } from "../store";
import FloatingPhotos from "../components/FloatingPhotos";

const COLORS = { you: { border: "border-you", text: "text-you", bg: "bg-you/15", dot: "bg-you" },
  me: { border: "border-me", text: "text-me", bg: "bg-me/15", dot: "bg-me" },
  us: { border: "border-us", text: "text-us", bg: "bg-us/15", dot: "bg-us" } };
const LABEL = { you: "你", me: "他", us: "我們" };

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const { events, addEvent, removeEvent } = useEvents();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ title: "", type: "us", notes: "" });
  const [view, setView] = useState("month"); // month | list

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const weekDays = ["日","一","二","三","四","五","六"];
  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      const key = ev.date;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const todayStr = today.toISOString().slice(0, 10);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setShowAdd(true);
  };

  const handleAdd = () => {
    if (!form.title || !selectedDate) return;
    addEvent({ id: crypto.randomUUID(), title: form.title, date: selectedDate, type: form.type, notes: form.notes, createdAt: new Date().toISOString() });
    setForm({ title: "", type: "us", notes: "" });
    setShowAdd(false);
    setSelectedDate(null);
  };

  return (
    <div className="min-h-screen bg-cosmic-bg pb-24 relative">
      <FloatingPhotos />
      {/* Header */}
      <header className="glass mx-3 mt-3 p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-you" />
            <span className="text-star text-sm font-medium">{user?.name || "你"}</span>
          </div>
          <span className="text-star-dim text-xs">✦</span>
          <div className="flex items-center gap-1.5">
            <span className="text-star text-sm font-medium">{user?.partner ? user.partner.name : "???"}</span>
            <span className="w-3 h-3 rounded-full bg-me" />
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem("cosmic_user"); setUser(null); }}
          className="text-star-dim hover:text-star text-xs">登出</button>
      </header>

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

      {/* View toggle */}
      <div className="flex mx-3 mt-2 bg-white/5 rounded-lg p-0.5">
        {["month","list"].map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-1.5 text-xs rounded-md transition-all ${view === v ? "bg-white/10 text-star" : "text-star-dim"}`}>
            {v === "month" ? "月曆" : "列表"}
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      {view === "month" && (
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
              const dayEvents = eventsByDate[ds] || [];
              return (
                <div key={ds} onClick={() => handleDayClick(ds)}
                  className={`aspect-square bg-cosmic-deep/80 p-1 cursor-pointer hover:bg-white/5 transition-colors relative ${
                    isToday ? "ring-1 ring-glow-purple/50 ring-inset" : ""}`}>
                  <span className={`text-xs ${isToday ? "text-glow-purple font-bold" : "text-star-dim/60"}`}>{date.getDate()}</span>
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span key={ev.id} className={`w-1.5 h-1.5 rounded-full ${COLORS[ev.type]?.dot || "bg-white/30"}`} />
                    ))}
                    {dayEvents.length > 3 && <span className="text-[8px] text-star-dim/40">+{dayEvents.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="mx-3 mt-4 space-y-2">
          {Object.entries(eventsByDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, evs]) => (
            <div key={date} className="glass p-3">
              <div className="text-xs text-star-dim mb-2">{date} ({new Date(date).toLocaleDateString("zh-TW", { weekday: "short" })})</div>
              {evs.map((ev) => (
                <div key={ev.id} className={`flex items-center gap-2 py-1.5 border-t border-white/5`}>
                  <span className={`w-2 h-2 rounded-full ${COLORS[ev.type]?.dot}`} />
                  <span className="text-star text-sm flex-1">{ev.title}</span>
                  <span className={`text-[10px] ${COLORS[ev.type]?.text}`}>{LABEL[ev.type]}</span>
                  <button onClick={() => removeEvent(ev.id)} className="text-star-dim hover:text-red-400 text-xs ml-1">×</button>
                </div>
              ))}
            </div>
          ))}
          {Object.keys(eventsByDate).length === 0 && (
            <p className="text-star-dim text-center py-12">尚無事件，點月曆中的日期來新增</p>
          )}
        </div>
      )}

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
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all ${form.type === t ? `${COLORS[t].border} ${COLORS[t].bg} ${COLORS[t].text}` : "border-white/10 text-star-dim"}`}>
                  {LABEL[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setSelectedDate(null); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-star-dim text-sm">取消</button>
              <button onClick={handleAdd} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-glow-purple to-glow-pink text-white font-semibold text-sm">新增</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar on month view */}
      {view === "month" && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-cosmic-bg/90 backdrop-blur-xl border-t border-white/5">
          <div className="flex gap-2">
            {["you","me","us"].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-xs text-star-dim">
                <span className={`w-2 h-2 rounded-full ${COLORS[t].dot}`} />{LABEL[t]}
              </div>
            ))}
            <div className="flex-1" />
            <span className="text-xs text-star-dim">{events.length} 個事件</span>
          </div>
        </div>
      )}
    </div>
  );
}
