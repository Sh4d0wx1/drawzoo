import * as THREE from 'three';
import type { Habitat } from './types';
import { HABITATS } from './habitats';
const JUNGLE_MATS = {
  // Canopy foliage
  canopyDark:    new THREE.MeshStandardMaterial({ color: 0x1a5c2a, flatShading: true, roughness: 0.85 }),
  canopyMid:     new THREE.MeshStandardMaterial({ color: 0x2d7a3a, flatShading: true, roughness: 0.80 }),
  canopyLight:   new THREE.MeshStandardMaterial({ color: 0x3a9650, flatShading: true, roughness: 0.75 }),
  // Trunk / bark
  tropicalTrunk: new THREE.MeshStandardMaterial({ color: 0x4a3020, flatShading: true, roughness: 1.0 }),
  palmTrunk:     new THREE.MeshStandardMaterial({ color: 0x7a5c38, flatShading: true, roughness: 1.0 }),
  banyTrunk:     new THREE.MeshStandardMaterial({ color: 0x5c4030, flatShading: true, roughness: 1.0 }),
  // Undergrowth
  fernMat:       new THREE.MeshStandardMaterial({ color: 0x2e6b28, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }),
  monsteraMat:   new THREE.MeshStandardMaterial({ color: 0x1e7a30, flatShading: true, roughness: 0.9, side: THREE.DoubleSide }),
  // Vine
  vineMat:       new THREE.MeshStandardMaterial({ color: 0x3d6b20, flatShading: true, roughness: 1.0 }),
  // Flowers
  flowerRed:     new THREE.MeshStandardMaterial({ color: 0xd42020, flatShading: true, emissive: 0x440000, roughness: 0.7 }),
  flowerYellow:  new THREE.MeshStandardMaterial({ color: 0xf0c010, flatShading: true, emissive: 0x402800, roughness: 0.7 }),
  flowerOrange:  new THREE.MeshStandardMaterial({ color: 0xe05810, flatShading: true, emissive: 0x401000, roughness: 0.7 }),
  // Stream — vivid tropical teal, glossy enough to catch sunlight
  streamWater:   new THREE.MeshStandardMaterial({ color: 0x0fb8a0, transparent: true, opacity: 0.78, roughness: 0.02, metalness: 0.25, depthWrite: false, side: THREE.DoubleSide }),
  streamSheen:   new THREE.MeshBasicMaterial({ color: 0x7fffd4, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  // Keep old name aliases so global vegetation still compiles
  primary:       new THREE.MeshStandardMaterial({ color: 0x2d7a3a, flatShading: true, roughness: 0.80 }),
  undergrowth:   new THREE.MeshStandardMaterial({ color: 0x1e6a28, flatShading: true, roughness: 1.0 }),
  pineTrunk:     new THREE.MeshStandardMaterial({ color: 0x4a3020, flatShading: true, roughness: 1.0 }),
};

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
  fencePost:  new THREE.MeshLambertMaterial({ color: 0xc8a050 }),
  fenceRail:  new THREE.MeshLambertMaterial({ color: 0xb89040 }),
  pathMat:    new THREE.MeshLambertMaterial({ color: 0xd2b48c }),
  water:      new THREE.MeshStandardMaterial({ color: 0x00a8cc, transparent: true, opacity: 0.6, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  waterSheen: new THREE.MeshBasicMaterial({ color: 0x80e0ff, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide }),
  rock:       new THREE.MeshLambertMaterial({ color: 0x888888 }),
  rockDark:   new THREE.MeshLambertMaterial({ color: 0x666666 }),
  bush:       new THREE.MeshLambertMaterial({ color: 0x2a6e28 }),
  bushLight:  new THREE.MeshLambertMaterial({ color: 0x3a8e38 }),
  cloudMat:   new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.88 }),
  butterfly1: new THREE.MeshLambertMaterial({ color: 0xff88cc, side: THREE.DoubleSide }),
  butterfly2: new THREE.MeshLambertMaterial({ color: 0x88ddff, side: THREE.DoubleSide }),
  lampMat:    new THREE.MeshLambertMaterial({ color: 0x5a5a6e }),
  lampDarkMat:new THREE.MeshLambertMaterial({ color: 0x3a3a4a }),
  lightMat:   new THREE.MeshBasicMaterial({ color: 0xfff8c0 }),
  lightGlassMat: new THREE.MeshLambertMaterial({ color: 0xffeea0, transparent: true, opacity: 0.75 }),
  hedgeDark:  new THREE.MeshLambertMaterial({ color: 0x2a5e1e }),
  hedgeMid:   new THREE.MeshLambertMaterial({ color: 0x347326 }),
  sandstone:  new THREE.MeshLambertMaterial({ color: 0xcd853f }),
  deadwood:   new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  agave:      new THREE.MeshLambertMaterial({ color: 0x556b2f }),
  cactusLight:new THREE.MeshLambertMaterial({ color: 0x8fbc8f }),
  sand:       new THREE.MeshLambertMaterial({ color: 0xd2b48c }),
};

// ---------------------------------------------------------------------------
// Public entry — called from ZooScene
// ---------------------------------------------------------------------------
export function buildScenery(scene: THREE.Scene): THREE.Object3D[] {
  buildHabitatFences(scene);
  buildPaths(scene);
  buildWaterPond(scene, HABITATS[4]);
  buildHabitatScenery(scene);
  buildGlobalVegetation(scene);
  buildClouds(scene);
  return [];
}

// ============================================================================
// HABITAT FENCES — each habitat enclosed with wooden post-and-rail fence
// ============================================================================
function buildHabitatFences(scene: THREE.Scene): void {
  HABITATS.forEach(h => {
    if (h.name === 'Aquatic Zone') return; // Keep aquatic basin open and clean
    const r = h.radius + 0.3;

    // Gate entrance opening sized precisely to the metal entry gate (gateWidth 2.4m + 0.3m clearance)
    const toCenter = new THREE.Vector2(-h.center.x, -h.center.z).normalize();
    const gateAngle = Math.atan2(toCenter.y, toCenter.x);
    const gateHalfArc = 1.35 / r; // ~2.7m arc opening centered on gate

    // Fence rails arc spanning around perimeter between gate endpoints
    const startA = gateAngle + gateHalfArc;
    const totalArc = Math.PI * 2 - gateHalfArc * 2;

    // Distribute posts evenly along the open arc so an end post cleanly anchors each side of the gate
    const postCount = Math.round((totalArc * r) / 3.6);
    for (let i = 0; i <= postCount; i++) {
      const a = startA + (i / postCount) * totalArc;
      const px = h.center.x + Math.cos(a) * r;
      const pz = h.center.z + Math.sin(a) * r;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 1.4, 5),
        M.fencePost,
      );
      post.position.set(px, 0.7, pz);
      scene.add(post);
    }

    // Two rails per habitat — open arc leaving the metal gate threshold clear
    const railSteps = postCount * 2;
    for (const railY of [0.45, 1.05]) {
      const railPts: THREE.Vector3[] = [];
      for (let i = 0; i <= railSteps; i++) {
        const a = startA + (i / railSteps) * totalArc;
        railPts.push(new THREE.Vector3(
          h.center.x + Math.cos(a) * r,
          railY,
          h.center.z + Math.sin(a) * r,
        ));
      }
      const curve = new THREE.CatmullRomCurve3(railPts, false);
      const railGeo = new THREE.TubeGeometry(curve, railSteps, 0.035, 4, false);
      scene.add(new THREE.Mesh(railGeo, M.fenceRail));
    }
  });

  // Outer perimeter fence
  buildPerimeterFence(scene);
}

function buildPerimeterFence(scene: THREE.Scene): void {
  const corners: [number, number][] = [[-120,-120],[120,-120],[120,120],[-120,120]];
  for (let i = 0; i < corners.length; i++) {
    const [x1, z1] = corners[i];
    const [x2, z2] = corners[(i + 1) % corners.length];
    buildFenceSegment(scene, x1, z1, x2, z2, 6);
  }
}

function buildFenceSegment(
  scene: THREE.Scene,
  x1: number, z1: number,
  x2: number, z2: number,
  spacing = 6,
): void {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const ang = Math.atan2(dz, dx);
  const steps = Math.ceil(len / spacing);

  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 5), M.fencePost);
    post.position.set(x1 + dx * t, 0.8, z1 + dz * t);
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
  const segs = 48;
  const ringGeo = new THREE.RingGeometry(26.5, 29.5, segs);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, M.pathMat);
  ringMesh.position.set(0, 0.025, 0);
  ringMesh.receiveShadow = true;
  scene.add(ringMesh);

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
    const startR = 29.5; // Starts at outer edge of collar ring
    const sx = nx * startR;
    const sz = nz * startR;

    // Path spoke terminates at fence entrance
    addPathSegment(scene, sx, sz, gx, gz, 2.6);
    // Gate entrance landing pad outside the fence
    addPathCircle(scene, gx, gz, 2.4);
  });

  // 4. Outer boundary perimeter walkway at the far edges of the zoo park
  const outerCorners: [number, number][] = [
    [-110, -110], [110, -110], [110, 110], [-110, 110],
  ];
  for (let i = 0; i < outerCorners.length; i++) {
    const [x1, z1] = outerCorners[i];
    const [x2, z2] = outerCorners[(i + 1) % outerCorners.length];
    addPathSegment(scene, x1, z1, x2, z2, 2.0);
  }

  // 5. Winding connecting paths (between habitats) from outer edge to central ring
  const gapAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  gapAngles.forEach((ang) => {
    // Start at outer perimeter midpoint
    const startX = Math.cos(ang) * 110;
    const startZ = Math.sin(ang) * 110;
    
    // End at inner collar
    const endX = Math.cos(ang) * 29.5;
    const endZ = Math.sin(ang) * 29.5;

    // Control point for curve (pull it sideways to make it wind)
    const pullAng = ang + Math.PI / 4;
    const cx = Math.cos(ang) * 70 + Math.cos(pullAng) * 20;
    const cz = Math.sin(ang) * 70 + Math.sin(pullAng) * 20;

    buildCurvedPath(scene, startX, startZ, cx, cz, endX, endZ, 2.4);

    // Decorate along this path
    buildVisitorRestArea(scene, cx, cz, pullAng);
  });
}

function buildCurvedPath(scene: THREE.Scene, x1: number, z1: number, cx: number, cz: number, x2: number, z2: number, width: number): void {
  const steps = 12;
  let prevX = x1;
  let prevZ = z1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Quadratic bezier
    const mt = 1 - t;
    const px = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
    const pz = mt * mt * z1 + 2 * mt * t * cz + t * t * z2;
    
    addPathSegment(scene, prevX, prevZ, px, pz, width);
    prevX = px;
    prevZ = pz;
  }
}

function buildVisitorRestArea(scene: THREE.Scene, cx: number, cz: number, ang: number): void {
  // Push the rest area slightly off the path
  const rx = cx + Math.cos(ang) * 6;
  const rz = cz + Math.sin(ang) * 6;

  // Add a paved landing pad
  addPathCircle(scene, rx, rz, 5);

  // Food stall or Picnic tables
  if (Math.random() < 0.5) {
    buildFoodStall(scene, rx, rz, ang + Math.PI);
    buildTrashCan(scene, rx + 3, rz + 2);
    buildParkBench(scene, rx - 3, rz + 2, ang);
  } else {
    buildPicnicTable(scene, rx - 2, rz - 2, ang);
    buildPicnicTable(scene, rx + 2, rz + 2, ang + 1);
    buildTrashCan(scene, rx, rz + 4);
  }

  // Landscaping around the area
  buildHedge(scene, rx - 5, rz - 5, 4, ang);
  buildHedge(scene, rx + 5, rz - 5, 4, ang);
  buildStructuredFlowerBed(scene, rx, rz - 6, 6, 2);
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
}

function addPathCircle(scene: THREE.Scene, x: number, z: number, r: number): void {
  if (Math.hypot(x, z) < 16.0) return; // Never inside pond

  const geo  = new THREE.CircleGeometry(r, 24);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, M.pathMat);
  mesh.position.set(x, 0.03, z);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ============================================================================
// WATER POND (Single Flat Circular Water Disc at Y = -0.2)
// ============================================================================
function buildWaterPond(scene: THREE.Scene, h: Habitat): void {
  const waterRadius = 25.48;
  const geo = new THREE.CircleGeometry(waterRadius, 48);
  geo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geo, M.water);
  water.position.set(h.center.x, -0.20, h.center.z);
  water.receiveShadow = true;
  scene.add(water);
}

// ============================================================================
// PER-HABITAT SCENERY (Curated Organic Perimeter Trees & Rocks)
// ============================================================================
function buildHabitatScenery(scene: THREE.Scene): void {
  HABITATS.forEach((h, i) => {
    if (i === 4) return; // Skip Aquatic Zone

    const toCenter = new THREE.Vector2(-h.center.x, -h.center.z).normalize();
    const gateAngle = Math.atan2(toCenter.y, toCenter.x);

    if (i === 0) {
      // Custom Savanna Scenery Layout
      
      const isInWaterHole = (x: number, z: number): boolean => {
        const wx = h.center.x - 8;
        const wz = h.center.z - 8;
        const wr = h.radius * 0.28 + 0.8;
        return Math.hypot(x - wx, z - wz) < wr;
      };

      // 1. Acacia Trees: 5-7 trees
      // Frame the rear perimeter
      const numRearTrees = 4 + Math.floor(Math.random() * 2);
      const rearAngleStart = gateAngle + Math.PI - 0.8;
      const rearAngleEnd = gateAngle + Math.PI + 0.8;
      for (let j = 0; j < numRearTrees; j++) {
        const t = j / (numRearTrees - 1);
        const angle = rearAngleStart + t * (rearAngleEnd - rearAngleStart) + (Math.random() - 0.5) * 0.2;
        const tr = h.radius * 0.85;
        const tx = h.center.x + Math.cos(angle) * tr;
        const tz = h.center.z + Math.sin(angle) * tr;
        if (isInWaterHole(tx, tz)) continue;
        const scale = 2.0 + Math.random() * 0.4; // 2.0x to 2.4x
        buildAcaciaTree(scene, tx, tz, scale);
      }
      
      // Cluster near watering hole
      const numWaterTrees = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numWaterTrees; j++) {
        const angle = Math.random() * Math.PI * 2;
        const tr = 14 + Math.random() * 4;
        const tx = h.center.x - 8 + Math.cos(angle) * tr;
        const tz = h.center.z - 8 + Math.sin(angle) * tr;
        if (isInWaterHole(tx, tz)) continue;
        const scale = 2.0 + Math.random() * 0.4;
        buildAcaciaTree(scene, tx, tz, scale);
      }

      // 2. Rocky Kopje: Opposite side of the water
      const kAngle = gateAngle + Math.PI * 0.25;
      const kr = h.radius * 0.7;
      const kx = h.center.x + Math.cos(kAngle) * kr;
      const kz = h.center.z + Math.sin(kAngle) * kr;
      buildSavannaKopje(scene, kx, kz);

      // 3. Dry Grass and Pebbles
      const numGrass = 22;
      for (let j = 0; j < numGrass; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = h.radius * (0.1 + Math.random() * 0.8);
        const gx = h.center.x + Math.cos(angle) * r;
        const gz = h.center.z + Math.sin(angle) * r;
        if (isInWaterHole(gx, gz)) continue;
        if (Math.random() > 0.5) buildDryGrass(scene, gx, gz);
        else buildRock(scene, gx, gz, 0.3 + Math.random() * 0.2);
      }
      return; // Skip default cluster logic
    }

    if (i === 1) {
      // ── Jungle Zone: Lush Tropical Rainforest ─────────────────────────────
      const jungleCenter = h.center;
      const jungleRadius = h.radius;

      const isNearEntrance = (angle: number) => {
        let diff = Math.abs(angle - gateAngle);
        while (diff > Math.PI) diff = Math.PI * 2 - diff;
        return diff < 0.28;
      };

      // 1. Outer perimeter canopy wall — broadleaf only (palms removed, were spiky)
      const numOuter = 24 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numOuter; j++) {
        const baseAngle = (j / numOuter) * Math.PI * 2;
        const angle = baseAngle + (Math.random() - 0.5) * 0.28;
        if (isNearEntrance(angle)) continue;
        const distance = jungleRadius * (0.74 + Math.random() * 0.16);
        const x = jungleCenter.x + Math.cos(angle) * distance;
        const z = jungleCenter.z + Math.sin(angle) * distance;
        buildBroadleafTree(scene, x, z, 1.5 + Math.random() * 0.7);
      }

      // 2. Mid-depth broadleaf canopy (10-14 trees)
      const numMid = 10 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numMid; j++) {
        const baseAngle = (j / numMid) * Math.PI * 2;
        const angle = baseAngle + (Math.random() - 0.5) * 0.55;
        if (isNearEntrance(angle)) continue;
        const distance = jungleRadius * (0.46 + Math.random() * 0.24);
        const x = jungleCenter.x + Math.cos(angle) * distance;
        const z = jungleCenter.z + Math.sin(angle) * distance;
        buildBroadleafTree(scene, x, z, 1.2 + Math.random() * 0.5);
      }

      // Interior shade trees (4 broadleaf spread across the clearing)
      const interiorPositions = [
        { dx: -0.28, dz: -0.22, scale: 1.2 },
        { dx:  0.25, dz:  0.18, scale: 1.1 },
        { dx: -0.12, dz:  0.32, scale: 1.3 },
        { dx:  0.20, dz: -0.30, scale: 1.0 },
      ];
      for (const pos of interiorPositions) {
        buildBroadleafTree(scene,
          jungleCenter.x + pos.dx * jungleRadius,
          jungleCenter.z + pos.dz * jungleRadius,
          pos.scale,
        );
      }

      // 3. More undergrowth to fill the space — ferns + monstera
      const numUnder = 35 + Math.floor(Math.random() * 10);
      for (let j = 0; j < numUnder; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = jungleRadius * (0.08 + Math.random() * 0.78);
        const ux = jungleCenter.x + Math.cos(angle) * r;
        const uz = jungleCenter.z + Math.sin(angle) * r;
        if (Math.random() < 0.55) buildJungleFern(scene, ux, uz);
        else buildJungleMonstera(scene, ux, uz);
      }

      // Extra tropical flowers
      const numFlowers = 30 + Math.floor(Math.random() * 10);
      for (let j = 0; j < numFlowers; j++) {
        const fAngle = Math.random() * Math.PI * 2;
        const fDist = jungleRadius * (0.06 + Math.random() * 0.80);
        buildTropicalFlower(scene,
          jungleCenter.x + Math.cos(fAngle) * fDist,
          jungleCenter.z + Math.sin(fAngle) * fDist,
        );
      }

      // 4. Vines hanging between perimeter trees (suspend from top of tree pos)
      const numVines = 8 + Math.floor(Math.random() * 5);
      for (let j = 0; j < numVines; j++) {
        const vAngle = Math.random() * Math.PI * 2;
        if (isNearEntrance(vAngle)) continue;
        const vDist = jungleRadius * (0.62 + Math.random() * 0.28);
        const vx = jungleCenter.x + Math.cos(vAngle) * vDist;
        const vz = jungleCenter.z + Math.sin(vAngle) * vDist;
        buildJungleVine(scene, vx, vz);
      }

      // 5. Flat jungle stream — flush with ground, walkable
      buildJungleStream(scene, jungleCenter);

      // 7. Edge softening — ferns + bushes scattered along the boundary ring
      const numEdge = 18 + Math.floor(Math.random() * 6);
      for (let j = 0; j < numEdge; j++) {
        const eAngle = (j / numEdge) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        if (isNearEntrance(eAngle)) continue;
        // Place right at the boundary (radius 0.90–1.02) to straddle the edge
        const eDist = jungleRadius * (0.88 + Math.random() * 0.16);
        const ex = jungleCenter.x + Math.cos(eAngle) * eDist;
        const ez = jungleCenter.z + Math.sin(eAngle) * eDist;
        if (Math.random() < 0.6) buildJungleFern(scene, ex, ez);
        else buildJungleMonstera(scene, ex, ez);
      }

      return; // Skip default cluster logic
    }

    if (i === 2) {
      // Custom Reptile Zone Scenery
      // 1. Terrain & Water Accent (Water is handled in habitats.ts pad generator)
      
      // 2. Rocks & Basking Slabs
      buildBaskingRocks(scene, h.center.x - 2, h.center.z + 1);
      buildBaskingRocks(scene, h.center.x + h.radius * 0.5, h.center.z + h.radius * 0.4);
      buildBaskingRocks(scene, h.center.x - h.radius * 0.6, h.center.z - h.radius * 0.2);

      // 3. Natural Decor & Hideouts
      buildHollowLog(scene, h.center.x - h.radius * 0.3, h.center.z + h.radius * 0.5, Math.PI / 4);
      buildHollowLog(scene, h.center.x + h.radius * 0.4, h.center.z - h.radius * 0.6, -Math.PI / 6);
      buildHollowLog(scene, h.center.x - h.radius * 0.7, h.center.z + h.radius * 0.1, Math.PI / 2);

      // Arid biome foliage (Cacti, Prickly Pear, Agave, Desert Shrubs)
      for (let j = 0; j < 18; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = h.radius * (0.2 + Math.random() * 0.7);
        const px = h.center.x + Math.cos(angle) * r;
        const pz = h.center.z + Math.sin(angle) * r;
        
        // Ensure plants are not inside the water/mud pool
        const isWater = Math.hypot(px - (h.center.x + 7), pz - (h.center.z + 5)) < (h.radius * 0.22 + 1.5);
        if (isWater) continue;

        const rand = Math.random();
        if (rand < 0.25) buildCactus(scene, px, pz);
        else if (rand < 0.5) buildPricklyPear(scene, px, pz);
        else if (rand < 0.75) buildAgave(scene, px, pz);
        else buildDesertShrub(scene, px, pz);
      }

      // 4. Lighting / Atmosphere (Heat Lamp)
      const heatLamp = new THREE.PointLight(0xffb347, 1.5, 18);
      heatLamp.position.set(h.center.x - 2, 4.0, h.center.z + 1);
      heatLamp.castShadow = true;
      scene.add(heatLamp);

      return; // Skip default cluster logic
    }

    if (i === 3) {
      // ── Aviary: Rich Interior Biome ───────────────────────────────────
      const ac = h.center;

      // 1. Tall snag/deadwood perch trees (reach upper dome so birds have visual roosting targets)
      buildAviarySnagtree(scene, ac.x - 4,  ac.z + 3,  11.5);
      buildAviarySnagtree(scene, ac.x + 6,  ac.z - 5,  13.0);
      buildAviarySnagtree(scene, ac.x - 7,  ac.z - 6,  10.0);

      // 2. Birdbath / water feature near centre
      buildAviaryBirdbath(scene, ac.x + 1.5, ac.z + 1.5);

      // 3. Flat reflective puddle beside birdbath
      buildAviaryPuddle(scene, ac.x - 2.5, ac.z - 1.5);

      // 4. Feeding stations on poles
      buildAviaryFeedingStation(scene, ac.x + h.radius * 0.45, ac.z + h.radius * 0.30);
      buildAviaryFeedingStation(scene, ac.x - h.radius * 0.40, ac.z + h.radius * 0.38);

      // 5. Scattered wildflowers (no collision — walkthrough decals)
      for (let j = 0; j < 28; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = h.radius * (0.08 + Math.random() * 0.75);
        const fx = ac.x + Math.cos(angle) * r;
        const fz = ac.z + Math.sin(angle) * r;
        buildAviaryWildflower(scene, fx, fz);
      }

      // 6. Tall grass tufts scattered across floor
      for (let j = 0; j < 20; j++) {
        const angle = Math.random() * Math.PI * 2;
        const r = h.radius * (0.10 + Math.random() * 0.70);
        const gx = ac.x + Math.cos(angle) * r;
        const gz = ac.z + Math.sin(angle) * r;
        buildAviaryTallGrass(scene, gx, gz);
      }

      // 7. Soft warm point light under the dome apex
      const aviaryLight = new THREE.PointLight(0xfff0d0, 0.9, 40);
      aviaryLight.position.set(ac.x, 10, ac.z);
      scene.add(aviaryLight);

      return; // Skip default cluster logic
    }

    const clusterAngles = [
      gateAngle + Math.PI * 0.52 + 0.1,
      gateAngle + Math.PI * 1.00 - 0.1,
      gateAngle + Math.PI * 1.48 + 0.1,
    ];

    clusterAngles.forEach((cAngle) => {
      const clusterDist = h.radius * 0.72;
      const cx = h.center.x + Math.cos(cAngle) * clusterDist;
      const cz = h.center.z + Math.sin(cAngle) * clusterDist;

      // 1 tree per cluster
      if (i === 3) buildBirchTree(scene, cx, cz);

      // 1 clean bush near cluster
      buildBush(scene, cx + 1.2, cz - 0.8, i);

      // 1 clean rock
      buildRock(scene, cx - 1.0, cz + 1.1, 0.45);
    });
  });
}

// ============================================================================
// GLOBAL VEGETATION — Curated trees, bushes, rocks scattered across open grass
// ============================================================================
function isInsideAnyHabitat(x: number, z: number, margin = 0): boolean {
  return HABITATS.some((h, i) => {
    const r = i === 4 ? 30 : h.radius + margin;
    return Math.hypot(x - h.center.x, z - h.center.z) < r;
  });
}

function isNearPath(x: number, z: number, clearance = 4.5): boolean {
  const spokeAngles = [Math.PI * 1.25, Math.PI * 0.25, Math.PI * -0.25, Math.PI * -1.25];
  for (const ang of spokeAngles) {
    const nx = Math.cos(ang), nz = Math.sin(ang);
    const proj = x * nx + z * nz;
    if (proj < 0) continue;
    const perpDist = Math.hypot(x - proj * nx, z - proj * nz);
    if (perpDist < clearance && proj < 105) return true;
  }
  return false;
}

function buildGlobalVegetation(scene: THREE.Scene): void {
  const tryPlace = (minR: number, maxR: number): [number, number] | null => {
    for (let attempt = 0; attempt < 25; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist  = minR + Math.random() * (maxR - minR);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (isInsideAnyHabitat(x, z, 4)) continue;
      if (isNearPath(x, z, 4.0)) continue;
      if (Math.hypot(x, z) > 112) continue;
      return [x, z];
    }
    return null;
  };

  // --- Curated Scattered Park Trees (30 high-impact trees) ---
  const parkTreeCount = 30;
  for (let i = 0; i < parkTreeCount; i++) {
    const pos = tryPlace(24, 105);
    if (!pos) continue;
    const [x, z] = pos;
    const roll = Math.random();
    if (roll < 0.45) buildBirchTree(scene, x, z);
    else if (roll < 0.75) buildAcaciaTree(scene, x, z);
    else buildJungleTree(scene, x, z);
  }

  // --- Clean Single-Mesh Bushes (24 bushes) ---
  for (let i = 0; i < 24; i++) {
    const pos = tryPlace(22, 105);
    if (!pos) continue;
    buildBush(scene, pos[0], pos[1], i % 4);
  }

  // --- Clean Natural Rocks (14 rocks) ---
  for (let i = 0; i < 14; i++) {
    const pos = tryPlace(22, 105);
    if (!pos) continue;
    buildRock(scene, pos[0], pos[1], 0.45 + Math.random() * 0.45);
  }

  // --- Boundary Lamp Posts (16 lamps without individual shadow maps) ---
  const lampPositions: [number, number][] = [
    [-90, -60], [-90,  60], [90, -60],  [90, 60],
    [-60, -90], [ 60, -90], [-60, 90], [60, 90],
    [-90,   0], [ 90,   0], [  0, -90], [ 0, 90],
    [-75, -75], [ 75, -75], [-75, 75], [75, 75],
  ];
  for (const [lx, lz] of lampPositions) {
    if (isInsideAnyHabitat(lx, lz, 5)) continue;
    // Base plate
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.18, 6), M.lampDarkMat);
    base.position.set(lx, 0.09, lz);
    scene.add(base);
    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.10, 4.8, 6), M.lampMat);
    pole.position.set(lx, 2.58, lz);
    scene.add(pole);
    // Lantern housing
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), M.lampDarkMat);
    housing.position.set(lx + 0.6, 5.0, lz);
    scene.add(housing);
    // Lantern glow inside
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), M.lightMat);
    glow.position.set(lx + 0.6, 5.0, lz);
    scene.add(glow);
  }

  // --- Clean Perimeter Hedgerow Segments ---
  const hedgeRows: Array<{x: number, z: number, axis: 'x'|'z', length: number}> = [
    { x: -100, z: -30, axis: 'z', length: 60 },
    { x:  100, z: -30, axis: 'z', length: 60 },
    { x: -30, z: -100, axis: 'x', length: 60 },
    { x: -30, z:  100, axis: 'x', length: 60 },
  ];
  for (const row of hedgeRows) {
    const steps = Math.floor(row.length / 3.0);
    for (let s = 0; s <= steps; s++) {
      const hx = row.axis === 'x' ? row.x + s * 3.0 : row.x;
      const hz = row.axis === 'z' ? row.z + s * 3.0 : row.z;
      if (isInsideAnyHabitat(hx, hz, 6)) continue;
      if (Math.hypot(hx, hz) > 112) continue;
      const r = 0.85;
      const hedge = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), s % 2 === 0 ? M.hedgeDark : M.hedgeMid);
      hedge.scale.set(1.1, 0.65, 1.1);
      hedge.position.set(hx, r * 0.65, hz);
      scene.add(hedge);
    }
  }
}

// ============================================================================
// TREES & VEGETATION HELPERS (Streamlined Geometry)
// ============================================================================
function buildAcaciaTree(parent: THREE.Object3D, x: number, z: number, scale: number = 1): void {
  const group = new THREE.Group();
  
  // Vary trunk height and canopy width (± 20%)
  const hScale = 0.8 + Math.random() * 0.4;
  const wScale = 0.8 + Math.random() * 0.4;
  const h = (2.8 + Math.random() * 1.0) * hScale;
  
  // Trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.20, h, 6), M.trunk);
  trunk.position.set(0, h / 2, 0);
  trunk.castShadow = true;
  group.add(trunk);
  
  // Umbrella canopy
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1 * wScale, 2.6 * wScale, 0.45 * hScale, 8),
    M.midLeaf,
  );
  canopy.position.set(0, h + 0.2, 0);
  canopy.castShadow = true;
  group.add(canopy);

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  // Random Y-rotation for variance
  group.rotation.y = Math.random() * Math.PI * 2;
  parent.add(group);
}

// ── Tropical Broadleaf Tree ──────────────────────────────────────────────────
function buildBroadleafTree(scene: THREE.Scene, x: number, z: number, scale = 1): void {
  const group = new THREE.Group();
  const h = 4.2 + Math.random() * 1.8;

  // Gently tapering trunk
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, h, 7), JUNGLE_MATS.tropicalTrunk);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // Broad flat-ish layered canopy (wide octahedrons stacked)
  const layers = [
    { rx: 2.8, ry: 1.0, rz: 2.8, y: h + 0.2, mat: JUNGLE_MATS.canopyDark },
    { rx: 2.2, ry: 0.9, rz: 2.2, y: h + 1.1, mat: JUNGLE_MATS.canopyMid },
    { rx: 1.4, ry: 0.8, rz: 1.4, y: h + 2.0, mat: JUNGLE_MATS.canopyLight },
  ];
  for (const l of layers) {
    // 10×7 segments — smooth enough to read as organic foliage
    const geo = new THREE.SphereGeometry(1, 10, 7);
    geo.scale(l.rx, l.ry, l.rz);
    const mesh = new THREE.Mesh(geo, l.mat);
    mesh.position.y = l.y;
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.castShadow = true;
    group.add(mesh);
  }

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

// ── Tall Tropical Palm ───────────────────────────────────────────────────────
function buildTropicalPalm(scene: THREE.Scene, x: number, z: number, scale = 1): void {
  const group = new THREE.Group();
  const h = 6.0 + Math.random() * 2.5;

  // Slightly curved trunk (approximated with a thin cylinder, slight tilt)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 6), JUNGLE_MATS.palmTrunk);
  trunk.position.y = h / 2;
  // X and Z locked to 0 — only the group yaw rotates; mesh lean caused tilting at scale
  trunk.castShadow = true;
  group.add(trunk);

  // Crown: radiating flat leaf blades from top (replaced 4-sided spike cones)
  const frondCount = 7 + Math.floor(Math.random() * 4);
  for (let i = 0; i < frondCount; i++) {
    const frondAngle = (i / frondCount) * Math.PI * 2;
    const frondLen = 2.0 + Math.random() * 0.8;
    // Flat elongated blade: much more natural than a 4-sided cone spike
    const frondGeo = new THREE.BoxGeometry(0.18, frondLen, 0.04);
    const frond = new THREE.Mesh(frondGeo, JUNGLE_MATS.canopyMid);
    frond.position.set(
      Math.cos(frondAngle) * frondLen * 0.40,
      h + frondLen * 0.22,
      Math.sin(frondAngle) * frondLen * 0.40,
    );
    // Tilt outward+downward, face along the radial angle
    frond.rotation.set(0.80, frondAngle + Math.PI / 2, 0, 'YXZ');
    frond.castShadow = true;
    group.add(frond);
  }

  // Round crown centre — more segments = smoother ball
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.60, 10, 8), JUNGLE_MATS.canopyDark);
  centre.position.y = h + 0.35;
  group.add(centre);

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}


// ── Jungle Fern (flat, walkthrough) ─────────────────────────────────────────
function buildJungleFern(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const bladeCount = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < bladeCount; i++) {
    const bAngle = (i / bladeCount) * Math.PI * 2 + Math.random() * 0.3;
    const bLen = 0.7 + Math.random() * 0.6;
    const geo = new THREE.PlaneGeometry(0.28, bLen);
    const blade = new THREE.Mesh(geo, JUNGLE_MATS.fernMat);
    blade.position.set(Math.cos(bAngle) * bLen * 0.38, bLen * 0.3, Math.sin(bAngle) * bLen * 0.38);
    blade.rotation.set(0.5 + Math.random() * 0.3, bAngle, 0, 'YXZ');
    group.add(blade);
  }
  const scale = 0.8 + Math.random() * 0.6;
  group.scale.setScalar(scale);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  // Non-collidable: no castShadow/raycast needed
  scene.add(group);
}

// ── Monstera Leaf (elephant ear, flat, walkthrough) ──────────────────────────
function buildJungleMonstera(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const leafCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < leafCount; i++) {
    const lAngle = (i / leafCount) * Math.PI * 2 + Math.random() * 0.8;
    const lSize = 0.9 + Math.random() * 0.7;
    // Heart-shaped approximation: scaled octahedron disc
    const geo = new THREE.CircleGeometry(lSize, 7);
    const leaf = new THREE.Mesh(geo, JUNGLE_MATS.monsteraMat);
    leaf.position.set(Math.cos(lAngle) * lSize * 0.45, lSize * 0.5, Math.sin(lAngle) * lSize * 0.45);
    leaf.rotation.set(0.6 + Math.random() * 0.4, lAngle, 0, 'YXZ');
    group.add(leaf);
  }
  const scale = 0.7 + Math.random() * 0.5;
  group.scale.setScalar(scale);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

// ── Jungle Vine (hanging rope from above) ────────────────────────────────────
function buildJungleVine(scene: THREE.Scene, x: number, z: number): void {
  const vineHeight = 3.5 + Math.random() * 2.5;
  const segments = 5 + Math.floor(Math.random() * 4);
  const group = new THREE.Group();
  for (let i = 0; i < segments; i++) {
    const segH = vineHeight / segments;
    const swayX = Math.sin((i / segments) * Math.PI) * (0.15 + Math.random() * 0.2);
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, segH, 4),
      JUNGLE_MATS.vineMat,
    );
    seg.position.set(swayX, vineHeight - (i + 0.5) * segH, 0);
    seg.rotation.z = swayX * 0.3;
    group.add(seg);
    // Occasional leaf cluster on vine
    if (i % 2 === 0) {
      const leafGeo = new THREE.SphereGeometry(0.18 + Math.random() * 0.1, 4, 3);
      const leafCluster = new THREE.Mesh(leafGeo, JUNGLE_MATS.fernMat);
      leafCluster.position.set(swayX + (Math.random() - 0.5) * 0.2, vineHeight - i * segH, (Math.random() - 0.5) * 0.15);
      group.add(leafCluster);
    }
  }
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

// ── Tropical Flower Cluster ──────────────────────────────────────────────────
function buildTropicalFlower(scene: THREE.Scene, x: number, z: number): void {
  const flowerMats = [JUNGLE_MATS.flowerRed, JUNGLE_MATS.flowerYellow, JUNGLE_MATS.flowerOrange];
  const mat = flowerMats[Math.floor(Math.random() * flowerMats.length)];
  const count = 2 + Math.floor(Math.random() * 3);
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    // Petal disc
    const petalGeo = new THREE.ConeGeometry(0.18, 0.35, 5);
    const petal = new THREE.Mesh(petalGeo, mat);
    const fAngle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    petal.position.set(Math.cos(fAngle) * 0.25, 0.28, Math.sin(fAngle) * 0.25);
    petal.rotation.set(0.7, fAngle, 0, 'YXZ');
    group.add(petal);
  }
  // Tiny yellow centre
  const centre = new THREE.Mesh(new THREE.SphereGeometry(0.10, 5, 4), JUNGLE_MATS.flowerYellow);
  centre.position.y = 0.32;
  group.add(centre);
  // Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.30, 4), JUNGLE_MATS.vineMat);
  stem.position.y = 0.15;
  group.add(stem);

  const scale = 0.7 + Math.random() * 0.6;
  group.scale.setScalar(scale);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

// ── Flat Jungle Stream (glossy water decal, flush with ground) ───────────────
function buildJungleStream(scene: THREE.Scene, center: { x: number; z: number }): void {
  // A gently curving oval puddle — completely flat (y = 0.01) so animals walk over it
  const streamGroup = new THREE.Group();

  // Main water body: stretched ellipse
  const waterGeo = new THREE.CircleGeometry(1, 12);
  waterGeo.scale(3.5, 1, 1.8);
  const water = new THREE.Mesh(waterGeo, JUNGLE_MATS.streamWater);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.01;
  water.receiveShadow = true;
  streamGroup.add(water);

  // Sheen highlight layer on top
  const sheenGeo = new THREE.CircleGeometry(1, 10);
  sheenGeo.scale(3.2, 1, 1.55);
  const sheen = new THREE.Mesh(sheenGeo, JUNGLE_MATS.streamSheen);
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.025;
  streamGroup.add(sheen);

  // Position: offset from center toward the back of the habitat
  streamGroup.position.set(center.x + 3.5, 0, center.z + 3.0);
  streamGroup.rotation.y = Math.PI / 5 + Math.random() * 0.5;
  scene.add(streamGroup);
}

// ── Legacy builders kept for global vegetation (pine-style kept as fallback) ─
function buildJungleTree(scene: THREE.Scene, x: number, z: number, scale: number = 1): void {
  // Now delegates to the new broadleaf for any legacy callsites (global vegetation)
  buildBroadleafTree(scene, x, z, scale);
}

// Low-poly flat-shaded Dodecahedron bush for Jungle (kept for legacy global veg)
function buildJungleBush(scene: THREE.Scene, x: number, z: number): void {
  const r = 0.6 + Math.random() * 0.4;
  const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), JUNGLE_MATS.undergrowth);
  bush.scale.y = 0.75;
  bush.position.set(x, r * 0.5, z);
  bush.rotation.set(Math.random(), Math.random(), Math.random());
  bush.castShadow = true;
  scene.add(bush);
}

// Low-poly single mesh rock
function buildBirchTree(scene: THREE.Scene, x: number, z: number): void {
  const h = 3.2 + Math.random() * 1.0;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, h, 5), M.birchTrunk);
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(1.6, 7, 5), M.lightLeaf);
  crown.position.set(x, h + 0.6, z);
  crown.castShadow = true;
  scene.add(crown);
}

function buildBush(scene: THREE.Scene, x: number, z: number, habitatIdx: number): void {
  const mats = [M.bushLight, M.bush, M.darkLeaf, M.lightLeaf];
  const bMat = mats[habitatIdx % mats.length];
  const r = 0.55 + Math.random() * 0.35;
  const bush = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), bMat);
  bush.scale.y = 0.75;
  bush.position.set(x, r * 0.5, z);
  bush.rotation.set(Math.random(), Math.random(), Math.random());
  bush.castShadow = true;
  scene.add(bush);
}

function buildCactus(scene: THREE.Scene, x: number, z: number): void {
  const h = 1.6 + Math.random() * 1.0;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, h, 6), M.cactus);
  body.position.set(x, h / 2, z);
  body.castShadow = true;
  scene.add(body);
  for (const side of [-1, 1]) {
    const armH = h * 0.42;
    const arm  = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, armH, 5), M.cactus);
    arm.position.set(x + side * 0.4, h * 0.6, z);
    arm.rotation.z = side * 0.65;
    arm.castShadow = true;
    scene.add(arm);
  }
}


function buildRock(parent: THREE.Object3D, x: number, z: number, scale: number): void {
  const mat = Math.random() > 0.5 ? M.rock : M.rockDark;
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), mat);
  rock.position.set(x, scale * 0.48, z);
  rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.4);
  rock.receiveShadow = true;
  parent.add(rock);
}

function buildSavannaKopje(parent: THREE.Object3D, x: number, z: number): void {
  const group = new THREE.Group();
  const kopjeMat = new THREE.MeshLambertMaterial({ color: 0x9a7b62 }); // sandstone/granite tint
  
  // Primary giant rock
  const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(2.5, 0), kopjeMat);
  mainRock.position.set(0, 1.2, 0);
  mainRock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mainRock.castShadow = true;
  mainRock.receiveShadow = true;
  group.add(mainRock);

  // Companion rocks
  const numCompanions = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numCompanions; i++) {
    const scale = 0.8 + Math.random() * 0.8;
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), kopjeMat);
    const angle = Math.random() * Math.PI * 2;
    const r = 2.0 + Math.random() * 1.5;
    boulder.position.set(Math.cos(angle) * r, scale * 0.4, Math.sin(angle) * r);
    boulder.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    group.add(boulder);
  }

  // Dry grass tufts around the base
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 2.8 + Math.random() * 1.5;
    buildDryGrass(group, Math.cos(angle) * r, Math.sin(angle) * r);
  }
  
  group.position.set(x, 0, z);
  parent.add(group);
}

function buildDryGrass(parent: THREE.Object3D, x: number, z: number): void {
  const tuftGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
  const tuftMat = new THREE.MeshLambertMaterial({ color: 0xccb266 });
  const numBlades = 3 + Math.floor(Math.random() * 3);
  
  const group = new THREE.Group();
  for (let i = 0; i < numBlades; i++) {
    const blade = new THREE.Mesh(tuftGeo, tuftMat);
    blade.rotation.x = (Math.random() - 0.5) * 0.4;
    blade.rotation.z = (Math.random() - 0.5) * 0.4;
    blade.rotation.y = Math.random() * Math.PI;
    blade.position.set((Math.random() - 0.5) * 0.2, 0.3, (Math.random() - 0.5) * 0.2);
    group.add(blade);
  }
  
  group.position.set(x, 0, z);
  parent.add(group);
}

// ============================================================================
// CLOUDS — slow-drifting flat spheres high in the sky
// ============================================================================
export function buildClouds(scene: THREE.Scene): void {
  for (let i = 0; i < 8; i++) {
    const cx  = (Math.random() - 0.5) * 180;
    const cz  = (Math.random() - 0.5) * 180;
    const cy  = 28 + Math.random() * 12;
    const grp = new THREE.Group();
    grp.position.set(cx, cy, cz);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < n; b++) {
      const blob = new THREE.Mesh(
        new THREE.SphereGeometry(2.0 + Math.random() * 1.5, 6, 4),
        M.cloudMat,
      );
      blob.position.set(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 2.5,
      );
      blob.scale.y = 0.45;
      grp.add(blob);
    }
    grp.userData['drift'] = (Math.random() - 0.5) * 0.0015;
    scene.add(grp);
  }
}

// ============================================================================
// BUTTERFLIES (Preserved export signature)
// ============================================================================
export function buildButterflies(_scene: THREE.Scene): THREE.Object3D[] {
  return [];
}

// ============================================================================
// REPTILE ZONE CUSTOM SCENERY
// ============================================================================
export function buildBaskingRocks(parent: THREE.Object3D, x: number, z: number): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI;

  // Base sandstone boulders
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.5, 1);
    geo.scale(1, 0.6 + Math.random() * 0.4, 1);
    const mesh = new THREE.Mesh(geo, M.sandstone);
    mesh.position.set((Math.random() - 0.5) * 1.5, 0.2, (Math.random() - 0.5) * 1.5);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Flat basking slab on top
  const slabGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.3, 7);
  slabGeo.scale(1, 1, 1.5);
  const slab = new THREE.Mesh(slabGeo, M.sandstone);
  slab.position.set(0, 0.6 + Math.random() * 0.3, 0);
  slab.rotation.x = (Math.random() - 0.5) * 0.2;
  slab.rotation.z = (Math.random() - 0.5) * 0.2;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  parent.add(group);
}

export function buildHollowLog(parent: THREE.Object3D, x: number, z: number, angle: number): void {
  const geo = new THREE.CylinderGeometry(0.4, 0.5, 2.8, 8, 1, true);
  const mat = M.deadwood.clone();
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, 0.3, z);
  mesh.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.2, angle, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

export function buildPricklyPear(parent: THREE.Object3D, x: number, z: number): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;

  const numPads = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numPads; i++) {
    const padGeo = new THREE.CylinderGeometry(0.3, 0.2, 0.1, 8);
    padGeo.scale(1, 1, 1.5);
    padGeo.rotateX(Math.PI / 2);
    const pad = new THREE.Mesh(padGeo, M.cactusLight);
    
    pad.position.set((Math.random() - 0.5) * 0.5, 0.2 + i * 0.3, (Math.random() - 0.5) * 0.2);
    pad.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    pad.castShadow = true;
    group.add(pad);
  }
  parent.add(group);
}

export function buildAgave(parent: THREE.Object3D, x: number, z: number): void {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const numLeaves = 8 + Math.floor(Math.random() * 6);
  for (let i = 0; i < numLeaves; i++) {
    const geo = new THREE.ConeGeometry(0.1, 0.8, 4);
    geo.translate(0, 0.4, 0);
    const leaf = new THREE.Mesh(geo, M.agave);
    
    const angle = (i / numLeaves) * Math.PI * 2 + Math.random() * 0.2;
    const tilt = 0.3 + (i / numLeaves) * 0.8;
    
    leaf.rotation.set(tilt, angle, 0, 'YXZ');
    leaf.position.y = 0.05;
    leaf.castShadow = true;
    group.add(leaf);
  }
  parent.add(group);
}

// ── AVIARY PROP BUILDERS ──────────────────────────────────────────────────────────────────────────
const AVIARY_MATS = {
  deadwood:    new THREE.MeshLambertMaterial({ color: 0x8b6248 }),
  deadBark:    new THREE.MeshLambertMaterial({ color: 0x6e4e30 }),
  stone:       new THREE.MeshLambertMaterial({ color: 0xa89880 }),
  stoneDark:   new THREE.MeshLambertMaterial({ color: 0x8a7a68 }),
  water:       new THREE.MeshStandardMaterial({ color: 0x5bb8d0, transparent: true, opacity: 0.75, roughness: 0.03, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  waterSheen:  new THREE.MeshBasicMaterial({ color: 0xaaddee, transparent: true, opacity: 0.22, depthWrite: false }),
  wood:        new THREE.MeshLambertMaterial({ color: 0xb07840 }),
  woodDark:    new THREE.MeshLambertMaterial({ color: 0x8a5a28 }),
  flowerRed:   new THREE.MeshLambertMaterial({ color: 0xe83030 }),
  flowerPink:  new THREE.MeshLambertMaterial({ color: 0xf070a0 }),
  flowerYellow:new THREE.MeshLambertMaterial({ color: 0xf8c030 }),
  flowerPurple:new THREE.MeshLambertMaterial({ color: 0xa040d0 }),
  grassTuft:   new THREE.MeshLambertMaterial({ color: 0x6ab040, side: THREE.DoubleSide }),
  stem:        new THREE.MeshLambertMaterial({ color: 0x5a8830 }),
};

/** Tall dead snag tree — main visual perch for flying birds */
function buildAviarySnagtree(scene: THREE.Scene, x: number, z: number, height: number): void {
  const group = new THREE.Group();

  // Main trunk — tapers toward top
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.32, height, 7),
    AVIARY_MATS.deadwood,
  );
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  group.add(trunk);

  // 3–5 branching arms at varying heights
  const branchCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < branchCount; i++) {
    const bFrac = 0.45 + (i / branchCount) * 0.48; // 45–93% up the trunk
    const bLen  = 1.4 + Math.random() * 1.6;
    const bAngle = Math.random() * Math.PI * 2;
    const bTilt  = 0.30 + Math.random() * 0.35; // upward angle

    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.10, bLen, 5),
      AVIARY_MATS.deadBark,
    );
    branch.position.set(
      Math.cos(bAngle) * bLen * 0.42,
      height * bFrac + Math.sin(bTilt) * bLen * 0.3,
      Math.sin(bAngle) * bLen * 0.42,
    );
    branch.rotation.set(-bTilt, bAngle, 0, 'YXZ');
    branch.castShadow = true;
    group.add(branch);

    // Sub-branch fork
    if (Math.random() < 0.5) {
      const subLen = bLen * 0.55;
      const sub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.05, subLen, 4),
        AVIARY_MATS.deadBark,
      );
      sub.position.set(
        Math.cos(bAngle + 0.8) * (bLen * 0.42 + subLen * 0.3),
        height * bFrac + Math.sin(bTilt) * bLen * 0.3 + subLen * 0.3,
        Math.sin(bAngle + 0.8) * (bLen * 0.42 + subLen * 0.3),
      );
      sub.rotation.set(-(bTilt * 0.7), bAngle + 0.8, 0, 'YXZ');
      group.add(sub);
    }
  }

  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

/** Wildflower — small colourful walkthrough decal */
function buildAviaryWildflower(scene: THREE.Scene, x: number, z: number): void {
  const mats = [AVIARY_MATS.flowerRed, AVIARY_MATS.flowerPink, AVIARY_MATS.flowerYellow, AVIARY_MATS.flowerPurple];
  const mat = mats[Math.floor(Math.random() * mats.length)];
  const group = new THREE.Group();

  const stemH = 0.28 + Math.random() * 0.18;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, stemH, 4), AVIARY_MATS.stem);
  stem.position.y = stemH / 2;
  group.add(stem);

  // Simple disc head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.10 + Math.random() * 0.06, 6, 5), mat);
  head.position.y = stemH + 0.06;
  head.scale.y = 0.55;
  group.add(head);

  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, stemH * 0.8, 4), AVIARY_MATS.stem);
    s2.position.set((Math.random() - 0.5) * 0.22, stemH * 0.4, (Math.random() - 0.5) * 0.22);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), mats[Math.floor(Math.random() * mats.length)]);
    h2.position.y = stemH * 0.8;
    h2.scale.y = 0.55;
    s2.add(h2);
    group.add(s2);
  }

  group.scale.setScalar(0.8 + Math.random() * 0.5);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  // No castShadow — walkthrough decal
  scene.add(group);
}

/** Tall grass tuft — walkthrough, flat */
function buildAviaryTallGrass(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const bladeCount = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < bladeCount; i++) {
    const bAngle = (i / bladeCount) * Math.PI * 2 + Math.random() * 0.4;
    const bH = 0.45 + Math.random() * 0.55;
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.08, bH), AVIARY_MATS.grassTuft);
    blade.position.set(Math.cos(bAngle) * 0.12, bH / 2, Math.sin(bAngle) * 0.12);
    blade.rotation.set(0.15, bAngle, 0, 'YXZ');
    group.add(blade);
  }
  group.scale.setScalar(0.9 + Math.random() * 0.5);
  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

/** Stone birdbath on a pedestal */
function buildAviaryBirdbath(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();

  // Pedestal base disc
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.40, 0.14, 10), AVIARY_MATS.stoneDark);
  base.position.y = 0.07;
  base.castShadow = true;
  group.add(base);

  // Slender column
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.80, 8), AVIARY_MATS.stone);
  column.position.y = 0.14 + 0.40;
  column.castShadow = true;
  group.add(column);

  // Wide shallow basin
  const basinGeo = new THREE.CylinderGeometry(0.55, 0.42, 0.16, 12);
  const basin = new THREE.Mesh(basinGeo, AVIARY_MATS.stone);
  basin.position.y = 0.14 + 0.80 + 0.08;
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  // Water surface in bowl
  const waterGeo = new THREE.CircleGeometry(0.44, 10);
  const water = new THREE.Mesh(waterGeo, AVIARY_MATS.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.14 + 0.80 + 0.16 + 0.01;
  group.add(water);

  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

/** Flat reflective puddle on the ground */
function buildAviaryPuddle(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  const geo = new THREE.CircleGeometry(1, 10);
  geo.scale(1.6, 1, 1.2);
  const water = new THREE.Mesh(geo, AVIARY_MATS.water);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.01;
  group.add(water);

  const sheenGeo = new THREE.CircleGeometry(1, 8);
  sheenGeo.scale(1.4, 1, 1.0);
  const sheen = new THREE.Mesh(sheenGeo, AVIARY_MATS.waterSheen);
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = 0.025;
  group.add(sheen);

  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI;
  scene.add(group);
}

/** Wooden feeding platform on a pole */
function buildAviaryFeedingStation(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();

  // Pole
  const poleH = 2.2 + Math.random() * 0.6;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, poleH, 6), AVIARY_MATS.woodDark);
  pole.position.y = poleH / 2;
  pole.castShadow = true;
  group.add(pole);

  // Platform tray
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.85), AVIARY_MATS.wood);
  tray.position.y = poleH + 0.04;
  tray.castShadow = true;
  tray.receiveShadow = true;
  group.add(tray);

  // Small roof / awning above tray
  const roofGeo = new THREE.ConeGeometry(0.58, 0.45, 6);
  const roof = new THREE.Mesh(roofGeo, AVIARY_MATS.woodDark);
  roof.position.y = poleH + 0.08 + 0.28;
  roof.castShadow = true;
  group.add(roof);

  // Seed pellets scattered on tray (tiny spheres)
  for (let i = 0; i < 6; i++) {
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 4, 3),
      AVIARY_MATS.woodDark,
    );
    seed.position.set(
      (Math.random() - 0.5) * 0.55,
      poleH + 0.10,
      (Math.random() - 0.5) * 0.55,
    );
    group.add(seed);
  }

  group.position.set(x, 0, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  scene.add(group);
}

export function buildDesertShrub(parent: THREE.Object3D, x: number, z: number): void {
  const geo = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.3, 0);
  geo.scale(1, 0.6, 1);
  const mesh = new THREE.Mesh(geo, M.deadwood);
  mesh.position.set(x, 0.25, z);
  mesh.rotation.set(Math.random(), Math.random(), Math.random());
  mesh.castShadow = true;
  parent.add(mesh);
}

// ── VISITOR INFRASTRUCTURE BUILDERS ──────────────────────────────────────────────────────────────

const VISITOR_MATS = {
  wood: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  metal: new THREE.MeshLambertMaterial({ color: 0x555555 }),
  white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  red: new THREE.MeshLambertMaterial({ color: 0xcc3333 }),
  blue: new THREE.MeshLambertMaterial({ color: 0x3366cc }),
  trash: new THREE.MeshLambertMaterial({ color: 0x222222 }),
  hedge: new THREE.MeshLambertMaterial({ color: 0x3a5f2b }),
  flower1: new THREE.MeshLambertMaterial({ color: 0xff5555 }),
  flower2: new THREE.MeshLambertMaterial({ color: 0xffff55 }),
};

export function buildParkBench(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 0.6), VISITOR_MATS.wood);
  seat.position.set(0, 0.45, 0);
  seat.castShadow = true;
  group.add(seat);
  
  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.1), VISITOR_MATS.wood);
  back.position.set(0, 0.8, -0.3);
  back.rotation.x = -0.1;
  back.castShadow = true;
  group.add(back);
  
  // Legs (metal)
  const legGeo = new THREE.BoxGeometry(0.1, 0.45, 0.6);
  const legL = new THREE.Mesh(legGeo, VISITOR_MATS.metal);
  legL.position.set(-0.9, 0.225, 0);
  legL.castShadow = true;
  group.add(legL);
  
  const legR = new THREE.Mesh(legGeo, VISITOR_MATS.metal);
  legR.position.set(0.9, 0.225, 0);
  legR.castShadow = true;
  group.add(legR);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

export function buildTrashCan(scene: THREE.Scene, x: number, z: number): void {
  const group = new THREE.Group();
  
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.9, 8), VISITOR_MATS.trash);
  can.position.y = 0.45;
  can.castShadow = true;
  group.add(can);
  
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 8), VISITOR_MATS.metal);
  lid.position.y = 0.95;
  lid.castShadow = true;
  group.add(lid);

  group.position.set(x, 0, z);
  scene.add(group);
}

export function buildPicnicTable(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  
  // Table top
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.2), VISITOR_MATS.wood);
  table.position.y = 0.8;
  table.castShadow = true;
  group.add(table);
  
  // Benches
  const benchGeo = new THREE.BoxGeometry(2.2, 0.1, 0.4);
  const bench1 = new THREE.Mesh(benchGeo, VISITOR_MATS.wood);
  bench1.position.set(0, 0.45, 0.9);
  bench1.castShadow = true;
  group.add(bench1);
  
  const bench2 = new THREE.Mesh(benchGeo, VISITOR_MATS.wood);
  bench2.position.set(0, 0.45, -0.9);
  bench2.castShadow = true;
  group.add(bench2);

  // Legs / Frame (simplified A-frame)
  const frameGeo = new THREE.BoxGeometry(1.6, 0.8, 0.1);
  const frameL = new THREE.Mesh(frameGeo, VISITOR_MATS.metal);
  frameL.position.set(-0.9, 0.4, 0);
  frameL.rotation.y = Math.PI / 2;
  frameL.castShadow = true;
  group.add(frameL);
  
  const frameR = new THREE.Mesh(frameGeo, VISITOR_MATS.metal);
  frameR.position.set(0.9, 0.4, 0);
  frameR.rotation.y = Math.PI / 2;
  frameR.castShadow = true;
  group.add(frameR);
  
  // Umbrella
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 6), VISITOR_MATS.metal);
  pole.position.y = 1.25;
  pole.castShadow = true;
  group.add(pole);
  
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.6, 8), Math.random() > 0.5 ? VISITOR_MATS.red : VISITOR_MATS.blue);
  canopy.position.y = 2.5;
  canopy.castShadow = true;
  group.add(canopy);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

export function buildFoodStall(scene: THREE.Scene, x: number, z: number, rotation: number): void {
  const group = new THREE.Group();
  
  // Cart body
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.4), VISITOR_MATS.white);
  body.position.y = 0.5;
  body.castShadow = true;
  group.add(body);
  
  // Counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), VISITOR_MATS.metal);
  counter.position.y = 1.05;
  counter.castShadow = true;
  group.add(counter);
  
  // Awning posts
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4);
  const p1 = new THREE.Mesh(postGeo, VISITOR_MATS.metal); p1.position.set(-1.1, 1.8, -0.6); group.add(p1);
  const p2 = new THREE.Mesh(postGeo, VISITOR_MATS.metal); p2.position.set(1.1, 1.8, -0.6); group.add(p2);
  const p3 = new THREE.Mesh(postGeo, VISITOR_MATS.metal); p3.position.set(-1.1, 1.8, 0.6); group.add(p3);
  const p4 = new THREE.Mesh(postGeo, VISITOR_MATS.metal); p4.position.set(1.1, 1.8, 0.6); group.add(p4);
  
  // Awning (striped if possible, solid for now)
  const isHotDog = Math.random() > 0.5;
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 1.6), isHotDog ? VISITOR_MATS.red : VISITOR_MATS.blue);
  awning.position.set(0, 2.6, 0);
  awning.castShadow = true;
  group.add(awning);
  
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const w1 = new THREE.Mesh(wheelGeo, VISITOR_MATS.trash); w1.position.set(-0.8, 0.3, 0.75); group.add(w1);
  const w2 = new THREE.Mesh(wheelGeo, VISITOR_MATS.trash); w2.position.set(0.8, 0.3, 0.75); group.add(w2);

  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  scene.add(group);
}

export function buildHedge(scene: THREE.Scene, x: number, z: number, length: number, rotation: number): void {
  const hedge = new THREE.Mesh(new THREE.BoxGeometry(length, 1.2, 0.8), VISITOR_MATS.hedge);
  hedge.position.set(x, 0.6, z);
  hedge.rotation.y = rotation;
  hedge.castShadow = true;
  scene.add(hedge);
}

export function buildStructuredFlowerBed(scene: THREE.Scene, x: number, z: number, length: number, width: number): void {
  const group = new THREE.Group();
  
  // Soil base
  const base = new THREE.Mesh(new THREE.BoxGeometry(length, 0.1, width), new THREE.MeshLambertMaterial({ color: 0x3d2817 }));
  base.position.y = 0.05;
  group.add(base);
  
  // Flowers (dense grid)
  const rows = Math.floor(width / 0.4);
  const cols = Math.floor(length / 0.4);
  const flowerMat = Math.random() > 0.5 ? VISITOR_MATS.flower1 : VISITOR_MATS.flower2;
  const flowerGeo = new THREE.DodecahedronGeometry(0.15, 0);
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = -length/2 + 0.2 + c * 0.4 + (Math.random() - 0.5) * 0.1;
      const pz = -width/2 + 0.2 + r * 0.4 + (Math.random() - 0.5) * 0.1;
      const flower = new THREE.Mesh(flowerGeo, flowerMat);
      flower.position.set(px, 0.15 + Math.random() * 0.1, pz);
      flower.rotation.set(Math.random(), Math.random(), Math.random());
      group.add(flower);
    }
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
}
