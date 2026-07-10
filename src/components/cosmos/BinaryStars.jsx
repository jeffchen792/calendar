import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmosState } from "./cosmosState";

function hashAngle(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 360) * (Math.PI / 180);
}

const COLORS = { you: "#f472b6", me: "#60a5fa", us: "#c084fc" };
const ORBIT_R = 3.2;
const OMEGA = 0.15;

export default function BinaryStars({ events = [], pairedAt, mergeMode = false }) {
  const starARef = useRef();
  const starBRef = useRef();
  const groupRef = useRef();
  const orbitRingRef = useRef();
  const prevR = useRef(ORBIT_R);

  // 放射漸層貼圖：星球光暈與圓形軟星塵共用（不用 postprocessing 的發光方案）
  const glowTex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  const starGeo = useMemo(() => new THREE.SphereGeometry(0.8, 32, 32), []);
  const planetGeo = useMemo(() => new THREE.SphereGeometry(0.18, 16, 16), []);
  const orbitGeo = useMemo(() => new THREE.TorusGeometry(ORBIT_R, 0.012, 16, 120), []);

  const dustGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(250 * 3), col = new Float32Array(250 * 3);
    const hues = [[0.96, 0.45, 0.71], [0.38, 0.65, 0.98], [0.75, 0.52, 0.99]]; // 粉/藍/紫
    for (let i = 0; i < 250; i++) {
      for (let j = 0; j < 3; j++) p[i * 3 + j] = (Math.random() - 0.5) * 30;
      const h = hues[i % 3], b = 0.5 + Math.random() * 0.5;
      col.set([h[0] * b, h[1] * b, h[2] * b], i * 3);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  }, []);
  const dustMatRef = useRef();

  const now = new Date();
  const futureEvents = useMemo(() =>
    events.filter((ev) => { const d = new Date(ev.date); return (d - now) / 86400000 >= 0 && (d - now) / 86400000 <= 60; })
      .map((ev) => ({ ...ev, daysAway: Math.max(0, (new Date(ev.date) - now) / 86400000), angle: hashAngle(ev.id) }))
  , [events]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Merge mode: shrink orbit, driven by cosmosState (not React setState)
    const targetR = mergeMode ? 0.8 : ORBIT_R;
    prevR.current = THREE.MathUtils.damp(prevR.current, targetR, 5, delta);
    const radius = prevR.current;
    const omega = mergeMode ? OMEGA * 3 : OMEGA;

    const aX = Math.cos(t * omega) * radius;
    const aZ = Math.sin(t * omega) * radius;
    const bX = Math.cos(t * omega + Math.PI) * radius;
    const bZ = Math.sin(t * omega + Math.PI) * radius;

    if (starARef.current) starARef.current.position.set(aX, 0, aZ);
    if (starBRef.current) starBRef.current.position.set(bX, 0, bZ);

    // Write shared positions (for NoteSparks)
    cosmosState.starA.set(aX, 0, aZ);
    cosmosState.starB.set(bX, 0, bZ);

    // Scale orbit ring
    if (orbitRingRef.current) orbitRingRef.current.scale.setScalar(radius / ORBIT_R);

    if (groupRef.current) groupRef.current.rotation.y += delta * 0.02;
    if (dustMatRef.current) dustMatRef.current.opacity = 0.55 + Math.sin(t * 0.8) * 0.2; // 星塵閃爍
  });

  return (
    <group ref={groupRef}>
      <points geometry={dustGeo}>
        <pointsMaterial ref={dustMatRef} size={0.18} map={glowTex} vertexColors transparent opacity={0.6}
          depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      <mesh ref={orbitRingRef} geometry={orbitGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent depthWrite={false} />
      </mesh>

      <group ref={starARef}>
        <mesh geometry={starGeo}>
          <meshStandardMaterial color={COLORS.you} emissive={COLORS.you} emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
        <sprite scale={[3.6, 3.6, 1]}>
          <spriteMaterial map={glowTex} color={COLORS.you} transparent opacity={0.55}
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <pointLight intensity={1} distance={8} color={COLORS.you} />
      </group>

      <group ref={starBRef}>
        <mesh geometry={starGeo}>
          <meshStandardMaterial color={COLORS.me} emissive={COLORS.me} emissiveIntensity={0.9} roughness={0.3} />
        </mesh>
        <sprite scale={[3.6, 3.6, 1]}>
          <spriteMaterial map={glowTex} color={COLORS.me} transparent opacity={0.55}
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
        <pointLight intensity={1} distance={8} color={COLORS.me} />
      </group>

      {futureEvents.map((ev) => {
        const orbitRadius = 5 + (ev.daysAway / 60) * 6;
        const x = Math.cos(ev.angle) * orbitRadius;
        const z = Math.sin(ev.angle) * orbitRadius;
        return (
          <mesh key={ev.id} geometry={planetGeo} position={[x, 0, z]}>
            <meshStandardMaterial color={COLORS[ev.type] || COLORS.us} emissive={COLORS[ev.type] || COLORS.us} emissiveIntensity={0.5} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}
