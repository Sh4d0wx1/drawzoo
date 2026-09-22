import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { createZooScene } from '../zoo/ZooScene';
import type { ZooSceneInstance } from '../zoo/ZooScene';
import type { AnimalData } from '../zoo/types';
import { AnimalInfo } from './AnimalInfo';

import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { getSonicModel, sonicModel, interactWithSonic, startSonicTalking, stopSonicTalking as stopSonicAnimation, navigateToHabitat, startSwimRoutine } from '../zoo/sonicGuide';
import { saveCustomAnimalName, getAnimalInstanceKey, markAnimalReleased, removeCustomAnimalName } from '../zoo/storage';

// Globally accessible variable to track the active audio object
export let currentAudio: HTMLAudioElement | null = null;

export function stopSonicTalking() {
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  stopSonicAnimation();
}

// Make globally accessible on window as requested
if (typeof window !== 'undefined') {
  (window as any).stopSonicTalking = stopSonicTalking;
  (window as any).currentAudio = currentAudio;
}


interface RenameState {
  animalIndex: number;
  animalUuid?: string;
  currentName: string;
  screenX: number;
  screenY: number;
}

export interface ZooCanvasProps {
  onSceneReady?: (scene: ZooSceneInstance) => void;
  user?: User | null;
  isAdmin?: boolean;
}

const QUICK_QUESTIONS = [
  { label: '🦁 Where is the Lion?', query: 'Where can I find the lion in this zoo?' },
  { label: '🦒 About Giraffes', query: 'Tell me a cool fact about giraffes!' },
  { label: '⚡ Fastest Animal?', query: 'Which animal in this zoo is the fastest?' },
  { label: '🗺️ Zoo Tour', query: 'Can you give me a tour of the zoo habitats?' },
];

export const ZooCanvas: React.FC<ZooCanvasProps> = ({ onSceneReady, user, isAdmin }) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const sceneRef   = useRef<ZooSceneInstance | null>(null);

  const [selectedAnimal, setSelectedAnimal] = useState<AnimalData | null>(null);
  const [tooltip, setTooltip]               = useState<{ name: string; x: number; y: number } | null>(null);
  const [renameState, setRenameState]       = useState<RenameState | null>(null);
  const [renameValue, setRenameValue]       = useState('');
  const [animalList, setAnimalList]         = useState<AnimalData[]>([]);
  const [sonicDialogueOpen, setSonicDialogueOpen] = useState(false);
  const [sonicQuery, setSonicQuery] = useState('');
  const [sonicResponse, setSonicResponse] = useState<string | null>(null);
  const [lastUserQuery, setLastUserQuery] = useState<string | null>(null);
  const [isSonicLoading, setIsSonicLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const sonicInputRef = useRef<HTMLInputElement>(null);

  const isDragging     = useRef(false);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  
  const handleStopSonicTalking = useCallback(() => {
    stopSonicTalking();
    setIsSpeaking(false);
  }, []);

  const handleCancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    handleStopSonicTalking();
    setIsSonicLoading(false);
  }, [handleStopSonicTalking]);

  const toggleListening = useCallback(() => {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Voice dictation is not supported in this browser. Please try using Google Chrome or Microsoft Edge.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('Speech recognition stop error:', e);
        }
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setSonicQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        sonicInputRef.current?.focus();
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  }, [isListening]);

  const handleCloseSonic = useCallback(() => {
    handleCancelRequest();
    setSonicDialogueOpen(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }
    setIsListening(false);
    sceneRef.current?.restoreCamera();
    window.dispatchEvent(new CustomEvent('sonic-close'));
  }, [handleStopSonicTalking]);

  // ── Init scene ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = createZooScene(canvas);
    sceneRef.current = scene;
    setAnimalList([...scene.animals]);
    onSceneReady?.(scene);
    
    const handleSonicOpen = () => {
      setSonicDialogueOpen(true);
      setSonicResponse(null);
      setSonicQuery('');
      setSelectedAnimal(null);
      sceneRef.current?.focusOnSonic();
      setTimeout(() => sonicInputRef.current?.focus(), 100);
    };
    window.addEventListener('sonic-interact', handleSonicOpen);

    const handleAnimalsUpdated = () => {
      if (sceneRef.current) {
        setAnimalList([...sceneRef.current.animals]);
      }
    };
    window.addEventListener('animals-updated', handleAnimalsUpdated);

    return () => { 
      scene.dispose(); 
      sceneRef.current = null; 
      window.removeEventListener('sonic-interact', handleSonicOpen);
      window.removeEventListener('animals-updated', handleAnimalsUpdated);
    };
  }, [onSceneReady]);

  // Escape key closes Sonic dialogue and restores camera view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sonicDialogueOpen) {
        handleCloseSonic();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sonicDialogueOpen, handleCloseSonic]);

  // ── HTML Nametag Projection Loop (Direct GPU CSS transforms, zero React re-renders) ───────────────────
  useEffect(() => {
    let animId = 0;
    const tempVec = new THREE.Vector3();

    const updateLabels = () => {
      animId = requestAnimationFrame(updateLabels);
      const scene = sceneRef.current;
      const canvas = canvasRef.current;
      if (!scene || !canvas) return;

      const camPos = scene.camera.position;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // 1. Direct hardware-accelerated CSS transform updates for animals
      scene.animals.forEach((animal, i) => {
        const el = document.getElementById(`nametag-${animal.group.uuid}`);
        if (!el) return;

        animal.group.getWorldPosition(tempVec);
        tempVec.y += animal.labelHeight;
        const dist = tempVec.distanceTo(camPos);
        tempVec.project(scene.camera);

        if (tempVec.z > 1.0) {
          el.style.display = 'none';
        } else {
          el.style.display = 'flex';
          const x = (tempVec.x * 0.5 + 0.5) * w;
          const y = (-(tempVec.y * 0.5) + 0.5) * h;
          const scale = Math.max(0.45, Math.min(1.0, 18 / dist));
          el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${scale})`;
          el.style.opacity = `${Math.min(1, scale + 0.2)}`;
          el.dataset.screenX = `${x}`;
          el.dataset.screenY = `${y}`;
          el.dataset.animalIndex = `${i}`;
        }
      });

      // 2. Direct hardware-accelerated CSS transform update for Sonic Guide badge
      const sonicTagEl = document.getElementById('sonic-nametag');
      if (sonicTagEl) {
        const currentSonic = getSonicModel() || sonicModel;
        if (currentSonic && !sonicDialogueOpen) {
          currentSonic.getWorldPosition(tempVec);
          tempVec.y += 3.9;
          const dist = tempVec.distanceTo(camPos);
          tempVec.project(scene.camera);

          if (tempVec.z > 1.0) {
            sonicTagEl.style.display = 'none';
          } else {
            sonicTagEl.style.display = 'flex';
            const x = (tempVec.x * 0.5 + 0.5) * w;
            const y = (-(tempVec.y * 0.5) + 0.5) * h;
            const scale = Math.max(0.45, Math.min(1.0, 18 / dist));
            sonicTagEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${scale})`;
            sonicTagEl.style.opacity = `${Math.min(1, scale + 0.2)}`;
          }
        } else {
          sonicTagEl.style.display = 'none';
        }
      }

      // 3. Direct hardware-accelerated CSS transform update for Sonic Chat Bubble
      const bubbleEl = document.getElementById('sonic-chat-bubble');
      if (bubbleEl) {
        const currentSonic = getSonicModel() || sonicModel;
        if (currentSonic && sonicDialogueOpen && (isSonicLoading || sonicResponse)) {
          tempVec.setFromMatrixPosition(currentSonic.matrixWorld);
          tempVec.y += 2.6;
          tempVec.x += 0.3;
          tempVec.project(scene.camera);

          if (tempVec.z > 1.0) {
            bubbleEl.style.display = 'none';
          } else {
            bubbleEl.style.display = 'block';
            const bx = (tempVec.x * 0.5 + 0.5) * w;
            const by = (-(tempVec.y * 0.5) + 0.5) * h;
            bubbleEl.style.transform = `translate3d(${bx}px, ${by}px, 0) translate(-50%, -100%)`;
          }
        } else {
          bubbleEl.style.display = 'none';
        }
      }
    };

    updateLabels();
    return () => cancelAnimationFrame(animId);
  }, [sonicDialogueOpen, isSonicLoading, sonicResponse]);

  // ── Focus rename input ────────────────────────────────────────────────────
  useEffect(() => {
    if (renameState && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameState]);

  // ── Highlight selected animal ─────────────────────────────────────────────
  useEffect(() => {
    sceneRef.current?.highlightAnimal(selectedAnimal);
  }, [selectedAnimal]);

  // ── Pointer handling (Throttled hover raycasting, single Raycaster instance) ──────────────────────
  const hoverRaycaster = useRef(new THREE.Raycaster());
  const hoverVec = useRef(new THREE.Vector2());
  const lastHoverTime = useRef(0);
  const lastHoverName = useRef<string | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current   = false;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const dx = e.clientX - pointerDownPos.current.x;
    const dy = e.clientY - pointerDownPos.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      isDragging.current = true;
      if (lastHoverName.current !== null) {
        lastHoverName.current = null;
        setTooltip(null);
      }
      return;
    }
    if (!sceneRef.current || !canvasRef.current) return;

    // Throttle hover raycast to ~25 checks/second (40ms)
    const now = performance.now();
    if (now - lastHoverTime.current < 40) return;
    lastHoverTime.current = now;

    const rect = canvasRef.current.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    hoverVec.current.set(ndcX, ndcY);
    hoverRaycaster.current.setFromCamera(hoverVec.current, sceneRef.current.camera);

    const currentSonic = getSonicModel() || sonicModel;
    if (currentSonic) {
      const hits = hoverRaycaster.current.intersectObject(currentSonic, true);
      if (hits.length > 0) {
        const name = 'Sonic (Click to talk!)';
        if (lastHoverName.current !== name) {
          lastHoverName.current = name;
          setTooltip({ name, x: e.clientX, y: e.clientY });
        }
        return;
      }
    }

    const hit = sceneRef.current.pickAnimal(e.clientX, e.clientY);
    if (hit) {
      if (lastHoverName.current !== hit.name) {
        lastHoverName.current = hit.name;
        setTooltip({ name: hit.name, x: e.clientX, y: e.clientY });
      }
      return;
    }

    const habitat = sceneRef.current.pickHabitat(e.clientX, e.clientY);
    if (habitat) {
      const name = `${habitat} (Click to visit)`;
      if (lastHoverName.current !== name) {
        lastHoverName.current = name;
        setTooltip({ name, x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (lastHoverName.current !== null) {
      lastHoverName.current = null;
      setTooltip(null);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging.current) return;
    if (!sceneRef.current) return;

    const currentSonic = getSonicModel() || sonicModel;
    if (currentSonic && sceneRef.current?.camera && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), sceneRef.current.camera);
      const hits = raycaster.intersectObject(currentSonic, true);
      if (hits.length > 0) {
        interactWithSonic(sceneRef.current.camera);
        sceneRef.current.focusOnSonic();
        return;
      }
    }

    // Body click → info panel + highlight
    const animal = sceneRef.current.pickAnimal(e.clientX, e.clientY);
    if (animal) {
      if (sonicDialogueOpen) {
        handleCloseSonic();
      }
      setSelectedAnimal(animal);
      setTooltip(null);
      return;
    }

    // Habitat click in 3D world
    const habitat = sceneRef.current.pickHabitat(e.clientX, e.clientY);
    if (habitat) {
      if (sonicDialogueOpen) {
        handleCloseSonic();
      }
      sceneRef.current.focusOnHabitat(habitat);
      window.dispatchEvent(new CustomEvent('habitat-focus', { detail: { name: habitat } }));
      setSelectedAnimal(null);
      setTooltip(null);
      return;
    }

    setSelectedAnimal(null);
    setTooltip(null);
  }, [sonicDialogueOpen, handleCloseSonic]);

  // ── Rename commit ─────────────────────────────────────────────────────────
  const commitRename = useCallback(() => {
    if (!renameState || !sceneRef.current) { setRenameState(null); return; }
    const trimmed = renameValue.trim();
    if (trimmed.length > 0) {
      const animal = (renameState.animalUuid && sceneRef.current.animals.find(a => a.group.uuid === renameState.animalUuid))
        || sceneRef.current.animals[renameState.animalIndex];
      if (!animal) { setRenameState(null); return; }

      const actualIndex = sceneRef.current.animals.indexOf(animal);

      // 1. Update 3D scene & UI state for this specific animal instance
      sceneRef.current.renameAnimal(actualIndex >= 0 ? actualIndex : renameState.animalIndex, trimmed);
      setSelectedAnimal(prev =>
        prev && (prev === animal || prev.group.uuid === animal.group.uuid)
          ? { ...prev, name: trimmed }
          : prev,
      );
      setAnimalList([...sceneRef.current.animals]);
      
      // 2. Persist ONLY under the unique instance key (never by generic species)
      const instanceKey = getAnimalInstanceKey(animal, actualIndex >= 0 ? actualIndex : renameState.animalIndex);
      saveCustomAnimalName(instanceKey, trimmed);

      const dbId = animal.group.userData?.dbId;
      if (dbId) {
        saveCustomAnimalName(dbId, trimmed);
        supabase.from('animals')
          .update({ name: trimmed })
          .eq('id', dbId)
          .then(({ error }) => {
            if (error) console.warn('Supabase DB update note:', error.message);
          });
      }
    }
    setRenameState(null);
  }, [renameState, renameValue]);

  const handleReleaseAnimal = useCallback(async (animal: AnimalData) => {
    if (!sceneRef.current) return;
    const ok = window.confirm(`Release ${animal.name}?`);
    if (!ok) return;

    const dbId = animal.group.userData?.dbId;
    const instanceKey = getAnimalInstanceKey(animal);

    // 1. Mark as released in local storage and remove any custom name
    markAnimalReleased(instanceKey);
    if (dbId) {
      markAnimalReleased(dbId);
      removeCustomAnimalName(dbId);
    }
    removeCustomAnimalName(instanceKey);

    // 2. Immediately remove from 3D scene and raycasting
    sceneRef.current.removeAnimal(animal.group.uuid);
    setAnimalList([...sceneRef.current.animals]);

    // 3. Clear UI selection & popup state
    setSelectedAnimal(prev => (prev && (prev === animal || prev.group.uuid === animal.group.uuid)) ? null : prev);
    setRenameState(null);
    setTooltip(null);

    // 4. Delete from Supabase in the background if database animal
    if (dbId) {
      try {
        const { error } = await supabase.from('animals').delete().eq('id', dbId);
        if (error) console.warn('Supabase delete error:', error.message);
      } catch (err) {
        console.warn('Failed to delete animal from Supabase:', err);
      }
    }
  }, []);

  const handleOpenRename = useCallback((animal: AnimalData) => {
    if (!sceneRef.current) return;
    const idx = sceneRef.current.animals.indexOf(animal);
    if (idx < 0) return;
    setRenameValue(animal.name);
    setRenameState({
      animalIndex: idx,
      animalUuid: animal.group.uuid,
      currentName: animal.name,
      screenX: window.innerWidth / 2,
      screenY: window.innerHeight / 2,
    });
  }, []);

  const handleRenameKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  commitRename();
    if (e.key === 'Escape') setRenameState(null);
  }, [commitRename]);

  const getRenamePopupStyle = (): React.CSSProperties => {
    if (!renameState) return {};
    const popW = 228, popH = 100;
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(renameState.screenX - popW / 2, vw - popW - 8));
    const top  = Math.max(8, Math.min(renameState.screenY - popH - 18, vh - popH - 8));
    return { left, top };
  };

  // ── Sonic Search ────────────────────────────────────────────────────────
  
  const speakLikeSonic = async (text: string) => {
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    // Fallback to a default male voice if no custom Sonic voice ID is provided
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID || 'pNInz6obbfIdGcmCoZ71'; 

    if (apiKey) {
      try {
        startSonicTalking();
        
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Stop any currently playing audio before starting new track
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio = null;
        }
        currentAudio = audio;
        
        audio.onplay = () => setIsSpeaking(true);
        audio.onended = () => {
          if (currentAudio === audio) currentAudio = null;
          stopSonicTalking();
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          if (currentAudio === audio) currentAudio = null;
          stopSonicTalking();
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };
        
        audio.play().catch(e => {
          console.warn("ElevenLabs audio play blocked:", e);
          if (currentAudio === audio) currentAudio = null;
          stopSonicTalking();
          setIsSpeaking(false);
        });
        
        return; // Success, exit function
      } catch (err) {
        console.error("ElevenLabs TTS failed, falling back to native:", err);
        stopSonicTalking();
        setIsSpeaking(false);
      }
    }

    // --- Native Fallback (if no API key or if ElevenLabs fails) ---
    if (!('speechSynthesis' in window)) return;
    
    // Stop any ongoing speech
    stopSonicTalking();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    // Search for common male browser voices
    const maleVoice = voices.find(v => 
      v.name.toLowerCase().includes('male') || 
      v.name.toLowerCase().includes('david') || 
      v.name.toLowerCase().includes('daniel') || 
      v.name.toLowerCase().includes('mark')
    );

    if (maleVoice) {
      utterance.voice = maleVoice;
    }

    utterance.rate = 1.1; // Slightly slower, more natural speed
    utterance.pitch = 1.0; // Normal pitch
    
    utterance.onstart = () => {
      startSonicTalking();
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      stopSonicTalking();
      setIsSpeaking(false);
    };
    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      stopSonicTalking();
      setIsSpeaking(false);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const performSonicQuery = async (queryText: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLastUserQuery(queryText);
    setIsSonicLoading(true);
    setSonicResponse(null);
    
    // Check for trigger words (Early return interceptor)
    const lowerInput = queryText.toLowerCase();
    
    // This regex matches: k -> optional h -> a -> (r or d) -> optional h -> m -> a -> (s or ss)
    const karmassRegex = /k[h]?a[rd][h]?ma[s]{1,2}/;
    const isAskingAboutKarmass = karmassRegex.test(lowerInput);
    
    // This regex matches: k -> optional h -> (o, u, oo) -> optional a -> ch -> optional (a, e, u) -> l
    const khoachalRegex = /k[h]?[ou]{1,2}[a]?ch[aeu]?l/;
    const isAskingAboutKhoachal = khoachalRegex.test(lowerInput);
    
    if (isAskingAboutKarmass) {
      const customReply = "Oh, karmass? Yeah, that means a totally complicated situation, a heavy dilemma, or just a massive state of confusion! Kind of like figuring out one of Eggman's traps!";
      setSonicResponse(customReply);
      speakLikeSonic(customReply);
      setIsSonicLoading(false);
      return;
    }
    
    if (isAskingAboutKhoachal) {
      const customReply = "Khoachal? Oh, in Punjabi that means someone who is incredibly stubborn, hard-headed, or thick-skinned! You know, like when Knuckles absolutely refuses to listen to reason? Total khoachal energy.";
      setSonicResponse(customReply);
      speakLikeSonic(customReply);
      setIsSonicLoading(false);
      return;
    }

    // ─── Habitat Guide: "where is the [habitat]" ───────────────────────────
    const habitatMatch = lowerInput.match(/where\s+is\s+(?:the\s+)?(savanna|jungle|reptile\s*zone|aviary|aquatic\s*zone)/i);
    if (habitatMatch) {
      const rawName = habitatMatch[1].trim();
      // Normalize to title case
      const habitatName = rawName.replace(/\b\w/g, c => c.toUpperCase()).replace('zone', 'Zone');
      const didNavigate = navigateToHabitat(habitatName);
      if (didNavigate) {
        const customReply = `Follow me! I'll race you to the ${habitatName}! 🏃‍♂️💨`;
        setSonicResponse(customReply);
        speakLikeSonic(customReply);
      } else {
        const customReply = `Hmm, I can't find a habitat called "${rawName}". Try Savanna, Jungle, Reptile Zone, or Aviary!`;
        setSonicResponse(customReply);
        speakLikeSonic(customReply);
      }
      setIsSonicLoading(false);
      return;
    }

    // ─── Swim Routine: "swim" / "go swim" / "dive" ──────────────────────────
    const swimMatch = /\b(swim|go\s+swim|dive|cannonball)\b/i.test(lowerInput);
    if (swimMatch) {
      const didSwim = startSwimRoutine();
      if (didSwim) {
        const customReply = "Cannonball! 🌊 Watch me dive in and swim across the pond!";
        setSonicResponse(customReply);
        speakLikeSonic(customReply);
        // Removed camera auto-pan triggered by swimming voice command
        // User should remain in free camera mode or following mode
      } else {
        const customReply = "I would love to swim, but I can't reach the pool right now!";
        setSonicResponse(customReply);
        speakLikeSonic(customReply);
      }
      setIsSonicLoading(false);
      return;
    }
    
    try {
      // 1. Fetch API Key
      const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'undefined') {
        setSonicResponse("ERROR: VITE_DEEPSEEK_API_KEY is missing! Did you restart the dev server?");
        setIsSonicLoading(false);
        return;
      }

      // Build Zoo Context
      let zooContext = "The zoo is currently empty.";
      if (sceneRef.current && sceneRef.current.animals.length > 0) {
        const animalList = sceneRef.current.animals.map(a => `- ${a.name} (Habitat: ${a.habitat})`).join('\n');
        zooContext = `The zoo currently contains the following animals:\n${animalList}`;
      }

      const systemPrompt = `You are Sonic the Hedgehog serving as an energetic, fast-talking tour guide in a 3D zoo game. You have full access to all knowledge. Follow these formatting rules strictly: 1) For simple questions, answer in 1 to 2 short, punchy sentences. 2) For complex topics, give a 1-sentence energetic summary, followed by exactly 3 short bullet points. Never output a massive wall of text. Keep your signature confident and enthusiastic attitude!\n\n${zooContext}\n\nUser Question: ${queryText}`;

      // 2. Fetch from custom LLM endpoint (via Vite local proxy to bypass CORS)
      const url = '/api/chat';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gemma4:12b',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: queryText
            }
          ],
          stream: false
        }),
        signal: controller.signal
      });

      // 3. Catch HTTP errors specifically
      if (!response.ok) {
        const errBody = await response.text();
        console.error('Gemini HTTP Error:', errBody);
        
        if (response.status === 429) {
          const warningText = "Whoa, slow down! I'm thinking as fast as I can! Give me a few seconds before asking another question.";
          setSonicResponse(warningText);
          speakLikeSonic(warningText);
        } else {
          setSonicResponse(`API ERROR ${response.status}: Open the browser console to see the details.`);
        }
        
        setIsSonicLoading(false);
        return;
      }

      const rawText = await response.text();
      let responseText = "";
      
      try {
        // Handle NDJSON stream
        const lines = rawText.split('\\n').filter(line => line.trim());
        for (const line of lines) {
          const data = JSON.parse(line);
          const chunk = data.choices?.[0]?.message?.content || data.message?.content || data.response || "";
          responseText += chunk;
        }
      } catch (e) {
        // Fallback for single JSON object
        try {
          const data = JSON.parse(rawText);
          responseText = data.choices?.[0]?.message?.content || data.message?.content || data.response || "I got a blank response back from the internet!";
        } catch (e2) {
          responseText = "Failed to parse API response!";
        }
      }
      
      if (!responseText.trim()) {
        responseText = "I got a blank response back from the internet!";
      }

      setSonicResponse(responseText);
      
      // Trigger voice playback
      speakLikeSonic(responseText);
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Sonic query canceled by user.');
        return;
      }
      // 4. Print the exact code crash to the chat bubble
      console.error('Sonic Code Error:', error);
      setSonicResponse(`CODE CRASH: ${error.message || error}`);
    } finally {
      setIsSonicLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleSonicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = sonicQuery.trim();
    if (!query) return;
    setSonicQuery('');
    performSonicQuery(query);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="zoo-container">
      <canvas
        ref={canvasRef}
        className="zoo-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        aria-label="Arvo Ai Zoo interactive virtual zoo"
        role="img"
      />

      {/* HTML Nametags projected over 3D space via high-performance compositor transforms */}
      {animalList.map((animal, i) => (
        <div
          key={animal.group.uuid}
          id={`nametag-${animal.group.uuid}`}
          className="html-nametag"
          style={{ top: 0, left: 0, willChange: 'transform, opacity' }}
          onClick={(e) => {
            if (!isAdmin) return; // Only admins can rename
            e.stopPropagation();
            const sx = parseFloat(e.currentTarget.dataset.screenX || '0');
            const sy = parseFloat(e.currentTarget.dataset.screenY || '0');
            setRenameValue(animal.name);
            setRenameState({
              animalIndex: i,
              animalUuid: animal.group.uuid,
              currentName: animal.name,
              screenX: sx,
              screenY: sy,
            });
          }}
          title={isAdmin ? "Click to rename" : ""}
        >
          {animal.name}
          {isAdmin && <span className="nametag-edit-icon">✏️</span>}
        </div>
      ))}

      {/* Sonic Floating Nametag */}
      <div
        id="sonic-nametag"
        className="html-nametag sonic-nametag"
        style={{ top: 0, left: 0, willChange: 'transform, opacity', cursor: 'pointer', display: 'none' }}
        onClick={(e) => {
          e.stopPropagation();
          if (sceneRef.current?.camera) {
            interactWithSonic(sceneRef.current.camera);
            sceneRef.current.focusOnSonic();
          }
        }}
        title="Click to talk to Sonic"
      >
        ⚡ Sonic Guide
      </div>

      {/* Sonic 3D Speech Bubble */}
      <div 
        id="sonic-chat-bubble"
        className="sonic-chat-bubble"
        style={{
          top: 0,
          left: 0,
          willChange: 'transform',
          display: 'none',
          opacity: (sonicDialogueOpen && (isSonicLoading || sonicResponse)) ? 1 : 0,
        }}
      >
        {isSonicLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontStyle: 'italic' }}>
            <span>🔍</span> Sonic is searching...
          </div>
        ) : sonicResponse ? (
          <div>
            {sonicResponse}
          </div>
        ) : null}
      </div>

      {/* Hover tooltip */}
      {tooltip && !renameState && (
        <div
          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 px-3 py-1 bg-black/75 text-white text-sm rounded shadow-lg whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.name}
        </div>
      )}

      {/* Sonic Dialogue Overlay */}
      {sonicDialogueOpen && (
        <div className="sonic-dialogue-overlay" role="dialog" aria-label="Sonic Zoo Guide">
          {/* Header */}
          <div className="sonic-header">
            <div className="sonic-profile">
              <div className="sonic-avatar-wrapper">
                <div className="sonic-avatar">
                  <img
                    src="/sonic-avatar.png"
                    alt="Sonic the Hedgehog"
                    className="sonic-avatar-img"
                  />
                </div>
                <span className="sonic-status-indicator" />
              </div>
              <div className="sonic-titles">
                <div className="sonic-name">
                  <span>Sonic Guide</span>
                  <span className="sonic-badge">AI Tour</span>
                  {isSpeaking && (
                    <button
                      type="button"
                      onClick={handleStopSonicTalking}
                      className="sonic-header-stop-btn"
                      title="Stop Sonic Talking"
                    >
                      <span className="sonic-stop-icon">■</span>
                      <span>Stop Audio</span>
                    </button>
                  )}
                </div>
                <div className="sonic-sub">
                  {isSpeaking ? (
                    <span className="sonic-speaking-badge">
                      <span className="sound-wave-bar" />
                      <span className="sound-wave-bar" />
                      <span className="sound-wave-bar" />
                      Speaking...
                    </span>
                  ) : isSonicLoading ? (
                    <span className="sonic-thinking-badge">⚡ Thinking fast...</span>
                  ) : (
                    <span>⚡ Ready to help</span>
                  )}
                </div>
              </div>
            </div>
            <div className="sonic-close-wrapper">
              <button 
                onClick={handleCloseSonic}
                className="sonic-close-btn"
                aria-label="Close Guide"
              >
                ✕
              </button>
              <span className="sonic-tooltip">Close Guide</span>
            </div>
          </div>
          
          {/* Conversation / Messages Area */}
          <div className="sonic-content-area">
            {!lastUserQuery && !sonicResponse && !isSonicLoading && (
              <div className="sonic-welcome">
                <p className="sonic-welcome-text">
                  Hey there! I'm <strong>Sonic the Hedgehog</strong>, your zoo tour guide! Ask me anything about the animals, directions, or secrets of the park!
                </p>
                <div className="sonic-chips-label">Quick questions:</div>
                <div className="sonic-quick-chips">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      className="sonic-chip"
                      onClick={() => performSonicQuery(q.query)}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {lastUserQuery && (
              <div className="sonic-msg-user">
                <div className="sonic-user-bubble">
                  {lastUserQuery}
                </div>
              </div>
            )}

            {isSonicLoading && (
              <div className="sonic-msg-guide">
                <div className="sonic-guide-bubble sonic-loading-bubble">
                  <div className="sonic-loading-dots">
                    <span className="sonic-dot" />
                    <span className="sonic-dot" />
                    <span className="sonic-dot" />
                  </div>
                  <span className="sonic-loading-txt">Sonic is searching at lightspeed...</span>
                </div>
              </div>
            )}

            {sonicResponse && !isSonicLoading && (
              <div className="sonic-msg-guide">
                <div className="sonic-guide-bubble">
                  <div className="sonic-response-text">{sonicResponse}</div>
                  <div className="sonic-response-actions">
                    <button
                      type="button"
                      className="sonic-action-btn"
                      onClick={() => speakLikeSonic(sonicResponse)}
                      title="Replay Voice"
                    >
                      🔊 Replay
                    </button>
                    {isSpeaking && (
                      <button
                        type="button"
                        className="sonic-action-btn sonic-action-btn-stop"
                        onClick={handleStopSonicTalking}
                        title="Stop Voice"
                      >
                        ⏹️ Stop
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Integrated Input Form */}
          <form onSubmit={handleSonicSubmit} className="sonic-form">
            <div className="sonic-input-dock">
              <input
                ref={sonicInputRef}
                type="text"
                value={sonicQuery}
                onChange={(e) => setSonicQuery(e.target.value)}
                placeholder={isListening ? "Listening... speak now!" : "Ask Sonic a question..."}
                className={`sonic-input ${isListening ? 'listening' : ''}`}
              />

              {/* Microphone Voice Dictation Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`sonic-btn-mic ${isListening ? 'listening' : ''}`}
                title={isListening ? "Stop listening" : "Dictate question via microphone"}
                aria-label={isListening ? "Stop listening" : "Dictate question via microphone"}
              >
                <svg className="sonic-mic-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
              </button>

              {/* Stop Audio Button */}
              {isSpeaking && (
                <button
                  type="button"
                  onClick={handleStopSonicTalking}
                  className="sonic-btn-stop"
                  title="Stop Sonic Talking"
                  aria-label="Stop Sonic Talking"
                >
                  <span className="sonic-stop-icon">■</span>
                  <span>Stop</span>
                </button>
              )}

              {isSonicLoading ? (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  className="sonic-btn-cancel"
                  aria-label="Stop Request"
                >
                  <span style={{ fontSize: '0.8rem' }}>■</span>
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!sonicQuery.trim()}
                  className="sonic-btn-send"
                  aria-label="Ask Sonic"
                >
                  <span>Ask</span>
                  <span className="sonic-send-arrow">➤</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Rename popup */}
      {renameState && (
        <>
          <div className="rename-overlay" onClick={() => setRenameState(null)} aria-hidden="true" />
          <div className="rename-popup" style={getRenamePopupStyle()} role="dialog" aria-label="Rename animal">
            <p className="rename-label">Rename <strong>{renameState.currentName}</strong></p>
            <input
              ref={renameInputRef}
              className="rename-input"
              type="text"
              value={renameValue}
              maxLength={30}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKey}
              aria-label="New animal name"
            />
            <div className="rename-actions">
              {isAdmin && (
                <button
                  className="rename-btn rename-btn-cancel"
                  style={{ color: '#ff6666', marginRight: 'auto', backgroundColor: 'rgba(255, 60, 60, 0.1)' }}
                  onClick={() => {
                    const animal = (renameState.animalUuid && sceneRef.current?.animals.find(a => a.group.uuid === renameState.animalUuid))
                      || sceneRef.current?.animals[renameState.animalIndex];
                    if (animal) {
                      handleReleaseAnimal(animal);
                    }
                  }}
                  title="Release Animal (Admin)"
                >
                  Delete
                </button>
              )}
              <button className="rename-btn rename-btn-cancel" onClick={() => setRenameState(null)}>Cancel</button>
              <button className="rename-btn rename-btn-confirm" onClick={commitRename}>Save</button>
            </div>
          </div>
        </>
      )}

      {/* Animal info panel */}
      <AnimalInfo
        animal={selectedAnimal}
        user={user}
        isAdmin={isAdmin}
        onClose={() => setSelectedAnimal(null)}
        onRename={handleOpenRename}
        onRelease={handleReleaseAnimal}
      />
    </div>
  );
};
