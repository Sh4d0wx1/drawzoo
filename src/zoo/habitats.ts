import * as THREE from 'three';
import type { Habitat } from './types';

export const HABITATS: Habitat[] = [
  {
    name: 'Savanna',
    center: new THREE.Vector3(-28, 0, -28),
    radius: 22,
    groundColor: 0xd4a55a,
    accentColor: 0xb8860b,
  },
  {
    name: 'Jungle',
    center: new THREE.Vector3(28, 0, -28),
    radius: 22,
    groundColor: 0x3a7d44,
    accentColor: 0x2d5a27,
  },
  {
    name: 'Reptile Zone',
    center: new THREE.Vector3(28, 0, 28),
    radius: 18,
    groundColor: 0x8b7355,
    accentColor: 0x6b5a3e,
  },
  {
    name: 'Aviary',
    center: new THREE.Vector3(-28, 0, 28),
    radius: 18,
    groundColor: 0x90c080,
    accentColor: 0x5a9040,
  },
  {
    name: 'Aquatic Zone',
    center: new THREE.Vector3(0, 0, 0),
    radius: 16,
    groundColor: 0x1a6b9a,
    accentColor: 0x0d4f73,
  },
];

// ---------------------------------------------------------------------------
// Tiny deterministic "noise" — good enough for ground variation without deps
// ---------------------------------------------------------------------------
function pseudo(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix,       fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(pseudo(ix,   iz),   pseudo(ix+1, iz),   ux),
    THREE.MathUtils.lerp(pseudo(ix,   iz+1), pseudo(ix+1, iz+1), ux),
    uz,
  );
}

// ---------------------------------------------------------------------------
// Main ground + habitats
// ---------------------------------------------------------------------------
export function buildHabitats(scene: THREE.Scene): void {
  buildMainGround(scene);
  HABITATS.forEach((h, i) => {
    buildHabitatPad(scene, h);
    buildEdgeBerm(scene, h);
    buildEntranceSign(scene, h, i);
  });
}

// ---------------------------------------------------------------------------
// Main ground — subdivided so it can receive varied vertex colours / shadows
// ---------------------------------------------------------------------------
function buildMainGround(scene: THREE.Scene): void {
  const segs = 40;
  const size = 130;
  const geo  = new THREE.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI / 2);

  // Subtle height variation
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = (smoothNoise(x * 0.12, z * 0.12) - 0.5) * 0.35
            + (smoothNoise(x * 0.35, z * 0.35) - 0.5) * 0.12;
    pos.setY(i, y);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: 0x7aaa50 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Outer border — darker green beyond fence
  const borderGeo = new THREE.PlaneGeometry(200, 200);
  borderGeo.rotateX(-Math.PI / 2);
  const borderMat = new THREE.MeshLambertMaterial({ color: 0x4a7a30 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.y = -0.05;
  border.receiveShadow = true;
  scene.add(border);
}

// ---------------------------------------------------------------------------
// Habitat pad — circular, subdivided for gentle undulation
// ---------------------------------------------------------------------------
function buildHabitatPad(scene: THREE.Scene, h: Habitat): void {
  const segs = 52;
  const geo  = new THREE.CircleGeometry(h.radius, segs);
  geo.rotateX(-Math.PI / 2);

  // Very subtle vertex noise so edge isn't a perfect circle
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 1; i < pos.count; i++) {  // skip centre vertex (0)
    const x   = pos.getX(i) + h.center.x;
    const z   = pos.getZ(i) + h.center.z;
    const n   = smoothNoise(x * 0.25, z * 0.25);
    const bump = (n - 0.5) * 0.22;
    pos.setY(i, 0.02 + bump);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: h.groundColor, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(h.center.x, 0.01, h.center.z);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Inner accent ring (raised slightly)
  const ringGeo = new THREE.RingGeometry(h.radius - 2.5, h.radius, segs);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshLambertMaterial({
    color: h.accentColor, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(h.center.x, 0.04, h.center.z);
  scene.add(ring);
}

// ---------------------------------------------------------------------------
// Edge berm — a low raised ring around each habitat to break the flat look
// ---------------------------------------------------------------------------
function buildEdgeBerm(scene: THREE.Scene, h: Habitat): void {
  const segs  = 40;
  const bGeo  = new THREE.TorusGeometry(h.radius - 0.5, 0.28, 5, segs);
  const bMat  = new THREE.MeshLambertMaterial({ color: h.accentColor });
  const berm  = new THREE.Mesh(bGeo, bMat);
  berm.rotation.x = Math.PI / 2;
  berm.position.set(h.center.x, 0.22, h.center.z);
  berm.receiveShadow = true;
  berm.castShadow   = true;
  scene.add(berm);
}

// ---------------------------------------------------------------------------
// Entrance arch sign — replaces old flat sign post
// ---------------------------------------------------------------------------
function buildEntranceSign(
  scene: THREE.Scene,
  h: Habitat,
  index: number,
): void {
  // Place sign at the south face of each habitat (toward zoo centre)
  // Determine direction from habitat center to zoo center (0,0,0)
  const toCenter = new THREE.Vector2(-h.center.x, -h.center.z).normalize();
  const signDist  = h.radius - 1.8;
  const sx = h.center.x + toCenter.x * signDist;
  const sz = h.center.z + toCenter.y * signDist;
  const angle = Math.atan2(toCenter.x, toCenter.y);

  const woodMat   = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  const signMat   = new THREE.MeshLambertMaterial({ color: 0xf5deb3 });
  const accentMat = new THREE.MeshLambertMaterial({ color: h.accentColor });

  const postH = 3.2;
  const archW = 5.0;

  // Two posts
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, postH, 7),
      woodMat,
    );
    post.position.set(sx + Math.cos(angle + Math.PI / 2) * side * archW * 0.45, postH / 2, sz + Math.sin(angle + Math.PI / 2) * side * archW * 0.45);
    post.castShadow = true;
    scene.add(post);
  }

  // Crossbeam
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(archW, 0.28, 0.28),
    woodMat,
  );
  beam.position.set(sx, postH + 0.05, sz);
  beam.rotation.y = angle;
  beam.castShadow = true;
  scene.add(beam);

  // Sign board hanging below crossbeam
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(archW - 0.6, 0.85, 0.14),
    signMat,
  );
  board.position.set(sx, postH - 0.55, sz);
  board.rotation.y = angle;
  board.castShadow = true;
  scene.add(board);

  // Colour stripe on sign
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(archW - 0.6, 0.16, 0.15),
    accentMat,
  );
  stripe.position.set(sx, postH - 1.08, sz);
  stripe.rotation.y = angle;
  scene.add(stripe);

  // Small coloured flag on top of each post
  const flagColors = [0xff6633, 0x33cc66, 0xcc4400, 0x3399ff, 0xffcc00];
  for (const side of [-1, 1]) {
    const flag = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.32, 0.06),
      new THREE.MeshLambertMaterial({ color: flagColors[index] }),
    );
    flag.position.set(
      sx + Math.cos(angle + Math.PI / 2) * side * archW * 0.45,
      postH + 0.22,
      sz + Math.sin(angle + Math.PI / 2) * side * archW * 0.45,
    );
    flag.rotation.y = angle;
    scene.add(flag);
  }
}
