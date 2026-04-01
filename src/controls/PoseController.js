/**
 * PoseController.js — Unified controller for ml5.js v1 Pose tracking.
 *
 * Supports two modes:
 * - 'hands': Uses ml5.handPose, tracks wrists (deltaY).
 * - 'body': Uses ml5.bodyPose, tracks shoulders (deltaY).
 */

import { CONFIG } from '@/config.js';

export class PoseController {
  constructor() {
    this.mode = 'hands';
    this.model = null; // Either handPose or bodyPose
    this.video = null;
    this.isReady = false;
    this.steeringX = 0;
    
    // Extracted data for HUD
    this.rawDeltaY = 0;
    this.leftPoint = null;
    this.rightPoint = null;
    this.keypoints = []; // Raw array of keypoints for drawing
  }

  /**
   * Switch between hands and body modes on the fly.
   */
  async switchMode(p, newMode) {
    if (this.mode === newMode && this.isReady) return;
    console.log(`[PoseController] Switching mode to: ${newMode}`);
    this.stop();
    this.mode = newMode;
    await this.init(p);
  }

  /**
   * Initialise the webcam feed and start the ML model.
   */
  async init(p) {
    if (this.isReady) return;

    try {
      if (!this.video) {
        this.video = p.createCapture(p.VIDEO, { flipped: true });
        this.video.size(320, 240);
        this.video.hide();
      }

      if (typeof ml5 === 'undefined') {
        console.warn('[PoseController] ml5.js not loaded — camera tracking unavailable.');
        return;
      }

      if (this.mode === 'hands') {
        this.model = await ml5.handPose({ maxHands: 2, flipped: true });
        this.model.detectStart(this.video.elt, (results) => {
          this.processHands(results);
        });
        console.log('[PoseController] Initialised Mode: Controls Six/Seven (Hands)');
      } else if (this.mode === 'body') {
        // Use bodyPose (MoveNet by default in ml5 v1)
        this.model = await ml5.bodyPose({ flipped: true });
        this.model.detectStart(this.video.elt, (results) => {
          this.processBody(results);
        });
        console.log('[PoseController] Initialised Mode: Control Body (Kinect)');
      }

      this.isReady = true;
    } catch (err) {
      console.error('[PoseController] Init failed:', err);
    }
  }

  /** Process results for HandPose (Wrists) */
  processHands(hands) {
    if (!hands || hands.length < 2) {
      this.resetData();
      return;
    }

    let left = null;
    let right = null;
    this.keypoints = [];

    for (const h of hands) {
      this.keypoints.push(...h.keypoints);
      if (h.handedness === 'Left') left = h;
      if (h.handedness === 'Right') right = h;
    }

    if (!left || !right) {
      this.resetData();
      return;
    }

    // Index 0 in HandPose is the wrist
    this.leftPoint = left.keypoints[0];
    this.rightPoint = right.keypoints[0];
    this.calculateSteering(CONFIG.HAND_DEADZONE, CONFIG.HAND_SENSITIVITY);
  }

  /** Process results for BodyPose (Shoulders) */
  processBody(poses) {
    if (!poses || poses.length === 0) {
      this.resetData();
      return;
    }

    // Get the first person detected
    const pose = poses[0];
    this.keypoints = pose.keypoints;

    // In ml5.bodyPose, keypoints are usually objects with a 'name', 'x', 'y', 'confidence'.
    // MoveNet names: 'left_shoulder', 'right_shoulder'
    const leftShoulder = pose.keypoints.find(k => k.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find(k => k.name === 'right_shoulder');

    // Make sure we have decent confidence in the shoulders
    if (!leftShoulder || !rightShoulder || leftShoulder.confidence < 0.2 || rightShoulder.confidence < 0.2) {
      this.resetData();
      return;
    }

    this.leftPoint = leftShoulder;
    this.rightPoint = rightShoulder;
    this.calculateSteering(CONFIG.BODY_DEADZONE, CONFIG.BODY_SENSITIVITY);
  }

  calculateSteering(deadzone, sensitivity) {
    // Normal cartesian Y: rightY - leftY. 
    // Positive delta = right lower (steering right)
    // Negative delta = left lower (steering left)
    const deltaY = this.rightPoint.y - this.leftPoint.y;
    this.rawDeltaY = deltaY;

    if (Math.abs(deltaY) < deadzone) {
      this.steeringX = 0;
    } else {
      this.steeringX = deltaY * sensitivity;
    }
  }

  resetData() {
    this.steeringX = 0;
    this.rawDeltaY = 0;
    this.leftPoint = null;
    this.rightPoint = null;
    this.keypoints = [];
  }

  getSteering() {
    return this.steeringX;
  }

  stop() {
    if (this.model) this.model.detectStop?.();
    if (this.video) {
        this.video.remove();
        this.video = null;
    }
    this.resetData();
    this.model = null;
    this.isReady = false;
  }
}
