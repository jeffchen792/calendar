// Mutable animation state — read by useFrame, never setState here.
import * as THREE from "three";

export const cosmosState = {
  mergeProgress: 0,
  sparkQueue: [],
  // Shared star positions — written by BinaryStars, read by NoteSparks
  starA: new THREE.Vector3(),
  starB: new THREE.Vector3(),
};
