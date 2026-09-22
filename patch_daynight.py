import re

with open('src/zoo/ZooScene.ts', 'r') as f:
    code = f.read()

# 1. Replace buildSky with buildDayNightSystem
day_night_sys = """// ---------------------------------------------------------------------------
// Day/Night Cycle
// ---------------------------------------------------------------------------
const DAY_DURATION = 120; // seconds for a full cycle

function buildDayNightSystem(scene: THREE.Scene): {
  sunMesh: THREE.Mesh;
  moonMesh: THREE.Mesh;
  starField: THREE.Points;
  skyOuter: THREE.Mesh;
  skyInner: THREE.Mesh;
} {
  // Sky spheres
  const outerGeo = new THREE.SphereGeometry(280, 20, 12);
  outerGeo.scale(-1, 1, 1);
  const outerMat = new THREE.MeshBasicMaterial({ color: 0x5588cc, side: THREE.BackSide, fog: false });
  const skyOuter = new THREE.Mesh(outerGeo, outerMat);
  scene.add(skyOuter);

  const innerGeo = new THREE.SphereGeometry(250, 20, 10);
  innerGeo.scale(-1, 1, 1);
  const innerMat = new THREE.MeshBasicMaterial({ color: 0x88c4f0, side: THREE.BackSide, fog: false, transparent: true, opacity: 1.0 });
  const skyInner = new THREE.Mesh(innerGeo, innerMat);
  scene.add(skyInner);

  // Sun
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88, fog: false });
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 12), sunMat);
  scene.add(sunMesh);

  // Sun glow halo
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, fog: false, transparent: true, opacity: 0.15 });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), haloMat);
  sunMesh.add(halo);

  // Moon
  const moonMat = new THREE.MeshLambertMaterial({ color: 0xdde8f5, fog: false });
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 12), moonMat);
  // Crater bumps
  for (let c = 0; c < 6; c++) {
    const craterGeo = new THREE.CircleGeometry(0.4 + Math.random() * 0.5, 8);
    const craterMat = new THREE.MeshBasicMaterial({ color: 0xb8c8d8, fog: false });
    const crater = new THREE.Mesh(craterGeo, craterMat);
    const a = Math.random() * Math.PI * 2;
    const b = (Math.random() - 0.5) * Math.PI;
    crater.position.set(Math.cos(a) * Math.cos(b) * 4.55, Math.sin(b) * 4.55, Math.sin(a) * Math.cos(b) * 4.55);
    crater.lookAt(0, 0, 0);
    moonMesh.add(crater);
  }
  scene.add(moonMesh);

  // Stars
  const starCount = 1200;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 260 + Math.random() * 10;
    starPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true, fog: false, transparent: true, opacity: 0 });
  const starField = new THREE.Points(starGeo, starMat);
  scene.add(starField);

  return { sunMesh, moonMesh, starField, skyOuter, skyInner };
}

// Lerp helper for colors
function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

// Sky palettes keyed by time of day [0..1]
const SKY_PHASES = [
  { t: 0.00, outer: new THREE.Color(0x060820), inner: new THREE.Color(0x0d1535), fog: new THREE.Color(0x0d1535) }, // Midnight
  { t: 0.20, outer: new THREE.Color(0x060820), inner: new THREE.Color(0x0d1535), fog: new THREE.Color(0x0d1535) }, // Pre-dawn
  { t: 0.25, outer: new THREE.Color(0x1a1a50), inner: new THREE.Color(0x4a3060), fog: new THREE.Color(0x4a3060) }, // Dawn start
  { t: 0.30, outer: new THREE.Color(0xe8602c), inner: new THREE.Color(0xf09060), fog: new THREE.Color(0xf09060) }, // Sunrise
  { t: 0.38, outer: new THREE.Color(0x4488cc), inner: new THREE.Color(0x88c4f0), fog: new THREE.Color(0xaad4f0) }, // Morning
  { t: 0.55, outer: new THREE.Color(0x3377bb), inner: new THREE.Color(0x77bbee), fog: new THREE.Color(0x99ccee) }, // Midday
  { t: 0.70, outer: new THREE.Color(0x4488cc), inner: new THREE.Color(0x88c4f0), fog: new THREE.Color(0xaad4f0) }, // Afternoon
  { t: 0.75, outer: new THREE.Color(0xe04020), inner: new THREE.Color(0xf07050), fog: new THREE.Color(0xf07050) }, // Sunset
  { t: 0.82, outer: new THREE.Color(0x1a1a50), inner: new THREE.Color(0x2a2055), fog: new THREE.Color(0x2a2055) }, // Dusk
  { t: 1.00, outer: new THREE.Color(0x060820), inner: new THREE.Color(0x0d1535), fog: new THREE.Color(0x0d1535) }, // Back to midnight
];

function getSkyColors(tod: number): { outer: THREE.Color; inner: THREE.Color; fog: THREE.Color } {
  let a = SKY_PHASES[SKY_PHASES.length - 1];
  let b = SKY_PHASES[0];
  for (let i = 0; i < SKY_PHASES.length - 1; i++) {
    if (tod >= SKY_PHASES[i].t && tod < SKY_PHASES[i + 1].t) {
      a = SKY_PHASES[i];
      b = SKY_PHASES[i + 1];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const localT = (tod - a.t) / span;
  return {
    outer: lerpColor(a.outer, b.outer, localT),
    inner: lerpColor(a.inner, b.inner, localT),
    fog:   lerpColor(a.fog,   b.fog,   localT),
  };
}"""

old_sky = """// ---------------------------------------------------------------------------
// Sky — two-tone gradient via two nested spheres
// ---------------------------------------------------------------------------
function buildSky(scene: THREE.Scene): void {
  // Outer deep blue sky
  const outerGeo = new THREE.SphereGeometry(280, 16, 10);
  outerGeo.scale(-1, 1, 1);
  scene.add(new THREE.Mesh(
    outerGeo,
    new THREE.MeshBasicMaterial({ color: 0x5588cc, side: THREE.BackSide, fog: false }),
  ));
  // Inner horizon haze — lighter, sits just inside
  const innerGeo = new THREE.SphereGeometry(250, 16, 8);
  innerGeo.scale(-1, 1, 1);
  scene.add(new THREE.Mesh(
    innerGeo,
    new THREE.MeshBasicMaterial({ color: 0x88c4f0, side: THREE.BackSide, fog: false }),
  ));
}"""

code = code.replace(old_sky, day_night_sys)

# 2. Replace buildSky(scene) with the new init
old_call = """  // ── Sky ───────────────────────────────────────────────────────────────────
  buildSky(scene);"""
new_call = """  // ── Sky + Day/Night ───────────────────────────────────────────────────────
  const { sunMesh, moonMesh, starField, skyOuter, skyInner } = buildDayNightSystem(scene);"""

code = code.replace(old_call, new_call)


# 3. Add the update loop
old_tick = """    // Animate clouds — slow drift"""
new_tick = """    // ── Day/Night Cycle Update ────────────────────────────────────────────
    const tod = ((elapsed / DAY_DURATION) + 0.5) % 1; // 0..1 (starts at noon)
    const sky = getSkyColors(tod);
    (skyOuter.material as THREE.MeshBasicMaterial).color.copy(sky.outer);
    (skyInner.material as THREE.MeshBasicMaterial).color.copy(sky.inner);
    (skyInner.material as THREE.MeshBasicMaterial).opacity = 1.0;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(sky.fog);
    }
    renderer.setClearColor(sky.fog);

    // Sun orbits along the X-Z plane tilted slightly, radius 240
    const sunAngle = tod * Math.PI * 2 - Math.PI / 2;
    const orbitR = 200;
    sunMesh.position.set(
      Math.cos(sunAngle) * orbitR,
      Math.sin(sunAngle) * orbitR * 0.65,
      -40,
    );
    // Moon is opposite the sun
    moonMesh.position.set(
      -sunMesh.position.x * 0.9,
      -sunMesh.position.y * 0.9,
      -40,
    );

    // Sun light tracks the sun mesh
    sun.position.copy(sunMesh.position).normalize().multiplyScalar(80);
    const sunElev = Math.sin(sunAngle); // -1 (midnight) to +1 (noon)
    const dayT    = Math.max(0, sunElev); // 0..1 daytime
    const nightT  = Math.max(0, -sunElev); // 0..1 nighttime

    // Sun light color: dawn/dusk orange → midday white
    const sunColDay  = new THREE.Color(0xfff4cc);
    const sunColDusk = new THREE.Color(0xff8833);
    const sunColNight = new THREE.Color(0x000000);
    if (sunElev > 0) {
      sun.color.copy(lerpColor(sunColDusk, sunColDay, Math.min(1, sunElev * 2)));
    } else {
      sun.color.copy(sunColNight);
    }
    sun.intensity = Math.max(0, sunElev * 1.4);

    // Moon light (soft blue-silver)
    const moonElev = Math.sin(sunAngle + Math.PI);
    fill.color.set(moonElev > 0 ? 0x8899cc : 0xb0ccff);
    fill.intensity = moonElev > 0
      ? Math.max(0, moonElev * 0.45)
      : 0.38 * dayT;
    fill.position.copy(moonMesh.position).normalize().multiplyScalar(80);

    // Ambient: bright at noon, dark navy at midnight
    const ambDay  = new THREE.Color(0xfff5ea);
    const ambNight = new THREE.Color(0x080c20);
    const ambColor = lerpColor(ambNight, ambDay, dayT);
    const ambient = scene.children.find(c => c instanceof THREE.AmbientLight) as THREE.AmbientLight | undefined;
    if (ambient) {
      ambient.color.copy(ambColor);
      ambient.intensity = 0.15 + dayT * 0.35;
    }

    // Hemisphere: rich sky blue -> night purple
    hemi.color.copy(lerpColor(new THREE.Color(0x0a0a1a), new THREE.Color(0xaaccff), dayT));
    hemi.groundColor.copy(lerpColor(new THREE.Color(0x010205), new THREE.Color(0x556b2f), dayT));
    hemi.intensity = 0.1 + dayT * 0.6;

    // Stars: appear at night
    (starField.material as THREE.PointsMaterial).opacity = Math.max(0, nightT * 1.2 - 0.1);

    // Sun glow pulse slightly
    sunMesh.scale.setScalar(1 + Math.sin(elapsed * 0.5) * 0.02);
    (sunMesh.material as THREE.MeshBasicMaterial).color.set(
      sunElev > -0.1
        ? lerpColor(new THREE.Color(0xff6600), new THREE.Color(0xffee88), Math.min(1, (sunElev + 0.1) * 3))
        : new THREE.Color(0x111133),
    );

    // Animate clouds — slow drift"""
code = code.replace(old_tick, new_tick)

with open('src/zoo/ZooScene.ts', 'w') as f:
    f.write(code)

print("Patched ZooScene.ts")
