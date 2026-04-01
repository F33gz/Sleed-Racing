/**
 * Physics.js — Frame-independent physics engine.
 *
 * Handles downhill acceleration (reaches MAX_DOWNHILL_SPEED in RAMP_UP_TIME),
 * horizontal steering, track-boundary clamping, and collision response (stun).
 */

import { CONFIG } from '@/config.js';

export class Physics {
  constructor() {
    /** Derived constant: px/s² */
    this.downhillAccel = CONFIG.MAX_DOWNHILL_SPEED / CONFIG.RAMP_UP_TIME;
  }

  /**
   * Advance the player's physics by one tick.
   * @param {Object} player  — Player instance (mutated in place)
   * @param {number} steerX  — horizontal steering input (px/s)
   * @param {number} dt      — delta time in seconds
   * @param {number} trackW  — current track / canvas width
   */
  update(player, steerX, dt, trackW) {
    // ── Stun recovery ──────────────────────────────────────────────
    if (player.isStunned) {
      player.stunTimer -= dt;
      if (player.stunTimer <= 0) {
        player.isStunned = false;
        player.stunTimer = 0;
        player.vy = 0; // Restart acceleration from zero after stun
      }
      return; // No movement while stunned
    }

    // ── Downhill acceleration ──────────────────────────────────────
    player.vy = Math.min(
      player.vy + this.downhillAccel * dt,
      CONFIG.MAX_DOWNHILL_SPEED,
    );

    // ── Horizontal steering ────────────────────────────────────────
    player.vx = steerX;

    // ── Integrate position ─────────────────────────────────────────
    player.y += player.vy * dt;
    player.x += player.vx * dt;

    // ── Clamp to track boundaries ──────────────────────────────────
    const halfW = CONFIG.PLAYER_WIDTH / 2;
    player.x = Math.max(halfW, Math.min(player.x, trackW - halfW));
  }

  /**
   * Test the player against all provided obstacles (AABB).
   * On first collision: full stop + stun.
   */
  checkCollisions(player, obstacles) {
    if (player.isStunned) return;

    for (const obs of obstacles) {
      if (this.aabb(player, obs)) {
        player.vx = 0;
        player.vy = 0;
        player.isStunned = true;
        player.stunTimer = CONFIG.STUN_DURATION;
        return; // Only one collision per frame
      }
    }
  }

  /** Axis-Aligned Bounding Box intersection test. */
  aabb(player, obs) {
    const pl = player.x - CONFIG.PLAYER_WIDTH / 2;
    const pr = player.x + CONFIG.PLAYER_WIDTH / 2;
    const pt = player.y - CONFIG.PLAYER_HEIGHT / 2;
    const pb = player.y + CONFIG.PLAYER_HEIGHT / 2;

    const ol = obs.x - obs.w / 2;
    const or_ = obs.x + obs.w / 2;
    const ot = obs.y - obs.h / 2;
    const ob = obs.y + obs.h / 2;

    return pl < or_ && pr > ol && pt < ob && pb > ot;
  }
}
