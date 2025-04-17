import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import VoiceButton from '../components/VoiceButton';

interface Message {
  type: 'user' | 'ai';
  text: string;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Loading AI response
  const [isSpeaking, setIsSpeaking] = useState(false); // AI is speaking
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Refs for audio playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Initialize AudioContext on mount
  useEffect(() => {
    // Ensure AudioContext is created only once and in the browser
    if (typeof window !== 'undefined' && !audioContextRef.current) {
       try {
         audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
         console.log('AudioContext initialized for playback.');
       } catch (err) {
         console.error('Error initializing AudioContext:', err);
         setErrorMessage('Web Audio API is not available in this browser.');
       }
    }
    
    // Cleanup audio source on unmount
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }
      // Optionally close the context, or keep it alive for reuse
      // if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      //   audioContextRef.current.close();
      // }
    };
  }, []);

  // Function to add a message to the history
  const addMessageToHistory = useCallback((type: 'user' | 'ai', text: string) => {
    setConversationHistory(prev => [...prev, { type, text }]);
  }, []);

  const handleQuestionSubmit = async (text: string) => {
    if (!text || text.trim() === '') return;
    
    console.log('Submitting question:', text);
    addMessageToHistory('user', text);
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: text }),
      });
      
      // --- Robust Error Handling --- 
      if (!response.ok) {
        let errorMsg = `API Error: ${response.status} ${response.statusText}`;
        // Try to parse error JSON, but don't hard error if it fails (common for HTML error pages)
        try {
          const errorData = await response.json(); 
          errorMsg = errorData.error || errorMsg; // Use specific error if available
        } catch (jsonError) { 
          // Intentionally ignore JSON parse error here, use status text
          console.log(`Response from /api/ask was not JSON (status: ${response.status}). Using status text as error.`); 
        }
        throw new Error(errorMsg);
      }
      // --- End Robust Error Handling ---

      const data = await response.json();
      console.log('API response:', data);
      
      addMessageToHistory('ai', data.response);
      playAiAudio(data.response); // Call new function to play OpenAI TTS
      
    } catch (error) {
      console.error('Error submitting question or getting response:', error);
      const message = error instanceof Error ? error.message : 'Oops! Something went wrong.';
      setErrorMessage(message); 
      // Optionally add error message to history
      // addMessageToHistory('ai', `Error: ${message}`); 
    } finally {
      setIsLoading(false);
    }
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
    <div className="container">
      <Head>
        <title>Kid-Friendly AI Buddy</title>
        <meta name="description" content="A simple, kid-friendly AI assistant" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="main">
        <div className="app-container">
          <h1 className="title">Ask Me Anything!</h1>
          
          {/* Chat History Display */}
          <div className="chat-history">
            {conversationHistory.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.type}`}>
                <p>{msg.text}</p>
              </div>
            ))}
            {isLoading && (
                <div className="chat-message ai loading-dots">
                    <span></span><span></span><span></span>
                </div>
            )}
          </div>
          
          {/* Voice Button and Status */}
          <div className="controls-container">
            <VoiceButton 
              onResult={handleQuestionSubmit} 
              isListening={isListening}
              setIsListening={setIsListening}
            />
          
            {errorMessage && (
              <div className="error-container">
                <p>{errorMessage}</p>
              </div>
            )}

            {isSpeaking && (
                <button 
                    className="stop-button" 
                    onClick={handleStopSpeaking}
                >
                    Stop Speaking
                </button>
            )}
          </div>

        </div>
      </main>
    </div>
  );
} 