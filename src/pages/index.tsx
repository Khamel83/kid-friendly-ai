import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import SimpleMathGame from '../components/SimpleMathGame';
import SimpleAnimalQuiz from '../components/SimpleAnimalQuiz';
import SimpleWordGame from '../components/SimpleWordGame';
import SimpleMemoryGame from '../components/SimpleMemoryGame';

interface Message {
  type: 'user' | 'ai';
  text: string;
}

export default function SimplePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');

  const [showMath, setShowMath] = useState(false);
  const [showAnimal, setShowAnimal] = useState(false);
  const [showWord, setShowWord] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleQuestion(transcript);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);

          if (event.error === 'no-speech') {
            setError('Didn\'t hear anything. Try again!');
          } else if (event.error === 'not-allowed') {
            setError('Please allow microphone access!');
          } else {
            setError('Oops! Try again!');
          }
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startListening = async () => {
    if (!recognitionRef.current) {
      setError('Voice not supported in this browser. Try Chrome!');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setError('');
      setIsListening(true);
      recognitionRef.current.start();
    } catch (err) {
      console.error('Microphone permission error:', err);
      setError('Please allow microphone access!');
      setIsListening(false);
    }
  };

  const handleQuestion = async (question: string) => {
    setMessages(prev => [...prev, { type: 'user', text: question }]);
    setError('');

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          conversationHistory: messages.slice(-4).map(m => ({
            speaker: m.type,
            text: m.text
          }))
        })
      });

      if (!response.ok) throw new Error('Network error');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponse = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data:')) {
              const data = line.substring(5).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'chunk' && parsed.content) {
                  aiResponse += parsed.content;
                }
              } catch (e) {}
            }
          }
        }
      }

      if (aiResponse) {
        setMessages(prev => [...prev, { type: 'ai', text: aiResponse }]);
        speakText(aiResponse);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Try again!');
    }
  };

  const speakText = async (text: string) => {
    setIsSpeaking(true);

    try {
      const response = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (response.ok && audioContextRef.current) {
        const audioData = await response.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);

        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 0.9;
          utterance.pitch = 1.1;
          utterance.onend = () => setIsSpeaking(false);
          speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  return (
    <>
      <Head>
        <title>AI Buddy</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div className="app">
        <div className="header">
          <h1 className="title">🤖 AI Buddy</h1>
        </div>

        <div className="games-grid">
          <button className="game-card math" onClick={() => setShowMath(true)}>
            <div className="game-icon">🧮</div>
            <div className="game-name">Math</div>
          </button>

          <button className="game-card animal" onClick={() => setShowAnimal(true)}>
            <div className="game-icon">🦁</div>
            <div className="game-name">Animals</div>
          </button>

          <button className="game-card word" onClick={() => setShowWord(true)}>
            <div className="game-icon">📝</div>
            <div className="game-name">Words</div>
          </button>

          <button className="game-card memory" onClick={() => setShowMemory(true)}>
            <div className="game-icon">🧠</div>
            <div className="game-name">Memory</div>
          </button>
        </div>

        <div className="chat-container">
          <div className="messages">
            {messages.length === 0 && (
              <div className="welcome">
                Press the button and ask me anything! 👋
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.type}`}>
                <div className="message-label">{msg.type === 'user' ? 'You' : 'Buddy'}</div>
                <div className="message-text">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="controls">
            <button
              className={`talk-button ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}
              onClick={startListening}
              disabled={isListening || isSpeaking}
            >
              {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : '🎤 Talk'}
            </button>
          </div>
        </div>

        {showMath && <SimpleMathGame onClose={() => setShowMath(false)} />}
        {showAnimal && <SimpleAnimalQuiz onClose={() => setShowAnimal(false)} />}
        {showWord && <SimpleWordGame onClose={() => setShowWord(false)} />}
        {showMemory && <SimpleMemoryGame onClose={() => setShowMemory(false)} />}
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .header {
          text-align: center;
          margin-bottom: 24px;
        }

        .title {
          font-size: 48px;
          color: white;
          margin: 0;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
        }

        .games-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .game-card {
          background: white;
          border: none;
          border-radius: 20px;
          padding: 24px;
          cursor: pointer;
          transition: transform 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .game-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }

        .game-card:active {
          transform: translateY(-2px);
        }

        .game-icon {
          font-size: 48px;
          margin-bottom: 8px;
        }

        .game-name {
          font-size: 20px;
          font-weight: bold;
          color: #2c3e50;
        }

        .chat-container {
          background: white;
          border-radius: 24px;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .messages {
          max-height: 400px;
          overflow-y: auto;
          margin-bottom: 20px;
          padding-right: 8px;
        }

        .welcome {
          text-align: center;
          font-size: 24px;
          color: #7f8c8d;
          padding: 40px 20px;
        }

        .message {
          margin-bottom: 16px;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message-label {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
          color: #7f8c8d;
        }

        .message.user .message-label {
          color: #3498db;
        }

        .message.ai .message-label {
          color: #e74c3c;
        }

        .message-text {
          background: #f8f9fa;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 16px;
          line-height: 1.5;
        }

        .message.user .message-text {
          background: #e3f2fd;
        }

        .message.ai .message-text {
          background: #fce4ec;
        }

        .error {
          background: #fff3cd;
          color: #856404;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          text-align: center;
        }

        .controls {
          display: flex;
          justify-content: center;
        }

        .talk-button {
          padding: 20px 48px;
          font-size: 24px;
          font-weight: bold;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 16px;
          cursor: pointer;
          transition: transform 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .talk-button:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .talk-button:active:not(:disabled) {
          transform: scale(0.98);
        }

        .talk-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .talk-button.listening {
          animation: pulse 1.5s ease-in-out infinite;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .talk-button.speaking {
          animation: pulse 1.5s ease-in-out infinite;
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @media (max-width: 600px) {
          .title {
            font-size: 36px;
          }

          .games-grid {
            gap: 12px;
          }

          .game-card {
            padding: 20px;
          }

          .game-icon {
            font-size: 36px;
          }

          .game-name {
            font-size: 16px;
          }

          .chat-container {
            padding: 16px;
          }

          .messages {
            max-height: 300px;
          }

          .talk-button {
            padding: 16px 32px;
            font-size: 20px;
          }
        }
      `}</style>
    </>
  );
}
