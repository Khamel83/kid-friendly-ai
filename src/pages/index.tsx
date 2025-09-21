import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import SpeechControls from '../components/SpeechControls';
import CharacterCompanion from '../components/CharacterCompanion';
import MiniGame from '../components/MiniGame';
import MathGame from '../components/MathGame';
import PatternPuzzleGame from '../components/PatternPuzzleGame';
import AnimalGame from '../components/AnimalGame';
import SoundControls from '../components/SoundControls';
import QuotaWarning from '../components/QuotaWarning';
// import OfflineIndicator from '../components/OfflineIndicator';
import { EnhancedSoundManager } from '../utils/soundManager';
import { useSoundControls, useSoundAccessibility } from '../hooks/useSoundEffects';
import { usageTracker } from '../utils/usageTracker';
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

  // Usage Tracking States
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);

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
  const sentenceBufferRef = useRef(''); // Buffer for incoming text chunks to form sentences

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null); // Ref for the currently playing audio source
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

  // --- Simplified TTS Request - Single audio at a time ---
  const enqueueTtsRequest = useCallback((sentence: string) => {
    if (isStoppedRef.current || !sentence.trim()) return;

    console.log(`Processing TTS for: "${sentence.trim().substring(0,30)}..."`);

    // Clear any existing audio to prevent echoes
    ttsRequestQueueRef.current = [];
    audioPlaybackQueueRef.current = [];

    // Stop any currently playing audio
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch (e) { /* ignore */ }
      currentAudioSourceRef.current = null;
    }

    // Process immediately - no queue needed
    processTtsQueue(sentence.trim());
  }, []);

  // --- Simplified TTS Processing - Direct audio playback ---
  const processTtsQueue = useCallback(async (text: string) => {
    if (isStoppedRef.current || isProcessingTtsQueueRef.current) return;

    isProcessingTtsQueueRef.current = true;
    setIsSpeaking(true);
    setErrorMessage('');

    try {
        // Use ElevenLabs only - no OpenAI fallback
        const response = await fetch('/api/elevenlabs-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs TTS Error ${response.status}`);
        }

        if (isStoppedRef.current) return;

        // Track character usage
        if (typeof window !== 'undefined') {
            usageTracker.addUsage(text.length);

            // Check if limit reached and show warning
            if (usageTracker.isLimitReached() || usageTracker.isNearLimit()) {
                setTimeout(() => setShowQuotaWarning(true), 1000); // Show after audio plays
            }
        }

        const audioData = await response.arrayBuffer();

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        if (isStoppedRef.current) return;

        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);

        if (isStoppedRef.current) return;

        // Play audio immediately
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        currentAudioSourceRef.current = source;

        source.onended = () => {
            setIsSpeaking(false);
            currentAudioSourceRef.current = null;
            console.log('Audio playback finished');
        };

        source.start();
        console.log(`Playing audio, duration: ${audioBuffer.duration}s`);

    } catch (error) {
        if (!isStoppedRef.current) {
            console.error('TTS Error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            // Check if this is a quota limit (don't fallback)
            if (errorMessage.includes('429')) {
                setErrorMessage("We've used up our talking time for today! Please ask a grown-up to help.");
                setIsSpeaking(false);
            } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
                setErrorMessage("I'm having trouble with my voice today. Please ask a grown-up to help.");
                setIsSpeaking(false);
            } else {
                // Service failure - try emergency browser TTS
                console.log('ElevenLabs service failed, trying emergency browser TTS...');
                try {
                    await emergencyBrowserTTS(text);
                } catch (browserError) {
                    console.error('Browser TTS also failed:', browserError);
                    setErrorMessage("Sorry, I can't speak right now, but I can still chat with text!");
                    setIsSpeaking(false);
                }
            }
        }
    } finally {
        isProcessingTtsQueueRef.current = false;
    }
  }, []);

  // --- Emergency Browser TTS Function ---
  const emergencyBrowserTTS = useCallback(async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Browser TTS not supported'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // Kid-friendly settings for emergency fallback
      utterance.rate = 0.8;
      utterance.pitch = 1.1;
      utterance.volume = 0.7;

      // Try to get a decent voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        (v.lang.startsWith('en') && v.name.includes('Female'))
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        console.log('Emergency browser TTS finished');
        resolve();
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        reject(new Error(`Browser TTS error: ${event.error}`));
      };

      console.log('Using emergency browser TTS (robot voice)');
      speechSynthesis.speak(utterance);
    });
  }, []);




  // --- Simplified Stop Speaking ---
  const handleStopSpeaking = useCallback(async () => {
    if (isStoppedRef.current) return;

    isStoppedRef.current = true;
    console.log("Stop Speaking requested.");

    // 1. Abort the fetch request if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 2. Cancel stream reader
    if (readerRef.current) {
       try {
          await readerRef.current.cancel('User stopped');
       } catch (e) { /* ignore */ }
       readerRef.current = null;
    }

    // 3. Stop audio
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.onended = null;
      try {
        currentAudioSourceRef.current.stop();
      } catch (e) { /* ignore */ }
      currentAudioSourceRef.current = null;
    }

    // 4. Reset everything
    ttsRequestQueueRef.current = [];
    audioPlaybackQueueRef.current = [];
    isProcessingTtsQueueRef.current = false;
    setIsSpeaking(false);
    setIsProcessing(false);
    setErrorMessage('');
  }, []);

  // --- Handle Text Stream (Simplified - Single TTS Chunk) ---
  const handleQuestionSubmit = async (text: string) => {
    let retryCount = 0;
    const maxRetries = 2;

    const attemptSubmit = async (): Promise<void> => {
      try {
        // Ensure AudioContext is active
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // If AudioContext is lost, recreate it
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }

        if (!text || text.trim() === '') return;
        console.log('Submitting question via POST:', text);

        // Stop ongoing process and wait for cleanup
        console.log('Stopping any ongoing speech before starting new question...');
        await handleStopSpeaking();

        // Clear all audio queues to prevent echoes
        ttsRequestQueueRef.current = [];
        audioPlaybackQueueRef.current = [];

        // Additional delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 200));

        // Reset stop flag
        isStoppedRef.current = false;

        // Setup state
        addMessageToHistory('user', text);
        setIsProcessing(true);
        setIsSpeaking(false);
        setErrorMessage('');
        addMessageToHistory('ai', '', false); // Placeholder

        // Abort controller setup
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        let accumulatedResponse = ''; // For display AND for single TTS request
        let sseBuffer = '';

        const processSseBuffer = (): void => {
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
                if (isStoppedRef.current) break;
                if (line.startsWith('data:')) {
                    const dataString = line.substring(5).trim();
                    if (dataString === '[DONE]') continue;
                    try {
                        const data = JSON.parse(dataString);

                        if (data.type === 'chunk' && data.content) {
                            const contentChunk = data.content;
                            accumulatedResponse += contentChunk;
                            if (!isStoppedRef.current) addMessageToHistory('ai', accumulatedResponse, false);
                        } else if (data.type === 'error') {
                             if (!isStoppedRef.current) {
                                 setErrorMessage(data.content || 'Stream error');
                                 setIsProcessing(false);
                                 setConversationHistory(prev => prev.filter(msg => !(msg.type === 'ai' && msg.text === '')));
                             }
                             if (readerRef.current) readerRef.current.cancel('Stream error received').catch(()=>{});
                             abortControllerRef.current?.abort();
                             break;
                        }
                    } catch (parseError) {
                        if (!isStoppedRef.current) console.warn('Could not parse stream data chunk:', dataString, parseError);
                    }
                } else if (line.trim()) {
                     console.log("Non-data SSE Line Received:", line);
                }
            }
        };

        try {
            const requestBody = {
                question: text,
                conversationHistory: conversationHistory.map(msg => ({
                  speaker: msg.type,
                  text: msg.text
                }))
            };
            console.log('Sending request to /api/ask with body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('/api/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: abortControllerRef.current.signal
            });

            if (isStoppedRef.current) return;
            if (!response.ok) {
                let errorMsg = `Error fetching stream: ${response.status}`;
                try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch { /* ignore */ }
                throw new Error(errorMsg);
            }

            // Check for error responses
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const jsonResponse = await response.json();
                if (jsonResponse.error) {
                    addMessageToHistory('ai', `Sorry, I had a problem: ${jsonResponse.error}`, true);
                    setIsProcessing(false);
                    return;
                }
            }

            if (!response.body) throw new Error('Response body is null');

            readerRef.current = response.body.getReader();
            const decoder = new TextDecoder();

            // Stream reading loop
            while (true) {
                if (isStoppedRef.current) break;
                try {
                    const { done, value } = await readerRef.current!.read();
                    if (isStoppedRef.current) break;

                    if (done) {
                        console.log('Fetch stream finished.');
                        sseBuffer += decoder.decode(undefined, { stream: false }); // Flush decoder
                        processSseBuffer(); // Process final buffer part

                        // Add Final History Update
                        if (!isStoppedRef.current && accumulatedResponse) {
                             console.log('Updating history with final complete AI message.');
                             addMessageToHistory('ai', accumulatedResponse, true);
                        }

                        // Send ENTIRE accumulated response for TTS
                        if (!isStoppedRef.current && accumulatedResponse.trim()) {
                            console.log(`Stream done. Enqueueing full response (length: ${accumulatedResponse.length}) for TTS.`);
                            enqueueTtsRequest(accumulatedResponse.trim());
                        }

                        if (!isStoppedRef.current) setIsProcessing(false);
                        break; // Exit loop
                    }

                    // Add incoming data and process buffer
                    sseBuffer += decoder.decode(value, { stream: true });
                    processSseBuffer(); // Process buffer after adding data

                } catch (streamReadError) {
                     if (!(streamReadError instanceof Error && streamReadError.name === 'AbortError') && !isStoppedRef.current) {
                         console.error('Error reading stream:', streamReadError);
                         setErrorMessage('Connection lost during response.');
                         setIsProcessing(false);
                         setConversationHistory(prev => prev.filter(msg => !(msg.type === 'ai' && msg.text === '')));
                     } else {
                         console.log('Stream reading aborted or stopped.');
                     }
                     break; // Exit loop on error or abort/stop
                }
            } // end while

            // Cleanup after loop finishes naturally or via break
            readerRef.current = null;
            if (!abortControllerRef.current?.signal.aborted && !isStoppedRef.current) {
                 abortControllerRef.current = null;
            }
            if (isStoppedRef.current) { // Ensure processing stops if loop was exited by stop flag
                setIsProcessing(false);
            }

        } catch (error) {
             if (!(error instanceof Error && error.name === 'AbortError') && !isStoppedRef.current) {
                 console.error('Failed to initiate fetch stream or response error:', error);
                 setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to the AI.');
                 setIsProcessing(false);
                 setConversationHistory(prev => prev.filter(msg => !(msg.type === 'ai' && msg.text === '')));
             } else {
                 console.log("Fetch initiation aborted or stopped.");
                 setIsProcessing(false);
             }
             abortControllerRef.current = null; // Clear controller on any outer error/abort
        }

      } catch (error) {
        console.error('Error in handleQuestionSubmit:', error);

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying submission (attempt ${retryCount})...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          return attemptSubmit();
        }

        throw error; // If all retries failed
      }
    };

    return attemptSubmit();
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

  return (
    <div className="container full-page-layout">
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

      {/* Quota Warning Modal */}
      <QuotaWarning
        isVisible={showQuotaWarning}
        onClose={() => setShowQuotaWarning(false)}
      />

    </div>
  );
} 