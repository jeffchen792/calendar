import { useMemo } from "react";

// Preload photos from public/photos/
const photoList = [
  "/photos/IMG_5394.JPG",
  "/photos/IMG_6193.jpg",
  "/photos/IMG_8128.jpg",
  "/photos/fxn 2024-06-19 175550.817.JPG",
  "/photos/original 2025-03-22 163426.436.JPG",
];

const driftStyles = [
  { from: "translate(0,0) rotate(-3deg)", to: "translate(8%, 6%) rotate(5deg)" },
  { from: "translate(5%, -2%) rotate(4deg)", to: "translate(-3%, 8%) rotate(-4deg)" },
  { from: "translate(-5%, 4%) rotate(-6deg)", to: "translate(6%, -3%) rotate(3deg)" },
  { from: "translate(2%, 8%) rotate(2deg)", to: "translate(-6%, -2%) rotate(-5deg)" },
  { from: "translate(-8%, -3%) rotate(5deg)", to: "translate(4%, 4%) rotate(-2deg)" },
];

export default function FloatingPhotos() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-cosmic-deep/75 backdrop-blur-[2px]" />

      {/* Floating photo cards */}
      {photoList.map((src, i) => {
        const style = driftStyles[i % driftStyles.length];
        return (
          <div
            key={i}
            className="absolute w-40 h-48 md:w-52 md:h-64 rounded-xl overflow-hidden shadow-2xl border border-white/5"
            style={{
              left: `${10 + (i * 19) % 75}%`,
              top: `${8 + (i * 22) % 70}%`,
              background: `url(${src}) center/cover`,
              animation: `photoDrift${i} ${9 + i * 2}s ease-in-out infinite alternate`,
              animationDelay: `${i * 1.5}s`,
              opacity: 0.35,
            }}
          />
        );
      })}

      <style>{`
        ${photoList.map((_, i) => {
          const s = driftStyles[i % driftStyles.length];
          return `@keyframes photoDrift${i} { from { transform: ${s.from}; } to { transform: ${s.to}; } }`;
        }).join("\n")}
      `}</style>
    </div>
  );
}
