import React, { useState, useEffect } from 'react';
import type { ZooSceneInstance } from '../zoo/ZooScene';

interface LegendItem {
  name: string;
  color: string;
  emoji: string;
  animals: string[];
}

const LEGEND: LegendItem[] = [
  { name: 'Savanna',      color: '#d4a55a', emoji: '🌅', animals: ['Elephant', 'Zebra'] },
  { name: 'Jungle',       color: '#3a8040', emoji: '🌿', animals: ['Monkey', 'Baby Wolf'] },
  { name: 'Reptile Zone', color: '#8b7355', emoji: '🦎', animals: ['Snake', 'Turtle'] },
  { name: 'Aviary',       color: '#5a9040', emoji: '🦜', animals: ['Tropical Bird', 'Rabbit'] },
  { name: 'Aquatic Zone', color: '#1a6b9a', emoji: '🐟', animals: ['Clownfish', 'Shark'] },
];

interface Props {
  scene?: ZooSceneInstance | null;
}

export const HabitatLegend: React.FC<Props> = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeHabitat, setActiveHabitat] = useState<string | null>(null);

  useEffect(() => {
    const handleHabitatFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{ name: string }>;
      if (customEvent.detail?.name) {
        setActiveHabitat(customEvent.detail.name);
      }
    };
    window.addEventListener('habitat-focus', handleHabitatFocus);
    return () => window.removeEventListener('habitat-focus', handleHabitatFocus);
  }, []);

  const handleSelectHabitat = (habitatName: string) => {
    setActiveHabitat(habitatName);
    // User requested to remove camera auto-pan triggered by UI buttons
    // Only raycasts on 3D labels should pan now.
  };

  return (
    <aside className="habitat-legend" aria-label="Habitat legend">
      <button
        className="legend-toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="legend-body"
        title={collapsed ? 'Expand habitats' : 'Collapse habitats'}
      >
        <span className="legend-toggle-icon" aria-hidden="true">🗺️</span>
        <span className="legend-toggle-label">Habitats</span>
        <span className="legend-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <ul className="legend-list" id="legend-body">
          {LEGEND.map(item => {
            const isActive = activeHabitat === item.name;
            return (
              <li key={item.name}>
                <button
                  type="button"
                  className={`legend-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleSelectHabitat(item.name)}
                  title={`Click to fly camera to ${item.name}`}
                  aria-label={`Fly camera to ${item.name}`}
                >
                  <span
                    className="legend-swatch"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  >
                    {item.emoji}
                  </span>
                  <div className="legend-text">
                    <strong className="legend-habitat-name">{item.name}</strong>
                    <p className="legend-animals">{item.animals.join(' · ')}</p>
                  </div>
                  <span className="legend-fly-icon" aria-hidden="true">
                    {isActive ? '📍' : '➔'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};
