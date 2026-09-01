import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------
const MIN_POLAR   = 0.18;              // ~10° from zenith
const MAX_POLAR   = Math.PI * 0.44;    // ~80° — never go below horizon
const MIN_RADIUS  = 6;
const MAX_RADIUS  = 95;
const ORBIT_SPEED = 0.0040;
const ZOOM_SPEED  = 0.10;
const LERP_CAM    = 0.095;            // camera smoothing
const LERP_KEY    = 0.12;            // keyboard pan smoothing

// How far the look-at point can stray from zoo centre
const TARGET_BOUND_XZ = 52;
const TARGET_BOUND_Y  = 16;

// Keyboard pan speed (world units per second at zoom 1.0)
const KEY_PAN_SPEED   = 18;

interface State {
  // Pointer
  isDown: boolean;
  isRightDrag: boolean;
  lastX: number;
  lastY: number;
  // Spherical (current / desired)
  sph:    THREE.Spherical;
  sphT:   THREE.Spherical;
  // Look-at target (current / desired)
  look:   THREE.Vector3;
  lookT:  THREE.Vector3;
  // Keyboard
  keys: Set<string>;
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
): { update: () => void; dispose: () => void } {

  const state: State = {
    isDown: false,
    isRightDrag: false,
    lastX: 0,
    lastY: 0,
    // Start from a nice overview: slightly south-east, 50 units out, 45° elevation
    sph:  new THREE.Spherical(52, Math.PI * 0.28, Math.PI * 0.20),
    sphT: new THREE.Spherical(52, Math.PI * 0.28, Math.PI * 0.20),
    look:  new THREE.Vector3(0, 0, 0),
    lookT: new THREE.Vector3(0, 0, 0),
    keys:  new Set(),
  };

  // -------------------------------------------------------------------------
  // Pointer
  // -------------------------------------------------------------------------
  function onPointerDown(e: PointerEvent): void {
    state.isDown = true;
    state.isRightDrag = e.button === 2 || e.ctrlKey || e.metaKey;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    dom.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!state.isDown) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    if (state.isRightDrag) {
      // Pan: slide look-at point in camera-space XZ plane
      const fwd = new THREE.Vector3()
        .subVectors(state.lookT, camera.position)
        .normalize();
      const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const panScale = state.sphT.radius * 0.0008;
      state.lookT.addScaledVector(right,   -dx * panScale);
      state.lookT.addScaledVector(worldUp,  dy * panScale);
      clampTarget(state.lookT);
    } else {
      // Orbit
      state.sphT.theta -= dx * ORBIT_SPEED;
      state.sphT.phi    = THREE.MathUtils.clamp(
        state.sphT.phi - dy * ORBIT_SPEED,
        MIN_POLAR, MAX_POLAR,
      );
    }
  }

  function onPointerUp(): void { state.isDown = false; }

  // -------------------------------------------------------------------------
  // Wheel zoom
  // -------------------------------------------------------------------------
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 + ZOOM_SPEED : 1 - ZOOM_SPEED;
    state.sphT.radius = THREE.MathUtils.clamp(
      state.sphT.radius * factor, MIN_RADIUS, MAX_RADIUS,
    );
  }

  // -------------------------------------------------------------------------
  // Touch (pinch + drag)
  // -------------------------------------------------------------------------
  let lastTouchDist = 0;

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      state.isDown = true;
      state.isRightDrag = false;
      state.lastX = e.touches[0].clientX;
      state.lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length === 1 && state.isDown) {
      const dx = e.touches[0].clientX - state.lastX;
      const dy = e.touches[0].clientY - state.lastY;
      state.lastX = e.touches[0].clientX;
      state.lastY = e.touches[0].clientY;
      state.sphT.theta -= dx * ORBIT_SPEED;
      state.sphT.phi    = THREE.MathUtils.clamp(
        state.sphT.phi - dy * ORBIT_SPEED,
        MIN_POLAR, MAX_POLAR,
      );
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = lastTouchDist / dist;
      state.sphT.radius = THREE.MathUtils.clamp(
        state.sphT.radius * factor, MIN_RADIUS, MAX_RADIUS,
      );
      lastTouchDist = dist;
    }
  }

  function onTouchEnd(): void { state.isDown = false; }

  // -------------------------------------------------------------------------
  // Keyboard (WASD + arrow keys)
  // -------------------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent): void {
    // Don't steal keys when an input is focused
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    state.keys.add(e.code);
  }
  function onKeyUp(e: KeyboardEvent): void { state.keys.delete(e.code); }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function clampTarget(v: THREE.Vector3): void {
    v.x = THREE.MathUtils.clamp(v.x, -TARGET_BOUND_XZ, TARGET_BOUND_XZ);
    v.y = THREE.MathUtils.clamp(v.y, 0, TARGET_BOUND_Y);
    v.z = THREE.MathUtils.clamp(v.z, -TARGET_BOUND_XZ, TARGET_BOUND_XZ);
  }

  // -------------------------------------------------------------------------
  // Update (called every frame)
  // -------------------------------------------------------------------------
  function update(): void {
    // --- Keyboard pan ---
    if (state.keys.size > 0) {
      // Pan speed scales with zoom distance so it feels constant in screen space
      const speed = KEY_PAN_SPEED * (state.sphT.radius / 50) * 0.016;

      // Camera forward projected onto XZ plane
      const camFwd = new THREE.Vector3(
        Math.sin(state.sphT.theta),
        0,
        Math.cos(state.sphT.theta),
      ).normalize();
      const camRight = new THREE.Vector3(
        Math.cos(state.sphT.theta),
        0,
        -Math.sin(state.sphT.theta),
      ).normalize();

      if (state.keys.has('KeyW') || state.keys.has('ArrowUp'))
        state.lookT.addScaledVector(camFwd, -speed);
      if (state.keys.has('KeyS') || state.keys.has('ArrowDown'))
        state.lookT.addScaledVector(camFwd,  speed);
      if (state.keys.has('KeyA') || state.keys.has('ArrowLeft'))
        state.lookT.addScaledVector(camRight, -speed);
      if (state.keys.has('KeyD') || state.keys.has('ArrowRight'))
        state.lookT.addScaledVector(camRight,  speed);
      if (state.keys.has('Equal') || state.keys.has('NumpadAdd'))
        state.sphT.radius = Math.max(MIN_RADIUS, state.sphT.radius * 0.97);
      if (state.keys.has('Minus') || state.keys.has('NumpadSubtract'))
        state.sphT.radius = Math.min(MAX_RADIUS, state.sphT.radius * 1.03);

      clampTarget(state.lookT);
    }

    // --- Smooth lerp ---
    state.sph.radius += (state.sphT.radius - state.sph.radius) * LERP_CAM;
    state.sph.phi    += (state.sphT.phi    - state.sph.phi)    * LERP_CAM;
    // Theta wrap-around lerp
    let dTheta = state.sphT.theta - state.sph.theta;
    while (dTheta >  Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    state.sph.theta += dTheta * LERP_CAM;

    state.look.lerp(state.lookT, LERP_KEY);

    const offset = new THREE.Vector3().setFromSpherical(state.sph);
    camera.position.copy(state.look).add(offset);
    camera.lookAt(state.look);
  }

  // -------------------------------------------------------------------------
  // Event registration
  // -------------------------------------------------------------------------
  dom.addEventListener('pointerdown',  onPointerDown);
  dom.addEventListener('pointermove',  onPointerMove);
  dom.addEventListener('pointerup',    onPointerUp);
  dom.addEventListener('wheel',        onWheel,       { passive: false });
  dom.addEventListener('touchstart',   onTouchStart,  { passive: false });
  dom.addEventListener('touchmove',    onTouchMove,   { passive: false });
  dom.addEventListener('touchend',     onTouchEnd);
  dom.addEventListener('contextmenu',  (e) => e.preventDefault());
  window.addEventListener('keydown',   onKeyDown);
  window.addEventListener('keyup',     onKeyUp);

  function dispose(): void {
    dom.removeEventListener('pointerdown', onPointerDown);
    dom.removeEventListener('pointermove', onPointerMove);
    dom.removeEventListener('pointerup',   onPointerUp);
    dom.removeEventListener('wheel',       onWheel);
    dom.removeEventListener('touchstart',  onTouchStart);
    dom.removeEventListener('touchmove',   onTouchMove);
    dom.removeEventListener('touchend',    onTouchEnd);
    window.removeEventListener('keydown',  onKeyDown);
    window.removeEventListener('keyup',    onKeyUp);
  }

  return { update, dispose };
}
