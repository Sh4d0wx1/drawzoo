import * as THREE from 'three';
import type { Habitat } from './types';
import { HABITATS } from './habitats';

// ---------------------------------------------------------------------------
// Shared materials — created once, reused everywhere
// ---------------------------------------------------------------------------
const M = {
  trunk:      new THREE.MeshLambertMaterial({ color: 0x8b4513 }),
  trunkLight: new THREE.MeshLambertMaterial({ color: 0xa0522d }),
  darkLeaf:   new THREE.MeshLambertMaterial({ color: 0x2d7a2d }),
  midLeaf:    new THREE.MeshLambertMaterial({ color: 0x3a9040 }),
  lightLeaf:  new THREE.MeshLambertMaterial({ color: 0x4db84d }),
  paleLeaf:   new THREE.MeshLambertMaterial({ color: 0x90c860 }),
  birchTrunk: new THREE.MeshLambertMaterial({ color: 0xe8e0d0 }),
  cactus:     new THREE.MeshLambertMaterial({ color: 0x4a7c59 }),
  grass:      new THREE.MeshLambertMaterial({ color: 0x6abf40, side: THREE.DoubleSide }),
  dryGrass:   new THREE.MeshLambertMaterial({ color: 0xb8a040, side: THREE.DoubleSide }),
  jungleGrass:new THREE.MeshLambertMaterial({ color: 0x38a838, side: THREE.DoubleSide }),
  fencePost:  new THREE.MeshLambertMaterial({ color: 0xc8a050 }),
  fenceRail:  new THREE.MeshLambertMaterial({ color: 0xb89040 }),
  pathMat:    new THREE.MeshLambertMaterial({ color: 0xd2b48c }),
  pebbleMat:  new THREE.MeshLambertMaterial({ color: 0xb8a890 }),
  water:      new THREE.MeshStandardMaterial({ color: 0x00a8cc, transparent: true, opacity: 0.6, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  waterSheen: new THREE.MeshBasicMaterial({ color: 0x80e0ff, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide }),
  rock:       new THREE.MeshLambertMaterial({ color: 0x888888 }),
  rockDark:   new THREE.MeshLambertMaterial({ color: 0x666666 }),
  bush:       new THREE.MeshLambertMaterial({ color: 0x2a6e28 }),
  bushLight:  new THREE.MeshLambertMaterial({ color: 0x3a8e38 }),
  flower1:    new THREE.MeshLambertMaterial({ color: 0xff6699 }),
  flower2:    new THREE.MeshLambertMaterial({ color: 0xffdd00 }),
  flower3:    new THREE.MeshLambertMaterial({ color: 0xff8800 }),
  flower4:    new THREE.MeshLambertMaterial({ color: 0xcc44ff }),
  flowerStem: new THREE.MeshLambertMaterial({ color: 0x449922 }),
  cloudMat:   new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 }),
  butterfly1: new THREE.MeshLambertMaterial({ color: 0xff88cc, side: THREE.DoubleSide }),
  butterfly2: new THREE.MeshLambertMaterial({ color: 0x88ddff, side: THREE.DoubleSide }),
};

// ---------------------------------------------------------------------------
// Public entry — called from ZooScene
// ---------------------------------------------------------------------------
export function buildScenery(scene: THREE.Scene): THREE.Object3D[] {
  buildHabitatFences(scene);
  buildPaths(scene);
  buildWaterPond(scene, HABITATS[4]);
  buildHabitatScenery(scene);
  buildGlobalGrass(scene);
  buildClouds(scene);
  const butterflies = buildButterflies(scene);
  return butterflies;
}

// ============================================================================
// HABITAT FENCES — each habitat enclosed with wooden post-and-rail fence
// ============================================================================
function buildHabitatFences(scene: THREE.Scene): void {
  HABITATS.forEach(h => {
    if (h.name === 'Aquatic Zone') return; // Keep aquatic basin open and clean
    const segs = 36;
    const r    = h.radius + 0.3;
    // Posts
    for (let i = 0; i < segs; i++) {
      const a   = (i / segs) * Math.PI * 2;
      const px  = h.center.x + Math.cos(a) * r;
      const pz  = h.center.z + Math.sin(a) * r;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 1.4, 6),
        M.fencePost,
      );
      post.position.set(px, 0.7, pz);
      post.castShadow = true;
      scene.add(post);
    }
    // Two rails per habitat — TubeGeometry along a circle
    for (const railY of [0.45, 1.05]) {
      const railPts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        railPts.push(new THREE.Vector3(
          h.center.x + Math.cos(a) * r,
          railY,
          h.center.z + Math.sin(a) * r,
        ));
      }
      const curve = new THREE.CatmullRomCurve3(railPts, true);
      const railGeo = new THREE.TubeGeometry(curve, segs * 2, 0.035, 4, true);
      scene.add(new THREE.Mesh(railGeo, M.fenceRail));
    }
  });

  // Outer perimeter fence
  buildPerimeterFence(scene);
}

function buildPerimeterFence(scene: THREE.Scene): void {
  const corners: [number, number][] = [[-56,-56],[56,-56],[56,56],[-56,56]];
  for (let i = 0; i < corners.length; i++) {
    const [x1, z1] = corners[i];
    const [x2, z2] = corners[(i + 1) % corners.length];
    buildFenceSegment(scene, x1, z1, x2, z2, 5);
  }
}

function buildFenceSegment(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  spacing = 4,
): void {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const ang = Math.atan2(dz, dx);
  const steps = Math.ceil(len / spacing);

  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 6), M.fencePost);
    post.position.set(x1 + dx * t, 0.8, z1 + dz * t);
    post.castShadow = true;
    scene.add(post);
  }
  for (const rh of [0.5, 1.15]) {
    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, len, 4);
    const rail    = new THREE.Mesh(railGeo, M.fenceRail);
    rail.position.set((x1 + x2) / 2, rh, (z1 + z2) / 2);
    rail.rotation.y = -ang;
    rail.rotation.z = Math.PI / 2;
    scene.add(rail);
  }
}

// ============================================================================
// PATHS — circular collar around pond and radial spokes to habitat gates
// ============================================================================
function buildPaths(scene: THREE.Scene): void {
  // 1. Central Pond Promenade Collar Ring (strictly outside black rim: r in [16.5, 19.5])
  const segs = 64;
  const ringGeo = new THREE.RingGeometry(16.5, 19.5, segs);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, M.pathMat);
  ringMesh.position.set(0, 0.025, 0);
  ringMesh.receiveShadow = true;
  scene.add(ringMesh);

  // Scattered pebbles along the outer promenade perimeter
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
    const pr = 19.6 + (Math.random() - 0.5) * 0.3;
    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 4, 3),
      M.pebbleMat,
    );
    pebble.position.set(Math.cos(a) * pr, 0.04, Math.sin(a) * pr);
    scene.add(pebble);
  }

  // 2. Gate coordinates located strictly outside each enclosure fence
  const gateCoords: [number, number][] = HABITATS.slice(0, 4).map((h) => {
    const len = Math.hypot(h.center.x, h.center.z);
    const nx = h.center.x / len;
    const nz = h.center.z / len;
    const gateDist = len - (h.radius + 0.6);
    return [nx * gateDist, nz * gateDist];
  });

  // 3. Spoke pathways connecting outer collar (r = 19.5) outwards to each gate
  gateCoords.forEach(([gx, gz], idx) => {
    const h = HABITATS[idx];
    const len = Math.hypot(h.center.x, h.center.z);
    const nx = h.center.x / len;
    const nz = h.center.z / len;
    const startR = 19.5; // Starts at outer edge of collar ring
    const sx = nx * startR;
    const sz = nz * startR;

    // Path spoke terminates at fence entrance
    addPathSegment(scene, sx, sz, gx, gz, 2.6);
    // Gate entrance landing pad outside the fence
    addPathCircle(scene, gx, gz, 2.4);
  });

  // 4. Outer boundary perimeter walkway at the far edges of the zoo park (r ~ 48)
  const outerCorners: [number, number][] = [
    [-46, -46], [46, -46], [46, 46], [-46, 46],
  ];
  for (let i = 0; i < outerCorners.length; i++) {
    const [x1, z1] = outerCorners[i];
    const [x2, z2] = outerCorners[(i + 1) % outerCorners.length];
    addPathSegment(scene, x1, z1, x2, z2, 2.0);
  }
}

function addPathSegment(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  width = 2.4,
): void {
  const dx = x2 - x1, dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 0.1) return;

  // Strict clamp: reject any path segment that intersects or passes inside the pond perimeter (r < 16.0)
  const t = THREE.MathUtils.clamp(-(x1 * dx + z1 * dz) / lenSq, 0, 1);
  const closestDist = Math.hypot(x1 + t * dx, z1 + t * dz);
  if (closestDist < 16.0) return;

  const len = Math.sqrt(lenSq);
  const ang = Math.atan2(dz, dx);

  const geo  = new THREE.PlaneGeometry(len, width);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.pathMat);
  mesh.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2);
  mesh.rotation.y = -ang;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Scattered path pebbles along the edges
  const count = Math.floor(len * 1.5);
  for (let i = 0; i < count; i++) {
    const tPeb = Math.random();
    const side = (Math.random() - 0.5) * (width + 0.5);
    const px   = x1 + dx * tPeb - Math.sin(ang) * side;
    const pz   = z1 + dz * tPeb + Math.cos(ang) * side;
    if (Math.hypot(px, pz) < 16.0) continue; // Skip pebbles inside pond collar

    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.08, 4, 3),
      M.pebbleMat,
    );
    pebble.position.set(px, 0.04, pz);
    scene.add(pebble);
  }
}

function addPathCircle(scene: THREE.Scene, x: number, z: number, r: number): void {
  if (Math.hypot(x, z) < 16.0) return; // Never inside pond

  const geo  = new THREE.CircleGeometry(r, 28);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.pathMat);
  mesh.position.set(x, 0.03, z);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Edge pebbles
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const pr = r + (Math.random() - 0.5) * 0.5;
    const px = x + Math.cos(a) * pr;
    const pz = z + Math.sin(a) * pr;
    if (Math.hypot(px, pz) < 16.0) continue;

    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + Math.random() * 0.07, 4, 3),
      M.pebbleMat,
    );
    pebble.position.set(px, 0.04, pz);
    scene.add(pebble);
  }
}

// ============================================================================
// WATER POND (Single Flat Circular Water Disc at Y = -0.2)
// ============================================================================
function buildWaterPond(scene: THREE.Scene, h: Habitat): void {
  // Single flat circular water disc sitting at Y = -0.2 (matching inner diameter of black boundary rim)
  const waterRadius = 15.48;
  const geo = new THREE.CircleGeometry(waterRadius, 64);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, M.water);
  water.position.set(h.center.x, -0.20, h.center.z);
  water.receiveShadow = true;
  scene.add(water);
}

// ============================================================================
// PER-HABITAT SCENERY (Organic Perimeter Clusters & Open Centers)
// ============================================================================
function buildHabitatScenery(scene: THREE.Scene): void {
  HABITATS.forEach((h, i) => {
    if (i === 4) return; // Skip Aquatic Zone so water basin is completely uncluttered

    // Direction pointing from habitat center to zoo center (the entrance direction)
    const toCenter = new THREE.Vector2(-h.center.x, -h.center.z).normalize();
    const gateAngle = Math.atan2(toCenter.y, toCenter.x);

    // 3 organic perimeter cluster centers away from gate
    const clusterAngles = [
      gateAngle + Math.PI * 0.52 + (Math.random() - 0.5) * 0.25,
      gateAngle + Math.PI * 1.00 + (Math.random() - 0.5) * 0.25,
      gateAngle + Math.PI * 1.48 + (Math.random() - 0.5) * 0.25,
    ];

    clusterAngles.forEach((cAngle) => {
      const clusterDist = h.radius * (0.65 + Math.random() * 0.16);
      const cx = h.center.x + Math.cos(cAngle) * clusterDist;
      const cz = h.center.z + Math.sin(cAngle) * clusterDist;

      // 1-3 trees per organic cluster
      const treeCount = 1 + Math.floor(Math.random() * 2);
      for (let t = 0; t < treeCount; t++) {
        const tx = cx + (Math.random() - 0.5) * 2.8;
        const tz = cz + (Math.random() - 0.5) * 2.8;
        if (Math.hypot(tx - h.center.x, tz - h.center.z) > h.radius - 1.8) continue;

        if (i === 0) buildAcaciaTree(scene, tx, tz);
        else if (i === 1) buildJungleTree(scene, tx, tz);
        else if (i === 2) buildCactus(scene, tx, tz);
        else if (i === 3) buildBirchTree(scene, tx, tz);
      }

      // Bush near cluster
      buildBush(scene, cx + (Math.random() - 0.5) * 1.5, cz + (Math.random() - 0.5) * 1.5, i);

      // Natural rock cluster
      buildRock(scene, cx + (Math.random() - 0.5) * 2.0, cz + (Math.random() - 0.5) * 2.0, 0.30 + Math.random() * 0.40);
    });

    // Scattered natural flowers along outer perimeter
    for (let k = 0; k < 6; k++) {
      const a = Math.random() * Math.PI * 2;
      if (Math.abs(a - gateAngle) < 0.5) continue; // Keep gate viewing clear
      const dist = h.radius * (0.62 + Math.random() * 0.24);
      buildFlower(scene, h.center.x + Math.cos(a) * dist, h.center.z + Math.sin(a) * dist, i);
    }
  });
}

function buildGlobalGrass(scene: THREE.Scene): void {
  HABITATS.forEach((h, i) => {
    if (i === 4) return; // Skip Aquatic Zone
    const count = 20 + Math.floor(Math.random() * 14);
    for (let k = 0; k < count; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.random() * (h.radius - 1.5);
      buildGrassTuft(
        scene,
        h.center.x + Math.cos(angle) * dist,
        h.center.z + Math.sin(angle) * dist,
        i,
      );
    }
  });
  // Grass outside habitats (skip any points near center aquatic pond)
  for (let k = 0; k < 60; k++) {
    const x = (Math.random() - 0.5) * 110;
    const z = (Math.random() - 0.5) * 110;
    if (Math.hypot(x, z) < 18.0) continue;
    buildGrassTuft(scene, x, z, -1);
  }
}

// ============================================================================
// TREES
// ============================================================================
function buildAcaciaTree(scene: THREE.Scene, x: number, z: number): void {
  const h = 2.8 + Math.random() * 1.2;
  // Trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.18, h, 7), M.trunk);
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  scene.add(trunk);
  // Flat umbrella canopy — two layers for depth
  for (let layer = 0; layer < 2; layer++) {
    const r  = 2.0 - layer * 0.3;
    const yy = h + 0.1 + layer * 0.35;
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.2, r + 0.6, 0.42, 12),
      layer === 0 ? M.darkLeaf : M.midLeaf,
    );
    canopy.position.set(x, yy, z);
    canopy.castShadow = true;
    scene.add(canopy);
  }
}

function buildJungleTree(scene: THREE.Scene, x: number, z: number): void {
  const h = 4.0 + Math.random() * 2.0;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, h, 8), M.trunk);
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  scene.add(trunk);
  // Three layered cones
  for (let i = 0; i < 3; i++) {
    const r = 2.0 - i * 0.4;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, 1.6, 9),
      i % 2 === 0 ? M.darkLeaf : M.midLeaf,
    );
    cone.position.set(x, h - 0.4 + i * 1.1, z);
    cone.castShadow = true;
    scene.add(cone);
  }
  // Hanging vines
  for (let v = 0; v < 3; v++) {
    const va  = Math.random() * Math.PI * 2;
    const vr  = 0.5 + Math.random() * 0.9;
    const vine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.2 + Math.random() * 0.8, 4),
      M.darkLeaf,
    );
    vine.position.set(x + Math.cos(va) * vr, h - 0.5, z + Math.sin(va) * vr);
    scene.add(vine);
  }
}

function buildBirchTree(scene: THREE.Scene, x: number, z: number): void {
  const h = 3.2 + Math.random() * 1.2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, h, 6), M.birchTrunk);
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  scene.add(trunk);
  // Dark bark bands
  for (let b = 0; b < 3; b++) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.083, 0.083, 0.08, 6),
      M.trunk,
    );
    band.position.set(x, 0.6 + b * 0.9, z);
    scene.add(band);
  }
  // Crown — sphere + smaller cluster
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), M.lightLeaf);
  crown.position.set(x, h + 0.6, z);
  crown.castShadow = true;
  scene.add(crown);
  const sub = new THREE.Mesh(new THREE.SphereGeometry(0.9, 7, 5), M.paleLeaf);
  sub.position.set(x + 0.6, h + 0.4, z + 0.4);
  scene.add(sub);
}

function buildCactus(scene: THREE.Scene, x: number, z: number): void {
  const h = 1.4 + Math.random() * 1.2;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h, 8), M.cactus);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  scene.add(body);
  // Ridges
  for (let r = 0; r < 6; r++) {
    const ra  = (r / 6) * Math.PI * 2;
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, h * 0.9, 4),
      M.cactus,
    );
    rib.position.set(x + Math.cos(ra) * 0.18, h / 2, z + Math.sin(ra) * 0.18);
    scene.add(rib);
  }
  // Arms
  for (const side of [-1, 1]) {
    const armH = h * 0.42;
    const arm  = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, armH, 7), M.cactus);
    arm.position.set(x + side * 0.38, h * 0.58 + 0.2, z);
    arm.rotation.z = side * 0.65;
    arm.castShadow = true;
    scene.add(arm);
    // Arm top
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 5), M.cactus);
    tip.position.set(
      x + side * (0.38 + Math.sin(side * 0.65) * armH * 0.5),
      h * 0.58 + 0.2 + Math.cos(0.65) * armH * 0.5,
      z,
    );
    scene.add(tip);
  }
  // Flower on top
  if (Math.random() > 0.4) {
    const flMat = Math.random() > 0.5 ? M.flower1 : M.flower2;
    const fl    = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), flMat);
    fl.position.set(x, h + 0.12, z);
    scene.add(fl);
  }
}

// ============================================================================
// BUSH
// ============================================================================
function buildBush(scene: THREE.Scene, x: number, z: number, habitatIdx: number): void {
  const mats = [M.bushLight, M.bush, M.darkLeaf, M.lightLeaf, M.midLeaf];
  const bMat = mats[habitatIdx] ?? M.bush;
  const r  = 0.35 + Math.random() * 0.45;
  const n  = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const off   = r * 0.4;
    const blob  = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), bMat);
    blob.position.set(
      x + Math.cos(angle) * off,
      r * 0.7,
      z + Math.sin(angle) * off,
    );
    blob.castShadow = true;
    scene.add(blob);
  }
}

// ============================================================================
// FLOWERS
// ============================================================================
const FLOWER_MATS = [M.flower1, M.flower2, M.flower3, M.flower4];

function buildFlower(scene: THREE.Scene, x: number, z: number, habitatIdx: number): void {
  const stemH = 0.22 + Math.random() * 0.22;
  const stem  = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, stemH, 4),
    M.flowerStem,
  );
  stem.position.set(x, stemH / 2, z);
  scene.add(stem);

  const petalMat = FLOWER_MATS[(habitatIdx + Math.floor(Math.random() * 3)) % 4];
  // Petals (4–6 lobes around centre)
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const a      = (i / n) * Math.PI * 2;
    const petal  = new THREE.Mesh(
      new THREE.SphereGeometry(0.07 + Math.random() * 0.04, 5, 4),
      petalMat,
    );
    petal.scale.z = 1.6;
    petal.position.set(
      x + Math.cos(a) * 0.10,
      stemH + 0.02,
      z + Math.sin(a) * 0.10,
    );
    petal.rotation.y = a;
    scene.add(petal);
  }
  // Centre
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.055, 5, 4), M.flower2);
  centre.position.set(x, stemH + 0.04, z);
  scene.add(centre);
}

// ============================================================================
// ROCKS
// ============================================================================
function buildRock(scene: THREE.Scene, x: number, z: number, scale: number): void {
  const mat  = Math.random() > 0.5 ? M.rock : M.rockDark;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), mat);
  rock.position.set(x, scale * 0.48, z);
  rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.4);
  rock.castShadow   = true;
  rock.receiveShadow = true;
  scene.add(rock);
  // Small cluster pebbles
  for (let p = 0; p < 2; p++) {
    const peb = new THREE.Mesh(
      new THREE.DodecahedronGeometry(scale * (0.25 + Math.random() * 0.25), 0),
      mat,
    );
    peb.position.set(
      x + (Math.random() - 0.5) * scale * 2,
      scale * 0.2,
      z + (Math.random() - 0.5) * scale * 2,
    );
    peb.rotation.y = Math.random() * Math.PI;
    scene.add(peb);
  }
}

// ============================================================================
// GRASS TUFTS
// ============================================================================
function buildGrassTuft(scene: THREE.Scene, x: number, z: number, habitatIdx: number): void {
  const mat   = habitatIdx === 0 ? M.dryGrass
              : habitatIdx === 1 ? M.jungleGrass
              : M.grass;
  const blades = 3 + Math.floor(Math.random() * 5);
  for (let i = 0; i < blades; i++) {
    const bh    = 0.28 + Math.random() * 0.38;
    const geo   = new THREE.PlaneGeometry(0.10 + Math.random() * 0.06, bh);
    const blade = new THREE.Mesh(geo, mat);
    const a     = (i / blades) * Math.PI * 2;
    blade.position.set(
      x + Math.cos(a) * 0.12,
      bh / 2,
      z + Math.sin(a) * 0.12,
    );
    blade.rotation.y = a + Math.PI / 4 + (Math.random() - 0.5) * 0.6;
    blade.rotation.z = (Math.random() - 0.5) * 0.35;
    scene.add(blade);
  }
}

// ============================================================================
// CLOUDS — slow-drifting flat spheres high in the sky
// ============================================================================
export function buildClouds(scene: THREE.Scene): void {
  for (let i = 0; i < 10; i++) {
    const cx  = (Math.random() - 0.5) * 180;
    const cz  = (Math.random() - 0.5) * 180;
    const cy  = 28 + Math.random() * 14;
    const grp = new THREE.Group();
    grp.position.set(cx, cy, cz);
    const n = 4 + Math.floor(Math.random() * 4);
    for (let b = 0; b < n; b++) {
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(1.8 + Math.random() * 2.0, 7, 5),
        M.cloudMat,
      );
      blob.position.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 1,
        (Math.random() - 0.5) * 3,
      );
      blob.scale.y = 0.5;
      grp.add(blob);
    }
    grp.userData['drift'] = (Math.random() - 0.5) * 0.0015;
    scene.add(grp);
  }
}

// ============================================================================
// BUTTERFLIES — small quad pairs that flutter near flowers
// ============================================================================
export function buildButterflies(scene: THREE.Scene): THREE.Object3D[] {
  const butterflies: THREE.Object3D[] = [];
  const wingMats = [M.butterfly1, M.butterfly2, M.flower4, M.flower3];

  for (let i = 0; i < 18; i++) {
    const h    = HABITATS[Math.floor(Math.random() * 4)]; // not aquatic
    const a    = Math.random() * Math.PI * 2;
    const r    = Math.random() * (h.radius - 4);
    const bx   = h.center.x + Math.cos(a) * r;
    const bz   = h.center.z + Math.sin(a) * r;
    const by   = 0.6 + Math.random() * 1.2;

    const grp  = new THREE.Group();
    grp.position.set(bx, by, bz);

    const wingMat = wingMats[i % wingMats.length];
    const wingGeo = new THREE.PlaneGeometry(0.28, 0.22);

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.x = side * 0.14;
      wing.rotation.y = side * 0.4;
      grp.add(wing);
    }

    grp.userData['flutter']  = Math.random() * Math.PI * 2; // phase
    grp.userData['baseX']    = bx;
    grp.userData['baseZ']    = bz;
    grp.userData['baseY']    = by;
    grp.userData['driftAng'] = Math.random() * Math.PI * 2;
    scene.add(grp);
    butterflies.push(grp);
  }
  return butterflies;
}
