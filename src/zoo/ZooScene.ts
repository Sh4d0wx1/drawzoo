import * as THREE from 'three';
import { buildHabitats } from './habitats';
import { buildScenery } from './scenery';
import { buildAnimals } from './animals';
import { animateAnimals } from './animator';
import { createControls } from './controls';
import { buildNameLabels, updateNameLabels, pickLabel, refreshNameLabel } from './nameLabels';
import type { AnimalData } from './types';

export interface ZooSceneInstance {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  animals: AnimalData[];
  raycaster: THREE.Raycaster;
  dispose: () => void;
  pickAnimal: (x: number, y: number) => AnimalData | null;
  pickLabel: (x: number, y: number) => number;
  renameAnimal: (index: number, newName: string) => void;
  highlightAnimal: (animal: AnimalData | null) => void;
}

// ---------------------------------------------------------------------------
// Highlight ring — glowing circle under selected animal
// ---------------------------------------------------------------------------
function makeHighlightRing(): THREE.Mesh {
  const geo = new THREE.RingGeometry(0.55, 0.90, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.renderOrder = 1;
  return ring;
}

// ---------------------------------------------------------------------------
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
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export function createZooScene(canvas: HTMLCanvasElement): ZooSceneInstance {

  // ── Renderer ──────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x88c4f0);
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  // Warm-tinted fog — starts far enough not to intrude
  scene.fog = new THREE.FogExp2(0xaad4f0, 0.0045);

  // ── Camera ────────────────────────────────────────────────────────────────
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const camera = new THREE.PerspectiveCamera(52, aspect, 0.4, 400);
  // Initial position set by controls; just provide a sensible default
  camera.position.set(0, 40, 60);
  camera.lookAt(0, 0, 0);

  // ── Lighting ──────────────────────────────────────────────────────────────
  // Hemisphere — warm sky / cool ground
  const hemi = new THREE.HemisphereLight(0xb0d8f8, 0x8aaa60, 0.55);
  scene.add(hemi);

  // Main sun — golden-hour angle, slightly south-west
  const sun = new THREE.DirectionalLight(0xfff4cc, 1.15);
  sun.position.set(55, 72, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near    = 1;
  sun.shadow.camera.far     = 220;
  sun.shadow.camera.left    = -75;
  sun.shadow.camera.right   =  75;
  sun.shadow.camera.top     =  75;
  sun.shadow.camera.bottom  = -75;
  sun.shadow.bias           = -0.0008;
  sun.shadow.normalBias     =  0.02;
  scene.add(sun);

  // Soft sky-fill from the opposite side — cool blue
  const fill = new THREE.DirectionalLight(0xb0ccff, 0.38);
  fill.position.set(-50, 28, -40);
  scene.add(fill);

  // Subtle warm bounce from ground level
  const bounce = new THREE.DirectionalLight(0xffeecc, 0.18);
  bounce.position.set(0, -10, 0);
  scene.add(bounce);

  // Ambient for deep-shadow fill
  scene.add(new THREE.AmbientLight(0xfff0e0, 0.30));

  // ── Sky ───────────────────────────────────────────────────────────────────
  buildSky(scene);

  // ── World ─────────────────────────────────────────────────────────────────
  buildHabitats(scene);
  const ambientObjects = buildScenery(scene);   // returns butterflies[]
  const butterflies = ambientObjects;
  const animals = buildAnimals(scene);

  // Name labels
  const nameSprites = buildNameLabels(scene, animals);

  // ── Highlight ring ────────────────────────────────────────────────────────
  const hlRing = makeHighlightRing();
  scene.add(hlRing);
  let hlTarget: AnimalData | null = null;
  let hlOpacity = 0;

  function highlightAnimal(animal: AnimalData | null): void {
    hlTarget = animal;
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  const controls = createControls(camera, canvas);

  // ── Raycaster / picking ───────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const meshToAnimal = new Map<string, AnimalData>();
  animals.forEach(a => {
    a.group.traverse(o => {
      if (o instanceof THREE.Mesh) meshToAnimal.set(o.uuid, a);
    });
  });

  function pickAnimal(clientX: number, clientY: number): AnimalData | null {
    const rect  = canvas.getBoundingClientRect();
    const ndcX  = ((clientX - rect.left)  / rect.width)  * 2 - 1;
    const ndcY  = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const meshes: THREE.Object3D[] = [];
    animals.forEach(a => a.group.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); }));
    const hits = raycaster.intersectObjects(meshes, false);
    return hits.length > 0 ? (meshToAnimal.get(hits[0].object.uuid) ?? null) : null;
  }

  // ── Clock ─────────────────────────────────────────────────────────────────
  const clock    = new THREE.Clock();
  let prevTime   = 0;
  let animId     = 0;

  // ── Render loop ───────────────────────────────────────────────────────────
  function tick(): void {
    animId = requestAnimationFrame(tick);
    const elapsed = clock.getElapsedTime();
    const delta   = elapsed - prevTime;
    prevTime       = elapsed;

    // Animals + labels
    animateAnimals(animals, elapsed, delta);
    updateNameLabels(nameSprites, animals);

    // Animate clouds — slow drift
    scene.children.forEach(obj => {
      if (obj.userData['drift'] !== undefined) {
        obj.position.x += obj.userData['drift'] as number;
        if (obj.position.x >  100) obj.position.x = -100;
        if (obj.position.x < -100) obj.position.x =  100;
      }
    });

    // Animate butterflies
    butterflies.forEach(b => {
      const phase  = (b.userData['flutter']  as number) + elapsed * 3.5;
      const bx     = b.userData['baseX']     as number;
      const bz     = b.userData['baseZ']     as number;
      const by     = b.userData['baseY']     as number;
      const da     = b.userData['driftAng']  as number;

      // Gentle figure-8 drift
      b.position.x = bx + Math.cos(elapsed * 0.4 + da)       * 0.9;
      b.position.z = bz + Math.sin(elapsed * 0.55 + da * 1.3)* 0.7;
      b.position.y = by + Math.sin(elapsed * 1.8  + da)       * 0.25;

      // Wing flap — rotate each wing child
      b.children.forEach((wing, wi) => {
        wing.rotation.y = (wi === 0 ? 1 : -1) * (0.3 + Math.abs(Math.sin(phase)) * 1.1);
      });

      // Face direction of travel
      b.rotation.y = Math.sin(elapsed * 0.4 + da) * 0.6;
    });

    // Highlight ring follow + pulse
    if (hlTarget) {
      hlOpacity = Math.min(1, hlOpacity + delta * 4);
      const wp = new THREE.Vector3();
      hlTarget.group.getWorldPosition(wp);
      hlRing.position.set(wp.x, wp.y + 0.08, wp.z);
      // Scale ring to animal group bounding approx
      const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
      hlRing.scale.setScalar(pulse * 1.5);
    } else {
      hlOpacity = Math.max(0, hlOpacity - delta * 5);
    }
    (hlRing.material as THREE.MeshBasicMaterial).opacity = hlOpacity * 0.75;

    controls.update();

    // Resize
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (renderer.domElement.width  !== w * devicePixelRatio ||
        renderer.domElement.height !== h * devicePixelRatio) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  }
  tick();

  // ── Dispose ───────────────────────────────────────────────────────────────
  function dispose(): void {
    cancelAnimationFrame(animId);
    controls.dispose();
    nameSprites.forEach(s => {
      (s.material as THREE.SpriteMaterial).map?.dispose();
      s.material.dispose();
    });
    renderer.dispose();
  }

  // ── Label picking ─────────────────────────────────────────────────────────
  function pickLabelAt(clientX: number, clientY: number): number {
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width)  * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return pickLabel(nameSprites, ndcX, ndcY, camera);
  }

  function renameAnimal(index: number, newName: string): void {
    if (index < 0 || index >= animals.length) return;
    animals[index].name = newName;
    refreshNameLabel(nameSprites[index], newName);
  }

  return {
    renderer, camera, animals, raycaster,
    dispose, pickAnimal,
    pickLabel: pickLabelAt,
    renameAnimal,
    highlightAnimal,
  };
}
