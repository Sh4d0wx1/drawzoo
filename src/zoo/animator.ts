import * as THREE from 'three';
import type { AnimalData } from './types';
import { HABITATS } from './habitats';

// ---------------------------------------------------------------------------
// Movement speeds — world units per frame at ~60 fps
// ---------------------------------------------------------------------------
const SPEEDS: Record<string, number> = {
  lion:     0.026,
  elephant: 0.020,
  giraffe:  0.024,
  zebra:    0.028,
  monkey:   0.055,   // fast between trees
  snake:    0.016,
  bird:     0.036,
  turtle:   0.007,
  fish:     0.020,
  rabbit:   0.032,
};

const ARRIVAL_DIST = 1.4;
const FLY_HEIGHT   = 3.4;   // bird cruising altitude
const MONKEY_JUMP_HEIGHT = 2.8; // peak of tree-to-tree arc

// Turn-rate per frame — how quickly the animal swings to face its target
const TURN_RATE: Record<string, number> = {
  elephant: 0.045,
  giraffe:  0.050,
  turtle:   0.06,
  default:  0.10,
};

// Idle pause chance and duration ranges
const IDLE_CHANCE = 0.30;
const IDLE_RANGE: Record<string, [number, number]> = {
  lion:     [1.5, 4.0],
  elephant: [2.0, 5.0],
  giraffe:  [1.0, 3.0],
  zebra:    [0.8, 2.0],
  monkey:   [0.3, 0.8],
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
  _dt: number,
): void {
  animals.forEach(animal => {
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
  const margin = 3.5;
  const r = Math.sqrt(Math.random()) * (h.radius - margin);
  const a = Math.random() * Math.PI * 2;
  return new THREE.Vector3(h.center.x + Math.cos(a) * r, 0, h.center.z + Math.sin(a) * r);
}

/** Smoothly rotate the group to face (dx, dz) in world space.
 *  Models are built facing +X locally but the modelPivot pre-rotates -π/2 Y,
 *  so the effective world-forward is +Z when group.rotation.y = 0.
 *  atan2(dx, dz) gives the Y rotation needed for +Z forward to point toward (dx,dz). */
function faceDirection(animal: AnimalData, dx: number, dz: number): void {
  if (Math.abs(dx) < 0.0001 && Math.abs(dz) < 0.0001) return;
  const target = Math.atan2(dx, dz);
  const cur    = animal.group.rotation.y;
  let delta    = target - cur;
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
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
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
  const nx  = dx / dist;
  const nz  = dz / dist;
  pos.x += nx * spd;
  pos.z += nz * spd;
  faceDirection(animal, dx, dz);
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
  const nx  = dx / dist;
  const nz  = dz / dist;
  pos.x += nx * spd;
  pos.z += nz * spd;
  faceDirection(animal, dx, dz);
}

// ---------------------------------------------------------------------------
// IDLE — breathing sway, slow head look-around
// ---------------------------------------------------------------------------
function animateIdle(animal: AnimalData, t: number): void {
  // Micro body-rise on inhale
  animal.group.position.y = Math.sin(t * 1.1) * 0.012;
  animal.group.rotation.z = Math.sin(t * 0.7) * 0.010;

  if (animal.parts['head']) {
    animal.parts['head'].rotation.x = Math.sin(t * 0.55) * 0.04;
    animal.parts['head'].rotation.y = Math.sin(t * 0.38) * 0.08;
  }
  if (animal.parts['tail']) {
    animal.parts['tail'].rotation.y = Math.sin(t * 1.4) * 0.18;
  }
}

// ---------------------------------------------------------------------------
// WALK  — diagonal (trot) gait
//
// Real quadruped diagonal: FL and BR swing forward together, FR and BL
// swing forward together, 180° out of phase.
//
// Upper pivot rotation.x:  positive = thigh swings FORWARD (toe toward front)
//                          negative = thigh swings BACK
// Lower pivot rotation.x:  positive = knee bends so lower-leg kicks BACK
//                          (this is the "knee lift" — shank trails behind
//                           then snaps forward as the leg plants)
//
// We model one step cycle as a sine wave on the upper pivot.
// The lower (knee) bend is derived as a half-rectified lag so the knee only
// bends when the leg is in the swing (lifted) phase.
// ---------------------------------------------------------------------------
function animateWalk(animal: AnimalData, t: number): void {
  const speed = SPEEDS[animal.id] ?? 0.025;
  // Step frequency scales with movement speed so fast animals step faster
  const freq  = THREE.MathUtils.clamp(speed * 110, 2.2, 5.5);

  // Upper thigh swing amplitude — bigger for faster/more energetic animals
  const swingAmp  = 0.40;
  // Knee-bend amplitude (how much the lower leg kicks back during swing)
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
    // Knee bends backward when leg is in swing phase (phase > 0 = forward swing)
    // We use max(0, phase) so knee only bends during the lift, stays straight on plant
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

  // For turtle: use FL/FR/BL/BR keys mapped to the group pivot keys it has
  // (Turtle legs are plain groups not buildLeg — rotate around Z for paddling)
  if (animal.id === 'turtle') {
    const tFreq  = 1.8;
    const tPhase = Math.sin(t * tFreq);
    ['legFL', 'legFR', 'legBL', 'legBR'].forEach((n, i) => {
      const leg = animal.parts[n];
      if (!leg) return;
      const sign = (i % 2 === 0 ? 1 : -1);
      // Diagonal: FL+BR together, FR+BL together
      const ph   = (i < 2 ? tPhase : -tPhase) * sign * 0.30;
      leg.rotation.x = ph;
    });
    animal.group.position.y = 0;
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

  // Subtle body rise — body lifts very slightly each time a pair of legs
  // pushes off.  abs(sin) gives two peaks per cycle.
  animal.group.position.y = Math.abs(Math.sin(t * freq)) * 0.028;
  // Subtle lateral lean into each step
  animal.group.rotation.z = Math.sin(t * freq) * 0.014;
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
// JUMP  — monkey tree-to-tree arc
//
// Monkey leaps from perch to perch.  During the arc the body is airborne —
// we interpolate XZ position and add a sin() arc for Y.
// Arms reach out overhead during flight, tuck on landing.
// ---------------------------------------------------------------------------
function animateJump(animal: AnimalData, t: number, elapsed: number): void {
  const g = animal.group as THREE.Group & { _perches?: THREE.Vector3[] };
  const perches = g._perches;

  if (!perches || perches.length === 0) {
    // Fallback to ground wander if no perches
    animateWalk(animal, t);
    wander(animal, elapsed);
    return;
  }

  // --- wander toward current perch (3-D including Y) ---
  const pos    = animal.group.position;
  const target = animal.wanderTarget;

  const dx   = target.x - pos.x;
  const dy   = target.y - pos.y;
  const dz   = target.z - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz); // horizontal distance

  // Arrived at perch
  if (dist < ARRIVAL_DIST && Math.abs(dy) < 0.8) {
    // Brief perch pause
    if (Math.random() < 0.6) {
      const [mn, mx] = IDLE_RANGE['monkey'];
      animal.idleUntil = elapsed + mn + Math.random() * (mx - mn);
    }
    // Pick next perch
    const cur = perches.indexOf(target);
    const next = (cur + 1 + Math.floor(Math.random() * (perches.length - 1))) % perches.length;
    animal.wanderTarget = perches[next].clone();
    return;
  }

  // Horizontal move
  const spd = SPEEDS['monkey'];
  if (dist > 0.01) {
    const nx = dx / dist;
    const nz = dz / dist;
    pos.x += nx * spd;
    pos.z += nz * spd;
    faceDirection(animal, dx, dz);
  }

  // Vertical arc — sin parabola based on progress from last perch to this one
  // We estimate progress as how close we are relative to max distance
  const totalDist = 14; // rough max tree-to-tree distance
  const progress  = THREE.MathUtils.clamp(1 - dist / totalDist, 0, 1);
  const arc       = Math.sin(progress * Math.PI) * MONKEY_JUMP_HEIGHT;
  pos.y           = target.y + arc;   // arc above the destination height

  // --- Body animation during flight ---
  const airFraction = Math.sin(progress * Math.PI); // 0→1→0

  // Arms throw overhead at peak
  if (animal.parts['lArm']) {
    animal.parts['lArm'].rotation.x = -airFraction * 1.8;   // reach up/forward
    animal.parts['lArm'].rotation.z =  0.3 - airFraction * 0.5;
  }
  if (animal.parts['rArm']) {
    animal.parts['rArm'].rotation.x = -airFraction * 1.8;
    animal.parts['rArm'].rotation.z =  0.3 - airFraction * 0.5;
  }

  // Legs tuck up during flight
  for (const n of ['legBL', 'legBR']) {
    const upper = animal.parts[n];
    const lower = animal.parts[`legLower${n.slice(3)}`];
    if (upper) upper.rotation.x = -airFraction * 0.8;
    if (lower) lower.rotation.x =  airFraction * 0.6;
  }

  // Head looks toward target
  if (animal.parts['head']) {
    animal.parts['head'].rotation.x = -airFraction * 0.25;
  }

  // Body pitches forward slightly
  animal.group.rotation.x = -airFraction * 0.18;

  // Tail curls up
  if (animal.parts['tail']) {
    animal.parts['tail'].rotation.z = airFraction * 0.8;
  }
}

// ---------------------------------------------------------------------------
// SLITHER  — snake body as a live CatmullRom tube
// ---------------------------------------------------------------------------
function animateSlither(animal: AnimalData, t: number): void {
  type SnakeGroup = THREE.Group & {
    _snakeCurvePoints?: THREE.Vector3[];
    _snakeCurve?: THREE.CatmullRomCurve3;
    _snakeTube?: THREE.Mesh;
  };
  const g = animal.group as SnakeGroup;
  const pts   = g._snakeCurvePoints;
  const curve = g._snakeCurve;
  const tube  = g._snakeTube;

  if (!pts || !curve || !tube) return;

  const waveFreq = 2.0;
  const waveAmp  = 0.28;
  const coilR    = 0.65;
  const n        = pts.length;

  for (let i = 0; i < n; i++) {
    const frac       = i / (n - 1);
    const baseAngle  = frac * Math.PI * 2.2;
    const r          = coilR * (1 - frac * 0.45);
    const lateral    = Math.sin(baseAngle - t * waveFreq) * waveAmp * (1 - frac * 0.4);
    pts[i].x = Math.cos(baseAngle) * r + Math.cos(baseAngle + Math.PI / 2) * lateral;
    pts[i].z = Math.sin(baseAngle) * r + Math.sin(baseAngle + Math.PI / 2) * lateral;
    pts[i].y = 0.10;
  }

  curve.points = pts;
  const newGeo = new THREE.TubeGeometry(curve, 80, 0.09, 10, false);
  tube.geometry.dispose();
  tube.geometry = newGeo;

  if (animal.parts['head']) {
    const headPos = curve.getPoint(0);
    animal.parts['head'].position.copy(headPos);
    const tangent = curve.getTangent(0);
    animal.parts['head'].rotation.y = Math.atan2(tangent.x, tangent.z);
  }
  if (animal.parts['tongue']) {
    animal.parts['tongue'].scale.z = 0.5 + Math.abs(Math.sin(t * 7)) * 1.0;
  }
}

// ---------------------------------------------------------------------------
// FLY  — bird with proper wing flap
//
// Wing pivots sit at each shoulder; feathers extend outward along ±Z.
// rotation.z of the pivot rotates the entire wing panel up / down.
//
//   rotation.z  =  0.0  → wings level (glide)
//   rotation.z  = -1.3  → wings fully raised  (top of upstroke)
//   rotation.z  = +0.6  → wings depressed     (bottom of downstroke)
//
// The downstroke is faster than the upstroke (real bird aerodynamics).
// We model this with a remapped sine: sawtooth-ish, snapping up quickly
// and sweeping down more slowly.
// ---------------------------------------------------------------------------
function animateFly(animal: AnimalData, t: number): void {
  const flapFreq = 3.8;   // flaps per second

  // Asymmetric flap: use a distorted sine so down-stroke is faster
  const raw  = Math.sin(t * flapFreq * Math.PI * 2);
  // Compress the upstroke half (raw>0) and stretch the downstroke (raw<0)
  const flap = raw > 0
    ? Math.pow(raw, 0.6) * 1.0   // quick upstroke  → top of arc
    : -Math.pow(-raw, 1.4) * 0.8;// slow downstroke → pull through

  // Map to rotation: up = negative Z rotation (left wing), positive for right
  const flapAngle = flap * 1.1;

  if (animal.parts['lWing']) {
    animal.parts['lWing'].rotation.z = -flapAngle;   // left wing: up = neg Z
    // Slight feather-fanning: tips trail slightly behind inner panel
    animal.parts['lWing'].rotation.x = -0.08 + Math.abs(flap) * 0.12;
  }
  if (animal.parts['rWing']) {
    animal.parts['rWing'].rotation.z =  flapAngle;   // right wing: up = pos Z
    animal.parts['rWing'].rotation.x = -0.08 + Math.abs(flap) * 0.12;
  }

  // Head bobs subtly with effort
  if (animal.parts['head']) {
    animal.parts['head'].rotation.x = Math.sin(t * flapFreq * Math.PI * 2) * 0.07;
  }

  // Smooth altitude float
  animal.group.position.y = FLY_HEIGHT + Math.sin(t * 0.9) * 0.38;

  // Bank gently into turns: read the group's own Y rotation rate
  // (We approximate by applying a small Z rotation proportional to heading)
  animal.group.rotation.z = -Math.sin(animal.group.rotation.y) * 0.04;
}

// ---------------------------------------------------------------------------
// SWIM  — fish S-curve + pectoral paddles
// ---------------------------------------------------------------------------
function animateSwim(animal: AnimalData, t: number): void {
  const freq = 2.2;
  const sway = Math.sin(t * freq);

  animal.group.position.y = 0.30 + Math.sin(t * freq * 0.8) * 0.06;

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
