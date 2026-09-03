import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { ANIMAL_SPECIES } from '../zoo/animals';
import type { SpeciesOption } from '../zoo/animals';
import type { ZooSceneInstance } from '../zoo/ZooScene';
import { supabase } from '../lib/supabaseClient';
import type { AnimalRecord } from '../lib/supabaseClient';

interface AnimalCustomizerModalProps {
  scene: ZooSceneInstance | null;
  user: User | null;
  onOpenAuth: () => void;
  onClose: () => void;
}

const PRESET_PALETTES: string[] = [
  '#e0d8d0', // Natural Cream / Rabbit
  '#d49b42', // Golden Tawny / Lion
  '#8c8f94', // Natural Slate / Elephant
  '#3a3a3a', // Charcoal Dark / Zebra
  '#dca654', // Ochre Amber / Giraffe
  '#ff6810', // Vibrant Tangerine / Clownfish
  '#5a6b32', // Olive Earth / Turtle
  '#2d7c2d', // Emerald Pine / Snake
  '#2898ec', // Azure Blue / Bird
  '#60421d', // Rich Mahogany / Monkey
  '#e84393', // Flamingo Pink
  '#9b59b6', // Mystic Purple
  '#f1c40f', // Bright Sunflower
  '#1abc9c', // Marine Cyan
];

const NAME_SUGGESTIONS: Record<string, string[]> = {
  rabbit:   ['Barnaby', 'Clover', 'Thumper', 'Cotton', 'Pip'],
  lion:     ['Leo', 'Simba', 'Aslan', 'Kibo', 'Roary'],
  elephant: ['Peanut', 'Babar', 'Dumbo', 'Tembo', 'Ellie'],
  zebra:    ['Marty', 'Ziggy', 'Eclipse', 'Shadow', 'Dash'],
  giraffe:  ['Geoffrey', 'Twiga', 'Pip', 'Sunny', 'Opal'],
  fish:     ['Nemo', 'Bubbles', 'Finley', 'Coral', 'Splash'],
  turtle:   ['Shelly', 'Franklin', 'Crush', 'Speedy', 'Toby'],
  snake:    ['Sly', 'Kaa', 'Basil', 'Nagini', 'Zigzag'],
  bird:     ['Pip', 'Sky', 'Rio', 'Zazu', 'Feathers'],
  monkey:   ['Milo', 'George', 'Coco', 'Abu', 'Chimpy'],
};

export const AnimalCustomizerModal: React.FC<AnimalCustomizerModalProps> = ({
  scene,
  user,
  onOpenAuth,
  onClose,
}) => {
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesOption>(ANIMAL_SPECIES[0]);
  const [customName, setCustomName]           = useState<string>(ANIMAL_SPECIES[0].defaultName);
  const [customColor, setCustomColor]         = useState<string>(ANIMAL_SPECIES[0].defaultColor);

  const [existingAnimal, setExistingAnimal]   = useState<AnimalRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(true);
  const [submitting, setSubmitting]           = useState<boolean>(false);
  const [submitError, setSubmitError]         = useState<string | null>(null);

  // Check if the current user already has an animal in public.animals
  useEffect(() => {
    let isMounted = true;
    async function checkUserAnimal() {
      if (!user) {
        setExistingAnimal(null);
        setCheckingExisting(false);
        return;
      }

      setCheckingExisting(true);
      setSubmitError(null);
      try {
        const { data, error } = await supabase
          .from('animals')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.warn('Could not check user existing animal:', error.message);
        } else if (isMounted) {
          setExistingAnimal(data as AnimalRecord | null);
        }
      } catch (err) {
        console.warn('Error checking existing animal:', err);
      } finally {
        if (isMounted) setCheckingExisting(false);
      }
    }

    checkUserAnimal();
    return () => { isMounted = false; };
  }, [user]);

  const handleSelectSpecies = (species: SpeciesOption) => {
    setSelectedSpecies(species);
    setCustomColor(species.defaultColor);
    const suggestions = NAME_SUGGESTIONS[species.id] || [species.defaultName];
    setCustomName(suggestions[Math.floor(Math.random() * suggestions.length)]);
  };

  const handleRandomizeName = () => {
    const list = NAME_SUGGESTIONS[selectedSpecies.id] || [selectedSpecies.defaultName];
    const otherNames = list.filter(n => n !== customName);
    const pool = otherNames.length > 0 ? otherNames : list;
    setCustomName(pool[Math.floor(Math.random() * pool.length)]);
  };

  const handleViewExistingAnimal = () => {
    if (!existingAnimal || !scene) {
      onClose();
      return;
    }
    const found = scene.animals.find(a => a.group.userData?.dbId === existingAnimal.id || a.name === existingAnimal.name);
    if (found) {
      scene.panCameraTo(found.position, 18);
      scene.highlightAnimal(found);
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    if (existingAnimal) {
      return;
    }

    const finalName = customName.trim().length > 0 ? customName.trim() : selectedSpecies.defaultName;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase
        .from('animals')
        .insert({
          user_id: user.id,
          species: selectedSpecies.id,
          name: finalName,
          color: customColor,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.toLowerCase().includes('duplicate') || error.message.toLowerCase().includes('unique')) {
          setSubmitError('You already have an animal in the zoo!');
          setExistingAnimal({
            user_id: user.id,
            species: selectedSpecies.id,
            name: finalName,
            color: customColor,
          });
        } else {
          setSubmitError(error.message);
        }
        return;
      }

      // Add to local scene immediately
      if (scene) {
        scene.addAnimal(selectedSpecies.id, finalName, customColor, data?.id);
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Failed to add animal to the zoo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="modal-card customizer-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-modal-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="modal-header-section">
          <div className="modal-icon" aria-hidden="true">🎨</div>
          <h2 id="customizer-modal-title" className="modal-title">Add Your Animal</h2>
          <p className="modal-subtitle">
            Choose a species, personalize their coat color and name, and release them into the zoo!
          </p>
        </div>

        {/* Auth status banners */}
        {!user && (
          <div className="customizer-auth-banner">
            <div className="banner-content">
              <span className="banner-icon" aria-hidden="true">👤</span>
              <div className="banner-text">
                <strong>Sign in to add your animal</strong>
                <p>Each explorer gets one permanent animal in the DrawZoo park!</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-banner-login"
              onClick={onOpenAuth}
            >
              Log In / Sign Up
            </button>
          </div>
        )}

        {user && existingAnimal && (
          <div className="customizer-existing-banner">
            <div className="banner-content">
              <span className="banner-icon" aria-hidden="true">🎉</span>
              <div className="banner-text">
                <strong>You already have an animal in the zoo!</strong>
                <p>
                  Your resident: <strong>{existingAnimal.name}</strong> ({existingAnimal.species})
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-view-existing"
              onClick={handleViewExistingAnimal}
            >
              🔭 View in Zoo
            </button>
          </div>
        )}

        {submitError && (
          <div className="auth-alert error" role="alert">
            <span className="alert-icon" aria-hidden="true">⚠️</span>
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="customizer-form">
          {/* 1. Species Grid Selector */}
          <div className="customizer-section">
            <label className="customizer-section-title">
              1. Choose Species
            </label>
            <div className="species-grid" role="radiogroup" aria-label="Choose animal species">
              {ANIMAL_SPECIES.map(s => {
                const isSelected = s.id === selectedSpecies.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`species-card ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectSpecies(s)}
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!!existingAnimal}
                  >
                    <span className="species-emoji" aria-hidden="true">{s.emoji}</span>
                    <span className="species-name">{s.name}</span>
                    <span className="species-habitat-badge">{s.habitat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Custom Name Input */}
          <div className="customizer-section">
            <label htmlFor="animal-name-input" className="customizer-section-title">
              2. Animal Name
            </label>
            <div className="name-input-wrapper">
              <input
                id="animal-name-input"
                type="text"
                className="customizer-name-input"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                maxLength={24}
                placeholder="Enter animal name..."
                required
                disabled={!!existingAnimal}
              />
              <button
                type="button"
                className="btn-random-name"
                onClick={handleRandomizeName}
                title="Randomize name suggestion"
                aria-label="Randomize name suggestion"
                disabled={!!existingAnimal}
              >
                🎲
              </button>
            </div>
          </div>

          {/* 3. Color Customizer */}
          <div className="customizer-section">
            <label className="customizer-section-title">
              3. Primary Coat / Body Color
            </label>
            <div className="color-palette-container">
              <div className="color-swatches" role="radiogroup" aria-label="Choose color palette">
                {PRESET_PALETTES.map(col => {
                  const isColActive = customColor.toLowerCase() === col.toLowerCase();
                  return (
                    <button
                      key={col}
                      type="button"
                      className={`color-swatch-btn ${isColActive ? 'active' : ''}`}
                      style={{ backgroundColor: col }}
                      onClick={() => setCustomColor(col)}
                      aria-label={`Color ${col}`}
                      role="radio"
                      aria-checked={isColActive}
                      disabled={!!existingAnimal}
                    />
                  );
                })}
              </div>

              {/* Native color picker */}
              <div className="custom-color-picker-wrapper">
                <label htmlFor="custom-color-picker" className="color-picker-label">
                  <span
                    className="custom-color-preview"
                    style={{ backgroundColor: customColor }}
                  />
                  <span className="color-picker-text">Custom Tint:</span>
                  <span className="color-hex-badge">{customColor.toUpperCase()}</span>
                </label>
                <input
                  id="custom-color-picker"
                  type="color"
                  className="native-color-picker"
                  value={customColor}
                  onChange={e => setCustomColor(e.target.value)}
                  aria-label="Custom color picker"
                  disabled={!!existingAnimal}
                />
              </div>
            </div>
          </div>

          {/* Live Preview Pill */}
          <div className="customizer-preview-pill">
            <span className="preview-emoji" aria-hidden="true">{selectedSpecies.emoji}</span>
            <div className="preview-text">
              <span className="preview-name">{customName || selectedSpecies.defaultName}</span>
              <span className="preview-meta">
                {selectedSpecies.name} &bull; {selectedSpecies.habitat}
              </span>
            </div>
            <span
              className="preview-color-dot"
              style={{ backgroundColor: customColor }}
              title={`Color: ${customColor}`}
            />
          </div>

          {/* Action Buttons */}
          <div className="customizer-actions">
            <button
              type="button"
              className="btn-customizer-cancel"
              onClick={onClose}
            >
              Cancel
            </button>

            {!user ? (
              <button
                type="button"
                className="btn-customizer-submit"
                onClick={onOpenAuth}
              >
                <span className="btn-paw-icon" aria-hidden="true">🔑</span>
                Log In to Add Animal
              </button>
            ) : existingAnimal ? (
              <button
                type="button"
                className="btn-customizer-submit disabled"
                disabled
              >
                <span className="btn-paw-icon" aria-hidden="true">🔒</span>
                You already have an animal in the zoo!
              </button>
            ) : (
              <button
                type="submit"
                className="btn-customizer-submit"
                disabled={submitting || checkingExisting}
              >
                <span className="btn-paw-icon" aria-hidden="true">
                  {submitting ? '⏳' : '🐾'}
                </span>
                {submitting ? 'Saving to Zoo...' : 'Add to Zoo'}
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
};
