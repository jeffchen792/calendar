import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmosState } from "./cosmosState";

const ORBIT_R = 3.2;
const OMEGA = 0.15;
const FLIGHT_DURATION = 2;
const MAX_SPARKS = 5;

// Cubic bezier midpoint for control point
function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return new THREE.Vector3(
    u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
    u*u*u*p0.z + 3*u*u*t*p1.z + 3*u*t*t*p2.z + t*t*t*p3.z,
  );
}

export default function NoteSparks({ onStarClick }) {
  const sparksRef = useRef([]);
  const activeSparks = useRef([]); // { id, t, fromMe, start, end, ctrlStart, ctrlEnd }

  const sparkGeo = useMemo(() => new THREE.SphereGeometry(0.1, 8, 8), []);
  const starA = useMemo(() => new THREE.Vector3(), []);
  const starB = useMemo(() => new THREE.Vector3(), []);
  const ctrl = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Current star positions
    starA.set(Math.cos(t * OMEGA) * ORBIT_R, 0, Math.sin(t * OMEGA) * ORBIT_R);
    starB.set(Math.cos(t * OMEGA + Math.PI) * ORBIT_R, 0, Math.sin(t * OMEGA + Math.PI) * ORBIT_R);

    // Drain sparkQueue
    while (cosmosState.sparkQueue.length > 0 && activeSparks.current.length < MAX_SPARKS) {
      const q = cosmosState.sparkQueue.shift();
      const from = q.fromMe ? starA.clone() : starB.clone();
      const to = q.fromMe ? starB.clone() : starA.clone();
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.y += 2.5;
      activeSparks.current.push({
        id: q.id,
        t: 0,
        fromMe: q.fromMe,
        start: from.clone(),
        end: to.clone(),
        ctrl1: from.clone().add(mid).multiplyScalar(0.5),
        ctrl2: to.clone().add(mid).multiplyScalar(0.5),
      });
    }

    // Animate active sparks
    for (let i = activeSparks.current.length - 1; i >= 0; i--) {
      const s = activeSparks.current[i];
      s.t += delta / FLIGHT_DURATION;
      if (s.t >= 1) {
        activeSparks.current.splice(i, 1);
        continue;
      }
      // Update bezier with current positions
      const from = s.fromMe ? starA : starB;
      const to = s.fromMe ? starB : starA;
      const mid = from.clone().add(to).multiplyScalar(0.5);
      mid.y += 2.5;
      s.ctrl1 = from.clone().add(mid).multiplyScalar(0.5);
      s.ctrl2 = to.clone().add(mid).multiplyScalar(0.5);
    }

    // Update mesh positions
    sparksRef.current.forEach((mesh, i) => {
      if (!mesh || i >= activeSparks.current.length) return;
      const s = activeSparks.current[i];
      const pt = bezierPoint(s.t, s.fromMe ? starA : starB, s.ctrl1, s.ctrl2, s.fromMe ? starB : starA);
      mesh.position.copy(pt);
      mesh.visible = true;
    });
    // Hide unused meshes
    for (let i = activeSparks.current.length; i < MAX_SPARKS; i++) {
      if (sparksRef.current[i]) sparksRef.current[i].visible = false;
    }
  });

  return (
    <>
      {Array.from({ length: MAX_SPARKS }, (_, i) => (
        <mesh key={i} ref={(el) => { sparksRef.current[i] = el; }} visible={false} geometry={sparkGeo}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          <pointLight intensity={0.6} distance={3} color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}
