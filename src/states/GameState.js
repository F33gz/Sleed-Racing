/**
 * GameState.js — Screen 3: Sled Racing gameplay.
 *
 * Ported from the original Game.js + Maps.js logic:
 * - Tile-based collision checking per player per frame
 * - Camera moves with the local player (moveCamera)
 * - Cloud parallax
 * - Ready→Set→Go! countdown
 * - Victory screen with leaderboard
 * - Background music + finish SFX
 */

import { CONFIG } from '@/config.js';
import { Player } from '@/game/Player.js';
import { Track } from '@/game/Track.js';
import { HILL_TILES } from '@/game/TileData.js';

export class GameState {
  constructor(context) {
    this.ctx = context;

    this.track = null;
    this.local = null;
    /** @type {Map<string, Player>} */
    this.remotes = new Map();

    // Camera (equivalent to .tiles container CSS left/top)
    this.camX = 0;
    this.camY = 0;
    this.cloudsX = 255;

    // Per-player tile tracking (from original PlayerTiles)
    this.playerTiles = {};

    // Timing
    this.startTime = 0;
    this.raceTime = 0;

    // State
    this.countdown = -1;     // 3,2,1 then 0 = GO
    this.countdownTimer = 0;
    this.started = false;
    this.finished = false;
    this.results = null;
    this.placement = 0;

    // Input
    this.useKeyboard = true;

    // Audio
    this.music = null;
    this.finishSound = null;

    // Sync
    this.syncTimer = 0;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  enter(p, data = {}) {
    // Create track
    this.track = new Track();
    this.track.preloadAssets(p);

    // Pick a random map or use provided
    const mapIdx = data.mapIndex ?? Math.floor(Math.random() * 4);
    this.track.loadMap(mapIdx);

    // Create local player
    const id = this.ctx.socketManager.socket?.id || 'local';
    this.local = new Player(id, data.playerName || 'Player', true);
    this.local.preloadAssets(p);
    this.local.setStartPosition(0);

    // Remote players
    this.remotes.clear();

    // Init tile tracking for local player
    this.playerTiles = {};
    this.playerTiles[id] = {
      currentTile: 'start',
      currentIndex: 0,
      hillPos: 0,
      tilePos: 0,
      checkedFirstPos: false,
    };

    // Camera starts at 0,0
    this.camX = 0;
    this.camY = 0;
    this.cloudsX = 255;

    // Reset state
    this.startTime = 0;
    this.raceTime = 0;
    this.countdown = 3;
    this.countdownTimer = 0;
    this.started = false;
    this.finished = false;
    this.results = null;
    this.placement = 0;
    this.syncTimer = 0;
    this.music = null; // Background music track

    // Start ML Model
    this.ctx.poseController.mode = CONFIG.CONTROL_MODE || 'hands';
    this.ctx.poseController.init(p);

    // Network listeners
    this.ctx.socketManager.on('players:state', (d) => this.onPlayersState(d));
    // Initialize remote players from lobby data
    if (data.players) {
      for (const pd of data.players) {
        if (pd.id === this.local.id) continue;
        const r = new Player(pd.id, pd.name || 'Opponent', false);
        r.sprites = this.local.sprites;
        r.tubeSprites = this.local.tubeSprites;
        r.setStartPosition(this.remotes.size + 1);
        this.remotes.set(pd.id, r);
      }
    }

    // Remote player position updates
    this.ctx.socketManager.on('player:update', (pd) => {
      if (pd.id === this.local.id) return;
      if (!this.remotes.has(pd.id)) {
        const r = new Player(pd.id, pd.name || 'Opponent', false);
        r.sprites = this.local.sprites;
        r.tubeSprites = this.local.tubeSprites;
        this.remotes.set(pd.id, r);
      }
      this.remotes.get(pd.id).setRemoteTarget(pd.left, pd.top, pd.offsetX);
    });

    // Remote actions (crash, boost)
    this.ctx.socketManager.on('player_action', (data) => {
      const r = this.remotes.get(data.id);
      if (!r) return;
      if (data.type === 'crash') r.triggerCrash();
      if (data.type === 'boost') r.triggerBoost();
    });

    // Individual player finish notification
    this.ctx.socketManager.on('player:finished', (data) => {
      // Could show a notification that player X finished
    });

    // Server sends final rankings
    this.ctx.socketManager.on('game:end', (d) => {
      this.finished = true;
      this.results = d.rankings;
    });
  }

  exit(p) {
    this.ctx.poseController.stop();
    this.ctx.socketManager.off('player:update');
    this.ctx.socketManager.off('player_action');
    this.ctx.socketManager.off('player:finished');
    this.ctx.socketManager.off('game:end');

    // Clean up audio
    if (this.music) {
      this.music.pause();
      this.music.removeAttribute('src');
      this.music = null;
    }
  }

  // ── Frame update ───────────────────────────────────────────────────

  update(p, dt) {
    // Countdown phase (READY → SET → GO!)
    if (this.countdown > 0) {
      this.countdownTimer += dt;
      if (this.countdownTimer >= 0.6) { // 600ms per step, matching original
        this.countdown--;
        this.countdownTimer = 0;
        if (this.countdown === 0) {
          this.started = true;
          this.startTime = Date.now();

          // Start the music exactly when the countdown hits GO!
          this.music = new Audio('/assets/Music.mp3');
          this.music.loop = true;
          this.music.volume = 0.4; // Soft background volume
          this.music.play().catch(e => console.warn('Audio auto-play prevented:', e));
        }
      }
      return;
    }
    if (!this.started) return;

    // ── Steering input (continuous free-form) ────────────────────────
    const mode = CONFIG.CONTROL_MODE || 'hands';
    const deadzone = mode === 'hands' ? CONFIG.HAND_DEADZONE : CONFIG.BODY_DEADZONE;
    const maxDelta = mode === 'hands' ? CONFIG.HAND_MAX_DELTA : CONFIG.BODY_MAX_DELTA;
    const maxSpeed = mode === 'hands' ? CONFIG.HAND_MAX_SPEED : CONFIG.BODY_MAX_SPEED;
    const curveExp = mode === 'hands' ? CONFIG.HAND_CURVE : CONFIG.BODY_CURVE;
    const smoothFactor = mode === 'hands' ? CONFIG.HAND_SMOOTHING : CONFIG.BODY_SMOOTHING;

    const rawDelta = this.ctx.poseController.rawDeltaY;
    let hTarget = 0;

    // Progressive steering with power curve
    if (Math.abs(rawDelta) > deadzone) {
      // Remove deadzone from the value
      const sign = rawDelta > 0 ? 1 : -1;
      const adjusted = Math.abs(rawDelta) - deadzone;
      const range = maxDelta - deadzone;

      // Normalize to 0–1 then apply power curve
      const norm = Math.min(adjusted / range, 1.0);
      const curved = Math.pow(norm, curveExp);

      // Scale to max speed
      hTarget = sign * curved * maxSpeed;
    }

    // Smooth the input (lerp toward target)
    this._smoothedHandInput = (this._smoothedHandInput || 0);
    this._smoothedHandInput += (hTarget - this._smoothedHandInput) * smoothFactor;

    // If very small, snap to zero to avoid drift
    if (Math.abs(this._smoothedHandInput) < 0.05) this._smoothedHandInput = 0;

    let hInput = this._smoothedHandInput;

    // Keyboard fallback (smooth continuous movement)
    if (this.useKeyboard) {
      const kbSpeed = CONFIG.KEYBOARD_STEER_SPEED;
      if (p.keyIsDown(p.LEFT_ARROW) || p.keyIsDown(40))  hInput -= kbSpeed;
      if (p.keyIsDown(p.RIGHT_ARROW) || p.keyIsDown(38)) hInput += kbSpeed;
    }

    // Apply steering to player
    this.local.steer(hInput);

    // ── Move local player ────────────────────────────────────────────
    const prevSpeed = this.local.speed;
    this.local.update(this.track);

    // ── Camera follows local player ──────────────────────────────────
    const dist = this.local.speed;
    this.camX -= dist * CONFIG.X_MULTIPLIER;
    this.camY -= dist;
    this.cloudsX -= dist / 15;

    // ── Tile collision check ─────────────────────────────────────────
    this.checkMap(this.local);

    // ── Finish detection ─────────────────────────────────────────────
    if (this.local.finished && !this.finished) {
      this.finished = true;
      this.raceTime = Date.now() - this.startTime;

      // Play finish sound
      if (this.music) {
        this.music.src = '/assets/Finish.mp3';
        this.music.loop = false;
        this.music.play().catch(e => console.warn('Finish audio skipped:', e));
      }

      this.ctx.socketManager.emit('player:finish', {
        clientTime: this.raceTime,
        timestamp: performance.now(),
      });
      // Solo results
      if (!this.ctx.socketManager.connected) {
        const secs = this.raceTime / 1000;
        this.results = [{ name: this.local.name, time: secs }];
      }
    }

    // ── Remote players ───────────────────────────────────────────────
    for (const r of this.remotes.values()) r.update(this.track);

    // ── Network sync ─────────────────────────────────────────────────
    this.syncTimer += dt;
    if (this.syncTimer >= CONFIG.POSITION_SYNC_RATE / 1000) {
      this.syncTimer = 0;
      this.ctx.socketManager.volatileEmit('player:update', this.local.toJSON());
    }
  }

  /**
   * Check tile collisions for a player.
   * Replicates checkMap() + checkCollision() from Maps.js.
   */
  checkMap(player) {
    const id = player.id;
    const pt = this.playerTiles[id];
    if (!pt || pt.currentIndex === -1) return;

    const tileMap = this.track.tileMap;
    const mapTiles = this.track.mapTiles;
    const playerL = (player.absLeft || 0) + 35;
    const playerT = (player.absTop || 0) + 35;

    // Check if player has entered the next tile
    if (pt.currentIndex < tileMap.length &&
        tileMap[pt.currentIndex].left <= playerL &&
        tileMap[pt.currentIndex].top <= playerT) {
      pt.checkedFirstPos = false;
      pt.currentTile = mapTiles[pt.currentIndex];
      pt.hillPos = tileMap[pt.currentIndex].top;
      pt.tilePos = 0;
      if (pt.currentIndex < tileMap.length - 1) {
        pt.currentIndex++;
      } else {
        pt.currentIndex = -1;
      }
    }

    // Check collision at current position within the tile
    if (!pt.checkedFirstPos) {
      pt.checkedFirstPos = true;
      this.checkCollision(player, pt);
    } else if (playerT > pt.hillPos + CONFIG.TILE_ROW_HEIGHT) {
      pt.hillPos += CONFIG.TILE_ROW_HEIGHT;
      pt.tilePos++;
      this.checkCollision(player, pt);
    }
  }

  checkCollision(player, pt) {
    const tileType = pt.currentTile;
    if (typeof tileType !== 'number') return;

    const tile = HILL_TILES[tileType];
    if (!tile?.map || tile.map.length !== 9) return;

    const laneX = player.laneX;
    const tilePos = pt.tilePos;
    if (laneX < 0 || laneX >= 9 || tilePos < 0 || tilePos >= 9) return;

    const val = tile.map[laneX][tilePos];

    if (val === 1 && player.isLocal && !player.crashed && !player.jumping) {
      player.triggerCrash();
      this.ctx.socketManager.emit('action', { type: 'crash' });
    }
    else if (val === 2 && !player.jumping && !player.crashed) {
      player.triggerJump('small');
    }
    else if (val === 3 && !player.jumping && !player.crashed) {
      player.triggerJump('medium');
    }
    else if (val === 4 && !player.jumping && !player.crashed) {
      player.triggerJump('large');
    }
    else if (val === 5 && !player.jumping && !player.crashed) {
      player.triggerJump('mega');
    }
    else if (val === 99 && !player.crashed && player.isLocal) {
      player.triggerBoost();
      this.ctx.socketManager.emit('action', { type: 'boost' });
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────

  draw(p) {
    // Track (background, clouds, tiles, finish)
    this.track.draw(p, this.camX, this.camY, this.cloudsX);

    // Remote players
    for (const r of this.remotes.values()) {
      r.draw(p, this.camX, this.camY);
    }

    // Local player (draw on top)
    this.local.draw(p, this.camX, this.camY);

    // Mini-map
    const allPlayers = [this.local, ...this.remotes.values()];
    this.track.drawMiniMap(p, allPlayers);

    // HUD
    this.drawHUD(p);

    // Countdown overlay
    if (this.countdown > 0) {
      this.drawCountdown(p);
    }

    // Results
    if (this.finished && this.results) {
      this.drawResults(p);
    }
  }

  drawHUD(p) {
    if (!this.started) return;

    const hpc = this.ctx.poseController;
    const camW = 160;
    const camH = 120;
    const camX = 10;
    const camY = 10;
    const cornerR = 8;
    const mode = CONFIG.CONTROL_MODE || 'hands';

    // ── Camera preview ─────────────────────────────────────────────
    p.push();

    // Dark panel background
    p.fill(0, 0, 0, 160);
    p.noStroke();
    p.rect(camX - 2, camY - 2, camW + 4, camH + 4, cornerR);

    // Draw the video feed
    if (hpc.video && hpc.isReady) {
      // Clip to rounded rect (approximate with drawingContext)
      const ctx = p.drawingContext;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(camX, camY, camW, camH, cornerR);
      ctx.clip();

      p.image(hpc.video, camX, camY, camW, camH);

      // Draw tracking landmarks (all keypoints as small dots)
      p.fill(p.color(200, 200, 255, 150));
      p.noStroke();
      if (hpc.keypoints) {
        for (const kp of hpc.keypoints) {
          if (kp.confidence !== undefined && kp.confidence < 0.2) continue; // bodyPose
          // Scale keypoints from video coords (320×240) to preview coords
          const kx = camX + (kp.x / 320) * camW;
          const ky = camY + (kp.y / 240) * camH;
          p.ellipse(kx, ky, 3, 3);
        }
      }

      // Draw primary tracking markers (wrists or shoulders)
      if (hpc.leftPoint) {
        const lx = camX + (hpc.leftPoint.x / 320) * camW;
        const ly = camY + (hpc.leftPoint.y / 240) * camH;
        p.stroke(0, 200, 255);
        p.strokeWeight(2);
        p.noFill();
        p.ellipse(lx, ly, 12, 12);
        p.fill(255);
        p.noStroke();
        p.textSize(8);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text('L', lx, ly - 7);
      }
      if (hpc.rightPoint) {
        const rx = camX + (hpc.rightPoint.x / 320) * camW;
        const ry = camY + (hpc.rightPoint.y / 240) * camH;
        p.stroke(255, 120, 50);
        p.strokeWeight(2);
        p.noFill();
        p.ellipse(rx, ry, 12, 12);
        p.fill(255);
        p.noStroke();
        p.textSize(8);
        p.textAlign(p.CENTER, p.BOTTOM);
        p.text('R', rx, ry - 7);
      }

      // Draw connecting line between primary tracking points
      if (hpc.leftPoint && hpc.rightPoint) {
        const lx = camX + (hpc.leftPoint.x / 320) * camW;
        const ly = camY + (hpc.leftPoint.y / 240) * camH;
        const rx = camX + (hpc.rightPoint.x / 320) * camW;
        const ry = camY + (hpc.rightPoint.y / 240) * camH;
        p.stroke(255, 255, 255, 100);
        p.strokeWeight(1);
        p.line(lx, ly, rx, ry);
      }

      ctx.restore();
    } else {
      // No camera — show placeholder
      p.fill(40, 50, 70);
      p.rect(camX, camY, camW, camH, cornerR);
      p.fill(100, 120, 160);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textFont(CONFIG.FONT_BODY);
      p.textSize(11);
      p.text('📷 Camera loading...', camX + camW / 2, camY + camH / 2);
    }

    // ── Steering gauge (below camera) ────────────────────────────
    const gaugeX = camX;
    const gaugeY = camY + camH + 8;
    const gaugeW = camW;
    const gaugeH = 14;
    const maxDelta = mode === 'hands' ? CONFIG.HAND_MAX_DELTA : CONFIG.BODY_MAX_DELTA;
    const deadzone = mode === 'hands' ? CONFIG.HAND_DEADZONE : CONFIG.BODY_DEADZONE;

    // Gauge background
    p.fill(0, 0, 0, 140);
    p.noStroke();
    p.rect(gaugeX, gaugeY, gaugeW, gaugeH, 4);

    // Gauge fill
    const delta = hpc.rawDeltaY || 0;
    const norm = Math.max(-1, Math.min(1, delta / maxDelta)); // -1 to 1
    const barW = Math.abs(norm) * (gaugeW / 2);
    const centerX = gaugeX + gaugeW / 2;

    // Color: green near center, orange/red at extremes
    const intensity = Math.abs(norm);
    const r = Math.floor(p.lerp(80, 255, intensity));
    const g = Math.floor(p.lerp(220, 80, intensity));
    const b = 60;
    p.fill(r, g, b, 220);
    p.noStroke();

    if (norm > 0) {
      // Steering right — bar extends right from center
      p.rect(centerX, gaugeY + 2, barW, gaugeH - 4, 2);
    } else if (norm < 0) {
      // Steering left — bar extends left from center
      p.rect(centerX - barW, gaugeY + 2, barW, gaugeH - 4, 2);
    }

    // Center line (deadzone marker)
    p.stroke(255, 255, 255, 150);
    p.strokeWeight(1);
    p.line(centerX, gaugeY + 1, centerX, gaugeY + gaugeH - 1);

    // Deadzone markers
    const dzNorm = deadzone / maxDelta;
    const dzPx = dzNorm * (gaugeW / 2);
    p.stroke(255, 255, 255, 50);
    p.line(centerX - dzPx, gaugeY + 1, centerX - dzPx, gaugeY + gaugeH - 1);
    p.line(centerX + dzPx, gaugeY + 1, centerX + dzPx, gaugeY + gaugeH - 1);

    // Labels
    p.noStroke();
    p.fill(255, 200);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(8);
    p.textAlign(p.LEFT, p.CENTER);
    p.text('← L', gaugeX + 3, gaugeY + gaugeH / 2);
    p.textAlign(p.RIGHT, p.CENTER);
    p.text('R →', gaugeX + gaugeW - 3, gaugeY + gaugeH / 2);

    // ── Timer (below gauge) ──────────────────────────────────────
    const timerY = gaugeY + gaugeH + 6;
    p.fill(0, 0, 0, 100);
    p.noStroke();
    p.rect(camX, timerY, camW, 28, 6);

    const elapsed = this.finished ? this.raceTime : (Date.now() - this.startTime);
    const mins = ('00' + Math.floor(elapsed / 60000)).slice(-2);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const ms = elapsed % 1000;

    p.fill(255);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(15);
    p.textAlign(p.LEFT, p.CENTER);
    p.text(`⏱ ${mins}:${secs}:${ms}`, camX + 10, timerY + 14);
    p.pop();
  }

  drawCountdown(p) {
    const labels = ['GO!', 'SET', 'READY'];
    const label = labels[this.countdown - 1] || '';
    const isGo = this.countdown === 1;

    p.push();
    // Semi-transparent overlay
    p.fill(0, 0, 0, 80);
    p.rect(0, 0, p.width, p.height);

    // Text with Club Penguin style stroke
    p.fill(255);
    p.stroke(1, 132, 206);
    p.strokeWeight(isGo ? 3 : 2);
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(isGo ? 93 : 68);
    p.textStyle(p.BOLD);
    p.text(label, p.width / 2, p.height * 0.55);
    p.textStyle(p.NORMAL);
    p.pop();
  }

  drawResults(p) {
    p.push();
    p.fill(1, 132, 206, 170);
    const pw = p.width * 0.33;
    const ph = p.height * 0.8;
    const px = (p.width - pw) / 2;
    const py = (p.height - ph) / 2;
    p.rect(px, py, pw, ph, 40);

    // Header
    p.fill(255);
    p.noStroke();
    p.textFont(CONFIG.FONT_BODY);
    p.textAlign(p.CENTER, p.TOP);
    p.textSize(28);
    p.textStyle(p.BOLD);
    p.text('Leaderboard', p.width / 2, py + ph * 0.07);
    p.textStyle(p.NORMAL);

    // Draw a line under header
    p.stroke(255);
    p.strokeWeight(1);
    p.line(px + 20, py + ph * 0.15, px + pw - 20, py + ph * 0.15);
    p.noStroke();

    // Placements
    const colors = [[255, 215, 0], [192, 192, 192], [140, 120, 83], [0, 128, 0]];
    const labels = ['1st', '2nd', '3rd', '4th'];

    p.textSize(22);
    for (let i = 0; i < (this.results?.length || 0) && i < 4; i++) {
      const r = this.results[i];
      const ry = py + ph * 0.2 + i * ph * 0.13;
      p.fill(...(colors[i] || [255, 255, 255]));
      p.textAlign(p.LEFT, p.TOP);
      p.text(`${labels[i]}`, px + 20, ry);

      p.fill(255);
      p.textSize(17);
      const timeStr = typeof r.time === 'number'
        ? `${r.time.toFixed(2)}s`
        : r.time;
      p.text(`${r.name} — ⏱ ${timeStr}`, px + 70, ry + 3);
      p.textSize(22);
    }

    // Play Again button
    p.fill(1, 132, 206, 70);
    p.stroke(0, 0, 255);
    p.strokeWeight(2);
    const btnW = pw * 0.67;
    const btnH = ph * 0.08;
    const btnX = px + (pw - btnW) / 2;
    const btnY = py + ph * 0.85;
    p.rect(btnX, btnY, btnW, btnH, 13);

    p.noStroke();
    p.fill(255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(24);
    p.text('Play Again', btnX + btnW / 2, btnY + btnH / 2);
    p.pop();

    // Store button bounds for click detection
    this._playAgainBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
  }

  // ── Input ──────────────────────────────────────────────────────────

  mousePressed(p) {
    if (this._playAgainBtn && this.finished) {
      const b = this._playAgainBtn;
      if (p.mouseX >= b.x && p.mouseX <= b.x + b.w &&
          p.mouseY >= b.y && p.mouseY <= b.y + b.h) {
        this.ctx.stateManager.setState('MENU', p);
      }
    }
  }

  keyPressed(p, kc) {
    if (kc === 27 && this.finished) {
      this.ctx.stateManager.setState('MENU', p);
    }
  }

  onResize() {}
}
