/**
 * LobbyState.js — Screen 2: Multiplayer Lobby.
 *
 * Shows a player list (left), chat (right), room code, and action buttons.
 * - Host sees "Start Game" button (starts when clicked)
 * - All players can toggle Ready
 * - If server is unreachable, host can "Play Solo"
 */

import { CONFIG } from '@/config.js';
import { Button } from '@/ui/Button.js';
import { PlayerList } from '@/ui/PlayerList.js';
import { ChatBox } from '@/ui/ChatBox.js';

// Reuse snowflake for background consistency
class Snowflake {
  constructor(p) { this.reset(p, true); }
  reset(p, ry = false) {
    this.x = p.random(p.width);
    this.y = ry ? p.random(p.height) : p.random(-50, -5);
    this.r = p.random(1.5, 4); this.vy = p.random(0.3, 1.4);
    this.vx = p.random(-0.2, 0.2); this.a = p.random(60, 160);
  }
  update(p) { this.y += this.vy; this.x += this.vx; if (this.y > p.height + 10) this.reset(p); }
  draw(p) { p.noStroke(); p.fill(255, this.a); p.ellipse(this.x, this.y, this.r); }
}

export class LobbyState {
  constructor(context) {
    this.ctx = context;
    this.snowflakes = [];
    this.playerList = null;
    this.chatBox = null;
    this.readyBtn = null;
    this.startBtn = null;
    this.backBtn = null;
    this.soloBtn = null;
    this.isReady = false;
    this.isHost = false;
    this.roomCode = '...';
    this.playerName = '';
    this.serverConnected = false;
    this.statusMessage = 'Connecting to server...';
    this._p = null; // Store p5 ref for socket callbacks
  }

  enter(p, data = {}) {
    this._p = p;
    this.isHost = data.isHost || false;
    this.roomCode = data.roomCode || '---';
    this.playerName = data.playerName || 'Player';
    this.isReady = false;
    this.serverConnected = this.ctx.socketManager.socket?.connected;
    this.statusMessage = '';
    
    this.showRenameInput = false;
    this.renameInputEl = document.getElementById('rename-input');

    this.snowflakes = Array.from({ length: 40 }, () => new Snowflake(p));
    this.buildUI(p);

    // Activate chat HTML input
    const canvas = document.querySelector('canvas');
    this.chatBox.activate(canvas, (text) => {
      this.ctx.socketManager.emit('chat:message', { text });
      this.chatBox.addMessage(this.playerName, text);
    });

    // ── Socket listeners ────────────────────────────────────────────
    const sm = this.ctx.socketManager;

    // Room created (host receives the code)
    sm.on('room:created', (data) => {
      this.roomCode = data.roomCode;
      this.serverConnected = true;
      this.statusMessage = '';
    });

    // Room joined (guest confirms)
    sm.on('room:joined', (data) => {
      this.roomCode = data.roomCode;
      this.serverConnected = true;
      this.statusMessage = '';
    });

    // Room error
    sm.on('room:error', (data) => {
      this.statusMessage = `⚠ ${data.message}`;
    });

    // Lobby updates (player list)
    sm.on('lobby:update', (data) => {
      this.serverConnected = true;
      this.statusMessage = '';
      if (data.roomCode) this.roomCode = data.roomCode;
      if (data.hostId && data.hostId === this.ctx.socketManager.socket?.id) {
        this.isHost = true;
      }
      this.playerList.setPlayers(data.players);
    });

    // Chat messages from others
    sm.on('chat:message', (msg) => {
      this.chatBox.addMessage(msg.sender, msg.text);
    });

    // Game start (server tells everyone to go)
    sm.on('game:start', (payload) => {
      this.ctx.stateManager.setState('GAME', p, {
        mapIndex: payload.mapIndex,
        players: payload.players,
        playerName: this.playerName,
        roomCode: payload.roomCode || this.roomCode,
        isHost: payload.hostId ? payload.hostId === this.ctx.socketManager.socket?.id : this.isHost,
      });
    });

    // Check connection after a delay — if not connected, show solo option
    setTimeout(() => {
      if (!this.serverConnected) {
        this.statusMessage = 'Server not found. Start server with: npm run server';
      }
    }, 3000);

    // Refresh lobby state (player list + code) when entering/re-entering
    this.ctx.socketManager.emit('lobby:request');

    // Seed the player list with ourselves
    this.playerList.setPlayers([{ id: 'self', name: this.playerName, ready: false }]);
  }

  exit(p) {
    this.hideRenameBox();
    this.chatBox.deactivate();
    const sm = this.ctx.socketManager;
    sm.off('room:created');
    sm.off('room:joined');
    sm.off('room:error');
    sm.off('lobby:update');
    sm.off('chat:message');
    sm.off('game:start');
  }

  buildUI(p) {
    const margin = 24;
    const halfW = (p.width - margin * 3) / 2;
    const panelH = p.height * 0.54;
    const panelTop = p.height * 0.18;

    this.playerList = new PlayerList(margin, panelTop, halfW, panelH);
    this.chatBox = new ChatBox(margin * 2 + halfW, panelTop, halfW, panelH);

    const btnY = p.height * 0.83;

    this.readyBtn = new Button({
      label: 'Ready', x: p.width / 2 - 100, y: btnY, w: 160, h: 44,
      onClick: () => this.toggleReady(),
    });

    // Host gets a Start Game button
    this.startBtn = new Button({
      label: '🚀 Start Game', x: p.width / 2 + 100, y: btnY, w: 170, h: 44,
      onClick: () => this.startGame(),
    });

    this.backBtn = new Button({
      label: 'BACK', x: 70, y: btnY, w: 100, h: 38, fontSize: 13,
      onClick: () => {
        this.ctx.socketManager.disconnect();
        this.ctx.stateManager.setState('MENU', p);
      },
    });

    // Solo play button (shown when server unavailable)
    this.soloBtn = new Button({
      label: 'PLAY SOLO', x: p.width / 2, y: p.height * 0.93, w: 160, h: 38, fontSize: 13,
      onClick: () => {
        this.ctx.stateManager.setState('GAME', p, { playerName: this.playerName });
      },
    });

    this.renameBtn = new Button({
      label: 'RENAME', x: 200, y: btnY, w: 120, h: 44, fontSize: 13,
      onClick: () => this.showRenameBox(p, 200, btnY),
    });
  }

  showRenameBox(p, btnX, btnY) {
    if (!this.renameInputEl) return;
    this.showRenameInput = true;
    
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratioX = rect.width / p.width;
    const ratioY = rect.height / p.height;
    
    Object.assign(this.renameInputEl.style, {
      display: 'block',
      left: `${rect.left + (btnX - 60) * ratioX}px`, 
      top: `${rect.top + (btnY - 22) * ratioY}px`,
      width: `${120 * ratioX}px`, 
      height: `${44 * ratioY}px`,
      fontSize: `${Math.max(9, 11 * ratioY)}px`,
      textAlign: 'center', 
    });
    this.renameInputEl.value = this.playerName;
    this.renameInputEl.focus();

    this.renameInputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const newName = this.renameInputEl.value.trim().substring(0, 10).replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
        if (newName.length > 0) {
          this.playerName = newName;
          
          if (this.playerList && this.playerList.players) {
              const myEntry = this.playerList.players.find(pl => pl.id === this.ctx.socketManager.socket?.id);
              if (myEntry) myEntry.name = newName;
          }
          
          this.ctx.socketManager.emit('player:rename', { name: newName });
          localStorage.setItem('penguinName', newName);
        }
        this.hideRenameBox();
      } else if (e.key === 'Escape') {
        this.hideRenameBox();
      }
    };
  }
  
  hideRenameBox() {
    this.showRenameInput = false;
    if (this.renameInputEl) {
      this.renameInputEl.style.display = 'none';
      this.renameInputEl.onkeydown = null;
    }
  }

  toggleReady() {
    this.isReady = !this.isReady;
    this.readyBtn.label = this.isReady ? 'READY' : 'READY';
    this.ctx.socketManager.emit('player:ready', { ready: this.isReady });
  }

  startGame() {
    if (this.isHost && this.serverConnected) {
      this.ctx.socketManager.emit('game:start');
    }
  }

  update(p, dt) {
    for (const s of this.snowflakes) s.update(p);
    this.readyBtn.update(p);
    this.backBtn.update(p);
    this.renameBtn.update(p);
    if (this.isHost) this.startBtn.update(p);
    this.soloBtn.update(p);
  }

  draw(p) {
    // Background
    for (let y = 0; y < p.height; y++) {
      const t = y / p.height;
      const c = p.lerpColor(p.color(10, 14, 28), p.color(22, 32, 55), t);
      p.stroke(c); p.line(0, y, p.width, y);
    }
    for (const s of this.snowflakes) s.draw(p);

    // Title
    p.noStroke();
    p.fill(...CONFIG.CLR_TEXT);
    p.textFont(CONFIG.FONT_HEADER);
    p.textSize(32);
    p.textAlign(p.CENTER, p.CENTER);
    p.text('LOBBY', p.width / 2, p.height * 0.05);

    // Room code (big and prominent)
    p.fill(...CONFIG.CLR_ACCENT_GLOW);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(22);
    p.text(`ROOM CODE ${this.roomCode}`, p.width / 2, p.height * 0.105);

    // Connection status
    if (this.statusMessage) {
      p.fill(255, 200, 80);
      p.textSize(12);
      p.text(this.statusMessage.replace(/[\(\):—✓]/g, '').toUpperCase(), p.width / 2, p.height * 0.15);
    } else {
      p.fill(80, 220, 120);
      p.textSize(12);
      p.text(`CONNECTED   ${this.playerList?.players?.length || 0} PLAYERS`, p.width / 2, p.height * 0.15);
    }

    // Panels
    this.playerList.draw(p);
    this.chatBox.draw(p);

    // Buttons
    this.readyBtn.draw(p);
    this.backBtn.draw(p);
    this.renameBtn.draw(p);
    if (this.isHost && this.serverConnected) this.startBtn.draw(p);

    // Solo play (always available as fallback)
    if (!this.serverConnected) {
      this.soloBtn.draw(p);
    }
  }

  mousePressed(p) {
    this.readyBtn.checkClick();
    this.backBtn.checkClick();
    this.renameBtn.checkClick();
    if (this.isHost && this.serverConnected) this.startBtn.checkClick();
    if (!this.serverConnected) this.soloBtn.checkClick();
  }

  keyPressed(p, kc) {
    if (kc === 27) { // Escape
      this.ctx.socketManager.disconnect();
      this.ctx.stateManager.setState('MENU', p);
    }
  }

  onResize(p, w, h) {
    this.buildUI(p);
    this.hideRenameBox();
    const canvas = document.querySelector('canvas');
    if (this.chatBox && canvas) {
      this.chatBox.activate(canvas, (text) => {
        this.ctx.socketManager.emit('chat:message', { text });
        this.chatBox.addMessage(this.playerName, text);
      });
    }
  }
}
