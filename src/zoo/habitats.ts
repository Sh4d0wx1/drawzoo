import * as THREE from 'three';
import type { Habitat } from './types';

export const HABITATS: Habitat[] = [
  {
    name: 'Savanna',
    center: new THREE.Vector3(-48, 0, -48),
    radius: 37,
    groundColor: 0xd6b77a, // Warm golden-tan hue (#d6b77a)
    accentColor: 0xcbb074,
  },
  {
    name: 'Jungle',
    center: new THREE.Vector3(48, 0, -48),
    radius: 37,
    groundColor: 0x3d6b2a, // Rich olive-mossy green — lightened so animals contrast well
    accentColor: 0x2e5220,
  },
  {
    name: 'Reptile Zone',
    center: new THREE.Vector3(48, 0, 48),
    radius: 30,
    groundColor: 0x9b7653, // Warm earthy clay/dry loam (#9b7653)
    accentColor: 0x866342,
  },
  {
    name: 'Aviary',
    center: new THREE.Vector3(-48, 0, 48),
    radius: 30,
    groundColor: 0x7ba652, // Soft natural pasture green (#7ba652)
    accentColor: 0x699042,
  },
  {
    name: 'Aquatic Zone',
    center: new THREE.Vector3(0, 0, 0),
    radius: 26,
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
export function smoothNoise(x: number, z: number): number {
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
  HABITATS.forEach((h) => {
    if (h.name === 'Aquatic Zone') {
      buildAquaticBasin(scene, h);
    } else {
      buildHabitatPad(scene, h);
      buildEdgeBerm(scene, h);
      buildBiomeMetalGate(scene, h);
      // Strictly restrict cage/dome mesh to Aviary; Savanna, Jungle, Reptile Zone remain open-air
      if (h.name === 'Aviary') {
        buildAviaryCage(scene, h);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Aquatic Basin — sunken cylinder tank with dark blue walls and floor disc
// ---------------------------------------------------------------------------
function buildAquaticBasin(scene: THREE.Scene, h: Habitat): void {
  const segs = 64;
  const radius = 25.5;
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
  floorMesh.userData = { habitatName: h.name };
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
  rimMesh.userData = { habitatName: h.name };
  rimMesh.receiveShadow = true;
  rimMesh.castShadow = true;
  scene.add(rimMesh);
}

// ---------------------------------------------------------------------------
// Main ground — true hole cutout at center (0,0) so terrain never clips through the pond
// ---------------------------------------------------------------------------
function buildMainGround(scene: THREE.Scene): void {
  const size = 260;
  const half = size / 2;
  const poolR = 25.5;

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
  const borderSize = 340;
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
// Habitat pad — clean, unified circular biome floor
// ---------------------------------------------------------------------------
function buildHabitatPad(scene: THREE.Scene, h: Habitat): void {
  const segs = 80;
  const geo  = new THREE.CircleGeometry(h.radius, segs);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshLambertMaterial({ color: h.groundColor, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(h.center.x, 0.01, h.center.z);
  mesh.userData = { habitatName: h.name };
  mesh.receiveShadow = true;
  scene.add(mesh);

  if (h.name === 'Savanna' || h.name === 'Reptile Zone') {
    const isReptile = h.name === 'Reptile Zone';
    const holeRadius = h.radius * (isReptile ? 0.22 : 0.28);
    
    // Off-center toward a quadrant
    const hx = h.center.x + (isReptile ? 7 : -8);
    const hz = h.center.z + (isReptile ? 5 : -8);

    const holeGeo = new THREE.CircleGeometry(holeRadius, 48);
    holeGeo.rotateX(-Math.PI / 2);
    
    // Water
    const waterMat = new THREE.MeshStandardMaterial({ 
      color: isReptile ? 0x1188aa : 0x00a8cc, 
      transparent: true, 
      opacity: 0.8, 
      roughness: 0.05, 
      metalness: 0.1,
      depthWrite: false, 
      side: THREE.DoubleSide 
    });
    const waterMesh = new THREE.Mesh(holeGeo, waterMat);
    waterMesh.position.set(hx, 0.02, hz);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // Organic Mud Rim
    const rimGeo = new THREE.RingGeometry(holeRadius - 0.3, holeRadius + 1.2, 48, 2);
    rimGeo.rotateX(-Math.PI / 2);
    const posAttr = rimGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.hypot(vx, vz);
      if (dist > holeRadius) {
        // Deform outer edge
        const angle = Math.atan2(vz, vx);
        const noise = Math.sin(angle * 6) * 0.3 + Math.cos(angle * 13) * 0.2;
        posAttr.setX(i, vx + Math.cos(angle) * noise);
        posAttr.setZ(i, vz + Math.sin(angle) * noise);
      }
    }
    rimGeo.computeVertexNormals();
    const rimMat = new THREE.MeshLambertMaterial({ 
      color: isReptile ? 0xa88d5e : 0x5a4329, 
      side: THREE.DoubleSide 
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.set(hx, 0.015, hz);
    rimMesh.receiveShadow = true;
    scene.add(rimMesh);
  }

  // Inner decorative accent ring — subtle darker hue just inside the berm
  const ringGeo = new THREE.RingGeometry(h.radius * 0.85, h.radius * 0.92, segs);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshLambertMaterial({
    color: h.accentColor,
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0.35,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(h.center.x, 0.02, h.center.z);
  ring.receiveShadow = true;
  scene.add(ring);
}

// ---------------------------------------------------------------------------
// Edge berm — a polished double-ring border around each habitat
// ---------------------------------------------------------------------------
function buildEdgeBerm(scene: THREE.Scene, h: Habitat): void {
  const segs = 64;
  // Outer torus ring
  const outerGeo = new THREE.TorusGeometry(h.radius - 0.3, 0.32, 6, segs);
  const outerMat = new THREE.MeshLambertMaterial({ color: h.accentColor });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.rotation.x = Math.PI / 2;
  outer.position.set(h.center.x, 0.18, h.center.z);
  outer.receiveShadow = true;
  outer.castShadow = true;
  scene.add(outer);
  // Inner thinner accent torus
  const innerGeo = new THREE.TorusGeometry(h.radius - 1.2, 0.12, 5, segs);
  const innerMat = new THREE.MeshLambertMaterial({ color: h.groundColor });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.rotation.x = Math.PI / 2;
  inner.position.set(h.center.x, 0.10, h.center.z);
  inner.receiveShadow = true;
  scene.add(inner);
}

// ---------------------------------------------------------------------------
// Small Metal Gates at Biome Entrances (Wrought-iron finish, oriented along radial path)
// ---------------------------------------------------------------------------
function buildBiomeMetalGate(scene: THREE.Scene, h: Habitat): void {
  // Determine direction from habitat center to zoo center (0,0,0)
  const toCenter = new THREE.Vector2(-h.center.x, -h.center.z).normalize();
  const gateDist = h.radius + 0.3;
  const gx = h.center.x + toCenter.x * gateDist;
  const gz = h.center.z + toCenter.y * gateDist;

  // Gate orientation: automatically faces along the radial pathway connecting center reservoir to biome
  const angle = Math.atan2(toCenter.x, toCenter.y);

  const gateGroup = new THREE.Group();
  gateGroup.position.set(gx, 0, gz);
  gateGroup.rotation.y = angle;

  // Dark metallic finish: MeshStandardMaterial (roughness: 0.3, metalness: 0.85, color #2b2d42)
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x2b2d42,
    roughness: 0.3,
    metalness: 0.85,
  });
  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1c29,
    roughness: 0.25,
    metalness: 0.9,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.25,
    metalness: 0.85,
  });

  const gateWidth = 2.4;
  const gateH = 1.55;
  const postRadius = 0.07;

  // 1. Two gate posts on the sides
  for (const side of [-1, 1]) {
    const px = side * (gateWidth / 2);
    // Base plate
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.24), metalTrimMat);
    base.position.set(px, 0.04, 0);
    base.castShadow = true;
    gateGroup.add(base);

    // Main post column
    const post = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius * 1.15, gateH, 8), metalMat);
    post.position.set(px, gateH / 2, 0);
    post.castShadow = true;
    gateGroup.add(post);

    // Post collar ring
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.25, postRadius * 1.25, 0.06, 8), metalTrimMat);
    collar.position.set(px, gateH - 0.04, 0);
    gateGroup.add(collar);

    // Post top sphere finial
    const finial = new THREE.Mesh(new THREE.SphereGeometry(postRadius * 1.35, 8, 6), metalTrimMat);
    finial.position.set(px, gateH + 0.08, 0);
    finial.castShadow = true;
    gateGroup.add(finial);
  }

  // 2. Dual gate panels / leaves with horizontal & vertical bars
  const leafW = (gateWidth - postRadius * 4) / 2;
  for (const side of [-1, 1]) {
    const leafGroup = new THREE.Group();
    leafGroup.position.set(side * (gateWidth / 2 - postRadius), 0, 0);
    // Welcoming entry angle (swings slightly inward towards habitat: ~12 degrees)
    leafGroup.rotation.y = side * 0.22;

    const innerLeafX = -side * (leafW / 2);

    // Top horizontal bar
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, leafW, 6), metalMat);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(innerLeafX, gateH - 0.18, 0);
    topBar.castShadow = true;
    leafGroup.add(topBar);

    // Bottom horizontal bar
    const botBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, leafW, 6), metalMat);
    botBar.rotation.z = Math.PI / 2;
    botBar.position.set(innerLeafX, 0.20, 0);
    botBar.castShadow = true;
    leafGroup.add(botBar);

    // Mid horizontal bar
    const midBar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, leafW, 6), metalMat);
    midBar.rotation.z = Math.PI / 2;
    midBar.position.set(innerLeafX, 0.75, 0);
    midBar.castShadow = true;
    leafGroup.add(midBar);

    // Vertical pickets / bars
    const picketCount = 3;
    for (let p = 0; p <= picketCount; p++) {
      const px = -side * (p / picketCount) * (leafW - 0.06) - side * 0.03;
      const barH = gateH - 0.36;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, barH, 5), metalMat);
      bar.position.set(px, 0.20 + barH / 2, 0);
      bar.castShadow = true;
      leafGroup.add(bar);

      // Spear finial tip on top of each picket
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 5), brassMat);
      tip.position.set(px, gateH - 0.18 + 0.035, 0);
      leafGroup.add(tip);
    }

    // Center latch handle
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), brassMat);
    latch.position.set(-side * leafW, 0.75, 0);
    leafGroup.add(latch);

    gateGroup.add(leafGroup);
  }

  // 3. Sleek metal habitat header plaque between posts
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.05), metalTrimMat);
  plaque.position.set(0, gateH + 0.10, 0);
  plaque.userData = { habitatName: h.name };
  plaque.castShadow = true;
  gateGroup.add(plaque);

  scene.add(gateGroup);
}

// ---------------------------------------------------------------------------
// Aviary Dome Cage (Restricted strictly to Aviary biome)
// ---------------------------------------------------------------------------
function buildAviaryCage(scene: THREE.Scene, h: Habitat): void {
  const cageGroup = new THREE.Group();
  cageGroup.position.set(h.center.x, 0, h.center.z);

  const radius = h.radius;
  const cageMat = new THREE.MeshStandardMaterial({
    color: 0x334155, // Dark slate wrought-iron finish
    roughness: 0.35,
    metalness: 0.85,
  });

  // 1. Semi-transparent woven aviary wireframe netting
  const netGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const netMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    wireframe: true,
    transparent: true,
    opacity: 0.24,
    roughness: 0.4,
    metalness: 0.8,
    depthWrite: false,
  });
  const netMesh = new THREE.Mesh(netGeo, netMat);
  cageGroup.add(netMesh);

  // Subtle sunlit mesh membrane
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.07,
    roughness: 0.2,
    metalness: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const skinMesh = new THREE.Mesh(netGeo, skinMat);
  cageGroup.add(skinMesh);

  // 2. Heavy structural ground perimeter ring
  const groundRingGeo = new THREE.TorusGeometry(radius, 0.16, 6, 48);
  groundRingGeo.rotateX(Math.PI / 2);
  const groundRing = new THREE.Mesh(groundRingGeo, cageMat);
  groundRing.position.y = 0.12;
  groundRing.receiveShadow = true;
  cageGroup.add(groundRing);

  // 3. Structural meridian arches (8 arches crossing over the apex)
  const archCount = 8;
  for (let i = 0; i < archCount; i++) {
    const archGeo = new THREE.TorusGeometry(radius, 0.08, 5, 32, Math.PI);
    const arch = new THREE.Mesh(archGeo, cageMat);
    arch.rotation.y = (i / archCount) * Math.PI;
    cageGroup.add(arch);
  }

  // 4. Horizontal structural latitude rings at 30° and 60°
  const latAngles = [Math.PI / 6, Math.PI / 3];
  latAngles.forEach((ang) => {
    const latRadius = radius * Math.cos(ang);
    const latHeight = radius * Math.sin(ang);
    const latGeo = new THREE.TorusGeometry(latRadius, 0.065, 5, 36);
    latGeo.rotateX(Math.PI / 2);
    const latRing = new THREE.Mesh(latGeo, cageMat);
    latRing.position.y = latHeight;
    cageGroup.add(latRing);
  });

  // 5. Apex cap & finial
  const apexCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.50, 0.25, 12),
    cageMat,
  );
  apexCap.position.y = radius;
  cageGroup.add(apexCap);

  const apexFinial = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.9, 8),
    cageMat,
  );
  apexFinial.position.y = radius + 0.55;
  cageGroup.add(apexFinial);

  scene.add(cageGroup);
}

// ---------------------------------------------------------------------------
// Floating 3D Habitat Billboard Labels (THREE.Sprite)
// ---------------------------------------------------------------------------
export interface HabitatLabelConfig {
  name: string;
  label: string;
  position: THREE.Vector3;
}

export const HABITAT_LABELS_CONFIG: HabitatLabelConfig[] = [
  {
    name: 'Savanna',
    label: '🦁 SAVANNA',
    position: new THREE.Vector3(-48, 16.0, -48),
  },
  {
    name: 'Jungle',
    label: '🌴 JUNGLE',
    position: new THREE.Vector3(48, 16.0, -48),
  },
  {
    name: 'Reptile Zone',
    label: '🐍 REPTILE ZONE',
    position: new THREE.Vector3(48, 14.0, 48),
  },
  {
    name: 'Aviary',
    label: '🦜 AVIARY',
    position: new THREE.Vector3(-48, 34.0, 48),
  },
  {
    name: 'Aquatic Zone',
    label: '🦈 AQUATIC ZONE',
    position: new THREE.Vector3(0, 11.0, 0),
  },
];

function createHabitatBadgeTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const w = canvas.width;
  const h = canvas.height;
  const pad = 8;
  const pillX = pad;
  const pillY = pad;
  const pillW = w - pad * 2;
  const pillH = h - pad * 2;
  const radius = pillH / 2;

  // Background pill path
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pillX, pillY, pillW, pillH, radius);
  } else {
    ctx.arc(pillX + radius, pillY + radius, radius, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.arc(pillX + pillW - radius, pillY + radius, radius, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
  }

  // Dark semi-transparent slate gradient background matching app theme (#0f172ab3)
  const grad = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillH);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.88)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.72)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle cyan/blue accent border (#38bdf8) with soft neon glow
  ctx.save();
  ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // Subtle inner highlight ring for glassmorphism
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pillX + 3, pillY + 3, pillW - 6, pillH - 6, radius - 3);
  } else {
    ctx.arc(pillX + 3 + radius - 3, pillY + 3 + radius - 3, radius - 3, Math.PI / 2, (Math.PI * 3) / 2);
    ctx.arc(pillX + pillW - 3 - (radius - 3), pillY + 3 + radius - 3, radius - 3, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Crisp white, bold, uppercase font
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px "Outfit", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text shadow for high contrast against varied 3D backgrounds
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function buildHabitatLabels(scene: THREE.Scene): THREE.Sprite[] {
  const sprites: THREE.Sprite[] = [];

  HABITAT_LABELS_CONFIG.forEach((cfg) => {
    const texture = createHabitatBadgeTexture(cfg.label);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(13.0, 3.25, 1.0);
    sprite.position.copy(cfg.position);
    sprite.renderOrder = 10;
    sprite.userData = {
      habitatName: cfg.name,
      baseY: cfg.position.y,
    };

    scene.add(sprite);
    sprites.push(sprite);
  });

  return sprites;
}
