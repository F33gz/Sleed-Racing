/**
 * ChatBox.js — Lobby chat interface rendered in p5 with a positioned HTML input.
 *
 * Messages are drawn inside a clipped p5 region.
 * Text entry uses the hidden #chat-msg-input HTML element, shown and positioned
 * at the bottom of the chat panel when the lobby is active.
 */

import { CONFIG } from '@/config.js';

export class ChatBox {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;

    /** @type {{ sender:string, text:string }[]} */
    this.messages = [];

    this.inputEl = document.getElementById('chat-msg-input');
    this.onSend = null; // Callback: (text) => void
  }

  /** Show the HTML input and bind the Enter-key handler. */
  activate(canvas, onSend) {
    this.onSend = onSend;
    if (!this.inputEl) return;

    const rect = canvas.getBoundingClientRect();
    const ratioX = rect.width / 1000;
    const ratioY = rect.height / 610;
    
    const inputH = 34 * ratioY;

    Object.assign(this.inputEl.style, {
      display: 'block',
      left: `${rect.left + (this.x + 6) * ratioX}px`,
      top: `${rect.top + (this.y + this.h - 6) * ratioY - inputH}px`,
      width: `${(this.w - 12) * ratioX}px`,
      height: `${inputH}px`,
      fontSize: `${Math.max(10, 13 * ratioY)}px`,
      padding: '0 8px',
      boxSizing: 'border-box',
    });

    this.inputEl.value = '';
    this.inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const text = this.inputEl.value.trim();
        if (text && this.onSend) {
          this.onSend(text);
          this.inputEl.value = '';
        }
      }
      e.stopPropagation(); // Don't let p5 capture these keys
    };
  }

  /** Hide the HTML input. */
  deactivate() {
    if (this.inputEl) {
      this.inputEl.style.display = 'none';
      this.inputEl.onkeydown = null;
    }
  }

  /** Push a new message (auto-scrolls). */
  addMessage(sender, text) {
    this.messages.push({ sender, text });
    // Cap history
    if (this.messages.length > 100) this.messages.shift();
  }

  draw(p) {
    p.push();

    // Panel background
    p.fill(15, 20, 35, 200);
    p.stroke(...CONFIG.CLR_ACCENT, 50);
    p.strokeWeight(1);
    p.rectMode(p.CORNER);
    p.rect(this.x, this.y, this.w, this.h, 10);

    // Header
    p.noStroke();
    p.fill(...CONFIG.CLR_TEXT);
    p.textFont(CONFIG.FONT_BODY);
    p.textSize(14);
    p.textStyle(p.BOLD);
    p.textAlign(p.LEFT, p.TOP);
    p.text('Chat', this.x + 14, this.y + 12);
    p.textStyle(p.NORMAL);

    // Messages (bottom-up, leave space for input)
    const lineH = 18;
    const padX = this.x + 14;
    const areaBottom = this.y + this.h - 48;
    const maxLines = Math.floor((areaBottom - (this.y + 38)) / lineH);
    const visible = this.messages.slice(-maxLines);

    p.textSize(12);
    for (let i = 0; i < visible.length; i++) {
      const m = visible[i];
      const ly = this.y + 38 + i * lineH;

      p.fill(...CONFIG.CLR_ACCENT);
      p.textAlign(p.LEFT, p.TOP);
      p.text(m.sender + ':', padX, ly);

      p.fill(...CONFIG.CLR_TEXT_DIM);
      const nameW = p.textWidth(m.sender + ': ');
      p.text(m.text, padX + nameW, ly);
    }

    p.pop();
  }
}
