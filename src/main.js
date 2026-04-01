/**
 * main.js — Application entry point.
 *
 * Bootstraps p5.js in INSTANCE MODE. Preloads all game assets,
 * then wires up the state machine with shared context.
 *
 * The canvas is responsive but maintains CONFIG.ASPECT_RATIO.
 */

import p5 from 'p5';
import { CONFIG } from '@/config.js';
import { StateManager } from '@/states/StateManager.js';
import { MenuState } from '@/states/MenuState.js';
import { LobbyState } from '@/states/LobbyState.js';
import { GameState } from '@/states/GameState.js';
import { SettingsState } from '@/states/SettingsState.js';
import { SocketManager } from '@/network/SocketManager.js';
import { PoseController } from '@/controls/PoseController.js';

const sketch = (p) => {
  let stateManager;
  let lastTime;

  /** Calculate and apply CSS scaling to visually fit the 1000x610 canvas. */
  const setupCanvasScale = () => {
    const wRatio = window.innerWidth / window.innerHeight;
    let w, h;
    if (wRatio > CONFIG.ASPECT_RATIO) {
      h = window.innerHeight;
      w = h * CONFIG.ASPECT_RATIO;
    } else {
      w = window.innerWidth;
      h = w / CONFIG.ASPECT_RATIO;
    }
    p.canvas.style.width = `${Math.floor(w)}px`;
    p.canvas.style.height = `${Math.floor(h)}px`;
  };

  // ── p5 lifecycle ──────────────────────────────────────────────────

  p.setup = () => {
    // Create canvas exactly at the original logical resolution
    const canvas = p.createCanvas(1000, 610);
    canvas.parent('app');
    setupCanvasScale();

    p.textFont('Inter');
    p.imageMode(p.CORNER);
    p.cursor(p.ARROW);
    lastTime = p.millis();

    // Shared context
    const context = {
      stateManager: new StateManager(),
      poseController: new PoseController(),
      socketManager: new SocketManager(),
    };

    stateManager = context.stateManager;

    stateManager.register('MENU', new MenuState(context));
    stateManager.register('LOBBY', new LobbyState(context));
    stateManager.register('GAME', new GameState(context));
    stateManager.register('SETTINGS', new SettingsState(context));

    stateManager.setState('MENU', p);
  };

  p.draw = () => {
    const now = p.millis();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    stateManager.update(p, dt);
    stateManager.draw(p);
  };

  p.windowResized = () => {
    setupCanvasScale();
    stateManager.onResize(p, 1000, 610);
  };

  p.mousePressed = () => stateManager.mousePressed(p);
  p.keyPressed = () => stateManager.keyPressed(p, p.keyCode);
};

new p5(sketch);
