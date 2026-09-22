import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HABITATS } from './habitats';

export let sonicMixer: THREE.AnimationMixer | null = null;
export let sonicModel: THREE.Group | null = null; // Outer wrapper
export let swimPitchGroup: THREE.Group | null = null; // Inner wrapper for prone swimming pitch
export let sonicInnerModel: THREE.Group | null = null; // Inner GLTF scene
let initialInnerRotation = new THREE.Euler();
export const getSonicModel = () => sonicModel;
export let headBone: THREE.Bone | null = null;
export let rightHandBone: THREE.Bone | null = null;
export let headphonesGroup: THREE.Group | null = null;
export let phoneGroup: THREE.Group | null = null;

// ─── Animation Actions ───────────────────────────────────────────────────────
let walkAction: THREE.AnimationAction | null = null;
let textAction: THREE.AnimationAction | null = null;
let talkAction: THREE.AnimationAction | null = null;
let runAction: THREE.AnimationAction | null = null;
let diveAction: THREE.AnimationAction | null = null;
let swimAction: THREE.AnimationAction | null = null;
let currentAction: THREE.AnimationAction | null = null;

// ─── State Machine ───────────────────────────────────────────────────────────
type GuideState = 'walk' | 'interact' | 'run-to-habitat' | 'run-to-pool' | 'dive' | 'swim' | 'exit-water';
let guideState: GuideState = 'walk';
let targetWaypointIndex = 0;

// ─── Run-to-habitat state ────────────────────────────────────────────────────
let targetHabitatGate: THREE.Vector3 | null = null;
let targetHabitatName: string | null = null;
export let isGuiding = false;
let runPathWaypoints: THREE.Vector3[] = [];
let runWaypointIndex = 0;

// ─── Swim state ──────────────────────────────────────────────────────────────
let swimTarget: THREE.Vector3 | null = null;  // opposite pool rim
let swimPoolEdge: THREE.Vector3 | null = null; // nearest pool edge
let diveEntryPos: THREE.Vector3 | null = null;
let diveTimer = 0;
let exitWaterTimer = 0;
export let isSwimming = false;
let sonicBottomY = 0;

const GROUND_Y = 0.03; // Snapped directly to the pathway surface
const SWIM_Y = -0.65;   // Sit deeper so body is in the water, quills just breaking the surface
const DIVE_DURATION = 0.8; // seconds
const EXIT_WATER_DURATION = 0.5; // seconds

// ─── Pathing: Promenade ring around the ENLARGED central pool ────────────────
// The pond promenade collar ring now spans r in [26.5, 29.5]. Centerline is r = 28.0.
const PROMENADE_RADIUS = 28.0;
const POOL_RADIUS = 25.5; // Must avoid this
const NUM_WAYPOINTS = 24;

export const WAYPOINTS: THREE.Vector3[] = Array.from({ length: NUM_WAYPOINTS }, (_, i) => {
  const angle = (i / NUM_WAYPOINTS) * Math.PI * 2;
  return new THREE.Vector3(
    Math.sin(angle) * PROMENADE_RADIUS,
    GROUND_Y,
    Math.cos(angle) * PROMENADE_RADIUS
  );
});

// Compute spoke waypoints: gate entrance coordinates for each outer biome
function getHabitatGatePosition(habitatName: string): THREE.Vector3 | null {
  const h = HABITATS.find(hab => hab.name.toLowerCase() === habitatName.toLowerCase());
  if (!h || h.name === 'Aquatic Zone') return null;
  const toCenter = new THREE.Vector2(-h.center.x, -h.center.z).normalize();
  const gateDist = h.radius + 0.3;
  return new THREE.Vector3(
    h.center.x + toCenter.x * gateDist,
    GROUND_Y,
    h.center.z + toCenter.y * gateDist,
  );
}

// ─── Fine-tuning hook ────────────────────────────────────────────────────────
// All values are in world-metric metres (the inner mount cancels the
// 0.01 armature scale so 1 unit here = 1 metre in the scene).
//
// headBone sits at world-Y ≈ 0.978 m on a 3.68-scaled Sonic.
// Sonic's ear level is roughly +0.11 m above the head bone origin.
// Sonic's head width (ear-to-ear) is ≈ 0.42 m total.
export const HEADPHONES_OFFSETS = {
  posX:  0,
  posY:  0.05,   // cups sit at ear level
  posZ: -0.05,   // slightly behind brow
  rotX: -0.10,
  rotY:  0,
  rotZ:  0,
  // Stretch arch TALL (Y=1.9) so it visibly clears over Sonic's quills
  // X/Z stay at 1 so cup width is unaffected
  scaleX: 1.0,
  scaleY: 1.9,
  scaleZ: 1.0,
};

// Default starting offsets (can be overridden by keyboard tool)
export const PHONE_OFFSETS = {
  posX: 0,
  posY: 0,
  posZ: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
};

export function buildProceduralHeadphones(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SonicHeadphones';
  group.position.set(HEADPHONES_OFFSETS.posX, HEADPHONES_OFFSETS.posY, HEADPHONES_OFFSETS.posZ);
  group.rotation.set(HEADPHONES_OFFSETS.rotX, HEADPHONES_OFFSETS.rotY, HEADPHONES_OFFSETS.rotZ);
  // Non-uniform scale: tall arch that clears quills, normal cup width
  group.scale.set(HEADPHONES_OFFSETS.scaleX, HEADPHONES_OFFSETS.scaleY, HEADPHONES_OFFSETS.scaleZ);

  const archRadius = 0.20; // cups sit ±20 cm from centre

  // ── Glowing black headband ───────────────────────────────────────────────
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x050505,
    emissive: 0x111111,
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.7,
  });

  const cupMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    emissive: 0x111111,
    emissiveIntensity: 0.8,
    roughness: 0.4,
    metalness: 0.6,
  });

  // ── Gold accent rings ─────────────────────────────────────────────────────
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xcc8800,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 1.0,
  });

  // Headband: bright cyan glowing arch over the skull
  const headbandGeo = new THREE.TorusGeometry(archRadius, 0.040, 8, 28, Math.PI);
  const headband = new THREE.Mesh(headbandGeo, bandMat);
  headband.castShadow = true;
  group.add(headband);

  // Ear cups – positioned in unscaled local space so they stay round
  // (their Y position = 0 so the Y-stretch doesn't move them; only the arch peak moves up)
  const cupRadius = 0.08;
  const cupDepth  = 0.055;
  const cushionGeo = new THREE.CylinderGeometry(cupRadius, cupRadius, cupDepth, 16);

  const ringMajor = 0.065;
  const ringMinor = 0.013;
  const ringGeo = new THREE.TorusGeometry(ringMajor, ringMinor, 8, 20);

  // Left
  const leftCushion = new THREE.Mesh(cushionGeo, cupMat);
  leftCushion.position.set(-archRadius, 0, 0);
  leftCushion.rotation.z = Math.PI / 2;
  leftCushion.castShadow = true;
  group.add(leftCushion);

  const leftRing = new THREE.Mesh(ringGeo, accentMat);
  leftRing.position.set(-(archRadius + cupDepth * 0.6), 0, 0);
  leftRing.rotation.y = Math.PI / 2;
  group.add(leftRing);

  // Right
  const rightCushion = new THREE.Mesh(cushionGeo, cupMat);
  rightCushion.position.set(archRadius, 0, 0);
  rightCushion.rotation.z = Math.PI / 2;
  rightCushion.castShadow = true;
  group.add(rightCushion);

  const rightRing = new THREE.Mesh(ringGeo, accentMat);
  rightRing.position.set(archRadius + cupDepth * 0.6, 0, 0);
  rightRing.rotation.y = Math.PI / 2;
  group.add(rightRing);

  return group;
}

export function buildProceduralSmartphone(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SonicSmartphone';

  // 1. Phone Body (Scaled down to 10cm x 20cm to fit his hand better)
  const phoneBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.20, 0.015),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 })
  );
  
  // 2. Procedural Canvas Texture for detailed UI screen
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Background
  ctx.fillStyle = '#0f172a'; // dark slate
  ctx.fillRect(0, 0, 128, 256);
  // Header bar
  ctx.fillStyle = '#0284c7'; // sky blue
  ctx.fillRect(0, 0, 128, 24);
  // Text lines (fake UI)
  ctx.fillStyle = '#38bdf8'; 
  ctx.fillRect(16, 40, 80, 8);
  ctx.fillRect(16, 56, 60, 8);
  // Content card
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.roundRect(10, 80, 108, 100, 8);
  ctx.fill();
  // Colorful graph bars
  ctx.fillStyle = '#ef4444'; ctx.fillRect(20, 150, 14, 20);
  ctx.fillStyle = '#eab308'; ctx.fillRect(40, 130, 14, 40);
  ctx.fillStyle = '#22c55e'; ctx.fillRect(60, 110, 14, 60);
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(80, 140, 14, 30);
  // Bottom button
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(32, 210, 64, 24, 12);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  
  const phoneScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.09, 0.18),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  phoneScreen.position.z = 0.008; // just slightly in front of the body
  
  group.add(phoneBody, phoneScreen);
  group.visible = false; // default hidden, only visible during text/interaction

  return group;
}

// ─── Cross-fade utility ──────────────────────────────────────────────────────
function crossFadeTo(newAction: THREE.AnimationAction | null, duration = 0.3): void {
  if (!newAction || newAction === currentAction) return;
  newAction.reset();
  newAction.play();
  if (currentAction) {
    newAction.crossFadeFrom(currentAction, duration, true);
  }
  currentAction = newAction;
}

// ─── Lock root motion Y on an animation clip ─────────────────────────────────
function lockRootMotionY(clip: THREE.AnimationClip): void {
  clip.tracks.forEach((track) => {
    if (track.name.toLowerCase().includes('hips.position') || track.name.toLowerCase().includes('mixamorigHips.position')) {
      const values = track.values;
      if (values.length >= 3) {
        for (let i = 0; i < values.length; i += 3) {
          values[i + 1] = 0; // Lock Y firmly to 0 (root rest height)
        }
      }
    }
  });
}

// ─── Load a standalone FBX animation clip onto the existing mixer ─────────────
function loadFBXAnimation(
  url: string,
  onLoaded: (clip: THREE.AnimationClip) => void,
): void {
  const fbxLoader = new FBXLoader();
  fbxLoader.load(
    url,
    (fbx) => {
      if (fbx.animations && fbx.animations.length > 0) {
        const clip = fbx.animations[0];
        
        // Empty loop removed

        // Sanitize runClip tracks to match Sonic's bone nomenclature
        const sanitizedTracks: THREE.KeyframeTrack[] = [];
        clip.tracks.forEach((track) => {
          const clone = track.clone();
          // Strip 'Armature.', 'Armature|', 'mixamorig:' prefixes
          clone.name = clone.name
            .replace(/^Armature\./, '')
            .replace(/^Armature\|/, '')
            .replace(/mixamorig:/g, 'mixamorig');
            
          // Prevent the root Armature 90-degree offset tracks from binding to the root mesh and causing a faceplant
          if (clone.name === 'quaternion' || clone.name === 'position' || clone.name === 'scale' || clone.name.startsWith('.')) {
            return; 
          }
          
          // Counter-rotate the baked 90-degree pitch on the Hips root bone
          if (clone.name.toLowerCase().includes('hips.quaternion')) {
            const correctionQuat = new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              -Math.PI / 2
            );
            const values = clone.values;
            for (let i = 0; i < values.length; i += 4) {
              const q = new THREE.Quaternion(values[i], values[i+1], values[i+2], values[i+3]);
              q.premultiply(correctionQuat);
              values[i] = q.x;
              values[i+1] = q.y;
              values[i+2] = q.z;
              values[i+3] = q.w;
            }
          }

          sanitizedTracks.push(clone);
        });

        const matchedClip = new THREE.AnimationClip(
          clip.name + '_Clean',
          clip.duration,
          sanitizedTracks
        );
        
        onLoaded(matchedClip);
      } else {
        console.warn(`No animations found in FBX: ${url}`);
      }
    },
    undefined,
    (error) => {
      console.error(`Failed to load FBX animation ${url}:`, error);
    },
  );
}

export function buildSonicGuide(scene: THREE.Scene) {
  const gltfLoader = new GLTFLoader();

  gltfLoader.load(
    '/models/sonic_animated.glb',
    (gltf) => {
      sonicInnerModel = gltf.scene;
      initialInnerRotation.copy(sonicInnerModel.rotation);
      
      // Reset any manual offsets
      sonicInnerModel.position.y = 0;
      
      sonicModel = new THREE.Group();
      swimPitchGroup = new THREE.Group();
      sonicModel.add(swimPitchGroup);
      swimPitchGroup.add(sonicInnerModel);
      
      // Scaled up a little bigger (to 4.5)
      sonicModel.scale.setScalar(4.5);
      sonicModel.position.copy(WAYPOINTS[0]);
      sonicModel.updateMatrixWorld(true);

      // Compute bounding box to plant shoes flush on the floor
      const box = new THREE.Box3().setFromObject(sonicModel);
      sonicBottomY = box.min.y - sonicModel.position.y;

      // Find Target Skeleton Bones
      headBone = null as THREE.Bone | null;
      rightHandBone = null as THREE.Bone | null;

      sonicModel.traverse((child) => {
        if (child.name.toLowerCase().includes('icosphere')) {
          child.visible = false;
          return;
        }
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
        if ((child as THREE.Bone).isBone) {
          const name = child.name.toLowerCase();

          if (name.includes('head') && !name.includes('end')) {
            headBone = child as THREE.Bone;
          }
          
          if (
            (name.includes('righthand') || name.includes('hand_r') || name.includes('hand.r') || (name.includes('hand') && name.includes('r'))) &&
            !name.includes('thumb') &&
            !name.includes('index') &&
            !name.includes('middle') &&
            !name.includes('ring') &&
            !name.includes('pinky')
          ) {
            rightHandBone = child as THREE.Bone;
          }
        }
      });

      // Build and attach procedural accessories
      headphonesGroup = buildProceduralHeadphones();
      if (headBone) {
        const headMount = new THREE.Group();
        headMount.name = 'SonicHeadMount';
        headMount.scale.setScalar(1 / 0.045); // cancels bone world scale
        headBone.add(headMount);
        headMount.add(headphonesGroup);
      }

      phoneGroup = buildProceduralSmartphone();
      if (rightHandBone) {
        phoneGroup.visible = false; 

        const handMount = new THREE.Group();
        handMount.name = 'SonicHandMount';
        handMount.scale.setScalar(1 / 0.045); // Cancels the 0.01 * 4.5 world scale of the bone
        rightHandBone.add(handMount);
        
        handMount.add(phoneGroup);
        phoneGroup.scale.set(1, 1, 1);
        
        phoneGroup.position.set(0.032, 0.142, 0.022); 
        phoneGroup.rotation.order = 'YZX';
        phoneGroup.rotation.set(3.60, -3.76, 19.86);

      } else {
        console.error("DEBUG ERROR: Missing RightHand Bone.");
      }

      scene.add(sonicModel);
      sonicMixer = new THREE.AnimationMixer(sonicInnerModel);

      const findClip = (name: string) =>
        gltf.animations.find((c) => c.name.toLowerCase().includes(name.toLowerCase())) ?? null;

      const walkClip = findClip('walk');
      const textClip = findClip('text');
      const talkClip = findClip('talk');

      if (walkClip) {
        lockRootMotionY(walkClip);
        walkAction = sonicMixer.clipAction(walkClip);
        walkAction.setEffectiveTimeScale(0.85);
        walkAction.play();
        currentAction = walkAction;
        console.log('✓ Sonic walk animation track example:', walkClip.tracks[0].name);
      }
      if (textClip) {
        textAction = sonicMixer.clipAction(textClip);
      }
      if (talkClip) {
        talkAction = sonicMixer.clipAction(talkClip);
        talkAction.loop = THREE.LoopRepeat;
      }

      // Load the 3 new FBX animation clips and register them on the mixer
      loadFBXAnimation('/models/sonic_running.fbx', (clip) => {
        if (!sonicMixer || !sonicModel) return;
        lockRootMotionY(clip);
        runAction = sonicMixer.clipAction(clip, sonicModel);
        runAction.loop = THREE.LoopRepeat;
        runAction.clampWhenFinished = false;
        runAction.setEffectiveTimeScale(1.2);
        console.log('✓ Sonic run animation loaded, track example:', clip.tracks[0].name);
      });

      loadFBXAnimation('/models/sonic_dive.fbx', (clip) => {
        if (!sonicMixer || !sonicModel) return;
        lockRootMotionY(clip);
        diveAction = sonicMixer.clipAction(clip, sonicModel);
        diveAction.loop = THREE.LoopOnce;
        diveAction.clampWhenFinished = true;
        console.log('✓ Sonic dive animation loaded');
      });

      loadFBXAnimation('/models/sonic_swimming.fbx', (clip) => {
        if (!sonicMixer || !sonicModel) return;
        const cleanTracks = clip.tracks.filter(track => !track.name.includes('.position'));
        const inPlaceSwimClip = new THREE.AnimationClip(
          clip.name,
          clip.duration,
          cleanTracks
        );
        swimAction = sonicMixer.clipAction(inPlaceSwimClip, sonicModel);
        swimAction.loop = THREE.LoopRepeat;
        swimAction.clampWhenFinished = false;
        console.log('✓ Sonic swim animation loaded');
      });

      console.log('Sonic guide loaded and added to scene successfully.');
    },
    undefined,
    (error) => {
      console.error('Failed to load Sonic animated model:', error);
    }
  );
}

export function disposeSonicGuide(scene?: THREE.Scene) {
  if (sonicModel) {
    if (scene) {
      scene.remove(sonicModel);
    }
  }
  sonicMixer?.stopAllAction();
  sonicMixer = null;
  sonicModel = null;
  headphonesGroup = null;
  phoneGroup = null;
  headBone = null;
  rightHandBone = null;
  walkAction = null;
  textAction = null;
  talkAction = null;
  runAction = null;
  diveAction = null;
  swimAction = null;
  currentAction = null;
  guideState = 'walk';
  targetWaypointIndex = 0;
  targetHabitatGate = null;
  targetHabitatName = null;
  swimTarget = null;
  swimPoolEdge = null;
}

export function interactWithSonic(_camera?: THREE.Camera) {
  if (isSwimming || guideState === 'interact') {
    if (!isSwimming) window.dispatchEvent(new CustomEvent('sonic-interact', { detail: { open: true } }));
    return;
  }
  guideState = 'interact';

  // Toggle phone visibility in text/interaction mode
  if (phoneGroup) {
    phoneGroup.visible = true;
  }

  // Crossfade to text (or talk)
  if (textAction) {
    crossFadeTo(textAction, 0.3);
  }

  // Dispatch custom event to React UI
  window.dispatchEvent(new CustomEvent('sonic-interact', { detail: { open: true } }));
}

export function closeSonicDialogue() {
  if (isSwimming || guideState === 'walk') return;
  guideState = 'walk';

  // Hide phone when returning to patrol walk
  if (phoneGroup) {
    phoneGroup.visible = false;
  }

  // Crossfade back to walk
  if (walkAction) {
    walkAction.setEffectiveTimeScale(0.85);
    crossFadeTo(walkAction, 0.3);
  }
}

// Add listener to allow React to call closeSonicDialogue from outside
window.addEventListener('sonic-close', closeSonicDialogue);

export function startSonicTalking() {
  if (isSwimming || isGuiding) return;
  if (talkAction && currentAction !== talkAction) {
    crossFadeTo(talkAction, 0.2);
  }
}

export function stopSonicTalking() {
  if (isSwimming || isGuiding) return;
  if (textAction && currentAction !== textAction) {
    crossFadeTo(textAction, 0.3);
  }
}

// ─── Navigate to Habitat ("Where is [habitat]?") ─────────────────────────────
export function navigateToHabitat(habitatName: string): boolean {
  if (!sonicModel) return false;
  
  const gate = getHabitatGatePosition(habitatName);
  if (!gate) return false;

  targetHabitatGate = gate;
  targetHabitatName = habitatName;
  guideState = 'run-to-habitat';
  isGuiding = true;

  // Build path network
  let startIdx = 0;
  let startDist = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const d = sonicModel.position.distanceToSquared(WAYPOINTS[i]);
    if (d < startDist) {
      startDist = d;
      startIdx = i;
    }
  }

  let endIdx = 0;
  let endDist = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const d = gate.distanceToSquared(WAYPOINTS[i]);
    if (d < endDist) {
      endDist = d;
      endIdx = i;
    }
  }

  runPathWaypoints = [];
  const len = WAYPOINTS.length;
  const diff = (endIdx - startIdx + len) % len;
  if (diff <= len / 2) {
    for (let i = 0; i <= diff; i++) runPathWaypoints.push(WAYPOINTS[(startIdx + i) % len]);
  } else {
    const revDiff = len - diff;
    for (let i = 0; i <= revDiff; i++) runPathWaypoints.push(WAYPOINTS[(startIdx - i + len) % len]);
  }
  runPathWaypoints.push(gate);
  runWaypointIndex = 0;

  // Hide phone
  if (phoneGroup) phoneGroup.visible = false;

  // Stop any active clips
  if (sonicMixer) {
    sonicMixer.stopAllAction();
  }

  // Explicitly clear any swim/dive pitch offsets
  if (sonicInnerModel) {
    sonicInnerModel.rotation.copy(initialInnerRotation);
  }

  // Start running action
  if (runAction) {
    runAction.reset();
    runAction.enabled = true;
    runAction.setLoop(THREE.LoopRepeat, Infinity);
    runAction.setEffectiveTimeScale(1.0);
    runAction.setEffectiveWeight(1.0);
    runAction.fadeIn(0.2).play();
    currentAction = runAction;
    console.log('Running animation active:', runAction.isRunning(), runAction.getClip().tracks.length);
  } else if (walkAction) {
    walkAction.reset();
    walkAction.enabled = true;
    walkAction.setEffectiveTimeScale(1.6);
    walkAction.setEffectiveWeight(1.0);
    walkAction.fadeIn(0.2).play();
    currentAction = walkAction;
  }

  return true;
}

// ─── Pool Swimming Routine ("Sonic swim") ────────────────────────────────────
export function startSwimRoutine(): boolean {
  if (!sonicModel) return false;

  // Find nearest point on pool edge (promenade radius)
  const angle = Math.atan2(sonicModel.position.x, sonicModel.position.z);
  swimPoolEdge = new THREE.Vector3(
    Math.sin(angle) * (POOL_RADIUS + 0.5),
    GROUND_Y,
    Math.cos(angle) * (POOL_RADIUS + 0.5),
  );

  // Opposite side of the pool
  swimTarget = new THREE.Vector3(
    Math.sin(angle + Math.PI) * (POOL_RADIUS + 0.5),
    GROUND_Y,
    Math.cos(angle + Math.PI) * (POOL_RADIUS + 0.5),
  );

  guideState = 'run-to-pool';
  isSwimming = true;
  diveEntryPos = null;

  // Stop any idle/talking action that might have been queued
  if (textAction && currentAction === textAction) textAction.stop();
  if (talkAction && currentAction === talkAction) talkAction.stop();

  // Hide phone
  if (phoneGroup) phoneGroup.visible = false;

  // Cross-fade to run (or fast walk)
  if (runAction) {
    runAction.setEffectiveTimeScale(1.2);
    crossFadeTo(runAction, 0.25);
  } else if (walkAction) {
    walkAction.setEffectiveTimeScale(1.6);
    crossFadeTo(walkAction, 0.25);
  }

  return true;
}

// ─── Find the closest waypoint on the promenade ring ─────────────────────────
function snapToNearestWaypoint(): void {
  if (!sonicModel) return;
  let closestIdx = 0;
  let closestDistSq = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const d = sonicModel.position.distanceToSquared(WAYPOINTS[i]);
    if (d < closestDistSq) {
      closestDistSq = d;
      closestIdx = i;
    }
  }
  targetWaypointIndex = (closestIdx + 1) % WAYPOINTS.length;
}

// ─── Movement helpers ────────────────────────────────────────────────────────
function moveToward(target: THREE.Vector3, speed: number, dt: number): { arrived: boolean; dx: number; dz: number } {
  if (!sonicModel) return { arrived: true, dx: 0, dz: 0 };

  const dx = target.x - sonicModel.position.x;
  const dz = target.z - sonicModel.position.z;
  const distSq = dx * dx + dz * dz;

  // Turn toward target
  const targetAngle = Math.atan2(dx, dz);
  let deltaAngle = targetAngle - sonicModel.rotation.y;
  while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
  while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
  const turnSpeed = 5.0;
  const maxTurn = turnSpeed * dt;
  sonicModel.rotation.y += Math.max(-maxTurn, Math.min(maxTurn, deltaAngle));

  // Move forward
  const forwardFactor = Math.max(0, Math.cos(deltaAngle));
  const moveDist = speed * forwardFactor * dt;
  sonicModel.position.x += Math.sin(sonicModel.rotation.y) * moveDist;
  sonicModel.position.z += Math.cos(sonicModel.rotation.y) * moveDist;

  const arrived = distSq < 4.0; // 2m threshold
  return { arrived, dx, dz };
}

export function updateSonicGuide(dt: number, camera: THREE.Camera) {
  if (!sonicModel) return;
  const safeDt = Math.min(Math.max(dt, 0), 0.05);

  if (sonicMixer) sonicMixer.update(safeDt);

  // Live-update accessory offsets so you can tune them via Vite HMR
  if (headphonesGroup) {
    headphonesGroup.position.set(HEADPHONES_OFFSETS.posX, HEADPHONES_OFFSETS.posY, HEADPHONES_OFFSETS.posZ);
    headphonesGroup.rotation.set(HEADPHONES_OFFSETS.rotX, HEADPHONES_OFFSETS.rotY, HEADPHONES_OFFSETS.rotZ);
    headphonesGroup.scale.set(HEADPHONES_OFFSETS.scaleX, HEADPHONES_OFFSETS.scaleY, HEADPHONES_OFFSETS.scaleZ);
  }

  // ─── State: WALK (default patrol) ──────────────────────────────────────────
  if (guideState === 'walk') {
    // HARD BOUNDARY LEASH & RECOVERY (updated for enlarged promenade)
    const distFromCenter = Math.hypot(sonicModel.position.x, sonicModel.position.z);
    if (distFromCenter > 32.0 || distFromCenter < 25.0 || isNaN(distFromCenter)) {
      snapToNearestWaypoint();
      // Hard clamp if severely out of bounds
      if (distFromCenter > 35.0 || distFromCenter < 23.0 || isNaN(distFromCenter)) {
        let closestIdx = 0;
        let closestDistSq = Infinity;
        for (let i = 0; i < WAYPOINTS.length; i++) {
          const d = sonicModel.position.distanceToSquared(WAYPOINTS[i]);
          if (d < closestDistSq) {
            closestDistSq = d;
            closestIdx = i;
          }
        }
        sonicModel.position.copy(WAYPOINTS[closestIdx]);
      }
    }

    // Patrol along waypoints
    let target = WAYPOINTS[targetWaypointIndex];
    let dx = target.x - sonicModel.position.x;
    let dz = target.z - sonicModel.position.z;
    let distSq = dx * dx + dz * dz;

    // Arrived at waypoint: advance to next
    if (distSq < 1.44) {
      targetWaypointIndex = (targetWaypointIndex + 1) % WAYPOINTS.length;
      target = WAYPOINTS[targetWaypointIndex];
      dx = target.x - sonicModel.position.x;
      dz = target.z - sonicModel.position.z;
      distSq = dx * dx + dz * dz;
    }

    const targetAngle = Math.atan2(dx, dz);
    let deltaAngle = targetAngle - sonicModel.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    
    const turnSpeed = 3.5;
    const maxTurn = turnSpeed * safeDt;
    sonicModel.rotation.y += Math.max(-maxTurn, Math.min(maxTurn, deltaAngle));
    
    const forwardFactor = Math.max(0, Math.cos(deltaAngle));
    const strollSpeed = 1.0;
    const moveDist = strollSpeed * forwardFactor * safeDt;
    sonicModel.position.x += Math.sin(sonicModel.rotation.y) * moveDist;
    sonicModel.position.y = GROUND_Y - sonicBottomY;
    sonicModel.position.z += Math.cos(sonicModel.rotation.y) * moveDist;

  // ─── State: INTERACT ───────────────────────────────────────────────────────
  } else if (guideState === 'interact') {
    // Smoothly turn to face camera
    const dx = camera.position.x - sonicModel.position.x;
    const dz = camera.position.z - sonicModel.position.z;
    const targetAngle = Math.atan2(dx, dz);
    
    let deltaAngle = targetAngle - sonicModel.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

    const turnSpeed = 4.0;
    const maxTurn = turnSpeed * safeDt;
    sonicModel.rotation.y += Math.max(-maxTurn, Math.min(maxTurn, deltaAngle));

  // ─── State: RUN TO HABITAT ─────────────────────────────────────────────────
  } else if (guideState === 'run-to-habitat' && targetHabitatGate) {
    const runSpeed = 9.0;
    
    const nextWaypoint = runPathWaypoints[runWaypointIndex];
    const moveDir = new THREE.Vector3().subVectors(nextWaypoint, sonicModel.position);
    moveDir.y = 0;
    
    if (moveDir.length() > 0.8) {
      const moveAngle = Math.atan2(moveDir.x, moveDir.z);
      sonicModel.rotation.set(0, moveAngle, 0);
      sonicModel.position.addScaledVector(moveDir.normalize(), runSpeed * safeDt);
    } else {
      if (runWaypointIndex < runPathWaypoints.length - 1) {
        runWaypointIndex++;
      } else {
        guideState = 'interact';
        isGuiding = false;
        targetHabitatGate = null;

        // Turn to camera
        const dx = camera.position.x - sonicModel.position.x;
        const dz = camera.position.z - sonicModel.position.z;
        sonicModel.rotation.y = Math.atan2(dx, dz);

        // Decelerate: cross-fade to idle/text
        if (phoneGroup) phoneGroup.visible = true;
        if (runAction && currentAction === runAction) runAction.fadeOut(0.3);
        if (textAction) {
          textAction.reset().fadeIn(0.3).play();
          currentAction = textAction;
        } else if (walkAction) {
          walkAction.setEffectiveTimeScale(0.85);
          walkAction.reset().fadeIn(0.3).play();
          currentAction = walkAction;
        }

        // Dispatch so the React UI opens Sonic's chat bubble
        window.dispatchEvent(new CustomEvent('sonic-interact', { detail: { open: true } }));

        // Dispatch event with habitat name for the UI to display the guide message
        window.dispatchEvent(new CustomEvent('sonic-arrived-habitat', { detail: { habitat: targetHabitatName } }));
        targetHabitatName = null;
      }
    }
    
    // Apply Offset Only If Running Clips Dip
    if (isGuiding && currentAction === runAction) {
      sonicModel.position.y = GROUND_Y - sonicBottomY + 0.38;
    } else {
      sonicModel.position.y = GROUND_Y - sonicBottomY;
    }

  // ─── State: RUN TO POOL EDGE ───────────────────────────────────────────────
  } else if (guideState === 'run-to-pool' && swimPoolEdge) {
    const runSpeed = 2.5;
    const { arrived } = moveToward(swimPoolEdge, runSpeed, safeDt);
    sonicModel.position.y = GROUND_Y - sonicBottomY;

    if (arrived) {
      // At pool edge — start dive
      guideState = 'dive';
      diveTimer = 0;
      if (diveAction) {
        crossFadeTo(diveAction, 0.2);
      }
    }

  // ─── State: DIVE ───────────────────────────────────────────────────────────
  } else if (guideState === 'dive') {
    diveTimer += safeDt;
    // Parabolic Y arc: starts at GROUND_Y, dips down to SWIM_Y
    const t = Math.min(diveTimer / DIVE_DURATION, 1.0);
    // Quadratic ease: y = GROUND_Y + (SWIM_Y - GROUND_Y) * t^2 with a mid-air hop
    const jumpPeak = 1.5; // peak height above ground
    const arcY = GROUND_Y + jumpPeak * 4 * t * (1 - t) + (SWIM_Y - GROUND_Y) * t * t;
    sonicModel.position.y = arcY;

    // Move slightly forward into the water during dive
    if (swimTarget) {
      const dx = swimTarget.x - sonicModel.position.x;
      const dz = swimTarget.z - sonicModel.position.z;
      const targetAngle = Math.atan2(dx, dz);
      sonicModel.rotation.y = targetAngle;
      const fwdSpeed = 3.0 * safeDt;
      sonicModel.position.x += Math.sin(targetAngle) * fwdSpeed;
      sonicModel.position.z += Math.cos(targetAngle) * fwdSpeed;
    }

    if (t >= 1.0) {
      // Dive complete — switch to swim
      guideState = 'swim';
      diveEntryPos = sonicModel.position.clone(); // Save entry for lerp
      sonicModel.position.y = SWIM_Y;
      
      if (currentAction) currentAction.fadeOut(0.2);
      if (swimAction) {
        swimAction.reset().fadeIn(0.2).play();
        currentAction = swimAction;
      } else if (runAction) {
        runAction.setEffectiveTimeScale(0.8);
        runAction.reset().fadeIn(0.2).play();
        currentAction = runAction;
      }
    }

  // ─── State: SWIM ───────────────────────────────────────────────────────────
  } else if (guideState === 'swim' && swimTarget && diveEntryPos) {
    const swimSpeed = 1.8;
    
    // 3. Fixed Water Immersion (Y-Level Clamping)
    sonicModel.position.y = SWIM_Y; // Keep submerged strictly

    // 1. Outer Group: Rotate only this group toward the swim destination using pure yaw
    const dx = swimTarget.x - sonicModel.position.x;
    const dz = swimTarget.z - sonicModel.position.z;
    const targetAngle = Math.atan2(dx, dz);
    sonicModel.rotation.set(0, targetAngle, 0);

    // Inner Model: pitch forward -90° so Sonic lies prone (belly down, quills up)
    // +PI/2 was supine (belly sky / handstand); -PI/2 is the correct prone posture.
    if (swimPitchGroup) {
      swimPitchGroup.rotation.set(-Math.PI * 0.31, 0, 0); // ~56° tilt — realistic swimming lean, head angled up
    }
    if (sonicInnerModel) {
      sonicInnerModel.rotation.set(0, 0, 0);
    }

    // 2. Smooth Linear World Translation across the pond
    const dir = new THREE.Vector3().subVectors(swimTarget, sonicModel.position);
    dir.y = 0;
    const dist = dir.length();

    if (dist > 0.4) {
      dir.normalize();
      sonicModel.position.addScaledVector(dir, swimSpeed * safeDt);
      sonicModel.position.y = SWIM_Y;
    } else {
      // 4. Proper Pool Exit Execution
      guideState = 'exit-water';
      exitWaterTimer = 0;
    }

  // ─── State: EXIT WATER ─────────────────────────────────────────────────────
  } else if (guideState === 'exit-water') {
    exitWaterTimer += safeDt;
    const t = Math.min(exitWaterTimer / EXIT_WATER_DURATION, 1.0);
    // Smoothly raise Y from SWIM_Y back to GROUND_Y
    sonicModel.position.y = SWIM_Y + (GROUND_Y - SWIM_Y) * t;

    // Slight forward movement to get onto shore
    sonicModel.position.x += Math.sin(sonicModel.rotation.y) * 1.5 * safeDt;
    sonicModel.position.z += Math.cos(sonicModel.rotation.y) * 1.5 * safeDt;

    if (t >= 1.0) {
      // Fully on shore — resume patrol
      guideState = 'walk';
      isSwimming = false;
      sonicModel.position.y = GROUND_Y;
      swimTarget = null;
      swimPoolEdge = null;

      // Reset swim wrapper so he stands fully upright on exit
      if (swimPitchGroup) {
        swimPitchGroup.rotation.set(0, 0, 0);
      }
      // Restore inner model to its original loaded orientation
      if (sonicInnerModel) {
        sonicInnerModel.rotation.copy(initialInnerRotation);
      }
      
      // Cross-fade back to walk
      if (walkAction) {
        walkAction.setEffectiveTimeScale(0.85);
        crossFadeTo(walkAction, 0.3);
      }

      // Snap to nearest waypoint so patrol resumes smoothly
      snapToNearestWaypoint();
    }
  }
}
