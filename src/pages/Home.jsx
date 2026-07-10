import { useState } from "react";
import { useAuth, createPair, joinPair } from "../store";

export default function Home() {
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pairedAt, setPairedAt] = useState(new Date().toISOString().slice(0, 10));
  const [step, setStep] = useState("start");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const pairCode = await createPair(name.trim(), pairedAt);
    if (pairCode) {
      setInviteCode(pairCode);
      setStep("showCode");
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    const result = await joinPair(name.trim(), code.trim());
    if (result.error) {
      setError(result.error);
    }
    setLoading(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
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
            <div className="space-y-1">
              <p className="text-[10px] text-star-dim tracking-widest uppercase text-center">在一起的第一天</p>
              <input type="date" value={pairedAt} onChange={(e) => setPairedAt(e.target.value)} className="w-full px-4 py-3 glass text-star placeholder-star-dim/50 outline-none text-center" />
            </div>
            <button onClick={handleCreate} className="btn-primary w-full text-white">{loading ? "建立中..." : "建立連線"}</button>
            <button onClick={() => setStep("start")} className="w-full py-2 text-star-dim text-sm">← 返回</button>
          </div>
        )}

        {step === "showCode" && (
          <div className="space-y-5">
            <p className="text-star-dim">你的邀請碼</p>
            <div className="glass p-6 text-center space-y-3">
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-glow-purple select-all">{inviteCode}</p>
              <button onClick={copyCode} className="text-xs text-star-dim hover:text-star border border-white/10 rounded-lg px-3 py-1">
                {navigator.clipboard ? "點擊複製" : "長按複製"}
              </button>
            </div>
            <p className="text-xs text-star-dim">把這組碼傳給對方，他在「加入星系」輸入即可配對</p>
            <button onClick={() => setUser(useAuth.getState().user)} className="btn-primary w-full text-white">
              進入日曆 →
            </button>
          </div>
        )}

        {step === "join" && (
          <div className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" className="w-full px-4 py-3 glass text-star placeholder-star-dim/50 outline-none" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="對方給你的 8 碼邀請碼" className="w-full px-4 py-3 glass text-star placeholder-star-dim/50 outline-none text-center font-mono tracking-widest" maxLength={8} />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button onClick={handleJoin} className="btn-primary w-full text-white">{loading ? "加入中..." : "加入星系"}</button>
            <button onClick={() => setStep("start")} className="text-star-dim hover:text-star text-sm">← 返回</button>
          </div>
        )}
      </div>
    </div>
  );
}
