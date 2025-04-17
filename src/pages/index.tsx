import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import VoiceButton from '../components/VoiceButton';

interface Message {
  type: 'user' | 'ai';
  text: string;
}

const SESSION_STORAGE_KEY = 'kidFriendlyAiHistory';

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading AI response
  const [isSpeaking, setIsSpeaking] = useState(false); // AI is speaking
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentAiResponse, setCurrentAiResponse] = useState(''); // State for streaming response
  
  // Refs for audio playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize AudioContext & Load History AFTER mount
  useEffect(() => {
    // --- Audio Context Init --- 
    if (typeof window !== 'undefined' && !audioContextRef.current) {
       try {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
         console.log('AudioContext initialized for playback.');
       } catch (err) {
         console.error('Error initializing AudioContext:', err);
         setErrorMessage('Web Audio API is not available in this browser.');
       }
    }
    // --- End Audio Context Init --- 
    
    // --- Load history from sessionStorage ONCE on client mount --- 
    try {
      const storedHistory = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (storedHistory) {
        setConversationHistory(JSON.parse(storedHistory));
        console.log('Loaded conversation history from sessionStorage.');
      }
    } catch (error) {
      console.error('Error reading conversation history from sessionStorage:', error);
      // Keep the initial empty state if loading fails
    }
    // --- End Load history --- 
    
    // Cleanup audio source on unmount (keep this)
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once after mount

  // Save history to sessionStorage on change (keep this)
  useEffect(() => {
    try {
      // Only save if history is not the initial empty array
      if (conversationHistory.length > 0) { 
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(conversationHistory));
      } else {
        // Clear storage if history becomes empty
         sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving conversation history to sessionStorage:', error);
    }
  }, [conversationHistory]);

  const addMessageToHistory = useCallback((type: 'user' | 'ai', text: string) => {
    // --- Modify to handle partial AI message update ---
    setConversationHistory(prev => {
      // If the last message was AI and we are adding AI, update it
      if (type === 'ai' && prev.length > 0 && prev[prev.length - 1].type === 'ai') {
        const updatedHistory = [...prev];
        updatedHistory[updatedHistory.length - 1].text = text;
        return updatedHistory;
      }
      // Otherwise, add a new message
      return [...prev, { type, text }];
    });
    // --- End Modify --- 
  }, []);

  const handleQuestionSubmit = async (text: string) => {
    if (!text || text.trim() === '') return;
    
    console.log('Submitting question:', text);
    addMessageToHistory('user', text);
    setIsLoading(true);
    setErrorMessage('');
    setCurrentAiResponse(''); // Clear previous partial response
    addMessageToHistory('ai', ''); // Add placeholder for AI response
    
    // --- Use EventSource for Streaming --- 
    const eventSource = new EventSource(`/api/ask?question=${encodeURIComponent(text)}`); // Send question via query param
    let accumulatedResponse = '';

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          accumulatedResponse += data.content;
          setCurrentAiResponse(accumulatedResponse); // Update intermediate state
          addMessageToHistory('ai', accumulatedResponse); // Update history progressively
        } else if (data.type === 'done') {
          console.log('SSE stream finished.');
          eventSource.close();
          setIsLoading(false);
          // Trigger TTS with the final accumulated response
          playAiAudio(accumulatedResponse);
        } else if (data.type === 'error') {
          console.error('SSE stream error:', data.content);
          setErrorMessage(data.content || 'An error occurred during streaming.');
          eventSource.close();
          setIsLoading(false);
           // Remove the empty AI placeholder message on error
          setConversationHistory(prev => prev.filter((_, i) => i !== prev.length -1 || prev[prev.length-1].type !== 'ai' || prev[prev.length-1].text !== ''));
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
        setErrorMessage('Error processing AI response.');
        eventSource.close();
        setIsLoading(false);
        // Remove the empty AI placeholder message on error
        setConversationHistory(prev => prev.filter((_, i) => i !== prev.length -1 || prev[prev.length-1].type !== 'ai' || prev[prev.length-1].text !== ''));
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      setErrorMessage('Connection to AI failed. Please try again.');
      eventSource.close();
      setIsLoading(false);
      // Remove the empty AI placeholder message on error
      setConversationHistory(prev => prev.filter((_, i) => i !== prev.length -1 || prev[prev.length-1].type !== 'ai' || prev[prev.length-1].text !== ''));
    };
    // --- End EventSource Logic ---
  };

  const playAiAudio = async (text: string) => {
    if (!text || !audioContextRef.current) return;

    // Stop any currently playing audio
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    setIsSpeaking(true);
    setErrorMessage(''); // Clear previous errors

    try {
      console.log('Requesting TTS audio for:', text.substring(0,50)+"...");
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || !response.body) {
         let errorMsg = `TTS API Error: ${response.status} ${response.statusText}`;
          try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
          } catch (jsonError) {
              console.error('Failed to parse TTS error JSON', jsonError);
          }
         throw new Error(errorMsg);
      }

      console.log('Received TTS audio stream.');
      const audioData = await response.arrayBuffer();
      console.log('TTS audio data length:', audioData.byteLength);

      if (!audioContextRef.current) {
         throw new Error("AudioContext is not available");
      }
      
      // Ensure context is running (might be suspended on page load)
      if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
      }
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      console.log('Decoded audio buffer duration:', audioBuffer.duration);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        console.log('OpenAI TTS playback finished.');
        setIsSpeaking(false);
        source.disconnect();
        sourceNodeRef.current = null;
      };
      source.start();
      sourceNodeRef.current = source; // Store reference to the playing source

    } catch (error) {
      console.error('Error playing AI audio:', error);
      const message = error instanceof Error ? error.message : 'Failed to play audio response.';
      setErrorMessage(message);
      setIsSpeaking(false); // Ensure speaking state is reset on error
    }
  };

  // Function to stop audio playback manually (optional)
  const handleStopSpeaking = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop(); // This triggers the onended event
    }
  }, []);

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
              disabled={!isSpeaking} // Only enable when speaking
              aria-label="Stop Speaking"
          >
              Stop Speaking
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
            {conversationHistory.length === 0 && !isLoading && (
                <p className="empty-chat-message">Press the green 'Talk' button to start!</p>
            )}
            {conversationHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.type}`}>
                <span className="chat-label">{msg.type === 'user' ? 'You:' : 'Buddy:'}</span>
                <p>{msg.text}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
} 