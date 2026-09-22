import * as THREE from 'three';
import type { AnimalData } from './types';
import { HABITATS } from './habitats';
import { savannaWaterHole } from './animals';

// ---------------------------------------------------------------------------
// Movement speeds — world units per frame at ~60 fps
// Calibrated with stride frequency to prevent foot-sliding
// ---------------------------------------------------------------------------
const SPEEDS: Record<string, number> = {
  lion:     0.014,
  elephant: 0.018,
  giraffe:  0.011,
  zebra:    0.015,
  monkey:   0.028,
  snake:    0.016,
  bird:     0.036,
  turtle:   0.007,
  fish:     0.020,
  shark:    0.025,
  rabbit:   0.032,
  wolf:     0.020,
};

const ARRIVAL_DIST = 1.4;
const FLY_HEIGHT   = 5.0;   // bird cruising altitude (fits inside r=30 aviary dome)

// Turn-rate per frame — how quickly the animal swings to face its target
const TURN_RATE: Record<string, number> = {
  elephant: 0.040,
  giraffe:  0.045,
  lion:     0.080,
  zebra:    0.090,
  turtle:   0.030,
  shark:    0.080,
  wolf:     0.090,
  default:  0.060,
};

// Idle pause chance and duration ranges
const IDLE_CHANCE = 0.30;
const IDLE_RANGE: Record<string, [number, number]> = {
  lion:     [1.5, 4.0],
  elephant: [2.0, 5.0],
  giraffe:  [1.0, 3.0],
  zebra:    [0.8, 2.0],
  monkey:   [1.0, 3.0],
  snake:    [2.0, 6.0],
  bird:     [0.3, 1.0],
  turtle:   [3.0, 8.0],
  fish:     [0.5, 2.0],
  rabbit:   [0.4, 1.2],
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function animateAnimals(
  animals: AnimalData[],
  elapsed: number,
  dt: number,
): void {
  animals.forEach(animal => {
    // 1. Update embedded skeletal animations if mixer exists
    if (animal.mixer) {
      animal.mixer.update(dt);
    }

    const t = elapsed + animal.phaseOffset;

    // Idle countdown — gentle breathing only
    if (animal.idleUntil !== undefined && elapsed < animal.idleUntil) {
      animateIdle(animal, t);
      return;
    }

    // Per-type body animation + movement
    switch (animal.animationType) {
      case 'walk':    animateWalk(animal, t);    wander(animal, elapsed);          break;
      case 'hop':     animateHop(animal, t);     wander(animal, elapsed);          break;
      case 'jump':    animateJump(animal, t, elapsed); /* movement inside */       break;
      case 'slither': animateSlither(animal, t); wander(animal, elapsed);          break;
      case 'fly':     animateFly(animal, t);     wanderFly(animal, elapsed);       break;
      case 'swim':    animateSwim(animal, t);    wander(animal, elapsed);          break;
    }

  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHabitat(animal: AnimalData) {
  return HABITATS.find(h => h.name === animal.habitat)!;
}

function pickTarget(animal: AnimalData): THREE.Vector3 {
  const h = getHabitat(animal);
  const margin = animal.animationType === 'swim' ? 4.5 : 3.5;
  const rad = Math.max(0.1, h.radius - margin); // Clamp to prevent NaN distance
  const y = animal.animationType === 'swim' ? -1.10 : 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    const r = Math.sqrt(Math.random()) * rad;
    const a = Math.random() * Math.PI * 2;
    const pt = new THREE.Vector3(h.center.x + Math.cos(a) * r, y, h.center.z + Math.sin(a) * r);
    
    // Reroll if inside savanna water hole
    if (animal.habitat === 'Savanna') {
      const dx = pt.x - savannaWaterHole.center.x;
      const dz = pt.z - savannaWaterHole.center.y;
      if (Math.hypot(dx, dz) < savannaWaterHole.radius) continue;
    }
    return pt;
  }
  // Fallback
  return h.center.clone();
}

/** Smoothly rotate the group to face (dx, dz) in world space — Euler Y only */
function faceDirection(animal: AnimalData, dx: number, dz: number): void {
  if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) return;
  const target = Math.atan2(dx, dz);
  const cur    = animal.group.rotation.y;
  let delta    = target - cur;
  // Shortest-arc wrap
  while (delta >  Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const rate = TURN_RATE[animal.id] ?? TURN_RATE['default'];
  animal.group.rotation.y += delta * rate;
}

// ---------------------------------------------------------------------------
// Ground wander (walk / hop / slither / swim)
// ---------------------------------------------------------------------------
function wander(animal: AnimalData, elapsed: number): void {
  const pos    = animal.group.position;
  const target = animal.wanderTarget;

  let dx = target.x - pos.x;
  let dz = target.z - pos.z;

  // Repulsion & Path correction for Savanna animals
  if (animal.habitat === 'Savanna') {
    const wx = savannaWaterHole.center.x;
    const wz = savannaWaterHole.center.y;
    const wr = savannaWaterHole.radius;
    
    // Hard physical boundary push if they somehow get inside
    const dxPos = pos.x - wx;
    const dzPos = pos.z - wz;
    const distToCenter = Math.hypot(dxPos, dzPos);
    
    if (distToCenter < wr) {
      const rep = (wr - distToCenter) * 0.1; 
      pos.x += (dxPos / distToCenter) * rep;
      pos.z += (dzPos / distToCenter) * rep;
    }
    
    // Steering avoidance (Flow field)
    const avoidRadius = wr + 4.0;
    if (distToCenter < avoidRadius) {
      const repStrength = Math.max(0, (avoidRadius - distToCenter) / 4.0);
      // Pushes the desired direction outward
      dx += (dxPos / distToCenter) * repStrength * 8.0;
      dz += (dzPos / distToCenter) * repStrength * 8.0;
      
      // Tangent force to skirt the edge
      const tangentDir = animal.id === 'elephant' ? 1 : -1;
      dx += (-dzPos / distToCenter) * repStrength * 6.0 * tangentDir;
      dz += (dxPos / distToCenter) * repStrength * 6.0 * tangentDir;
    }
  }

  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < ARRIVAL_DIST) {
    if (Math.random() < IDLE_CHANCE) {
      const [mn, mx] = IDLE_RANGE[animal.id] ?? [1, 3];
      animal.idleUntil = elapsed + mn + Math.random() * (mx - mn);
    }
    animal.wanderTarget = pickTarget(animal);
    return;
  }

  const spd = SPEEDS[animal.id] ?? 0.025;
  faceDirection(animal, dx, dz);

  // Move directly toward target on the XZ plane (never affects Y)
  const nx = dx / dist;
  const nz = dz / dist;
  pos.x += nx * spd;
  pos.z += nz * spd;
}

// ---------------------------------------------------------------------------
// Flying wander — stays at FLY_HEIGHT; the animateFly sets y each frame
// ---------------------------------------------------------------------------
function wanderFly(animal: AnimalData, elapsed: number): void {
  const pos    = animal.group.position;
  const target = animal.wanderTarget;
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist   = Math.sqrt(dx * dx + dz * dz);

  if (dist < ARRIVAL_DIST * 2) {
    if (Math.random() < IDLE_CHANCE * 0.5) {
      const [mn, mx] = IDLE_RANGE['bird'];
      animal.idleUntil = elapsed + mn + Math.random() * (mx - mn);
    }
    animal.wanderTarget = pickTarget(animal);
    return;
  }

  const spd = SPEEDS['bird'];
  faceDirection(animal, dx, dz);

  // Move directly toward target on XZ plane
  const nx = dx / dist;
  const nz = dz / dist;
  pos.x += nx * spd;
  pos.z += nz * spd;
}

// ---------------------------------------------------------------------------
// IDLE — breathing sway, slow head look-around
// ---------------------------------------------------------------------------
function animateIdle(animal: AnimalData, t: number): void {
  // Micro body-rise on inhale (maintains submerged depth for aquatic animals)
  if (animal.animationType === 'swim') {
    animal.group.position.y = -1.10 + Math.sin(t * 1.1) * 0.04;
  } else if (animal.animationType === 'fly') {
    animal.group.position.y = FLY_HEIGHT + Math.sin(t * 1.1) * 0.12;
  }
  animal.group.rotation.z = Math.sin(t * 0.7) * 0.010;

  const wrapper = animal.parts['modelWrapper'];
  if (wrapper) {
    const baseRotX = (wrapper.userData.baseRotX as number) ?? 0;
    const baseRotY = (wrapper.userData.baseRotY as number) ?? wrapper.rotation.y;
    const baseRotZ = (wrapper.userData.baseRotZ as number) ?? 0;
    wrapper.rotation.x = baseRotX + Math.sin(t * 1.2) * 0.012;
    wrapper.rotation.y = baseRotY + Math.sin(t * 0.6) * 0.010;
    wrapper.rotation.z = baseRotZ;
  }

  if (animal.parts['head']) {
    animal.parts['head'].rotation.x = Math.sin(t * 0.55) * 0.04;
    animal.parts['head'].rotation.y = Math.sin(t * 0.38) * 0.08;
  }
  if (animal.parts['tail']) {
    animal.parts['tail'].rotation.y = Math.sin(t * 1.4) * 0.18;
  }
}

// ---------------------------------------------------------------------------
// SAVANNA QUADRUPED GAIT (Lion, Zebra, Elephant, Giraffe)
// ---------------------------------------------------------------------------
function animateSavannaWalk(animal: AnimalData, t: number): void {
  const isElephant = animal.id === 'elephant';
  const isGiraffe  = animal.id === 'giraffe';
  const isLion     = animal.id === 'lion';
  const isZebra    = animal.id === 'zebra';

  // Specific frequencies tuned to match step lengths
  let freq = 3.2;

  if (isElephant) {
    freq = 2.1;
  } else if (isGiraffe) {
    freq = 2.4;
  } else if (isLion) {
    freq = 3.2;
  } else if (isZebra) {
    freq = 3.6;
  }

  // Model Wrapper Secondary Motion (Enhances both rigged GLTF models & procedural meshes)
  const wrapper = animal.parts['modelWrapper'];
  if (wrapper) {
    const baseRotX = (wrapper.userData.baseRotX as number) ?? 0;
    const baseRotY = (wrapper.userData.baseRotY as number) ?? wrapper.rotation.y;
    const baseRotZ = (wrapper.userData.baseRotZ as number) ?? 0;

    if (isGiraffe) {
      // Giraffe: slow, majestic stride, gentle forward/backward neck counter-sway, high ground clearance
      wrapper.rotation.z = baseRotZ + Math.sin(t * freq) * 0.030;
      wrapper.rotation.x = baseRotX + Math.sin(t * freq) * 0.038;
      wrapper.rotation.y = baseRotY + Math.sin(t * freq * 0.5) * 0.018;
    } else if (isElephant) {
      // Elephant: heavy, deliberate pacing, subtle torso bounce, horizontal head/trunk sway
      wrapper.rotation.z = baseRotZ + Math.sin(t * freq) * 0.024;
      wrapper.rotation.x = baseRotX + Math.sin(t * freq * 2.0) * 0.020;
      wrapper.rotation.y = baseRotY + Math.sin(t * freq) * 0.022;
    } else if (isLion) {
      // Lion: supple feline strides with rhythmic shoulder roll & spine pitch
      wrapper.rotation.z = baseRotZ + Math.sin(t * freq) * 0.040;
      wrapper.rotation.x = baseRotX + Math.sin(t * freq * 2.0) * 0.032;
      wrapper.rotation.y = baseRotY + Math.sin(t * freq) * 0.020;
    } else if (isZebra) {
      // Zebra: active, smooth equine strides with rhythmic gallop/trot bounce
      wrapper.rotation.z = baseRotZ + Math.sin(t * freq) * 0.045;
      wrapper.rotation.x = baseRotX + Math.sin(t * freq * 2.0) * 0.036;
      wrapper.rotation.y = baseRotY + Math.sin(t * freq) * 0.024;
    }
  }

  // Head and Neck secondary motion (skip if embedded skeleton handles it)
  if (animal.parts['head'] && !animal.mixer) {
    if (isGiraffe) {
      animal.parts['head'].rotation.x = Math.sin(t * freq) * 0.06;
      animal.parts['head'].rotation.y = Math.sin(t * freq * 0.5) * 0.04;
    } else if (isElephant) {
      animal.parts['head'].rotation.y = Math.sin(t * freq) * 0.07;
      animal.parts['head'].rotation.x = Math.sin(t * freq * 2.0) * 0.03;
    } else if (isLion || isZebra) {
      animal.parts['head'].rotation.x = Math.sin(t * freq * 2.0) * 0.04;
      animal.parts['head'].rotation.y = Math.sin(t * freq) * 0.03;
    }
  }

  if (animal.parts['neck'] && !animal.mixer && (isGiraffe || isLion || isZebra)) {
    animal.parts['neck'].rotation.x = Math.sin(t * freq) * 0.05;
  }

  if (animal.parts['tail'] && !animal.mixer) {
    animal.parts['tail'].rotation.y = Math.sin(t * freq * 1.5) * 0.20;
  }

  if (isElephant && !animal.mixer) {
    // S-curve trunk sway
    for (let i = 0; i < 5; i++) {
      const seg = animal.parts[`trunk${i}`];
      if (seg) {
        // Delay phase for each segment to create a wave
        seg.rotation.x = Math.sin(t * freq * 1.2 - i * 0.5) * 0.15;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// WALK  — generic diagonal trot gait for non-savanna walkers
// ---------------------------------------------------------------------------
function animateWalk(animal: AnimalData, t: number): void {
  // Exclusively route savanna animals to custom quadruped gait
  if (['lion', 'zebra', 'elephant', 'giraffe'].includes(animal.id)) {
    animateSavannaWalk(animal, t);
    return;
  }

  const speed = SPEEDS[animal.id] ?? 0.025;
  // Step frequency scales with movement speed so fast animals step faster
  const freq  = THREE.MathUtils.clamp(speed * 110, 2.2, 5.5);

  // Upper thigh swing amplitude
  const swingAmp  = 0.40;
  // Knee-bend amplitude
  const kneeBend  = 0.55;

  // Phase values — diagonal pairs 180° apart
  const phA = Math.sin(t * freq);            // FL + BR
  const phB = Math.sin(t * freq + Math.PI);  // FR + BL  (opposite)

  // Helper: apply thigh swing + knee bend to one leg pair
  function applyLegPair(
    upperNames: string[],
    lowerNames: string[],
    phase: number,
  ): void {
    const thighAngle = phase * swingAmp;
    const kneeAngle  = Math.max(0, phase) * kneeBend;

    upperNames.forEach(n => {
      const u = animal.parts[n];
      if (u) u.rotation.x = thighAngle;
    });
    lowerNames.forEach(n => {
      const l = animal.parts[n];
      if (l) l.rotation.x = kneeAngle;
    });
  }

  // Diagonal pair A: Front-Left + Back-Right
  applyLegPair(
    ['legFL', 'legBR'],
    ['legLowerFL', 'legLowerBR'],
    phA,
  );
  // Diagonal pair B: Front-Right + Back-Left
  applyLegPair(
    ['legFR', 'legBL'],
    ['legLowerFR', 'legLowerBL'],
    phB,
  );

  // Dynamic procedural quadruped locomotion for imported 3D models (GLB models)
  const wrapper = animal.parts['modelWrapper'];
  if (wrapper) {
    const baseRotX = (wrapper.userData.baseRotX as number) ?? 0;
    const baseRotY = (wrapper.userData.baseRotY as number) ?? wrapper.rotation.y;
    const baseRotZ = (wrapper.userData.baseRotZ as number) ?? 0;

    // Natural quadruped walking gait:
    // Alternating shoulder / hip roll with each stride
    wrapper.rotation.z = baseRotZ + Math.sin(t * freq) * 0.042;
    // Forward / backward pitch as paws / hooves push off
    wrapper.rotation.x = baseRotX + Math.sin(t * freq * 2.0) * 0.026;
    // Subtle rhythmic yaw heading sway
    wrapper.rotation.y = baseRotY + Math.sin(t * freq) * 0.022;
  }

  // For turtle: slow forward / backward rowing paddling flipper motion
  if (animal.id === 'turtle') {
    const tFreq = 2.0;
    const paddlePhase = Math.sin(t * tFreq);
    const recoveryPhase = Math.cos(t * tFreq);

    ['FL', 'FR', 'BL', 'BR'].forEach(key => {
      const flipper = animal.parts[`flipper${key}`] ?? animal.parts[`leg${key}`];
      if (!flipper) return;
      const baseRotY = (flipper.userData['baseRotY'] as number) ?? flipper.rotation.y;
      const baseRotZ = (flipper.userData['baseRotZ'] as number) ?? flipper.rotation.z;
      const isLeft = key.endsWith('L');
      const isFront = key.startsWith('F');

      // Rowing stroke: angle around Y (forward / backward rowing)
      const sign = isLeft ? 1 : -1;
      const strokeAmp = isFront ? 0.44 : 0.32;
      const phase = isFront ? paddlePhase : Math.sin(t * tFreq + Math.PI * 0.5);

      flipper.rotation.y = baseRotY + phase * strokeAmp * sign;
      // Hydrodynamic feathering pitch during recovery
      flipper.rotation.x = recoveryPhase * 0.12 * (isFront ? 1 : 0.6);
      flipper.rotation.z = baseRotZ + Math.sin(t * tFreq) * 0.06 * sign;
    });

    // Slow head look-around / bob
    if (animal.parts['head']) {
      animal.parts['head'].rotation.y = Math.sin(t * 1.1) * 0.12;
      animal.parts['head'].rotation.x = Math.sin(t * tFreq) * 0.04;
    }
    animal.group.position.y = 0;
    return;
  }

  // For monkey: quadruped / knuckle-walking grounded gait with arm/leg swing,
  // elbow/knee articulation, hip sway, synchronized vertical bounce, and tail curl
  if (animal.id === 'monkey') {
    const mFreq = 3.6;
    const phA = Math.sin(t * mFreq);            // Front-Left Arm + Back-Right Leg
    const phB = Math.sin(t * mFreq + Math.PI);  // Front-Right Arm + Back-Left Leg

    // Forelimb Arm swing (Shoulders & Elbows)
    if (animal.parts['lArm']) animal.parts['lArm'].rotation.x = phA * 0.38;
    if (animal.parts['lElbow']) animal.parts['lElbow'].rotation.x = -0.15 + Math.max(0, phA) * 0.25;
    if (animal.parts['rArm']) animal.parts['rArm'].rotation.x = phB * 0.38;
    if (animal.parts['rElbow']) animal.parts['rElbow'].rotation.x = -0.15 + Math.max(0, phB) * 0.25;

    // Hind Leg swing (Hips & Knees)
    if (animal.parts['legBL']) animal.parts['legBL'].rotation.x = phB * 0.36;
    if (animal.parts['legLowerBL']) animal.parts['legLowerBL'].rotation.x = Math.max(0, phB) * 0.35;
    if (animal.parts['legBR']) animal.parts['legBR'].rotation.x = phA * 0.36;
    if (animal.parts['legLowerBR']) animal.parts['legLowerBR'].rotation.x = Math.max(0, phA) * 0.35;

    // Head subtle bob
    if (animal.parts['head']) {
      animal.parts['head'].rotation.x = Math.sin(t * mFreq) * 0.04;
      animal.parts['head'].rotation.y = Math.sin(t * 0.8) * 0.08;
    }

    // Prehensile tail curl & idle sway
    if (animal.parts['tail']) {
      animal.parts['tail'].rotation.y = Math.sin(t * 1.5) * 0.22;
      animal.parts['tail'].rotation.x = 0.15 + Math.sin(t * 3.0) * 0.10;
    }

    // Subtle hip sway and vertical bounce synced to each footstep
    animal.group.rotation.z = Math.sin(t * mFreq) * 0.018;
    animal.group.position.y = Math.abs(Math.sin(t * mFreq)) * 0.024;
    return;
  }

  // Head nod (one small nod per two steps)
  if (animal.parts['head']) {
    animal.parts['head'].rotation.x = Math.sin(t * freq) * 0.045;
  }
  // Neck subtle counter-sway
  if (animal.parts['neck']) {
    animal.parts['neck'].rotation.z = -0.28 + Math.sin(t * freq * 0.5) * 0.04;
  }
  // Tail lazy wag (slower than steps)
  if (animal.parts['tail']) {
    animal.parts['tail'].rotation.y = Math.sin(t * freq * 0.55) * 0.22;
  }

  // Subtle lateral lean into each step
  animal.group.rotation.z = Math.sin(t * freq) * 0.015;
}

// ---------------------------------------------------------------------------
// HOP  — rabbit parabolic bound
// Two phases per cycle: push-off (back legs extend) → fly → land (absorb)
// ---------------------------------------------------------------------------
function animateHop(animal: AnimalData, t: number): void {
  const freq  = 3.0;
  const phase = t * freq;

  // Smooth parabola: rises fast, lingers at top, hits ground hard
  // abs(sin) gives 0→1→0 per half-cycle; power < 1 flattens the peak
  const rawHop = Math.abs(Math.sin(phase));
  const hop    = Math.pow(rawHop, 0.55);  // lingers in air

  animal.group.position.y = hop * 0.34;

  // Body pitches forward during launch, levels off, pitches back on landing
  animal.group.rotation.x = Math.sin(phase) * 0.12;

  // Back legs: push (hip back + knee extending) on launch, tuck mid-air
  for (const n of ['legBL', 'legBR']) {
    const upper = animal.parts[n];
    const lower = animal.parts[`legLower${n.slice(3)}`];
    if (upper) upper.rotation.x = -hop * 0.55;          // hip swings back on push
    if (lower) lower.rotation.x = (1 - hop) * 0.40;     // knee bends during tuck, straightens on plant
  }
  // Front legs: reach forward to absorb landing
  for (const n of ['legFL', 'legFR']) {
    const upper = animal.parts[n];
    const lower = animal.parts[`legLower${n.slice(3)}`];
    if (upper) upper.rotation.x =  hop * 0.45;          // reach forward in air
    if (lower) lower.rotation.x = (1 - hop) * 0.30;     // absorb on landing
  }

  // Ears stream back during flight
  if (animal.parts['earL']) animal.parts['earL'].rotation.x = -hop * 0.20;
  if (animal.parts['earR']) animal.parts['earR'].rotation.x = -hop * 0.20;
}

// ---------------------------------------------------------------------------
// JUMP  — jump fallback (walks along ground)
// ---------------------------------------------------------------------------
function animateJump(animal: AnimalData, t: number, elapsed: number): void {
  animateWalk(animal, t);
  wander(animal, elapsed);
}

// ---------------------------------------------------------------------------
// SLITHER  — continuous sinusoidal lateral displacement along articulated spine
// Displaces each vertebra along local lateral axis with amplitude decreasing toward head
// ---------------------------------------------------------------------------
function animateSlither(animal: AnimalData, t: number): void {
  const speed = 3.4;
  const phaseOffset = 0.32;
  const minAmp = 0.08;
  const maxAmp = 0.44;
  const numSegs = (animal.group.userData['numSnakeSegs'] as number) ?? 22;

  for (let i = 0; i < numSegs; i++) {
    const seg = animal.parts[`seg_${i}`];
    if (!seg) continue;
    const u = i / (numSegs - 1);
    const amp = minAmp + (maxAmp - minAmp) * u;
    const lateral = Math.sin(t * speed - i * phaseOffset) * amp;
    const yaw = Math.cos(t * speed - i * phaseOffset) * (0.22 + 0.40 * u);

    seg.position.z = lateral;
    seg.rotation.y = yaw;
  }

  // Head guides the motion with subtle sinusoidal sway
  if (animal.parts['head']) {
    const headLateral = Math.sin(t * speed) * minAmp;
    const headYaw = Math.cos(t * speed) * 0.22;
    animal.parts['head'].position.z = headLateral;
    animal.parts['head'].rotation.y = headYaw;
  }

  // Rapid forked tongue flicking in and out
  if (animal.parts['tongue']) {
    const flickCycle = Math.sin(t * 7.5);
    const isFlicking = flickCycle > 0.45;
    animal.parts['tongue'].position.x = 0.20 + (isFlicking ? 0.09 : 0);
    animal.parts['tongue'].rotation.z = isFlicking ? Math.sin(t * 26.0) * 0.25 : 0;
    animal.parts['tongue'].scale.setScalar(isFlicking ? 1.0 : 0.6);
  }
}

// ---------------------------------------------------------------------------
// FLY  — realistic avian aerodynamics
// Symmetrical wing counter-rotation along longitudinal roll axis,
// backward feather pitch tilt on downstroke, and synchronized vertical body lift.
// ---------------------------------------------------------------------------
function animateFly(animal: AnimalData, t: number): void {
  const flapSpeed = 4.4;
  const flapAngle = 0.58;

  const flapSine = Math.sin(t * flapSpeed);
  // Synchronized pitch tilt: feathers pitch slightly backward on the downstroke
  const pitchLag = -flapSine * 0.14;

  if (animal.parts['lWing']) {
    animal.parts['lWing'].rotation.z = flapSine * flapAngle;
    animal.parts['lWing'].rotation.x = pitchLag;
  }
  if (animal.parts['rWing']) {
    animal.parts['rWing'].rotation.z = -flapSine * flapAngle;
    animal.parts['rWing'].rotation.x = -pitchLag;
  }

  // Head bobs subtly with the flap effort
  if (animal.parts['head']) {
    animal.parts['head'].rotation.x = flapSine * 0.05;
  }

  // Vertical body bobbing in phase with the flap cycle to simulate aerodynamic lift
  const liftBob = Math.sin(t * flapSpeed) * 0.12;
  const altitudeFloat = Math.sin(t * 0.85) * 0.32;
  animal.group.position.y = FLY_HEIGHT + liftBob + altitudeFloat;

  // Bank gently into turns
  animal.group.rotation.z = -Math.sin(animal.group.rotation.y) * 0.04;
}

// ---------------------------------------------------------------------------
// SWIM  — fish S-curve + pectoral paddles
// ---------------------------------------------------------------------------
function animateSwim(animal: AnimalData, t: number): void {
  const freq = 2.2;
  const sway = Math.sin(t * freq);

  // Submerged mid-depth in open water between floor (Y = -2.20) and top surface (Y = -0.20)
  animal.group.position.y = -1.10 + Math.sin(t * freq * 0.8) * 0.08;

  // Caudal sweep — biggest motion, whole rear of body
  if (animal.parts['tail']) {
    animal.parts['tail'].rotation.y = sway * 0.70;
  }
  // Body undulates slightly
  if (animal.parts['bodyMesh']) {
    animal.parts['bodyMesh'].rotation.y = sway * 0.08;
  }
  // Dorsal fin flutters
  if (animal.parts['dorsal']) {
    animal.parts['dorsal'].rotation.x = Math.sin(t * freq * 1.5) * 0.12;
  }
  // Pectoral fins paddle alternately
  if (animal.parts['lPec']) {
    animal.parts['lPec'].rotation.x =  sway * 0.32;
    animal.parts['lPec'].rotation.z =  0.4 + Math.cos(t * freq) * 0.22;
  }
  if (animal.parts['rPec']) {
    animal.parts['rPec'].rotation.x = -sway * 0.32;
    animal.parts['rPec'].rotation.z = -0.4 - Math.cos(t * freq) * 0.22;
  }
}
