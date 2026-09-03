import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { ZooCanvas } from './components/ZooCanvas';
import { HabitatLegend } from './components/HabitatLegend';
import { AnimalCustomizerModal } from './components/AnimalCustomizerModal';
import { AuthModal } from './components/AuthModal';
import type { ZooSceneInstance } from './zoo/ZooScene';
import { supabase } from './lib/supabaseClient';
import './App.css';

const App: React.FC = () => {
  const [user, setUser]                   = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addAnimalOpen, setAddAnimalOpen] = useState(false);
  const [zooScene, setZooScene]           = useState<ZooSceneInstance | null>(null);

  // Initialize and listen to Supabase auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

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

        <div className="header-right-actions">
          {/* User Auth Controls */}
          {user ? (
            <div className="user-profile-badge">
              <span className="user-avatar-icon" aria-hidden="true">👤</span>
              <span className="user-email" title={user.email}>{user.email}</span>
              <button
                type="button"
                className="btn-sign-out"
                onClick={handleSignOut}
                aria-label="Sign Out"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-header-auth"
              onClick={() => setAuthModalOpen(true)}
              aria-label="Log In or Sign Up"
            >
              <span className="btn-auth-icon" aria-hidden="true">👤</span>
              Log In / Sign Up
            </button>
          )}

          <button
            type="button"
            className="btn-add-animal"
            onClick={() => setAddAnimalOpen(true)}
            aria-label="Add and customize your animal"
          >
            <span className="btn-add-icon" aria-hidden="true">✏️</span>
            Add Your Animal
          </button>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="app-main">
        <ZooCanvas onSceneReady={setZooScene} />
        <HabitatLegend />
      </main>

      {/* ── Auth Modal ─────────────────────────────────────────────────── */}
      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => setAuthModalOpen(false)}
        />
      )}

      {/* ── Animal Customizer Modal ────────────────────────────────────── */}
      {addAnimalOpen && (
        <AnimalCustomizerModal
          scene={zooScene}
          user={user}
          onOpenAuth={() => {
            setAddAnimalOpen(false);
            setAuthModalOpen(true);
          }}
          onClose={() => setAddAnimalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
