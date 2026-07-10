import { useState, useEffect } from "react";
import { useAuth } from "../store";

export default function Home() {
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("start"); // start | create | join

  const createPair = () => {
    if (!name.trim()) return;
    const me = { id: crypto.randomUUID(), name: name.trim(), pairCode: crypto.randomUUID().slice(0, 8), paired: false };
    localStorage.setItem("cosmic_user", JSON.stringify(me));
    setUser(me);
  };

  const joinPair = () => {
    if (!name.trim() || !code.trim()) return;
    const me = { id: crypto.randomUUID(), name: name.trim(), pairCode: code.trim(), paired: true };
    localStorage.setItem("cosmic_user", JSON.stringify(me));
    setUser(me);
  };

  return (
    <div className="min-h-screen bg-cosmic-bg flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Binary star visual */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full bg-glow-pink/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-32 h-32 rounded-full bg-glow-blue/20 blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-glow-purple/10 blur-3xl" />
      </div>

      <div className="relative z-10 text-center space-y-8 max-w-md w-full">
        <div className="space-y-4">
          <h1 className="text-5xl font-display font-bold">
            <span className="text-glow-pink">✦</span>{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-glow-pink via-glow-purple to-glow-blue">Cosmic</span>
          </h1>
          <p className="text-star-dim text-lg">你們的雙星日曆</p>
        </div>

        {step === "start" && (
          <div className="space-y-4">
            <button onClick={() => setStep("create")} className="btn-primary w-full text-white text-lg py-4">
              建立雙星連線
            </button>
            <button onClick={() => setStep("join")} className="w-full py-4 rounded-xl border border-white/10 text-star-dim hover:text-star hover:border-white/20 transition-all">
              加入對方的星系
            </button>
          </div>
        )}

        {step === "create" && (
          <div className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" className="w-full px-4 py-3 glass text-star placeholder-star-dim/50 outline-none" autoFocus />
            <button onClick={createPair} className="btn-primary w-full text-white">建立連線</button>
            <p className="text-xs text-star-dim">建立後會產生邀請碼，分享給對方即可配對</p>
            <button onClick={() => setStep("start")} className="text-star-dim hover:text-star text-sm">← 返回</button>
          </div>
        )}

        {step === "join" && (
          <div className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" className="w-full px-4 py-3 glass text-star placeholder-star-dim/50 outline-none" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="對方的邀請碼" className="w-full px-4 py-3 glass text-star placeholder-star-dim/50 outline-none" />
            <button onClick={joinPair} className="btn-primary w-full text-white">加入星系</button>
            <button onClick={() => setStep("start")} className="text-star-dim hover:text-star text-sm">← 返回</button>
          </div>
        )}
      </div>
    </div>
  );
}
