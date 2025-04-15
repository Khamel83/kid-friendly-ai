import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import VoiceButton from '../components/VoiceButton';

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const speakingRef = useRef(false);
  const synth = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        synth.current = window.speechSynthesis;
        console.log('Available voices:', synth.current.getVoices());
      } catch (err) {
        console.error('Error initializing speech synthesis:', err);
        setErrorMessage('Speech synthesis is not available in this browser.');
      }
    }
    
    return () => {
      if (synth.current && utteranceRef.current) {
        synth.current.cancel();
      }
    };
  }, []);

  const handleQuestionSubmit = async (text: string) => {
    try {
      console.log('Submitting question:', text);
      setQuestion(text);
      setIsLoading(true);
      setErrorMessage('');
      
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: text }),
      });
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      setResponse(data.response);
      speakResponse(data.response);
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Oops! Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const speakResponse = (text: string) => {
    if (synth.current) {
      // Cancel any ongoing speech
      if (speakingRef.current) {
        synth.current.cancel();
      }
      
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Use a child-friendly voice if available
        const voices = synth.current.getVoices();
        console.log('Available voices:', voices);
        
        const kidVoice = voices.find(voice => 
          voice.name.includes('Kid') || 
          voice.name.includes('child') || 
          voice.name.includes('Junior')
        );
        
        if (kidVoice) {
          console.log('Using kid voice:', kidVoice.name);
          utterance.voice = kidVoice;
        } else {
          // Try to find a friendly female voice as fallback
          const femaleVoice = voices.find(voice => 
            voice.name.includes('Female') || 
            voice.name.includes('Girl') ||
            (!voice.name.includes('Male') && voice.lang.includes('en-US'))
          );
          
          if (femaleVoice) {
            console.log('Using female voice:', femaleVoice.name);
            utterance.voice = femaleVoice;
          }
        }
        
        // Slightly slower speech rate for clarity
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        
        utterance.onstart = () => {
          console.log('Speech started');
          speakingRef.current = true;
        };
        
        utterance.onend = () => {
          console.log('Speech ended');
          speakingRef.current = false;
        };
        
        utterance.onerror = (event) => {
          console.error('Speech error:', event);
          speakingRef.current = false;
        };
        
        utteranceRef.current = utterance;
        synth.current.speak(utterance);
      } catch (err) {
        console.error('Error in speech synthesis:', err);
        setErrorMessage('Could not read the response aloud. Please try again.');
      }
    } else {
      setErrorMessage('Speech synthesis is not available in this browser.');
    }
  };

  const handleStopSpeaking = () => {
    if (synth.current && speakingRef.current) {
      synth.current.cancel();
      speakingRef.current = false;
    }
  };

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
          
          {!isListening && !isLoading && !response && (
            <p className="instructions">
              Tap the button and ask your question!
            </p>
          )}
          
          <VoiceButton 
            onResult={handleQuestionSubmit} 
            isListening={isListening}
            setIsListening={setIsListening}
          />
          
          {isLoading && (
            <div className="loading">
              <div className="loading-animation">
                <div></div><div></div><div></div><div></div>
              </div>
              <p>Thinking...</p>
            </div>
          )}
          
          {errorMessage && (
            <div className="error-container">
              <p>{errorMessage}</p>
            </div>
          )}
          
          {response && !isLoading && (
            <div className="response-container">
              {question && <p className="question">"{question}"</p>}
              <div className="response-content">
                <p>{response}</p>
              </div>
              {speakingRef.current && (
                <button 
                  className="stop-button" 
                  onClick={handleStopSpeaking}
                >
                  Stop Speaking
                </button>
              )}
              <button 
                className="reset-button"
                onClick={() => {
                  setQuestion('');
                  setResponse('');
                  handleStopSpeaking();
                }}
              >
                Ask Another Question
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 