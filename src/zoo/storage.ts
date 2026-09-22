/**
 * Storage utilities for persisting animal names and settings across page reloads.
 * Uses individual unique instance keys to prevent species name collisions.
 */
import type { AnimalData } from './types';

const CUSTOM_NAMES_KEY = 'drawzoo_custom_animal_names';

const SPECIES_IDS = [
  'elephant', 'giraffe', 'zebra', 'monkey', 'snake',
  'bird', 'shark', 'wolf', 'turtle', 'fish', 'rabbit'
];

export function getCustomAnimalNames(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CUSTOM_NAMES_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};

    // Auto-migrate: any raw species key (e.g. "fish": "fisyh") must NOT apply to all animals of that species!
    // Migrate it specifically to the default animal ("default_fish") and clean up the raw key.
    let migrated = false;
    for (const species of SPECIES_IDS) {
      if (map[species]) {
        if (!map[`default_${species}`]) {
          map[`default_${species}`] = map[species];
        }
        delete map[species];
        migrated = true;
      }
    }
    if (migrated) {
      localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(map));
    }

    return map;
  } catch (e) {
    console.warn('Failed to parse custom animal names from localStorage:', e);
    return {};
  }
}

/**
 * Returns a strictly unique persistent key for a given animal instance.
 * - For database animals: returns their unique Supabase UUID (dbId)
 * - For default zoo animals: returns 'default_<species>' (e.g. 'default_fish')
 */
export function getAnimalInstanceKey(animal: AnimalData, index?: number): string {
  if (animal.group.userData?.dbId) {
    return animal.group.userData.dbId;
  }
  if (animal.group.userData?.instanceId) {
    return animal.group.userData.instanceId;
  }
  if (index !== undefined && index >= 0 && index < 8) {
    return `default_${animal.id}`;
  }
  return `default_${animal.id}`;
}

export function saveCustomAnimalName(key: string, name: string): void {
  if (typeof window === 'undefined' || !key) return;

  // Prevent generic species collisions: if a bare species ID is passed, key it to default_<species>
  if (SPECIES_IDS.includes(key.toLowerCase())) {
    key = `default_${key.toLowerCase()}`;
  }

  try {
    const map = getCustomAnimalNames();
    map[key] = name;
    localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save custom animal name to localStorage:', e);
  }
}

export function removeCustomAnimalName(key: string): void {
  if (typeof window === 'undefined' || !key) return;
  try {
    const map = getCustomAnimalNames();
    delete map[key];
    localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to remove custom animal name from localStorage:', e);
  }
}

export function getSavedAnimalName(key?: string | null, index?: number): string | null {
  if (typeof window === 'undefined') return null;
  const map = getCustomAnimalNames();
  if (key && map[key]) return map[key];
  if (index !== undefined && index >= 0) {
    if (map[`default_${index}`]) return map[`default_${index}`];
    const fallback = localStorage.getItem(`defaultAnimalName_${index}`);
    if (fallback) return fallback;
  }
  return null;
}

const RELEASED_ANIMALS_KEY = 'drawzoo_released_animals';

export function getReleasedAnimalIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RELEASED_ANIMALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function markAnimalReleased(key: string): void {
  if (typeof window === 'undefined' || !key) return;
  try {
    const list = getReleasedAnimalIds();
    if (!list.includes(key)) {
      list.push(key);
      localStorage.setItem(RELEASED_ANIMALS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Failed to mark animal released:', e);
  }
}

export function isAnimalReleased(key?: string | null): boolean {
  if (typeof window === 'undefined' || !key) return false;
  return getReleasedAnimalIds().includes(key);
}
