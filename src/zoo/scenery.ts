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
  water:      new THREE.MeshLambertMaterial({ color: 0x1a8fc1, transparent: true, opacity: 0.84 }),
  waterSheen: new THREE.MeshLambertMaterial({ color: 0x60c8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  rock:       new THREE.MeshLambertMaterial({ color: 0x888888 }),
  rockDark:   new THREE.MeshLambertMaterial({ color: 0x666666 }),
  lampMetal:  new THREE.MeshLambertMaterial({ color: 0x444455 }),
  lampGlow:   new THREE.MeshLambertMaterial({ color: 0xfffacc, emissive: 0xffee88, emissiveIntensity: 1.0 }),
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
  lilyMat:    new THREE.MeshLambertMaterial({ color: 0x44bb44 }),
  lilyFlower: new THREE.MeshLambertMaterial({ color: 0xffaacc }),
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
  buildPathLamps(scene);
  buildClouds(scene);
  const butterflies = buildButterflies(scene);
  return butterflies;
}

// ============================================================================
// HABITAT FENCES — each habitat enclosed with wooden post-and-rail fence
// ============================================================================
function buildHabitatFences(scene: THREE.Scene): void {
  HABITATS.forEach(h => {
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

    // Gate opening — small gap at the south-facing entrance
    // (just removes two posts by skipping — the gap is visual only)
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
// PATHS — stone/gravel paths connecting habitats + central hub
// ============================================================================
function buildPaths(scene: THREE.Scene): void {
  // Central crossroads
  addPathCircle(scene, 0, 0, 5.5);

  // Four spokes to habitat entrances
  const hubs: [number, number, number, number][] = [
    [-28, -28,  0,  0],   // Savanna
    [ 28, -28,  0,  0],   // Jungle
    [ 28,  28,  0,  0],   // Reptile
    [-28,  28,  0,  0],   // Aviary
  ];
  hubs.forEach(([hx, hz, cx, cz]) => addPathStrip(scene, hx, hz, cx, cz, 2.4));

  // Outer ring path connecting all four habitats
  const outerPts: THREE.Vector3[] = [];
  const ringR = 18;
  const outerSegs = 60;
  for (let i = 0; i <= outerSegs; i++) {
    const a = (i / outerSegs) * Math.PI * 2;
    outerPts.push(new THREE.Vector3(Math.cos(a) * ringR, 0.015, Math.sin(a) * ringR));
  }
  const outerCurve = new THREE.CatmullRomCurve3(outerPts, true);
  const outerGeo   = new THREE.TubeGeometry(outerCurve, outerSegs * 2, 1.2, 5, true);
  scene.add(new THREE.Mesh(outerGeo, M.pathMat));

  // Pebble border strips
  addPebbles(scene);
}

function addPathCircle(scene: THREE.Scene, cx: number, cz: number, r: number): void {
  const geo  = new THREE.CircleGeometry(r, 32);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.pathMat);
  mesh.position.set(cx, 0.018, cz);
  scene.add(mesh);
}

function addPathStrip(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  width: number,
): void {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const ang = Math.atan2(dz, dx);
  const geo  = new THREE.PlaneGeometry(len, width);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.pathMat);
  mesh.position.set((x1 + x2) / 2, 0.018, (z1 + z2) / 2);
  mesh.rotation.y = -ang;
  scene.add(mesh);
}

function addPebbles(scene: THREE.Scene): void {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 17 + (Math.random() - 0.5) * 2;
    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + Math.random() * 0.10, 4, 3),
      M.pebbleMat,
    );
    pebble.position.set(Math.cos(a) * r, 0.04, Math.sin(a) * r);
    pebble.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(pebble);
  }
}

// ============================================================================
// WATER POND (Aquatic Zone)
// ============================================================================
function buildWaterPond(scene: THREE.Scene, h: Habitat): void {
  // Main water
  const geo  = new THREE.CircleGeometry(h.radius - 1.5, 56);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, M.water);
  water.position.set(h.center.x, 0.06, h.center.z);
  scene.add(water);

  // Sheen ring
  for (let i = 1; i <= 4; i++) {
    const rr = (h.radius - 1.5) * (i / 5);
    const ringGeo = new THREE.RingGeometry(rr - 0.25, rr, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, M.waterSheen);
    ring.position.set(h.center.x, 0.07 + i * 0.002, h.center.z);
    scene.add(ring);
  }

  // Lily pads
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * (h.radius - 4);
    buildLilyPad(scene, h.center.x + Math.cos(a) * r, h.center.z + Math.sin(a) * r);
  }

  // Pond rocks
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    buildRock(
      scene,
      h.center.x + Math.cos(a) * (h.radius - 1.0),
      h.center.z + Math.sin(a) * (h.radius - 1.0),
      0.3 + Math.random() * 0.55,
    );
  }
}

function buildLilyPad(scene: THREE.Scene, x: number, z: number): void {
  const r   = 0.4 + Math.random() * 0.3;
  const geo = new THREE.CircleGeometry(r, 10, 0.15, Math.PI * 1.7);
  geo.rotateX(-Math.PI / 2);
  const pad = new THREE.Mesh(geo, M.lilyMat);
  pad.position.set(x, 0.09, z);
  pad.rotation.y = Math.random() * Math.PI * 2;
  scene.add(pad);

  // Small flower on top
  const flower = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 6, 5),
    M.lilyFlower,
  );
  flower.scale.y = 0.5;
  flower.position.set(x, 0.14, z);
  scene.add(flower);
}

// ============================================================================
// PER-HABITAT SCENERY
// ============================================================================
function buildHabitatScenery(scene: THREE.Scene): void {
  HABITATS.forEach((h, i) => {
    const treeCount = 7 + Math.floor(Math.random() * 4);
    for (let k = 0; k < treeCount; k++) {
      const angle = (k / treeCount) * Math.PI * 2 + i * 0.55;
      const dist  = h.radius * (0.50 + Math.random() * 0.32);
      const x     = h.center.x + Math.cos(angle) * dist;
      const z     = h.center.z + Math.sin(angle) * dist;
      if (i === 0) buildAcaciaTree(scene, x, z);
      else if (i === 1) buildJungleTree(scene, x, z);
      else if (i === 2) buildCactus(scene, x, z);
      else if (i === 3) buildBirchTree(scene, x, z);
      else { buildRock(scene, x, z, 0.4 + Math.random() * 0.5); }
    }

    // Bushes
    const bushCount = 4 + Math.floor(Math.random() * 5);
    for (let k = 0; k < bushCount; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.random() * (h.radius - 3);
      buildBush(scene, h.center.x + Math.cos(angle) * dist, h.center.z + Math.sin(angle) * dist, i);
    }

    // Rocks
    const rockCount = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < rockCount; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = h.radius * (0.2 + Math.random() * 0.6);
      buildRock(
        scene,
        h.center.x + Math.cos(angle) * dist,
        h.center.z + Math.sin(angle) * dist,
        0.25 + Math.random() * 0.6,
      );
    }

    // Flowers (not in aquatic zone)
    if (i !== 4) {
      const flowerCount = 8 + Math.floor(Math.random() * 10);
      for (let k = 0; k < flowerCount; k++) {
        const angle = Math.random() * Math.PI * 2;
        const dist  = Math.random() * (h.radius - 2);
        buildFlower(scene, h.center.x + Math.cos(angle) * dist, h.center.z + Math.sin(angle) * dist, i);
      }
    }
  });
}

function buildGlobalGrass(scene: THREE.Scene): void {
  HABITATS.forEach((h, i) => {
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
  // Grass outside habitats too
  for (let k = 0; k < 60; k++) {
    const x = (Math.random() - 0.5) * 110;
    const z = (Math.random() - 0.5) * 110;
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
  const mats = [M.bushLight, M.bush, M.darkLeaf, M.lightLeaf, M.lilyMat];
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
// PATH LAMPS — slimmer, warmer
// ============================================================================
function buildPathLamps(scene: THREE.Scene): void {
  const positions: [number, number][] = [
    [-5, -5], [5, -5], [-5, 5], [5, 5],
    [-20, 0], [20, 0], [0, -20], [0, 20],
    [-30, -30], [30, -30], [-30, 30], [30, 30],
    [-15, -15], [15, -15], [-15, 15], [15, 15],
  ];
  positions.forEach(([x, z]) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 4.0, 6),
      M.lampMetal,
    );
    pole.position.set(x, 2.0, z);
    scene.add(pole);

    // Curved arm
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.04, 0.9, 5),
      M.lampMetal,
    );
    arm.position.set(x + 0.35, 4.0, z);
    arm.rotation.z = -0.4;
    scene.add(arm);

    const lampHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      M.lampGlow,
    );
    lampHead.position.set(x + 0.6, 3.92, z);
    scene.add(lampHead);

    const pt = new THREE.PointLight(0xfff5bb, 0.7, 14);
    pt.position.set(x + 0.6, 3.8, z);
    scene.add(pt);
  });
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
