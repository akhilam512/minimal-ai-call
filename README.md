# Minimal AI Call

A lightweight Next.js app demonstrating voice AI integration using [Daily Bots](https://www.daily.co/products/daily-bots/) and [Pipecat](https://github.com/pipecat-ai/pipecat).

![minimal](https://github.com/user-attachments/assets/434d03be-3105-4d8d-9ee4-65a7b11bd9f5)

Key features:
- Real-time voice conversations with AI agents
- Multiple AI personas (receptionist, sales representative, etc.) with function calling to switch roles mid-call
- Ultra-low latency responses (as low as 500ms)
- Interruption handling with word-level context accuracy
- Bot transcript UI with spoken word-level highlighting 

## Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Voice AI deployment**: Daily Bots (hosted Pipecat)
- **AI Integration**: 
  - Pipecat client libraries (`@pipecat-ai/client-js`, `@pipecat-ai/client-react`)
  - Daily transport (`@pipecat-ai/daily-transport`)
- **LLM Options**: OpenAI, Anthropic, Together AI, and more
- **Voice Models**: Various options through Cartesia

## Prerequisites

- Node.js (v18+)
- npm or yarn
- Daily Bots API key
- OpenAI API key (or other supported LLM provider)

## Setup

1. Clone the repository:
   ```bash
   git clone git@github.com:akhilam512/minimal-ai-call.git

   cd minimal-ai-call
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Rename `env.sample` to `.env.local` in the root directory and add your API keys.

4. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Usage

1. Click the microphone button to start a conversation with the AI agent.
2. Speak naturally - the AI will respond in real-time with voice with the bot's transcript visible in real-time.
3. You can interrupt the AI at any time by speaking or ask it to switch to a different role.


## License

This project is licensed under the MIT License.

## Resources

- [Daily Bots Documentation](https://docs.dailybots.ai/)
- [Pipecat GitHub Repository](https://github.com/pipecat-ai/pipecat)
- [Next.js Documentation](https://nextjs.org/docs)
