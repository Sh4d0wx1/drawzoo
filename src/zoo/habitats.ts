import * as THREE from 'three';
import type { Habitat } from './types';

export const HABITATS: Habitat[] = [
  {
    name: 'Savanna',
    center: new THREE.Vector3(-28, 0, -28),
    radius: 22,
    groundColor: 0xd8b878, // Warm, smooth sandy-grass tone (#d8b878)
    accentColor: 0xcbb074,
  },
  {
    name: 'Jungle',
    center: new THREE.Vector3(28, 0, -28),
    radius: 22,
    groundColor: 0x49743a, // Rich forest floor green/moss tone (#49743a)
    accentColor: 0x3d6430,
  },
  {
    name: 'Reptile Zone',
    center: new THREE.Vector3(28, 0, 28),
    radius: 18,
    groundColor: 0x9b7653, // Warm earthy clay/dry loam (#9b7653)
    accentColor: 0x866342,
  },
  {
    name: 'Aviary',
    center: new THREE.Vector3(-28, 0, 28),
    radius: 18,
    groundColor: 0x7ba652, // Soft natural pasture green (#7ba652)
    accentColor: 0x699042,
  },
  {
    name: 'Aquatic Zone',
    center: new THREE.Vector3(0, 0, 0),
    radius: 16,
    groundColor: 0x0f3b56,
    accentColor: 0x0d324d,
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
    if (h.name === 'Aquatic Zone') {
      buildAquaticBasin(scene, h);
    } else {
      buildHabitatPad(scene, h);
      buildEdgeBerm(scene, h);
      buildEntranceSign(scene, h, i);
    }
  });
}

// ---------------------------------------------------------------------------
// Aquatic Basin — sunken cylinder tank with dark blue walls and floor disc
// ---------------------------------------------------------------------------
function buildAquaticBasin(scene: THREE.Scene, h: Habitat): void {
  const segs = 64;
  const radius = 15.5;
  const depth = 2.4;

  // 1. Sunken Basin Cylinder Wall (open top & bottom, pushed downwards Y < 0)
  const wallGeo = new THREE.CylinderGeometry(radius, radius, depth, segs, 1, true);
  const wallMat = new THREE.MeshLambertMaterial({
    color: 0x0d324d, // Dark blue interior walls (#0d324d)
    side: THREE.BackSide,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.position.set(h.center.x, -depth / 2, h.center.z);
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);

  // 2. Circular floor disc at bottom (Y = -depth) colored dark navy/teal
  const floorGeo = new THREE.CircleGeometry(radius, segs);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshLambertMaterial({
    color: 0x081f33, // Dark navy/teal bottom floor
    side: THREE.FrontSide,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(h.center.x, -depth, h.center.z);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // 3. Black / Dark boundary ring around the pool rim
  const rimGeo = new THREE.TorusGeometry(radius, 0.35, 12, segs);
  const rimMat = new THREE.MeshLambertMaterial({
    color: 0x061420, // Black / dark boundary ring
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.set(h.center.x, 0.05, h.center.z);
  rimMesh.receiveShadow = true;
  rimMesh.castShadow = true;
  scene.add(rimMesh);
}

// ---------------------------------------------------------------------------
// Main ground — true hole cutout at center (0,0) so terrain never clips through the pond
// ---------------------------------------------------------------------------
function buildMainGround(scene: THREE.Scene): void {
  const size = 130;
  const half = size / 2;
  const poolR = 15.5;

  const groundShape = new THREE.Shape();
  groundShape.moveTo(-half, -half);
  groundShape.lineTo(half, -half);
  groundShape.lineTo(half, half);
  groundShape.lineTo(-half, half);
  groundShape.closePath();

  // Cut true circular hole at center
  const holePath = new THREE.Path();
  holePath.absarc(0, 0, poolR, 0, Math.PI * 2, true);
  groundShape.holes.push(holePath);

  const geo = new THREE.ShapeGeometry(groundShape, 48);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshLambertMaterial({ color: 0x7aaa50 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Outer border with matching hole
  const borderSize = 200;
  const bHalf = borderSize / 2;
  const borderShape = new THREE.Shape();
  borderShape.moveTo(-bHalf, -bHalf);
  borderShape.lineTo(bHalf, -bHalf);
  borderShape.lineTo(bHalf, bHalf);
  borderShape.lineTo(-bHalf, bHalf);
  borderShape.closePath();

  const borderHole = new THREE.Path();
  borderHole.absarc(0, 0, poolR, 0, Math.PI * 2, true);
  borderShape.holes.push(borderHole);

  const borderGeo = new THREE.ShapeGeometry(borderShape, 48);
  borderGeo.rotateX(-Math.PI / 2);
  const borderMat = new THREE.MeshLambertMaterial({ color: 0x4a7a30 });
  const border = new THREE.Mesh(borderGeo, borderMat);
  border.position.y = -0.05;
  border.receiveShadow = true;
  scene.add(border);
}

// ---------------------------------------------------------------------------
// Habitat pad — clean, unified circular biome floor with subtle organic boundary
// ---------------------------------------------------------------------------
function buildHabitatPad(scene: THREE.Scene, h: Habitat): void {
  const segs = 56;
  const geo  = new THREE.CircleGeometry(h.radius, segs);
  geo.rotateX(-Math.PI / 2);

  // Very subtle vertex noise for soft natural edge
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 1; i < pos.count; i++) {
    const x   = pos.getX(i) + h.center.x;
    const z   = pos.getZ(i) + h.center.z;
    const n   = smoothNoise(x * 0.25, z * 0.25);
    const bump = (n - 0.5) * 0.18;
    pos.setY(i, 0.02 + bump);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: h.groundColor, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(h.center.x, 0.01, h.center.z);
  mesh.receiveShadow = true;
  scene.add(mesh);
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
