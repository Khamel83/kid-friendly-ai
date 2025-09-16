# Kid-Friendly AI Assistant 🤖✨

A super fun and interactive AI companion designed specifically for kids! This engaging web application combines voice interaction with playful animations, games, and rewards to make learning an adventure.

## 🌟 Amazing Features

### 🎨 Visual & Interactive Elements
- **Animated Robot Buddy**: Friendly character with different expressions and animations
- **Vibrant Colors**: Playful gradient backgrounds and kid-friendly design
- **Particle Effects**: Magical confetti and floating animations
- **Star Achievement System**: Collect stars for every interaction
- **Sound Effects**: Cheerful audio feedback for all actions

### 🎮 Interactive Mini-Games
- **Guess the Animal**: Educational game with hints and emoji rewards
- **Seamless Toggle**: Switch between chat and game modes instantly
- **Progressive Learning**: Build confidence with engaging challenges

### 🤖 Smart AI Features
- **Enhanced Personality**: Buddy tells jokes, shares fun facts, and asks questions
- **Voice Interaction**: Easy-to-use voice commands for natural conversation
- **Age-Appropriate Content**: Carefully crafted for 6-year-olds with advanced reading skills
- **Educational Value**: Encourages curiosity and learning through play

### 🚀 Performance & Compatibility
- **Fast Responses**: Powered by Google Gemini 2.5 Flash Lite
- **Cross-Platform**: Works perfectly on Chromebooks, Android tablets, iPhone, and Safari
- **Mobile-Friendly**: Optimized touch interactions and responsive design
- **No Data Storage**: Completely ephemeral - no personal data saved

## 🎯 How It Works

1. **Talk to Buddy**: Press the green "Talk" button and ask questions
2. **Watch the Magic**: See Buddy react with different animations and expressions
3. **Collect Stars**: Earn stars for every conversation (celebrations every 3 interactions!)
4. **Play Games**: Toggle to the animal guessing game for extra fun
5. **Enjoy Sounds**: Cheerful audio feedback makes every interaction delightful

## 🛠️ Technical Setup

### Prerequisites
- Node.js 18.x or later
- An OpenRouter API key (sign up at https://openrouter.ai)
- A modern web browser (Chrome recommended for best speech recognition support)

### Quick Start
1. Clone the repository:
   ```bash
   git clone https://github.com/Khamel83/kid-friendly-ai.git
   cd kid-friendly-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) and start the adventure!

## 🎨 New Enhancements

This version includes major improvements over the original:

- **Animated Character Companion**: Buddy now has personality and emotions!
- **Visual Effects**: Confetti, particles, and smooth animations
- **Sound System**: Programmatically generated audio feedback
- **Mini-Games**: Educational animal guessing game
- **Achievement System**: Star collection and celebrations
- **Enhanced AI**: More playful, varied, and engaging responses
- **Performance Boost**: Faster model with optimized streaming
- **Mobile Optimization**: Perfect for tablets and touch devices

## 🏗️ Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🔧 What Makes It Special

### Designed for Kids
- Simple, intuitive interface perfect for young users
- Visual and audio feedback that encourages continued use
- Age-appropriate content that's both fun and educational
- No complex features or overwhelming options

### Parent-Friendly
- No data collection or storage
- Safe, controlled environment
- Works on devices kids actually use
- Encourages learning through play

### Technical Excellence
- Modern React/Next.js architecture
- Cross-browser compatibility
- Responsive design for all screen sizes
- Optimized performance with fast responses

## 📱 Device Compatibility

- ✅ Chromebooks (recommended)
- ✅ Android tablets
- ✅ iPhone & iPad (Safari)
- ✅ Desktop browsers
- ✅ Most modern web browsers

## 🎵 Audio Features

The application uses enhanced sound effects including:
- Voice recording start/end sounds
- Success celebration audio
- Cheer and achievement sounds
- Error feedback sounds
- All programmatically generated for optimal performance

## 🚀 Deployment

Ready for Vercel deployment with automatic builds. The application is optimized for production use with proper error handling and fallbacks.

## 🎈 Fun for Everyone!

This isn't just another AI assistant - it's a magical companion that makes learning an adventure. Perfect for curious kids who love to explore, ask questions, and play games!

## Prerequisites

- Node.js 18.x or later
- An OpenRouter API key (sign up at https://openrouter.ai)
- A modern web browser (Chrome recommended for best speech recognition support)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/kid-friendly-ai.git
   cd kid-friendly-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your OpenRouter API key:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click the large circular button to start recording your question
2. Speak your question clearly
3. The button will pulse while recording
4. Click again to stop recording, or wait for automatic stop
5. The AI will process your question and speak the response
6. Click "Ask Another Question" to start over

## Development

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## Sound Effects

The application uses two sound effects for better user experience:
- `public/sounds/start.mp3` - Played when voice recording begins
- `public/sounds/end.mp3` - Played when voice recording ends

You can replace these with your own sound files if desired.

## Browser Support

This application works best in Chrome and Chrome-based browsers due to their superior support for the Web Speech API. Some features may not work in other browsers.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 