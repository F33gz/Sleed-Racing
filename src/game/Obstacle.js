/**
 * Obstacle.js — Three obstacle types drawn as placeholder shapes.
 *
 * Rock        — gray elliptical boulder
 * TreeStump   — brown cylinder with ring detail
 * LogBarrier  — wide horizontal log spanning part of the track
 *
 * Each has an (x, y, w, h) bounding box used for AABB collision in Physics.js.
 */

import { CONFIG } from '@/config.js';

// ── Base class ─────────────────────────────────────────────────────────
class Obstacle {
  constructor(x, y, w, h, type) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
  }

  draw(p, camera) {
    const s = camera.worldToScreen(this.x, this.y);
    p.push();
    p.translate(s.x, s.y);
    this.render(p);
    p.pop();
  }

  /** Override in subclasses. */
  render(p) {
    p.fill(150);
    p.rectMode(p.CENTER);
    p.noStroke();
    p.rect(0, 0, this.w, this.h);
  }
}

// ── Rock ───────────────────────────────────────────────────────────────
export class Rock extends Obstacle {
  constructor(x, y) {
    super(x, y, CONFIG.ROCK_WIDTH, CONFIG.ROCK_HEIGHT, 'rock');
  }

  render(p) {
    p.noStroke();
    p.fill(110, 105, 100);
    p.ellipse(0, 2, this.w, this.h * 0.9);
    p.fill(135, 130, 125);
    p.ellipse(-2, -2, this.w * 0.65, this.h * 0.55);
    // Snow cap
    p.fill(220, 225, 235, 160);
    p.ellipse(0, -this.h * 0.2, this.w * 0.5, this.h * 0.25);
  }
}

// ── Tree Stump ─────────────────────────────────────────────────────────
export class TreeStump extends Obstacle {
  constructor(x, y) {
    super(x, y, CONFIG.STUMP_WIDTH, CONFIG.STUMP_HEIGHT, 'stump');
  }

  render(p) {
    p.noStroke();
    // Trunk
    p.fill(90, 60, 30);
    p.rectMode(p.CENTER);
    p.rect(0, this.h * 0.12, this.w * 0.65, this.h * 0.65, 3);
    // Top
    p.fill(115, 78, 40);
    p.ellipse(0, -this.h * 0.12, this.w, this.h * 0.42);
    // Rings
    p.noFill();
    p.stroke(80, 50, 22);
    p.strokeWeight(1);
    p.ellipse(0, -this.h * 0.12, this.w * 0.5, this.h * 0.2);
  }
}

// ── Log Barrier ────────────────────────────────────────────────────────
export class LogBarrier extends Obstacle {
  constructor(x, y) {
    super(x, y, CONFIG.LOG_WIDTH, CONFIG.LOG_HEIGHT, 'log');
  }

  render(p) {
    p.noStroke();
    // Main log body
    p.fill(95, 62, 28);
    p.rectMode(p.CENTER);
    p.rect(0, 0, this.w, this.h, this.h / 2);
    // Bark lines
    p.stroke(72, 45, 18);
    p.strokeWeight(1);
    for (let i = -this.w * 0.35; i < this.w * 0.35; i += 14) {
      p.line(i, -this.h * 0.28, i, this.h * 0.28);
    }
    // End cross-sections
    p.noStroke();
    p.fill(135, 100, 55);
    p.ellipse(-this.w / 2, 0, this.h, this.h);
    p.ellipse(this.w / 2, 0, this.h, this.h);
  }
}

// ── Factory ────────────────────────────────────────────────────────────
export function createObstacle(type, x, y) {
  switch (type) {
    case 'rock':  return new Rock(x, y);
    case 'stump': return new TreeStump(x, y);
    case 'log':   return new LogBarrier(x, y);
    default:      return new Rock(x, y);
  }
}
