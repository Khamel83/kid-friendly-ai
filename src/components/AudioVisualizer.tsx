/**
 * Enhanced Audio Visualizer Component
 * Provides real-time audio visualization with child-friendly animations
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { AccessibilityUtils } from '../utils/accessibility';

interface AudioVisualizationData {
  frequencyData: Float32Array;
  audioLevel: number;
  isVoiceActive: boolean;
  peakLevel: number;
}

interface AudioVisualizerProps {
  audioData: AudioVisualizationData;
  isRecording: boolean;
  isVoiceActive: boolean;
  audioLevel: number;
  theme?: 'light' | 'dark' | 'auto';
  compact?: boolean;
  showWaveform?: boolean;
  showFrequency?: boolean;
  showLevel?: boolean;
  animated?: boolean;
  colorScheme?: 'rainbow' | 'blue' | 'green' | 'purple' | 'orange';
  sensitivity?: number;
  smoothing?: number;
  maxFrequency?: number;
  barWidth?: number;
  gap?: number;
  className?: string;
}

interface VisualizerColors {
  background: string;
  foreground: string;
  accent: string;
  warning: string;
  success: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioData,
  isRecording,
  isVoiceActive,
  audioLevel,
  theme = 'auto',
  compact = false,
  showWaveform = true,
  showFrequency = true,
  showLevel = true,
  animated = true,
  colorScheme = 'blue',
  sensitivity = 1.0,
  smoothing = 0.8,
  maxFrequency = 4000,
  barWidth = 4,
  gap = 2,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const previousData = useRef<Float32Array>();
  const frameCount = useRef(0);

  // Get color scheme
  const colors = useMemo<VisualizerColors>(() => {
    const isDark = theme === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme === 'dark';

    const baseColors = {
      rainbow: {
        background: isDark ? '#1a1a1a' : '#f0f0f0',
        foreground: isDark ? '#ffffff' : '#000000',
        accent: '#ff6b6b',
        warning: '#ffd93d',
        success: '#6bcf7f'
      },
      blue: {
        background: isDark ? '#0f1419' : '#e3f2fd',
        foreground: isDark ? '#ffffff' : '#1565c0',
        accent: '#2196f3',
        warning: '#ffc107',
        success: '#4caf50'
      },
      green: {
        background: isDark ? '#0d2818' : '#e8f5e8',
        foreground: isDark ? '#ffffff' : '#2e7d32',
        accent: '#4caf50',
        warning: '#ff9800',
        success: '#66bb6a'
      },
      purple: {
        background: isDark ? '#1a0f1f' : '#f3e5f5',
        foreground: isDark ? '#ffffff' : '#6a1b9a',
        accent: '#9c27b0',
        warning: '#ff5722',
        success: '#ab47bc'
      },
      orange: {
        background: isDark ? '#1a0f05' : '#fff3e0',
        foreground: isDark ? '#ffffff' : '#e65100',
        accent: '#ff9800',
        warning: '#f44336',
        success: '#ffb74d'
      }
    };

    return baseColors[colorScheme];
  }, [theme, colorScheme]);

  // Smooth audio data
  const smoothData = useCallback((data: Float32Array): Float32Array => {
    if (!previousData.current) {
      previousData.current = new Float32Array(data.length);
    }

    const smoothed = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      smoothed[i] = smoothing * previousData.current[i] + (1 - smoothing) * data[i];
    }

    previousData.current = smoothed;
    return smoothed;
  }, [smoothing]);

  // Draw waveform
  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: Float32Array) => {
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    ctx.beginPath();
    ctx.strokeStyle = colors.foreground;
    ctx.lineWidth = 2;

    const step = Math.max(1, Math.floor(data.length / width));
    let x = 0;

    for (let i = 0; i < data.length; i += step) {
      const y = centerY + (data[i] * height * 0.4);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += Math.ceil(width / (data.length / step));
    }

    ctx.stroke();

    // Add glow effect when voice is active
    if (isVoiceActive && animated) {
      ctx.shadowColor = colors.accent;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [colors.foreground, colors.accent, isVoiceActive, animated]);

  // Draw frequency bars
  const drawFrequencyBars = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: Float32Array) => {
    const width = canvas.width;
    const height = canvas.height;
    const barTotalWidth = barWidth + gap;
    const numBars = Math.floor(width / barTotalWidth);

    // Calculate frequency range
    const nyquist = 8000; // Assuming 16kHz sample rate
    const maxBin = Math.floor((maxFrequency / nyquist) * data.length);
    const step = Math.floor(maxBin / numBars);

    for (let i = 0; i < numBars; i++) {
      const dataIndex = i * step;
      if (dataIndex >= data.length) break;

      const magnitude = data[dataIndex] * sensitivity;
      const barHeight = Math.min(height * 0.8, magnitude * height);

      const x = i * barTotalWidth;
      const y = height - barHeight;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, y, 0, height);
      if (isVoiceActive) {
        gradient.addColorStop(0, colors.success);
        gradient.addColorStop(0.5, colors.accent);
        gradient.addColorStop(1, colors.warning);
      } else {
        gradient.addColorStop(0, colors.foreground);
        gradient.addColorStop(1, colors.foreground + '40');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Add rounded corners
      ctx.beginPath();
      ctx.arc(x + barWidth / 2, y, barWidth / 2, 0, Math.PI, true);
      ctx.fill();
    }
  }, [barWidth, gap, maxFrequency, sensitivity, colors.success, colors.accent, colors.warning, colors.foreground, isVoiceActive]);

  // Draw circular visualizer
  const drawCircularVisualizer = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, data: Float32Array) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.6;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = colors.foreground + '20';
    ctx.lineWidth = 2;
    ctx.stroke();

    const angleStep = (2 * Math.PI) / data.length;

    for (let i = 0; i < data.length; i++) {
      const angle = i * angleStep;
      const magnitude = data[i] * sensitivity;
      const barLength = magnitude * radius * 0.5;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barLength);
      const y2 = centerY + Math.sin(angle) * (radius + barLength);

      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, colors.accent);
      gradient.addColorStop(1, colors.success);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [sensitivity, colors.accent, colors.success, colors.foreground]);

  // Draw audio level meter
  const drawLevelMeter = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, level: number) => {
    const width = canvas.width;
    const height = canvas.height;
    const meterHeight = height * 0.8;
    const meterWidth = 20;
    const x = width - meterWidth - 10;
    const y = (height - meterHeight) / 2;

    // Background
    ctx.fillStyle = colors.foreground + '20';
    ctx.fillRect(x, y, meterWidth, meterHeight);

    // Level bar
    const levelHeight = level * meterHeight * sensitivity;
    const levelY = y + meterHeight - levelHeight;

    const gradient = ctx.createLinearGradient(0, levelY, 0, y + meterHeight);
    if (level < 0.7) {
      gradient.addColorStop(0, colors.success);
    } else if (level < 0.9) {
      gradient.addColorStop(0, colors.warning);
    } else {
      gradient.addColorStop(0, colors.warning);
      gradient.addColorStop(1, '#ff4444');
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(x, levelY, meterWidth, levelHeight);

    // Border
    ctx.strokeStyle = colors.foreground;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, meterWidth, meterHeight);

    // Level text
    ctx.fillStyle = colors.foreground;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(level * 100)}%`, x + meterWidth / 2, y - 5);
  }, [sensitivity, colors.success, colors.warning, colors.foreground]);

  // Draw particles for voice activity
  const drawParticles = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, audioLevel: number) => {
    if (!isVoiceActive || !animated) return;

    const particleCount = Math.floor(audioLevel * 20);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    for (let i = 0; i < particleCount; i++) {
      const angle = (frameCount.current * 0.02 + i * Math.PI * 2 / particleCount) % (2 * Math.PI);
      const radius = 50 + audioLevel * 100;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const size = 2 + audioLevel * 6;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = colors.accent + Math.floor((1 - audioLevel) * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }, [isVoiceActive, animated, colors.accent]);

  // Main drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isRecording) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply smoothing to audio data
    const smoothedData = smoothData(audioData.frequencyData);

    // Draw background
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    // Draw visualization components
    if (showWaveform) {
      drawWaveform(ctx, canvas, smoothedData);
    }

    if (showFrequency) {
      if (compact) {
        drawFrequencyBars(ctx, canvas, smoothedData);
      } else {
        drawCircularVisualizer(ctx, canvas, smoothedData);
      }
    }

    if (showLevel) {
      drawLevelMeter(ctx, canvas, audioLevel);
    }

    // Draw particles for active voice
    if (animated) {
      drawParticles(ctx, canvas, audioLevel);
    }

    frameCount.current++;

    // Continue animation
    if (animated) {
      animationRef.current = requestAnimationFrame(draw);
    }
  }, [
    isRecording,
    audioData,
    audioLevel,
    showWaveform,
    showFrequency,
    showLevel,
    animated,
    compact,
    colors.background,
    drawWaveform,
    drawFrequencyBars,
    drawCircularVisualizer,
    drawLevelMeter,
    drawParticles,
    smoothData
  ]);

  // Handle canvas resize
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  // Set up canvas and animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    handleResize();

    if (isRecording && animated) {
      animationRef.current = requestAnimationFrame(draw);
    }

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [isRecording, animated, draw, handleResize]);

  // Redraw when data changes (if not animated)
  useEffect(() => {
    if (!animated && isRecording) {
      draw();
    }
  }, [audioData, audioLevel, isRecording, animated, draw]);

  // Get accessibility props
  const getAccessibilityProps = () => {
    return {
      role: 'img',
      'aria-label': isRecording
        ? `Audio visualizer - ${isVoiceActive ? 'voice detected' : 'listening'} - ${Math.round(audioLevel * 100)}% volume`
        : 'Audio visualizer - inactive',
      'aria-live': isRecording ? 'polite' : 'off',
      'aria-busy': isRecording
    };
  };

  if (compact && !isRecording) {
    return null;
  }

  return (
    <div className={`audio-visualizer ${className} ${compact ? 'compact' : ''} ${isRecording ? 'active' : 'inactive'}`}>
      <canvas
        ref={canvasRef}
        className="visualizer-canvas"
        {...getAccessibilityProps()}
        style={{
          width: '100%',
          height: compact ? '60px' : '120px',
          borderRadius: '8px',
          background: colors.background
        }}
      />

      {/* Accessibility fallback content */}
      <div className="sr-only" aria-hidden="true">
        {isRecording && (
          <div>
            <p>Recording status: Active</p>
            <p>Voice activity: {isVoiceActive ? 'Detected' : 'Not detected'}</p>
            <p>Audio level: {Math.round(audioLevel * 100)}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioVisualizer;