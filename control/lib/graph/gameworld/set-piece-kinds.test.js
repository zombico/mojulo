// Set-piece kinds: a set piece said in words, its site and its set piece laid by the kind's card
import { describe, it, expect } from 'vitest';
import { layKind, readKindWords, siteOf, SET_PIECE_KIND_IDS } from './set-piece-kinds.js';
import { setPieceLaws } from './set-piece.js';

const r2 = (v) => Math.round(v * 100) / 100;

describe('a set piece\'s kind', () => {
  it('lays a set piece that passes its laws, on blocks under its line', () => {
    for (const kind of SET_PIECE_KIND_IDS) {
      const K = layKind(kind);
      expect(setPieceLaws(K.setPiece).filter((l) => !l.ok), kind).toEqual([]);
      // the start stands on a block or a vehicle's deck (as the world starts), at the set piece's height
      const decks = (K.entities ?? []).filter((e) => e.body.carrier).map((e) => { const [x, y, z] = e.transform.pos, [hx, hy] = e.body.carryHalf; return { x: [x - hx, x + hx], y: [y - hy, y + hy], z: [0, r2(z + e.body.deck)] }; });
      expect([...K.blocks, ...decks].some((b) => K.start[0] >= b.x[0] && K.start[0] <= b.x[1] && K.start[1] >= b.y[0] && K.start[1] <= b.y[1] && b.z[1] === K.start[2]), kind).toBe(true);
      // each jump is on the line
      expect(K.jumps.every((j) => j > 0 && j < K.setPiece.line[K.setPiece.line.length - 1][0] + 60), kind).toBe(true);
    }
  });
  it('a moving kind: its vehicles carriers at one pace, its set piece riding them, its beats at a body', () => {
    // (one moving kind: they share the convoy; the case chosen from the catalog, not a hand list)
    const kind = SET_PIECE_KIND_IDS.find((k) => layKind(k).entities), K = layKind(kind), sp = K.setPiece;
    const movers = K.entities.filter((e) => e.rule.type === 'mover');
    const pace = (e) => (e.rule.path[1][0] - e.rule.path[0][0]) / e.rule.period;
    expect(new Set(movers.map(pace)).size).toBe(1);
    expect(movers.every((e) => e.rule.mode === 'loop' && e.rule.path[1][1] === e.rule.path[0][1])).toBe(true);
    expect(K.entities.filter((e) => e.body.carrier).length).toBeGreaterThan(1);
    expect(K.entities.find((e) => e.id === sp.rides).body.carrier).toBe(true);
    // (its beats name bodies, never a place the road leaves behind)
    const named = sp.beats.flatMap((b) => [].concat(b.do)).filter((d) => d.puff || d.explode);
    expect(named.length).toBeGreaterThan(0);
    expect(named.every((d) => typeof (d.puff ?? d.explode).who === 'string' && !(d.puff ?? d.explode).at)).toBe(true);
    // (its road runs the whole drive: the road's far end past where the convoy's lead is when it wraps)
    const lead = Math.max(...movers.map((e) => e.rule.path[1][0]));
    expect(Math.max(...K.faces.flatMap((f) => f.corners.map((c) => c[0])))).toBeGreaterThan(lead);
    // (and its blocks none: no street under a still site, the road its own)
    expect(siteOf(K.blocks, { street: false }).faces).toEqual([]);
  });
  it('takes its words, and teaches on one it does not', () => {
    expect(readKindWords('collapse', { courses: 3 })).toMatchObject({ courses: 3, height: 6, id: 'collapse' });
    expect(layKind('rooftop-run', { pursuers: 0, blast: false }).setPiece).not.toHaveProperty('pursuers');
    expect(() => readKindWords('heist')).toThrow(/rooftop-run, collapse, climb/);
    expect(() => readKindWords('climb', { courses: 3 })).toThrow(/not its word/);
    expect(() => readKindWords('climb', { face: 40 })).toThrow(/face is 3–14/);
  });
  it('a breakable block\'s faces are its own, and it is no collider', () => {
    const S = siteOf([{ id: 'slab', x: [0, 2], y: [0, 2], z: [3, 4], breaks: true }, { id: 'floor', x: [0, 2], y: [0, 2], z: [0, 1] }]);
    expect(S.breakables).toEqual([{ id: 'slab', min: [0, 0, 3], max: [2, 2, 4], hp: 6 }]);
    expect(S.colliders).toEqual([{ min: [0, 0, 0], max: [2, 2, 1] }]);
    expect(S.faces.filter((f) => f.node === 'slab').length).toBe(6);   // (a floating block's underside too)
  });
});
