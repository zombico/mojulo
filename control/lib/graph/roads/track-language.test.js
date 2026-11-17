import { describe, it, expect } from 'vitest';
import { TRACK_LANGUAGES, LANGUAGE_OF_CLASS, readLanguage, languageLaws, railFaces, postFaces, kerbFaces, buntingFaces, chevronFaces, treeFaces } from './track-language.js';
import { planTrack } from './track.js';

const course = { class: 'kart', length: 260, twist: 0.5, seed: 2 };

describe('a track\'s design language', () => {
  it('a card keeps its own laws on a class it suits (one card a rail profile)', () => {
    const byProfile = new Map(Object.entries(TRACK_LANGUAGES).map(([id, c]) => [c.parts.rail.profile, id]));
    for (const id of byProfile.values()) {
      const card = readLanguage(id);
      expect(languageLaws(card, { cls: card.suits[0] }), id).toEqual([]);
    }
    for (const id of Object.values(LANGUAGE_OF_CLASS)) expect(TRACK_LANGUAGES[id]).toBeTruthy();
  });

  it('says what a card loses: a rail and a post of two stuffs, a tell in the rail\'s colour, a class it does not suit', () => {
    const C = readLanguage('candy');
    const odd = { ...C, materials: { ...C.materials, iron: { of: 'steel', finish: 'satin', hex: '#888888' } }, parts: { ...C.parts, rail: { ...C.parts.rail, tell: ['sky', 'cream'], post: { ...C.parts.rail.post, material: 'iron' } } } };
    const lost = languageLaws(odd, { cls: 'circuit' }).map((l) => l.law);
    expect(lost).toEqual(expect.arrayContaining(['one-metal', 'tell', 'suits']));
    expect(() => readLanguage('nougat')).toThrow(/unknown language/);
  });

  it('the parts are raw: a colour of the family, a normal, no light', () => {
    const C = readLanguage('candy'), P = (st, off, dz = 0) => [st.x, st.y + off, dz], A = { x: 0, y: 0 }, B = { x: 1, y: 0 };
    const all = [...railFaces(C, { P, A, B, side: 1, at: 9 }), ...railFaces(C, { P, A, B, side: 1, at: 9, tell: 0 }), ...postFaces(C, { P, st: A, side: 1, at: 9 }), ...kerbFaces(C, { P, A, B, side: -1, from: 4, to: 5, stripe: 1 })];
    const own = new Set(Object.values(C.materials).map((m) => m.hex));
    for (const f of all) { expect(own.has(f.hex)).toBe(true); expect(Math.hypot(...f.normal)).toBeCloseTo(1, 5); expect(f.fill).toBeUndefined(); }
    // a tube looks out of itself: its top faces up, its road side toward the road
    const rail = railFaces(C, { P, A, B, side: 1, at: 9 });
    expect(Math.max(...rail.map((f) => f.normal[2]))).toBeGreaterThan(0.9);
    expect(Math.min(...rail.map((f) => f.normal[1]))).toBeLessThan(-0.9);
  });

  it('a track drawn in a language draws only the family, keeps its walls, and without one is as it was', () => {
    const bare = planTrack({ form: 'circuit', course }), drawn = planTrack({ form: 'circuit', course, language: 'candy' });
    expect(bare.language).toBeUndefined();
    expect(drawn.language.laws).toEqual([]);
    expect(Object.keys(drawn.language.parts).sort()).toEqual(['cap', 'edge', 'kerb', 'post', 'rail']);
    expect(drawn.colliders).toEqual(bare.colliders);
    // absent, not a byte: the same manifest again is the same faces
    expect(JSON.stringify(planTrack({ form: 'circuit', course }).faces)).toBe(JSON.stringify(bare.faces));
  });

  it('the same primitive serves the realistic tuning: a circuit\'s rail in steel on its own road', () => {
    const P = planTrack({ form: 'circuit', course: { class: 'circuit', length: 700, twist: 0.4, seed: 2 }, language: 'grand-prix' });
    expect(P.language.laws).toEqual([]);
    expect(Object.keys(P.language.parts).sort()).toEqual(['post', 'rail']);
  });
});

describe('the principles the candy card keeps', () => {
  const P = planTrack({ form: 'circuit', course: { class: 'kart', length: 420, twist: 0.5, seed: 2 }, language: 'candy', kit: { look: 'stylized', seed: 2, pole: 'chunky' } });
  const C = readLanguage('candy');
  it('seen to move and told: the way in two tones, its dash, chevrons, bunting, all of the family', () => {
    expect(P.language.laws).toEqual([]);
    expect(P.language.parts.bunting).toBeGreaterThan(0);
    const own = new Set(Object.values(C.materials).map((m) => m.hex));
    for (const h of P.language.drawn) expect(own.has(h)).toBe(true);
  });
  it('asymmetry: bunting stands down one side of a straight, never both', () => {
    const point = (s, off, dz = 0) => [s, off, dz], F = buntingFaces(C, { point, s0: 0, s1: 60, off: 7 });
    expect(F.length).toBeGreaterThan(0);
    expect(new Set(F.map((f) => Math.sign(f.corners[0][1]))).size).toBe(1);
    expect(buntingFaces(C, { point, s0: 0, s1: 10, off: 7 })).toEqual([]);
  });
  it('a chevron points into its corner, and a tree is lopsided and seeded', () => {
    // the tip is the point furthest toward `d`, and it lies in the arrow's middle along the way
    const point = (s, off, dz = 0) => [s, off, dz], V = C.parts.way.chevrons;
    for (const d of [1, -1]) {
      const ps = chevronFaces(C, { point, s: 0, c: 0, d }).flatMap((f) => f.corners), far = Math.max(...ps.map((p) => d * p[1]));
      expect(far).toBeCloseTo(V.w / 2, 6);
      for (const p of ps.filter((q) => d * q[1] > far - 1e-6)) expect(Math.abs(p[0])).toBeLessThanOrEqual(V.t / 2 + 1e-6);
    }
    const dice = (seed) => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
    const tree = (seed) => treeFaces(C, { at: [0, 0, 0], h: 8, rnd: dice(seed), leaf: ['#2a6a2a', '#3a8a3a', '#56a856'], bark: '#6a4a3a' });
    const crown = tree(5).filter((f) => f.part === 'crown').flatMap((f) => f.corners), mx = crown.reduce((s, p) => s + p[0], 0) / crown.length, my = crown.reduce((s, p) => s + p[1], 0) / crown.length;
    expect(Math.hypot(mx, my)).toBeGreaterThan(0.05);
    expect(JSON.stringify(tree(5))).toBe(JSON.stringify(tree(5)));
    expect(JSON.stringify(tree(5))).not.toBe(JSON.stringify(tree(6)));
  });
});

describe('the trackside pieces in the language', () => {
  it('each stand-in exists, takes its piece\'s params, and builds round; every painted group is the family\'s', async () => {
    const { TRACK_BLOCKS, paintPiece } = await import('./set-pieces.js');
    const { buildBlock } = await import('../era/blocks.js');
    const C = readLanguage('candy'), P = C.parts.pieces;
    for (const [from, to] of Object.entries(P.blocks)) {
      expect(TRACK_BLOCKS[to], to).toBeTruthy();
      expect(Object.keys(TRACK_BLOCKS[to].params).sort(), to).toEqual(Object.keys(TRACK_BLOCKS[from].params).sort());
    }
    for (const id of Object.keys(P.paint)) expect(C.materials[P.paint[id]], id).toBeTruthy();
    // one stand-in built and painted on the chunky look: only the family's colours go in, a gloss where the finish says
    const b = buildBlock(TRACK_BLOCKS['lolly-board'], { params: { w: 1.6, h: 1.4, count: 3 }, library: TRACK_BLOCKS });
    const seen = [];
    const K = { pole: 'chunky', colourOf: () => { throw new Error('a group the language paints never reaches the kit'); } };
    paintPiece(b.faces.map((f) => new Proxy(f, { get: (t, k) => (k === 'group' && seen.push(t.group), t[k]) })), K, { language: C });
    expect(seen.every((g) => P.paint[g])).toBe(true);
  });

  it('a kart track from words is dressed in the stand-ins; a circuit keeps its own pieces', async () => {
    const { composeTrack } = await import('./trackscape-compose.js');
    const { planScapedTrack } = await import('./trackscape-dress.js');
    const kart = planScapedTrack(composeTrack('a short kart track', { seed: 2 })).scape.pieces.map((p) => p.block);
    const stand = new Set(Object.values(readLanguage('candy').parts.pieces.blocks)), plain = new Set(Object.keys(readLanguage('candy').parts.pieces.blocks));
    expect(kart.some((b) => stand.has(b))).toBe(true);
    expect(kart.some((b) => plain.has(b))).toBe(false);
  });
});
