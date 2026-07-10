import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { supabase } from "../../lib/supabase";
import { useAuth, useNotes } from "../../store";
import BinaryStars from "./BinaryStars";
import NoteSparks from "./NoteSparks";
import MergeCelebration from "./MergeCelebration";
import { cosmosState } from "./cosmosState";

function Scene({ events, pairedAt, mergeMode, mergeProgress }) {
  return (
    <>
      <color attach="background" args={["#050310"]} />
      <ambientLight intensity={0.4} />
      <BinaryStars events={events} pairedAt={pairedAt} mergeMode={mergeMode} mergeProgress={mergeProgress} />
      <NoteSparks />
      <MergeCelebration active={mergeMode && mergeProgress > 0} progress={mergeProgress} />
    </>
  );
}

export default function CosmosView({ events, user, partner, pairedAt, onBack }) {
  const { notes, addNote } = useNotes();
  const [showInput, setShowInput] = useState(false);
  const [text, setText] = useState("");
  const [todayNotes, setTodayNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);

  // ── Anniversary detection ──
  const isTest = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("merge");
  const anniversary = useMemo(() => {
    if (!pairedAt) return null;
    // Find the next anniversary of pairedAt
    const start = new Date(pairedAt);
    const today = new Date();
    let anni = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (anni < today) anni.setFullYear(anni.getFullYear() + 1);
    const daysLeft = Math.ceil((anni - today) / 86400000);
    return { date: anni, daysLeft };
  }, [pairedAt]);

  const mergeMode = isTest || (anniversary && anniversary.daysLeft <= 7);
  const mergeToday = isTest || (anniversary && anniversary.daysLeft === 0);
  const [mergePlayed, setMergePlayed] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);

  // Play merge animation once per day
  useEffect(() => {
    if (!mergeToday) return;
    const key = `merge_played_${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) { setMergePlayed(true); return; }
    let t = 0;
    const step = () => {
      t += 0.016;
      const p = Math.min(1, t / 3); // 3 second animation
      setMergeProgress(p);
      cosmosState.mergeProgress = p;
      if (t < 3) requestAnimationFrame(step);
      else { localStorage.setItem(key, "1"); setMergePlayed(true); }
    };
    requestAnimationFrame(step);
  }, [mergeToday]);

  const daysTogether = pairedAt ? Math.floor((Date.now() - new Date(pairedAt)) / 86400000) : 1;

  // Show merge mode text
  const mergeText = useMemo(() => {
    if (!mergeMode || !pairedAt) return null;
    const years = Math.floor(daysTogether / 365);
    if (mergeToday) return `在一起 ${years} 年 ✦ ${new Date(pairedAt).toISOString().slice(0, 10)}`;
    return `${anniversary?.daysLeft || "?"} 天後紀念日`;
  }, [mergeMode, mergeToday, daysTogether, pairedAt]);

  const upcoming = events
    .filter((ev) => new Date(ev.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  // Subscribe to notes realtime
  useEffect(() => {
    if (!supabase || !user?.pairId) return;
    const ch = supabase
      .channel("notes-cosmos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter: `pair_id=eq.${user.pairId}` },
        (payload) => {
          const n = payload.new;
          // Push spark from the other person
          if (n.from_user !== user.id) {
            cosmosState.sparkQueue.push({ fromMe: false, id: n.id });
          }
          // Refresh today's notes if showing
          if (showNotes) fetchTodayNotes();
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.pairId]);

  const fetchTodayNotes = useCallback(async () => {
    if (!supabase || !user?.pairId) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("pair_id", user.pairId)
      .gte("created_at", today)
      .order("created_at", { ascending: false });
    if (data) setTodayNotes(data);
  }, [user?.pairId]);

  useEffect(() => { if (showNotes) fetchTodayNotes(); }, [showNotes]);

  const handleSend = async () => {
    if (!text.trim() || !supabase || !user?.pairId) return;
    const note = {
      pair_id: user.pairId,
      from_user: user.id,
      text: text.trim(),
    };
    const { data } = await supabase.from("notes").insert(note).select().single();
    if (data) {
      addNote(data);
      cosmosState.sparkQueue.push({ fromMe: true, id: data.id });
    }
    setText("");
    setShowInput(false);
  };

  const handleStarClick = () => {
    setShowNotes(true);
    fetchTodayNotes();
  };

  return (
    <div className="fixed inset-0 z-20 bg-[#050310]">
      {/* 3D Canvas */}
      <div className="absolute inset-0 pointer-events-none">
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
          camera={{ position: [0, 4, 14], fov: 45, near: 0.1, far: 100 }}
        >
          <Suspense fallback={null}>
            <Scene events={events} pairedAt={pairedAt} mergeMode={mergeMode} mergeProgress={mergeProgress} />
          </Suspense>
        </Canvas>
      </div>

      {/* HUD overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
        {/* Top: days counter */}
        <div className="pointer-events-auto self-start glass px-4 py-2">
          <p className="text-xs text-star-dim">在一起</p>
          <p className="text-xl font-display font-bold text-star">{daysTogether} 天</p>
        </div>

        {/* Bottom section */}
        <div className="pointer-events-auto space-y-3">
          {/* Upcoming events */}
          {upcoming.length > 0 && (
            <div className="glass p-3 space-y-1.5">
              <p className="text-[10px] text-star-dim tracking-widest uppercase">即將到來</p>
              {upcoming.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-sm text-star/80">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ev.type === "you" ? "#f472b6" : ev.type === "me" ? "#60a5fa" : "#c084fc" }} />
                  <span>{ev.title}</span>
                  <span className="text-xs text-star-dim ml-auto">{ev.date}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={() => setShowInput(!showInput)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-star-dim hover:text-star hover:border-white/20 transition-all text-sm">
              ✉️ 寫紙條
            </button>
            <button onClick={handleStarClick}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-star-dim hover:text-star hover:border-white/20 transition-all text-sm">
              💌 收紙條
            </button>
          </div>

          <button onClick={onBack}
            className="w-full py-2.5 rounded-xl border border-white/10 text-star-dim hover:text-star hover:border-white/20 transition-all text-sm">
            ← 回到月曆
          </button>
        </div>
      </div>

      {/* Note input modal */}
      {showInput && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowInput(false)}>
          <div className="glass p-5 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-star">✉️ 小紙條</h3>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="寫給對方..." rows={3}
              className="w-full px-3 py-2.5 bg-white/5 rounded-lg text-star placeholder-star-dim/50 outline-none resize-none" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setShowInput(false); setText(""); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-star-dim text-sm">取消</button>
              <button onClick={handleSend}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-glow-purple to-glow-pink text-white font-semibold text-sm">送出 💫</button>
            </div>
          </div>
        </div>
      )}

      {/* Received notes panel */}
      {showNotes && (
        <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowNotes(false)}>
          <div className="glass p-5 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl space-y-4 max-h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-star">💌 今天的紙條</h3>
            {todayNotes.length === 0 ? (
              <p className="text-star-dim text-sm text-center py-4">今天還沒有紙條</p>
            ) : (
              todayNotes.map((n) => (
                <div key={n.id} className="border-b border-white/5 pb-2 last:border-0">
                  <p className="text-star text-sm">{n.text}</p>
                  <p className="text-star-dim text-[10px] mt-1">{new Date(n.created_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              ))
            )}
            <button onClick={() => setShowNotes(false)}
              className="w-full py-2 rounded-xl border border-white/10 text-star-dim text-sm">關閉</button>
          </div>
        </div>
      )}
    </div>
  );
}
