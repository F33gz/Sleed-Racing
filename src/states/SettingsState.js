/**
 * SettingsState.js — Screen: Settings Menu
 *
 * Allows the user to toggle between different control modes
 * and save their preferences.
 */

import { CONFIG } from '@/config.js';
import { Button } from '@/ui/Button.js';

class Snowflake {
  constructor(p) { this.reset(p, true); }
  reset(p, ry = false) {
    this.x = p.random(p.width);
    this.y = ry ? p.random(p.height) : p.random(-50, -5);
    this.r = p.random(1.5, 4); this.vy = p.random(0.3, 1.4);
    this.vx = p.random(-0.2, 0.2); this.a = p.random(60, 160);
  }
  update(p) { this.y += this.vy; this.x += this.vx; if (this.y > p.height + 10) this.reset(p); }
  draw(p)  { p.noStroke(); p.fill(255, this.a); p.ellipse(this.x, this.y, this.r); }
}

export class SettingsState {
  constructor(context) {
    this.ctx = context;
    this.snowflakes = [];
    this.modeBtn = null;
    this.backBtn = null;
    this.savedTextTimer = 0;
  }

  enter(p, data = {}) {
    this.snowflakes = Array.from({ length: 50 }, () => new Snowflake(p));
    this.buildUI(p);
    this.savedTextTimer = 0;
  }

  exit(p) {}

  buildUI(p) {
    const cx = p.width / 2;
    const sy = p.height * 0.45;

    this.modeBtn = new Button({
      label: this.getModeLabel(),
      x: cx, y: sy, w: 320, h: 52,
      fontSize: 12,
      onClick: () => this.toggleMode(),
    });

    this.backBtn = new Button({
      label: 'BACK', x: 70, y: p.height * 0.85, w: 100, h: 38, fontSize: 13,
      onClick: () => {
        this.ctx.stateManager.setState('MENU', p);
      },
    });
  }

  getModeLabel() {
    return CONFIG.CONTROL_MODE === 'body' ? 'MODE KINECT BODY' : 'MODE HANDS CAMERA';
  }

  toggleMode() {
    // Toggle
    CONFIG.CONTROL_MODE = CONFIG.CONTROL_MODE === 'hands' ? 'body' : 'hands';
    // Save to localStorage
    localStorage.setItem('controlMode', CONFIG.CONTROL_MODE);
    
    // Update button text
    this.modeBtn.label = this.getModeLabel();
    this.savedTextTimer = 60; // show "Saved!" for ~1 second
  }

  update(p, dt) {
    for (const s of this.snowflakes) s.update(p);
    this.modeBtn.update(p);
    this.backBtn.update(p);
    if (this.savedTextTimer > 0) this.savedTextTimer--;
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
    p.textSize(40);
    p.textAlign(p.CENTER, p.CENTER);
    p.text('SETTINGS', p.width / 2, p.height * 0.2);

    // Settings Panel Background
    const panelW = 420;
    const panelH = 200;
    p.fill(20, 28, 48, 200);
    p.rect(p.width / 2 - panelW/2, p.height / 2 - panelH/2 + 20, panelW, panelH, 12);

    p.fill(...CONFIG.CLR_ACCENT);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(12);
    p.text('CHOOSE STEERING CONTROL SCHEMA', p.width / 2, p.height * 0.36);

    // Description text for the active mode
    p.fill(160, 180, 220);
    p.textSize(9);
    p.textAlign(p.CENTER, p.TOP);
    let desc = '';
    if (CONFIG.CONTROL_MODE === 'body') {
      desc = 'STEER BY LEANING SHOULDERS LEFT OR RIGHT\nHOLD FISTS LIKE REINS FOR BEST RESULTS';
    } else {
      desc = 'STEER BY RAISING ONE HAND AND LOWERING THE OTHER\nWRISTS ARE TRACKED';
    }
    p.text(desc, p.width / 2, p.height * 0.53);

    // Saved notification
    if (this.savedTextTimer > 0) {
      p.fill(80, 220, 120, p.map(this.savedTextTimer, 0, 30, 0, 255, true));
      p.textSize(12);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('SAVED', p.width / 2 + 190, p.height * 0.45);
    }

    // Buttons
    this.modeBtn.draw(p);
    this.backBtn.draw(p);
  }

  mousePressed(p) {
    this.modeBtn.checkClick();
    this.backBtn.checkClick();
  }

  onResize(p, w, h) {
    this.buildUI(p);
  }
}
