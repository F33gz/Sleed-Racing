/**
 * PlayerList.js — Renders a vertical list of connected players in the lobby.
 *
 * Each entry shows the player name and a ready indicator (green dot / gray dot).
 */

import { CONFIG } from '@/config.js';

export class PlayerList {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    /** @type {{ id:string, name:string, ready:boolean }[]} */
    this.players = [];
  }

  setPlayers(list) {
    this.players = list;
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
    p.text('Players', this.x + 14, this.y + 12);
    p.textStyle(p.NORMAL);

    // Player rows
    const rowH = 32;
    const startY = this.y + 40;

    for (let i = 0; i < this.players.length; i++) {
      const pl = this.players[i];
      const ry = startY + i * rowH;

      if (ry + rowH > this.y + this.h) break; // Clip

      // Ready indicator dot
      p.fill(pl.ready ? [80, 210, 120] : [100, 100, 120]);
      p.noStroke();
      p.ellipse(this.x + 24, ry + rowH / 2, 10, 10);

      // Name
      p.fill(...CONFIG.CLR_TEXT);
      p.textSize(13);
      p.textAlign(p.LEFT, p.CENTER);
      p.text(pl.name, this.x + 38, ry + rowH / 2);
    }

    p.pop();
  }
}
