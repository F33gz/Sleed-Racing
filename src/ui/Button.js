/**
 * Button.js — Reusable p5‑rendered button with hover glow and scale animation.
 *
 * Usage:
 *   const btn = new Button({ label:'Play', x:400, y:300, w:200, h:50, onClick:()=>{} });
 *   btn.update(p);   // call every frame
 *   btn.draw(p);     // call every frame
 *   btn.checkClick(p); // call in mousePressed
 */

import { CONFIG } from '@/config.js';

export class Button {
  constructor({ label, x, y, w, h, onClick, fontSize = 16 }) {
    this.label = label;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.onClick = onClick;
    this.fontSize = fontSize;

    // Animation state
    this.hover = 0;       // 0 → 1 interpolated hover amount
    this.isHovered = false;
  }

  /** Reposition (useful after canvas resize). */
  setPosition(x, y) { this.x = x; this.y = y; }

  /** Call every frame to animate hover transitions. */
  update(p) {
    this.isHovered =
      p.mouseX >= this.x - this.w / 2 &&
      p.mouseX <= this.x + this.w / 2 &&
      p.mouseY >= this.y - this.h / 2 &&
      p.mouseY <= this.y + this.h / 2;

    this.hover = p.lerp(this.hover, this.isHovered ? 1 : 0, 0.14);
  }

  /** Render the button. */
  draw(p) {
    p.push();
    p.translate(this.x, this.y);

    const s = 1 + this.hover * 0.04;
    p.scale(s);

    // Outer glow
    if (this.hover > 0.01) {
      p.noStroke();
      p.fill(...CONFIG.CLR_ACCENT_GLOW, this.hover * 25);
      p.rectMode(p.CENTER);
      p.rect(0, 0, this.w + 14, this.h + 14, 14);
    }

    // Background
    const bg = CONFIG.CLR_BG_MID.map((c, i) =>
      p.lerp(c, CONFIG.CLR_ACCENT[i], this.hover * 0.35),
    );
    p.fill(...bg, 210 + this.hover * 45);
    p.stroke(...CONFIG.CLR_ACCENT, 70 + this.hover * 130);
    p.strokeWeight(1.5);
    p.rectMode(p.CENTER);
    p.rect(0, 0, this.w, this.h, 10);

    // Label
    p.noStroke();
    p.fill(...CONFIG.CLR_TEXT);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(this.fontSize);
    p.textFont(CONFIG.FONT_BODY);
    p.text(this.label, 0, -1);

    p.pop();
  }

  /** Call inside mousePressed — returns true if the button was clicked. */
  checkClick() {
    if (this.isHovered && this.onClick) {
      this.onClick();
      return true;
    }
    return false;
  }
}
