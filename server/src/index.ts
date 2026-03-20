import { WebSocketServer } from 'ws';
import { GameRoom } from './game-room.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const TURN_DURATION = parseInt(process.env.TURN_DURATION ?? '60', 10);

const wss = new WebSocketServer({ port: PORT });
const room = new GameRoom({ turnDurationSeconds: TURN_DURATION });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  room.handleConnection(ws);
});

wss.on('listening', () => {
  console.log(`Game server running on ws://localhost:${PORT}`);
  console.log(`Turn duration: ${TURN_DURATION}s`);
});
