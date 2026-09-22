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
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addAnimalOpen, setAddAnimalOpen] = useState(false);
  const [zooScene, setZooScene] = useState<ZooSceneInstance | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFollowingSonic, setIsFollowingSonic] = useState(false);

  // Initialize and listen to Supabase auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAdmin(localStorage.getItem('drawzoo_admin') === 'true');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAdmin(localStorage.getItem('drawzoo_admin') === 'true');
    });

    return () => subscription.unsubscribe();
  }, []);

  // Secret admin shortcut (Ctrl+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        const pwd = window.prompt('Admin Password:');
        if (pwd === 'admin2109') {
          localStorage.setItem('drawzoo_admin', 'true');
          setIsAdmin(true);
          alert('Admin mode enabled!');
        } else if (pwd !== null) {
          localStorage.removeItem('drawzoo_admin');
          setIsAdmin(false);
          alert('Admin mode disabled.');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
            <h1 className="header-title">Arvo Ai Zoo</h1>
            <span className="header-tagline">Draw animals. Bring them to life.</span>
          </div>
        </div>

        <nav className="header-controls" aria-label="Camera controls">
          <span className="ctrl-badge" title="Pan camera">WASD / ↑↓←→</span>
          <span className="ctrl-badge" title="Orbit camera">Drag</span>
          <span className="ctrl-badge" title="Zoom">Scroll</span>
          <span className="ctrl-badge" title="Click an animal">Click animal</span>
          {zooScene && (
            <button 
              className={`ctrl-badge ${isFollowingSonic ? 'active' : ''}`}
              onClick={() => {
                const newState = zooScene.toggleFollowSonic();
                setIsFollowingSonic(newState);
              }}
              style={{ cursor: 'pointer', background: isFollowingSonic ? '#38bdf8' : 'rgba(255,255,255,0.1)' }}
            >
              {isFollowingSonic ? '🎥 Following Sonic' : '🎥 Follow Sonic'}
            </button>
          )}
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
                onClick={() => {
                  const pwd = window.prompt(isAdmin ? 'Disable Admin mode? (Leave blank to disable)' : 'Admin Password:');
                  if (!isAdmin && pwd === 'admin2109') {
                    localStorage.setItem('drawzoo_admin', 'true');
                    setIsAdmin(true);
                  } else if (isAdmin) {
                    localStorage.removeItem('drawzoo_admin');
                    setIsAdmin(false);
                  }
                }}
                style={{ marginLeft: '8px', backgroundColor: isAdmin ? 'rgba(255, 100, 100, 0.2)' : '' }}
              >
                {isAdmin ? 'Admin: ON' : 'Admin: OFF'}
              </button>
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
        <ZooCanvas onSceneReady={setZooScene} user={user} isAdmin={isAdmin} />
        <HabitatLegend scene={zooScene} />
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
          isAdmin={isAdmin}
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
