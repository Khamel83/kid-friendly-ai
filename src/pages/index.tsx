import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import SpeechControls from '../components/SpeechControls';
import CharacterCompanion from '../components/CharacterCompanion';
import MiniGame from '../components/MiniGame';
import MathGame from '../components/MathGame';
import PatternPuzzleGame from '../components/PatternPuzzleGame';
import AnimalGame from '../components/AnimalGame';
import SoundControls from '../components/SoundControls';
// import OfflineIndicator from '../components/OfflineIndicator';
import { EnhancedSoundManager } from '../utils/soundManager';
import { useSoundControls, useSoundAccessibility } from '../hooks/useSoundEffects';
// import { useOfflineManager, useOfflineState, useSyncOperations, useOfflineQueue } from '../hooks/useOfflineManager';
import { SoundAccessibilityManager } from '../utils/soundAccessibility';
import { register } from '../utils/registerServiceWorker';
import { AccessibilityUtils } from '../utils/accessibility';
import { Buffer } from 'buffer'; // Needed for sentence detection buffer
// CSS imports moved to _app.tsx

interface Message {
  type: 'user' | 'ai';
  text: string;
  isComplete?: boolean; // Optional flag
}

// Simple sentence end detection (can be improved)
const SENTENCE_END_REGEX = /([.?!])\s+/;

const SESSION_STORAGE_KEY = 'kidFriendlyAiHistory';

export default function Home() {
  // Simplified offline state (basic functionality only)
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Core States
  const [isListening, setIsListening] = useState(false); // Mic is recording
  const [isProcessing, setIsProcessing] = useState(false); // Waiting for AI text stream start/end OR TTS audio
  const [isSpeaking, setIsSpeaking] = useState(false); // Audio is queued or playing
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Enhancement States
  const [characterState, setCharacterState] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'excited'>('idle');
  const [stars, setStars] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, color: string}>>([]);
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [showMathGame, setShowMathGame] = useState(false);
  const [showPatternPuzzleGame, setShowPatternPuzzleGame] = useState(false);
  const [showAnimalGame, setShowAnimalGame] = useState(false);

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [privacyMode, setPrivacyMode] = useState<'local' | 'cloud'>('cloud');

  // Action Bar States
  const [isMuted, setIsMuted] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState('');

  // Sound Controls States
  const [showSoundControls, setShowSoundControls] = useState(false);

  // Hook into sound controls and accessibility
  const {
    setMasterVolume,
    toggleMute: toggleHookMute,
    masterVolume,
    isMuted: hookIsMuted,
    setCategoryVolume
  } = useSoundControls();

  const {
    visualFeedback,
    vibrationEnabled,
    setVisualFeedback,
    setVibrationEnabled
  } = useSoundAccessibility();

  // Streaming & Queuing States
  const ttsRequestQueueRef = useRef<string[]>([]); // Queue of sentences needing TTS
  const audioPlaybackQueueRef = useRef<AudioBuffer[]>([]); // Queue of decoded audio buffers ready to play
  const isProcessingTtsQueueRef = useRef(false); // Lock to prevent parallel TTS processing
  const isPlayingAudioSegmentRef = useRef(false);
  const isStoppedRef = useRef(false);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null); // Ref for the currently playing audio source
  const sentenceBufferRef = useRef(''); // Buffer for incoming text chunks to form sentences
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null); // Ref for the stream reader
  const abortControllerRef = useRef<AbortController | null>(null); // Ref to allow aborting fetch
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  // --- REMOVE SessionStorage Loading Effect --- 
  // useEffect(() => { ... load logic ... }, []);
  // --- End REMOVE --- 
  
  // Initialize Service Worker
  useEffect(() => {
    register();
  }, []);

  // --- Initialize AudioContext only ---
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
       try {
         // Create context but don't resume yet
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
         
         // For iOS, we'll resume on first user interaction
         const resumeAudioContext = async () => {
           if (audioContextRef.current?.state === 'suspended') {
             await audioContextRef.current.resume();
             console.log('AudioContext resumed successfully');
           }
           // Remove the event listener after first interaction
           document.removeEventListener('touchstart', resumeAudioContext);
           document.removeEventListener('click', resumeAudioContext);
         };

         // Add listeners for both touch and click
         document.addEventListener('touchstart', resumeAudioContext);
         document.addEventListener('click', resumeAudioContext);
         
         console.log('AudioContext initialized for playback.');
       } catch (err) {
         console.error('Error initializing AudioContext:', err);
         setErrorMessage('Web Audio API is not available in this browser.');
       }
    }

    // Add visibility change handler
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && audioContextRef.current?.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          console.log('AudioContext resumed after visibility change');
        } catch (error) {
          console.error('Failed to resume AudioContext:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Add periodic AudioContext state check
    const checkAudioContextState = async () => {
      if (audioContextRef.current?.state === 'suspended') {
        try {
          await audioContextRef.current.resume();
          console.log('AudioContext resumed after periodic check');
        } catch (error) {
          console.error('Failed to resume AudioContext:', error);
        }
      }
    };

    const intervalId = setInterval(checkAudioContextState, 30000); // Check every 30 seconds
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
      // No cleanup needed for AudioContext itself generally
      // Cleanup for audio source nodes happens in stop functions
      
      // Ensure fetch is aborted on unmount if active
      if (abortControllerRef.current) {
          console.log("Aborting fetch request on unmount.");
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      // Optionally cancel reader too, although abort should handle it
      if (readerRef.current) {
         readerRef.current.cancel().catch(e => console.warn("Error cancelling reader on unmount:", e));
         readerRef.current = null;
      }
      if (currentAudioSourceRef.current) {
          try {
              currentAudioSourceRef.current.onended = null; // Prevent onended firing
              currentAudioSourceRef.current.stop();
          } catch (e) { /* ignore */ }
          currentAudioSourceRef.current = null;
      }
    };
  }, []);
  // --- End Initialize AudioContext --- 

  // --- REMOVE SessionStorage Saving Effect --- 
  // useEffect(() => { ... save logic ... }, [conversationHistory]);
  // --- End REMOVE --- 

  const addMessageToHistory = useCallback((type: 'user' | 'ai', text: string, isComplete: boolean = true) => {
    setConversationHistory(prev => {
      const lastIndex = prev.length - 1;
      let newHistory;

      // --- Refined Logic ---
      if (type === 'ai' && lastIndex >= 0 && prev[lastIndex].type === 'ai' && !prev[lastIndex].isComplete) {
        // If last message is AI and not marked complete, UPDATE it.
        const updatedHistory = [...prev];
        updatedHistory[lastIndex] = { ...updatedHistory[lastIndex], text: text, isComplete: isComplete };
        newHistory = updatedHistory;
      } else if (type === 'ai' && text === '' && !isComplete) {
        // If adding an empty AI placeholder, just add it.
        newHistory = [...prev, { type, text, isComplete: false }];
      } else if (type === 'ai' && lastIndex >= 0 && prev[lastIndex].type === 'ai' && prev[lastIndex].text === '' && !prev[lastIndex].isComplete) {
        // If last message is an EMPTY AI placeholder, REPLACE it with the first real text.
        newHistory = [...prev.slice(0, lastIndex)]; // Remove placeholder
        newHistory.push({ type, text, isComplete: isComplete }); // Add new message
      } else {
        // Otherwise (user message, or first AI message after user), add a new entry.
        newHistory = [...prev, { type, text, isComplete: type === 'user' ? true : isComplete }];
      }
      // --- End Refined Logic ---


      return newHistory;
    });
  }, [isOnline]);

  // --- Function to add sentence to TTS Queue (Updated with stop check) ---
  const enqueueTtsRequest = useCallback((sentence: string) => {
    if (isStoppedRef.current) return; // Don't enqueue if stopped
    if (sentence.trim()) {
      console.log(`Enqueueing TTS for: "${sentence.trim().substring(0,30)}..."`);
      ttsRequestQueueRef.current.push(sentence.trim());
      // Start processing if not already running
      if (!isProcessingTtsQueueRef.current) {
          processTtsQueue();
      }
    }
  }, []); // Dependency array might need state setters if used directly

  // --- Process TTS Request Queue (Reverted Initial Playback Trigger) ---
  const processTtsQueue = useCallback(async () => {
    if (isStoppedRef.current) { // Check stop flag
        console.log("TTS Queue: Stop requested, exiting.");
        isProcessingTtsQueueRef.current = false;
        return;
    }
    if (isProcessingTtsQueueRef.current || ttsRequestQueueRef.current.length === 0) {
        isProcessingTtsQueueRef.current = false; // Ensure lock is released if queue empty
        return; // Already processing or queue is empty
    }

    isProcessingTtsQueueRef.current = true; // Acquire lock
    setErrorMessage(''); // Clear errors when starting new TTS processing

    const sentenceToProcess = ttsRequestQueueRef.current.shift(); // Get next sentence

    if (!sentenceToProcess) {
        isProcessingTtsQueueRef.current = false; // Release lock if somehow sentence is undefined
        return;
    }

    console.log(`Processing TTS for: "${sentenceToProcess.substring(0,30)}..."`);
    if (!isStoppedRef.current) setIsSpeaking(true); // Indicate that we are actively trying to generate/queue speech

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: sentenceToProcess }),
        });

        if (!response.ok || !response.body) {
            let errorMsg = `TTS Error ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch { /* Ignore JSON parse error */ }
            throw new Error(errorMsg);
        }

        if (isStoppedRef.current) return; // Check after fetch

        const audioData = await response.arrayBuffer();

        if (isStoppedRef.current) return; // Check after getting data

        if (!audioContextRef.current) throw new Error("AudioContext lost");
        
        // Resume context if needed
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (isStoppedRef.current) return; // Check after resume

        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);

        if (isStoppedRef.current) return; // Check after decode
        
        console.log(`Decoded buffer for sentence, duration: ${audioBuffer.duration}s`);
        
        // Add buffer to playback queue
        audioPlaybackQueueRef.current.push(audioBuffer);
        
        // --- Reverted Trigger: Check queue length === 1 --- 
        // Trigger playback if this is the first item added to the queue AND nothing is playing
        if (audioPlaybackQueueRef.current.length === 1 && !isPlayingAudioSegmentRef.current) {
           console.log("First playable audio chunk added to queue, starting playback chain.");
           playNextAudioChunk(); // Start the chain
        }
        // --- End Reverted Trigger --- 

    } catch (error) {
        if (!isStoppedRef.current) { // Only log/set error if not manually stopped
            console.error('Error fetching or decoding TTS audio:', error);
            const message = error instanceof Error ? error.message : 'Failed to get audio for a sentence.';
            setErrorMessage(message);
        }
        // Don't clear the whole speaking state on a single sentence failure
        // Maybe add sentence back to queue? Or just drop it? For now, drop it.
    } finally {
        // Release lock and immediately check if more items are in the queue
        isProcessingTtsQueueRef.current = false;
        // Check queue again only if not stopped and queue has items
        if (!isStoppedRef.current && ttsRequestQueueRef.current.length > 0) {
           setTimeout(processTtsQueue, 0); 
        }
    }
  }, []); // Dependencies are minimal here


  // --- Play Next Audio Chunk from Queue (Added Stop Check in onended) ---
  const playNextAudioChunk = useCallback(() => {
    if (isStoppedRef.current) { // Check stop flag
        console.log("Playback Queue: Stop requested, exiting.");
        isPlayingAudioSegmentRef.current = false;
        return;
    }
    if (isPlayingAudioSegmentRef.current || audioPlaybackQueueRef.current.length === 0 || !audioContextRef.current) {
        // If nothing to play and queue empty, ensure speaking state is false
        if(audioPlaybackQueueRef.current.length === 0 && !isPlayingAudioSegmentRef.current && !isProcessingTtsQueueRef.current) {
           if (!isStoppedRef.current) setIsSpeaking(false);
        }
        return; // Already playing, queue empty, or context lost
    }
    
    if (!isStoppedRef.current) setIsSpeaking(true); // Set speaking only if not stopped

    const audioBufferToPlay = audioPlaybackQueueRef.current.shift(); // Get next buffer

    if (!audioBufferToPlay) {
        isPlayingAudioSegmentRef.current = false; // Release lock if buffer somehow undefined
        if (!isStoppedRef.current) setIsSpeaking(false); // No buffer, not speaking
        return;
    }

    console.log("Starting playback of next audio chunk...");
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBufferToPlay;
    source.connect(audioContextRef.current.destination);
    currentAudioSourceRef.current = source;

    source.onended = () => {
        if (source.onended === null) {
           console.log("onended called but was nullified (likely stopped).");
           return;
        }
        
        console.log("Audio chunk playback finished.");
        source.disconnect(); 
        if (currentAudioSourceRef.current === source) {
            currentAudioSourceRef.current = null;
        }
        isPlayingAudioSegmentRef.current = false;
        
        // --- Added stop check before recursion --- 
        if (isStoppedRef.current) {
           console.log("onended: Stop flag is set, not continuing playback chain.");
           return;
        }
        // --- End added stop check ---
        
        // Check if more chunks are ready AND not stopped
        if (audioPlaybackQueueRef.current.length > 0) { 
           playNextAudioChunk(); // Recursive call
        } else if (!isProcessingTtsQueueRef.current) {
           // No more chunks, check if TTS is still processing before setting isSpeaking=false
           setIsSpeaking(false);
        }
    };

    source.start();

  }, []); // Dependencies are minimal here


  // --- Define handleStopSpeaking with useCallback ---
  const handleStopSpeaking = useCallback(async () => {
    console.log("Stop Speaking requested.");

    // Stop currently playing audio
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.onended = null;
        currentAudioSourceRef.current.stop();
        console.log("Stopped current audio source.");
      } catch (e) {
        console.log("Error stopping audio:", e);
      }
      currentAudioSourceRef.current = null;
    }

    // Reset state
    setIsSpeaking(false);
    setIsProcessing(false);

    console.log("Stop completed.");
  }, []);

  // Simplified handleQuestionSubmit without complex audio queuing
  const handleQuestionSubmit = async (text: string) => {
    if (!text || text.trim() === '') return;

    console.log('Submitting question:', text);

    // Stop any ongoing audio
    await handleStopSpeaking();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Add user message
    addMessageToHistory('user', text);
    setIsProcessing(true);
    setIsSpeaking(false);
    setErrorMessage('');
    addMessageToHistory('ai', '', false); // Placeholder

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          conversationHistory: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.response || data.answer || 'No response received';

      // Update conversation history
      addMessageToHistory('ai', aiResponse, true);

      // Play success sound
      soundManager.current?.playSuccess();

      // Simple TTS - just play the full response
      if (!isMuted && aiResponse.trim()) {
        try {
          const ttsResponse = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: aiResponse })
          });

          if (ttsResponse.ok) {
            const audioData = await ttsResponse.arrayBuffer();

            if (audioContextRef.current) {
              if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
              }

              const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);

              source.onended = () => {
                setIsSpeaking(false);
                currentAudioSourceRef.current = null;
              };

              source.start();
              setIsSpeaking(true);
              currentAudioSourceRef.current = source;
            }
          }
        } catch (ttsError) {
          console.warn('TTS failed:', ttsError);
          // Continue even if TTS fails
        }
      }

    } catch (error) {
      console.error('Error getting AI response:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to get response');
      setConversationHistory(prev => prev.filter(msg => !(msg.type === 'ai' && msg.text === '')));
    } finally {
      setIsProcessing(false);
    }
  };

  // Add connection health check
  const checkConnectionHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        console.warn('Health check failed, reinitializing audio context...');
        // Re-initialize audio context
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
        // Create new context on next user interaction
      }
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }, []);

  useEffect(() => {
    const healthCheckInterval = setInterval(checkConnectionHealth, 60000); // Every minute
    return () => clearInterval(healthCheckInterval);
  }, [checkConnectionHealth]);

  // Auto-scroll effect
  useEffect(() => {
    if (chatHistoryRef.current) {
      const { scrollHeight, clientHeight } = chatHistoryRef.current;
      chatHistoryRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: 'smooth'
      });
    }
  }, [conversationHistory, isProcessing, isSpeaking]);

  // Initialize sound manager
  const soundManager = useRef<EnhancedSoundManager | null>(null);
  const accessibilityManager = useRef<SoundAccessibilityManager | null>(null);

  useEffect(() => {
    try {
      soundManager.current = EnhancedSoundManager.getInstance();
      accessibilityManager.current = SoundAccessibilityManager.getInstance();
      console.log('Enhanced sound system initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced sound system:', error);
    }
  }, []);

  // Set up keyboard navigation for action bar
  useEffect(() => {
    const actionBar = document.querySelector('.fixed-action-bar') as HTMLElement;
    if (actionBar) {
      // Setup keyboard navigation for the action bar
      AccessibilityUtils.setupKeyboardNavigation(
        actionBar,
        () => {
          // Handle Enter key - could be used to focus first button
          const firstButton = actionBar.querySelector('.action-button') as HTMLButtonElement;
          if (firstButton) firstButton.focus();
        },
        () => {
          // Handle Space key - could be used to activate last focused button
          const activeElement = document.activeElement as HTMLButtonElement;
          if (activeElement && actionBar.contains(activeElement)) {
            activeElement.click();
          }
        }
      );
    }

    return () => {
      if (actionBar) {
        AccessibilityUtils.removeKeyboardNavigation(actionBar);
      }
    };
  }, []);

  // Character state management based on app state
  useEffect(() => {
    if (isListening) {
      setCharacterState('listening');
      soundManager.current?.playStart();
    } else if (isProcessing) {
      setCharacterState('thinking');
    } else if (isSpeaking) {
      setCharacterState('speaking');
    } else {
      setCharacterState('idle');
    }
  }, [isListening, isProcessing, isSpeaking]);

  // Visual effects functions
  const createParticles = useCallback((x: number, y: number, count: number = 10) => {
    const colors = ['#ffe66d', '#ff6b6b', '#4ecdc4', '#a8e6cf', '#95e1d3'];
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: x + (Math.random() - 0.5) * 100,
      y: y + (Math.random() - 0.5) * 100,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setParticles(prev => [...prev, ...newParticles]);

    // Remove particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 2000);
  }, []);

  const triggerCelebration = useCallback(() => {
    setStars(prev => prev + 1);
    setShowConfetti(true);
    setCharacterState('excited');

    // Play celebration sound
    soundManager.current?.playCheer();

    // Create particles around character
    const character = document.querySelector('.character-companion');
    if (character) {
      const rect = character.getBoundingClientRect();
      createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, 20);
    }

    setTimeout(() => setShowConfetti(false), 3000);
    setTimeout(() => setCharacterState('idle'), 2000);
  }, [createParticles]);

  // Add last AI response tracking
  useEffect(() => {
    const lastAiMessage = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.type === 'ai' && msg.text.trim() !== '');

    if (lastAiMessage) {
      setLastAiResponse(lastAiMessage.text);
    }
  }, [conversationHistory]);

  // Toggle mute state
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMutedState = !prev;

      // Use enhanced sound system
      toggleHookMute();

      // Stop audio if muting
      if (newMutedState && (isSpeaking || isProcessing)) {
        handleStopSpeaking();
      }

      // Trigger visual feedback if enabled
      if (visualFeedback) {
        const feedbackMessage = newMutedState ? 'Sound muted' : 'Sound unmuted';
        // Show visual feedback (this would use the accessibility manager)
        console.log(feedbackMessage);
      }

      // Trigger vibration if enabled
      if (vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate(newMutedState ? [100] : [50]);
      }

      return newMutedState;
    });
  }, [isSpeaking, isProcessing, handleStopSpeaking, toggleHookMute, visualFeedback, vibrationEnabled]);

  // Read last AI response aloud
  const readLastResponse = useCallback(() => {
    if (lastAiResponse.trim() && !isMuted && !isSpeaking && !isProcessing) {
      // Clear any ongoing audio
      handleStopSpeaking();

      // Enqueue the last response for TTS
      setTimeout(() => {
        enqueueTtsRequest(lastAiResponse);
      }, 100);
    }
  }, [lastAiResponse, isMuted, isSpeaking, isProcessing, handleStopSpeaking, enqueueTtsRequest]);

  // Trigger celebration on successful interactions
  useEffect(() => {
    if (conversationHistory.length > 0 && conversationHistory.length % 3 === 0) {
      triggerCelebration();
    }
  }, [conversationHistory.length, triggerCelebration]);

  const isAnyGameActive = showMiniGame || showMathGame || showPatternPuzzleGame || showAnimalGame;

  return (
    <div className={`container full-page-layout ${isAnyGameActive ? 'game-active' : ''}`}>
      <Head>
        <title>Kid-Friendly AI Buddy</title>
        <meta name="description" content="A simple, kid-friendly AI assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>


  
      {/* Settings Gear Icon */}
      <button
        className="settings-gear"
        onClick={() => setShowSettings(!showSettings)}
        aria-label="Settings"
      >
        ⚙️
      </button>

      {/* Settings Panel (Hidden by default) */}
      {showSettings && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>Settings</h3>
            <button onClick={() => setShowSettings(false)} className="close-settings">✕</button>
          </div>

          {/* Sound Controls */}
          <div className="settings-section">
            <h4>🔊 Sound</h4>
            <div className="setting-item">
              <label>Volume</label>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume * 100}
                onChange={(e) => setMasterVolume(parseInt(e.target.value) / 100)}
              />
            </div>
            <button
              className="setting-button"
              onClick={() => setShowSoundControls(!showSoundControls)}
            >
              {showSoundControls ? 'Hide Sound Controls' : 'Sound Controls'}
            </button>
          </div>

          {/* Voice Settings */}
          <div className="settings-section">
            <h4>🎙️ Voice</h4>
            <div className="setting-item">
              <label>Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                <option value="en-US">English</option>
                <option value="es-ES">Español</option>
                <option value="fr-FR">Français</option>
                <option value="de-DE">Deutsch</option>
              </select>
            </div>
          </div>

        </div>
      )}

      {/* Main Content Area */}
      <div className="main-app-container">
        {/* Character and Stars */}
        <div className="character-section">
          <CharacterCompanion state={characterState} size={120} />
          <div className="stars-display">
            {[...Array(stars)].map((_, i) => (
              <span key={i} className="star">⭐</span>
            ))}
          </div>
        </div>

        {/* Game Buttons */}
        <div className="game-buttons-container">
          <button
            className="game-button"
            onClick={() => {
              setShowMiniGame(!showMiniGame);
              setShowMathGame(false);
              setShowPatternPuzzleGame(false);
              setShowAnimalGame(false);
            }}
          >
            🐾 Animal Guessing
          </button>
          <button
            className="game-button"
            onClick={() => {
              setShowMathGame(!showMathGame);
              setShowMiniGame(false);
              setShowPatternPuzzleGame(false);
              setShowAnimalGame(false);
            }}
          >
            🧮 Math Game
          </button>
          <button
            className="game-button"
            onClick={() => {
              setShowPatternPuzzleGame(!showPatternPuzzleGame);
              setShowMiniGame(false);
              setShowMathGame(false);
              setShowAnimalGame(false);
            }}
          >
            🧩 Pattern Puzzles
          </button>
          <button
            className="game-button"
            onClick={() => {
              setShowAnimalGame(!showAnimalGame);
              setShowMiniGame(false);
              setShowMathGame(false);
              setShowPatternPuzzleGame(false);
            }}
          >
            🦁 Animal Adventure
          </button>
        </div>

        {/* Simple Controls */}
        <div className="simple-controls">
          {/* Talk Button */}
          <SpeechControls
            onResult={handleQuestionSubmit}
            onError={setErrorMessage}
            onVoiceActivity={(active) => {
              if (active) {
                setCharacterState('listening');
                soundManager.current?.playStart();
              }
            }}
            initialLanguage={selectedLanguage}
            showSettings={false}
            childFriendly={true}
            animateButtons={true}
            compact={true}
            theme="auto"
            className="simple-speech-controls"
          />

          {/* Stop Button */}
          <button
            className="simple-stop-button"
            onClick={handleStopSpeaking}
            disabled={!isProcessing && !isSpeaking}
            aria-label="Stop"
          >
            ⏹️ Stop
          </button>

          {errorMessage && (
            <div className="simple-error">
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="chat-container">
          {showSoundControls ? (
            <div className="sound-controls-container">
              <SoundControls
                compact={false}
                showLibrary={true}
                showAccessibility={true}
                showParentalControls={true}
                onVolumeChange={setMasterVolume}
                onMuteToggle={toggleMute}
              />
            </div>
          ) : showMiniGame ? (
            <div className="game-container">
              <MiniGame onComplete={() => setShowMiniGame(false)} />
            </div>
          ) : showMathGame ? (
            <div className="game-container">
              <MathGame
                onComplete={() => setShowMathGame(false)}
                onStickerEarned={(stickerId) => {
                  console.log('Math sticker earned:', stickerId);
                }}
              />
            </div>
          ) : showPatternPuzzleGame ? (
            <div className="game-container">
              <PatternPuzzleGame
                isOpen={showPatternPuzzleGame}
                onClose={() => setShowPatternPuzzleGame(false)}
                onStickerEarned={(stickerId) => {
                  console.log('Sticker earned:', stickerId);
                }}
              />
            </div>
          ) : showAnimalGame ? (
            <div className="game-container">
              <AnimalGame
                isOpen={showAnimalGame}
                onClose={() => setShowAnimalGame(false)}
                onStickerEarned={(stickerId) => {
                  console.log('Animal sticker earned:', stickerId);
                }}
              />
            </div>
          ) : (
            <div className="chat-history-container">
              <div className="chat-history" ref={chatHistoryRef}>
                {conversationHistory.length === 0 && !isProcessing && (
                  <p className="empty-chat-message">Press the Talk button to start!</p>
                )}
                {conversationHistory.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.type}`}>
                    <span className="chat-label">{msg.type === 'user' ? 'You:' : 'Buddy:'}</span>
                    <p>{msg.text}</p>
                  </div>
                ))}
                {(isProcessing || (isSpeaking && conversationHistory[conversationHistory.length - 1]?.type === 'ai')) && (
                  <div className="chat-message ai loading-dots">
                    <span></span><span></span><span></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

  
      {/* Visual Effects */}
      {showConfetti && (
        <div className="confetti-overlay">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                backgroundColor: ['#ffe66d', '#ff6b6b', '#4ecdc4', '#a8e6cf', '#95e1d3'][Math.floor(Math.random() * 5)],
                animation: `confettiFall ${1 + Math.random() * 2}s linear forwards`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
      )}

      {/* Particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="particle"
          style={{
            position: 'fixed',
            left: particle.x,
            top: particle.y,
            width: '8px',
            height: '8px',
            backgroundColor: particle.color,
            borderRadius: '50%',
            pointerEvents: 'none',
            animation: 'particleFloat 2s ease-out forwards',
            zIndex: 1000
          }}
        />
      ))}

    </div>
  );
} 