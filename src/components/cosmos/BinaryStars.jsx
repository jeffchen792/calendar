import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmosState } from "./cosmosState";

// Hash event.id → fixed angle
function hashAngle(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 360) * (Math.PI / 180);
}

const COLORS = { you: "#f472b6", me: "#60a5fa", us: "#c084fc" };
const ORBIT_R = 3.2;
const OMEGA = 0.15;

export default function BinaryStars({ events = [], pairedAt, mergeMode = false, mergeProgress = 0 }) {
  const starARef = useRef();
  const starBRef = useRef();
  const groupRef = useRef();

  // Shared geometries (iron rule #6)
  const starGeo = useMemo(() => new THREE.SphereGeometry(0.8, 32, 32), []);
  const planetGeo = useMemo(() => new THREE.SphereGeometry(0.18, 16, 16), []);
  const orbitGeo = useMemo(() => new THREE.TorusGeometry(ORBIT_R, 0.012, 16, 120), []);

  // Star dust
  const dustGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(250 * 3);
    for (let i = 0; i < 250 * 3; i++) p[i] = (Math.random() - 0.5) * 30;
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);

  // Filter events: next 60 days
  const now = new Date();
  const futureEvents = useMemo(() =>
    events.filter((ev) => {
      const d = new Date(ev.date);
      const diff = (d - now) / 86400000;
      return diff >= 0 && diff <= 60;
    }).map((ev) => ({
      ...ev,
      daysAway: Math.max(0, (new Date(ev.date) - now) / 86400000),
      angle: hashAngle(ev.id),
    }))
  , [events]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Merge mode: shrink orbit
    const radius = mergeMode
      ? THREE.MathUtils.damp(starARef.current?.userData?.prevR || ORBIT_R, 0.8, 5, delta)
      : ORBIT_R;
    if (starARef.current) starARef.current.userData = { prevR: radius };
    const omega = mergeMode ? OMEGA * 3 : OMEGA;

    // Binary star orbit
    const aX = Math.cos(t * omega) * radius;
    const aZ = Math.sin(t * omega) * radius;
    const bX = Math.cos(t * omega + Math.PI) * radius;
    const bZ = Math.sin(t * omega + Math.PI) * radius;

    if (starARef.current) starARef.current.position.set(aX, 0, aZ);
    if (starBRef.current) starBRef.current.position.set(bX, 0, bZ);

    // Gentle group rotation for parallax feel
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.02;
  });

  return (
    <group ref={groupRef}>
      {/* Star dust */}
      <points geometry={dustGeo}>
        <pointsMaterial size={0.06} color="#ffffff" opacity={0.6} transparent depthWrite={false} />
      </points>

      {/* Orbit ring */}
      <mesh geometry={orbitGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ffffff" opacity={0.15} transparent depthWrite={false} />
      </mesh>

      {/* Star A (you) */}
      <group ref={starARef}>
        <mesh geometry={starGeo}>
          <meshStandardMaterial color={COLORS.you} emissive={COLORS.you} emissiveIntensity={0.6} roughness={0.3} />
        </mesh>
        <pointLight intensity={1} distance={8} color={COLORS.you} />
      </group>

      {/* Star B (me) */}
      <group ref={starBRef}>
        <mesh geometry={starGeo}>
          <meshStandardMaterial color={COLORS.me} emissive={COLORS.me} emissiveIntensity={0.6} roughness={0.3} />
        </mesh>
        <pointLight intensity={1} distance={8} color={COLORS.me} />
      </group>

      {/* Event planets */}
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
