# Kid-Friendly AI Assistant

A simple, kid-friendly AI web application that allows children to interact with AI through voice commands. The application provides age-appropriate responses that are read aloud using text-to-speech.

## Features

- Voice input for easy interaction
- Child-friendly responses from AI
- Text-to-speech output with kid-friendly voices
- Simple, engaging user interface
- Visual feedback during voice recording
- Loading animations
- Responsive design for all devices

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