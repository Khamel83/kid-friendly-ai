import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import VoiceButton from '../components/VoiceButton';
import { Buffer } from 'buffer'; // Needed for sentence detection buffer

interface Message {
  type: 'user' | 'ai';
  text: string;
  isComplete?: boolean; // Optional flag
}

// Simple sentence end detection (can be improved)
const SENTENCE_END_REGEX = /([.?!])\s+/;

const SESSION_STORAGE_KEY = 'kidFriendlyAiHistory';

export default function Home() {
  // Core States
  const [isListening, setIsListening] = useState(false); // Mic is recording
  const [isProcessing, setIsProcessing] = useState(false); // Waiting for AI text stream start/end OR TTS audio
  const [isSpeaking, setIsSpeaking] = useState(false); // Audio is queued or playing
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Streaming & Queuing States
  const ttsRequestQueueRef = useRef<string[]>([]); // Queue of sentences needing TTS
  const audioPlaybackQueueRef = useRef<AudioBuffer[]>([]); // Queue of decoded audio buffers ready to play
  const isProcessingTtsQueueRef = useRef(false); // Lock to prevent parallel TTS processing
  const isPlayingAudioSegmentRef = useRef(false);
  const isStoppedRef = useRef(false);
  const firstChunkProcessedRef = useRef(false); // <<< Add Ref for firstChunkProcessed

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null); // Ref for the currently playing audio source
  const sentenceBufferRef = useRef(''); // Buffer for incoming text chunks to form sentences
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null); // Ref for the stream reader
  const abortControllerRef = useRef<AbortController | null>(null); // Ref to allow aborting fetch

  // --- REMOVE SessionStorage Loading Effect --- 
  // useEffect(() => { ... load logic ... }, []);
  // --- End REMOVE --- 
  
  // --- Initialize AudioContext only --- 
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioContextRef.current) {
       try {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
         console.log('AudioContext initialized for playback.');
       } catch (err) {
         console.error('Error initializing AudioContext:', err);
         setErrorMessage('Web Audio API is not available in this browser.');
       }
    }
    // No cleanup needed for AudioContext itself generally
    // Cleanup for audio source nodes happens in stop functions
    
    // Ensure fetch is aborted on unmount if active
    return () => {
        // Remove old EventSource cleanup
        // if (eventSourceRef.current) { ... }
        
        // Add cleanup for fetch AbortController
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
      // --- Refined Logic --- 
      if (type === 'ai' && lastIndex >= 0 && prev[lastIndex].type === 'ai' && !prev[lastIndex].isComplete) {
        // If last message is AI and not marked complete, UPDATE it.
        const updatedHistory = [...prev];
        updatedHistory[lastIndex] = { ...updatedHistory[lastIndex], text: text, isComplete: isComplete };
        return updatedHistory;
      } else if (type === 'ai' && text === '' && !isComplete) {
        // If adding an empty AI placeholder, just add it.
        return [...prev, { type, text, isComplete: false }];
      } else if (type === 'ai' && lastIndex >= 0 && prev[lastIndex].type === 'ai' && prev[lastIndex].text === '' && !prev[lastIndex].isComplete) {
        // If last message is an EMPTY AI placeholder, REPLACE it with the first real text.
        const updatedHistory = [...prev.slice(0, lastIndex)]; // Remove placeholder
        updatedHistory.push({ type, text, isComplete: isComplete }); // Add new message
        return updatedHistory;
      } else {
        // Otherwise (user message, or first AI message after user), add a new entry.
        return [...prev, { type, text, isComplete: type === 'user' ? true : isComplete }];
      }
      // --- End Refined Logic --- 
    });
  }, []);

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


  // --- Play Next Audio Chunk from Queue (No changes needed) ---
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
        
        // Check if more chunks are ready AND not stopped
        if (!isStoppedRef.current && audioPlaybackQueueRef.current.length > 0) {
           playNextAudioChunk(); 
        } else if (!isStoppedRef.current) {
            // No more chunks, check if TTS is still processing before setting isSpeaking=false
            if (!isProcessingTtsQueueRef.current) {
               setIsSpeaking(false);
            }
        }
    };

    source.start();

  }, []); // Dependencies updated as needed


  // --- Define handleStopSpeaking with useCallback ---
  const handleStopSpeaking = useCallback(async () => {
    if (isStoppedRef.current) return; // Avoid running stop logic multiple times if already stopped

    isStoppedRef.current = true; // Set stop flag immediately
    console.log("Stop Speaking requested. Halting audio, queues, and fetch.");

    // 1. Abort the fetch request if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log("Aborted active fetch request.");
    }
    // Cancel any pending read on the stream reader
    if (readerRef.current) {
       try {
          await readerRef.current.cancel('User stopped'); // Pass reason for cancellation
          console.log("Cancelled stream reader.");
       } catch (cancelError) {
          console.warn("Error cancelling stream reader:", cancelError);
       }
       readerRef.current = null;
    }

    // 2. Stop the currently playing audio source node
    if (currentAudioSourceRef.current) {
      currentAudioSourceRef.current.onended = null; // Prevent onended from firing
      try {
        currentAudioSourceRef.current.stop();
        console.log("Stopped current audio source node.");
      } catch (e) {
        // Ignore errors often caused by stopping already stopped/finished node
        // console.warn("Error stopping audio source (might have already finished):", e);
      }
      currentAudioSourceRef.current = null;
    }

    // 3. Clear both queues immediately
    ttsRequestQueueRef.current = [];
    audioPlaybackQueueRef.current = [];
    console.log("Cleared TTS request and audio playback queues.");

    // 4. Reset processing/playback locks
    isPlayingAudioSegmentRef.current = false;
    isProcessingTtsQueueRef.current = false;

    // 5. Reset state variables
    setIsSpeaking(false);
    setIsProcessing(false); // Ensure overall processing stops immediately
    
    // 6. Reset sentence buffer
    sentenceBufferRef.current = '';

    setErrorMessage(''); // Clear any transient errors

  }, []); // Keep dependencies minimal

  // --- Handle Text Stream (Reset firstChunkProcessedRef) ---
  const handleQuestionSubmit = async (text: string) => {
    if (!text || text.trim() === '') return;
    console.log('Submitting question via POST:', text);

    // Step 1: Stop ongoing process
    await handleStopSpeaking();

    // Step 2: Reset stop flag AND first chunk flag
    isStoppedRef.current = false; 
    firstChunkProcessedRef.current = false; // <<< Reset ref here

    // Step 3: Setup state
    addMessageToHistory('user', text);
    setIsProcessing(true);
    setIsSpeaking(false);
    setErrorMessage('');
    // sentenceBufferRef.current = ''; // sentenceBufferRef is not used in this version
    addMessageToHistory('ai', '', false); // Placeholder

    // Abort controller setup
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    let accumulatedResponse = ''; // For display
    let remainingTextBuffer = ''; // For second TTS request
    let sseBuffer = ''; 

    const processSseBuffer = (): void => {
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; 

        for (const line of lines) {
            console.log("Raw SSE Line Received:", line); // <<< Log every raw line
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

                        // Apply Two-Chunk Logic (using ref)
                        if (!firstChunkProcessedRef.current) { // <<< Check ref
                            let tempBufferForFirstChunk = remainingTextBuffer + contentChunk;
                            let firstPart = '';
                            const words = tempBufferForFirstChunk.trim().split(/\s+/);
                            const wordCount = words[0] === '' ? 0 : words.length;
                            
                            // --- Adjust Word Count Thresholds --- 
                            const MIN_WORDS_FOR_FIRST_CHUNK = 15; // Changed from 8
                            const TARGET_WORDS_FOR_FIRST_CHUNK = 15; // Changed from 10
                            // --- End Adjust Word Count Thresholds ---

                            if (wordCount >= MIN_WORDS_FOR_FIRST_CHUNK) {
                               firstPart = words.slice(0, TARGET_WORDS_FOR_FIRST_CHUNK).join(' ');
                               remainingTextBuffer = tempBufferForFirstChunk.substring(firstPart.length).trimStart();
                               
                               if (firstPart && !isStoppedRef.current) {
                                   console.log(`Met word threshold. Sending first chunk (~${TARGET_WORDS_FOR_FIRST_CHUNK} words): "${firstPart}"`);
                                   enqueueTtsRequest(firstPart); 
                                   firstChunkProcessedRef.current = true; // <<< Set ref here
                               }
                            } else {
                               remainingTextBuffer = tempBufferForFirstChunk;
                               console.log(`Buffering for first chunk. Words: ${wordCount}/${MIN_WORDS_FOR_FIRST_CHUNK}`);
                               continue; 
                            }
                        } else {
                            remainingTextBuffer += contentChunk;
                        }
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
            } else if (line.trim()) { // Log non-empty lines that don't start with 'data:'
                 console.log("Non-data SSE Line Received:", line);
            }
        } // end for lines
    }; // --- End processSseBuffer definition ---
    
    // --- Main try block for fetch and stream reading ---
    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: text,
                conversationHistory: conversationHistory
            }),
            signal: abortControllerRef.current.signal
        });

        if (isStoppedRef.current) return;
        if (!response.ok) {
            let errorMsg = `Error fetching stream: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch { /* ignore */ }
            throw new Error(errorMsg);
        }
        if (!response.body) throw new Error('Response body is null');

        readerRef.current = response.body.getReader();
        const decoder = new TextDecoder();

        // Stream reading loop
        while (true) {
            if (isStoppedRef.current) break;
            try { // Inner try for reader.read()
                const { done, value } = await readerRef.current!.read();
                if (isStoppedRef.current) break;

                if (done) {
                    console.log('Fetch stream finished.');
                    sseBuffer += decoder.decode(undefined, { stream: false }); 
                    console.log("Processing final SSE buffer portion."); // <<< Log final process call
                    processSseBuffer(); 

                    // --- Add Final History Update (Unconditional) --- 
                    if (!isStoppedRef.current && accumulatedResponse) {
                         console.log('Updating history with final complete AI message.');
                         addMessageToHistory('ai', accumulatedResponse, true); // Mark as complete
                    }
                    // --- End Final History Update ---

                    // Send final remaining text for TTS
                    if (!isStoppedRef.current && remainingTextBuffer.trim()) {
                        console.log(`Stream done. Enqueueing final chunk (length: ${remainingTextBuffer.length})`);
                        enqueueTtsRequest(remainingTextBuffer.trim());
                    }
                    remainingTextBuffer = '';
                    if (!isStoppedRef.current) setIsProcessing(false); 
                    break; // Exit loop
                }

                // Add incoming data and process buffer
                sseBuffer += decoder.decode(value, { stream: true });
                processSseBuffer(); // Process buffer after adding data

            } catch (streamReadError) { // Catch for reader.read()
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

    // --- End of main try block ---
    } catch (error) { // Catch for fetch() or setup errors
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
    // --- End of outer catch block ---

  }; // --- End handleQuestionSubmit --- 

  return (
    <div className="container full-page-layout">
      <Head>
        <title>Kid-Friendly AI Buddy</title>
        <meta name="description" content="A simple, kid-friendly AI assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Left Sidebar for Controls */}
      <aside className="sidebar">
        <h1 className="title">AI Buddy</h1>
        
        <div className="controls-area">
          {/* --- Render Simplified Voice Button --- */}
          <VoiceButton 
            onResult={handleQuestionSubmit} 
            isListening={isListening}
            setIsListening={setIsListening}
            disabled={isProcessing || isSpeaking}
          />
          {/* --- End Render Simplified Voice Button --- */}

          {/* --- Render Separate Stop Speaking Button --- */}
          <button 
              className="control-button stop-speaking-button" 
              onClick={handleStopSpeaking}
              disabled={!isProcessing && !isSpeaking} 
              aria-label="Stop" 
          >
              Stop {/* Simple "Stop" covers both thinking and speaking */}
          </button>
          {/* --- End Render Separate Stop Speaking Button --- */}
        
          {errorMessage && (
            <div className="error-container sidebar-error">
              <p>{errorMessage}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Right Main Area for Chat */}
      <main className="main-content">
        <div className="chat-history-container">
          <div className="chat-history">
            {conversationHistory.length === 0 && !isProcessing && (
                <p className="empty-chat-message">Press the green 'Talk' button to start!</p>
            )}
            {conversationHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.type}`}>
                <span className="chat-label">{msg.type === 'user' ? 'You:' : 'Buddy:'}</span>
                <p>{msg.text}</p>
              </div>
            ))}
            {/* Show loading dots only while text stream is active */}
            {(isProcessing || (isSpeaking && conversationHistory[conversationHistory.length - 1]?.type === 'ai')) && (
                <div className="chat-message ai loading-dots">
                    <span></span><span></span><span></span>
                </div>
            )}
          </div>
        </div>
      </main>

    </div>
  );
} 