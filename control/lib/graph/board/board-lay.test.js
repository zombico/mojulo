import { describe, it, expect } from 'vitest';
import { readBoardSpec, layBoard, SIDE_SHADES, shadeHex } from './board-lay.js';
import { boardStart, boardReach, boardPath, boardParse, boardCentre } from './board-kernel.js';
import { readGeocube, geocubeRamps } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';

const spotsOf = (B) => B.spots.map((s, i) => ({ s, i })).filter((x) => x.s);
// the bands a diorama shows: per spot and side, the steps it stands above its neighbour (or the plinth, a metre down)
function bandsOf(B) {
  let n = 0;
  for (const { s, i } of spotsOf(B)) {
    const c = i % B.cols, r = (i - c) / B.cols;
    for (const [x, y] of [[c, r + 1], [c + 1, r], [c, r - 1], [c - 1, r]]) {
      const o = x < 0 || y < 0 || x >= B.cols || y >= B.rows ? null : B.spots[y * B.cols + x];
      const lo = o ? o.h : -1 / B.step;
      n += Math.max(0, Math.ceil(s.h - lo - 1e-9));
    }
  }
  return n;
}

describe('reading a board', () => {
  it('fills its defaults: outside, a diorama of the island\'s look, 10 × 10 spots of 2 m and steps of half a metre', () => {
    expect(readBoardSpec({})).toEqual({ geocube: 'island-noon', side: 'outside', from: 'blocks', cell: 2, step: 0.5, cols: 10, rows: 10, seed: 'board', relief: 0.5, water: false });
    expect(readBoardSpec({ side: 'inside', from: 'stage' })).toEqual({ geocube: 'gothic-night', side: 'inside', from: 'stage', cell: 2, step: 0.5 });
  });
  it('teaches what it refuses', () => {
    expect(() => readBoardSpec({ size: 3 })).toThrow(/'size' is not a board setting \(settings: geocube, side/);
    expect(() => readBoardSpec({ from: 'land' })).toThrow(/from is 'blocks' or 'stage'/);
    expect(() => readBoardSpec({ origin: [0, 0] })).toThrow(/origin is for a board over a stage/);
    expect(() => readBoardSpec({ from: 'stage', relief: 1 })).toThrow(/relief is for a diorama/);
    expect(() => readBoardSpec({ side: 'inside', water: true })).toThrow(/water is the outside's/);
    expect(() => readBoardSpec({ from: 'stage', stage: { rooms: [] } })).toThrow(/rooms and links are the inside's/);
    expect(() => readBoardSpec({ side: 'inside', from: 'stage', stage: { meru: true } })).toThrow(/meru, trail and terrain are the outside's/);
    expect(() => readBoardSpec({ cols: 30 })).toThrow(/cols is a whole number, 4 to 24/);
    expect(() => readBoardSpec({ geocube: 'nowhere' })).toThrow();
    expect(() => layBoard({ holes: ['Z9'] })).toThrow(/runs off the board/);
  });
});

describe('a diorama the cube paints', () => {
  it('is the same board and the same faces for the same seed, another for another', () => {
    expect(JSON.stringify(layBoard({ seed: 'fft' }))).toBe(JSON.stringify(layBoard({ seed: 'fft' })));
    expect(JSON.stringify(layBoard({ seed: 'fft' }).board)).not.toBe(JSON.stringify(layBoard({ seed: 'other' }).board));
  });

  it('stands in whole steps up to its relief, and shows its height as bands: a top a spot, a band a step it stands proud', () => {
    for (const relief of [0, 1]) {
      const { board: B, faces } = layBoard({ seed: 'fft', relief, cols: 6, rows: 5 });
      expect(Math.max(...spotsOf(B).map((x) => x.s.h))).toBeLessThanOrEqual(Math.round(relief * 8));
      expect(faces.filter((f) => f.group === 'board:side').length).toBe(bandsOf(B));
      expect(faces.filter((f) => f.group !== 'board:side').length).toBe(spotsOf(B).length);
    }
    const { board: H } = layBoard({ seed: 'fft', holes: ['B2:C3'] });
    expect([1, 2].flatMap((r) => [1, 2].map((c) => H.spots[r * H.cols + c]))).toEqual([null, null, null, null]);
  });

  it('wears the cube: grass and stone outside, floor and trim inside, water and its sand only when asked', () => {
    const R = geocubeRamps(readGeocube('island-noon'));
    const out = layBoard({ seed: 'fft' });
    const sides = (ramp) => [SIDE_SHADES.ns, SIDE_SHADES.ew].flatMap((f) => [f, f * SIDE_SHADES.band]).map((f) => shadeHex(ramp[2], f));
    for (const f of out.faces) expect(f.group === 'board:side' ? sides(R.stone) : f.group === 'board:ground' ? R.grass : [...R.stone, ...(R.sand ?? [])]).toContain(f.fill);
    expect(spotsOf(out.board).some((x) => x.s.type === 'water')).toBe(false);
    const wet = layBoard({ seed: 'fft', water: true }).board;
    expect(spotsOf(wet).some((x) => x.s.type === 'water' && !x.s.walk)).toBe(true);
    const G = geocubeRamps(readGeocube('gothic-night')), hall = layBoard({ side: 'inside', seed: 'hall' });
    for (const f of hall.faces) expect(f.group === 'board:side' ? sides(G.trim) : G.floor).toContain(f.fill);
    expect(Math.max(...spotsOf(hall.board).map((x) => x.s.h))).toBeLessThanOrEqual(1);
  });
});

describe('a board over the cube\'s rooms', () => {
  const rooms = [{ id: 'a', x: 0, y: 0, w: 12, d: 8, h: 6 }, { id: 'b', x: 12, y: 0, w: 8, d: 8, h: 6 }];
  const spec = { side: 'inside', from: 'stage', stage: { rooms, links: [{ from: 'a', to: 'b' }] } };
  const L = layBoard(spec), B = L.board, P = L.scene;

  it('covers the rooms on the cell\'s grid, flat on their floor', () => {
    expect(L.frame).toEqual({ origin: [0, 0, 0], cell: 2, step: 0.5 });
    expect([B.cols, B.rows]).toEqual([10, 4]);
    expect(spotsOf(B).every((x) => x.s.h === 0)).toBe(true);
    expect(spotsOf(B).length).toBe(40);
  });

  it('joins the rooms only through their doorway: the wall between them cuts every step across it but the door\'s', () => {
    const door = P.anchors.find((a) => a.kind === 'doorway');
    const across = [0, 1, 2, 3].map((r) => !!B.cut?.[`${r * B.cols + 5},${r * B.cols + 6}`]);
    const inDoor = [0, 1, 2, 3].map((r) => { const y = (r + 0.5) * 2; return Math.abs(y - door.at[1]) < door.width / 2 + 1; });
    expect(across).toEqual(inDoor.map((x) => !x));
    // a walker from room a to room b goes through the doorway
    const S = boardStart(B, {}, [{ id: 'w', side: 'p', at: 'B2', move: 12 }]), to = boardParse(B, 'H1');
    const p = boardPath(B, S, 'w', to);
    const step = p.findIndex((i, k) => k && (i % B.cols) === 6 && (p[k - 1] % B.cols) === 5);
    expect(step).toBeGreaterThan(0);
    expect(inDoor[Math.floor(p[step] / B.cols)]).toBe(true);
  });

  it('shuts the spots its props stand in', () => {
    const props = P.colliders.filter((k) => /^(set-piece|crate|barrel|boulder)/.test(k.of));
    expect(props.length).toBeGreaterThan(0);
    for (const k of props) {
      const x = (k.min[0] + k.max[0]) / 2, y = (k.min[1] + k.max[1]) / 2, i = Math.floor(y / 2) * B.cols + Math.floor(x / 2);
      expect(B.spots[i].walk, k.of).toBe(false);
    }
  });
});

describe('a board over the cube\'s land', () => {
  const P = assembleStageScene({ kind: 'stage', geocube: 'island-noon', trail: {} }, { seed: 1 });
  const L = layBoard({ from: 'stage' }, { scene: P }), B = L.board, [ox, oy, oz] = L.frame.origin;

  it('samples the stage it is handed, the same board each time', () => {
    expect(L.scene).toBe(P);
    expect(JSON.stringify(layBoard({ from: 'stage' }, { scene: P }).board)).toBe(JSON.stringify(B));
  });

  it('lies inside the site\'s bounds, where it finds the most ground to stand on', () => {
    const east = P.colliders.find((k) => /^bound:.*:\+x$/.test(k.of)), north = P.colliders.find((k) => /^bound:.*:\+y$/.test(k.of));
    for (const { i } of spotsOf(B)) {
      const [x, y] = boardCentre(B, i);
      expect(ox + x).toBeLessThan(east.min[0]);
      expect(oy + y).toBeLessThan(north.min[1]);
    }
    const stand = spotsOf(B).filter((x) => x.s.walk).length;
    expect(stand).toBeGreaterThan(B.spots.length * 0.8);
  });

  it('reads its heights and types off the land, and shuts a tree\'s spot', () => {
    const types = new Set(spotsOf(B).map((x) => x.s.type));
    expect(types.has('ground')).toBe(true);
    expect(types.has('trail')).toBe(true);
    expect(new Set(spotsOf(B).map((x) => x.s.h)).size).toBeGreaterThan(3);
    const trunks = P.faces.filter((f) => f.group === 'isekai:wood').map((f) => [Math.floor((f.corners[0][0] - ox) / 2), Math.floor((f.corners[0][1] - oy) / 2)]).filter(([c, r]) => c >= 0 && r >= 0 && c < B.cols && r < B.rows);
    expect(trunks.length).toBeGreaterThan(0);
    expect(trunks.some(([c, r]) => B.spots[r * B.cols + c]?.walk === false)).toBe(true);
    expect(oz).toBe(Math.floor(oz / 0.5) * 0.5);
  });

  it('plays: a unit on it walks', () => {
    const at = spotsOf(B).find((x) => x.s.walk).i;
    const S = boardStart(B, {}, [{ id: 'w', side: 'p', at }]);
    expect(boardReach(B, S, 'w').length).toBeGreaterThan(0);
  });
});
