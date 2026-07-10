import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { cosmosState } from "./cosmosState";

const FLIGHT_DURATION = 2;
const MAX_SPARKS = 5;

function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return new THREE.Vector3(
    u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
    u*u*u*p0.z + 3*u*u*t*p1.z + 3*u*t*t*p2.z + t*t*t*p3.z,
  );
}

export default function NoteSparks() {
  const sparksRef = useRef([]);
  const activeSparks = useRef([]);
  const sparkGeo = useMemo(() => new THREE.SphereGeometry(0.1, 8, 8), []);

  useFrame((state, delta) => {
    // Drain sparkQueue — use shared positions from cosmosState
    const fromPos = cosmosState.starA;
    const toPos = cosmosState.starB;

    while (cosmosState.sparkQueue.length > 0 && activeSparks.current.length < MAX_SPARKS) {
      const q = cosmosState.sparkQueue.shift();
      const start = q.fromMe ? fromPos.clone() : toPos.clone();
      const end = q.fromMe ? toPos.clone() : fromPos.clone();
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += 2.5;
      activeSparks.current.push({ id: q.id, t: 0, fromMe: q.fromMe });
    }

    // Animate
    for (let i = activeSparks.current.length - 1; i >= 0; i--) {
      const s = activeSparks.current[i];
      s.t += delta / FLIGHT_DURATION;
      if (s.t >= 1) { activeSparks.current.splice(i, 1); continue; }
    }

    // Update meshes
    sparksRef.current.forEach((mesh, i) => {
      if (!mesh || i >= activeSparks.current.length) { mesh && (mesh.visible = false); return; }
      const s = activeSparks.current[i];
      const start = s.fromMe ? fromPos : toPos;
      const end = s.fromMe ? toPos : fromPos;
      const mid = start.clone().add(end).multiplyScalar(0.5);
      mid.y += 2.5;
      const pt = bezierPoint(s.t, start,
        start.clone().add(mid).multiplyScalar(0.5),
        end.clone().add(mid).multiplyScalar(0.5), end);
      mesh.position.copy(pt);
      mesh.visible = true;
    });
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
