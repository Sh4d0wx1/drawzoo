import React, { useState } from 'react';

interface LegendItem {
  name: string;
  color: string;
  emoji: string;
  animals: string[];
}

const LEGEND: LegendItem[] = [
  { name: 'Savanna',      color: '#d4a55a', emoji: '🌅', animals: ['Lion', 'Elephant', 'Giraffe', 'Zebra'] },
  { name: 'Jungle',       color: '#3a8040', emoji: '🌿', animals: ['Monkey'] },
  { name: 'Reptile Zone', color: '#8b7355', emoji: '🦎', animals: ['Snake', 'Turtle'] },
  { name: 'Aviary',       color: '#5a9040', emoji: '🦜', animals: ['Tropical Bird', 'Rabbit'] },
  { name: 'Aquatic Zone', color: '#1a6b9a', emoji: '🐟', animals: ['Clownfish'] },
];

export const HabitatLegend: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="habitat-legend" aria-label="Habitat legend">
      <button
        className="legend-toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="legend-body"
        title={collapsed ? 'Expand legend' : 'Collapse legend'}
      >
        <span className="legend-toggle-icon" aria-hidden="true">🗺</span>
        <span className="legend-toggle-label">Habitats</span>
        <span className="legend-chevron" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <ul className="legend-list" id="legend-body">
          {LEGEND.map(item => (
            <li key={item.name} className="legend-item">
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
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};
