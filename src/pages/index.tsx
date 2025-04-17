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
  const eventSourceRef = useRef<EventSource | null>(null); // Ref to manage EventSource connection

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
    
    // Ensure EventSource is closed on unmount if active
    return () => {
        if (eventSourceRef.current) {
            console.log("Closing EventSource on unmount.");
            eventSourceRef.current.close();
            eventSourceRef.current = null;
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


  // --- Handle Text Stream from /api/ask ---
  const handleQuestionSubmit = (text: string) => { // Make synchronous
    if (!text || text.trim() === '') return;
    
    console.log('Submitting question:', text);
    // Stop any currently playing audio first
    handleStopSpeaking(); 
    
    addMessageToHistory('user', text);
    setIsProcessing(true); // Indicate processing starts (text streaming)
    setErrorMessage('');
    sentenceBufferRef.current = ''; // Clear sentence buffer
    ttsRequestQueueRef.current = []; // Clear TTS queue
    audioPlaybackQueueRef.current = []; // Clear audio queue
    
    // Add placeholder for AI response - it will be updated
    addMessageToHistory('ai', '', false); 

    // Close previous EventSource if it exists
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
    }

    const newEventSource = new EventSource(`/api/ask?question=${encodeURIComponent(text)}`);
    eventSourceRef.current = newEventSource; // Store ref

    let accumulatedResponse = '';

    newEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          accumulatedResponse += data.content;
          sentenceBufferRef.current += data.content;
          // Update the displayed text progressively
          addMessageToHistory('ai', accumulatedResponse, false); 

          // Check for sentences in the buffer
          const sentences = sentenceBufferRef.current.split(SENTENCE_END_REGEX);
          
          // If split results in more than one part, means we found sentence ends
          if (sentences.length > 1) {
            // Queue all complete sentences (parts before the last potential fragment)
            for (let i = 0; i < sentences.length - 1; i++) {
                // Re-add the delimiter if it exists and wasn't just whitespace
                const sentence = sentences[i].trim();
                const delimiter = sentences[i+1]?.match(/^s*([.?!])\s*/)?.[1]; // Find delimiter captured by regex if exists
                if (sentence) {
                    enqueueTtsRequest(sentence + (delimiter || '')); 
                }
                 // Increment i again because the delimiter was part of the next "sentence" from split
                 i++; 
            }
            // The last part is the remaining buffer
            sentenceBufferRef.current = sentences[sentences.length - 1];
          }
          
        } else if (data.type === 'done') {
          console.log('SSE stream finished.');
          // Queue any remaining text in the buffer as the last sentence
          enqueueTtsRequest(sentenceBufferRef.current); 
          sentenceBufferRef.current = ''; // Clear buffer
          
          newEventSource.close();
          eventSourceRef.current = null;
          setIsProcessing(false); // Text streaming is done
          // Mark the final AI message as complete (optional, depends on UI needs)
          // addMessageToHistory('ai', accumulatedResponse, true); 
          
        } else if (data.type === 'error') {
          console.error('SSE stream error:', data.content);
          setErrorMessage(data.content || 'An error occurred during streaming.');
          newEventSource.close();
          eventSourceRef.current = null;
          setIsProcessing(false);
          setConversationHistory(prev => prev.filter((msg) => !(msg.type === 'ai' && msg.text === ''))); // Clean up placeholder
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
        setErrorMessage('Error processing AI response.');
        newEventSource.close();
        eventSourceRef.current = null;
        setIsProcessing(false);
        setConversationHistory(prev => prev.filter((msg) => !(msg.type === 'ai' && msg.text === ''))); // Clean up placeholder
      }
    };

    newEventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
       // Avoid setting error if it was intentionally closed
      if (eventSourceRef.current) { 
         setErrorMessage('Connection to AI failed. Please try again.');
         eventSourceRef.current.close();
         eventSourceRef.current = null;
         setIsProcessing(false);
         setConversationHistory(prev => prev.filter((msg) => !(msg.type === 'ai' && msg.text === ''))); // Clean up placeholder
      }
    };
  };

  // --- Stop Speaking Handler (Updated) ---
  const handleStopSpeaking = useCallback(() => {
    console.log("Stop Speaking button clicked. Halting audio and queues.");

    // 1. Close the Server-Sent Event stream if active
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log("Closed EventSource connection.");
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

  }, []); // Dependencies: state setters if used directly, but refs are fine

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