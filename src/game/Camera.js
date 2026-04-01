/**
 * Camera.js — Viewport that follows the local player down the track.
 *
 * The player is pinned at 70 % from the top of the screen so the track
 * ahead is always visible.  Smooth-follow via lerp prevents jarring jumps.
 */

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.lerpSpeed = 0.1;
    /** Player rendered at this fraction from the TOP of the canvas. */
    this.playerScreenRatio = 0.7;
  }

  /** Update camera to follow a player. */
  follow(player, canvasH) {
    const targetY = player.y - canvasH * this.playerScreenRatio;
    this.y += (targetY - this.y) * this.lerpSpeed;
  }

  /** Convert world coordinates → screen coordinates. */
  worldToScreen(wx, wy) {
    return { x: wx - this.x, y: wy - this.y };
  }

  /** Check whether a world-Y coordinate is inside the visible viewport. */
  isVisible(wy, objHeight, canvasH) {
    const sy = wy - this.y;
    return sy + objHeight / 2 > -50 && sy - objHeight / 2 < canvasH + 50;
  }
}
