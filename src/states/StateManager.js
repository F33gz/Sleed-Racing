/**
 * StateManager.js — Finite state machine controlling Menu → Lobby → Game transitions.
 *
 * Each registered state must implement: enter(p,data), exit(p), update(p,dt), draw(p).
 * Optional: onResize(p,w,h), mousePressed(p), keyPressed(p,keyCode).
 */

export class StateManager {
  constructor() {
    /** @type {Object<string, Object>} */
    this.states = {};
    /** @type {Object|null} */
    this.current = null;
    this.currentName = '';
  }

  /** Register a state instance under a name (e.g. 'MENU'). */
  register(name, state) {
    this.states[name] = state;
  }

  /** Transition to a new state, calling exit() on the old and enter() on the new. */
  setState(name, p, data = {}) {
    if (this.current && this.current.exit) this.current.exit(p);
    this.currentName = name;
    this.current = this.states[name] || null;
    if (this.current) this.current.enter(p, data);
  }

  update(p, dt) { this.current?.update(p, dt); }
  draw(p)       { this.current?.draw(p); }
  onResize(p, w, h) { this.current?.onResize?.(p, w, h); }
  mousePressed(p)   { this.current?.mousePressed?.(p); }
  keyPressed(p, kc) { this.current?.keyPressed?.(p, kc); }
}
