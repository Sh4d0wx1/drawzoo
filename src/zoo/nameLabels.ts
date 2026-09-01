import * as THREE from 'three';
import type { AnimalData } from './types';

const CANVAS_W = 280;
const CANVAS_H = 68;
const SPRITE_SCALE = 3.4;

// ---------------------------------------------------------------------------
// Draw a name pill onto a canvas and return a CanvasTexture
// ---------------------------------------------------------------------------
function drawNameTexture(name: string, hovered = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d')!;

  const pad = 8;
  const r = 14;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 8;

  // Background
  ctx.fillStyle = hovered ? 'rgba(40, 70, 110, 0.92)' : 'rgba(10, 18, 32, 0.80)';
  roundRect(ctx, pad, pad, CANVAS_W - pad * 2, CANVAS_H - pad * 2, r);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = hovered ? 'rgba(120, 200, 255, 0.9)' : 'rgba(240, 200, 80, 0.75)';
  ctx.lineWidth = hovered ? 3 : 2;
  roundRect(ctx, pad, pad, CANVAS_W - pad * 2, CANVAS_H - pad * 2, r);
  ctx.stroke();

  // Edit pencil icon hint (small, right side)
  if (hovered) {
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(160, 210, 255, 0.8)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('✏', CANVAS_W - pad - 4, CANVAS_H / 2);
  }

  // Name text
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = hovered ? '#cce8ff' : '#f0e8c0';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 5;
  ctx.fillText(name, CANVAS_W / 2 - (hovered ? 10 : 0), CANVAS_H / 2);

  return new THREE.CanvasTexture(canvas);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Build all label sprites
// ---------------------------------------------------------------------------
export function buildNameLabels(scene: THREE.Scene, animals: AnimalData[]): THREE.Sprite[] {
  return animals.map((animal) => {
    const texture = drawNameTexture(animal.name);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const aspect = CANVAS_W / CANVAS_H;
    sprite.scale.set(SPRITE_SCALE, SPRITE_SCALE / aspect, 1);
    scene.add(sprite);
    return sprite;
  });
}

// ---------------------------------------------------------------------------
// Refresh a single sprite's texture after a rename
// ---------------------------------------------------------------------------
export function refreshNameLabel(sprite: THREE.Sprite, newName: string, hovered = false): void {
  const mat = sprite.material as THREE.SpriteMaterial;
  mat.map?.dispose();
  mat.map = drawNameTexture(newName, hovered);
  mat.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Update positions every frame
// ---------------------------------------------------------------------------
export function updateNameLabels(
  sprites: THREE.Sprite[],
  animals: AnimalData[],
): void {
  animals.forEach((animal, i) => {
    const sprite = sprites[i];
    const worldPos = new THREE.Vector3();
    animal.group.getWorldPosition(worldPos);
    sprite.position.set(worldPos.x, worldPos.y + animal.labelHeight, worldPos.z);
  });
}

// ---------------------------------------------------------------------------
// Pick which sprite was clicked, given NDC coords and camera
// Returns animal index or -1
// ---------------------------------------------------------------------------
export function pickLabel(
  sprites: THREE.Sprite[],
  ndcX: number,
  ndcY: number,
  camera: THREE.Camera,
): number {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const hits = raycaster.intersectObjects(sprites, false);
  if (hits.length > 0) {
    return sprites.indexOf(hits[0].object as THREE.Sprite);
  }
  return -1;
}
