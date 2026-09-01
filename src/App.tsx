import React, { useState } from 'react';
import { ZooCanvas } from './components/ZooCanvas';
import { HabitatLegend } from './components/HabitatLegend';
import './App.css';

const App: React.FC = () => {
  const [addAnimalOpen, setAddAnimalOpen] = useState(false);

  return (
    <div className="app">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-mark" aria-hidden="true">
            <span className="logo-paw">🐾</span>
          </div>
          <div className="logo-text">
            <h1 className="header-title">DrawZoo</h1>
            <span className="header-tagline">Draw animals. Bring them to life.</span>
          </div>
        </div>

        <nav className="header-controls" aria-label="Camera controls">
          <span className="ctrl-badge" title="Pan camera">WASD / ↑↓←→</span>
          <span className="ctrl-badge" title="Orbit camera">Drag</span>
          <span className="ctrl-badge" title="Zoom">Scroll</span>
          <span className="ctrl-badge" title="Click an animal">Click animal</span>
        </nav>

        <button
          className="btn-add-animal"
          onClick={() => setAddAnimalOpen(true)}
          aria-label="Add your animal drawing"
        >
          <span className="btn-add-icon" aria-hidden="true">✏️</span>
          Add Your Animal
        </button>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="app-main">
        <ZooCanvas />
        <HabitatLegend />
      </main>

      {/* ── Add Animal modal stub ──────────────────────────────────────── */}
      {addAnimalOpen && (
        <>
          <div
            className="modal-overlay"
            onClick={() => setAddAnimalOpen(false)}
            aria-hidden="true"
          />
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Add your animal"
          >
            <button
              className="modal-close"
              onClick={() => setAddAnimalOpen(false)}
              aria-label="Close"
            >✕</button>

            <div className="modal-icon" aria-hidden="true">🎨</div>
            <h2 className="modal-title">Add Your Animal</h2>
            <p className="modal-body">
              Draw your favourite animal on paper, then photograph or scan it.
              Upload it here and it will appear as an animated resident of DrawZoo!
            </p>

            <div className="modal-steps">
              <div className="modal-step">
                <span className="step-num">1</span>
                <span>Draw your animal on white paper</span>
              </div>
              <div className="modal-step">
                <span className="step-num">2</span>
                <span>Take a clear photo or scan it</span>
              </div>
              <div className="modal-step">
                <span className="step-num">3</span>
                <span>Upload it below — coming soon!</span>
              </div>
            </div>

            <button className="btn-upload-soon" disabled>
              📤&nbsp; Upload Drawing (Coming Soon)
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
