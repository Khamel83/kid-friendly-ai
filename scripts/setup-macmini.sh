#!/bin/bash
# Setup Mac Mini as local AI engine for Ramy's AI Buddy
# Usage: ssh macmini 'bash -s' < scripts/setup-macmini.sh
#
# What this does:
# 1. Updates Ollama to latest version
# 2. Pulls gemma4:e4b model (4.5B effective params, M4 optimized)
# 3. Installs Piper TTS + downloads 3 voice models
# 4. Creates Piper HTTP server with CORS
# 5. Sets up OLLAMA_ORIGINS for CORS on Ollama
# 6. Creates launchd services for auto-start

set -e

echo "=== Setting up Mac Mini as local AI engine for buddy.khamel.com ==="
echo ""

# 1. Update Ollama
echo "[1/5] Updating Ollama to latest version..."
curl -fsSL https://ollama.com/install.sh | sh
echo "  Done!"

# 2. Pull Gemma 4 E4B
echo ""
echo "[2/5] Pulling gemma4:e4b model (~9.6 GB, may take a few minutes)..."
ollama pull gemma4:e4b
echo "  Done!"

# 3. Install Piper TTS
echo ""
echo "[3/5] Installing Piper TTS..."
pip3 install --break-system-packages piper-tts fastapi uvicorn huggingface_hub 2>&1 | tail -1
echo "  Done!"

# 4. Download voice models
echo ""
echo "[4/5] Downloading Piper voice models..."
VOICES_DIR="$HOME/buddy-ai/voices"
mkdir -p "$VOICES_DIR"

python3 << 'PYEOF'
from huggingface_hub import hf_hub_download
import os, shutil

voices_dir = os.environ["VOICES_DIR"]
os.makedirs(voices_dir, exist_ok=True)

voice_configs = [
    ("en_US-lessac-medium", "en/en_US/lessac/medium/en_US-lessac-medium"),
    ("en_US-amy-medium", "en/en_US/amy/medium/en_US-amy-medium"),
    ("en_US-libritts_r-medium", "en/en_US/libritts_r/medium/en_US-libritts_r-medium"),
]

for voice_id, base_path in voice_configs:
    dest = os.path.join(voices_dir, voice_id)
    os.makedirs(dest, exist_ok=True)
    try:
        onnx = hf_hub_download("rhasspy/piper-voices", base_path + ".onnx")
        cfg = hf_hub_download("rhasspy/piper-voices", base_path + ".onnx.json")
        shutil.copy2(onnx, os.path.join(dest, voice_id + ".onnx"))
        shutil.copy2(cfg, os.path.join(dest, voice_id + ".onnx.json"))
        size_mb = os.path.getsize(os.path.join(dest, voice_id + ".onnx")) / 1024 / 1024
        print(f"  OK: {voice_id} ({size_mb:.1f} MB)")
    except Exception as e:
        print(f"  ERR: {voice_id}: {e}")
PYEOF
echo "  Done!"

# 5. Set up CORS for Ollama
echo ""
echo "[5/5] Configuring CORS and launchd services..."
echo ""

# Piper launchd service
PIPER_PLIST="$HOME/Library/LaunchAgents/com.khamel.buddy-piper.plist"
cat > "$PIPER_PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.khamel.buddy-piper</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/python3</string>
        <string>$HOME/buddy-ai/piper-server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$HOME/buddy-ai</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>PIPER_PORT</key>
        <string>8080</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/buddy-piper.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/buddy-piper.log</string>
</dict>
</plist>
PLISTEOF
launchctl load "$PIPER_PLIST" 2>/dev/null || true
echo "  Piper service: $PIPER_PLIST"

# Ollama CORS via login hook (sets env before GUI Ollama starts)
CORS_PLIST="$HOME/Library/LaunchAgents/com.khamel.set-ollama-cors.plist"
cat > "$CORS_PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.khamel.set-ollama-cors</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>launchctl setenv OLLAMA_ORIGINS *</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLISTEOF
launchctl load "$CORS_PLIST" 2>/dev/null || true
echo "  Ollama CORS hook: $CORS_PLIST"

# Also add to zshrc as fallback
grep -q "OLLAMA_ORIGINS" ~/.zshrc 2>/dev/null || echo 'export OLLAMA_ORIGINS="*"' >> ~/.zshrc
echo "  OLLAMA_ORIGINS added to ~/.zshrc"

# Copy piper-server.py to buddy-ai dir
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$SCRIPT_DIR/macmini/piper-server.py" ]; then
    cp "$SCRIPT_DIR/macmini/piper-server.py" "$HOME/buddy-ai/piper-server.py"
    echo "  Piper server copied to $HOME/buddy-ai/"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To start services now:"
echo "  OLLAMA_ORIGINS='*' /Applications/Ollama.app/Contents/MacOS/Ollama"
echo "  (or just open the Ollama app — CORS will be set on next login)"
echo ""
echo "  Piper: launchctl start com.khamel.buddy-piper"
echo ""
echo "To verify:"
echo "  curl -s -H 'Origin: https://buddy.khamel.com' http://localhost:11434/api/tags"
echo "  curl -s http://localhost:8080/voices"
echo ""
echo "Voices at: $VOICES_DIR"
echo "Logs at: $HOME/Library/Logs/buddy-{ollama,piper}.log"
