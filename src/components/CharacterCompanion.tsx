import React, { useState, useEffect } from 'react';

interface CharacterCompanionProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'excited';
  size?: number;
}

export default function CharacterCompanion({ state, size = 120 }: CharacterCompanionProps) {
  const [bounce, setBounce] = useState(false);
  const [eyes, setEyes] = useState('open');
  const [mouth, setMouth] = useState('smile');

  useEffect(() => {
    // Character expressions based on state
    switch (state) {
      case 'idle':
        setEyes('open');
        setMouth('smile');
        break;
      case 'listening':
        setEyes('focused');
        setMouth('open');
        // Add bounce effect when listening
        const bounceInterval = setInterval(() => {
          setBounce(true);
          setTimeout(() => setBounce(false), 500);
        }, 2000);
        return () => clearInterval(bounceInterval);
      case 'thinking':
        setEyes('thinking');
        setMouth('neutral');
        break;
      case 'speaking':
        setEyes('excited');
        setMouth('talking');
        // Talking animation
        const talkInterval = setInterval(() => {
          setMouth(prev => prev === 'talking' ? 'open' : 'talking');
        }, 300);
        return () => clearInterval(talkInterval);
      case 'excited':
        setEyes('excited');
        setMouth('big_smile');
        // Excited bounce
        setBounce(true);
        setTimeout(() => setBounce(false), 1000);
        break;
    }
  }, [state]);

  const getEyeStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      width: '12px',
      height: '12px',
      backgroundColor: '#2d3436',
      borderRadius: '50%',
      top: '30%',
    };

    switch (eyes) {
      case 'focused':
        return { ...baseStyle, transform: 'scaleY(0.3)' };
      case 'thinking':
        return { ...baseStyle, height: '2px', borderRadius: '2px' };
      case 'excited':
        return { ...baseStyle, transform: 'scale(1.2)', backgroundColor: '#ff6b6b' };
      default:
        return baseStyle;
    }
  };

  const getMouthStyle = () => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: '25%',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#2d3436',
      borderRadius: '20px',
    };

    switch (mouth) {
      case 'open':
        return { ...baseStyle, width: '20px', height: '15px', borderRadius: '50%' };
      case 'talking':
        return { ...baseStyle, width: '16px', height: '8px' };
      case 'big_smile':
        return { ...baseStyle, width: '25px', height: '12px', borderRadius: '0 0 20px 20px' };
      case 'neutral':
        return { ...baseStyle, width: '18px', height: '2px' };
      default:
        return { ...baseStyle, width: '18px', height: '8px', borderRadius: '0 0 10px 10px' };
    }
  };

  const getCharacterColor = () => {
    switch (state) {
      case 'listening':
        return 'linear-gradient(135deg, #95e1d3, #4ecdc4)';
      case 'thinking':
        return 'linear-gradient(135deg, #ffe66d, #ff9a3c)';
      case 'speaking':
        return 'linear-gradient(135deg, #ff6b6b, #ff8e8e)';
      case 'excited':
        return 'linear-gradient(135deg, #a8e6cf, #95e1d3)';
      default:
        return 'linear-gradient(135deg, #667eea, #764ba2)';
    }
  };

  return (
    <div
      className="character-companion"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        transition: 'all 0.3s ease',
        transform: bounce ? 'translateY(-10px)' : 'translateY(0)',
        animation: bounce ? 'characterBounce 0.5s ease-in-out' : 'none',
      }}
    >
      {/* Robot Body */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: getCharacterColor(),
          borderRadius: '30% 30% 40% 40%',
          position: 'relative',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)',
          border: '3px solid #ffffff',
        }}
      >
        {/* Eyes */}
        <div style={{ ...getEyeStyle(), left: '25%' }} />
        <div style={{ ...getEyeStyle(), left: '65%' }} />

        {/* Mouth */}
        <div style={getMouthStyle()} />

        {/* Antenna */}
        <div
          style={{
            position: 'absolute',
            top: '-15px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '4px',
            height: '15px',
            background: '#4ecdc4',
            borderRadius: '2px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '8px',
              height: '8px',
              background: '#ffe66d',
              borderRadius: '50%',
              animation: 'antennaGlow 2s ease-in-out infinite',
            }}
          />
        </div>

        {/* Cheeks (when excited) */}
        {state === 'excited' && (
          <>
            <div
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                background: '#ff6b6b',
                borderRadius: '50%',
                top: '45%',
                left: '15%',
                opacity: 0.6,
              }}
            />
            <div
              style={{
                position: 'absolute',
                width: '8px',
                height: '8px',
                background: '#ff6b6b',
                borderRadius: '50%',
                top: '45%',
                right: '15%',
                opacity: 0.6,
              }}
            />
          </>
        )}
      </div>

      {/* Floating elements when excited */}
      {state === 'excited' && (
        <>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '6px',
                height: '6px',
                background: ['#ffe66d', '#ff6b6b', '#4ecdc4'][i],
                borderRadius: '50%',
                animation: `float ${1 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                top: `${20 + i * 15}%`,
                left: `${80 + i * 10}%`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}