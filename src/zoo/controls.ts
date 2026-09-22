import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ZooControls {
  update: () => void;
  dispose: () => void;
  panTo: (target: THREE.Vector3, radius?: number, phi?: number, theta?: number) => void;
  panToPosition: (target: THREE.Vector3, camPos: THREE.Vector3) => void;
  getLookTarget: () => THREE.Vector3;
  getSpherical: () => THREE.Spherical;
  orbit: OrbitControls;
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
): ZooControls {

  const orbit = new OrbitControls(camera, dom);
  orbit.enableZoom = true;
  orbit.enablePan = true;
  orbit.screenSpacePanning = true;
  orbit.maxPolarAngle = Math.PI / 2 - 0.05; // Prevents camera from dipping below the floor
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.05;
  
  // Set initial target
  orbit.target.set(0, 0, 0);

  // Manual lerp states
  let isLerping = false;
  let lerpTarget = new THREE.Vector3();
  let lerpCamPos = new THREE.Vector3();

  // Keyboard tracking
  const keys = new Set<string>();
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    keys.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function update() {
    if (isLerping) {
      orbit.target.lerp(lerpTarget, 0.075);
      camera.position.lerp(lerpCamPos, 0.075);
      
      // Stop lerping if we are close enough
      if (orbit.target.distanceTo(lerpTarget) < 0.08 && camera.position.distanceTo(lerpCamPos) < 0.08) {
        camera.position.copy(lerpCamPos);
        orbit.target.copy(lerpTarget);
        isLerping = false;
        orbit.enabled = true; // Give control back to the user!
      }
    } else if (keys.size > 0 && orbit.enabled) {
      // WASD panning
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 0.001) {
        fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
        fwd.y = 0;
      }
      fwd.normalize();
      
      const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
      
      const dist = camera.position.distanceTo(orbit.target);
      const panSpeed = Math.max(0.4, (dist / 50) * 1.8); // Refined and slightly faster pan speed
      
      const offset = new THREE.Vector3();
      if (keys.has('KeyW') || keys.has('ArrowUp')) offset.addScaledVector(fwd, panSpeed);
      if (keys.has('KeyS') || keys.has('ArrowDown')) offset.addScaledVector(fwd, -panSpeed);
      if (keys.has('KeyA') || keys.has('ArrowLeft')) offset.addScaledVector(right, -panSpeed);
      if (keys.has('KeyD') || keys.has('ArrowRight')) offset.addScaledVector(right, panSpeed);
      
      if (offset.lengthSq() > 0) {
        orbit.target.add(offset);
        camera.position.add(offset);
      }
    }
    orbit.update();
  }
  
  function dispose() {
    orbit.dispose();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }
  
  function panTo(target: THREE.Vector3, radius = 22, phi?: number, theta?: number) {
    // Current spherical direction relative to the target so camera zooms along line of sight
    const relVec = camera.position.clone().sub(target);
    if (relVec.lengthSq() < 0.001) {
      relVec.set(0, 1, 2);
    }
    const currentSph = new THREE.Spherical().setFromVector3(relVec);
    
    // Target spherical
    const newRadius = radius;
    const newPhi = phi !== undefined ? phi : Math.min(Math.max(currentSph.phi, 0.35), Math.PI / 2 - 0.08);
    const newTheta = theta !== undefined ? theta : currentSph.theta;
    
    const targetSph = new THREE.Spherical(newRadius, newPhi, newTheta);
    
    // Calculate new camera position
    const offset = new THREE.Vector3().setFromSpherical(targetSph);
    
    lerpTarget.copy(target);
    lerpCamPos.copy(target).add(offset);
    
    isLerping = true;
    orbit.enabled = false; // Stop the user from fighting the camera
  }

  function panToPosition(target: THREE.Vector3, camPos: THREE.Vector3) {
    lerpTarget.copy(target);
    lerpCamPos.copy(camPos);
    isLerping = true;
    orbit.enabled = false;
  }
  
  function getLookTarget(): THREE.Vector3 {
    return orbit.target.clone();
  }
  
  function getSpherical(): THREE.Spherical {
    return new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
  }

  return { update, dispose, panTo, panToPosition, getLookTarget, getSpherical, orbit };
}
