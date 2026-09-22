import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode]         = useState<'login' | 'signup'>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        if (data.session) {

          onSuccess?.();
          onClose();
        } else {
          setInfoMsg('Account created! Please check your email to confirm your registration or log in.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;



        onSuccess?.();
        onClose();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('An unexpected authentication error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-container">
      <div className="auth-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="auth-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-modal-close"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          ✕
        </button>

        <div className="auth-header-section">
          <div className="auth-header-icon" aria-hidden="true">🔑</div>
          <h2 id="auth-modal-title" className="auth-title">
            {mode === 'login' ? 'Welcome Back!' : 'Join Arvo Ai Zoo'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Log in to care for your animal and customize your resident.'
              : 'Create an account to add your unique animal to the 3D zoo.'}
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="auth-tab-switch" role="tablist">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }}
            role="tab"
            aria-selected={mode === 'login'}
          >
            Log In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setErrorMsg(null); setInfoMsg(null); }}
            role="tab"
            aria-selected={mode === 'signup'}
          >
            Sign Up
          </button>
        </div>

        {errorMsg && (
          <div className="auth-alert error" role="alert">
            <span className="alert-icon" aria-hidden="true">⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="auth-alert info" role="status">
            <span className="alert-icon" aria-hidden="true">✉️</span>
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="auth-email-input" className="auth-label">
              Email Address
            </label>
            <input
              id="auth-email-input"
              type="email"
              className="auth-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password-input" className="auth-label">
              Password
            </label>
            <input
              id="auth-password-input"
              type="password"
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            className="btn-auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-spinner">⏳ Connecting...</span>
            ) : mode === 'login' ? (
              'Log In to DrawZoo'
            ) : (
              'Create Account & Join'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
