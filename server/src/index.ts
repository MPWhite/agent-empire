import { WebSocketServer } from 'ws';
import { GameManager } from './game-manager.js';

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
