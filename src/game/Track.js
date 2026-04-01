/**
 * Track.js — Tile-based track renderer.
 *
 * Faithfully replicates the original Sled Racing track system:
 * - Isometric tiles placed diagonally (each offset by TILE_WIDTH, TILE_HEIGHT)
 * - Start tile, numbered tiles, 20_A extension tile, and Finish tile
 * - Cloud parallax layer
 * - Background gradient (ocean blue)
 * - Mini-map progress bar
 *
 * The track is built from a map array of tile-type indices.
 */

import { CONFIG } from '@/config.js';
import { HILL_TILES, MAPS, MAP_NAMES } from './TileData.js';

export class Track {
  constructor() {
    /** @type {{ type: number|string, left: number, top: number }[]} */
    this.tileMap = [];
    this.mapTiles = [];  // The full tile sequence including 20_A expansions
    this.mapIndex = 0;
    this.mapName = '';

    // Assets (loaded in preload)
    this.tileImages = {};
    this.bgImage = null;
    this.cloudsImage = null;
    this.finishLineImage = null;
    this.clappingGifs = [];
    this.cornerImage = null;
  }

  /**
   * Preload all tile images.
   * @param {Object} p — p5 instance
   */
  preloadAssets(p) {
    // Hill tiles 0–20
    for (let i = 0; i <= 20; i++) {
      this.tileImages[i] = p.loadImage(CONFIG.asset(`/assets/HillTiles/${i}.png`));
    }
    this.tileImages['20_A'] = p.loadImage(CONFIG.asset('/assets/HillTiles/20_A.png'));
    this.tileImages['Start'] = p.loadImage(CONFIG.asset('/assets/HillTiles/Start.png'));
    this.tileImages['Finish'] = p.loadImage(CONFIG.asset('/assets/HillTiles/Finish.png'));

    this.bgImage = p.loadImage(CONFIG.asset('/assets/Background.png'));
    this.cloudsImage = p.loadImage(CONFIG.asset('/assets/Clouds.png'));
    this.finishLineImage = p.loadImage(CONFIG.asset('/assets/FinishLine.png'));
    this.cornerImage = p.loadImage(CONFIG.asset('/assets/MapCorner.png'));

    this.clappingGifs[0] = p.loadImage(CONFIG.asset('/assets/Clapping/1.gif'));
    this.clappingGifs[1] = p.loadImage(CONFIG.asset('/assets/Clapping/2.gif'));
  }

  /**
   * Build the track from a map index (0–3).
   * Replicates LoadMap() from the original Maps.js.
   */
  loadMap(mapIndex) {
    this.mapIndex = mapIndex;
    this.mapName = MAP_NAMES[mapIndex] || 'Unknown';

    // Clone the raw map
    const rawMap = [...MAPS[mapIndex]];

    // First tile goes to position 2 (replacing the initial placeholder)
    const firstTileType = rawMap.shift();

    // Build the full tile sequence: [0 (start default), firstTileType, ...rest, 'Finish']
    // The original starts with tiles at fixed positions, then appends rest
    this.mapTiles = [0, firstTileType];

    for (const t of rawMap) {
      this.mapTiles.push(t);
      // Tile 20 auto-adds a 20_A extension tile
      if (t === 20) {
        this.mapTiles.push('20_A');
      }
    }
    this.mapTiles.push('Finish');

    // Build the tile position map
    // First two tiles have hardcoded positions in the original:
    //   tile-0: left=485, top=318
    //   tile-1: left=734, top=467
    this.tileMap = [];
    let left = CONFIG.START_TILE_LEFT;
    let top = CONFIG.START_TILE_TOP;

    for (let i = 0; i < this.mapTiles.length; i++) {
      this.tileMap.push({
        type: this.mapTiles[i],
        left: left,
        top: top,
      });
      left += CONFIG.TILE_WIDTH;
      top += CONFIG.TILE_HEIGHT;
    }
  }

  /** Get the finish line left position. */
  getFinishLeft() {
    return this.tileMap.length > 0
      ? this.tileMap[this.tileMap.length - 1].left
      : 99999;
  }

  /** Get collision value at a given lane (x) and tile row (tilePos) for a tile type. */
  getCollision(tileType, laneX, tileRow) {
    const tile = HILL_TILES[tileType];
    if (!tile || !tile.map || laneX < 0 || laneX >= 9 || tileRow < 0 || tileRow >= 9) {
      return 0;
    }
    return tile.map[laneX][tileRow];
  }

  /**
   * Draw the track.
   * @param {Object} p — p5 instance
   * @param {number} cameraX — camera left offset (tiles container left)
   * @param {number} cameraY — camera top offset (tiles container top)
   * @param {number} cloudsX — parallax cloud position
   */
  draw(p, cameraX, cameraY, cloudsX) {
    // Background gradient
    this.drawBackground(p);

    // Clouds (parallax)
    if (this.cloudsImage) {
      p.image(this.cloudsImage, cloudsX, 100);
    }

    // Corner decoration
    if (this.cornerImage) {
      p.image(this.cornerImage, 0, p.height - this.cornerImage.height);
    }

    // Draw tiles
    p.push();
    p.translate(cameraX, cameraY);

    // Start tile
    if (this.tileImages['Start']) {
      const img = this.tileImages['Start'];
      const w = (img.width / img.height) * 371;
      p.image(img, -18, 101, w, 371);
    }

    // Map tiles
    for (let i = 0; i < this.tileMap.length; i++) {
      const tile = this.tileMap[i];
      const key = tile.type;
      const img = this.tileImages[key];
      
      if (img) {
        let drawX = tile.left;
        let drawY = tile.top;
        
        // Base tile dimensions
        let drawH = 303;
        let drawW = 504; 

        // Apply specific CSS dimension rules from original Style.css
        if (key === 1) { drawH = 313; }
        else if (key === 3) { drawH = 363; drawX -= 1; drawY -= 60.5; }
        else if (key === 10 || key === 13) { drawH = 343; }
        else if (key === 11 || key === 12) { drawH = 342; }
        else if (key === 14) { drawH = 323; }
        else if (key === 16) { drawH = 341.15; drawY += 1; }
        else if (key === 20) { 
          drawH = 400; drawX += 1; drawY -= 7; 
          drawW = (img.width / img.height) * drawH; // width: auto!important (proportional)
        }
        else if (key === 'Finish') {
          drawH = 1100; drawX += 2; drawY -= 99.5;
          drawW = (img.width / img.height) * drawH; // doesn't match default width selector
        }

        // We already drew the Start tile above, skip it here if it somehow got in tileMap
        if (key !== 'Start') {
          p.image(img, drawX, drawY, drawW, drawH);
        }
      }
    }

    // Finish line image (the actual banner string over the track)
    if (this.finishLineImage && this.tileMap.length > 0) {
      const last = this.tileMap[this.tileMap.length - 1];
      const fnH = 275;
      const fnW = (this.finishLineImage.width / this.finishLineImage.height) * fnH;
      p.image(this.finishLineImage, last.left + 77, last.top - 83, fnW, fnH);
    }

    // Clapping penguins at finish
    if (this.clappingGifs.length >= 2 && this.tileMap.length > 0) {
      const last = this.tileMap[this.tileMap.length - 1];
      p.image(this.clappingGifs[0], last.left + 500, last.top + 105, 50, 50);
      p.image(this.clappingGifs[1], last.left + 500, last.top + 183, 50, 50);
    }

    p.pop();
  }

  drawBackground(p) {
    // Gradient matching the original: rgba(0,94,139,1) → rgba(2,81,116,1)
    for (let y = 0; y < p.height; y++) {
      const t = y / p.height;
      p.stroke(
        p.lerp(0, 2, t),
        p.lerp(94, 81, t),
        p.lerp(139, 116, t),
      );
      p.line(0, y, p.width, y);
    }
  }

  /**
   * Draw the mini-map progress bar.
   */
  drawMiniMap(p, players) {
    const mapX = p.width - 490;
    const mapY = 34;
    const barW = 450;
    const barH = 5;

    // Bar background
    p.fill(255, 255, 255, 128);
    p.noStroke();
    p.rect(mapX, mapY, barW, barH, 15);

    // Player dots
    const finishL = this.getFinishLeft();
    for (const pl of players) {
      const pct = Math.max(0, Math.min(1, (pl.absLeft || 0) / finishL));
      const dotX = mapX + pct * barW;
      p.fill(pl.isLocal ? [255, 255, 0] : [255, 255, 255]);
      p.ellipse(dotX, mapY + barH / 2, 8, 8);
    }
  }
}
