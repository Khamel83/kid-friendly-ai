import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import VoiceButton from '../components/VoiceButton';
import { Buffer } from 'buffer'; // Needed for sentence detection buffer

interface Message {
  type: 'user' | 'ai';
  text: string;
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
  const isPlayingAudioSegmentRef = useRef(false); // Lock for current audio segment playback

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
    };
  }, []);
  // --- End Initialize AudioContext --- 

  // --- REMOVE SessionStorage Saving Effect --- 
  // useEffect(() => { ... save logic ... }, [conversationHistory]);
  // --- End REMOVE --- 

  const addMessageToHistory = useCallback((type: 'user' | 'ai', text: string, isComplete: boolean = true) => {
    setConversationHistory(prev => {
      // If adding AI text and the last message is also AI (and not marked complete yet?), update it
      if (type === 'ai' && prev.length > 0 && prev[prev.length - 1].type === 'ai' && !isComplete) {
         // Check if the last AI message placeholder is empty, if so replace it, otherwise update.
         // This handles the initial placeholder addition vs subsequent updates.
         const lastMsg = prev[prev.length - 1];
         if (lastMsg.text === '') { // Replace empty placeholder
            return [...prev.slice(0, -1), { type, text }];
         } else { // Update existing text
             const updatedHistory = [...prev];
             updatedHistory[updatedHistory.length - 1].text = text;
             return updatedHistory;
         }
      }
      // Otherwise, add a new message entry
      return [...prev, { type, text }];
    });
  }, []);

  // --- Function to add sentence to TTS Queue and trigger processing ---
  const enqueueTtsRequest = useCallback((sentence: string) => {
    if (sentence.trim()) {
      console.log(`Enqueueing TTS for: "${sentence.trim().substring(0,30)}..."`);
      ttsRequestQueueRef.current.push(sentence.trim());
      // Start processing if not already running
      if (!isProcessingTtsQueueRef.current) {
          processTtsQueue();
      }
    }
  }, []); // No dependencies needed as it uses refs and calls another function

  // --- Process TTS Request Queue ---
  const processTtsQueue = useCallback(async () => {
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
     setIsSpeaking(true); // Indicate that we are actively trying to generate/queue speech

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

         const audioData = await response.arrayBuffer();
         console.log(`TTS audio data length for sentence: ${audioData.byteLength}`);

         if (!audioContextRef.current) throw new Error("AudioContext lost");
         
         // Resume context if needed
         if (audioContextRef.current.state === 'suspended') {
             await audioContextRef.current.resume();
         }

         const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
         console.log(`Decoded buffer for sentence, duration: ${audioBuffer.duration}s`);
         
         // Add buffer to playback queue
         audioPlaybackQueueRef.current.push(audioBuffer);
         
         // Trigger playback check if not already playing
         if (!isPlayingAudioSegmentRef.current) {
            playNextAudioChunk();
         }

     } catch (error) {
         console.error('Error fetching or decoding TTS audio:', error);
         const message = error instanceof Error ? error.message : 'Failed to get audio for a sentence.';
         setErrorMessage(message);
         // Don't clear the whole speaking state on a single sentence failure
         // Maybe add sentence back to queue? Or just drop it? For now, drop it.
     } finally {
         // Release lock and immediately check if more items are in the queue
         isProcessingTtsQueueRef.current = false;
         // Check queue again asynchronously to allow state updates
         setTimeout(processTtsQueue, 0); 
     }
  }, []); // Dependencies: Needs access to state setters if used directly


  // --- Play Next Audio Chunk from Queue ---
  const playNextAudioChunk = useCallback(() => {
      if (isPlayingAudioSegmentRef.current || audioPlaybackQueueRef.current.length === 0 || !audioContextRef.current) {
          // If nothing to play and queue empty, ensure speaking state is false
          if(audioPlaybackQueueRef.current.length === 0 && !isPlayingAudioSegmentRef.current) {
             setIsSpeaking(false);
          }
          return; // Already playing, queue empty, or context lost
      }

      isPlayingAudioSegmentRef.current = true; // Acquire playback lock
      setIsSpeaking(true); // Overall system is speaking

      const audioBufferToPlay = audioPlaybackQueueRef.current.shift(); // Get next buffer

      if (!audioBufferToPlay) {
          isPlayingAudioSegmentRef.current = false; // Release lock if buffer somehow undefined
          setIsSpeaking(false); // No buffer, not speaking
          return;
      }

      console.log("Starting playback of next audio chunk...");
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferToPlay;
      source.connect(audioContextRef.current.destination);
      
      // Store ref to current source for potential stop action
      currentAudioSourceRef.current = source;

      source.onended = () => {
          console.log("Audio chunk playback finished.");
          source.disconnect(); // Clean up node
          
          // Only clear ref if this specific source ended
          if (currentAudioSourceRef.current === source) { 
              currentAudioSourceRef.current = null;
          }
          
          isPlayingAudioSegmentRef.current = false; // Release playback lock
          
          // Check immediately if more chunks are ready to play
          setTimeout(playNextAudioChunk, 0); 
      };

      source.start();

  }, []); // Dependencies: Needs access to state setters if used directly


  // --- Handle Text Stream from /api/ask (Updated to use Fetch POST) ---
  const handleQuestionSubmit = async (text: string) => {
    if (!text || text.trim() === '') return;
    
    console.log('Submitting question via POST:', text);
    await handleStopSpeaking(); // Stop any ongoing process first
    
    addMessageToHistory('user', text);
    setIsProcessing(true);
    setErrorMessage('');
    sentenceBufferRef.current = '';
    
    // Add placeholder for AI response
    addMessageToHistory('ai', '', false);

    // Abort previous fetch if any
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    let accumulatedResponse = '';

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: text,
                conversationHistory: conversationHistory // Send the history
            }),
            signal: abortControllerRef.current.signal // Allow aborting
        });

        if (!response.ok) {
            let errorMsg = `Error fetching stream: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch { /* ignore */ }
            throw new Error(errorMsg);
        }

        if (!response.body) {
            throw new Error('Response body is null');
        }

        readerRef.current = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Function to process the stream
        const processStream = async () => {
            while (true) {
                try {
                    // Check if aborted before reading
                    if (abortControllerRef.current?.signal.aborted) {
                       console.log('Fetch aborted by user.');
                       break;
                    }

                    const { done, value } = await readerRef.current!.read();
                    
                    if (done) {
                        console.log('Fetch stream finished.');
                        // Queue any remaining text in the buffer
                        enqueueTtsRequest(sentenceBufferRef.current);
                        sentenceBufferRef.current = '';
                        setIsProcessing(false);
                        // Mark final message as complete? (Optional)
                        // addMessageToHistory('ai', accumulatedResponse, true);
                        break; // Exit loop
                    }
                    
                    buffer += decoder.decode(value, { stream: true });
                    
                    // Process buffer line by line for SSE format
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line

                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            const dataString = line.substring(5).trim();
                            try {
                                const data = JSON.parse(dataString);
                                
                                if (data.type === 'chunk') {
                                    accumulatedResponse += data.content;
                                    sentenceBufferRef.current += data.content;
                                    addMessageToHistory('ai', accumulatedResponse, false);

                                    // Sentence detection logic (same as before)
                                    const sentences = sentenceBufferRef.current.split(SENTENCE_END_REGEX);
                                    if (sentences.length > 1) {
                                        for (let i = 0; i < sentences.length - 1; i++) {
                                            const sentence = sentences[i].trim();
                                            const delimiter = sentences[i+1]?.match(/^\s*([.?!])\s*/)?.[1];
                                            if (sentence) {
                                                enqueueTtsRequest(sentence + (delimiter || '')); 
                                            }
                                            i++; 
                                        }
                                        sentenceBufferRef.current = sentences[sentences.length - 1];
                                    }
                                    
                                } else if (data.type === 'error') {
                                    console.error('Stream error message:', data.content);
                                    setErrorMessage(data.content || 'An error occurred during streaming.');
                                    setIsProcessing(false);
                                    setConversationHistory(prev => prev.filter((msg) => !(msg.type === 'ai' && msg.text === '')));
                                    // Stop reading the stream on server error
                                    if (readerRef.current) readerRef.current.cancel();
                                    abortControllerRef.current?.abort(); // Abort fetch
                                    break; // Exit inner loop
                                } else if (data.type === 'done') {
                                   // This might be redundant if reader.read() handles done, but safe to check
                                   console.log('Stream signaled done via data message.');
                                   // Final processing is handled in the main loop's done check
                                }
                            } catch (parseError) {
                                console.warn('Could not parse stream data chunk:', dataString, parseError);
                            }
                        }
                    }
                } catch (streamReadError) {
                    if (abortControllerRef.current?.signal.aborted) {
                         console.log('Stream reading aborted.');
                    } else {
                        console.error('Error reading stream:', streamReadError);
                        setErrorMessage('Connection lost during response.');
                        setIsProcessing(false);
                        setConversationHistory(prev => prev.filter((msg) => !(msg.type === 'ai' && msg.text === '')));
                    }
                    break; // Exit loop on error or abort
                }
            } // end while
            
            // Cleanup reader ref
            readerRef.current = null;
            if (!abortControllerRef.current?.signal.aborted) {
                abortControllerRef.current = null; // Clear controller if finished naturally
            }
        };
        
        processStream(); // Start processing the stream asynchronously

    } catch (error) {
        console.error('Failed to initiate fetch stream:', error);
        let message = 'Failed to connect to the AI.';
        if (error instanceof Error && error.name !== 'AbortError') {
            message = error.message;
        }
        if (!(error instanceof Error && error.name === 'AbortError')) {
            setErrorMessage(message);
        }
        setIsProcessing(false);
        setConversationHistory(prev => prev.filter((msg) => !(msg.type === 'ai' && msg.text === '')));
        abortControllerRef.current = null; // Clear controller on fetch error
    }
  };

  // --- Stop Speaking Handler (Updated to include fetch abort) ---
  const handleStopSpeaking = useCallback(async () => { // Make async if needed for cleanup
    console.log("Stop Speaking button clicked. Halting audio, queues, and fetch.");

    // 1. Abort the fetch request if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log("Aborted active fetch request.");
    }
    // Cancel any pending read on the stream reader
    if (readerRef.current) {
       try {
          await readerRef.current.cancel();
          console.log("Cancelled stream reader.");
       } catch (cancelError) {
          console.warn("Error cancelling stream reader:", cancelError);
       }
       readerRef.current = null;
    }

    // 2. Stop the currently playing audio source node
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        console.log("Stopped current audio source node.");
      } catch (e) {
        console.warn("Error stopping audio source (might have already finished):", e);
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
    setIsProcessing(false); // Ensure overall processing stops
    
    // 6. Reset sentence buffer
    sentenceBufferRef.current = '';

    setErrorMessage(''); // Clear any transient errors

  }, []); // Dependencies remain minimal

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
          />
          {/* --- End Render Simplified Voice Button --- */}

          {/* --- Render Separate Stop Speaking Button --- */}
          <button 
              className="control-button stop-speaking-button" 
              onClick={handleStopSpeaking}
              // Disable if not processing text OR speaking audio
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
            {isProcessing && conversationHistory[conversationHistory.length - 1]?.type === 'ai' && (
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