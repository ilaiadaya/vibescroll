# Vibescroll

A TikTok-style knowledge discovery app that lets you scroll through trending topics, dive deep into concepts, and explore ideas with AI-powered research.

## Features

- **Swipe Navigation**: Arrow keys (↑↓→←) or swipe gestures
- **Three Depth Levels**: Overview → Full Story → Deep Dive
- **Concept Exploration**: Select any text and press Enter to research it
- **Smart Preloading**: Topics and concept explorations cached for instant access
- **Purple Highlights**: Clickable terms to explore deeper

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **APIs**: Valyu (search), Anthropic Claude (AI synthesis)
- **Gestures**: @use-gesture/react

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd vibescroll

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Variables

Create a `.env.local` file:

```env
VALYU_API_KEY=your_valyu_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

Get your keys:
- Valyu: https://valyu.ai
- Anthropic: https://console.anthropic.com

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Deploy to Railway

1. Push to GitHub
2. Connect your repo to Railway
3. Add environment variables in Railway dashboard:
   - `VALYU_API_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy!

Railway will automatically detect Next.js and configure the build.

## Navigation

| Key | Action |
|-----|--------|
| ↓ | Next topic |
| ↑ | Previous topic |
| → | Go deeper / expand |
| ← | Go back / collapse |
| Enter | Explore selected text |
| Esc | Close overlays |

## License

MIT
