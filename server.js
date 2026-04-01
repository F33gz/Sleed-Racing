/**
 * server.js — Socket.io multiplayer server for Sleed Racing.
 *
 * Handles room creation/joining, lobby sync, chat relay,
 * game start coordination, and in-game position relay.
 *
 * Run: node server.js
 * Listens on port 3000 by default.
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();

// Serve static built assets (no-cache for index to avoid stale bundles)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, { maxAge: '1y', index: false }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io/')) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Room storage ──────────────────────────────────────────────────────────
/** @type {Map<string, Room>} */
const rooms = new Map();

class Room {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map(); // socketId → { id, name, ready }
    this.started = false;
    this.mapIndex = -1;
    this.startTime = 0;
    this.finishTimes = new Map(); // socketId → finishTimeMs
  }

  addPlayer(socketId, name) {
    this.players.set(socketId, { id: socketId, name, ready: false });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  setReady(socketId, ready) {
    const p = this.players.get(socketId);
    if (p) p.ready = ready;
  }

  allReady() {
    if (this.players.size < 1) return false;
    for (const p of this.players.values()) {
      if (!p.ready) return false;
    }
    return true;
  }

  playerList() {
    return Array.from(this.players.values());
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  // Ensure unique
  if (rooms.has(code)) return generateCode();
  return code;
}

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return null;
}

// ── Socket.io events ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── Create a room ─────────────────────────────────────────────────────
  socket.on('room:create', (data) => {
    const code = generateCode();
    const room = new Room(code, socket.id);
    room.addPlayer(socket.id, data?.playerName || 'Host');
    rooms.set(code, room);
    socket.join(code);

    socket.emit('room:created', { roomCode: code });
    io.to(code).emit('lobby:update', { players: room.playerList() });
    console.log(`[Room] ${code} created by ${socket.id}`);
  });

  // ── Join a room ───────────────────────────────────────────────────────
  socket.on('room:join', (data) => {
    const code = data?.roomCode?.toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('room:error', { message: 'Room not found' });
      return;
    }
    if (room.started) {
      socket.emit('room:error', { message: 'Game already in progress' });
      return;
    }
    if (room.players.size >= 4) {
      socket.emit('room:error', { message: 'Room is full (max 4)' });
      return;
    }

    room.addPlayer(socket.id, data?.playerName || 'Guest');
    socket.join(code);

    socket.emit('room:joined', { roomCode: code });
    io.to(code).emit('lobby:update', { players: room.playerList() });
    console.log(`[Room] ${socket.id} joined ${code} (${room.players.size} players)`);
  });

  // ── Player ready toggle ───────────────────────────────────────────────
  socket.on('player:ready', (data) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    room.setReady(socket.id, data?.ready ?? true);
    io.to(room.code).emit('lobby:update', { players: room.playerList() });
  });

  // ── Player Rename ─────────────────────────────────────────────────────
  socket.on('player:rename', (data) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) {
      p.name = data?.name?.substring(0, 15) || 'Penguin';
      io.to(room.code).emit('lobby:update', { players: room.playerList() });
    }
  });

  // ── Chat ──────────────────────────────────────────────────────────────
  socket.on('chat:message', (data) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    socket.to(room.code).emit('chat:message', {
      sender: player?.name || 'Unknown',
      text: data?.text || '',
    });
  });

  // ── Start game (host only) ────────────────────────────────────────────
  socket.on('game:start', () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.started) return;

    room.started = true;
    room.mapIndex = Math.floor(Math.random() * 4);
    room.startTime = Date.now();

    io.to(room.code).emit('game:start', {
      mapIndex: room.mapIndex,
      players: room.playerList(),
    });
    console.log(`[Game] Room ${room.code} started — map ${room.mapIndex}`);
  });

  // ── In-game position relay (volatile for performance) ─────────────────
  socket.on('player:update', (data) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    // Broadcast to all others in the room
    socket.to(room.code).volatile.emit('player:update', {
      id: socket.id,
      ...data,
    });
  });

  // ── In-game actions (crash, boost) ────────────────────────────────────
  socket.on('action', (data) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    socket.to(room.code).emit('player_action', {
      id: socket.id,
      ...data,
    });
  });

  // ── Player finished ───────────────────────────────────────────────────
  socket.on('player:finish', (data) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return;

    room.finishTimes.set(socket.id, data?.clientTime || 0);

    // Broadcast finish to all
    const player = room.players.get(socket.id);
    io.to(room.code).emit('player:finished', {
      id: socket.id,
      name: player?.name || 'Unknown',
      time: data?.clientTime || 0,
    });

    // Check if all finished
    if (room.finishTimes.size >= room.players.size) {
      const rankings = [];
      for (const [sid, time] of room.finishTimes) {
        const p = room.players.get(sid);
        rankings.push({ id: sid, name: p?.name || '?', time: time / 1000 });
      }
      rankings.sort((a, b) => a.time - b.time);
      io.to(room.code).emit('game:end', { rankings });
    }
  });

  // ── Disconnect ────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const room = findRoomBySocket(socket.id);
    if (room) {
      room.removePlayer(socket.id);
      io.to(room.code).emit('lobby:update', { players: room.playerList() });

      // Clean up empty rooms
      if (room.players.size === 0) {
        rooms.delete(room.code);
        console.log(`[Room] ${room.code} deleted (empty)`);
      } else if (room.hostId === socket.id) {
        // Transfer host to next player
        const nextHost = room.players.keys().next().value;
        room.hostId = nextHost;
        io.to(room.code).emit('host:changed', { hostId: nextHost });
      }
    }
    console.log(`[-] ${socket.id} disconnected`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🏔️  Sleed Racing Server listening on http://localhost:${PORT}\n`);
});
