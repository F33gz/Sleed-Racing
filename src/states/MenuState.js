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
  }

  enter(p) {
    this.titleAlpha = 0;
    this.showJoinInput = false;
    this.hideJoinInput();

    // Create snowflakes
    this.snowflakes = Array.from({ length: 80 }, () => new Snowflake(p, true));

    // Create buttons (positioned relative to canvas centre)
    this.buildButtons(p);
  }

  exit(p) {
    this.hideJoinInput();
  }

  buildButtons(p) {
    const cx = p.width / 2;
    const sy = p.height * 0.56;
    const gap = 62;

    this.buttons = [
      new Button({
        label: 'Host Game', x: cx, y: sy, w: 220, h: 48,
        onClick: () => this.onHost(p),
      }),
      new Button({
        label: 'Join Game', x: cx, y: sy + gap, w: 220, h: 48,
        onClick: () => this.onJoin(p),
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
    this.ctx.socketManager.emit('room:create', { playerName: 'Player' });
    this.ctx.stateManager.setState('LOBBY', p, { isHost: true, playerName: 'Player' });
  }

  onJoin(p) {
    this.showJoinInput = true;
    if (!this.joinInputEl) return;

    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();

    Object.assign(this.joinInputEl.style, {
      display: 'block',
      left: `${rect.left + p.width / 2 - 110}px`,
      top: `${rect.top + p.height * 0.48}px`,
      width: '220px',
    });
    this.joinInputEl.value = '';
    this.joinInputEl.focus();

    this.joinInputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const code = this.joinInputEl.value.trim().toUpperCase();
        if (code) {
          this.ctx.socketManager.connect();
          this.ctx.socketManager.emit('room:join', { roomCode: code, playerName: 'Player' });
          this.hideJoinInput();
          this.ctx.stateManager.setState('LOBBY', p, { isHost: false, roomCode: code, playerName: 'Player' });
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
    // Background gradient
    this.drawBackground(p);
    this.drawMountains(p);
    for (const s of this.snowflakes) s.draw(p);

    // Title
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

    // Buttons
    for (const b of this.buttons) b.draw(p);

    // Join code prompt overlay
    if (this.showJoinInput) {
      p.fill(...CONFIG.CLR_TEXT_DIM);
      p.textSize(13);
      p.text('Enter room code and press Enter', p.width / 2, p.height * 0.46);
    }
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
    // Back range
    p.noStroke();
    p.fill(18, 26, 46, 180);
    p.beginShape();
    p.vertex(0, h); p.vertex(0, h * 0.52);
    p.vertex(w * 0.14, h * 0.34); p.vertex(w * 0.28, h * 0.48);
    p.vertex(w * 0.44, h * 0.28); p.vertex(w * 0.58, h * 0.42);
    p.vertex(w * 0.74, h * 0.24); p.vertex(w * 0.88, h * 0.38);
    p.vertex(w, h * 0.48); p.vertex(w, h);
    p.endShape(p.CLOSE);
    // Front range
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
