import * as THREE from 'three';
import type { AnimalData } from './types';
import { HABITATS } from './habitats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}
function matE(color: number, emissive: number, intensity = 0.4): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity });
}
function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}
function sphere(r: number, ws = 10, hs = 8): THREE.SphereGeometry {
  return new THREE.SphereGeometry(r, ws, hs);
}
function cyl(rt: number, rb: number, h: number, seg = 8): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rt, rb, h, seg);
}
function mkMesh(geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  return o;
}
function addTo(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  m: THREE.Material,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const o = mkMesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}

/**
 * Every animal group has this structure:
 *
 *   group  (position/rotation controlled by wander — Y rotation = heading)
 *   └─ modelPivot  (rotated -π/2 on Y so the model's +X nose points toward world +Z)
 *      └─ ... all body meshes, leg pivots, etc.
 *
 * The wander code sets group.rotation.y = atan2(dx, dz) which gives the
 * angle for +Z forward.  The modelPivot corrects for models built facing +X.
 */
function makeGroupWithPivot(): { group: THREE.Group; pivot: THREE.Group } {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.rotation.y = -Math.PI / 2; // model +X → world +Z
  group.add(pivot);
  return { group, pivot };
}

// ---------------------------------------------------------------------------
// Leg builder
// Upper pivot at hip/shoulder, lower pivot at knee.
// Both hang downward (-Y).  Caller stores pivot & lowerPivot in `parts`.
// ---------------------------------------------------------------------------
function buildLeg(
  parent: THREE.Group,
  upperLen: number, upperR: number,
  lowerLen: number, lowerR: number,
  footR: number,
  legMat: THREE.Material,
  x: number, y: number, z: number,
): { pivot: THREE.Group; lowerPivot: THREE.Group } {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);

  const upper = mkMesh(cyl(upperR * 0.85, upperR, upperLen), legMat);
  upper.position.y = -upperLen / 2;
  pivot.add(upper);

  const lowerPivot = new THREE.Group();
  lowerPivot.position.y = -upperLen;
  pivot.add(lowerPivot);

  const lower = mkMesh(cyl(lowerR * 0.8, lowerR, lowerLen), legMat);
  lower.position.y = -lowerLen / 2;
  lowerPivot.add(lower);

  const foot = mkMesh(sphere(footR, 6, 5), legMat);
  foot.position.y = -lowerLen - footR * 0.5;
  foot.scale.z = 1.4;
  lowerPivot.add(foot);

  return { pivot, lowerPivot };
}

/** Uniform random point inside a habitat circle. */
function randomInCircle(cx: number, cz: number, radius: number, margin = 3.5): THREE.Vector3 {
  const r = Math.sqrt(Math.random()) * (radius - margin);
  const a = Math.random() * Math.PI * 2;
  return new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
}

// ---------------------------------------------------------------------------
// Monkey tree-top waypoints (fixed positions matching jungle tree placement)
// The jungle habitat is HABITATS[1]: center (28, 0, -28), radius 22.
// Trees are placed at angle = (k/count)*2π + 0.7  with dist = radius*(0.55..0.85).
// We pre-compute 8 perch positions at height 3.5 (top of jungle trees).
// ---------------------------------------------------------------------------
export function buildMonkeyPerches(): THREE.Vector3[] {
  const h = HABITATS[1];
  const perches: THREE.Vector3[] = [];
  const count = 8;
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + 0.7;
    const dist = h.radius * (0.58 + (k % 3) * 0.1);
    perches.push(new THREE.Vector3(
      h.center.x + Math.cos(angle) * dist,
      3.5,
      h.center.z + Math.sin(angle) * dist,
    ));
  }
  return perches;
}

// ---------------------------------------------------------------------------
// LION
// ---------------------------------------------------------------------------
function buildLion(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const bodyM = mat(0xc8922a);
  const maneM = mat(0x7a3810);
  const darkM = mat(0xa06818);
  const eyeM  = matE(0x1a1a00, 0xffee44, 0.6);
  const noseM = mat(0x2a1a1a);

  // Torso
  const torso = mkMesh(new THREE.SphereGeometry(0.55, 10, 8), bodyM);
  torso.scale.set(1.5, 0.85, 0.95);
  torso.position.set(0, 0.72, 0);
  pivot.add(torso);

  // Haunch
  const haunch = mkMesh(new THREE.SphereGeometry(0.44, 8, 7), bodyM);
  haunch.scale.set(0.9, 0.82, 1.0);
  haunch.position.set(-0.65, 0.70, 0);
  pivot.add(haunch);

  // Neck
  const neck = mkMesh(cyl(0.22, 0.28, 0.45, 8), bodyM);
  neck.rotation.z = -0.35;
  neck.position.set(0.55, 0.98, 0);
  pivot.add(neck);

  // Head
  const headG = new THREE.Group();
  headG.position.set(0.95, 1.18, 0);
  parts['head'] = headG;
  pivot.add(headG);
  headG.add(mkMesh(sphere(0.38, 10, 8), bodyM));            // skull
  const mane = mkMesh(sphere(0.50, 10, 8), maneM);
  mane.scale.set(1.0, 0.92, 0.85);
  headG.add(mane);
  const muzzle = mkMesh(new THREE.SphereGeometry(0.22, 8, 7), darkM);
  muzzle.scale.set(1.2, 0.7, 1.1);
  muzzle.position.set(0.32, -0.06, 0);
  headG.add(muzzle);
  addTo(headG, sphere(0.07, 6, 5), noseM,  0.48, 0.0, 0);
  addTo(headG, sphere(0.065, 6, 5), eyeM,  0.24, 0.16,  0.28);
  addTo(headG, sphere(0.065, 6, 5), eyeM,  0.24, 0.16, -0.28);
  const earL = mkMesh(sphere(0.12, 6, 5), bodyM);
  earL.position.set(-0.12, 0.38, 0.30); headG.add(earL);
  const earR = earL.clone();
  earR.position.set(-0.12, 0.38, -0.30); headG.add(earR);

  // Tail
  const tailG = new THREE.Group();
  tailG.position.set(-0.92, 0.82, 0);
  parts['tail'] = tailG;
  pivot.add(tailG);
  addTo(tailG, cyl(0.04, 0.07, 0.55, 6), bodyM, 0, -0.27, 0, 0, 0, 0.2);
  addTo(tailG, sphere(0.10, 6, 5), maneM, -0.10, -0.60, 0);

  // Legs — pivot sits at hip height
  const legDefs: [number, number, string][] = [
    [ 0.42,  0.30, 'FL'],
    [ 0.42, -0.30, 'FR'],
    [-0.38,  0.30, 'BL'],
    [-0.38, -0.30, 'BR'],
  ];
  legDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.35, 0.10, 0.30, 0.08, 0.07, bodyM, lx, 0.72, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  const habitat = HABITATS[0];
  return {
    id: 'lion', name: 'Lion', habitat: 'Savanna', position: pos,
    color: 0xc8922a, accentColor: 0x7a3810, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 2.4,
  };
}

// ---------------------------------------------------------------------------
// ELEPHANT
// ---------------------------------------------------------------------------
function buildElephant(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const eM    = mat(0x787878);
  const eM2   = mat(0x888888);
  const tuskM = mat(0xf5f0dc);
  const eyeM  = matE(0x111111, 0x553300, 0.3);

  // Torso
  const torso = mkMesh(new THREE.SphereGeometry(0.90, 12, 10), eM);
  torso.scale.set(1.55, 1.05, 1.1);
  torso.position.set(0, 1.05, 0);
  pivot.add(torso);

  const rear = mkMesh(new THREE.SphereGeometry(0.75, 10, 8), eM);
  rear.position.set(-0.95, 1.0, 0);
  pivot.add(rear);

  addTo(pivot, cyl(0.30, 0.38, 0.55, 8), eM, 0.75, 1.22, 0, 0, 0, -0.2);

  // Head
  const headG = new THREE.Group();
  headG.position.set(1.35, 1.55, 0);
  parts['head'] = headG;
  pivot.add(headG);

  headG.add(mkMesh(sphere(0.60, 10, 9), eM));
  const brow = mkMesh(new THREE.SphereGeometry(0.45, 8, 7), eM2);
  brow.position.set(0.35, 0.22, 0);
  brow.scale.set(0.8, 0.6, 0.9);
  headG.add(brow);

  // Trunk — 5 segments
  for (let i = 0; i < 5; i++) {
    const r = 0.13 - i * 0.018;
    const seg = mkMesh(cyl(r * 0.85, r, 0.28, 7), eM);
    seg.position.set(0.18 + i * 0.05, -0.45 - i * 0.28, 0.38 + i * 0.04);
    seg.rotation.z = 0.15 + i * 0.1;
    headG.add(seg);
  }

  // Ears
  const earGeo = new THREE.SphereGeometry(0.55, 8, 7);
  const earL = mkMesh(earGeo, eM);
  earL.scale.set(0.15, 0.95, 1.1);
  earL.position.set(-0.15, 0, 0.68);
  headG.add(earL);
  const earR = earL.clone();
  earR.position.set(-0.15, 0, -0.68);
  headG.add(earR);

  addTo(headG, sphere(0.075, 6, 5), eyeM, 0.45, 0.20,  0.40);
  addTo(headG, sphere(0.075, 6, 5), eyeM, 0.45, 0.20, -0.40);

  // Tusks
  const tusk = mkMesh(cyl(0.035, 0.055, 0.70, 6), tuskM);
  tusk.position.set(0.45, -0.32, 0.25);
  tusk.rotation.set(0.1, 0.18, 0.3);
  headG.add(tusk);
  const tusk2 = tusk.clone();
  tusk2.position.set(0.45, -0.32, -0.25);
  tusk2.rotation.set(0.1, -0.18, 0.3);
  headG.add(tusk2);

  addTo(pivot, cyl(0.03, 0.06, 0.55, 6), eM, -1.62, 1.20, 0, 0, 0, 0.5);

  // Thick legs
  const legDefs: [number, number, string][] = [
    [ 0.65,  0.45, 'FL'],
    [ 0.65, -0.45, 'FR'],
    [-0.62,  0.45, 'BL'],
    [-0.62, -0.45, 'BR'],
  ];
  legDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.50, 0.18, 0.42, 0.15, 0.13, eM, lx, 1.05, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  const habitat = HABITATS[0];
  return {
    id: 'elephant', name: 'Elephant', habitat: 'Savanna', position: pos,
    color: 0x787878, accentColor: 0x555555, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 3.6,
  };
}

// ---------------------------------------------------------------------------
// GIRAFFE
// ---------------------------------------------------------------------------
function buildGiraffe(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const gM    = mat(0xf0a020);
  const spotM = mat(0x7a3400);
  const eyeM  = matE(0x111111, 0x332200, 0.3);

  // Torso
  const torso = mkMesh(new THREE.SphereGeometry(0.52, 10, 8), gM);
  torso.scale.set(1.6, 0.90, 0.88);
  torso.position.set(0, 1.08, 0);
  pivot.add(torso);

  const rump = mkMesh(new THREE.SphereGeometry(0.46, 8, 7), gM);
  rump.position.set(-0.70, 1.04, 0);
  pivot.add(rump);

  // Neck
  const neckG = new THREE.Group();
  neckG.position.set(0.60, 1.22, 0);
  neckG.rotation.z = -0.28;
  parts['neck'] = neckG;
  pivot.add(neckG);
  addTo(neckG, cyl(0.14, 0.20, 1.0, 7), gM, 0, 0.50, 0);
  addTo(neckG, cyl(0.12, 0.15, 0.9, 7), gM, 0, 1.40, 0);
  addTo(neckG, cyl(0.10, 0.13, 0.7, 7), gM, 0, 2.15, 0);
  for (let i = 0; i < 4; i++) {
    const sp = mkMesh(box(0.15, 0.22, 0.24), spotM);
    sp.position.set(0.10, 0.4 + i * 0.5, (i % 2 === 0 ? 0.12 : -0.12));
    neckG.add(sp);
  }

  // Head (child of neck)
  const headG = new THREE.Group();
  headG.position.set(0, 2.65, 0);
  parts['head'] = headG;
  neckG.add(headG);
  addTo(headG, box(0.60, 0.32, 0.30), gM, 0.12, 0, 0);
  addTo(headG, box(0.22, 0.20, 0.28), gM, 0.40, -0.05, 0);
  addTo(headG, sphere(0.065, 6, 5), eyeM, 0.10, 0.10,  0.18);
  addTo(headG, sphere(0.065, 6, 5), eyeM, 0.10, 0.10, -0.18);
  addTo(headG, cyl(0.025, 0.04, 0.28, 5), mat(0x553300), 0.05, 0.30,  0.12);
  addTo(headG, cyl(0.025, 0.04, 0.28, 5), mat(0x553300), 0.05, 0.30, -0.12);
  addTo(headG, sphere(0.10, 6, 5), gM, -0.10, 0.16,  0.22);
  addTo(headG, sphere(0.10, 6, 5), gM, -0.10, 0.16, -0.22);

  // Body spots
  const spotsData: [number, number, number][] = [
    [0.30, 1.22, 0.30], [-0.20, 1.22, -0.20],
    [0.0, 1.10, -0.32], [-0.40, 1.20, 0.25], [0.22, 0.95, 0.0],
  ];
  spotsData.forEach(([x, y, z]) => {
    const sp = mkMesh(new THREE.SphereGeometry(0.18, 6, 5), spotM);
    sp.scale.set(1.5, 1.4, 1.4);
    sp.position.set(x, y, z);
    pivot.add(sp);
  });

  addTo(pivot, cyl(0.03, 0.05, 0.50, 6), gM, -1.05, 1.22, 0, 0, 0, 0.4);
  addTo(pivot, sphere(0.08, 6, 5), spotM, -1.28, 0.97, 0);

  const legDefs: [number, number, string][] = [
    [ 0.50,  0.28, 'FL'],
    [ 0.50, -0.28, 'FR'],
    [-0.50,  0.28, 'BL'],
    [-0.50, -0.28, 'BR'],
  ];
  legDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.62, 0.085, 0.55, 0.07, 0.07, gM, lx, 1.08, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  const habitat = HABITATS[0];
  return {
    id: 'giraffe', name: 'Giraffe', habitat: 'Savanna', position: pos,
    color: 0xf0a020, accentColor: 0x7a3400, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 6.0,
  };
}

// ---------------------------------------------------------------------------
// ZEBRA — noticeably slimmer (Z scale 0.62 vs old 0.90)
// ---------------------------------------------------------------------------
function buildZebra(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const wM  = mat(0xeeeeee);
  const bM  = mat(0x111111);
  const eyeM = matE(0x111111, 0x221100, 0.3);

  // Slim torso
  const torso = mkMesh(new THREE.SphereGeometry(0.50, 10, 8), wM);
  torso.scale.set(1.55, 0.82, 0.62);   // <-- narrow Z
  torso.position.set(0, 0.68, 0);
  pivot.add(torso);

  const rump = mkMesh(new THREE.SphereGeometry(0.42, 8, 7), wM);
  rump.scale.set(0.95, 0.80, 0.62);
  rump.position.set(-0.60, 0.66, 0);
  pivot.add(rump);

  // Stripes
  const stripeXZ: [number, number][] = [[-0.52, 0.10], [-0.24, 0.10], [0.04, 0.10], [0.28, 0.09], [0.50, 0.07]];
  stripeXZ.forEach(([sx, sw]) => {
    const s = mkMesh(new THREE.SphereGeometry(0.50, 6, 5), bM);
    s.scale.set(sw / 0.5, 0.84, 0.64);
    s.position.set(sx, 0.68, 0);
    pivot.add(s);
  });

  // Neck
  addTo(pivot, cyl(0.14, 0.19, 0.48, 7), wM, 0.50, 0.88, 0, 0, 0, -0.25);

  // Head
  const headG = new THREE.Group();
  headG.position.set(0.88, 1.04, 0);
  parts['head'] = headG;
  pivot.add(headG);
  addTo(headG, box(0.52, 0.32, 0.24), wM, 0.06, 0, 0);
  addTo(headG, box(0.24, 0.26, 0.22), wM, 0.36, -0.04, 0);
  addTo(headG, box(0.25, 0.06, 0.23), bM, 0.36,  0.06, 0);
  addTo(headG, box(0.25, 0.06, 0.23), bM, 0.36, -0.08, 0);
  addTo(headG, sphere(0.065, 6, 5), eyeM, 0.10, 0.10,  0.14);
  addTo(headG, sphere(0.065, 6, 5), eyeM, 0.10, 0.10, -0.14);
  for (let i = 0; i < 5; i++) {
    addTo(headG, box(0.06, 0.24, 0.05), bM, -0.10 - i * 0.05, 0.26, 0);
  }
  addTo(headG, cyl(0.035, 0.065, 0.20, 6), wM, 0.0, 0.28,  0.14);
  addTo(headG, cyl(0.035, 0.065, 0.20, 6), wM, 0.0, 0.28, -0.14);

  // Tail
  addTo(pivot, cyl(0.025, 0.055, 0.46, 6), wM, -0.86, 0.84, 0, 0, 0, 0.45);
  addTo(pivot, sphere(0.07, 6, 5), bM, -1.04, 0.62, 0);

  // Slimmer legs
  const legDefs: [number, number, string][] = [
    [ 0.38,  0.20, 'FL'],
    [ 0.38, -0.20, 'FR'],
    [-0.36,  0.20, 'BL'],
    [-0.36, -0.20, 'BR'],
  ];
  legDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.30, 0.075, 0.26, 0.062, 0.055, wM, lx, 0.68, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  const habitat = HABITATS[0];
  return {
    id: 'zebra', name: 'Zebra', habitat: 'Savanna', position: pos,
    color: 0xeeeeee, accentColor: 0x111111, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 2.0,
  };
}

// ---------------------------------------------------------------------------
// MONKEY — animationType 'jump', tree-top waypoints injected after build
// ---------------------------------------------------------------------------
function buildMonkey(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const mM    = mat(0x7a5810);
  const faceM = mat(0xffccaa);
  const eyeM  = matE(0x111111, 0x331100, 0.3);

  // Torso
  const torso = mkMesh(sphere(0.30), mM);
  torso.scale.set(0.95, 1.1, 0.85);
  torso.position.set(0, 0.50, 0);
  pivot.add(torso);

  const belly = mkMesh(sphere(0.22), faceM);
  belly.scale.set(0.8, 0.85, 0.5);
  belly.position.set(0.05, 0.50, 0.18);
  pivot.add(belly);

  addTo(pivot, cyl(0.10, 0.14, 0.22, 6), mM, 0, 0.85, 0);

  // Head
  const headG = new THREE.Group();
  headG.position.set(0, 1.12, 0);
  parts['head'] = headG;
  pivot.add(headG);
  headG.add(mkMesh(sphere(0.28), mM));
  const face = mkMesh(new THREE.SphereGeometry(0.22, 8, 7), faceM);
  face.scale.set(0.65, 0.80, 0.55);
  face.position.set(0.16, -0.04, 0);
  headG.add(face);
  const muzzle = mkMesh(new THREE.SphereGeometry(0.13, 7, 6), faceM);
  muzzle.scale.set(1.4, 0.6, 0.9);
  muzzle.position.set(0.30, -0.10, 0);
  headG.add(muzzle);
  addTo(headG, sphere(0.055, 6, 5), eyeM,  0.22, 0.06,  0.12);
  addTo(headG, sphere(0.055, 6, 5), eyeM,  0.22, 0.06, -0.12);
  addTo(headG, sphere(0.10, 7, 6), mM,    -0.04, 0,  0.30);
  addTo(headG, sphere(0.10, 7, 6), mM,    -0.04, 0, -0.30);
  addTo(headG, sphere(0.065, 6, 5), faceM, -0.04, 0,  0.31);
  addTo(headG, sphere(0.065, 6, 5), faceM, -0.04, 0, -0.31);

  // Arms (pivot at shoulder)
  const lArmG = new THREE.Group();
  lArmG.position.set(0, 0.72,  0.34);
  parts['lArm'] = lArmG;
  pivot.add(lArmG);
  addTo(lArmG, cyl(0.055, 0.075, 0.32, 6), mM, 0, -0.16, 0);
  addTo(lArmG, cyl(0.045, 0.060, 0.28, 6), mM, 0, -0.44, 0);
  addTo(lArmG, sphere(0.07, 6, 5), mM, 0, -0.62, 0);

  const rArmG = new THREE.Group();
  rArmG.position.set(0, 0.72, -0.34);
  parts['rArm'] = rArmG;
  pivot.add(rArmG);
  addTo(rArmG, cyl(0.055, 0.075, 0.32, 6), mM, 0, -0.16, 0);
  addTo(rArmG, cyl(0.045, 0.060, 0.28, 6), mM, 0, -0.44, 0);
  addTo(rArmG, sphere(0.07, 6, 5), mM, 0, -0.62, 0);

  // Legs (only back legs for monkey)
  const legDefs: [number, number, string][] = [
    [-0.10,  0.18, 'BL'],
    [-0.10, -0.18, 'BR'],
  ];
  legDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.28, 0.065, 0.25, 0.055, 0.055, mM, lx, 0.50, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  // Curled tail
  const tailG = new THREE.Group();
  tailG.position.set(-0.22, 0.62, 0);
  parts['tail'] = tailG;
  pivot.add(tailG);
  addTo(tailG, cyl(0.035, 0.055, 0.30, 6), mM, -0.08, -0.15, 0, 0, 0,  0.5);
  addTo(tailG, cyl(0.025, 0.038, 0.28, 6), mM, -0.22, -0.36, 0, 0, 0, -0.3);
  addTo(tailG, cyl(0.020, 0.028, 0.22, 6), mM, -0.28, -0.55, 0, 0, 0,  0.6);

  const habitat = HABITATS[1];
  return {
    id: 'monkey', name: 'Monkey', habitat: 'Jungle', position: pos,
    color: 0x7a5810, accentColor: 0xffccaa, animationType: 'jump',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    // First waypoint is ground level; perches are set in buildAnimals below
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 2.2,
    jumpArcY: 0,
  };
}

// ---------------------------------------------------------------------------
// SNAKE
// ---------------------------------------------------------------------------
function buildSnake(pos: THREE.Vector3): AnimalData {
  // Snake has its own body-axis logic; still wrap for consistency
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const bodyM   = mat(0x2e7a2e);
  const scaleM  = mat(0x1a4f1a);
  const eyeM    = matE(0xdddd00, 0xffff00, 0.8);
  const tongueM = mat(0xdd2222);

  const ctrlPts: THREE.Vector3[] = [];
  const coilR = 0.65;
  const segs = 14;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const angle = t * Math.PI * 2.2;
    const r = coilR * (1 - t * 0.45);
    ctrlPts.push(new THREE.Vector3(
      Math.cos(angle) * r,
      0.10 - t * 0.04,
      Math.sin(angle) * r,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(ctrlPts);
  const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.09, 10, false);
  const body = mkMesh(tubeGeo, bodyM);
  parts['body'] = body;
  pivot.add(body);

  const stripeCurve = new THREE.CatmullRomCurve3(ctrlPts.map(p => new THREE.Vector3(p.x, p.y + 0.01, p.z)));
  const stripeGeo = new THREE.TubeGeometry(stripeCurve, 80, 0.05, 8, false);
  addTo(pivot, stripeGeo, scaleM, 0, 0, 0);

  const headPos = ctrlPts[0];
  const headG = new THREE.Group();
  headG.position.copy(headPos);
  parts['head'] = headG;
  pivot.add(headG);
  const skull = mkMesh(new THREE.SphereGeometry(0.14, 9, 8), bodyM);
  skull.scale.set(1.3, 0.7, 1.1);
  headG.add(skull);
  addTo(headG, sphere(0.04, 6, 5), eyeM,  0.08, 0.06,  0.11);
  addTo(headG, sphere(0.04, 6, 5), eyeM,  0.08, 0.06, -0.11);

  const tongueG = new THREE.Group();
  tongueG.position.set(0.16, -0.02, 0);
  parts['tongue'] = tongueG;
  headG.add(tongueG);
  addTo(tongueG, cyl(0.008, 0.012, 0.12, 4), tongueM, 0, 0, 0);
  addTo(tongueG, cyl(0.005, 0.008, 0.08, 4), tongueM,  0.02, -0.09,  0.025, 0.3, 0,  0.2);
  addTo(tongueG, cyl(0.005, 0.008, 0.08, 4), tongueM,  0.02, -0.09, -0.025, 0.3, 0, -0.2);

  (group as THREE.Group & { _snakeCurvePoints: THREE.Vector3[] })._snakeCurvePoints = ctrlPts;
  (group as THREE.Group & { _snakeCurve: THREE.CatmullRomCurve3 })._snakeCurve = curve;
  (group as THREE.Group & { _snakeTube: THREE.Mesh })._snakeTube = body;

  const habitat = HABITATS[2];
  return {
    id: 'snake', name: 'Snake', habitat: 'Reptile Zone', position: pos,
    color: 0x2e7a2e, accentColor: 0x1a4f1a, animationType: 'slither',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 1.2,
  };
}

// ---------------------------------------------------------------------------
// BIRD
// ---------------------------------------------------------------------------
function buildBird(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const bM    = mat(0xe85520);
  const wingM = mat(0xff7733);
  const tipM  = mat(0xff4400);
  const beakM = mat(0xeecc00);
  const eyeM  = matE(0x111111, 0x333300, 0.3);
  const footM = mat(0xddaa00);

  // Body
  const body = mkMesh(new THREE.SphereGeometry(0.26, 9, 8), bM);
  body.scale.set(1.0, 0.88, 0.85);
  body.position.set(0, 0.32, 0);
  pivot.add(body);

  addTo(pivot, cyl(0.10, 0.13, 0.22, 7), bM, 0, 0.64, 0);

  // Head
  const headG = new THREE.Group();
  headG.position.set(0, 0.82, 0);
  parts['head'] = headG;
  pivot.add(headG);
  headG.add(mkMesh(sphere(0.20, 9, 8), bM));
  const upperBeak = mkMesh(new THREE.ConeGeometry(0.055, 0.22, 5), beakM);
  upperBeak.rotation.z = -Math.PI / 2;
  upperBeak.position.set(0.20, 0.02, 0);
  headG.add(upperBeak);
  const lowerBeak = mkMesh(new THREE.ConeGeometry(0.04, 0.16, 5), beakM);
  lowerBeak.rotation.z = Math.PI / 2;
  lowerBeak.position.set(0.18, -0.04, 0);
  headG.add(lowerBeak);
  for (let i = 0; i < 3; i++) {
    const feather = mkMesh(new THREE.ConeGeometry(0.035, 0.18 - i * 0.04, 4), mat(0xff2200));
    feather.position.set(-0.05 + i * 0.02, 0.22, (i - 1) * 0.08);
    feather.rotation.z = -0.2 + i * 0.1;
    headG.add(feather);
  }
  addTo(headG, sphere(0.052, 6, 5), eyeM,  0.14,  0.07,  0.13);
  addTo(headG, sphere(0.052, 6, 5), eyeM,  0.14,  0.07, -0.13);

  // Wings — pivot at body side, feathers extend outward along ±Z.
  // Flap = rotation.z:  0 = resting,  -1.2 = fully up,  +0.5 = down-stroke.
  const lWingG = new THREE.Group();
  lWingG.position.set(0, 0.34, 0.26);   // left shoulder
  parts['lWing'] = lWingG;
  pivot.add(lWingG);
  addTo(lWingG, box(0.08, 0.16, 0.38), wingM, 0, 0,  0.20);  // inner panel
  addTo(lWingG, box(0.06, 0.12, 0.30), wingM, 0, 0,  0.42);  // mid panel
  addTo(lWingG, box(0.05, 0.08, 0.22), tipM,  0, 0,  0.60);  // primary tips

  const rWingG = new THREE.Group();
  rWingG.position.set(0, 0.34, -0.26);  // right shoulder
  parts['rWing'] = rWingG;
  pivot.add(rWingG);
  addTo(rWingG, box(0.08, 0.16, 0.38), wingM, 0, 0, -0.20);
  addTo(rWingG, box(0.06, 0.12, 0.30), wingM, 0, 0, -0.42);
  addTo(rWingG, box(0.05, 0.08, 0.22), tipM,  0, 0, -0.60);

  // Tail feathers
  for (let i = 0; i < 4; i++) {
    addTo(pivot, box(0.06, 0.02, 0.28 - i * 0.02), wingM,
      -0.24, 0.28 + i * 0.02, (i - 1.5) * 0.09);
  }

  // Feet
  [0.12, -0.12].forEach((lz, si) => {
    const legG = new THREE.Group();
    legG.position.set(0, 0.16, lz);
    parts[`legFoot${si === 0 ? 'L' : 'R'}`] = legG;
    pivot.add(legG);
    addTo(legG, cyl(0.02, 0.03, 0.18, 5), footM, 0, -0.09, 0);
    [-0.04, 0, 0.04].forEach((tz, ti) => {
      addTo(legG, cyl(0.012, 0.018, 0.12, 4), footM,
        0.05 * (ti + 0.5), -0.20, tz, 0, 0, -0.3 + ti * 0.3);
    });
  });

  const habitat = HABITATS[3];
  return {
    id: 'bird', name: 'Tropical Bird', habitat: 'Aviary', position: pos,
    color: 0xe85520, accentColor: 0xeecc00, animationType: 'fly',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 5.4,
  };
}

// ---------------------------------------------------------------------------
// TURTLE
// ---------------------------------------------------------------------------
function buildTurtle(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const shellM   = mat(0x3e6e30);
  const shellDkM = mat(0x274a1e);
  const shellLtM = mat(0x5a9040);
  const skinM    = mat(0x6a8840);
  const eyeM     = matE(0x111111, 0x224400, 0.3);

  const shell = mkMesh(new THREE.SphereGeometry(0.52, 12, 10), shellM);
  shell.scale.set(1.0, 0.55, 0.92);
  shell.position.set(0, 0.38, 0);
  pivot.add(shell);

  const scuteData: [number, number, number, number][] = [
    [0, 0.64, 0, 0],
    [0.15, 0.60,  0.22, 0.5], [0.15, 0.60, -0.22, -0.5],
    [-0.12, 0.60,  0.22, 0.8], [-0.12, 0.60, -0.22, -0.8],
    [0, 0.56,  0.38, 1.3], [0, 0.56, -0.38, -1.3],
    [0.22, 0.50, 0, 0.1], [-0.18, 0.50, 0, 0.1],
  ];
  scuteData.forEach(([x, y, z, ry]) => {
    const s = mkMesh(box(0.16, 0.04, 0.17), shellLtM);
    s.position.set(x, y, z); s.rotation.y = ry;
    pivot.add(s);
    const b = mkMesh(box(0.16, 0.02, 0.17), shellDkM);
    b.position.set(x, y - 0.025, z); b.rotation.y = ry;
    pivot.add(b);
  });

  const plastron = mkMesh(new THREE.SphereGeometry(0.42, 8, 7), shellDkM);
  plastron.scale.set(0.95, 0.12, 0.80);
  plastron.position.set(0, 0.10, 0);
  pivot.add(plastron);

  const headG = new THREE.Group();
  headG.position.set(0.48, 0.26, 0);
  parts['head'] = headG;
  pivot.add(headG);
  const skull = mkMesh(new THREE.SphereGeometry(0.17, 8, 7), skinM);
  skull.scale.set(1.2, 0.80, 0.95);
  headG.add(skull);
  addTo(headG, box(0.18, 0.08, 0.18), skinM, 0.12, -0.05, 0);
  addTo(headG, sphere(0.05, 6, 5), eyeM,  0.08, 0.06,  0.11);
  addTo(headG, sphere(0.05, 6, 5), eyeM,  0.08, 0.06, -0.11);

  addTo(pivot, cyl(0.025, 0.04, 0.22, 6), skinM, -0.50, 0.14, 0, 0, 0, 0.3);

  // Flippers
  const legDefs: [number, number, number, number, string][] = [
    [ 0.30,  0.30, -0.15, 0.4, 'FL'],
    [ 0.30, -0.30, -0.15, -0.4, 'FR'],
    [-0.28,  0.28, -0.15, 0.3, 'BL'],
    [-0.28, -0.28, -0.15, -0.3, 'BR'],
  ];
  legDefs.forEach(([lx, lz, ly, rz, name]) => {
    const legG = new THREE.Group();
    legG.position.set(lx, ly, lz);
    legG.rotation.z = rz;
    parts[`leg${name}`] = legG;
    pivot.add(legG);
    addTo(legG, cyl(0.055, 0.075, 0.28, 6), skinM, 0, -0.14, 0);
    const flipper = mkMesh(new THREE.SphereGeometry(0.10, 6, 5), skinM);
    flipper.scale.set(1.4, 0.35, 0.75);
    flipper.position.set(0, -0.32, 0);
    legG.add(flipper);
  });

  const habitat = HABITATS[2];
  return {
    id: 'turtle', name: 'Turtle', habitat: 'Reptile Zone', position: pos,
    color: 0x3e6e30, accentColor: 0x274a1e, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 1.5,
  };
}

// ---------------------------------------------------------------------------
// FISH
// ---------------------------------------------------------------------------
function buildFish(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const fishM   = mat(0xff6600);
  const stripeM = mat(0xffffff);
  const finM    = mat(0xff3300);
  const eyeM    = matE(0x111111, 0x332200, 0.3);

  // Fish faces +X locally so pivot -90° Y correctly makes it go +Z in world
  const body = mkMesh(new THREE.SphereGeometry(0.28, 12, 9), fishM);
  body.scale.set(1.65, 0.82, 0.72);   // elongated along X (our local forward)
  body.position.set(0, 0, 0);
  pivot.add(body);
  parts['bodyMesh'] = body;

  [0.28, 0.0, -0.25].forEach((sx, i) => {
    const s = mkMesh(new THREE.SphereGeometry(0.28, 8, 7), stripeM);
    s.scale.set(i === 0 ? 0.22 : 0.18, 0.84, 0.74);
    s.position.set(sx, 0, 0);
    pivot.add(s);
  });

  const tailG = new THREE.Group();
  tailG.position.set(-0.48, 0, 0);    // behind body along -X
  parts['tail'] = tailG;
  pivot.add(tailG);
  for (let i = 0; i < 5; i++) {
    const f = mkMesh(new THREE.SphereGeometry(0.10, 5, 4), finM);
    f.scale.set(0.3, 0.6 - i * 0.05, 0.15);
    f.position.set(-0.06, (i - 2) * 0.09, 0);
    tailG.add(f);
  }

  const dorsalG = new THREE.Group();
  dorsalG.position.set(0.10, 0.22, 0);
  parts['dorsal'] = dorsalG;
  pivot.add(dorsalG);
  for (let i = 0; i < 4; i++) {
    const f = mkMesh(new THREE.ConeGeometry(0.04, 0.18 - i * 0.03, 4), finM);
    f.position.set(i * 0.06 - 0.09, 0.05, 0);
    dorsalG.add(f);
  }

  const lPec = mkMesh(new THREE.SphereGeometry(0.10, 6, 5), finM);
  lPec.scale.set(0.75, 0.55, 0.18);
  lPec.position.set(0, 0.04,  0.22);
  parts['lPec'] = lPec;
  pivot.add(lPec);

  const rPec = lPec.clone();
  rPec.position.set(0, 0.04, -0.22);
  parts['rPec'] = rPec;
  pivot.add(rPec);

  const eyeball = mkMesh(sphere(0.065, 7, 6), mat(0xffffff));
  eyeball.position.set(0.22, 0.06, 0.20);
  pivot.add(eyeball);
  addTo(pivot, sphere(0.04, 5, 4), eyeM, 0.25, 0.06, 0.22);

  const habitat = HABITATS[4];
  return {
    id: 'fish', name: 'Clownfish', habitat: 'Aquatic Zone', position: pos,
    color: 0xff6600, accentColor: 0xff3300, animationType: 'swim',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius - 2),
    labelHeight: 1.3,
  };
}

// ---------------------------------------------------------------------------
// RABBIT
// ---------------------------------------------------------------------------
function buildRabbit(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const rM     = mat(0xe0d8d0);
  const innerM = mat(0xffb6c1);
  const eyeM   = matE(0xee4466, 0xff2244, 0.5);
  const noseM  = mat(0xff9999);

  const torso = mkMesh(sphere(0.28), rM);
  torso.scale.set(0.92, 1.1, 0.88);
  torso.position.set(0, 0.38, 0);
  pivot.add(torso);

  const headG = new THREE.Group();
  headG.position.set(0, 0.72, 0);
  parts['head'] = headG;
  pivot.add(headG);
  headG.add(mkMesh(sphere(0.22, 9, 8), rM));
  addTo(headG, sphere(0.14, 7, 6), rM,   0.06, -0.06,  0.16);
  addTo(headG, sphere(0.14, 7, 6), rM,   0.06, -0.06, -0.16);
  addTo(headG, sphere(0.10, 7, 6), rM,   0.18, -0.08, 0);
  addTo(headG, sphere(0.04, 5, 4), noseM, 0.24, -0.04, 0);
  addTo(headG, sphere(0.055, 6, 5), eyeM, 0.12, 0.08,  0.15);
  addTo(headG, sphere(0.055, 6, 5), eyeM, 0.12, 0.08, -0.15);

  const earL = new THREE.Group();
  earL.position.set(-0.06, 0.24,  0.10);
  earL.rotation.set(0.12, 0, -0.15);
  parts['earL'] = earL;
  headG.add(earL);
  addTo(earL, cyl(0.042, 0.062, 0.55, 6), rM,     0, 0.27, 0);
  addTo(earL, cyl(0.025, 0.040, 0.48, 6), innerM, 0, 0.27, 0);

  const earR = new THREE.Group();
  earR.position.set(-0.06, 0.24, -0.10);
  earR.rotation.set(-0.12, 0, -0.15);
  parts['earR'] = earR;
  headG.add(earR);
  addTo(earR, cyl(0.042, 0.062, 0.55, 6), rM,     0, 0.27, 0);
  addTo(earR, cyl(0.025, 0.040, 0.48, 6), innerM, 0, 0.27, 0);

  pivot.add((() => { const t = mkMesh(sphere(0.10, 7, 6), rM); t.position.set(-0.28, 0.38, 0); return t; })());

  // Back legs (powerful)
  const backDefs: [number, number, string][] = [
    [-0.05,  0.16, 'BL'],
    [-0.05, -0.16, 'BR'],
  ];
  backDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.24, 0.075, 0.22, 0.06, 0.065, rM, lx, 0.38, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });
  // Front paws
  const frontDefs: [number, number, string][] = [
    [ 0.10,  0.12, 'FL'],
    [ 0.10, -0.12, 'FR'],
  ];
  frontDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.16, 0.055, 0.14, 0.045, 0.050, rM, lx, 0.38, lz);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  const habitat = HABITATS[3];
  return {
    id: 'rabbit', name: 'Rabbit', habitat: 'Aviary', position: pos,
    color: 0xe0d8d0, accentColor: 0xffb6c1, animationType: 'hop',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 1.8,
  };
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
export function buildAnimals(scene: THREE.Scene): AnimalData[] {
  const animals: AnimalData[] = [
    buildLion(     new THREE.Vector3(-36, 0, -36)),
    buildElephant( new THREE.Vector3(-22, 0, -24)),
    buildGiraffe(  new THREE.Vector3(-32, 0, -20)),
    buildZebra(    new THREE.Vector3(-26, 0, -32)),
    buildMonkey(   new THREE.Vector3( 23, 0, -33)),
    buildSnake(    new THREE.Vector3( 32, 0,  24)),
    buildBird(     new THREE.Vector3(-33, 0,  23)),
    buildTurtle(   new THREE.Vector3( 24, 0,  31)),
    buildFish(     new THREE.Vector3(  0, 0.3, 0)),
    buildRabbit(   new THREE.Vector3(-23, 0,  33)),
  ];

  // Give monkey tree-top perches as its wander targets
  const monkeyPerches = buildMonkeyPerches();
  const monkey = animals.find(a => a.id === 'monkey')!;
  monkey.wanderTarget = monkeyPerches[0].clone();
  // Store perches on group for animator access
  (monkey.group as THREE.Group & { _perches: THREE.Vector3[] })._perches = monkeyPerches;

  animals.forEach(animal => {
    animal.group.position.copy(animal.position);
    scene.add(animal.group);
  });

  return animals;
}
