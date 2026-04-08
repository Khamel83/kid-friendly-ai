"""
Piper TTS HTTP server with CORS support for buddy.khamel.com.

Run on Mac Mini alongside Ollama to provide local text-to-speech
with multiple voice options.

Usage:
    pip install piper-tts fastapi uvicorn
    python3 piper-server.py

Voices are loaded from ./voices/ directory.
Download voices from: https://huggingface.co/rhasspy/piper-voices

Voice structure:
    voices/
      en_US-lessac-medium/
        en_US-lessac-medium.onnx
        en_US-lessac-medium.onnx.json
      en_US-amy-medium/
        ...
"""

import json
import io
import wave
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Buddy Piper TTS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

VOICES_DIR = Path(__file__).parent / "voices"
DEFAULT_VOICE = "en_US-lessac-medium"

# Cache loaded voice models
voice_cache: dict = {}


def load_voice(voice_name: str):
    """Load a Piper voice model (cached after first load)."""
    if voice_name in voice_cache:
        return voice_cache[voice_name]

    from piper import PiperVoice

    voice_dir = VOICES_DIR / voice_name
    if not voice_dir.exists():
        raise FileNotFoundError(f"Voice '{voice_name}' not found in {VOICES_DIR}")

    # Find .onnx and .onnx.json files
    onnx_files = list(voice_dir.glob("*.onnx"))
    if not onnx_files:
        raise FileNotFoundError(f"No .onnx file found for voice '{voice_name}'")

    config_files = list(voice_dir.glob("*.onnx.json"))
    if not config_files:
        raise FileNotFoundError(f"No config file found for voice '{voice_name}'")

    voice = PiperVoice.load(str(onnx_files[0]), str(config_files[0]))
    voice_cache[voice_name] = voice
    print(f"Loaded voice: {voice_name}")
    return voice


@app.get("/voices")
async def list_voices():
    """List available voice names."""
    if not VOICES_DIR.exists():
        return {"voices": []}

    voices = []
    for d in sorted(VOICES_DIR.iterdir()):
        if d.is_dir() and any(f.suffix == '.onnx' for f in d.iterdir()):
            voices.append(d.name)
    return {"voices": voices, "default": DEFAULT_VOICE}


@app.post("/")
async def synthesize(request: Request):
    """Synthesize text to speech using Piper."""
    try:
        body = await request.json()
    except Exception:
        return Response(
            content=json.dumps({"error": "Invalid JSON body"}),
            status_code=400,
            media_type="application/json",
        )

    text = body.get("text", "")
    voice_name = body.get("voice", DEFAULT_VOICE)

    if not text.strip():
        return Response(
            content=json.dumps({"error": "Text is required"}),
            status_code=400,
            media_type="application/json",
        )

    try:
        voice = load_voice(voice_name)
    except FileNotFoundError as e:
        return Response(
            content=json.dumps({"error": str(e)}),
            status_code=404,
            media_type="application/json",
        )

    import asyncio

    # Generate WAV audio in a thread to avoid blocking
    def generate():
        audio_chunks = list(voice.synthesize(text))
        if not audio_chunks:
            return b''

        # Get sample rate and format from first chunk
        sample_rate = getattr(audio_chunks[0], 'sample_rate', 22050)
        channels = getattr(audio_chunks[0], 'sample_channels', 1)
        width = getattr(audio_chunks[0], 'sample_width', 2)

        # Build WAV file in memory
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(width)
            wf.setframerate(sample_rate)

            for chunk in audio_chunks:
                raw = chunk.audio_int16_bytes
                if raw:
                    wf.writeframes(raw)

        buf.seek(0)
        return buf.getvalue()

    loop = asyncio.get_event_loop()
    audio_data = await loop.run_in_executor(None, generate)

    return Response(content=audio_data, media_type="audio/wav")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "piper-tts", "voices_loaded": list(voice_cache.keys())}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PIPER_PORT", "8080"))
    print(f"Starting Piper TTS server on port {port}...")
    print(f"Voices directory: {VOICES_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=port)
