/**
 * MenuState.js — Screen 1: Start Menu.
 *
 * Aesthetic: minimalist, elegant. Animated snowfall over monochromatic
 * mountain silhouettes. Cursive header + clean sans-serif buttons.
 *
 * Buttons: Host Game, Join Game, Settings.
 * "Join Game" reveals an overlay text input for the room code.
 */

import { CONFIG } from '@/config.js';
import { Button } from '@/ui/Button.js';

// ── Snowflake particle ────────────────────────────────────────────────
class Snowflake {
  constructor(p, randomY = true) { this.reset(p, randomY); }

  reset(p, randomY = false) {
    this.x = p.random(p.width);
    this.y = randomY ? p.random(-20, p.height) : p.random(-60, -5);
    this.r = p.random(1.5, 4.5);
    this.vy = p.random(0.4, 1.8);
    this.vx = p.random(-0.25, 0.25);
    this.a = p.random(90, 210);
  }

  update(p) {
    this.y += this.vy;
    this.x += this.vx;
    if (this.y > p.height + 10) this.reset(p);
  }

  draw(p) {
    p.noStroke();
    p.fill(255, this.a);
    p.ellipse(this.x, this.y, this.r);
  }
}

// ── State ─────────────────────────────────────────────────────────────
export class MenuState {
  constructor(context) {
    this.ctx = context;
    this.snowflakes = [];
    this.buttons = [];
    this.titleAlpha = 0;

    // Join dialog
    this.showJoinInput = false;
    this.joinInputEl = document.getElementById('join-code-input');
    
    // Assets for Diorama
    this.imgStartTile = null;
    this.imgClap1 = null;
    this.imgClap2 = null;
    this.imgCrashed = null;
    this.imgTube = null;
  }

  preloadAssets(p) {
    if (!this.imgStartTile) this.imgStartTile = p.loadImage('/assets/HillTiles/Start.png');
    if (!this.imgClap1) this.imgClap1 = p.loadImage('/assets/Clapping/1.gif');
    if (!this.imgClap2) this.imgClap2 = p.loadImage('/assets/Clapping/2.gif');
    if (!this.imgCrashed) this.imgCrashed = p.loadImage('/assets/Penguin/crashed.gif');
    if (!this.imgTube) this.imgTube = p.loadImage('/assets/Tube/default.png');
  }

  enter(p) {
    this.preloadAssets(p);
    this.titleAlpha = 0;
    this.showJoinInput = false;
    this.hideJoinInput();

    // Create snowflakes
    this.snowflakes = Array.from({ length: 80 }, () => new Snowflake(p, true));

    // Create buttons (positioned on the left side)
    this.buildButtons(p);
  }

  exit(p) {
    this.hideJoinInput();
  }

  buildButtons(p) {
    const cx = p.width * 0.33; // 33% from the left to match screenshot exactly
    const sy = p.height * 0.58;
    const gap = 62;

    this.buttons = [
      new Button({
        label: 'Host Game', x: cx, y: sy, w: 220, h: 48,
        onClick: () => this.onHost(p),
      }),
      new Button({
        label: 'Join Game', x: cx, y: sy + gap, w: 220, h: 48,
        onClick: () => this.onJoin(p, cx, sy + gap),
      }),
      new Button({
        label: 'Settings', x: cx, y: sy + gap * 2, w: 220, h: 48,
        fontSize: 14,
        onClick: () => this.ctx.stateManager.setState('SETTINGS', p),
      }),
    ];
  }

  // ── Button callbacks ────────────────────────────────────────────────

  onHost(p) {
    this.ctx.socketManager.connect();
    const myName = localStorage.getItem('penguinName') || 'PLAYER';
    localStorage.setItem('penguinName', myName);

    this.ctx.socketManager.emit('room:create', { playerName: myName });
    this.ctx.stateManager.setState('LOBBY', p, { isHost: true, playerName: myName });
  }

  onJoin(p, btnX, btnY) {
    this.showJoinInput = true;
    if (!this.joinInputEl) return;

    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratioX = rect.width / p.width;
    const ratioY = rect.height / p.height;

    // Overlay directly over the "Join Game" button logically mapped
    Object.assign(this.joinInputEl.style, {
      display: 'block',
      left: `${rect.left + (btnX - 110) * ratioX}px`, 
      transform: 'none',
      top: `${rect.top + (btnY - 24) * ratioY}px`,
      width: `${220 * ratioX}px`, 
      height: `${48 * ratioY}px`,
      fontSize: `${Math.max(9, 11 * ratioY)}px`,
      textAlign: 'center', 
      padding: '0 8px',
      boxSizing: 'border-box',
    });
    this.joinInputEl.value = '';
    this.joinInputEl.focus();

    this.joinInputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const code = this.joinInputEl.value.trim().toUpperCase();
        if (code.length > 0) {
          this.hideJoinInput();
          this.ctx.socketManager.connect();
          
          const myName = localStorage.getItem('penguinName') || 'PLAYER';
          localStorage.setItem('penguinName', myName);
          
          this.ctx.socketManager.emit('room:join', { roomCode: code, playerName: myName });
          this.ctx.stateManager.setState('LOBBY', p, { isHost: false, roomCode: code, playerName: myName });
        }
      } else if (e.key === 'Escape') {
        this.hideJoinInput();
      }
      e.stopPropagation();
    };
  }

  hideJoinInput() {
    this.showJoinInput = false;
    if (this.joinInputEl) {
      this.joinInputEl.style.display = 'none';
      this.joinInputEl.onkeydown = null;
    }
  }

  // ── Frame lifecycle ─────────────────────────────────────────────────

  update(p, dt) {
    this.titleAlpha = Math.min(this.titleAlpha + dt * 1.5, 1);
    for (const s of this.snowflakes) s.update(p);
    for (const b of this.buttons) b.update(p);
  }

  draw(p) {
    // 1. Procedural Background
    this.drawBackground(p);
    this.drawMountains(p);
    
    // 2. Snowflakes (back layer)
    for (const s of this.snowflakes) s.draw(p);

    // 3. Title (Centered top)
    const alpha = Math.floor(this.titleAlpha * 255);
    p.fill(255, alpha);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont(CONFIG.FONT_HEADER);
    p.textSize(54);
    p.text('Sleed Racing', p.width / 2, p.height * 0.22);

    // Subtitle
    p.fill(...CONFIG.CLR_TEXT_DIM, alpha);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(15);
    p.text('A Penguin Racing Adventure', p.width / 2, p.height * 0.30);

    // 4. Diorama on Bottom Right (1:1 recreation of user screenshot)
    this.drawDiorama(p);

    // 5. Buttons
    p.strokeWeight(2); // Reset stroke for buttons to avoid issues
    for (const b of this.buttons) b.draw(p);

    // 6. Join code prompt overlay hint
    if (this.showJoinInput) {
      p.noStroke();
      p.fill(...CONFIG.CLR_TEXT_DIM);
      p.textSize(12); // Slightly smaller font
      p.text('Hit Enter to join', p.width * 0.33, p.height * 0.86); // Moved down securely past Settings
    }
  }

  drawDiorama(p) {
    const px = p.width * 0.76; // Shifted heavily right
    const py = p.height * 0.78; // Y center of diorama

    p.push();
    p.imageMode(p.CENTER);

    // Base Start Tile
    if (this.imgStartTile && this.imgStartTile.width > 0) {
      // Scale it heavily, it's the large track start
      p.image(this.imgStartTile, px, py, this.imgStartTile.width * 0.8, this.imgStartTile.height * 0.8);
    }

    // Front Penguin (Clapping 1)
    if (this.imgClap1 && this.imgClap1.width > 0) {
      p.push();
      // Moved +20px right
      p.translate(px - 80, py - 35);
      p.scale(-1, 1); // <-- REFLECTED HORIZONTALLY
      const h = 55;
      const w = (this.imgClap1.width / this.imgClap1.height) * h;
      p.image(this.imgClap1, 0, 0, w, h);
      p.pop();
    }

    // Back Penguin (Re-using Clapping 1 instead of 2 so it doesn't give us its back natively)
    if (this.imgClap1 && this.imgClap1.width > 0) {
      p.push();
      // Moved +20px right
      p.translate(px - 15, py - 65);
      p.scale(-1, 1); // <-- REFLECTED HORIZONTALLY
      const h = 55;
      const w = (this.imgClap1.width / this.imgClap1.height) * h;
      p.image(this.imgClap1, 0, 0, w, h);
      p.pop();
    }

    // Crashed Splat (Bottom right, past logs, REFLECTED HORIZONTALLY as requested)
    if (this.imgCrashed && this.imgCrashed.width > 0) {
      let currentCrashedFrame = 0;
      let t = 0;

      // Manually control the GIF playback frame to slow it down and force an infinite loop
      if (typeof this.imgCrashed.pause === 'function') {
        this.imgCrashed.pause(); // Stop native rapid autoplay
        if (typeof this.imgCrashed.numFrames === 'function') {
          const totalFrames = this.imgCrashed.numFrames();
          if (totalFrames > 0) {
            // Lock the complete movement loop linearly to the exact duration of the GIF's frames
            const loopDurationMs = totalFrames * 150;
            const linearT = (p.millis() % loopDurationMs) / loopDurationMs;
            
            currentCrashedFrame = Math.floor(linearT * totalFrames);
            this.imgCrashed.setFrame(currentCrashedFrame);
            
            // Apply frictional ease-out so it slides fast instantly and halts by the final frame
            t = 1 - Math.pow(1 - linearT, 2); 
          }
        }
      }

      p.push();
      
      const distanceX = 110; 
      const distanceY = 55; 

      const slideX = t * distanceX;
      const slideY = t * distanceY;
      
      p.translate(px + 40 + slideX, py - 10 + slideY); 
      p.scale(-1, 1); // <-- REFLECTED HORIZONTALLY
      
      // Preserve aspect ratio precisely referencing the game's actual collision draw size
      const h = 60; // 1.2x scale of standard CONFIG.PENGUIN_CRASHED_HEIGHT
      const w = (this.imgCrashed.width / this.imgCrashed.height) * h;
      p.image(this.imgCrashed, 0, 0, w, h);
      p.pop();
    }

    // Empty Tube (Bottom right corner)
    if (this.imgTube && this.imgTube.width > 0) {
      p.push();
      p.translate(px + 140, py + 70);
      p.image(this.imgTube, 0, 0, 45, 30);
      p.pop();
    }

    p.pop();
  }

  drawBackground(p) {
    for (let y = 0; y < p.height; y++) {
      const t = y / p.height;
      const c = p.lerpColor(p.color(10, 14, 28), p.color(22, 32, 55), t);
      p.stroke(c);
      p.line(0, y, p.width, y);
    }
  }

  drawMountains(p) {
    const w = p.width;
    const h = p.height;
    p.noStroke();
    p.fill(18, 26, 46, 180);
    p.beginShape();
    p.vertex(0, h); p.vertex(0, h * 0.52);
    p.vertex(w * 0.14, h * 0.34); p.vertex(w * 0.28, h * 0.48);
    p.vertex(w * 0.44, h * 0.28); p.vertex(w * 0.58, h * 0.42);
    p.vertex(w * 0.74, h * 0.24); p.vertex(w * 0.88, h * 0.38);
    p.vertex(w, h * 0.48); p.vertex(w, h);
    p.endShape(p.CLOSE);
    p.fill(22, 32, 52, 200);
    p.beginShape();
    p.vertex(0, h); p.vertex(0, h * 0.64);
    p.vertex(w * 0.18, h * 0.48); p.vertex(w * 0.34, h * 0.58);
    p.vertex(w * 0.5, h * 0.44); p.vertex(w * 0.66, h * 0.54);
    p.vertex(w * 0.82, h * 0.40); p.vertex(w, h * 0.58);
    p.vertex(w, h);
    p.endShape(p.CLOSE);
  }

  mousePressed(p) {
    for (const b of this.buttons) b.checkClick();
  }

  onResize(p, w, h) {
    this.buildButtons(p);
    this.snowflakes.forEach((s) => s.reset(p, true));
    this.hideJoinInput();
  }
}
