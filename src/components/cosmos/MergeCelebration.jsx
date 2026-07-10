import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmosState } from "./cosmosState";

const PARTICLE_COUNT = 120;

export default function MergeCelebration({ active }) {
  const particlesRef = useRef();
  const particleGeo = useMemo(() => new THREE.SphereGeometry(0.08, 4, 4), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const dirs = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return { x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi), speed: 2 + Math.random() * 3 };
    }), []);

  useFrame(() => {
    if (!particlesRef.current || !active) return;
    // Burst only after 2s (progress > 0.66), fade after 2.8s
    const raw = cosmosState.mergeProgress;
    const burst = Math.max(0, Math.min(1, (raw - 0.66) / 0.28)); // 0 at 2s, 1 at 2.84s
    const fade = raw > 0.93 ? 1 - (raw - 0.93) / 0.07 : 1;
    const p = burst * fade;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const d = dirs[i];
      const dist = p * d.speed * 4;
      dummy.position.set(d.x * dist, d.y * dist, d.z * dist);
      dummy.scale.setScalar(p);
      dummy.updateMatrix();
      particlesRef.current.setMatrixAt(i, dummy.matrix);
    }
    particlesRef.current.instanceMatrix.needsUpdate = true;
    particlesRef.current.material.opacity = p * 0.9;
  });

  if (!active) return null;

  return (
    <instancedMesh ref={particlesRef} args={[particleGeo, null, PARTICLE_COUNT]}>
      <meshBasicMaterial color="#fbbf24" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}
