import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 漂浮拍立得照片背景 ＋ 視差 ＋ 點擊放大回憶。
// 疊層順序（由下到上）：照片（近乎不透明）→ 暗色遮罩 → 頁面內容。
// 注意：Dashboard 根元素「不能」有不透明背景，否則本層會被蓋住
// （z-index 負值的子元素會畫在父層背景之後）。
//
// 效能原則（同 R3F_RULES）：視差每幀資料走 mutable ref + rAF 直寫
// style.transform，絕不用 setState 驅動動畫。

// 照片庫：之後加新照片只要 append，每次進頁面隨機抽 MAX_SHOWN 張
const PHOTO_LIBRARY = [
  { src: "/photos/min/p1.jpg", date: "2025-11-02" },
  { src: "/photos/min/p2.jpg", date: "2024-06-25" },
  { src: "/photos/min/p3.jpg", date: "2025-06-28" },
  { src: "/photos/min/p4.jpg", date: "2024-06-19" },
  { src: "/photos/min/p5.jpg", date: "2025-03-22" },
];
const MAX_SHOWN = 5;

// 位置/大小/旋轉/漂移週期/視差深度（depth 越大 = 離鏡頭越近 = 位移越多）
const LAYOUT = [
  { left: "-4%", top: "5%",  w: 150, rot: -7, dur: 11, depth: 0.5 },
  { left: "68%", top: "12%", w: 170, rot: 6,  dur: 13, depth: 1.0 },
  { left: "8%",  top: "44%", w: 140, rot: -4, dur: 15, depth: 0.35 },
  { left: "72%", top: "58%", w: 160, rot: 8,  dur: 12, depth: 0.8 },
  { left: "30%", top: "76%", w: 150, rot: -6, dur: 14, depth: 0.65 },
];

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export default function FloatingPhotos() {
  const cardRefs = useRef([]);
  const [lightbox, setLightbox] = useState(null); // 被點開的照片 {src, date}

  // 照片輪換：每次 mount 隨機抽（Fisher-Yates）
  const shown = useMemo(() => {
    const pool = [...PHOTO_LIBRARY];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, MAX_SHOWN);
  }, []);

  // 視差：pointer / 陀螺儀 / scroll 寫入 mutable target，rAF 平滑逼近。
  // prefers-reduced-motion 時不關閉、只減半——這是跟著指標的緩慢位移，
  // 不是自動播放的動畫（自動漂移那種才在 CSS 裡完全停用）
  useEffect(() => {
    const strength = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.5 : 1;
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };

    const onPointer = (e) => {
      target.x = (e.clientX / innerWidth - 0.5) * 2;   // -1 ~ 1
      target.y = (e.clientY / innerHeight - 0.5) * 2;
    };
    // 陀螺儀（Android 直接可用；iOS 需使用者手勢授權，未授權就靜默不動）
    const onTilt = (e) => {
      if (e.gamma == null) return;
      target.x = Math.max(-1, Math.min(1, e.gamma / 30));
      target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    };
    const onScroll = () => {
      target.y = (scrollY / Math.max(1, document.body.scrollHeight - innerHeight) - 0.5) * 2;
    };

    let raf;
    const tick = () => {
      cur.x += (target.x - cur.x) * 0.06;
      cur.y += (target.y - cur.y) * 0.06;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const { rot, depth } = LAYOUT[i % LAYOUT.length];
        const px = cur.x * 26 * depth * strength;
        const py = cur.y * 18 * depth * strength;
        el.style.transform = `translate(${px}px, ${py}px) rotate(${rot}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    addEventListener("pointermove", onPointer, { passive: true });
    addEventListener("deviceorientation", onTilt, { passive: true });
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onPointer);
      removeEventListener("deviceorientation", onTilt);
      removeEventListener("scroll", onScroll);
    };
  }, []);

  // 點擊放大：本層在 -z-10 且 pointer-events: none，一般 onClick 收不到，
  // elementsFromPoint 也會跳過 pointer-events:none 的元素——
  // 所以改用 window click ＋ 手動比對每張照片的 boundingRect。
  // 游標是 pointer 的目標（按鈕、日期格）一律讓路，只攔「空白處」的點擊。
  useEffect(() => {
    const onClick = (e) => {
      if (getComputedStyle(e.target).cursor === "pointer") return;
      const hitIdx = cardRefs.current.findIndex((el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (hitIdx >= 0) setLightbox(shown[hitIdx]);
    };
    addEventListener("click", onClick);
    return () => removeEventListener("click", onClick);
  }, [shown]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      {shown.map((photo, i) => {
        const l = LAYOUT[i % LAYOUT.length];
        return (
          <div
            key={photo.src}
            data-photo-idx={i}
            ref={(el) => { cardRefs.current[i] = el; }}
            className="absolute rounded-lg bg-[#f5f2ea] p-1.5 pb-7 shadow-2xl"
            style={{
              left: l.left, top: l.top, width: l.w,
              transform: `rotate(${l.rot}deg)`,
              animation: `photoDrift ${l.dur}s ease-in-out ${i * 1.7}s infinite alternate`,
            }}
          >
            <img src={photo.src} alt="" loading="lazy"
              className="w-full aspect-[4/5] object-cover rounded-[4px]" />
          </div>
        );
      })}

      {/* 遮罩蓋在照片「上面」：保留照片彩度，同時保證前景文字可讀 */}
      <div className="absolute inset-0 bg-cosmic-bg/60" style={{ backdropFilter: "blur(1.5px)" }} />

      {/* Lightbox 用 Portal 掛到 body：本容器是 -z-10 的 stacking context，
          放裡面的話 z-[60] 只在內部比較，照樣被前景月曆蓋住 */}
      {lightbox && createPortal(
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-4 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
        >
          <div className="rounded-xl bg-[#f5f2ea] p-2 pb-3 shadow-2xl max-w-[88vw]">
            <img src={lightbox.src} alt="放大的回憶照片" className="max-h-[62vh] max-w-full rounded-md object-contain" />
            <p className="text-center text-[#3a3630] text-sm mt-2 font-display">{fmtDate(lightbox.date)}</p>
          </div>
          <p className="text-star-dim text-xs">那天的我們 ✦ 點任意處關閉</p>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes photoDrift {
          from { margin-top: 0px; margin-left: 0px; }
          to   { margin-top: -18px; margin-left: 12px; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-photo-idx] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
