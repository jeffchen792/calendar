import { useState, useMemo, useEffect } from "react";
import { useAuth, useEvents, useMood, useMissYou, useLists, usePeriod, getRecurringDates, getPeriodInfo, fetchPairInfo, updatePairedAt, fmtDate } from "../store";
import FloatingPhotos from "../components/FloatingPhotos";
import CosmosView from "../components/cosmos/CosmosView";

const C = {
  you: { border: "border-you", text: "text-you", bg: "bg-you/15", dot: "bg-you" },
  me: { border: "border-me", text: "text-me", bg: "bg-me/15", dot: "bg-me" },
  us: { border: "border-us", text: "text-us", bg: "bg-us/15", dot: "bg-us" },
};
const LABEL = { you: "你", me: "他", us: "我們" };
const MOODS = { sunny: "☀️", cloudy: "☁️", rainy: "🌧️", stormy: "⛈️" };
const REACTIONS = ["❤️", "😂", "🥺", "🎉", "💪"];
const LIST_CATS = [
  { k: "eat", label: "🍜 想吃" },
  { k: "go", label: "📍 想去" },
  { k: "watch", label: "🎬 想看" },
  { k: "other", label: "✨ 其他" },
];

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
  const { user, partner, logout } = useAuth();
  const { events, addEvent, removeEvent, reactEvent } = useEvents();
  const { myMood, setMyMood, partnerMood } = useMood();
  const { pings, sendPing, clearPings } = useMissYou();
  const { items, addItem, toggleItem, removeItem } = useLists();
  const { logs: periodLogs, toggleLog: togglePeriod } = usePeriod();
  const [bucketCat, setBucketCat] = useState("eat");
  const [bucketText, setBucketText] = useState("");
  const [bucketError, setBucketError] = useState("");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView] = useState("month");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ title: "", type: "us", repeat: null, notes: "", time: "" });
  const [showMood, setShowMood] = useState(false);
  const [showPairedEdit, setShowPairedEdit] = useState(false);
  const [pairedDate, setPairedDate] = useState(user?.pairedAt || "");

  const daysTgt = (d) => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0;

  // Load saved mood
  useEffect(() => { setMyMood(localStorage.getItem("cosmic_mood") || null); }, []);

  // Fetch partner info + subscribe to realtime + sync shared paired_at
  useEffect(() => {
    const u = user;
    if (!u?.pairId) return;
    import("../store").then(({ subAll, useAuth: a }) => {
      subAll(u.pairId);
      fetchPairInfo(u.pairId);
      // Fetch partner
      import("../lib/supabase").then(({ supabase: sb }) => {
        if (!sb) return;
        sb.from("users").select("*").eq("pair_id", u.pairId).neq("id", u.id).single().then(({ data }) => {
          if (data) a.getState().setPartner(data);
        });
      });
    });
  }, [user?.pairId]);

  // pairedDate input 要跟著 fetchPairInfo 同步回來的權威值走，
  // 不能只吃 useState 初始值（那只在 mount 那一刻讀一次）
  useEffect(() => { setPairedDate(user?.pairedAt || ""); }, [user?.pairedAt]);

  const monthNames = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const weekDays = ["日","一","二","三","四","五","六"];
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayStr = fmtDate(today);

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
    // 同一天的事件依時間排序，沒填時間的排最後
    Object.values(map).forEach((evs) => evs.sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1));
    return map;
  }, [events]);

  // 下一個倒數目標：最近的未來事件 vs 下一個週年，取比較近的那個
  const nextUp = useMemo(() => {
    let best = null;
    const future = Object.keys(allEvents).filter((d) => d > todayStr).sort();
    if (future.length) best = { date: future[0], title: allEvents[future[0]][0].title };
    if (user?.pairedAt) {
      const p = new Date(user.pairedAt + "T00:00:00");
      const anniv = new Date(today.getFullYear(), p.getMonth(), p.getDate());
      if (fmtDate(anniv) <= todayStr) anniv.setFullYear(anniv.getFullYear() + 1);
      const ds = fmtDate(anniv);
      if (!best || ds < best.date) best = { date: ds, title: `在一起 ${anniv.getFullYear() - p.getFullYear()} 週年` };
    }
    if (!best) return null;
    const days = Math.round((new Date(best.date + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000);
    return { ...best, days };
  }, [allEvents, user?.pairedAt, todayStr]);

  // 經期預測（僅供參考，根據過去紀錄的平均週期推算）
  const periodInfo = useMemo(() => getPeriodInfo(periodLogs), [periodLogs]);

  const periodBanner = useMemo(() => {
    if (!periodInfo) return null;
    if (periodInfo.recordedDays[todayStr]) {
      const dayNum = Math.round((new Date(todayStr + "T00:00:00") - new Date(periodInfo.lastStart + "T00:00:00")) / 86400000) + 1;
      return { text: `生理期中・第 ${dayNum} 天`, tone: "active" };
    }
    const toNext = Math.round((new Date(periodInfo.nextStart + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000);
    if (toNext >= 0 && toNext <= 5) {
      return { text: toNext === 0 ? "預計今天生理期會來" : `預計 ${toNext} 天後生理期來`, tone: "soon" };
    }
    return null;
  }, [periodInfo, todayStr]);

  // "This day last year"
  const oneYearAgo = useMemo(() => {
    const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
    const ds = fmtDate(d);
    return { date: ds, events: allEvents[ds] || [] };
  }, [allEvents]);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  const [addError, setAddError] = useState("");

  const handleAdd = async () => {
    if (!form.title || !selectedDate) return;
    // 只送資料表存在的欄位；pair_id 一定要帶，不然 RLS 會整筆擋掉
    const { error } = await addEvent({
      title: form.title, date: selectedDate, type: form.type,
      repeat: form.repeat, notes: form.notes || null, time: form.time || null,
      pair_id: user?.pairId, created_by: user?.id,
    });
    if (error) { setAddError(`新增失敗：${error}`); return; }
    setAddError("");
    setForm({ title: "", type: "us", repeat: null, notes: "", time: "" });
    setShowAdd(false); setSelectedDate(null);
  };

  const handleAddItem = async () => {
    if (!bucketText.trim()) return;
    const { error } = await addItem({ text: bucketText.trim(), category: bucketCat, pair_id: user?.pairId, created_by: user?.id });
    if (error) { setBucketError(`新增失敗：${error}`); return; }
    setBucketError(""); setBucketText("");
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
        <div className="flex items-center gap-2">
          <button onClick={() => setShowMood(!showMood)} className="text-xl" title="心情">
            {myMood ? MOODS[myMood] : "🌤️"}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-you" />
            <span className="text-star text-sm font-medium">{user?.name}</span>
            {myMood && <span className="text-xs">{MOODS[myMood]}</span>}
          </div>
          <span className="text-star-dim text-xs">✦</span>
          {/* 一定要能點得到，不能只在已經有日期時才顯示——
              不然沒設定過的人永遠找不到入口去設定 */}
          <button onClick={() => setShowPairedEdit(!showPairedEdit)}
            className="text-[10px] text-star-dim hover:text-star underline decoration-dotted underline-offset-2">
            {user?.pairedAt ? `${daysTgt(user.pairedAt)}天` : "設定紀念日"}
          </button>
          <div className="flex items-center gap-1.5">
            {partnerMood && <span className="text-xs">{MOODS[partnerMood]}</span>}
            <span className="text-star text-sm font-medium">{partner?.name || "???"}</span>
            <span className="w-3 h-3 rounded-full bg-me" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => sendPing({ pair_id: user?.pairId, from_user: user?.id })}
            className="text-sm hover:scale-110 transition-transform" title="想你">💫</button>
          <button onClick={logout} className="text-star-dim hover:text-star text-xs">登出</button>
        </div>
      </header>

      {/* 等待配對 banner — 對方登入（抓得到 partner）後就收起來 */}
      {!partner && user?.pairId && (
        <div className="glass mx-3 mt-2 p-3 text-center border border-glow-purple/30">
          <p className="text-sm text-star">✦ 等待另一顆星</p>
          <p className="text-[11px] text-star-dim mt-1">請另一半打開這個網站、用他的 Google 帳號登入，就會自動配對</p>
        </div>
      )}
      {/* 舊版邀請碼流程（本地模式備援） */}
      {user?.pairCode && !user?.pairId && !partner && (
        <div className="glass mx-3 mt-2 p-3 text-center border border-glow-purple/30">
          <p className="text-xs text-star-dim">你的邀請碼</p>
          <p className="text-lg font-mono font-bold tracking-[0.2em] text-glow-purple select-all mt-1">{user.pairCode}</p>
          <p className="text-[10px] text-star-dim mt-1">分享給對方，在「加入星系」輸入</p>
        </div>
      )}

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

      {/* Countdown banner：最近的未來事件或週年 */}
      {nextUp && (
        <div className="glass mx-3 mt-2 px-4 py-2.5 flex items-center gap-2.5">
          <span className="text-base">⏳</span>
          <p className="text-sm text-star flex-1 truncate">{nextUp.title}</p>
          <p className="text-xs text-star-dim shrink-0">
            {nextUp.days === 1 ? "就是明天！" : <>還有 <span className="text-glow-purple font-bold text-sm">{nextUp.days}</span> 天</>}
          </p>
        </div>
      )}

      {/* Period tracker banner */}
      {periodBanner && (
        <div className={`glass mx-3 mt-2 px-4 py-2.5 flex items-center gap-2.5 border-l-2 ${periodBanner.tone === "active" ? "border-rose-400/60" : "border-rose-400/30"}`}>
          <span className="text-base">🩸</span>
          <p className="text-sm text-star flex-1">{periodBanner.text}</p>
          <p className="text-[9px] text-star-dim">推算僅供參考</p>
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

      {/* Paired date editor */}
      {showPairedEdit && (
        <div className="glass mx-3 mt-2 p-3 flex gap-2 items-center justify-center">
          <input type="date" value={pairedDate} onChange={(e) => setPairedDate(e.target.value)}
            className="px-3 py-1.5 bg-white/5 rounded-lg text-star text-sm outline-none" />
          <button onClick={async () => {
            if (!pairedDate) return;
            // 寫回 pairs 表，兩人的裝置都會看到同一個日期，
            // 不是各自存在自己 localStorage 裡各說各話
            await updatePairedAt(user?.pairId, pairedDate);
            setShowPairedEdit(false);
          }} className="px-3 py-1.5 rounded-lg bg-glow-purple/20 text-glow-purple text-sm">儲存</button>
        </div>
      )}

      {/* View toggle + CosmosView */}
      {view === "cosmos" ? (
        <CosmosView events={events} user={user} partner={partner} pairedAt={user?.pairedAt} onBack={() => setView("month")} />
      ) : (
        <>
          {/* View toggle */}
          <div className="flex mx-3 mt-2 bg-white/5 rounded-lg p-0.5">
            {["month", "list", "bucket", "cosmos"].map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-1.5 text-xs rounded-md transition-all ${view === v ? "bg-white/10 text-star" : "text-star-dim"}`}>
                {v === "month" ? "月曆" : v === "list" ? "列表" : v === "bucket" ? "清單" : "星空"}
              </button>
            ))}
          </div>

          {/* 月曆視圖：月份導覽 + 格子。之前這段沒被 view 條件包住，
              導致「列表」按鈕點了跟「月曆」畫面一模一樣——現在分開 */}
          {view === "month" && (
            <>
              <div className="flex items-center justify-between mx-3 mt-4 px-2">
                <button onClick={prevMonth} className="text-star-dim hover:text-star text-xl px-2">‹</button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-display font-bold text-star">{year}年 {monthNames[month]}</h2>
                  <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                    className="text-xs px-2 py-1 rounded-full border border-white/10 text-star-dim hover:text-star">今天</button>
                </div>
                <button onClick={nextMonth} className="text-star-dim hover:text-star text-xl px-2">›</button>
              </div>

              <div className="mx-2 mt-3">
                <div className="grid grid-cols-7 text-center mb-1">
                  {weekDays.map((d, i) => (
                    <div key={i} className={`text-xs py-1 ${i === 0 || i === 6 ? "text-star-dim/50" : "text-star-dim/70"}`}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden">
                  {days.map((date, i) => {
                    if (!date) return <div key={`e${i}`} className="bg-transparent" />;
                    const ds = fmtDate(date);
                    const isToday = ds === todayStr;
                    const dayEvents = allEvents[ds] || [];
                    const isPeriod = periodInfo?.recordedDays[ds];
                    const isPeriodPredicted = !isPeriod && periodInfo?.predictedDays[ds];
                    return (
                      <div key={ds} onClick={() => { setSelectedDate(ds); setShowAdd(true); }}
                        className={`min-h-14 sm:min-h-[4.2rem] bg-cosmic-deep/55 p-0.5 sm:p-1 cursor-pointer hover:bg-white/5 transition-colors relative overflow-hidden ${isToday ? "today-breathe ring-1 ring-glow-purple/50 ring-inset" : ""} ${isPeriod ? "bg-rose-500/10" : ""}`}>
                        <div className="flex items-center gap-0.5">
                          <span className={`text-[10px] sm:text-xs px-0.5 ${isToday ? "text-glow-purple font-bold" : "text-star-dim/60"}`}>{date.getDate()}</span>
                          {isPeriod && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" title="生理期" />}
                          {isPeriodPredicted && <span className="w-1.5 h-1.5 rounded-full border border-rose-400/60 shrink-0" title="預測生理期" />}
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {dayEvents.slice(0, 2).map((ev, j) => (
                            <div key={`${ev.id}-${j}`} className={`text-[8px] sm:text-[9px] leading-tight truncate rounded px-0.5 sm:px-1 py-px ${C[ev.type]?.bg} ${C[ev.type]?.text}`}>{ev.title}</div>
                          ))}
                          {dayEvents.length > 2 && <div className="text-[8px] text-star-dim/60 px-0.5">+{dayEvents.length - 2}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* 列表視圖：依日期分組的扁平清單，不含月曆格子 */}
          {view === "list" && (
            <div className="mx-3 mt-4 space-y-2">
              {Object.entries(allEvents).sort(([a],[b]) => a.localeCompare(b)).map(([date, evs]) => (
                <div key={date} className="glass p-3">
                  <div className="text-xs text-star-dim mb-2">{date} ({new Date(date).toLocaleDateString("zh-TW", { weekday: "short" })})</div>
                  {evs.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2 py-1.5 border-t border-white/5 group">
                      <span className={`w-2 h-2 rounded-full ${C[ev.type]?.dot}`} />
                      <span className="text-star text-sm flex-1">
                        {ev.time && <span className="text-star-dim text-xs mr-1.5">{ev.time.slice(0, 5)}</span>}
                        {ev.title}
                      </span>
                      {ev.repeat && <span className="text-[9px] text-star-dim/50 mr-1">↻{ev.repeat === "weekly" ? "週" : ev.repeat === "monthly" ? "月" : "年"}</span>}
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
              {Object.keys(allEvents).length === 0 && (
                <p className="text-star-dim text-center py-12 text-sm">尚無事件，點月曆中的日期來新增</p>
              )}
            </div>
          )}

          {/* 共同清單：想吃/想去/想看，兩個人即時同步 */}
          {view === "bucket" && (
            <div className="mx-3 mt-4 space-y-3">
              <div className="flex gap-1.5">
                {LIST_CATS.map(({ k, label }) => (
                  <button key={k} onClick={() => setBucketCat(k)}
                    className={`flex-1 py-2 rounded-lg text-xs border transition-colors ${bucketCat === k ? "border-glow-purple bg-us/15 text-star" : "border-white/10 text-star-dim"}`}>
                    {label}
                    <span className="ml-1 opacity-60">{items.filter((i) => i.category === k && !i.done).length || ""}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input value={bucketText} onChange={(e) => setBucketText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                  placeholder={`新增${LIST_CATS.find((c) => c.k === bucketCat)?.label.slice(2)}的…`}
                  className="flex-1 px-3 py-2.5 bg-white/5 rounded-lg text-star text-sm placeholder-star-dim/50 outline-none focus:ring-1 focus:ring-glow-purple/40" />
                <button onClick={handleAddItem} disabled={!bucketText.trim()}
                  className="px-4 rounded-lg bg-gradient-to-r from-glow-purple to-glow-pink text-white text-sm font-semibold disabled:opacity-40">＋</button>
              </div>
              {bucketError && <p className="text-red-400 text-xs text-center">{bucketError}</p>}

              <div className="space-y-1.5">
                {items.filter((i) => i.category === bucketCat).sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)).map((it) => (
                  <div key={it.id} className="glass px-3 py-2.5 flex items-center gap-2.5 group">
                    <button onClick={() => toggleItem(it.id, !it.done)}
                      className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center text-[10px] transition-all ${it.done ? "border-glow-purple bg-glow-purple/30 text-glow-purple" : "border-white/20 text-transparent hover:border-glow-purple/50"}`}>
                      ✓
                    </button>
                    <span className={`flex-1 text-sm ${it.done ? "text-star-dim/50 line-through" : "text-star"}`}>{it.text}</span>
                    {it.created_by === user?.id
                      ? <span className="w-2 h-2 rounded-full bg-you/70 shrink-0" title={user?.name} />
                      : <span className="w-2 h-2 rounded-full bg-me/70 shrink-0" title={partner?.name} />}
                    <button onClick={() => removeItem(it.id)} className="text-star-dim hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
                {items.filter((i) => i.category === bucketCat).length === 0 && (
                  <p className="text-star-dim text-center py-10 text-sm">還沒有東西，快加一個吧</p>
                )}
              </div>
            </div>
          )}

      {/* Day detail + add event modal */}
      {showAdd && selectedDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => { setShowAdd(false); setAddError(""); }}>
          <div className="glass p-5 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="font-display font-bold text-star">{selectedDate}</h3>
              <p className="text-xs text-star-dim mt-0.5">{new Date(selectedDate + "T00:00:00").toLocaleDateString("zh-TW", { weekday: "long" })}</p>
            </div>

            {/* 當天已有的事件：可以在這裡直接刪除、加表情 */}
            {(allEvents[selectedDate] || []).length > 0 && (
              <div className="space-y-1.5 border-b border-white/10 pb-3">
                {(allEvents[selectedDate] || []).map((ev, j) => (
                  <div key={`${ev.id}-${j}`} className="flex items-center gap-2 group">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${C[ev.type]?.dot}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-star text-sm">
                        {ev.time && <span className="text-star-dim text-xs mr-1.5">{ev.time.slice(0, 5)}</span>}
                        {ev.title}
                      </span>
                      {ev.notes && <p className="text-[10px] text-star-dim truncate">{ev.notes}</p>}
                    </div>
                    {ev.repeat && <span className="text-[9px] text-star-dim/50">↻{ev.repeat === "weekly" ? "週" : ev.repeat === "monthly" ? "月" : "年"}</span>}
                    {ev.emoji && <span className="text-xs">{ev.emoji}</span>}
                    <div className="flex items-center gap-0.5">
                      {REACTIONS.slice(0, 3).map((e) => (
                        <button key={e} onClick={() => reactEvent(ev.id, e)} className="text-xs opacity-40 hover:opacity-100 hover:scale-125 transition-all">{e}</button>
                      ))}
                    </div>
                    <button onClick={() => removeEvent(ev.id)} className="text-star-dim hover:text-red-400 text-sm px-1">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* 經期標記：直接點選日期即可標記/取消，不用另開頁面 */}
            <button onClick={() => togglePeriod(selectedDate, user?.pairId, user?.id)}
              className={`w-full py-2 rounded-lg text-sm border transition-colors ${(periodInfo?.starts || []).includes(selectedDate) ? "border-rose-400 bg-rose-500/15 text-rose-300" : "border-white/10 text-star-dim"}`}>
              🩸 {(periodInfo?.starts || []).includes(selectedDate) ? "已標記為生理期第一天（點擊取消）" : "標記為生理期第一天"}
            </button>

            <div className="flex gap-2">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="新增事件…" className="flex-1 px-3 py-2.5 bg-white/5 rounded-lg text-star placeholder-star-dim/50 outline-none focus:ring-1 focus:ring-glow-purple/40" autoFocus />
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-24 px-2 py-2.5 bg-white/5 rounded-lg text-star text-sm outline-none focus:ring-1 focus:ring-glow-purple/40" />
            </div>
            <div className="flex gap-2">
              {["you","me","us"].map((t) => (
                <button key={t} onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${form.type === t ? `${C[t].border} ${C[t].bg} ${C[t].text}` : "border-white/10 text-star-dim"}`}>{LABEL[t]}</button>
              ))}
            </div>
            <div className="flex gap-2">
              {[{ k: null, v: "單次" }, { k: "weekly", v: "每週" }, { k: "monthly", v: "每月" }, { k: "yearly", v: "每年" }].map(({ k, v }) => (
                <button key={v} onClick={() => setForm({ ...form, repeat: k })}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${form.repeat === k ? "border-glow-purple bg-us/15 text-glow-purple" : "border-white/10 text-star-dim"}`}>{v}</button>
              ))}
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="備註（選填）" rows={2}
              className="w-full px-3 py-2.5 bg-white/5 rounded-lg text-star text-sm placeholder-star-dim/50 outline-none resize-none focus:ring-1 focus:ring-glow-purple/40" />
            {addError && <p className="text-red-400 text-xs text-center">{addError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowAdd(false); setSelectedDate(null); setAddError(""); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-star-dim text-sm">取消</button>
              <button onClick={handleAdd} disabled={!form.title}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-glow-purple to-glow-pink text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed">新增</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom legend */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-cosmic-bg/90 backdrop-blur-xl border-t border-white/5">
        <div className="flex gap-2 flex-wrap">
          {["you","me","us"].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-xs text-star-dim">
              <span className={`w-2 h-2 rounded-full ${C[t].dot}`} />{LABEL[t]}
            </div>
          ))}
          {periodInfo && (
            <div className="flex items-center gap-1.5 text-xs text-star-dim">
              <span className="w-2 h-2 rounded-full bg-rose-400" />生理
            </div>
          )}
          <div className="flex-1" />
          <span className="text-xs text-star-dim">{Object.values(allEvents).flat().length} 個事件</span>
        </div>
      </div>
        </>
      )}

      <style>{`
        @keyframes pingFly { 0% { opacity:1; transform: translateY(0) scale(0.5); } 50% { opacity:0.8; transform: translateY(-60px) scale(1.2); } 100% { opacity:0; transform: translateY(-120px) scale(0.3); } }
        @keyframes todayBreathe { 0%,100% { box-shadow: inset 0 0 6px rgba(216,180,254,0.15); } 50% { box-shadow: inset 0 0 14px rgba(216,180,254,0.45); } }
        .today-breathe { animation: todayBreathe 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
