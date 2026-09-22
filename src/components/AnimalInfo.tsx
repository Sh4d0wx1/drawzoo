import React from 'react';
import type { AnimalData } from '../zoo/types';
import type { User } from '@supabase/supabase-js';

interface Props {
  animal: AnimalData | null;
  user?: User | null;
  isAdmin?: boolean;
  onClose: () => void;
  onRename?: (animal: AnimalData) => void;
  onRelease?: (animal: AnimalData) => void;
}

const ANIMATION_LABELS: Record<string, string> = {
  walk: 'Walking',
  hop: 'Hopping',
  jump: 'Tree-jumping',
  slither: 'Slithering',
  fly: 'Flying',
  swim: 'Swimming',
  idle: 'Resting',
};

const HABITAT_COLORS: Record<string, string> = {
  'Savanna': '#d4a55a',
  'Jungle': '#3a8040',
  'Reptile Zone': '#8b7355',
  'Aviary': '#5a9040',
  'Aquatic Zone': '#1a6b9a',
};

const HABITAT_EMOJI: Record<string, string> = {
  'Savanna': '🌅',
  'Jungle': '🌿',
  'Reptile Zone': '🦎',
  'Aviary': '🦜',
  'Aquatic Zone': '🐟',
};

const ANIMAL_FACTS: Record<string, string> = {
  lion: 'King of the Savanna — naps up to 20 hours a day.',
  elephant: 'Never forgets a face, and can recognise themselves in mirrors.',
  giraffe: 'Tallest animal on Earth — heart pumps blood 2 m upward.',
  zebra: 'Each zebra\'s stripes are as unique as a fingerprint.',
  monkey: 'Uses tools, solves puzzles, and loves fruit.',
  snake: 'Tongue flicks to "smell" the air and locate prey.',
  bird: 'Can mimic voices, songs, and even ringtones.',
  turtle: 'Ancient mariners — turtles predate dinosaurs.',
  fish: 'Clownfish are immune to their own sea-anemone\'s sting.',
  rabbit: 'Can run up to 70 km/h and leap nearly 3 m at a time.',
};

export const AnimalInfo: React.FC<Props> = ({ animal, isAdmin, onClose, onRename, onRelease }) => {
  if (!animal) return null;

  const habitatColor = HABITAT_COLORS[animal.habitat] ?? '#666';
  const habitatEmoji = HABITAT_EMOJI[animal.habitat] ?? '🌍';
  const colorHex = '#' + animal.color.toString(16).padStart(6, '0');
  const fact = ANIMAL_FACTS[animal.id];

  return (
    <div
      className="animal-info-panel"
      role="dialog"
      aria-label={`${animal.name} information`}
    >
      {/* Close */}
      <button className="animal-info-close" onClick={onClose} aria-label="Close">
        ✕
      </button>

      {/* Avatar */}
      <div className="animal-avatar" style={{ backgroundColor: colorHex }}>
        <span className="animal-avatar-icon" aria-hidden="true">
          {getAnimalEmoji(animal.id)}
        </span>
      </div>

      <div className="animal-info-body">
        {/* Name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <h2 className="animal-name" style={{ margin: 0 }}>{animal.name}</h2>
          {isAdmin && onRename && (
            <button
              type="button"
              onClick={() => onRename(animal)}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              title="Rename Animal"
            >
              ✏️ Rename
            </button>
          )}
        </div>

        {/* Habitat tag */}
        <div className="animal-tag" style={{ backgroundColor: habitatColor }}>
          <span aria-hidden="true">{habitatEmoji}</span> {animal.habitat}
        </div>

        {/* Details */}
        <dl className="animal-details">
          <div className="detail-row">
            <dt>Movement</dt>
            <dd>{ANIMATION_LABELS[animal.animationType] ?? animal.animationType}</dd>
          </div>
          <div className="detail-row">
            <dt>Drawn by</dt>
            <dd className="drawn-by">Arvo Ai Zoo Team</dd>
          </div>
        </dl>

        {/* Fun fact */}
        {fact && (
          <p className="animal-fact">
            <span aria-hidden="true">💡 </span>{fact}
          </p>
        )}

        {/* Upload nudge */}
        <p className="animal-upload-hint">
          🎨 Draw this animal and upload your artwork to replace this placeholder!
        </p>

        {/* Admin Delete */}
        {isAdmin && onRelease && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => onRelease(animal)}
              style={{
                width: '100%', padding: '8px', backgroundColor: 'rgba(255, 60, 60, 0.2)',
                color: '#ff6666', border: '1px solid rgba(255, 60, 60, 0.4)', borderRadius: '6px',
                cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              Release Animal (Admin)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function getAnimalEmoji(id: string): string {
  const map: Record<string, string> = {
    lion: '🦁', elephant: '🐘', giraffe: '🦒', zebra: '🦓',
    monkey: '🐒', snake: '🐍', bird: '🦜', turtle: '🐢',
    fish: '🐠', rabbit: '🐰',
  };
  return map[id] ?? '🐾';
}
