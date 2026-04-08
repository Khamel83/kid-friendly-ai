const MACMINI_PIPER_URL = 'http://macmini.local:8080';

export interface TTSSynthesizeOptions {
  text: string;
  voice?: string;
  mode: 'local' | 'cloud';
}

/**
 * Synthesize speech either from Mac Mini Piper (local) or Vercel /api/tts (cloud).
 * Returns a Blob of audio data.
 */
export async function synthesizeSpeech(options: TTSSynthesizeOptions): Promise<Blob> {
  const { text, voice, mode } = options;

  if (mode === 'local') {
    return synthesizeLocal(text, voice || 'en_US-lessac-medium');
  } else {
    return synthesizeCloud(text, voice);
  }
}

async function synthesizeLocal(text: string, voice: string): Promise<Blob> {
  const response = await fetch(MACMINI_PIPER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error(`Piper TTS error: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function synthesizeCloud(text: string, voice?: string): Promise<Blob> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    throw new Error(`Cloud TTS error: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Blob([arrayBuffer], { type: 'audio/mpeg' });
}

/**
 * Available voices per mode.
 */
export const LOCAL_VOICES = [
  { id: 'en_US-lessac-medium', name: 'Buddy', description: 'Friendly and clear' },
  { id: 'en_US-amy-medium', name: 'Amy', description: 'Upbeat and friendly' },
  { id: 'en_US-jenny_dioco-medium', name: 'Jenny', description: 'Warm and gentle' },
  { id: 'en_US-libritts_r-medium', name: 'Sam', description: 'Calm and steady' },
  { id: 'en_US-glados', name: 'Robot', description: 'Fun robot voice' },
] as const;

export const CLOUD_VOICES = [
  { id: 'shimmer', name: 'Shimmer', description: 'Soft and clear' },
  { id: 'nova', name: 'Nova', description: 'Warm and friendly' },
  { id: 'alloy', name: 'Alloy', description: 'Neutral and balanced' },
  { id: 'echo', name: 'Echo', description: 'Clear and direct' },
  { id: 'fable', name: 'Fable', description: 'Storyteller voice' },
] as const;

export type VoiceId = typeof LOCAL_VOICES[number]['id'] | typeof CLOUD_VOICES[number]['id'];
