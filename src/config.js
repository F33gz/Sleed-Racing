/**
 * config.js — Single source of truth for ALL tunable game constants.
 *
 * Values extracted from the original Club Penguin Sled Racing reference:
 *   gravity=0.5, maxSpeed=5, boostSpeed=16, decay=0.98, crashDecay=0.95
 *   XMultiplier=249/149 (isometric ratio), tile size 249×149 px
 */

export const CONFIG = {
  // ── Canvas ───────────────────────────────────────────────────────────
  ASPECT_RATIO: 1000 / 610,         // Original game: 1000×610

  // ── Physics (from original Game.js) ──────────────────────────────────
  GRAVITY: 0.5,                      // Speed increment per frame until maxSpeed
  MAX_SPEED: 5,                      // Normal terminal velocity (px/frame)
  BOOST_SPEED: 16,                   // Speed when hitting ice (tile type 99)
  DECAY: 0.98,                       // Speed decay when above maxSpeed
  CRASH_DECAY: 0.95,                 // Speed decay during crash animation
  X_MULTIPLIER: 249 / 149,           // Isometric horizontal-to-vertical ratio
  MIN_SPEED_THRESHOLD: 0.4,          // Speed below this is clamped to 0

  // ── Steering (free-form horizontal movement) ──────────────────────────
  LANE_COUNT: 9,                     // Virtual lanes for collision lookup
  LANE_STEP_PX: 24,                  // Pixels per virtual lane (collision grid)
  LANE_STEP_Y: 16,                   // = 24 / 1.5 — vertical offset per lane step
  // ── Controls ──────────────────────────────────────────────────────────
  CONTROL_MODE: localStorage.getItem('controlMode') || 'hands', // 'hands' or 'body'

  // ── HandPose ─────────────────────────────────────────────────────────
  HAND_SENSITIVITY: 1.0,             // Base multiplier for |Δy| → raw steering
  HAND_DEADZONE: 10,                 // Min |Δy| before steering activates
  HAND_MAX_DELTA: 85,                // REDUCED: Requires less vertical hand stretch for max speed
  HAND_MAX_SPEED: 6.5,               // Max horizontal px/frame from hands
  HAND_SMOOTHING: 0.35,              // Lerp factor
  HAND_CURVE: 1.5,                   // Power curve

  // ── BodyPose (Kinect style leaning) ──────────────────────────────────
  BODY_SENSITIVITY: 1.0,             // Base multiplier for shoulder |Δy|
  BODY_DEADZONE: 6,                  // Min |Δy| (shoulders move less than hands)
  BODY_MAX_DELTA: 30,                // REDUCED DRASTICALLY: A slight shoulder lean now gives max speed
  BODY_MAX_SPEED: 6.5,               // Max speed
  BODY_SMOOTHING: 0.25,              // Body is naturally smoother/slower, need less artificial lerp
  BODY_CURVE: 1.5,                   // Power curve

  // ── Tiles ────────────────────────────────────────────────────────────
  TILE_WIDTH: 249,                   // Each tile's horizontal span
  TILE_HEIGHT: 149,                  // Each tile's vertical span
  TILE_IMG_HEIGHT: 303,              // Default tile image height (px)
  TILE_ROWS: 9,                      // Collision map rows per tile
  TILE_ROW_HEIGHT: 16.5555556,       // = ~149/9 — vertical step for collision checking
  START_TILE_LEFT: 485,              // First tile's left offset
  START_TILE_TOP: 318,               // First tile's top offset

  // ── Player ───────────────────────────────────────────────────────────
  PLAYER_START_LEFT: 424,            // Starting X position of first player
  PLAYER_START_TOP: 161,             // Starting Y position of first player
  PLAYER_WIDTH: 55,                  // Player DOM element width
  PLAYER_HEIGHT: 65,                 // Player DOM element height
  PENGUIN_HEIGHT: 60,                // Penguin sprite height
  PENGUIN_CRASHED_HEIGHT: 90,        // Penguin crashed sprite height
  TUBE_HEIGHT: 41,                   // Tube sprite height
  TUBE_TOP_OFFSET: 24,              // Tube Y offset from player top

  // ── Crash animation sequence (from Game.js movePlayer) ───────────────
  CRASH_TOTAL_FRAMES: 52,           // Total frames in crash animation
  CRASH_TUBE_DETACH_FRAME: 3,       // Frame where tube visually separates
  CRASH_SHADOW_FRAME: 5,            // Frame where shadow appears
  CRASH_RECOVER_FRAME: 52,          // Frame where crash ends

  // ── Finish ───────────────────────────────────────────────────────────
  FINISH_DECAY_MIN: 0.91,           // Min deceleration after finish line
  FINISH_DECAY_MAX: 0.935,          // Max deceleration after finish line

  // ── Network ──────────────────────────────────────────────────────────
  SERVER_URL: 'http://localhost:3000',
  POSITION_SYNC_RATE: 50,

  // ── UI / Fonts ───────────────────────────────────────────────────────
  FONT_HEADER: "'Arial', sans-serif",
  FONT_BODY: "'Arial', sans-serif",

  // ── Colors ───────────────────────────────────────────────────────────
  CLR_BG_DARK: [10, 14, 23],
  CLR_BG_MID: [20, 28, 45],
  CLR_ACCENT: [90, 130, 210],
  CLR_ACCENT_GLOW: [120, 160, 240],
  CLR_TEXT: [220, 230, 255],
  CLR_TEXT_DIM: [130, 145, 175],
  CLR_SKY_TOP: [0, 94, 139],        // Original gradient top
  CLR_SKY_BOTTOM: [2, 81, 116],     // Original gradient bottom
  CLR_SNOW_LIGHT: [235, 240, 248],
  CLR_SNOW_DARK: [218, 226, 240],
  CLR_PLAYER_LOCAL: [60, 130, 230],
  CLR_PLAYER_REMOTE: [230, 110, 65],
};
