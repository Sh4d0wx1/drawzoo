import * as THREE from 'three';
import type { AnimalData, HabitatName } from './types';
import { HABITATS } from './habitats';
import { getSavedAnimalName, isAnimalReleased } from './storage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

interface GLBAnimalConfig {
  url: string;
  targetHeight: number;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
  yOffset?: number;
  scaleMultiplier?: number;
  resetMeshTransforms?: boolean;
  isElephant?: boolean;
  isLion?: boolean;
  isSavanna?: boolean;
  materialColor?: number;
  roughness?: number;
  metalness?: number;
}

/**
 * Shared GLB loading logic. Normalizes scale based on targetHeight, aligns pivot to ground,
 * and extracts bone references into animalData.parts. Sets up animation mixer for rigged models.
 */
function loadGLBModel(
  pivot: THREE.Group,
  config: GLBAnimalConfig,
  animalData?: AnimalData,
) {
  gltfLoader.load(
    config.url,
    gltf => {
      const model = gltf.scene;

      // 1. Reset mesh transforms if needed (fixes tilted / pitched models such as elephant)
      if (config.resetMeshTransforms) {
        model.traverse(child => {
          if (child.name === 'Elephant_Mesh' || (child as THREE.Mesh).isMesh) {
            child.position.set(0, 0, 0);
            child.rotation.set(0, 0, 0);
            child.scale.set(1, 1, 1);
            child.matrix.identity();
            child.matrixWorld.identity();
          }
        });
      }

      // 2. Adjust materials & shadow casting
      if (config.isElephant) {
        model.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshStandardMaterial({
              color: animalData?.colorParts?.body ?? animalData?.color ?? 0x8c8f94,
              roughness: 0.85,
              metalness: 0.05,
              side: THREE.DoubleSide,
            });
            if (animalData) {
              if (!animalData.colorMaterials) animalData.colorMaterials = { body: [] };
              animalData.colorMaterials.body.push(mesh.material as THREE.MeshLambertMaterial);
            }
          }
        });
      } else if (config.isLion) {
        // Lion: vibrant golden-tawny body + deep coppery-brown mane
        model.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (animalData) child.userData.animal = animalData;
            const mesh = child as THREE.Mesh;
            const geo = mesh.geometry;
            if (geo && geo.attributes.position) {
              const posAttr = geo.attributes.position;
              const count = posAttr.count;
              const colors = new Float32Array(count * 3);

              // Bold, vibrant Lion King-style colors
              const cBody   = new THREE.Color(0xe1b068); // vibrant warm golden-tawny
              const cMane   = new THREE.Color(0x7d512a); // distinct deep coppery-brown mane
              const cMuzzle = new THREE.Color(0xf0d8a0); // light cream chin & muzzle
              const cBelly  = new THREE.Color(0xecc88a); // soft light belly

              // Pre-compute bounding box for normalized coordinates
              geo.computeBoundingBox();
              const bb = geo.boundingBox!;
              const yRange = bb.max.y - bb.min.y;
              const zRange = bb.max.z - bb.min.z;

              for (let i = 0; i < count; i++) {
                const y = posAttr.getY(i);
                const z = posAttr.getZ(i);
                // Normalized coordinates: 0 = bottom/back, 1 = top/front
                const ny = yRange > 0 ? (y - bb.min.y) / yRange : 0.5;
                const nz = zRange > 0 ? (z - bb.min.z) / zRange : 0.5;

                let c = cBody;
                // Muzzle: front-facing, mid-height
                if (nz > 0.90 && ny < 0.82) {
                  c = cMuzzle;
                }
                // Mane: upper head/neck/shoulders region
                else if (nz >= 0.55 && nz <= 0.95 && ny >= 0.35) {
                  c = cMane;
                }
                // Tail tuft
                else if (nz < 0.12 && ny > 0.45) {
                  c = cMane;
                }
                // Belly underside
                else if (ny < 0.25 && nz > 0.25 && nz < 0.75) {
                  c = cBelly;
                }

                colors[i * 3]     = c.r;
                colors[i * 3 + 1] = c.g;
                colors[i * 3 + 2] = c.b;
              }

              geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
              mesh.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.65,
                metalness: 0.05,
                side: THREE.DoubleSide,
              });
            } else {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xe1b068,
                roughness: 0.65,
                metalness: 0.05,
                side: THREE.DoubleSide,
              });
            }
          }
        });
      } else {
        // Other GLB models (zebra, giraffe, etc.)
        model.traverse(child => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (animalData) child.userData.animal = animalData;
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const srcMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              
              // Clone materials uniquely per instance so color pickers don't tint all animals of the same species globally
              const clonedMats = srcMats.map(m => m.clone());
              mesh.material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;

              clonedMats.forEach(m => {
                m.side = THREE.DoubleSide;
                
                // Match the part key dynamically using naming heuristics
                let partKey = 'body'; // Default
                const nameStr = `${mesh.name} ${m.name}`.toLowerCase();
                
                if (animalData && animalData.colorParts) {
                  if (/(stripe)/.test(nameStr)) partKey = 'stripes';
                  else if (/(spot)/.test(nameStr)) partKey = 'spots';
                  else if (/(mane|hair)/.test(nameStr)) partKey = 'mane';
                  else if (/(horn|ossicone)/.test(nameStr)) partKey = 'horns';
                  else if (/(muzzle|nose)/.test(nameStr)) partKey = 'muzzle';
                  else if (/(snout)/.test(nameStr)) partKey = 'snout';
                  else if (/(belly|under)/.test(nameStr)) partKey = 'belly';
                  else if (/(fin)/.test(nameStr)) partKey = 'fins';
                  else if (/(tail)/.test(nameStr)) partKey = 'tail';
                  else if (/(eye|pupil|iris)/.test(nameStr)) partKey = 'eyes';
                  
                  // Ensure the matched part exists in this species' configuration, otherwise fallback to body
                  if (!(partKey in animalData.colorParts)) {
                    if (partKey === 'snout' && 'muzzle' in animalData.colorParts) partKey = 'muzzle';
                    else if (partKey === 'muzzle' && 'snout' in animalData.colorParts) partKey = 'snout';
                    else if (!(partKey in animalData.colorParts)) partKey = 'body';
                  }
                }

                const targetColor = animalData?.colorParts?.[partKey] ?? animalData?.colorParts?.['body'] ?? animalData?.color ?? config.materialColor;
                if (targetColor !== undefined && 'color' in m) {
                  (m as THREE.MeshStandardMaterial).color.set(targetColor);
                }
                
                if ('roughness' in m) {
                  (m as THREE.MeshStandardMaterial).roughness = config.roughness ?? 0.80;
                }
                if ('metalness' in m) {
                  (m as THREE.MeshStandardMaterial).metalness = config.metalness ?? 0.05;
                }
                
                // Register material in colorMaterials map for dynamic updates from UI
                if (animalData) {
                  if (!animalData.colorMaterials) animalData.colorMaterials = {};
                  if (!animalData.colorMaterials[partKey]) animalData.colorMaterials[partKey] = [];
                  animalData.colorMaterials[partKey].push(m as THREE.MeshLambertMaterial);
                }
              });
            }
          }
        });
      }

      // 3. Compute accurate bounding box and scale to target size
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const height = size.y > 0 ? size.y : 1;
      const GLOBAL_ANIMAL_SCALE = 1.3; // Moderate upscale for legibility at default camera distance
      const baseScale = (config.targetHeight / height) * (config.scaleMultiplier ?? 1.0) * GLOBAL_ANIMAL_SCALE;
      model.scale.setScalar(baseScale);

      // Re-compute bounding box after scale to align properly
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

      // Center horizontally on pivot and place all feet on ground Y = 0
      // We use an inner wrapper to apply the centering offset, so the outer wrapper's origin is perfectly at the feet.
      const innerWrapper = new THREE.Group();
      innerWrapper.position.x = -scaledCenter.x;
      innerWrapper.position.y = -scaledBox.min.y;
      innerWrapper.position.z = -scaledCenter.z;
      innerWrapper.add(model);
      
      // 4. Wrapper group for orientation (DrawZoo models face local +X)
      // Since innerWrapper centers the model, this wrapper's origin is now exactly at the feet (Y=0).
      const wrapper = new THREE.Group();
      if (config.rotationX !== undefined) wrapper.rotation.x = config.rotationX;
      if (config.rotationY !== undefined) wrapper.rotation.y = config.rotationY;
      if (config.rotationZ !== undefined) wrapper.rotation.z = config.rotationZ;
      wrapper.userData.baseRotX = config.rotationX ?? 0;
      wrapper.userData.baseRotY = config.rotationY ?? 0;
      wrapper.userData.baseRotZ = config.rotationZ ?? 0;
      
      wrapper.position.y = (config.yOffset ?? 0);

      wrapper.add(innerWrapper);
      pivot.add(wrapper);

      if (animalData) {
        animalData.parts['modelWrapper'] = wrapper;
      }

      // 5. Collect bone / limb nodes into animalData.parts if present
      model.traverse(child => {
        if (animalData && child.name) {
          const name = child.name.toLowerCase();
          if (name.includes('legfl') || (name.includes('fl') && name.includes('leg')) || name.includes('frontleft') || name.includes('leg.l') || name.includes('leg_l.001')) {
            animalData.parts['legFL'] = child;
          } else if (name.includes('legfr') || (name.includes('fr') && name.includes('leg')) || name.includes('frontright') || name.includes('leg.r') || name.includes('leg_r.001')) {
            animalData.parts['legFR'] = child;
          } else if (name.includes('legbl') || (name.includes('bl') && name.includes('leg')) || name.includes('backleft') || name.includes('hindleft')) {
            animalData.parts['legBL'] = child;
          } else if (name.includes('legbr') || (name.includes('br') && name.includes('leg')) || name.includes('backright') || name.includes('hindright')) {
            animalData.parts['legBR'] = child;
          } else if (name.includes('head')) {
            animalData.parts['head'] = child;
          } else if (name.includes('neck')) {
            animalData.parts['neck'] = child;
          } else if (name.includes('tail')) {
            animalData.parts['tail'] = child;
          }
        }
      });

      // 6. Embedded skeletal animation mixer support
      if (gltf.animations && gltf.animations.length > 0) {
        // Strip vertical root motion from base bones to prevent scaled models from flying into the air
        gltf.animations.forEach(clip => {
          clip.tracks.forEach(track => {
            if (track.name.endsWith('.position')) {
              // If it's a root-like bone, freeze its Y translation to the first frame's value
              if (/(root|pelvis|hip|object|armature|rig|body_04|spine|character)/i.test(track.name)) {
                const vals = track.values;
                if (vals.length >= 3) {
                  const initialY = vals[1];
                  for (let i = 1; i < vals.length; i += 3) {
                    vals[i] = initialY;
                  }
                }
              }
            }
          });
        });

        const mixer = new THREE.AnimationMixer(model);
        // Prefer walk/trot clip, fall back to run/move, then idle, then first available
        const walkOrIdleClip =
          gltf.animations.find(a => /walk|trot/i.test(a.name)) ??
          gltf.animations.find(a => /run|move/i.test(a.name)) ??
          gltf.animations.find(a => /idle|stand|breath/i.test(a.name)) ??
          gltf.animations[0];
        const action = mixer.clipAction(walkOrIdleClip);
        action.setLoop(THREE.LoopRepeat, Infinity);

        // Calibrate playback speed per species
        if (config.isElephant) {
          action.timeScale = 0.35;
        } else if (config.isLion) {
          action.timeScale = 0.5;
        } else if (animalData?.id === 'giraffe') {
          action.timeScale = 0.4;
        } else if (animalData?.id === 'zebra') {
          action.timeScale = 0.55;
        }

        action.play();
        if (animalData) {
          animalData.mixer = mixer;
          // Log available clips for debugging
          console.log(`[DrawZoo] ${animalData.id}: ${gltf.animations.length} animation clip(s) found:`,
            gltf.animations.map(a => a.name).join(', '));
        }
      } else if (animalData) {
        console.log(`[DrawZoo] ${animalData.id}: No embedded animations (static mesh)`);
      }
    },
    undefined,
    error => {
      console.error(`[DrawZoo] Failed to load GLB model from ${config.url}:`, error);
    },
  );
}

function mat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}
function matE(color: number, emissive: number, intensity = 0.4): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity });
}
function box(w: number, h: number, d: number): THREE.BoxGeometry {
  return new THREE.BoxGeometry(w, h, d);
}
function sphere(r: number, ws = 10, hs = 8): THREE.SphereGeometry {
  return new THREE.SphereGeometry(r, ws, hs);
}
function cyl(rt: number, rb: number, h: number, seg = 8): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rt, rb, h, seg);
}
function mkMesh(geo: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}
function addTo(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  m: THREE.Material,
  x: number, y: number, z: number,
  rx = 0, ry = 0, rz = 0,
): THREE.Mesh {
  const o = mkMesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  parent.add(o);
  return o;
}

/**
 * Every animal group has this structure:
 *
 *   group  (position/rotation controlled by wander — Y rotation = heading)
 *   └─ modelPivot  (rotated -π/2 on Y so the model's +X nose points toward world +Z)
 *      └─ ... all body meshes, leg pivots, etc.
 *
 * The wander code sets group.rotation.y = atan2(dx, dz) which gives the
 * angle for +Z forward.  The modelPivot corrects for models built facing +X.
 */
function makeGroupWithPivot(): { group: THREE.Group; pivot: THREE.Group } {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.rotation.y = -Math.PI / 2; // model +X → world +Z
  group.add(pivot);
  return { group, pivot };
}

// ---------------------------------------------------------------------------
// Leg builder (Articulated Quadruped Leg with Muscular Flank & Hock)
// Upper pivot at hip/shoulder, lower pivot at knee/elbow.
// Both hang downward (-Y).  Caller stores pivot & lowerPivot in `parts`.
// ---------------------------------------------------------------------------
function buildLeg(
  parent: THREE.Group,
  upperLen: number, upperR: number,
  lowerLen: number, lowerR: number,
  footR: number,
  legMat: THREE.Material,
  x: number, y: number, z: number,
  hoofMat?: THREE.Material,
  isHind = false,
): { pivot: THREE.Group; lowerPivot: THREE.Group } {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);

  // Muscular Upper Thigh / Shoulder Scapula mass flanking the lateral body wall
  const flankMass = mkMesh(sphere(upperR * 1.35, 10, 8), legMat);
  flankMass.scale.set(isHind ? 1.30 : 1.10, 1.40, 0.75);
  flankMass.position.set(isHind ? -0.02 : 0.02, -upperLen * 0.25, 0);
  pivot.add(flankMass);

  // Upper limb (tapered humerus/femur with anatomical forward/back tilt)
  const upper = mkMesh(cyl(upperR * 0.70, upperR * 1.15, upperLen, 10), legMat);
  upper.position.set(0, -upperLen * 0.55, 0);
  if (isHind) upper.rotation.z = -0.08;
  else upper.rotation.z = 0.08;
  pivot.add(upper);

  // Knee / Elbow joint (Lower Pivot)
  const lowerPivot = new THREE.Group();
  lowerPivot.position.set(0, -upperLen, 0);
  pivot.add(lowerPivot);

  // Joint cap (Knee or Elbow)
  const jointCap = mkMesh(sphere(upperR * 0.78, 8, 7), legMat);
  jointCap.position.set(isHind ? 0.03 : -0.03, 0, 0);
  lowerPivot.add(jointCap);

  // Lower leg shaft (tapered cannon / shin)
  const lower = mkMesh(cyl(lowerR * 0.70, lowerR * 1.05, lowerLen, 10), legMat);
  lower.position.set(0, -lowerLen * 0.50, 0);
  lowerPivot.add(lower);

  // Hock / Ankle joint bulge for hind legs
  if (isHind) {
    const hock = mkMesh(sphere(lowerR * 0.90, 7, 6), legMat);
    hock.position.set(-lowerR * 0.65, -lowerLen * 0.25, 0);
    lowerPivot.add(hock);
  }

  // Pastern & Foot / Hoof / Paw
  const mFoot = hoofMat ?? legMat;
  const foot = mkMesh(sphere(footR, 8, 7), mFoot);
  foot.scale.set(1.50, 0.72, 1.15);
  foot.position.set(footR * 0.45, -lowerLen - footR * 0.35, 0);
  lowerPivot.add(foot);

  return { pivot, lowerPivot };
}

/** Uniform random point inside a habitat circle. */
function randomInCircle(cx: number, cz: number, radius: number, margin = 3.5): THREE.Vector3 {
  const r = Math.sqrt(Math.random()) * (radius - margin);
  const a = Math.random() * Math.PI * 2;
  return new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r);
}

// ---------------------------------------------------------------------------
// Monkey tree-top waypoints (fixed positions matching jungle tree placement)
// The jungle habitat is HABITATS[1]: center (28, 0, -28), radius 22.
// Trees are placed at angle = (k/count)*2π + 0.7  with dist = radius*(0.55..0.85).
// We pre-compute 8 perch positions at height 3.5 (top of jungle trees).
// ---------------------------------------------------------------------------
export function buildMonkeyPerches(): THREE.Vector3[] {
  const h = HABITATS[1];
  const perches: THREE.Vector3[] = [];
  const count = 8;
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + 0.7;
    const dist = h.radius * (0.58 + (k % 3) * 0.1);
    perches.push(new THREE.Vector3(
      h.center.x + Math.cos(angle) * dist,
      3.5,
      h.center.z + Math.sin(angle) * dist,
    ));
  }
  return perches;
}

export const savannaWaterHole = {
  center: new THREE.Vector2(-48 - 8, -48 - 8),
  radius: (37 * 0.28) + 0.6 // ~10.96
};

// ---------------------------------------------------------------------------
// LION
// ---------------------------------------------------------------------------
// ELEPHANT
// ---------------------------------------------------------------------------
function buildElephant(_pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};
  const habitat = HABITATS[0];
  
  // Reposition elephant near the watering hole
  const spawnPos = new THREE.Vector3(habitat.center.x - 3, 0, habitat.center.z - 3);

  const animal: AnimalData = {
    id: 'elephant', name: 'Elephant', habitat: 'Savanna', position: spawnPos,
    color: 0x8c8f94, accentColor: 0x555555, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 4.4,
  };

  loadGLBModel(pivot, {
    url: '/models/elephant.glb',
    targetHeight: 2.8,
    rotationY: Math.PI / 2, // 90 degrees to compensate for native orientation
    isElephant: true,
    isSavanna: true,
  }, animal);

  return animal;
}

// ---------------------------------------------------------------------------
// SHARK
// ---------------------------------------------------------------------------
function buildShark(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};
  const habitat = HABITATS.find(h => h.name === 'Aquatic Zone')!;

  const animal: AnimalData = {
    id: 'shark', name: 'Shark', habitat: 'Aquatic Zone', position: pos,
    color: 0x4aa6de, accentColor: 0x225577, animationType: 'swim',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 2.6,
    colorParts: { body: 0xffffff, belly: 0xffffff, fins: 0xffffff, eyes: 0xffffff },
  };

  loadGLBModel(pivot, {
    url: '/models/shark.glb',
    targetHeight: 1.5,
    rotationY: Math.PI / 2, // Depending on orientation; default to facing Z
  }, animal);

  return animal;
}

// ---------------------------------------------------------------------------
// BABY WOLF
// ---------------------------------------------------------------------------
function buildWolf(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};
  const habitat = HABITATS.find(h => h.name === 'Jungle')!;

  const animal: AnimalData = {
    id: 'wolf', name: 'Baby Wolf', habitat: 'Jungle', position: pos,
    color: 0x777777, accentColor: 0x333333, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 3.2,
    colorParts: { body: 0xffffff, belly: 0xffffff, tail: 0xffffff, snout: 0xffffff, eyes: 0xffffff },
  };

  loadGLBModel(pivot, {
    url: '/models/baby_wolf.glb',
    targetHeight: 1.5,
    rotationY: Math.PI / 2, // Depending on orientation; default to facing Z
  }, animal);

  return animal;
}

// ---------------------------------------------------------------------------
// GIRAFFE
// ---------------------------------------------------------------------------
function buildGiraffe(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};
  const habitat = HABITATS[0];

  const animal: AnimalData = {
    id: 'giraffe', name: 'Giraffe', habitat: 'Savanna', position: pos,
    color: 0xf0a020, accentColor: 0x7a3400, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 8.8,
    colorParts: { body: 0xe3a857, spots: 0x7b3f00, mane: 0x7a3400, horns: 0x443322, eyes: 0x0a0a0a },
  };

  loadGLBModel(pivot, {
    url: '/models/giraffe.glb',
    targetHeight: 5.0,
    rotationY: Math.PI / 2,
    roughness: 0.80,
    metalness: 0.05,
    isSavanna: true,
    yOffset: 0.1, // Adjusted from 1.2 which was causing it to hover
  }, animal);

  return animal;
}

// ---------------------------------------------------------------------------
// ZEBRA
// ---------------------------------------------------------------------------
function buildZebra(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};
  const habitat = HABITATS[0];

  const animal: AnimalData = {
    id: 'zebra', name: 'Zebra', habitat: 'Savanna', position: pos,
    color: 0xeeeeee, accentColor: 0x111111, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 3.4,
    colorParts: { body: 0xffffff, stripes: 0x1a1a1a, mane: 0x1a1a1a, muzzle: 0x333333, eyes: 0x0a0a0a },
  };

  loadGLBModel(pivot, {
    url: '/models/zebra.glb',
    targetHeight: 2.1,
    rotationY: -Math.PI / 2,
    roughness: 0.80,
    metalness: 0.05,
    isSavanna: true,
    yOffset: -1.0, // Significantly push hooves down to counteract its huge bounding box
  }, animal);

  return animal;
}


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// MONKEY (Quadruped Knuckle-Walking Simian Anatomy & Ground Posture)
// ---------------------------------------------------------------------------
function buildMonkey(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const furM   = mat(0x60421d); // Warm rich brown coat
  const skinM  = mat(0xeecbb0); // Soft peach facial mask & belly
  const eyeM   = matE(0x0e0e0e, 0x111111, 0.2);
  const snoutM = mat(0x402510);

  // 1. Hunched Quadruped Torso & Peach Belly Bib
  const torsoG = new THREE.Group();
  torsoG.position.set(-0.02, 0.34, 0);
  torsoG.rotation.z = -0.22; // Natural quadruped forward hunch
  pivot.add(torsoG);

  const torso = mkMesh(sphere(0.24, 12, 10), furM);
  torso.scale.set(1.15, 0.95, 0.85);
  torsoG.add(torso);

  const belly = mkMesh(sphere(0.18, 10, 8), skinM);
  belly.scale.set(0.85, 0.80, 0.65);
  belly.position.set(0.04, -0.06, 0);
  torsoG.add(belly);

  // 2. Proportional Head tucked in toward chest
  const headG = new THREE.Group();
  headG.position.set(0.18, 0.46, 0);
  parts['head'] = headG;
  pivot.add(headG);

  // Cranium
  const cranium = mkMesh(sphere(0.18, 12, 10), furM);
  headG.add(cranium);

  // Heart-shaped peach face mask
  const face = mkMesh(sphere(0.14, 10, 8), skinM);
  face.scale.set(0.70, 0.85, 0.65);
  face.position.set(0.10, -0.02, 0);
  headG.add(face);

  // Scaled-down cute muzzle / snout tucked under chin
  const muzzle = mkMesh(sphere(0.09, 8, 7), skinM);
  muzzle.scale.set(1.15, 0.65, 0.85);
  muzzle.position.set(0.18, -0.06, 0);
  headG.add(muzzle);

  // Nostrils
  [-0.025, 0.025].forEach(nz => {
    const nostril = mkMesh(sphere(0.012, 5, 4), snoutM);
    nostril.position.set(0.24, -0.05, nz);
    headG.add(nostril);
  });

  // Expressive dark bead eyes with glossy reflections
  [-0.08, 0.08].forEach((ez, idx) => {
    const eye = mkMesh(sphere(0.038, 8, 6), eyeM);
    eye.position.set(0.14, 0.04, ez);
    headG.add(eye);
    const pupil = mkMesh(sphere(0.016, 6, 5), mat(0x020202));
    pupil.position.set(0.165, 0.04, idx === 0 ? ez + 0.008 : ez - 0.008);
    headG.add(pupil);
    const glint = mkMesh(sphere(0.007, 5, 4), mat(0xffffff));
    glint.position.set(0.175, 0.055, idx === 0 ? ez + 0.010 : ez - 0.010);
    headG.add(glint);
  });

  // Cupped C-shaped monkey ears
  [-0.18, 0.18].forEach(ez => {
    const earOuter = mkMesh(sphere(0.075, 8, 6), furM);
    earOuter.scale.set(0.4, 0.9, 0.9);
    earOuter.position.set(-0.02, 0.02, ez);
    headG.add(earOuter);
    const earInner = mkMesh(sphere(0.048, 6, 5), skinM);
    earInner.scale.set(0.4, 0.8, 0.8);
    earInner.position.set(-0.01, 0.02, ez > 0 ? ez - 0.015 : ez + 0.015);
    headG.add(earInner);
  });

  // 3. Forelimbs (Knuckle-Walking Arms reaching down to Y = 0)
  [-0.16, 0.16].forEach((az, idx) => {
    const armG = new THREE.Group();
    armG.position.set(0.14, 0.38, az);
    parts[idx === 0 ? 'rArm' : 'lArm'] = armG;
    pivot.add(armG);

    // Shoulder joint
    armG.add(mkMesh(sphere(0.055, 7, 6), furM));
    // Upper arm angled forward-downward
    const upper = mkMesh(cyl(0.04, 0.05, 0.20, 8), furM);
    upper.position.set(0, -0.10, 0);
    upper.rotation.z = 0.08;
    armG.add(upper);

    // Elbow pivot
    const elbowG = new THREE.Group();
    elbowG.position.set(0.015, -0.20, 0);
    parts[idx === 0 ? 'rElbow' : 'lElbow'] = elbowG;
    armG.add(elbowG);

    elbowG.add(mkMesh(sphere(0.045, 6, 5), furM));
    const lower = mkMesh(cyl(0.032, 0.042, 0.15, 8), furM);
    lower.position.set(0, -0.075, 0);
    lower.rotation.z = -0.05;
    elbowG.add(lower);

    // Knuckle hand resting at ground level Y = 0
    const hand = mkMesh(sphere(0.045, 6, 5), skinM);
    hand.scale.set(1.2, 0.65, 0.9);
    hand.position.set(0.01, -0.15, 0);
    elbowG.add(hand);
  });

  // 4. Hind Limbs (Grounded Legs & Paws)
  const legDefs: [number, number, string][] = [
    [-0.16,  0.14, 'BL'],
    [-0.16, -0.14, 'BR'],
  ];
  legDefs.forEach(([lx, lz, name]) => {
    const legG = new THREE.Group();
    legG.position.set(lx, 0.34, lz);
    parts[`leg${name}`] = legG;
    pivot.add(legG);

    // Hip joint
    legG.add(mkMesh(sphere(0.065, 7, 6), furM));
    // Upper thigh
    const thigh = mkMesh(cyl(0.045, 0.06, 0.18, 8), furM);
    thigh.position.set(0, -0.09, 0);
    thigh.rotation.z = -0.10;
    legG.add(thigh);

    // Knee pivot
    const kneeG = new THREE.Group();
    kneeG.position.set(-0.015, -0.18, 0);
    parts[`legLower${name}`] = kneeG;
    legG.add(kneeG);

    kneeG.add(mkMesh(sphere(0.048, 6, 5), furM));
    const shank = mkMesh(cyl(0.035, 0.045, 0.14, 8), furM);
    shank.position.set(0, -0.07, 0);
    shank.rotation.z = 0.08;
    kneeG.add(shank);

    // Simian foot resting at ground level Y = 0
    const foot = mkMesh(sphere(0.045, 6, 5), skinM);
    foot.scale.set(1.3, 0.6, 0.85);
    foot.position.set(0.02, -0.14, 0);
    kneeG.add(foot);
  });

  // 5. Prehensile Curved Spiral Tail
  const tailG = new THREE.Group();
  tailG.position.set(-0.24, 0.38, 0);
  parts['tail'] = tailG;
  pivot.add(tailG);
  addTo(tailG, cyl(0.030, 0.045, 0.24, 8), furM, -0.08, -0.08, 0, 0, 0,  0.55);
  addTo(tailG, cyl(0.022, 0.032, 0.22, 8), furM, -0.18, -0.22, 0, 0, 0, -0.35);
  addTo(tailG, cyl(0.015, 0.024, 0.20, 8), furM, -0.24, -0.36, 0, 0, 0,  0.75);

  const habitat = HABITATS[1];
  group.scale.setScalar(2.1875); // 1.25 * 1.75
  return {
    id: 'monkey', name: 'Monkey', habitat: 'Jungle', position: pos,
    color: 0x60421d, accentColor: 0xeecbb0, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 1.8,
    colorParts: { body: 0x60421d, face: 0xeecbb0, tail: 0x60421d },
    colorMaterials: { body: [furM], face: [skinM], tail: [furM] },
  };
}

// ---------------------------------------------------------------------------
// SNAKE
// ---------------------------------------------------------------------------
function buildSnake(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const bodyM   = mat(0x2d7c2d);
  const scaleM  = mat(0x164416);
  const bellyM  = mat(0xd8e8a8);
  const eyeM    = matE(0xddcc00, 0xffee00, 0.8);
  const tongueM = mat(0xdd1818);

  const numSegs = 22;
  group.userData['numSnakeSegs'] = numSegs;

  // 1. Articulated Spine Vertebrae Chain
  for (let i = 0; i < numSegs; i++) {
    const u = i / (numSegs - 1);
    const posX = 1.05 - u * 2.30;
    const r = 0.115 * (1 - u * 0.65);

    const segG = new THREE.Group();
    segG.position.set(posX, 0.10, 0);
    segG.userData['baseX'] = posX;
    segG.userData['segIndex'] = i;
    parts[`seg_${i}`] = segG;
    pivot.add(segG);

    // Main vertebra mass
    const segMesh = mkMesh(sphere(r, 10, 8), bodyM);
    segMesh.scale.set(1.25, 0.90, 1.05);
    segG.add(segMesh);

    // Dorsal Diamond Scale Crest
    const dorsalScale = mkMesh(sphere(r * 0.60, 6, 5), scaleM);
    dorsalScale.scale.set(1.10, 0.35, 0.80);
    dorsalScale.position.set(0, r * 0.70, 0);
    segG.add(dorsalScale);

    // Pale Underbelly Plate
    const bellyPlate = mkMesh(sphere(r * 0.85, 8, 6), bellyM);
    bellyPlate.scale.set(1.15, 0.30, 0.90);
    bellyPlate.position.set(0, -r * 0.60, 0);
    segG.add(bellyPlate);
  }

  // 2. Sculpted Viper/Python Head (Mounted at Segment 0)
  const headG = new THREE.Group();
  headG.position.set(1.15, 0.12, 0);
  parts['head'] = headG;
  pivot.add(headG);

  // Skull
  const skull = mkMesh(sphere(0.16, 12, 10), bodyM);
  skull.scale.set(1.4, 0.65, 1.05);
  headG.add(skull);

  // Pale lower jaw
  const jaw = mkMesh(sphere(0.14, 10, 8), bellyM);
  jaw.scale.set(1.3, 0.45, 0.95);
  jaw.position.set(0.02, -0.05, 0);
  headG.add(jaw);

  // Reptilian Eyes with vertical slit pupils
  [-0.10, 0.10].forEach((ez, idx) => {
    const eye = mkMesh(sphere(0.045, 8, 6), eyeM);
    eye.position.set(0.09, 0.04, ez);
    headG.add(eye);
    const slit = mkMesh(box(0.012, 0.05, 0.012), mat(0x050505));
    slit.position.set(0.12, 0.04, idx === 0 ? ez + 0.01 : ez - 0.01);
    headG.add(slit);
  });

  // Nostrils / heat-sensing pits
  [-0.04, 0.04].forEach(nz => {
    const pit = mkMesh(sphere(0.018, 5, 4), mat(0x103010));
    pit.position.set(0.18, 0.01, nz);
    headG.add(pit);
  });

  // Forked Red Tongue
  const tongueG = new THREE.Group();
  tongueG.position.set(0.20, -0.02, 0);
  parts['tongue'] = tongueG;
  headG.add(tongueG);
  addTo(tongueG, cyl(0.008, 0.012, 0.14, 6), tongueM, 0, 0, 0, 0, 0, Math.PI / 2);
  addTo(tongueG, cyl(0.004, 0.008, 0.08, 4), tongueM,  0.08, 0,  0.022, 0, 0.3, Math.PI / 2);
  addTo(tongueG, cyl(0.004, 0.008, 0.08, 4), tongueM,  0.08, 0, -0.022, 0, -0.3, Math.PI / 2);

  const habitat = HABITATS[2];
  group.scale.setScalar(1.25);
  return {
    id: 'snake', name: 'Snake', habitat: 'Reptile Zone', position: pos,
    color: 0x2e7a2e, accentColor: 0x1a4f1a, animationType: 'slither',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 1.6,
    colorParts: { body: 0x2d7c2d, pattern: 0x164416, eyes: 0xddcc00, tongue: 0xdd1818 },
    colorMaterials: { body: [bodyM, bellyM], pattern: [scaleM], eyes: [eyeM], tongue: [tongueM] },
  };
}

// ---------------------------------------------------------------------------
// BIRD
// ---------------------------------------------------------------------------
function buildBird(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const bM        = mat(0xeb4818);
  const wingM     = mat(0xff7020);
  const tipM      = mat(0x0a66c2);
  const yellowM   = mat(0xffcc00);
  const beakM     = mat(0x222222);
  const beakBaseM = mat(0xf5d033);
  const eyeM      = matE(0x0a0a0a, 0x111111, 0.2);
  const footM     = mat(0x777777);

  // 1. Aerodynamic Teardrop Avian Body
  const body = mkMesh(sphere(0.28, 14, 12), bM);
  body.scale.set(1.35, 0.95, 0.85);
  body.position.set(0, 0.34, 0);
  pivot.add(body);

  // Golden yellow belly breast patch
  const breast = mkMesh(sphere(0.24, 10, 8), yellowM);
  breast.scale.set(1.0, 0.85, 0.70);
  breast.position.set(0.14, 0.32, 0);
  pivot.add(breast);

  // 2. Head & Sculpted Hooked Macaw Beak
  const headG = new THREE.Group();
  headG.position.set(0.12, 0.76, 0);
  parts['head'] = headG;
  pivot.add(headG);

  // Skull
  const skull = mkMesh(sphere(0.20, 10, 8), bM);
  skull.scale.set(1.1, 1.0, 0.9);
  headG.add(skull);

  // Crest plumage feathers
  for (let i = 0; i < 4; i++) {
    const feather = mkMesh(cyl(0.015, 0.04, 0.22 - i * 0.03, 6), yellowM);
    feather.position.set(-0.06 + i * 0.03, 0.20, (i - 1.5) * 0.04);
    feather.rotation.z = -0.3 + i * 0.12;
    headG.add(feather);
  }

  // Hooked Upper Beak
  const upperBeakShape = new THREE.Shape();
  upperBeakShape.moveTo(0, 0.08);
  upperBeakShape.quadraticCurveTo(0.18, 0.06, 0.26, -0.06);
  upperBeakShape.quadraticCurveTo(0.16, -0.04, 0, -0.04);
  upperBeakShape.closePath();
  const upperBeakGeo = new THREE.ExtrudeGeometry(upperBeakShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  upperBeakGeo.center();
  upperBeakGeo.translate(0.22, 0.02, 0);
  const upperBeak = mkMesh(upperBeakGeo, beakM);
  headG.add(upperBeak);

  // Lower Beak
  const lowerBeakShape = new THREE.Shape();
  lowerBeakShape.moveTo(0, 0);
  lowerBeakShape.lineTo(0.12, 0);
  lowerBeakShape.lineTo(0.08, -0.06);
  lowerBeakShape.closePath();
  const lowerBeakGeo = new THREE.ExtrudeGeometry(lowerBeakShape, { depth: 0.06, bevelEnabled: false });
  lowerBeakGeo.center();
  lowerBeakGeo.translate(0.18, -0.04, 0);
  const lowerBeak = mkMesh(lowerBeakGeo, beakBaseM);
  headG.add(lowerBeak);

  // White Orbital Eye Ring & Glossy Eyes
  [-0.12, 0.12].forEach(ez => {
    const eyeRing = mkMesh(sphere(0.065, 8, 6), mat(0xffffff));
    eyeRing.scale.set(1.0, 1.0, 0.25);
    eyeRing.position.set(0.08, 0.06, ez);
    headG.add(eyeRing);

    const eye = mkMesh(sphere(0.035, 6, 5), eyeM);
    eye.position.set(0.09, 0.06, ez > 0 ? ez + 0.015 : ez - 0.015);
    headG.add(eye);
  });

  // 3. Wings — Anatomical Lateral Shoulders & Aerodynamic Span
  // Base Wing Shape: Root at (0, 0), span extends outward along +X, chord along +Y (leading edge +Y, trailing edge -Y)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0.08); // leading edge root at shoulder
  wingShape.bezierCurveTo(0.22, 0.10, 0.48, 0.06, 0.72, 0.0); // wing tip leading edge
  wingShape.bezierCurveTo(0.52, -0.16, 0.22, -0.22, 0, -0.12); // trailing edge root
  wingShape.closePath();

  // Primary Wing Airfoil Geometry (lies flat in X-Z plane, root at origin)
  const baseWingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1 });
  baseWingGeo.rotateX(-Math.PI / 2); // leading edge -> +Z, trailing edge -> -Z, span -> +X

  // Wing Tip Accent Shape
  const tipShape = new THREE.Shape();
  tipShape.moveTo(0.38, 0.04);
  tipShape.bezierCurveTo(0.50, 0.05, 0.62, 0.03, 0.72, 0.0);
  tipShape.bezierCurveTo(0.60, -0.10, 0.45, -0.15, 0.38, -0.10);
  tipShape.closePath();
  const baseTipGeo = new THREE.ExtrudeGeometry(tipShape, { depth: 0.022, bevelEnabled: false });
  baseTipGeo.rotateX(-Math.PI / 2);

  // Left Wing (Mounted on Left Torso +Z, pivot at shoulder joint)
  const lWing = new THREE.Group();
  lWing.position.set(0.04, 0.38, 0.22);
  lWing.rotation.y = -Math.PI / 2; // +X (span) points outward to +Z (left lateral side)
  parts['lWing'] = lWing;
  pivot.add(lWing);

  const lWingMesh = mkMesh(baseWingGeo, wingM);
  lWing.add(lWingMesh);
  const lTipMesh = mkMesh(baseTipGeo, tipM);
  lWing.add(lTipMesh);

  // Right Wing (Mounted on Right Torso -Z, pivot at shoulder joint)
  const rWing = new THREE.Group();
  rWing.position.set(0.04, 0.38, -0.22);
  rWing.rotation.y = -Math.PI / 2;
  parts['rWing'] = rWing;
  pivot.add(rWing);

  const rWingGeo = baseWingGeo.clone();
  rWingGeo.scale(-1, 1, 1); // Mirrored span outward to -Z (right lateral side)
  const rWingMesh = mkMesh(rWingGeo, wingM);
  rWing.add(rWingMesh);

  const rTipGeo = baseTipGeo.clone();
  rTipGeo.scale(-1, 1, 1);
  const rTipMesh = mkMesh(rTipGeo, tipM);
  rWing.add(rTipMesh);

  // 4. Long Tail Feathers
  const tailFeather = mkMesh(box(0.55, 0.02, 0.14), tipM);
  tailFeather.position.set(-0.45, 0.22, 0);
  tailFeather.rotation.z = 0.35;
  pivot.add(tailFeather);

  // 5. Perching Feet
  [-0.10, 0.10].forEach((lz, si) => {
    const legG = new THREE.Group();
    legG.position.set(0, 0.16, lz);
    parts[`legFoot${si === 0 ? 'R' : 'L'}`] = legG;
    pivot.add(legG);
    addTo(legG, cyl(0.02, 0.03, 0.18, 6), footM, 0, -0.09, 0);
    [-0.04, 0, 0.04].forEach((tz, ti) => {
      addTo(legG, cyl(0.012, 0.018, 0.12, 5), footM,
        0.05 * (ti + 0.5), -0.20, tz, 0, 0, -0.3 + ti * 0.3);
    });
  });

  const habitat = HABITATS[3];
  group.scale.setScalar(1.35);
  return {
    id: 'bird', name: 'Tropical Bird', habitat: 'Aviary', position: pos,
    color: 0xe85520, accentColor: 0xeecc00, animationType: 'fly',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 7.0,
    colorParts: { body: 0xeb4818, wings: 0xff7020, pattern: 0xffcc00, eyes: 0x0a0a0a },
    colorMaterials: { body: [bM], wings: [wingM, tipM], pattern: [yellowM], eyes: [eyeM] },
  };
}

// ---------------------------------------------------------------------------
// TURTLE
// ---------------------------------------------------------------------------
function buildTurtle(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  // Color Contrast:
  // Shell: defined olive/brown hue (#5a6b32) with visible geometric ridges/scutes
  const shellM    = mat(0x5a6b32);
  const shellDkM  = mat(0x3e4d20);
  const scuteM    = mat(0x6e823d);
  const ridgeM    = mat(0x445324);
  // Skin/Limbs: distinct lighter sage/yellow-green (#8ea65d)
  const skinM     = mat(0x8ea65d);
  const skinLtM   = mat(0xa4bc75);
  const eyeM      = matE(0x0e0e0e, 0x111111, 0.1);
  const plastronM = mat(0xdcd0a4);

  // 1. Smooth Domed Carapace (Upper Shell)
  const shell = mkMesh(sphere(0.56, 16, 12), shellM);
  shell.scale.set(1.18, 0.58, 0.98);
  shell.position.set(0, 0.36, 0);
  pivot.add(shell);

  // Beveled marginal rim
  const rim = mkMesh(sphere(0.60, 14, 10), shellDkM);
  rim.scale.set(1.22, 0.18, 1.02);
  rim.position.set(0, 0.22, 0);
  pivot.add(rim);

  // Carapace Scutes with Radiating Hexagonal Geometric Motifs & Ridges
  const scuteData: [number, number, number, number][] = [
    [ 0.20, 0.60,  0.00, 0.0],
    [-0.04, 0.62,  0.00, 0.0],
    [-0.28, 0.58,  0.00, 0.0],
    [ 0.16, 0.54,  0.28, 0.5],
    [ 0.16, 0.54, -0.28, -0.5],
    [-0.14, 0.54,  0.28, 0.8],
    [-0.14, 0.54, -0.28, -0.8],
    [ 0.00, 0.46,  0.44, 1.2],
    [ 0.00, 0.46, -0.44, -1.2],
  ];
  scuteData.forEach(([x, y, z, ry]) => {
    // Outer ridge boundary
    const rBorder = mkMesh(sphere(0.13, 7, 6), ridgeM);
    rBorder.scale.set(1.35, 0.38, 1.25);
    rBorder.position.set(x, y, z);
    rBorder.rotation.y = ry;
    pivot.add(rBorder);

    // Raised center scute plate
    const sPlate = mkMesh(sphere(0.11, 7, 6), scuteM);
    sPlate.scale.set(1.25, 0.42, 1.15);
    sPlate.position.set(x, y + 0.015, z);
    sPlate.rotation.y = ry;
    pivot.add(sPlate);
  });

  // Flat Smooth Plastron (Bottom Shell)
  const plastron = mkMesh(sphere(0.50, 12, 10), plastronM);
  plastron.scale.set(1.10, 0.14, 0.90);
  plastron.position.set(0, 0.12, 0);
  pivot.add(plastron);

  // 2. Extended Reptilian Head & Long Neck
  const neck = mkMesh(cyl(0.10, 0.15, 0.34, 8), skinM);
  neck.position.set(0.52, 0.26, 0);
  neck.rotation.z = -Math.PI / 3.2; // angled up-forward
  pivot.add(neck);

  const headG = new THREE.Group();
  headG.position.set(0.66, 0.34, 0);
  parts['head'] = headG;
  pivot.add(headG);

  // Skull
  const skull = mkMesh(sphere(0.18, 12, 10), skinM);
  skull.scale.set(1.35, 0.85, 0.95);
  headG.add(skull);

  // Elevated chin & tapered beak
  const beak = mkMesh(sphere(0.11, 8, 6), skinLtM);
  beak.scale.set(1.25, 0.65, 0.82);
  beak.position.set(0.16, -0.02, 0);
  headG.add(beak);

  // Dark contrasting bead eyes
  [-0.11, 0.11].forEach(ez => {
    const eye = mkMesh(sphere(0.048, 8, 7), eyeM);
    eye.position.set(0.08, 0.06, ez);
    headG.add(eye);
    const glint = mkMesh(sphere(0.014, 5, 4), mat(0xffffff));
    glint.position.set(0.10, 0.08, ez > 0 ? ez + 0.015 : ez - 0.015);
    headG.add(glint);
  });

  // Short Pointed Tail
  addTo(pivot, cyl(0.015, 0.045, 0.28, 6), skinM, -0.62, 0.18, 0, 0, 0, 0.45);

  // 3. Hydrodynamic Paddling Flippers (Pushed clearly beyond shell perimeter)
  const flipperDefs: [number, number, number, number, string, boolean][] = [
    [ 0.44,  0.48, 0.14,  0.35, 'FL', true],
    [ 0.44, -0.48, 0.14, -0.35, 'FR', true],
    [-0.38,  0.46, 0.12,  0.25, 'BL', false],
    [-0.38, -0.46, 0.12, -0.25, 'BR', false],
  ];

  flipperDefs.forEach(([lx, lz, ly, rz, name, isFront]) => {
    const flipperG = new THREE.Group();
    flipperG.position.set(lx, ly, lz);
    flipperG.rotation.z = rz;
    flipperG.rotation.y = lz > 0 ? 0.35 : -0.35;
    flipperG.userData['baseRotY'] = flipperG.rotation.y;
    flipperG.userData['baseRotZ'] = flipperG.rotation.z;
    parts[`leg${name}`] = flipperG;
    parts[`flipper${name}`] = flipperG;
    pivot.add(flipperG);

    // Limb shoulder/hip shaft
    const shaft = mkMesh(cyl(0.05, 0.08, isFront ? 0.26 : 0.22, 8), skinM);
    shaft.position.set(0, -0.10, 0);
    flipperG.add(shaft);

    // Wide, prominent paddle flipper extending outward beyond shell
    const paddle = mkMesh(sphere(isFront ? 0.18 : 0.14, 10, 7), skinM);
    paddle.scale.set(isFront ? 1.70 : 1.45, 0.25, isFront ? 0.95 : 0.85);
    paddle.position.set(isFront ? 0.12 : 0.08, isFront ? -0.22 : -0.18, 0);
    paddle.rotation.y = lz > 0 ? 0.2 : -0.2;
    flipperG.add(paddle);

    // Digit/claw ridges
    for (let d = -1; d <= 1; d++) {
      const ridge = mkMesh(cyl(0.012, 0.018, 0.10, 5), skinLtM);
      ridge.position.set(isFront ? 0.20 : 0.14, isFront ? -0.22 : -0.18, d * 0.05);
      ridge.rotation.z = Math.PI / 2;
      flipperG.add(ridge);
    }
  });

  const habitat = HABITATS[2];
  group.scale.setScalar(1.3);
  return {
    id: 'turtle', name: 'Turtle', habitat: 'Reptile Zone', position: pos,
    color: 0x5a6b32, accentColor: 0x8ea65d, animationType: 'walk',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 1.6,
    colorParts: { shell: 0x5a6b32, limbs: 0x8ea65d, eyes: 0x0e0e0e },
    colorMaterials: { shell: [shellM, shellDkM, scuteM, ridgeM, plastronM], limbs: [skinM, skinLtM], eyes: [eyeM] },
  };
}

// ---------------------------------------------------------------------------
// FISH (Clownfish)
// ---------------------------------------------------------------------------

/** Creates an organic, streamlined teardrop / torpedo fish body */
function createFishBodyGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 24, 16);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Normalized u: 0 = tail (-X), 1 = snout (+X)
    const u = (v.x + 1) * 0.5;

    // Map u along length X: -0.45 (caudal peduncle) to +0.35 (snout)
    const x = -0.45 + u * 0.80;

    // Height envelope profile (peak dorsal arch at u ~ 0.62)
    let h: number;
    if (u > 0.62) {
      const nu = (u - 0.62) / 0.38;
      h = 0.27 * Math.sqrt(Math.max(0.01, 1 - nu * nu * 0.92));
    } else {
      const nu = u / 0.62;
      h = 0.055 + 0.215 * Math.sin(nu * Math.PI * 0.5);
    }

    // Laterally compressed width (fish is narrower than tall)
    const w = h * 0.52;

    // Subtle dorsal ridge elevation
    const dorsalOffset = Math.sin(u * Math.PI) * 0.022;

    // Cross-sectional ellipse
    const radial = Math.sqrt(v.y * v.y + v.z * v.z);
    const ny = radial > 0.0001 ? v.y / radial : 0;
    const nz = radial > 0.0001 ? v.z / radial : 0;

    pos.setXYZ(i, x, ny * h + dorsalOffset, nz * w);
  }

  geo.computeVertexNormals();
  return geo;
}

/** Creates a tapered band that hugs the exact contour of the fish body */
function createStripeGeometry(
  uCenter: number,
  uWidth: number,
  radialOffset = 0.004,
  dorsalBulge = 0,
): THREE.BufferGeometry {
  const segments = 28;
  const rings = 4;
  const geo = new THREE.BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const u = (uCenter - uWidth * 0.5) + t * uWidth;
    const x = -0.45 + u * 0.80;

    let h: number;
    if (u > 0.62) {
      const nu = (u - 0.62) / 0.38;
      h = 0.27 * Math.sqrt(Math.max(0.01, 1 - nu * nu * 0.92));
    } else {
      const nu = u / 0.62;
      h = 0.055 + 0.215 * Math.sin(nu * Math.PI * 0.5);
    }
    const w = h * 0.52;
    const dorsalOffset = Math.sin(u * Math.PI) * 0.022;

    for (let s = 0; s <= segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Iconic forward-pointing dorsal peak on middle stripe
      let bulge = 0;
      if (dorsalBulge > 0 && cosA > 0.2) {
        bulge = dorsalBulge * Math.pow(cosA, 2) * Math.sin(t * Math.PI);
      }

      const y = cosA * (h + radialOffset + bulge) + dorsalOffset;
      const z = sinA * (w + radialOffset);

      vertices.push(x, y, z);
    }
  }

  for (let r = 0; r < rings; r++) {
    for (let s = 0; s <= segments; s++) {
      const a = r * (segments + 1) + s;
      const b = (r + 1) * (segments + 1) + s;
      const c = (r + 1) * (segments + 1) + (s + 1);
      const d = r * (segments + 1) + (s + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFish(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const fishM     = mat(0xff6810);
  const stripeM   = mat(0xfcfdff);
  const borderM   = mat(0x1a1a1a);
  const finM      = mat(0xff5511);
  const eyePupilM = matE(0x0a0a0a, 0x111111, 0.2);

  // 1. Streamlined organic body
  const body = mkMesh(createFishBodyGeometry(), fishM);
  pivot.add(body);
  parts['bodyMesh'] = body;

  // 2. Contoured white stripes with black edging
  // Head / Ocular band
  pivot.add(mkMesh(createStripeGeometry(0.75, 0.088, 0.002), borderM));
  pivot.add(mkMesh(createStripeGeometry(0.75, 0.065, 0.004), stripeM));

  // Mid-body band with dorsal peak
  pivot.add(mkMesh(createStripeGeometry(0.48, 0.098, 0.002, 0.030), borderM));
  pivot.add(mkMesh(createStripeGeometry(0.48, 0.075, 0.004, 0.026), stripeM));

  // Tail peduncle band
  pivot.add(mkMesh(createStripeGeometry(0.13, 0.064, 0.002), borderM));
  pivot.add(mkMesh(createStripeGeometry(0.13, 0.046, 0.004), stripeM));

  // 3. Caudal Fin (Tail) — smooth fan with rounded curves & animation pivot
  const tailG = new THREE.Group();
  tailG.position.set(-0.45, 0, 0);
  parts['tail'] = tailG;
  pivot.add(tailG);

  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0.035);
  tailShape.bezierCurveTo(-0.06, 0.12, -0.16, 0.22, -0.28, 0.20);
  tailShape.quadraticCurveTo(-0.34, 0.12, -0.34, 0.0);
  tailShape.quadraticCurveTo(-0.34, -0.12, -0.28, -0.20);
  tailShape.bezierCurveTo(-0.16, -0.22, -0.06, -0.12, 0, -0.035);
  tailShape.closePath();

  const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });
  tailGeo.translate(0, 0, -0.006);
  tailG.add(mkMesh(tailGeo, finM));

  // Inner white accent on caudal fin
  const tailInnerShape = new THREE.Shape();
  tailInnerShape.moveTo(-0.08, 0.025);
  tailInnerShape.bezierCurveTo(-0.12, 0.07, -0.18, 0.13, -0.24, 0.11);
  tailInnerShape.quadraticCurveTo(-0.28, 0.06, -0.28, 0.0);
  tailInnerShape.quadraticCurveTo(-0.28, -0.06, -0.24, -0.11);
  tailInnerShape.bezierCurveTo(-0.18, -0.13, -0.12, -0.07, -0.08, -0.025);
  tailInnerShape.closePath();
  const tailInnerGeo = new THREE.ExtrudeGeometry(tailInnerShape, { depth: 0.014, bevelEnabled: false });
  tailInnerGeo.translate(0, 0, -0.007);
  tailG.add(mkMesh(tailInnerGeo, stripeM));

  // Black trailing edge on caudal fin
  const tailEdgeShape = new THREE.Shape();
  tailEdgeShape.moveTo(-0.26, 0.18);
  tailEdgeShape.quadraticCurveTo(-0.35, 0.11, -0.35, 0.0);
  tailEdgeShape.quadraticCurveTo(-0.35, -0.11, -0.26, -0.18);
  tailEdgeShape.quadraticCurveTo(-0.31, -0.09, -0.31, 0.0);
  tailEdgeShape.quadraticCurveTo(-0.31, 0.09, -0.26, 0.18);
  tailEdgeShape.closePath();
  const tailEdgeGeo = new THREE.ExtrudeGeometry(tailEdgeShape, { depth: 0.015, bevelEnabled: false });
  tailEdgeGeo.translate(0, 0, -0.0075);
  tailG.add(mkMesh(tailEdgeGeo, borderM));

  // 4. Dorsal Fin — undulating crest along spine
  const dorsalG = new THREE.Group();
  dorsalG.position.set(0, 0, 0);
  parts['dorsal'] = dorsalG;
  pivot.add(dorsalG);

  const dorsalShape = new THREE.Shape();
  dorsalShape.moveTo(0.18, 0.19);
  dorsalShape.quadraticCurveTo(0.12, 0.35, 0.02, 0.36);
  dorsalShape.quadraticCurveTo(-0.10, 0.28, -0.18, 0.30);
  dorsalShape.quadraticCurveTo(-0.28, 0.26, -0.34, 0.08);
  dorsalShape.lineTo(-0.34, 0.04);
  dorsalShape.quadraticCurveTo(-0.16, 0.18, 0.18, 0.19);
  dorsalShape.closePath();

  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
    depth: 0.010,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });
  dorsalGeo.translate(0, 0, -0.005);
  dorsalG.add(mkMesh(dorsalGeo, finM));

  // Black margin on dorsal fin
  const dorsalTrimShape = new THREE.Shape();
  dorsalTrimShape.moveTo(0.16, 0.32);
  dorsalTrimShape.quadraticCurveTo(0.11, 0.365, 0.02, 0.375);
  dorsalTrimShape.quadraticCurveTo(-0.10, 0.295, -0.18, 0.315);
  dorsalTrimShape.quadraticCurveTo(-0.28, 0.275, -0.34, 0.09);
  dorsalTrimShape.quadraticCurveTo(-0.27, 0.24, -0.18, 0.27);
  dorsalTrimShape.quadraticCurveTo(-0.10, 0.25, 0.02, 0.33);
  dorsalTrimShape.quadraticCurveTo(0.10, 0.32, 0.16, 0.32);
  dorsalTrimShape.closePath();
  const dorsalTrimGeo = new THREE.ExtrudeGeometry(dorsalTrimShape, { depth: 0.012, bevelEnabled: false });
  dorsalTrimGeo.translate(0, 0, -0.006);
  dorsalG.add(mkMesh(dorsalTrimGeo, borderM));

  // 5. Anal Fin — bottom rear fin
  const analShape = new THREE.Shape();
  analShape.moveTo(-0.06, -0.16);
  analShape.quadraticCurveTo(-0.14, -0.27, -0.22, -0.25);
  analShape.quadraticCurveTo(-0.30, -0.18, -0.32, -0.06);
  analShape.lineTo(-0.30, -0.05);
  analShape.quadraticCurveTo(-0.18, -0.12, -0.06, -0.16);
  analShape.closePath();

  const analGeo = new THREE.ExtrudeGeometry(analShape, {
    depth: 0.010,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 1,
  });
  analGeo.translate(0, 0, -0.005);
  pivot.add(mkMesh(analGeo, finM));

  // 6. Pelvic Fins (under chest)
  [-0.035, 0.035].forEach((pz, idx) => {
    const pelvicShape = new THREE.Shape();
    pelvicShape.moveTo(0, 0);
    pelvicShape.quadraticCurveTo(-0.04, -0.08, -0.10, -0.12);
    pelvicShape.quadraticCurveTo(-0.08, -0.05, -0.03, 0);
    pelvicShape.closePath();

    const pelvicGeo = new THREE.ExtrudeGeometry(pelvicShape, { depth: 0.006, bevelEnabled: false });
    pelvicGeo.translate(0, 0, -0.003);
    const pelvic = mkMesh(pelvicGeo, finM);
    pelvic.position.set(0.10, -0.16, pz);
    pelvic.rotation.x = idx === 0 ? 0.2 : -0.2;
    pivot.add(pelvic);
  });

  // 7. Pectoral Fins (Left & Right paddles)
  const pecShape = new THREE.Shape();
  pecShape.moveTo(0, 0.02);
  pecShape.bezierCurveTo(0.04, 0.08, 0.12, 0.08, 0.18, 0.03);
  pecShape.quadraticCurveTo(0.20, -0.04, 0.14, -0.07);
  pecShape.bezierCurveTo(0.08, -0.08, 0.02, -0.04, 0, -0.02);
  pecShape.closePath();

  const pecGeo = new THREE.ExtrudeGeometry(pecShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  pecGeo.translate(0, 0, -0.004);

  const pecTrimShape = new THREE.Shape();
  pecTrimShape.moveTo(0.12, 0.075);
  pecTrimShape.quadraticCurveTo(0.19, 0.03, 0.21, -0.04);
  pecTrimShape.quadraticCurveTo(0.15, -0.075, 0.13, -0.07);
  pecTrimShape.quadraticCurveTo(0.18, -0.035, 0.17, 0.025);
  pecTrimShape.closePath();
  const pecTrimGeo = new THREE.ExtrudeGeometry(pecTrimShape, { depth: 0.009, bevelEnabled: false });
  pecTrimGeo.translate(0, 0, -0.0045);

  // Left Pectoral
  const lPec = new THREE.Group();
  lPec.position.set(0.08, -0.04, 0.12);
  parts['lPec'] = lPec;
  const lPecMesh = mkMesh(pecGeo, finM);
  lPecMesh.rotation.y = Math.PI * 0.82;
  lPecMesh.rotation.z = -0.15;
  lPec.add(lPecMesh);
  const lPecTrim = mkMesh(pecTrimGeo, borderM);
  lPecTrim.rotation.y = Math.PI * 0.82;
  lPecTrim.rotation.z = -0.15;
  lPec.add(lPecTrim);
  pivot.add(lPec);

  // Right Pectoral
  const rPec = new THREE.Group();
  rPec.position.set(0.08, -0.04, -0.12);
  parts['rPec'] = rPec;
  const rPecMesh = mkMesh(pecGeo, finM);
  rPecMesh.rotation.y = -Math.PI * 0.82;
  rPecMesh.rotation.z = 0.15;
  rPec.add(rPecMesh);
  const rPecTrim = mkMesh(pecTrimGeo, borderM);
  rPecTrim.rotation.y = -Math.PI * 0.82;
  rPecTrim.rotation.z = 0.15;
  rPec.add(rPecTrim);
  pivot.add(rPec);

  // 8. Eyes & Snout
  [0.12, -0.12].forEach((ez, idx) => {
    const eyeG = new THREE.Group();
    eyeG.position.set(0.22, 0.05, ez);
    eyeG.rotation.y = idx === 0 ? 0.25 : -0.25;

    const sclera = mkMesh(sphere(0.048, 10, 8), stripeM);
    sclera.scale.set(0.9, 1.0, 0.85);
    eyeG.add(sclera);

    const iris = mkMesh(sphere(0.038, 8, 6), mat(0xff8800));
    iris.position.set(0.012, 0, idx === 0 ? 0.014 : -0.014);
    eyeG.add(iris);

    const pupil = mkMesh(sphere(0.026, 8, 6), eyePupilM);
    pupil.position.set(0.022, 0, idx === 0 ? 0.020 : -0.020);
    eyeG.add(pupil);

    const glint = mkMesh(sphere(0.009, 5, 4), stripeM);
    glint.position.set(0.032, 0.012, idx === 0 ? 0.026 : -0.026);
    eyeG.add(glint);

    pivot.add(eyeG);
  });

  // Snout & Mouth
  const mouthG = new THREE.Group();
  mouthG.position.set(0.35, -0.02, 0);
  const upperLip = mkMesh(sphere(0.032, 8, 6), fishM);
  upperLip.scale.set(1.2, 0.5, 0.8);
  upperLip.position.set(0, 0.010, 0);
  mouthG.add(upperLip);

  const lowerLip = mkMesh(sphere(0.028, 8, 6), fishM);
  lowerLip.scale.set(1.1, 0.45, 0.7);
  lowerLip.position.set(-0.01, -0.010, 0);
  mouthG.add(lowerLip);

  const mouthInside = mkMesh(sphere(0.020, 6, 5), mat(0x3a1200));
  mouthInside.position.set(-0.005, 0, 0);
  mouthG.add(mouthInside);
  pivot.add(mouthG);

  // Boost fish scale so it is easily visible swimming in the clear tank
  pivot.scale.set(1.9, 1.9, 1.9);
  group.visible = true;
  pivot.visible = true;

  const habitat = HABITATS[4];
  return {
    id: 'fish', name: 'Clownfish', habitat: 'Aquatic Zone', position: pos,
    color: 0xff6600, accentColor: 0xff3300, animationType: 'swim',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius - 4.5),
    labelHeight: 1.3,
    colorParts: { body: 0xff6810, stripes: 0xfcfdff, eyes: 0x0a0a0a },
    colorMaterials: { body: [fishM, finM], stripes: [stripeM], eyes: [eyePupilM] },
  };
}

// ---------------------------------------------------------------------------
// RABBIT
// ---------------------------------------------------------------------------
function buildRabbit(pos: THREE.Vector3): AnimalData {
  const { group, pivot } = makeGroupWithPivot();
  const parts: Record<string, THREE.Object3D> = {};

  const rM      = mat(0xe8e2dc);
  const bellyM  = mat(0xfdfbf9);
  const innerM  = mat(0xf7b6c2);
  const eyeM    = matE(0xaa2244, 0xee2244, 0.6);
  const noseM   = mat(0xf5a5b5);

  // 1. Plump Fluffy Teardrop Bunny Body
  const torso = mkMesh(sphere(0.32, 14, 12), rM);
  torso.scale.set(1.05, 1.15, 0.92);
  torso.position.set(0, 0.38, 0);
  pivot.add(torso);

  // Soft cream chest & belly
  const belly = mkMesh(sphere(0.26, 10, 8), bellyM);
  belly.scale.set(0.9, 0.95, 0.75);
  belly.position.set(0.10, 0.36, 0);
  pivot.add(belly);

  // Large rounded back haunches
  [-0.18, 0.18].forEach(hz => {
    const haunch = mkMesh(sphere(0.20, 10, 8), rM);
    haunch.scale.set(1.2, 0.9, 0.75);
    haunch.position.set(-0.12, 0.34, hz);
    pivot.add(haunch);
  });

  // Fluffy Cotton-Ball Tail
  const tail = mkMesh(sphere(0.11, 8, 7), bellyM);
  tail.position.set(-0.30, 0.38, 0);
  pivot.add(tail);

  // 2. Cute Head
  const headG = new THREE.Group();
  headG.position.set(0.08, 0.72, 0);
  parts['head'] = headG;
  pivot.add(headG);

  // Skull
  const skull = mkMesh(sphere(0.23, 12, 10), rM);
  skull.scale.set(1.05, 1.0, 0.95);
  headG.add(skull);

  // Puffy Cheek Pads
  [-0.13, 0.13].forEach(cz => {
    const cheek = mkMesh(sphere(0.12, 8, 6), bellyM);
    cheek.position.set(0.08, -0.06, cz);
    headG.add(cheek);
  });

  // Snout & Pink Nose
  const snout = mkMesh(sphere(0.10, 8, 6), bellyM);
  snout.position.set(0.18, -0.05, 0);
  headG.add(snout);

  const nose = mkMesh(sphere(0.04, 6, 5), noseM);
  nose.scale.set(0.8, 0.6, 1.1);
  nose.position.set(0.26, -0.03, 0);
  headG.add(nose);

  // Shiny Ruby / Dark Eyes
  [-0.14, 0.14].forEach((ez, idx) => {
    const eye = mkMesh(sphere(0.055, 8, 6), eyeM);
    eye.position.set(0.12, 0.08, ez);
    headG.add(eye);
    const glint = mkMesh(sphere(0.012, 5, 4), mat(0xffffff));
    glint.position.set(0.15, 0.10, idx === 0 ? ez + 0.015 : ez - 0.015);
    headG.add(glint);
  });

  // 3. Long Spoon-Shaped Bunny Ears
  [-0.10, 0.10].forEach((ez, idx) => {
    const earG = new THREE.Group();
    earG.position.set(-0.06, 0.24, ez);
    earG.rotation.set(ez > 0 ? 0.12 : -0.12, 0, -0.15);
    parts[idx === 0 ? 'earR' : 'earL'] = earG;
    headG.add(earG);

    // Outer ear
    const earShape = new THREE.Shape();
    earShape.moveTo(0, 0);
    earShape.quadraticCurveTo(0.06, 0.25, 0.05, 0.52);
    earShape.quadraticCurveTo(0, 0.58, -0.05, 0.52);
    earShape.quadraticCurveTo(-0.06, 0.25, 0, 0);
    earShape.closePath();

    const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
    earGeo.center();
    earGeo.translate(0, 0.28, 0);
    const ear = mkMesh(earGeo, rM);
    earG.add(ear);

    // Inner pink hollow
    const innerGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.032, bevelEnabled: false });
    innerGeo.center();
    innerGeo.scale(0.65, 0.85, 1);
    innerGeo.translate(0, 0.26, 0);
    const inner = mkMesh(innerGeo, innerM);
    earG.add(inner);
  });

  // 4. Powerful Hind Legs & Delicate Front Paws
  // Back legs
  const backDefs: [number, number, string][] = [
    [-0.05,  0.16, 'BL'],
    [-0.05, -0.16, 'BR'],
  ];
  backDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.24, 0.08, 0.22, 0.065, 0.07, rM, lx, 0.38, lz, bellyM, true);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  // Front paws
  const frontDefs: [number, number, string][] = [
    [ 0.10,  0.12, 'FL'],
    [ 0.10, -0.12, 'FR'],
  ];
  frontDefs.forEach(([lx, lz, name]) => {
    const { pivot: lp, lowerPivot } = buildLeg(pivot, 0.16, 0.06, 0.14, 0.05, 0.055, rM, lx, 0.38, lz, bellyM, false);
    parts[`leg${name}`] = lp;
    parts[`legLower${name}`] = lowerPivot;
  });

  const habitat = HABITATS[3];
  group.scale.setScalar(1.3);
  return {
    id: 'rabbit', name: 'Rabbit', habitat: 'Aviary', position: pos,
    color: 0xe0d8d0, accentColor: 0xffb6c1, animationType: 'hop',
    group, parts, phaseOffset: Math.random() * Math.PI * 2,
    patrolPath: [], patrolIndex: 0, patrolT: 0,
    wanderTarget: randomInCircle(habitat.center.x, habitat.center.z, habitat.radius),
    labelHeight: 2.3,
    colorParts: { body: 0xe8e2dc, nose: 0xf5a5b5, eyes: 0xaa2244 },
    colorMaterials: { body: [rM, bellyM, innerM], nose: [noseM], eyes: [eyeM] },
  };
}

// ---------------------------------------------------------------------------
// Species Metadata & Spawner Factory
// ---------------------------------------------------------------------------
export interface SpeciesColorPart {
  key: string;
  label: string;
  defaultColor: string;
}

export interface SpeciesOption {
  id: string;
  name: string;
  habitat: HabitatName;
  emoji: string;
  defaultColor: string;
  defaultName: string;
  colorParts: SpeciesColorPart[];
}

export const ANIMAL_SPECIES: SpeciesOption[] = [
  { id: 'rabbit',    name: 'Rabbit',    habitat: 'Aviary',       emoji: '🐰', defaultColor: '#e0d8d0', defaultName: 'Barnaby',
    colorParts: [
      { key: 'body', label: 'Body', defaultColor: '#e0d8d0' },
      { key: 'nose', label: 'Nose', defaultColor: '#f5a5b5' },
      { key: 'eyes', label: 'Eyes', defaultColor: '#aa2244' },
    ],
  },
  { id: 'elephant',  name: 'Elephant',  habitat: 'Savanna',      emoji: '🐘', defaultColor: '#8c8f94', defaultName: 'Peanut',
    colorParts: [{ key: 'body', label: 'Body', defaultColor: '#8c8f94' }],
  },
  { id: 'zebra',     name: 'Zebra',     habitat: 'Savanna',      emoji: '🦓', defaultColor: '#ffffff', defaultName: 'Marty',
    colorParts: [
      { key: 'body', label: 'Body', defaultColor: '#ffffff' },
      { key: 'stripes', label: 'Stripes', defaultColor: '#1a1a1a' },
      { key: 'mane', label: 'Mane', defaultColor: '#1a1a1a' },
      { key: 'muzzle', label: 'Muzzle', defaultColor: '#333333' },
      { key: 'eyes', label: 'Eyes', defaultColor: '#0a0a0a' },
    ],
  },
  { id: 'fish',      name: 'Clownfish', habitat: 'Aquatic Zone', emoji: '🐠', defaultColor: '#ff6810', defaultName: 'Nemo',
    colorParts: [
      { key: 'body',    label: 'Body',    defaultColor: '#ff6810' },
      { key: 'stripes', label: 'Stripes', defaultColor: '#fcfdff' },
      { key: 'eyes',    label: 'Eyes',    defaultColor: '#0a0a0a' },
    ],
  },
  { id: 'turtle',    name: 'Turtle',    habitat: 'Reptile Zone', emoji: '🐢', defaultColor: '#5a6b32', defaultName: 'Shelly',
    colorParts: [
      { key: 'shell', label: 'Shell', defaultColor: '#5a6b32' },
      { key: 'limbs', label: 'Limbs', defaultColor: '#8ea65d' },
      { key: 'eyes',  label: 'Eyes',  defaultColor: '#0e0e0e' },
    ],
  },
  { id: 'snake',     name: 'Snake',     habitat: 'Reptile Zone', emoji: '🐍', defaultColor: '#2d7c2d', defaultName: 'Sly',
    colorParts: [
      { key: 'body',    label: 'Body',    defaultColor: '#2d7c2d' },
      { key: 'pattern', label: 'Pattern', defaultColor: '#164416' },
      { key: 'eyes',    label: 'Eyes',    defaultColor: '#ddcc00' },
      { key: 'tongue',  label: 'Tongue',  defaultColor: '#dd1818' },
    ],
  },
  { id: 'bird',      name: 'Bird',      habitat: 'Aviary',       emoji: '🦜', defaultColor: '#eb4818', defaultName: 'Pip',
    colorParts: [
      { key: 'body',    label: 'Body',    defaultColor: '#eb4818' },
      { key: 'wings',   label: 'Wings',   defaultColor: '#ff7020' },
      { key: 'pattern', label: 'Breast',  defaultColor: '#ffcc00' },
      { key: 'eyes',    label: 'Eyes',    defaultColor: '#0a0a0a' },
    ],
  },
  { id: 'monkey',    name: 'Monkey',    habitat: 'Jungle',       emoji: '🐵', defaultColor: '#60421d', defaultName: 'Milo',
    colorParts: [
      { key: 'body', label: 'Body', defaultColor: '#60421d' },
      { key: 'face', label: 'Face', defaultColor: '#eecbb0' },
      { key: 'tail', label: 'Tail', defaultColor: '#60421d' },
    ],
  },
  { id: 'shark', name: 'Shark', habitat: 'Aquatic Zone', emoji: '🦈', defaultColor: '#ffffff', defaultName: 'Bruce',
    colorParts: [
      { key: 'body', label: 'Body', defaultColor: '#ffffff' },
      { key: 'belly', label: 'Belly', defaultColor: '#ffffff' },
      { key: 'fins', label: 'Fins', defaultColor: '#ffffff' },
      { key: 'eyes', label: 'Eyes', defaultColor: '#ffffff' },
    ],
  },
  { id: 'wolf', name: 'Baby Wolf', habitat: 'Jungle', emoji: '🐺', defaultColor: '#ffffff', defaultName: 'Ghost',
    colorParts: [
      { key: 'body', label: 'Body', defaultColor: '#ffffff' },
      { key: 'belly', label: 'Belly', defaultColor: '#ffffff' },
      { key: 'tail', label: 'Tail', defaultColor: '#ffffff' },
      { key: 'snout', label: 'Snout', defaultColor: '#ffffff' },
      { key: 'eyes', label: 'Eyes', defaultColor: '#ffffff' },
    ],
  },
];

export function spawnAnimal(
  speciesId: string,
  customName?: string,
  customColor?: string,
  customColors?: Record<string, string>,
): AnimalData {
  const species = ANIMAL_SPECIES.find(
    s => s.id === speciesId || s.name.toLowerCase() === speciesId.toLowerCase(),
  ) ?? ANIMAL_SPECIES[0];

  // Pick random location inside designated habitat enclosure
  const habitat = HABITATS.find(h => h.name === species.habitat) ?? HABITATS[0];
  const maxR = species.habitat === 'Aquatic Zone' ? Math.max(2, habitat.radius - 5.5) : Math.max(3, habitat.radius - 5);
  const ang = Math.random() * Math.PI * 2;
  const dist = Math.random() * maxR;
  const spawnX = habitat.center.x + Math.cos(ang) * dist;
  const spawnZ = habitat.center.z + Math.sin(ang) * dist;
  const spawnY = species.habitat === 'Aquatic Zone' ? -1.10 : 0;
  const pos = new THREE.Vector3(spawnX, spawnY, spawnZ);

  let animal: AnimalData;
  switch (species.id) {
    case 'elephant':  animal = buildElephant(pos); break;
    case 'giraffe':   animal = buildGiraffe(pos);  break;
    case 'zebra':     animal = buildZebra(pos);    break;
    case 'monkey':    animal = buildMonkey(pos);   break;
    case 'snake':     animal = buildSnake(pos); break;
    case 'bird':      animal = buildBird(pos); break;
    case 'shark':     animal = buildShark(pos); break;
    case 'wolf':      animal = buildWolf(pos); break;
    case 'turtle':    animal = buildTurtle(pos);   break;
    case 'fish':      animal = buildFish(pos);     break;
    case 'rabbit':
    default:          animal = buildRabbit(pos);   break;
  }

  if (customName && customName.trim().length > 0) {
    animal.name = customName.trim();
  }

  // Apply multi-part colors if provided
  if (customColors) {
    if (!animal.colorParts) animal.colorParts = {};
    for (const [partKey, hexStr] of Object.entries(customColors)) {
      const tint = new THREE.Color(hexStr);
      
      // Store immediately so async GLB loaders will pick it up when they finish loading
      animal.colorParts[partKey] = tint.getHex();
      
      // If materials are already loaded (e.g. synchronous procedural animals), tint them now
      if (animal.colorMaterials && animal.colorMaterials[partKey]) {
        animal.colorMaterials[partKey].forEach(m => {
          m.color.set(tint);
          if ('map' in m) (m as any).map = null;
          if ('vertexColors' in m) (m as any).vertexColors = false;
          m.needsUpdate = true;
        });
      }
    }
  }
  // Fallback: single-color tinting (backwards compatibility)
  else if (customColor) {
    const tint = new THREE.Color(customColor);
    animal.color = tint.getHex();
    if (animal.colorMaterials?.body) {
      animal.colorMaterials.body.forEach(m => m.color.set(tint));
    } else {
      animal.group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(m => {
              const cloned = m.clone();
              if ('color' in cloned && cloned.color instanceof THREE.Color) {
                cloned.color.set(tint);
              }
              return cloned;
            });
          } else {
            const cloned = child.material.clone();
            if ('color' in cloned && cloned.color instanceof THREE.Color) {
              cloned.color.set(tint);
            }
            child.material = cloned;
          }
        }
      });
    }
  }

  animal.group.position.copy(animal.position);
  return animal;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
export function buildAnimals(scene: THREE.Scene): AnimalData[] {
  const allAnimals: AnimalData[] = [
    buildElephant( new THREE.Vector3(-38, 0, -42)), // Savanna
    buildZebra(    new THREE.Vector3(-55, 0, -60)), // Savanna
    buildMonkey(   new THREE.Vector3( 42, 0, -58)), // Jungle
    buildSnake(    new THREE.Vector3( 58, 0,  42)), // Reptile
    buildBird(     new THREE.Vector3(-52, 0,  40)), // Aviary
    buildTurtle(   new THREE.Vector3( 42, 0,  58)), // Reptile
    buildFish(     new THREE.Vector3(  0, -1.10, 0)), // Aquatic (unchanged)
    buildRabbit(   new THREE.Vector3(-42, 0,  58)), // Aviary
  ];

  const animals: AnimalData[] = [];
  allAnimals.forEach((animal, index) => {
    const instanceKey = `default_${animal.id}`;
    animal.group.userData.instanceId = instanceKey;
    if (isAnimalReleased(instanceKey)) {
      return; // Skipped because admin released this animal
    }
    const savedName = getSavedAnimalName(instanceKey, index);
    if (savedName) {
      animal.name = savedName;
    }
    animal.group.position.copy(animal.position);
    scene.add(animal.group);
    animals.push(animal);
  });

  return animals;
}
