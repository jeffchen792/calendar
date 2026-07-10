import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import BinaryStars from "./BinaryStars";
import { cosmosState } from "./cosmosState";

function Scene({ events, pairedAt }) {
  return (
    <>
      <color attach="background" args={["#050310"]} />
      <ambientLight intensity={0.4} />
      <BinaryStars events={events} pairedAt={pairedAt} />
    </>
  );
}

export default function CosmosView({ events, user, partner, pairedAt, onBack }) {
  const daysTogether = pairedAt
    ? Math.floor((Date.now() - new Date(pairedAt)) / 86400000)
    : 1;

  // Upcoming events (next 5, sorted by date)
  const upcoming = events
    .filter((ev) => new Date(ev.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

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
            <Scene events={events} pairedAt={pairedAt} />
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

        {/* Bottom: upcoming events + back button */}
        <div className="pointer-events-auto space-y-3">
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
          <button onClick={onBack}
            className="w-full py-2.5 rounded-xl border border-white/10 text-star-dim hover:text-star hover:border-white/20 transition-all text-sm">
            ← 回到月曆
          </button>
        </div>
      </div>
    </div>
  );
}
