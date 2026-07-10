import { useState } from "react";
import { useAuth, createPair, joinPair, fmtDate, signInWithGoogle } from "../store";
import { supabase } from "../lib/supabase";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

export default function Home() {
  const { setUser, authError } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pairedAt, setPairedAt] = useState(fmtDate(new Date()));
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

        {/* 有 Supabase → Google 登入，自動配對，不用邀請碼 */}
        {supabase && (
          <div className="space-y-4">
            <button onClick={signInWithGoogle}
              className="w-full py-4 rounded-xl bg-white text-gray-800 font-semibold text-base flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(192,132,252,0.35)] transition-shadow">
              <GoogleIcon /> 用 Google 登入
            </button>
            <p className="text-xs text-star-dim leading-relaxed">
              你們兩個各自用自己的 Gmail 登入<br />第一個人建立星系，第二個人自動配對 ✦
            </p>
            {authError && <p className="text-red-400 text-sm">登入失敗：{authError}</p>}
          </div>
        )}

        {!supabase && step === "start" && (
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
