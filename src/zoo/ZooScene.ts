import * as THREE from 'three';
import { buildHabitats, buildHabitatLabels } from './habitats';
import { buildScenery } from './scenery';
import { buildAnimals, spawnAnimal } from './animals';
import { animateAnimals } from './animator';
import { createControls } from './controls';
import type { AnimalData } from './types';
import { supabase } from '../lib/supabaseClient';
import type { AnimalRecord } from '../lib/supabaseClient';
import { buildSonicGuide, updateSonicGuide, disposeSonicGuide, getSonicModel, sonicModel, isGuiding, isSwimming, interactWithSonic } from './sonicGuide';
import { getSavedAnimalName, saveCustomAnimalName, getAnimalInstanceKey, isAnimalReleased, removeCustomAnimalName } from './storage';

export interface ZooSceneInstance {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  animals: AnimalData[];
  raycaster: THREE.Raycaster;
  dispose: () => void;
  pickAnimal: (x: number, y: number) => AnimalData | null;
  pickHabitat: (x: number, y: number) => string | null;
  renameAnimal: (target: number | string, newName: string) => void;
  removeAnimal: (target: string) => void;
  highlightAnimal: (animal: AnimalData | null) => void;
  addAnimal: (species: string, name: string, color?: string, dbId?: string, shouldFocus?: boolean, customColors?: Record<string, string>, userId?: string) => AnimalData;
  panCameraTo: (target: THREE.Vector3, radius?: number, phi?: number, theta?: number) => void;
  focusOnSonic: () => void;
  toggleFollowSonic: (enable?: boolean) => boolean;
  focusOnHabitat: (habitatName: string) => void;
  restoreCamera: () => void;
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
// Sky — two-tone gradient via two nested spheres (Daytime)
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
  // Hemisphere — #ffffff sky / #556b2f olive-green ground fill (prevents underbelly clipping)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.60);
  scene.add(hemi);

  // Main sun — golden-hour angle, slightly south-west
  const sun = new THREE.DirectionalLight(0xfff4cc, 1.15);
  sun.position.set(55, 72, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = 1024;
  sun.shadow.mapSize.height = 1024;
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
  const bounce = new THREE.DirectionalLight(0xffeecc, 0.22);
  bounce.position.set(0, -10, 0);
  scene.add(bounce);

  // Ambient for deep-shadow fill
  scene.add(new THREE.AmbientLight(0xfff5ea, 0.35));

  // ── Sky ───────────────────────────────────────────────────────────────────
  buildSky(scene);

  // ── World ─────────────────────────────────────────────────────────────────
  buildHabitats(scene);
  const habitatLabels = buildHabitatLabels(scene);
  buildScenery(scene);
  const animals = buildAnimals(scene);
  buildSonicGuide(scene);

  // Name labels
  

  // ── Highlight ring ────────────────────────────────────────────────────────
  const hlRing = makeHighlightRing();
  scene.add(hlRing);
  let hlTarget: AnimalData | null = null;
  let hlOpacity = 0;

  function highlightAnimal(animal: AnimalData | null): void {
    hlTarget = animal;
  }

  type CameraMode = 'FREE' | 'FOLLOWING_SONIC' | 'PANNING_TO_HABITAT';
  let cameraMode: CameraMode = 'FREE';

  // ── Controls ──────────────────────────────────────────────────────────────
  const controls = createControls(camera, canvas);

  controls.orbit.addEventListener('start', () => {
    // If user grabs or wheels the camera at ANY point while he is swimming:
    if (isSwimming || cameraMode === 'FOLLOWING_SONIC') {
      cameraMode = 'FREE'; // Stop following immediately; yield full control to user
    }
  });

  let prevIsGuiding = false;
  let prevIsSwimming = false;
  let userFollowingSonic = false;
  let savedCamPos: THREE.Vector3 | null = null;
  let savedTarget: THREE.Vector3 | null = null;

  // ── Native Click Handling for Sonic ───────────────────────────────────────
  let downPos = { x: 0, y: 0 };
  
  const onPointerDown = (e: PointerEvent) => {
    downPos = { x: e.clientX, y: e.clientY };
  };
  
  const onPointerUp = (e: PointerEvent) => {
    const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (dist < 5) {
      const currentSonic = getSonicModel();
      if (currentSonic) {
        const rect = canvas.getBoundingClientRect();
        const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        
        // CRITICAL: recursive flag must be true to catch all skinned meshes
        const hits = raycaster.intersectObject(currentSonic, true);
        if (hits.length > 0) {
          interactWithSonic(camera);
          focusOnSonic(); // Snap camera if needed
        }
      }
    }
  };
  
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

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
    animals.forEach(a => a.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        meshes.push(o);
        if (!meshToAnimal.has(o.uuid)) {
          meshToAnimal.set(o.uuid, (o.userData.animal as AnimalData) ?? a);
        }
      }
    }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    const hitObj = hits[0].object;
    return (hitObj.userData.animal as AnimalData) ?? meshToAnimal.get(hitObj.uuid) ?? null;
  }

  // Pre-cache interactive habitat objects for fast raycasting
  const habitatObjects: THREE.Object3D[] = [];
  scene.traverse(o => {
    if ((o instanceof THREE.Mesh || o instanceof THREE.Sprite) && o.userData?.habitatName) {
      habitatObjects.push(o);
    }
  });

  function pickHabitat(clientX: number, clientY: number): string | null {
    const rect  = canvas.getBoundingClientRect();
    const ndcX  = ((clientX - rect.left)  / rect.width)  * 2 - 1;
    const ndcY  = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hits = raycaster.intersectObjects(habitatObjects, false);
    if (hits.length === 0) return null;
    return (hits[0].object.userData.habitatName as string) ?? null;
  }

  // ── Clock & Resize ────────────────────────────────────────────────────────
  const clock    = new THREE.Clock();
  let prevTime   = 0;
  let animId     = 0;

  let needsResize = false;
  const onResize = () => { needsResize = true; };
  window.addEventListener('resize', onResize);

  // ── Render loop ───────────────────────────────────────────────────────────
  function tick(): void {
    animId = requestAnimationFrame(tick);
    const elapsed = clock.getElapsedTime();
    const rawDelta = prevTime === 0 ? 0.016 : elapsed - prevTime;
    const delta = Math.min(Math.max(rawDelta, 0), 0.05);
    prevTime = elapsed;

    // Animals + labels (mixer updates handled inside animateAnimals)
    animateAnimals(animals, elapsed, delta);
    updateSonicGuide(delta, camera);

    if (isGuiding && !prevIsGuiding) cameraMode = 'FOLLOWING_SONIC';
    if (!isGuiding && prevIsGuiding && !userFollowingSonic) {
      cameraMode = 'FREE';
      controls.orbit.enabled = true;
      if (sonicModel) controls.orbit.target.copy(sonicModel.position);
    }
    
    if (isSwimming && !prevIsSwimming) cameraMode = 'FOLLOWING_SONIC';
    
    prevIsGuiding = isGuiding;
    prevIsSwimming = isSwimming;

    if (userFollowingSonic) {
      cameraMode = 'FOLLOWING_SONIC';
    }

    if (cameraMode === 'PANNING_TO_HABITAT' && controls.orbit.enabled) {
      // panToPosition tween completed
      cameraMode = 'FREE';
    }

    if (cameraMode === 'FOLLOWING_SONIC' && sonicModel && controls && controls.orbit) {
      const followOffset = isSwimming 
        ? new THREE.Vector3(0, 3, 4.5)  // Closer zoom for swimming
        : new THREE.Vector3(0, 5, 8);    // Standard run follow offset

      const targetCamPos = sonicModel.position.clone().add(followOffset);
      camera.position.lerp(targetCamPos, 0.08);
      controls.orbit.target.lerp(sonicModel.position, 0.08);
      controls.update();
    } else {
      // FREE or PANNING_TO_HABITAT (managed by controls tween internally)
      controls.update();
    }

    // Floating 3D habitat billboard labels hover bob
    habitatLabels.forEach((lbl, idx) => {
      lbl.position.y = (lbl.userData.baseY as number) + Math.sin(elapsed * 1.5 + idx * 1.1) * 0.25;
    });

    // Animate clouds — slow drift
    scene.children.forEach(obj => {
      if (obj.userData['drift'] !== undefined) {
        obj.position.x += obj.userData['drift'] as number;
        if (obj.position.x >  100) obj.position.x = -100;
        if (obj.position.x < -100) obj.position.x =  100;
      }
    });

    // Highlight ring follow + pulse
    if (hlTarget) {
      hlOpacity = Math.min(1, hlOpacity + delta * 4);
      const wp = new THREE.Vector3();
      hlTarget.group.getWorldPosition(wp);
      hlRing.position.set(wp.x, wp.y + 0.08, wp.z);
      const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
      hlRing.scale.setScalar(pulse * 1.5);
    } else {
      hlOpacity = Math.max(0, hlOpacity - delta * 5);
    }
    (hlRing.material as THREE.MeshBasicMaterial).opacity = hlOpacity * 0.75;

    controls.update();

    // Resize only when window dimension changes (avoids layout thrashing)
    if (needsResize) {
      needsResize = false;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }

    renderer.render(scene, camera);
  }
  tick();

  // ── Sync with Supabase Database on Startup ───────────────────────────────
  async function syncAnimalsFromDB(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Could not fetch animals from Supabase:', error.message);
        return;
      }

      if (data && data.length > 0) {
        data.forEach((rec: AnimalRecord) => {
          if (isAnimalReleased(rec.id)) return;
          if (!animals.some(a => a.group.userData?.dbId === rec.id)) {
            const savedName = getSavedAnimalName(rec.id);
            const effectiveName = savedName || rec.name;
            addAnimal(rec.species, effectiveName, rec.color, rec.id, false);
          }
        });
      }
    } catch (err) {
      console.warn('Failed to sync DB animals:', err);
    }
  }
  syncAnimalsFromDB();

  // ── Real-time Channel for Animal Inserts & Deletes ─────────────────────────
  const animalsChannel = supabase
    .channel('public:animals')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'animals' },
      (payload) => {
        const rec = payload.new as AnimalRecord;
        if (!rec || isAnimalReleased(rec.id)) return;
        if (!animals.some(a => a.group.userData?.dbId === rec.id)) {
          const savedName = getSavedAnimalName(rec.id);
          const effectiveName = savedName || rec.name;
          addAnimal(rec.species, effectiveName, rec.color, rec.id, false);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'animals' },
      (payload) => {
        const oldRec = payload.old as { id?: string };
        if (oldRec?.id) {
          removeAnimal(oldRec.id);
          removeCustomAnimalName(oldRec.id);
        }
      }
    )
    .subscribe();

  // ── Dispose ───────────────────────────────────────────────────────────────
  function dispose(): void {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', onResize);
    supabase.removeChannel(animalsChannel);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    controls.dispose();
    disposeSonicGuide(scene);
    habitatLabels.forEach(lbl => {
      if (lbl.material.map) lbl.material.map.dispose();
      lbl.material.dispose();
    });
    renderer.dispose();
  }

  function renameAnimal(target: number | string, newName: string): void {
    let animal: AnimalData | undefined;
    if (typeof target === 'number') {
      animal = animals[target];
    } else {
      animal = animals.find(a => a.group.uuid === target || a.group.userData?.dbId === target);
    }
    if (!animal) return;
    animal.name = newName;

    // Persist custom name locally across reloads using its unique instance key
    const idx = animals.indexOf(animal);
    const key = getAnimalInstanceKey(animal, idx);
    saveCustomAnimalName(key, newName);
    window.dispatchEvent(new CustomEvent('animals-updated'));
  }

  function removeAnimal(target: number | string): boolean {
    let idx = -1;
    if (typeof target === 'number') {
      idx = target;
    } else {
      idx = animals.findIndex(a =>
        a.group.userData?.dbId === target ||
        a.group.uuid === target ||
        a.group.userData?.instanceId === target
      );
    }
    if (idx < 0 || idx >= animals.length) return false;
    const animal = animals[idx];
    
    animals.splice(idx, 1);
    scene.remove(animal.group);
    
    animal.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        meshToAnimal.delete(o.uuid);
      }
    });
    
    if (hlTarget === animal) {
      hlTarget = null;
    }
    window.dispatchEvent(new CustomEvent('animals-updated'));
    return true;
  }

  function addAnimal(
    species: string,
    name: string,
    color?: string,
    dbId?: string,
    shouldFocus = true,
    customColors?: Record<string, string>,
    userId?: string,
  ): AnimalData {
    if (dbId) {
      const savedName = getSavedAnimalName(dbId);
      if (savedName) {
        name = savedName;
      }
      const existing = animals.find(a => a.group.userData?.dbId === dbId);
      if (existing) {
        if (name && existing.name !== name) {
          existing.name = name;
        }
        if (shouldFocus) {
          controls.panTo(existing.position, 18);
          highlightAnimal(existing);
        }
        return existing;
      }
    }

    let finalColor = color;
    let finalCustomColors = customColors;

    if (color && color.startsWith('{')) {
      try {
        finalCustomColors = JSON.parse(color);
        finalColor = undefined;
      } catch (e) {
        // ignore JSON parse errors, treat as literal color
      }
    }

    const animal = spawnAnimal(species, name, finalColor, finalCustomColors);
    if (dbId) {
      animal.group.userData.dbId = dbId;
      animal.group.userData.instanceId = dbId;
    }
    if (userId) {
      animal.group.userData.userId = userId;
    }
    scene.add(animal.group);
    animals.push(animal);
    window.dispatchEvent(new CustomEvent('animals-updated'));



    // Register all child meshes for raycast picking
    animal.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        meshToAnimal.set(o.uuid, animal);
        o.userData.animal = animal;
      }
    });

    if (shouldFocus) {
      // Pan camera to view new animal
      controls.panTo(animal.position, 18);
      // Highlight the newly created animal
      highlightAnimal(animal);
    }

    return animal;
  }


  function focusOnSonic(): void {
    const sonic = getSonicModel() || sonicModel;
    if (!sonic) return;

    // Save current camera view if not already saved for this interaction
    if (!savedCamPos) {
      savedCamPos = camera.position.clone();
      savedTarget = controls.getLookTarget();
    }

    const sonicPos = new THREE.Vector3();
    sonic.getWorldPosition(sonicPos);

    // Target Sonic's upper body / chest / face level (Sonic scale = 3.68, Y ~ 1.55 is chest/eye level)
    const target = new THREE.Vector3(sonicPos.x, sonicPos.y + 1.55, sonicPos.z);

    // Radius 7.2 frames Sonic in a crisp medium shot; phi 1.33 rad gives eye-level conversational pitch
    controls.panTo(target, 7.2, 1.33);
  }

  function toggleFollowSonic(enable?: boolean): boolean {
    if (enable !== undefined) {
      userFollowingSonic = enable;
    } else {
      userFollowingSonic = !userFollowingSonic;
    }
    
    if (userFollowingSonic) {
      cameraMode = 'FOLLOWING_SONIC';
    } else {
      cameraMode = 'FREE';
      controls.orbit.enabled = true;
      if (sonicModel) controls.orbit.target.copy(sonicModel.position);
    }
    return userFollowingSonic;
  }

  function restoreCamera(): void {
    if (savedCamPos && savedTarget) {
      // If the saved camera was already extremely close (< 18 units), restore to a pleasant park overview
      if (savedCamPos.distanceTo(savedTarget) < 18) {
        controls.panTo(new THREE.Vector3(0, 0, 0), 45, 1.0);
      } else {
        controls.panToPosition(savedTarget, savedCamPos);
      }
      savedCamPos = null;
      savedTarget = null;
    }
  }

  const HABITAT_CAMERA_VIEWS: Record<string, { target: THREE.Vector3; camPos: THREE.Vector3 }> = {
    'Savanna': {
      target: new THREE.Vector3(-48, 1.2, -48),
      camPos: new THREE.Vector3(-24, 26, -24),
    },
    'Jungle': {
      target: new THREE.Vector3(48, 1.2, -48),
      camPos: new THREE.Vector3(24, 26, -24),
    },
    'Reptile Zone': {
      target: new THREE.Vector3(48, 1.2, 48),
      camPos: new THREE.Vector3(26, 24, 26),
    },
    'Aviary': {
      target: new THREE.Vector3(-48, 1.2, 48),
      camPos: new THREE.Vector3(-26, 24, 26),
    },
    'Aquatic Zone': {
      target: new THREE.Vector3(0, -0.5, 0),
      camPos: new THREE.Vector3(0, 22, 30),
    },
  };

  function focusOnHabitat(habitatName: string): void {
    const view = HABITAT_CAMERA_VIEWS[habitatName];
    if (view) {
      cameraMode = 'PANNING_TO_HABITAT';
      highlightAnimal(null);
      controls.panToPosition(view.target, view.camPos);
    }
  }

  function panCameraTo(target: THREE.Vector3, radius = 22, phi?: number, theta?: number): void {
    controls.panTo(target, radius, phi, theta);
  }

  return {
    renderer, camera, animals, raycaster,
    dispose, pickAnimal,
    pickHabitat,
    renameAnimal,
    removeAnimal,
    highlightAnimal,
    addAnimal,
    panCameraTo,
    focusOnSonic,
    toggleFollowSonic,
    focusOnHabitat,
    restoreCamera,
  };
}
