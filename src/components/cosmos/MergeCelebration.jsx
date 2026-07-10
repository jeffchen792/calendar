import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmosState } from "./cosmosState";

const PARTICLE_COUNT = 120;

export default function MergeCelebration({ active, progress }) {
  const particlesRef = useRef();
  const particleGeo = useMemo(() => new THREE.SphereGeometry(0.06, 4, 4), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Precompute random directions for particles
  const dirs = useMemo(() =>
    Array.from({ length: PARTICLE_COUNT }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return {
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
        speed: 1.5 + Math.random() * 3,
      };
    }), []);

  useFrame(() => {
    if (!particlesRef.current || !active) return;
    const p = Math.max(0, Math.min(1, progress));
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const d = dirs[i];
      const dist = p * d.speed * 5;
      dummy.position.set(d.x * dist, d.y * dist, d.z * dist);
      dummy.scale.setScalar(p > 0.9 ? (1 - p) * 10 : 1);
      dummy.updateMatrix();
      particlesRef.current.setMatrixAt(i, dummy.matrix);
    }
    particlesRef.current.instanceMatrix.needsUpdate = true;
    // Color: gold with fade
    if (particlesRef.current.material) {
      particlesRef.current.material.opacity = p > 0.9 ? (1 - p) * 10 : Math.min(1, p * 2);
    }
  });

  if (!active) return null;

  return (
    <instancedMesh ref={particlesRef} args={[particleGeo, null, PARTICLE_COUNT]}>
      <meshBasicMaterial color="#fbbf24" transparent opacity={0} depthWrite={false} />
    </instancedMesh>
  );
}
