import { describe, it, expect } from 'vitest';
import { STRUCTURE_USE_IDS, STRUCTURE_RING_IDS, STRUCTURE_RINGS, eyeSpot, structureStyle } from './out-structures.js';
import { ANCHOR_IDS, PIECE_KINDS, CAPS_FOR, decompileAnchor, seedAnchor, speak, roundTrip } from './out-anchor-structure.js';
import { composeAnchor } from './out-anchor-elements.js';
import { SURFACE_GROUP_IDS } from './out-structures-paint.js';

// a town's style decompiled from one anchor structure and spoken on every lot (era/out-anchor-structure.js)
const meadow = structureStyle('isekai-meadow', 8);
const LOTS = { dwelling: { w: 12, d: 18 }, shop: { w: 8, d: 16 }, workshop: { w: 12, d: 16 }, barn: { w: 14, d: 18 }, hall: { w: 18, d: 24 }, tower: { w: 7, d: 7 } };
const held = (d) => d.laws.filter((l) => !l.ok && l.law !== 'programme');

describe('out-anchor-structure', () => {
  it('an anchor decompiles into a language: vocabulary, proportions, values, depths', () => {
    const L = decompileAnchor('timber-hall');
    expect(L.vocab).toMatchObject({ mass: 'block', cap: 'gable', opening: 'rect', entry: 'door', annex: 'block', tiers: false });
    expect(L.vocab.ornaments).toEqual(['socle', 'sill', 'lintel', 'quoins', 'chimney', 'frame', 'shutters']);
    expect(L.proportions).toMatchObject({ pitch: 42, reach: 8.625, aspect: 1.333 });
    expect(L.values.storeys.map((s) => s.group)).toEqual(['str:stone', 'str:plaster']);
    expect(decompileAnchor('shell').vocab).toMatchObject({ mass: 'shell', cap: null, opening: 'lens', entry: 'tunnel', annex: 'shell' });
    expect(decompileAnchor('tiered').vocab).toMatchObject({ tiers: true, capEvery: true });
  });

  it('the grammar refuses an anchor it does not allow, and says why', () => {
    // an anchor given as pieces (the compiled form) passes the same grammar
    const A = composeAnchor(seedAnchor(3)), pieces = { read: A.read, storeyH: A.storeyH, pieces: decompileAnchor('timber-hall').anchor.pieces }, swap = (role, over) => ({ ...pieces, pieces: pieces.pieces.map((p) => (p.role === role ? { ...p, ...over } : p)) });
    expect(() => decompileAnchor(swap('cap', { kind: 'cone' }))).toThrow(/a block carries gable, hip, pyramid, flat, dome/);
    expect(() => decompileAnchor(swap('mass', { kind: 'pyramid' }))).toThrow(/a mass is block, drum, shell/);
    const shell = decompileAnchor('shell').anchor;
    expect(() => decompileAnchor({ ...shell, pieces: shell.pieces.map((p) => (p.role === 'entry' ? { ...p, kind: 'door' } : p)) })).toThrow(/a curved mass is entered by a tunnel/);
    expect(() => decompileAnchor({ ...shell, pieces: [...shell.pieces, { id: 'q', role: 'ornament', kind: 'quoins', w: 0.3, course: 0.3, group: 'str:stone', value: 0.8 }] })).toThrow(/quoins need a flat wall/);
    expect(() => decompileAnchor('cathedral')).toThrow(/not an anchor structure/);
  });

  it('every authored and seeded anchor, spoken on every use at every ring, holds its laws and speaks only its vocabulary', () => {
    const anchors = [...ANCHOR_IDS, ...[2, 3, 16, 32].map((s) => seedAnchor(s))];
    for (const a of anchors) {
      const L = decompileAnchor(a);
      for (const u of STRUCTURE_USE_IDS) for (const ring of STRUCTURE_RING_IDS) {
        const d = speak(L, u, LOTS[u], meadow, 8, { ring });
        expect(held(d), `${L.id} ${u} ${ring}`).toEqual([]);
        expect(d.measures.foreign).toEqual([]);
        expect(d.measures.tris).toBeLessThanOrEqual(d.measures.budget);
        expect(d.measures.budget).toBeGreaterThanOrEqual(STRUCTURE_RINGS[ring].budget);
        for (const f of [...d.faces, ...d.tile]) { expect(SURFACE_GROUP_IDS, `${L.id} ${f.part}`).toContain(f.group); expect(f.ramp).toBeUndefined(); }
      }
      expect(roundTrip(L, meadow, 8).laws[0].ok, L.id).toBe(true);
    }
  });

  it('the tree is pruned by depth, and the eye spot gates every piece', () => {
    const L = decompileAnchor('shell'), at = (k) => speak(L, 'dwelling', LOTS.dwelling, meadow, 8, { depth: k });
    expect(at(0).faces.some((f) => f.part === 'lens' || f.part === 'spike')).toBe(false);
    expect(at(1).faces.some((f) => f.part === 'lens')).toBe(true);
    expect(at(1).faces.some((f) => f.part === 'spike')).toBe(false);
    expect(at(2).faces.filter((f) => f.part === 'spike').length).toBe(3 * 6);
    for (const r of STRUCTURE_RING_IDS) for (const p of speak(L, 'dwelling', LOTS.dwelling, meadow, 8, { ring: r }).parts.filter((x) => x.built === 'geometry')) expect(p.span).toBeGreaterThanOrEqual(eyeSpot(r) - 1e-9);
  });

  it('fractal: an annex is the language again, smaller; a focus that must stand higher speaks a tier more', () => {
    const L = decompileAnchor('shell'), d = speak(L, 'workshop', { w: 14, d: 26 }, meadow, 8, { over: { area: 160 } });
    expect(d.masses.map((m) => m.id)).toContain('annex');
    expect(d.measures.under).toBeGreaterThan(0.4);
    const flat = decompileAnchor(seedAnchor(6)), hall = speak(flat, 'hall', LOTS.hall, meadow, 8, { crown: 14, accent: true });
    expect(flat.vocab.cap).toBe('flat');
    expect(hall.measures.ridge).toBeGreaterThanOrEqual(13);
    expect(hall.why.some((w) => w.includes('a tier more'))).toBe(true);
  });

  it('a seeded anchor is drawn from the grammar, and the same seed draws the same anchor', () => {
    for (let s = 1; s <= 40; s++) {
      const A = seedAnchor(s), L = decompileAnchor(A);
      expect(Object.keys(PIECE_KINDS.mass)).toContain(L.vocab.mass);
      expect(CAPS_FOR[L.vocab.mass]).toContain(L.vocab.cap);
      expect(JSON.stringify(seedAnchor(s))).toBe(JSON.stringify(A));
    }
    expect(new Set(Array.from({ length: 40 }, (_, i) => { const v = decompileAnchor(seedAnchor(i + 1)).vocab; return `${v.mass} ${v.cap} ${v.opening}`; })).size).toBeGreaterThan(12);
  });

  it('a building is a pure function of its language, use, lot, style and seed', () => {
    const L = decompileAnchor('tiered');
    for (const u of STRUCTURE_USE_IDS) expect(JSON.stringify(speak(L, u, LOTS[u], meadow, 5))).toBe(JSON.stringify(speak(decompileAnchor('tiered'), u, LOTS[u], structureStyle('isekai-meadow', 8), 5)));
  });
});
