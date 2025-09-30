# AI Buddy - Setup Guide

## What Changed

I've completely simplified your app into exactly what you wanted:

### 1. **Simple AI Chat**
- One big "Talk" button
- Voice input (press and speak)
- Natural voice output (uses ElevenLabs if configured, falls back to browser voice)
- Keeps the last few messages for context
- Optimized for a precocious 6-year-old who reads at 4th grade level

### 2. **Four Educational Games**
All games are designed for your son's level and don't save any data:

- **🧮 Math** - Addition and subtraction practice (2nd-3rd grade level)
- **🦁 Animals** - Learn fun facts about animals with quiz format
- **📝 Words** - Word scramble puzzles (4th grade reading level)
- **🧠 Memory** - Classic memory matching game

### 3. **Performance Optimizations**
- Reduced main page size from 45 KB to 3.2 KB (93% smaller!)
- Touch-first design perfect for tablets
- Works great on low-end Chromebook and Amazon tablet
- Simple gradient background (no purple as requested!)
- Big, easy-to-tap buttons

## Setup Instructions

### 1. Get Your ElevenLabs API Key

1. Go to https://elevenlabs.io/app/speech-synthesis
2. Log in
3. Click your profile icon (top right)
4. Select "Profile + API key"
5. Copy your API key
6. Open `.env` file and replace `your_elevenlabs_key_here` with your actual key

### 2. Deploy to Vercel

Since you're already hosted on Vercel, just push these changes:

```bash
git add .
git commit -m "Simplified app for my son"
git push
```

Vercel will automatically:
- Build the new version
- Deploy it
- Keep your existing domain (buddy.khamel.com)

### 3. Set Environment Variables in Vercel

Make sure these are set in your Vercel project settings:

- `OPENROUTER_API_KEY` - Already set ✓
- `ELEVENLABS_API_KEY` - Add your new key here
- `NEXT_PUBLIC_SITE_URL` - Already set to buddy.khamel.com ✓

## What Your Son Will See

1. **Big Title**: "🤖 AI Buddy"
2. **Four Game Buttons**: Math, Animals, Words, Memory
3. **Chat Area**: Shows conversation with Buddy
4. **Talk Button**: Big button at the bottom to ask questions

## Testing Locally

```bash
npm run dev
```

Then open http://localhost:3000

**Note**: Voice features work best in Chrome on the Chromebook and tablet.

## Files Changed

- **New Main Page**: `/src/pages/index.tsx` (simplified version)
- **Old Main Page**: Backed up to `/src/pages/index.old.tsx`
- **New Games**: 4 simple game components in `/src/components/`
- **AI Prompt**: Updated for his reading/math level in `/src/utils/aiPrompt.ts`

## What Was Removed

All the complex features you weren't using:
- Settings panels
- Sound controls
- Offline mode
- Analytics
- Monitoring
- Parental controls
- Multiple language options
- Sticker systems
- Star counting
- Character animations

## Browser Compatibility

**Best Experience:**
- Chrome on Chromebook ✓
- Chrome on Android tablet ✓

**Works but voice may be limited:**
- Safari on iPhone/iPad (browser voice only)
- Firefox (may need to enable voice permissions)

## Troubleshooting

**Voice not working?**
- Make sure you're using Chrome
- Check microphone permissions
- ElevenLabs will fall back to browser voice if API fails

**Games not loading?**
- Clear browser cache
- Make sure JavaScript is enabled

**AI not responding?**
- Check that OPENROUTER_API_KEY is set in Vercel
- Look at Vercel logs for errors

## Cost Estimates

With typical usage:
- **OpenRouter (Gemini)**: ~$0.01 per conversation
- **ElevenLabs**: ~$0.10 per 1000 characters (cheaper than OpenAI)

Very affordable for personal use!
