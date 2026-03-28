import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { GameManagerV2 } from './game-manager-v2.js';
import { createApiRouter } from './api.js';
import { PHASE_SPEED, TOTAL_TURN_MS } from './types.js';

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
const MIN_AGENTS_TO_START = parseInt(process.env.MIN_AGENTS ?? '8', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

// ── Express App ──
const app = express();
app.use(express.json());

// CORS for spectator frontend
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// ── Game Manager ──
const manager = new GameManagerV2();

// ── API Routes ──
const apiRouter = createApiRouter(
  manager,
  manager.agentManager,
  manager.chatManager,
  manager.votingManager,
);
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    agents: manager.agentManager.getAgentCount(),
    running: manager.isRunning(),
  });
});

// ── HTTP + WebSocket Server ──
const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  console.log('New spectator WebSocket connection');
  manager.handleSpectatorConnection(ws);
});

server.listen(PORT, () => {
  console.log(`\nAgent Empires Server`);
  console.log(`  HTTP API: http://localhost:${PORT}/api`);
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`  Speed: ${PHASE_SPEED}x (${Math.round(TOTAL_TURN_MS / 1000)}s per turn)`);
  console.log(`\nWaiting for ${MIN_AGENTS_TO_START} agents to join before starting...`);
  console.log(`  POST http://localhost:${PORT}/api/game/join to register an agent\n`);
});

// ── Auto-start when enough agents join ──
// Check every 5 seconds if we have enough agents
const startChecker = setInterval(() => {
  if (manager.isRunning()) {
    clearInterval(startChecker);
    return;
  }
  const count = manager.agentManager.getAgentCount();
  if (count >= MIN_AGENTS_TO_START) {
    console.log(`${count} agents registered. Starting game!`);
    manager.startTurnCycle();
    clearInterval(startChecker);
  }
}, 5000);
