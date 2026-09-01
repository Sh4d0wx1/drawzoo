import React from 'react';
import type { AnimalData } from '../zoo/types';

interface Props {
  animal: AnimalData | null;
  onClose: () => void;
}

const ANIMATION_LABELS: Record<string, string> = {
  walk:    'Walking',
  hop:     'Hopping',
  jump:    'Tree-jumping',
  slither: 'Slithering',
  fly:     'Flying',
  swim:    'Swimming',
  idle:    'Resting',
};

const HABITAT_COLORS: Record<string, string> = {
  'Savanna':      '#d4a55a',
  'Jungle':       '#3a8040',
  'Reptile Zone': '#8b7355',
  'Aviary':       '#5a9040',
  'Aquatic Zone': '#1a6b9a',
};

const HABITAT_EMOJI: Record<string, string> = {
  'Savanna':      '🌅',
  'Jungle':       '🌿',
  'Reptile Zone': '🦎',
  'Aviary':       '🦜',
  'Aquatic Zone': '🐟',
};

const ANIMAL_FACTS: Record<string, string> = {
  lion:     'King of the Savanna — naps up to 20 hours a day.',
  elephant: 'Never forgets a face, and can recognise themselves in mirrors.',
  giraffe:  'Tallest animal on Earth — heart pumps blood 2 m upward.',
  zebra:    'Each zebra\'s stripes are as unique as a fingerprint.',
  monkey:   'Uses tools, solves puzzles, and loves fruit.',
  snake:    'Tongue flicks to "smell" the air and locate prey.',
  bird:     'Can mimic voices, songs, and even ringtones.',
  turtle:   'Ancient mariners — turtles predate dinosaurs.',
  fish:     'Clownfish are immune to their own sea-anemone\'s sting.',
  rabbit:   'Can run up to 70 km/h and leap nearly 3 m at a time.',
};

export const AnimalInfo: React.FC<Props> = ({ animal, onClose }) => {
  if (!animal) return null;

  const habitatColor = HABITAT_COLORS[animal.habitat] ?? '#666';
  const habitatEmoji = HABITAT_EMOJI[animal.habitat] ?? '🌍';
  const colorHex     = '#' + animal.color.toString(16).padStart(6, '0');
  const fact         = ANIMAL_FACTS[animal.id];

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
        <h2 className="animal-name">{animal.name}</h2>

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
            <dd className="drawn-by">DrawZoo Team</dd>
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
