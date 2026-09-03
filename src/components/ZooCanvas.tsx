import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createZooScene } from '../zoo/ZooScene';
import type { ZooSceneInstance } from '../zoo/ZooScene';
import type { AnimalData } from '../zoo/types';
import { AnimalInfo } from './AnimalInfo';

interface RenameState {
  animalIndex: number;
  currentName: string;
  screenX: number;
  screenY: number;
}

export interface ZooCanvasProps {
  onSceneReady?: (scene: ZooSceneInstance) => void;
}

export const ZooCanvas: React.FC<ZooCanvasProps> = ({ onSceneReady }) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const sceneRef   = useRef<ZooSceneInstance | null>(null);

  const [selectedAnimal, setSelectedAnimal] = useState<AnimalData | null>(null);
  const [tooltip, setTooltip]               = useState<{ name: string; x: number; y: number } | null>(null);
  const [renameState, setRenameState]       = useState<RenameState | null>(null);
  const [renameValue, setRenameValue]       = useState('');

  const isDragging     = useRef(false);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Init scene ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createZooScene(canvas);
    sceneRef.current = scene;
    onSceneReady?.(scene);
    return () => { scene.dispose(); sceneRef.current = null; };
  }, [onSceneReady]);

  // ── Focus rename input ────────────────────────────────────────────────────
  useEffect(() => {
    if (renameState && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameState]);

  // ── Highlight selected animal ─────────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.highlightAnimal(selectedAnimal);
  }, [selectedAnimal]);

  // ── Pointer handling ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current   = false;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      isDragging.current = true;
      setTooltip(null);
      return;
    }
    if (!sceneRef.current) return;
    const hit = sceneRef.current.pickAnimal(e.clientX, e.clientY);
    setTooltip(hit ? { name: hit.name, x: e.clientX, y: e.clientY } : null);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging.current) return;
    if (!sceneRef.current) return;

    // Label click → rename popup
    const labelIdx = sceneRef.current.pickLabel(e.clientX, e.clientY);
    if (labelIdx >= 0) {
      const animal = sceneRef.current.animals[labelIdx];
      setRenameValue(animal.name);
      setRenameState({ animalIndex: labelIdx, currentName: animal.name, screenX: e.clientX, screenY: e.clientY });
      setTooltip(null);
      return;
    }

    // Body click → info panel + highlight
    const animal = sceneRef.current.pickAnimal(e.clientX, e.clientY);
    setSelectedAnimal(animal);
    setTooltip(null);
  }, []);

  // ── Rename commit ─────────────────────────────────────────────────────────
  const commitRename = useCallback(() => {
    if (!renameState || !sceneRef.current) { setRenameState(null); return; }
    const trimmed = renameValue.trim();
    if (trimmed.length > 0) {
      sceneRef.current.renameAnimal(renameState.animalIndex, trimmed);
      setSelectedAnimal(prev =>
        prev && prev === sceneRef.current!.animals[renameState.animalIndex]
          ? { ...prev, name: trimmed }
          : prev,
      );
    }
    setRenameState(null);
  }, [renameState, renameValue]);

  const handleRenameKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  commitRename();
    if (e.key === 'Escape') setRenameState(null);
  }, [commitRename]);

  const getRenamePopupStyle = (): React.CSSProperties => {
    if (!renameState) return {};
    const popW = 228, popH = 100;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(renameState.screenX - popW / 2, vw - popW - 8));
    const top  = Math.max(8, Math.min(renameState.screenY - popH - 18, vh - popH - 8));
    return { left, top };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="zoo-container">
      <canvas
        ref={canvasRef}
        className="zoo-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="DrawZoo interactive virtual zoo"
        role="img"
      />

      {/* Hover tooltip */}
      {tooltip && !renameState && (
        <div
          className="animal-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y - 32 }}
          aria-hidden="true"
        >
          {tooltip.name}
        </div>
      )}

      {/* Rename popup */}
      {renameState && (
        <>
          <div className="rename-overlay" onClick={() => setRenameState(null)} aria-hidden="true" />
          <div className="rename-popup" style={getRenamePopupStyle()} role="dialog" aria-label="Rename animal">
            <p className="rename-label">Rename <strong>{renameState.currentName}</strong></p>
            <input
              ref={renameInputRef}
              className="rename-input"
              type="text"
              value={renameValue}
              maxLength={30}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKey}
              aria-label="New animal name"
            />
            <div className="rename-actions">
              <button className="rename-btn rename-btn-cancel" onClick={() => setRenameState(null)}>Cancel</button>
              <button className="rename-btn rename-btn-confirm" onClick={commitRename}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* Animal info panel */}
      <AnimalInfo animal={selectedAnimal} onClose={() => setSelectedAnimal(null)} />
    </div>
  );
};
