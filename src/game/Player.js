/**
 * Player.js — Player entity with FREE-FORM horizontal movement.
 *
 * Horizontal position is continuous (not lane-locked).
 * The nearest lane (0–8) is derived for tile collision lookup only.
 * Loads real penguin + tube sprites with directional variants.
 * Implements crash animation (52 frames) and jump animations.
 */

import { CONFIG } from '@/config.js';

export class Player {
  constructor(id, name, isLocal = false) {
    this.id = id;
    this.name = name;
    this.isLocal = isLocal;

    // Position (CSS-style, matching the original coordinate system)
    this.left = 0;
    this.top = 0;
    this.absLeft = 0;
    this.absTop = 0;

    // Free-form horizontal offset (replaces discrete laneX)
    // Range: 0 (leftmost) to MAX_OFFSET (rightmost)
    // Each original "lane" = LANE_STEP_PX wide, so max = 8 * LANE_STEP_PX = 192
    this.offsetX = CONFIG.LANE_STEP_PX;   // Start at ~lane 1
    this.hVel = 0;                         // Horizontal velocity (px/frame)

    // Physics
    this.speed = 0.5;
    this.finishDecay = 0.91 + Math.random() * 0.025;

    // State
    this.finished = false;
    this.finishTime = 0;
    this.crashed = false;
    this.crashState = 0;
    this.jumping = null;
    this.jumpState = 0;
    this.jumpMarginTop = 0;

    // Sprites
    this.sprites = {};
    this.tubeSprites = {};
    this.currentPenguin = 'default';
    this.currentTube = 'default';
    this.showShadow = false;
    this.tubeOffset = { x: 0, y: CONFIG.TUBE_TOP_OFFSET };

    // Turning sprite timer
    this._turnSpriteTimer = 0;

    // Remote interpolation
    this.targetLeft = 0;
    this.targetTop = 0;
    this.targetOffsetX = 0;
    this.lerpSpeed = 0.2;
  }

  /** Maximum horizontal offset (lane 8 position). */
  get maxOffset() { return 8 * CONFIG.LANE_STEP_PX; }

  /** Derive the nearest lane (0–8) from continuous offsetX for collision checks. */
  get laneX() {
    return Math.round(this.offsetX / CONFIG.LANE_STEP_PX);
  }

  preloadAssets(p) {
    this.sprites.default = p.loadImage(CONFIG.asset('/assets/Penguin/default.png'));
    this.sprites.left    = p.loadImage(CONFIG.asset('/assets/Penguin/left.png'));
    this.sprites.right   = p.loadImage(CONFIG.asset('/assets/Penguin/right.png'));
    this.sprites.back    = p.loadImage(CONFIG.asset('/assets/Penguin/back.png'));
    this.sprites.crashed = p.loadImage(CONFIG.asset('/assets/Penguin/crashed.gif'));

    this.tubeSprites.default = p.loadImage(CONFIG.asset('/assets/Tube/default.png'));
    this.tubeSprites.left    = p.loadImage(CONFIG.asset('/assets/Tube/left.png'));
    this.tubeSprites.right   = p.loadImage(CONFIG.asset('/assets/Tube/right.png'));
    this.tubeSprites.flipped = p.loadImage(CONFIG.asset('/assets/Tube/flipped.png'));
    this.tubeSprites.shadow  = p.loadImage(CONFIG.asset('/assets/Tube/shadow.png'));
  }

  setStartPosition(playerIndex) {
    const lane = 1 + playerIndex * 2;
    this.offsetX = lane * CONFIG.LANE_STEP_PX;

    // The absolute downhill backbone of the track is Lane 0. 
    // In original code, player 0 was at Visual(Left: 424, Top: 161) in Lane 1 (offset 24).
    // Therefore Lane 0 Backbone = VisualLeft + 24 = 448; VisualTop - 16 = 145.
    // ALL players share exactly the same backbone progressing down the track.
    this.left = 448;
    this.top = 145;

    this.speed = 0.5;
    this.hVel = 0;
    this.updateAbsolutePosition();
  }

  /**
   * Recalculate absolute downhill position.
   * Because lateral movement (offsetX) perfectly cancels out in the original 
   * while() loop, the absolute collision coordinate IS the Lane 0 backbone.
   */
  updateAbsolutePosition() {
    this.absLeft = this.left;
    this.absTop = this.top;
  }

  /**
   * Apply continuous horizontal steering.
   * @param {number} steerInput — horizontal velocity in px/frame (negative=left, positive=right)
   */
  steer(steerInput) {
    if (this.jumping || this.crashed || this.finished) {
      this.hVel = 0;
      return;
    }
    this.hVel = steerInput;
  }

  /** Update remote player position (network interpolation). */
  setRemoteTarget(left, top, offsetX) {
    this.targetLeft = left;
    this.targetTop = top;
    this.targetOffsetX = offsetX ?? this.offsetX;
  }

  /**
   * Per-frame update.
   */
  update(track) {
    if (!this.isLocal) {
      this.left += (this.targetLeft - this.left) * this.lerpSpeed;
      this.top += (this.targetTop - this.top) * this.lerpSpeed;
      this.offsetX += (this.targetOffsetX - this.offsetX) * this.lerpSpeed;
      this.updateAbsolutePosition();
      return;
    }

    // ── Horizontal movement (free-form) ────────────────────────────
    if (this.hVel !== 0) {
      // Positive hVel means steering RIGHT. Steering right moves TOWARDS Lane 0.
      // So moving right DECREASES offsetX. Moving left INCREASES offsetX.
      this.offsetX -= this.hVel;
      this.offsetX = Math.max(0, Math.min(this.offsetX, this.maxOffset));

      // Show turning sprite based on movement direction
      if (this.hVel < -0.3) {
        this.currentPenguin = 'left';
        this.currentTube = 'left';
        this._turnSpriteTimer = 4;
      } else if (this.hVel > 0.3) {
        this.currentPenguin = 'right';
        this.currentTube = 'right';
        this._turnSpriteTimer = 4;
      }
    }

    // Turn sprite reset
    if (this._turnSpriteTimer > 0) {
      this._turnSpriteTimer--;
      if (this._turnSpriteTimer === 0 && !this.crashed) {
        this.currentPenguin = 'default';
        this.currentTube = 'default';
      }
    }

    // ── Vertical physics (downhill) ──────────────────────────────────
    const finishLeft = track.getFinishLeft() + 245;
    if (this.absLeft >= finishLeft) {
      this.speed *= this.finishDecay;
      if (!this.finished) {
        this.finished = true;
        this.finishTime = Date.now();
      }
    }
    else if (this.crashed && this.crashState > 0) {
      this.speed *= CONFIG.CRASH_DECAY;
      this.animateCrash();
    }
    else if (this.speed < CONFIG.MAX_SPEED) {
      this.speed += CONFIG.GRAVITY;
      if (this.speed > CONFIG.MAX_SPEED) this.speed = CONFIG.MAX_SPEED;
    }
    else if (this.speed > CONFIG.MAX_SPEED) {
      this.speed *= CONFIG.DECAY;
      if (this.speed < CONFIG.MAX_SPEED) this.speed = CONFIG.MAX_SPEED;
    }
    else {
      this.speed = CONFIG.MAX_SPEED;
    }

    if (this.speed < CONFIG.MIN_SPEED_THRESHOLD) {
      this.speed = 0;
    }

    // Background speed correction
    const finishL = track.getFinishLeft();
    const pc = (this.absLeft / finishL) * 100;
    let effectiveSpeed = this.speed;
    if (this.speed >= CONFIG.MAX_SPEED / 2 && pc > 42) {
      effectiveSpeed += 0.0166 * this.speed;
    }

    // Move downhill
    this.left += effectiveSpeed * CONFIG.X_MULTIPLIER;
    this.top += effectiveSpeed;
    this.updateAbsolutePosition();

    // Jump animation
    if (this.jumping) {
      this.animateJump();
    }
  }

  // ── Triggers ──────────────────────────────────────────────────────

  triggerCrash() {
    if (this.crashed || this.jumping) return;
    this.crashed = true;
    this.crashState = 1;
    this.hVel = 0;
    this.currentPenguin = 'right';
    this.currentTube = 'right';
  }

  triggerBoost() {
    this.speed = CONFIG.BOOST_SPEED;
  }

  triggerJump(size) {
    if (this.jumping || this.crashed) return;
    this.jumping = size;
    this.jumpState = 1;
    this.jumpMarginTop = 0;
  }

  // ── Animation sequences ──────────────────────────────────────────

  animateCrash() {
    switch (this.crashState) {
      case 3:
        this.currentPenguin = 'crashed';
        this.currentTube = 'flipped';
        break;
      case 5:
        this.showShadow = true;
        break;
      case 8:
        this.tubeOffset = { x: -42, y: -12 };
        break;
      case CONFIG.CRASH_RECOVER_FRAME:
        this.currentPenguin = 'default';
        this.currentTube = 'default';
        this.showShadow = false;
        this.tubeOffset = { x: 0, y: CONFIG.TUBE_TOP_OFFSET };
        this.crashed = false;
        this.crashState = 0;
        return;
    }
    this.crashState++;
  }

  animateJump() {
    const s = this.jumpState;
    const type = this.jumping;

    let backFrame, landFrame, endFrame;

    switch (type) {
      case 'small':
        backFrame = 4; landFrame = 10; endFrame = 14;
        this.jumpMarginTop = s >= 4 && s < landFrame ? -13 : 0;
        break;
      case 'medium':
        backFrame = 5; landFrame = 12; endFrame = 17;
        this.jumpMarginTop = s >= 5 && s < landFrame ? -18 : 0;
        break;
      case 'large':
        backFrame = 14; endFrame = 26; landFrame = 23;
        if (s >= 3 && s < 23) {
          const peak = -56;
          if (s <= 12) this.jumpMarginTop = -14 * Math.floor(s / 3);
          else if (s === 14) this.jumpMarginTop = peak;
          else if (s > 14) {
            const steps = [peak, -40, -20, -10, 0];
            const idx = Math.floor((s - 16) / 2);
            this.jumpMarginTop = idx < steps.length ? steps[idx] : 0;
          }
        } else {
          this.jumpMarginTop = 0;
        }
        break;
      case 'mega':
        backFrame = 29; endFrame = 50; landFrame = 47;
        if (s >= 3 && s < 47) {
          if (s <= 27) this.jumpMarginTop = -15 * Math.floor(s / 3);
          else if (s >= 31) {
            const steps = [-145, -125, -105, -85, -65, -45, -25, -5, 0];
            const idx = Math.floor((s - 31) / 2);
            this.jumpMarginTop = idx < steps.length ? steps[idx] : 0;
          }
        } else {
          this.jumpMarginTop = 0;
        }
        break;
      default: return;
    }

    if (s === backFrame) {
      this.currentPenguin = 'back';
      this.showShadow = true;
    }
    if (s === landFrame) {
      this.showShadow = false;
      this.currentPenguin = 'default';
    }
    if (s >= endFrame) {
      this.jumping = null;
      this.jumpState = 0;
      this.jumpMarginTop = 0;
      this.showShadow = false;
      this.currentPenguin = 'default';
      return;
    }
    this.jumpState++;
  }

  // ── Rendering ──────────────────────────────────────────────────────

  draw(p, cameraX, cameraY) {
    // Isometric render position from Lane 0 backbone
    // offsetX > 0 means higher lane (visual shifting left and down in isometric)
    const isoOffsetX = -this.offsetX;
    const isoOffsetY = (this.offsetX / CONFIG.LANE_STEP_PX) * CONFIG.LANE_STEP_Y;
    
    const sx = this.left + isoOffsetX + cameraX;
    const sy = this.top + isoOffsetY + cameraY + this.jumpMarginTop;

    p.push();
    p.translate(sx, sy);

    // Name tag
    p.fill(255);
    p.stroke(0);
    p.strokeWeight(2);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(14);
    p.textFont('sans-serif');
    p.text(this.name, CONFIG.PLAYER_WIDTH / 2, -12);
    p.noStroke();

    // Shadow
    if (this.showShadow && this.tubeSprites.shadow) {
      p.image(this.tubeSprites.shadow, 7, 27 - this.jumpMarginTop, 36, 23);
    }

    // Tube
    const tubeImg = this.tubeSprites[this.currentTube];
    if (tubeImg) {
      const tw = (tubeImg.width / tubeImg.height) * CONFIG.TUBE_HEIGHT;
      p.image(tubeImg, this.tubeOffset.x, this.tubeOffset.y, tw, CONFIG.TUBE_HEIGHT);
    }

    // Penguin
    const penguinImg = this.sprites[this.currentPenguin];
    if (penguinImg) {
      const h = this.currentPenguin === 'crashed' ? CONFIG.PENGUIN_CRASHED_HEIGHT : CONFIG.PENGUIN_HEIGHT;
      const ox = this.currentPenguin === 'crashed' ? -13 : 0;
      const oy = this.currentPenguin === 'crashed' ? -15 : 1;
      const pw = (penguinImg.width / penguinImg.height) * h;
      p.image(penguinImg, ox, oy, pw, h);
    }

    p.pop();
  }

  /** Serialise for network. */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      left: this.left,
      top: this.top,
      offsetX: this.offsetX,
      speed: this.speed,
      crashed: this.crashed,
      jumping: this.jumping,
    };
  }
}
