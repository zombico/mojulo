import { describe, it, expect } from 'vitest';
import { dressedTile, dressedMaterial } from './dressed.js';
import { tileFamilyOf, normalizeTileSpec } from '../era/tile-specs.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { assembleStageScene } from '../era/stage.js';

// DRESSED STONE: ashlar painted from relief as a room's tile. Small repeats keep it quick: the laws are the same at 512.
const CFG = { stone: [176, 168, 150], mortar: [120, 114, 102], metres: 1, rows: 3, cols: 2 };
const lum = (t, i, j) => { const k = (j * t.W + i) * 3; return (t.rgb[k] + t.rgb[k + 1] + t.rgb[k + 2]) / 3; };

describe('a dressed-stone tile', () => {
  const T = dressedTile(CFG, { size: 128, seed: 7 });

  it('is seamless: the step across each edge is no bigger than a step inside', () => {
    let edgeX = 0, inX = 0, edgeY = 0, inY = 0;
    for (let j = 0; j < T.H; j++) { edgeX += Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)); inX += Math.abs(lum(T, T.W / 2, j) - lum(T, T.W / 2 - 1, j)); }
    for (let i = 0; i < T.W; i++) { edgeY += Math.abs(lum(T, i, T.H - 1) - lum(T, i, 0)); inY += Math.abs(lum(T, i, T.H / 2) - lum(T, i, T.H / 2 - 1)); }
    expect(edgeX).toBeLessThan(2 * inX + T.H * 2);
    expect(edgeY).toBeLessThan(2 * inY + T.W * 2);
  });

  it('is the same bytes for the same numbers, and another stone for another seed or finish', () => {
    expect(Buffer.compare(dressedTile(CFG, { size: 128, seed: 7 }).rgb, T.rgb)).toBe(0);
    expect(Buffer.compare(dressedTile(CFG, { size: 128, seed: 8 }).rgb, T.rgb)).not.toBe(0);
    expect(Buffer.compare(dressedTile({ ...CFG, tool: 'pitched' }, { size: 128, seed: 7 }).rgb, T.rgb)).not.toBe(0);
  });

  it('sits its stone round the ramp\'s middle, the mortar darker', () => {
    let s = 0; for (let j = 0; j < T.H; j++) for (let i = 0; i < T.W; i++) s += lum(T, i, j);
    const m = s / (T.W * T.H), stone = CFG.stone.reduce((a, b) => a + b) / 3;
    expect(m).toBeGreaterThan(stone * 0.7); expect(m).toBeLessThan(stone * 1.15);
  });
});

describe('dressed stone as a tile spec', () => {
  it('is refused outside its rails, and its metres are part of what it is', () => {
    expect(() => normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], rows: 20 })).toThrow(/rows/);
    expect(() => normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], tool: 'chiselled' })).toThrow(/tool/);
    const a = tileFamilyOf({ gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102] }), b = tileFamilyOf({ gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102], scale: 3 });
    expect(a).toMatch(/^gen:dressed-/); expect(b).not.toBe(a);
  });
  it('is painted past the sixth generation\'s density: 512 texels a side', () => {
    const url = surfaceTexture(`${tileFamilyOf({ gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102], scale: 1, rows: 2 })}-a`);
    const png = Buffer.from(url.split(',')[1], 'base64');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([512, 512]);
  });
});

describe('a pillar is never coursed', () => {
  it('fluted and plain shafts run up the pillar: a step down it changes the stone far less than a step across', () => {
    for (const cut of ['fluted', 'shaft']) {
      const T = dressedTile({ ...CFG, cut, metres: 1.5 }, { size: 128, seed: 3 });
      let down = 0, across = 0;
      for (let j = 0; j < T.H - 1; j++) for (let i = 0; i < T.W - 1; i++) { down += Math.abs(lum(T, i, j + 1) - lum(T, i, j)); across += Math.abs(lum(T, i + 1, j) - lum(T, i, j)); }
      expect(down, cut).toBeLessThan(across * 0.8);
    }
  });

  it('a recipe\'s pillars are a surface of their own: the nave\'s columns fluted, its grime and moss kept, the rest as it was', () => {
    const rooms = [{ id: 'nave', x: 0, y: 0, w: 10, d: 16, h: 9 }], pillar = { gen: 'dressed', stone: [176, 168, 150], mortar: [120, 114, 102], cut: 'fluted' };
    const plain = assembleStageScene({ kind: 'stage', kit: 'gothic-nave', rooms }), fluted = assembleStageScene({ kind: 'stage', kit: 'gothic-nave', rooms, tiles: { pillar } });
    const by = (P, g) => P.faces.filter((f) => f.group === g).length;
    expect(by(plain, 'stage:pillar')).toBe(0);
    expect(by(fluted, 'stage:pillar')).toBeGreaterThan(0);
    expect(fluted.faces.length).toBe(plain.faces.length);
    expect(by(fluted, 'stage:moss')).toBe(by(plain, 'stage:moss'));
    expect(by(fluted, 'stage:pillar') + by(fluted, 'stage:trim')).toBe(by(plain, 'stage:trim'));
  });
});

describe('floors, paths and baseboards', () => {
  const rooms = [{ id: 'nave', x: 0, y: 0, w: 10, d: 16, h: 9 }], D = (more) => ({ gen: 'dressed', stone: [150, 140, 124], mortar: [90, 84, 74], ...more });
  const by = (P, g) => P.faces.filter((f) => f.group === g).length;

  it('a floor face is lit from overhead and worn, not a wall\'s light turned flat', () => {
    const wall = dressedTile({ ...CFG }, { size: 128, seed: 4 }), floor = dressedTile({ ...CFG, face: 'floor' }, { size: 128, seed: 4 });
    expect(Buffer.compare(wall.rgb, floor.rgb)).not.toBe(0);
    expect(() => normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], face: 'ceiling' })).toThrow(/face/);
  });

  it('the plinth and the nave\'s runner are surfaces of their own; the room\'s faces, moss and grime as they were', () => {
    const plain = assembleStageScene({ kind: 'stage', kit: 'gothic-nave', rooms });
    const dressed = assembleStageScene({ kind: 'stage', kit: 'gothic-nave', rooms, tiles: { plinth: D({ rows: 2 }), path: D({ face: 'floor', scale: 2 }) } });
    expect(dressed.faces.length).toBe(plain.faces.length);
    expect(by(dressed, 'stage:plinth')).toBeGreaterThan(0);
    expect(by(dressed, 'stage:plinth') + by(dressed, 'stage:trim')).toBe(by(plain, 'stage:trim'));
    expect(by(dressed, 'stage:moss')).toBe(by(plain, 'stage:moss'));
    // the runner is floor still (its tone, its dirt), drawn in the path's own stone
    expect(by(dressed, 'stage:floor')).toBe(by(plain, 'stage:floor'));
    expect(dressed.faces.some((f) => f.group === 'stage:floor' && /^gen:dressed-/.test(f.texture || ''))).toBe(true);
  });

  it('a dressed floor laid a tile a bay is painted at the bay\'s metres', () => {
    const P = assembleStageScene({ kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'r', x: 0, y: 0, w: 12, d: 12, h: 6 }], tiles: { floor: D({ face: 'floor' }) } });
    const keys = new Set(P.faces.filter((f) => f.group === 'stage:floor').map((f) => f.texture));
    expect([...keys].every((k) => /^gen:dressed-.*-[ab]$/.test(k))).toBe(true);
    expect(tileFamilyOf({ ...D({ face: 'floor' }), scale: 4 })).toBe([...keys][0].replace(/-[ab]$/, ''));
  });
});

describe('a gritty cube dresses its room', () => {
  it('its stone from relief, its tone letting it read; a quiet cube as it was; a surface it names kept', async () => {
    const { lowerGeocube, readGeocube } = await import('../era/geocube.js');
    const { GRIT_PIXELS } = await import('../local-meru/plan.js');
    const quiet = lowerGeocube(readGeocube('valley-morning'), 'inside');
    expect(quiet.tiles.wall.gen).toBe('stone-brick'); expect(quiet.tiles.pillar).toBeUndefined(); expect(quiet.tone.detail).toBe(0.45);
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', grit: GRIT_PIXELS - 0.05 }), 'inside')).toEqual(quiet);
    const gritty = lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.7 }), 'inside');
    expect(gritty.tiles.wall).toMatchObject({ gen: 'dressed', grit: 0.7 });
    expect(gritty.tiles.floor).toMatchObject({ gen: 'dressed', face: 'floor' });
    expect(gritty.tiles.pillar).toMatchObject({ gen: 'dressed', cut: 'fluted' });
    expect(gritty.tiles.plinth).toMatchObject({ gen: 'dressed' });
    expect(gritty.tone.detail).toBeGreaterThan(quiet.tone.detail);
    expect(lowerGeocube(readGeocube('limestone-crags'), 'inside').tiles.wall.gen).toBe('dressed');
    // (a cube that names its pillar in another stone keeps it)
    const own = { gen: 'stone-brick', stone: [120, 120, 120], mortar: [60, 60, 60] };
    expect(lowerGeocube(readGeocube({ from: 'valley-morning', grit: 0.7, surfaces: { pillar: own } }), 'inside').tiles.pillar).toEqual(own);
  });
});

describe('a wall of lime render', () => {
  const R = (more) => dressedTile({ ...CFG, cut: 'render', render: [214, 204, 186], metres: 2, rows: 4, ...more }, { size: 128, seed: 5 });
  it('is seamless and the same bytes for the same numbers, and loses more of its coat the more it is asked to', () => {
    const T = R({ loss: 0.5 });
    let edgeX = 0, inX = 0;
    for (let j = 0; j < T.H; j++) { edgeX += Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)); inX += Math.abs(lum(T, T.W / 2, j) - lum(T, T.W / 2 - 1, j)); }
    expect(edgeX).toBeLessThan(2 * inX + T.H * 2);
    expect(Buffer.compare(R({ loss: 0.5 }).rgb, T.rgb)).toBe(0);
    // (the coat is paler than the stone under it: more loss, a darker wall)
    const mean = (X) => { let s = 0; for (let j = 0; j < X.H; j++) for (let i = 0; i < X.W; i++) s += lum(X, i, j); return s / (X.W * X.H); };
    expect(mean(R({ loss: 0.9 }))).toBeLessThan(mean(R({ loss: 0.1 })));
  });
  it('is a cut on the rails, its coat and its loss with it', () => {
    expect(normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], cut: 'render', render: [9, 9, 9], loss: 0.4 }).params).toMatchObject({ cut: 'render', loss: 0.4 });
    expect(() => normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], cut: 'render', loss: 2 })).toThrow(/loss/);
  });
});

describe('roofs and timber', () => {
  it('tiles and slates lie in courses down the slope, boards run up the wall: each seamless and its own bytes', () => {
    for (const cut of ['tile', 'slate', 'boards']) {
      const T = dressedTile({ ...CFG, cut, rows: 8, cols: 6, metres: 1 }, { size: 128, seed: 3 });
      // (row by row, the step across the edge no bigger than the biggest step inside the row: a course's joint may fall on
      // the edge, and a joint is a step like any inside it)
      let over = 0;
      for (let j = 0; j < T.H; j++) {
        let most = 0;
        for (let i = 1; i < T.W; i++) most = Math.max(most, Math.abs(lum(T, i, j) - lum(T, i - 1, j)));
        if (Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)) > 1.25 * most + 4) over++;
      }
      expect(over, cut).toBe(0);
      expect(Buffer.compare(dressedTile({ ...CFG, cut, rows: 8, cols: 6, metres: 1 }, { size: 128, seed: 3 }).rgb, T.rgb), cut).toBe(0);
    }
    // a board's grain runs up it: a step down the wall changes it less than a step across
    const B = dressedTile({ ...CFG, cut: 'boards', cols: 6, metres: 1 }, { size: 128, seed: 3 });
    let down = 0, across = 0;
    for (let j = 0; j < B.H - 1; j++) for (let i = 0; i < B.W - 1; i++) { down += Math.abs(lum(B, i, j + 1) - lum(B, i, j)); across += Math.abs(lum(B, i + 1, j) - lum(B, i, j)); }
    expect(down).toBeLessThan(across);
  });
});

describe('the modern class and the roads', () => {
  it('each cut is seamless and its own bytes; a modern cut on the rails', () => {
    for (const cut of ['brick', 'concrete', 'precast', 'stucco', 'pavement', 'asphalt', 'setts']) {
      // (192 texels a metre: a modern joint is under a centimetre, finer than a coarser sampling holds in every row; the
      // repeat's own first and last rows lie in a joint for a gridded cut, its V-groove lit on one side)
      const T = dressedTile({ ...CFG, cut, rows: 8, cols: 4, metres: 1 }, { size: 192, seed: 3 });
      let over = 0;
      for (let j = 1; j < T.H - 1; j++) {
        let most = 0;
        for (let i = 1; i < T.W; i++) most = Math.max(most, Math.abs(lum(T, i, j) - lum(T, i - 1, j)));
        if (Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)) > 1.25 * most + 4) over++;
      }
      expect(over, cut).toBe(0);
      expect(Buffer.compare(dressedTile({ ...CFG, cut, rows: 8, cols: 4, metres: 1 }, { size: 192, seed: 3 }).rgb, T.rgb), cut).toBe(0);
      expect(normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], cut }).params.cut).toBe(cut);
    }
  });
});

describe('the made class: the bay\'s steel, sheet and poured faces', () => {
  const MADE = ['plate', 'tread', 'block', 'panel', 'epoxy', 'grating', 'corrugated', 'perforated', 'terrazzo', 'glazed', 'studded', 'seam', 'acoustic',
    'matte', 'carbon', 'drywall', 'carpet', 'vinyl', 'laminate', 'porcelain', 'veneer'];
  const H = (cut, over = {}) => { const M = dressedMaterial({ ...CFG, cut, metres: 1, rows: 4, cols: 2, ...over }, { size: 128, seed: 3 }); return { M, at: (x, y) => M.height[Math.floor(y * 128) * 128 + Math.floor(x * 128)] }; };
  it('each cut is seamless, its own bytes, on the rails, and read as material from a relief', () => {
    for (const cut of MADE) {
      const T = dressedTile({ ...CFG, cut, rows: 4, cols: 2, metres: 1 }, { size: 128, seed: 3 });
      let over = 0;
      for (let j = 1; j < T.H - 1; j++) {
        let most = 0;
        for (let i = 1; i < T.W; i++) most = Math.max(most, Math.abs(lum(T, i, j) - lum(T, i - 1, j)));
        if (Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)) > 1.25 * most + 4) over++;
      }
      expect(over, cut).toBe(0);
      expect(Buffer.compare(dressedTile({ ...CFG, cut, rows: 4, cols: 2, metres: 1 }, { size: 128, seed: 3 }).rgb, T.rgb), cut).toBe(0);
      expect(normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], cut }).params.cut).toBe(cut);
      const { M } = H(cut);
      expect(Math.max(...M.height) - Math.min(...M.height), cut).toBeGreaterThan(0.0002);
    }
  });
  it('each reads as what it is: a rivet proud of its plate, a joint sunk into a block, a pit under the bars, ribs at their pitch', () => {
    const plate = H('plate', { rows: 1, cols: 1 }), mid = plate.at(0.5, 0.5);
    // (a rivet row inset 45 mm from the plate's edge, the field's middle well clear of it)
    expect(Math.max(...[0, 1, 2, 3, 4].map((i) => plate.at(0.045, 0.5 + (i - 2) / 128)))).toBeGreaterThan(mid + 0.002);
    const block = H('block', { rows: 4, cols: 2, grit: 0 });
    expect(block.at(0.25, 0.001)).toBeLessThan(block.at(0.25, 0.125) - 0.002);
    const grating = H('grating');
    expect(Math.min(...grating.M.height)).toBeLessThan(-0.02);
    const ribs = H('corrugated', { cols: 8, grit: 0 }), row = Array.from({ length: 128 }, (_, i) => ribs.at(i / 128, 0.5));
    // eight crowns across the repeat: count the rises onto a crown
    expect(row.filter((v, i) => v > 0 && row[(i + 127) % 128] <= 0).length).toBe(8);
    // a poured floor is smooth: its relief its joints' and little more
    const epoxy = H('epoxy', { cols: 1 });
    expect(Math.max(...epoxy.M.height)).toBeLessThan(0.002);
  });
  it('the coats and the everyday: a fold, a twill, a checker of pile, a book-matched leaf', () => {
    const base = (cut, over) => { const M = dressedMaterial({ ...CFG, cut, ...over }, { size: 128, seed: 3 }); return (i, j) => { const k = (j * 128 + i) * 3; return M.baseColor[k] + M.baseColor[k + 1] + M.baseColor[k + 2]; }; };
    // (a matte sheet rolls away at its fold: its edge under its field)
    const matte = H('matte', { rows: 1, cols: 1, grit: 0 });
    expect(matte.at(0.002, 0.5)).toBeLessThan(matte.at(0.5, 0.5) - 0.0002);
    // (a 2×2 twill: a tow's cell the same as the one a step along the diagonal, unlike the one two across)
    const tw = base('carbon', { metres: 0.384, stone: [40, 40, 44], mortar: [40, 40, 44], grit: 0 }), cell = 128 / 32, at = (i, j) => tw(Math.floor((i + 0.5) * cell), Math.floor((j + 0.5) * cell));
    let diag = 0, across = 0;
    for (let i = 0; i < 28; i++) for (let j = 0; j < 28; j++) { diag += Math.abs(at(i, j) - at(i + 1, j + 1)); across += Math.abs(at(i, j) - at(i + 2, j)); }
    expect(diag).toBeLessThan(across * 0.25);
    // (carpet tiles quarter-turned: neighbours apart, diagonals alike)
    const cp = base('carpet', { metres: 1, cols: 2, grit: 0 }), mean = (ti, tj) => { let s = 0; for (let j = 8; j < 56; j++) for (let i = 8; i < 56; i++) s += cp(ti * 64 + i, tj * 64 + j); return s / 48 / 48; };
    expect(Math.abs(mean(0, 0) - mean(1, 0))).toBeGreaterThan(4 * Math.abs(mean(0, 0) - mean(1, 1)));
    // (veneer book-matched: each panel's second leaf its first's mirror)
    const vn = base('veneer', { metres: 1, cols: 2, grit: 0 });
    for (const j of [10, 70, 120]) for (const i of [3, 12, 25]) expect(vn(i, j)).toBe(vn(63 - i, j));
  });
});

describe('the natural class (parked: the land a town stands in)', () => {
  it('each cut is seamless and its own bytes, painted in its stone\'s grey alone; on the rails', () => {
    for (const cut of ['turf', 'leaves', 'bark']) {
      const T = dressedTile({ ...CFG, stone: [200, 200, 200], cut, metres: 1 }, { size: 192, seed: 3 });
      let over = 0;
      for (let j = 1; j < T.H - 1; j++) {
        let most = 0;
        for (let i = 1; i < T.W; i++) most = Math.max(most, Math.abs(lum(T, i, j) - lum(T, i - 1, j)));
        if (Math.abs(lum(T, T.W - 1, j) - lum(T, 0, j)) > 1.25 * most + 4) over++;
      }
      expect(over, cut).toBe(0);
      let hue = 0; for (let i = 0; i < T.W * T.H; i++) hue = Math.max(hue, Math.abs(T.rgb[i * 3] - T.rgb[i * 3 + 1]), Math.abs(T.rgb[i * 3 + 1] - T.rgb[i * 3 + 2]));
      expect(hue, cut).toBeLessThanOrEqual(1);
      expect(Buffer.compare(dressedTile({ ...CFG, stone: [200, 200, 200], cut, metres: 1 }, { size: 192, seed: 3 }).rgb, T.rgb), cut).toBe(0);
      expect(normalizeTileSpec({ gen: 'dressed', stone: [1, 2, 3], mortar: [1, 2, 3], cut }).params.cut).toBe(cut);
    }
  });
});
