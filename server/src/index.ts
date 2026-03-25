import { readFileSync, existsSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { GameManager } from './game-manager.js';

// Load .env.local if present (for ANTHROPIC_API_KEY)
const envPath = new URL('../.env.local', import.meta.url).pathname;
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const wss = new WebSocketServer({ port: PORT });
const manager = new GameManager();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  manager.handleConnection(ws);
});

wss.on('listening', () => {
  console.log(`Game server running on ws://localhost:${PORT}`);
});
