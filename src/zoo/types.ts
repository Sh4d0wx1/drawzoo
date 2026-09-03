import * as THREE from 'three';

export type HabitatName = 'Savanna' | 'Jungle' | 'Reptile Zone' | 'Aviary' | 'Aquatic Zone';

export interface Habitat {
  name: HabitatName;
  center: THREE.Vector3;
  radius: number;
  groundColor: number;
  accentColor: number;
}

export type AnimationType = 'walk' | 'slither' | 'fly' | 'swim' | 'hop' | 'jump' | 'idle';

export interface AnimalData {
  id: string;
  name: string;
  habitat: HabitatName;
  position: THREE.Vector3;
  color: number;
  accentColor: number;
  animationType: AnimationType;
  /** Root group containing all meshes for this animal */
  group: THREE.Group;
  /** Parts that move during animation, keyed by part name */
  parts: Record<string, THREE.Object3D>;
  /** Animation phase offset so animals don't all sync */
  phaseOffset: number;
  /** Patrol path points */
  patrolPath: THREE.Vector3[];
  patrolIndex: number;
  patrolT: number;
  /** Random wander target within habitat */
  wanderTarget: THREE.Vector3;
  /** How tall the animal is (used to position the name label) */
  labelHeight: number;
  /** Elapsed time until which this animal is idling (optional) */
  idleUntil?: number;
  /** For jump type: current arc height added on top of wander y */
  jumpArcY?: number;
  /** Optional THREE.AnimationMixer for GLB embedded skeletal animations */
  mixer?: THREE.AnimationMixer;
}

export interface ZooState {
  selectedAnimal: AnimalData | null;
}
