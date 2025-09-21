# Deployment to buddy.khamel.com

## Environment Setup

The application is configured to work with:
- **OpenRouter API**: Google Gemini 2.0 Flash (for AI responses)
- **OpenAI API**: Text-to-Speech
- **Domain**: buddy.khamel.com

## API Keys Configuration

Environment files are already created and configured (not in git):
- `.env.local` - for development
- `.env.production` - for production deployment

Both files contain:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_SITE_URL=https://buddy.khamel.com
```

Note: The actual API keys are already configured in the environment files but are not committed to git for security.

## Build Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start
```

## Features Ready for Your Son

✅ **Voice Interface**: Press talk button, speak, get both text and voice responses
✅ **Text Display**: All conversations shown in chat interface
✅ **No Echo/Feedback**: Simplified audio system prevents audio issues
✅ **Kid-Friendly**: Optimized for 6-year-old interactions
✅ **Reliable**: Simple, robust pipeline that works consistently

## Verification

The API endpoints are working:
- `/api/ask` - AI chat with Google Gemini 2.0 Flash
- `/api/tts` - Text-to-speech with OpenAI

Domain configured: buddy.khamel.com

Ready for production deployment!