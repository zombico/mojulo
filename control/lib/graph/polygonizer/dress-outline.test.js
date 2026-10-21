// The dressed outline read (dress-outline.js) on the realistic body, one case per concept: the bare figure (nothing worn
// reads as nothing: no shift, no division, no flair, every return); trousers alone (their sash the one division, their
// leg the flair, the ankle's cuff a return); the gi over them (loose above and below, coming back at the belt, the
// wrists and the ankles; the jacket's skirt at the thigh's widest advised); the knight (the shoulders carried out: a T).
// Deterministic. (Beside the module, not in the critical tier: each case mints a realistic body.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { outlineMeasures, outlineCritic } from './dress-outline.js';

const read = (extra) => { const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', ...extra }) }).recipe; return { r, mesh: compileLayered(r) }; };

describe('the dressed outline', () => {
  let bare, pants, gi, knight;
  beforeAll(() => { bare = read({}); pants = read({ outfit: ['martialPants'] }); gi = read({ outfit: ['martialPants', 'gi'] }); knight = read({ adorn: { type: 'armor', style: 'knight' } }); }, 600_000);

  it('the bare figure: its own family, nothing moved, nothing dividing it, the body line whole', () => {
    const m = outlineMeasures(bare.mesh, bare.r);
    expect(m.family).toBe(m.bareFamily);
    expect(Object.values(m.shift).every((d) => Math.abs(d) < 1e-9)).toBe(true);
    expect(m.divisions).toEqual([]);
    expect(m.flair.pieces).toBe(0);
    expect(m.returns).toEqual(['waist', 'wrist', 'ankle']);
    expect(outlineMeasures(bare.mesh, bare.r)).toEqual(m);
  });

  it('trousers alone: the sash the one division, the trousers the flair, the cuff a return; the top half still skin', () => {
    const m = outlineMeasures(pants.mesh, pants.r);
    expect(m.divisions.map((d) => d.kind)).toEqual(['belt']);
    expect(m.flair.of).toEqual(['martialPants']);
    expect(m.returns).toContain('ankle');
    expect(m.fit.top.class).toBe('skin');
    expect(['loose', 'semi']).toContain(m.fit.bottom.class);
  });

  it('the gi over them: loose above and below, coming back to the body at the belt, the wrists and the ankles', () => {
    const m = outlineMeasures(gi.mesh, gi.r), c = outlineCritic(m, 'anime');
    expect(['loose', 'oversized']).toContain(m.fit.top.class);
    expect(['loose', 'oversized']).toContain(m.fit.bottom.class);
    expect(m.returns).toEqual(['waist', 'wrist', 'ankle']);
    expect(c.reads.find((x) => x.id === 'returns').in).toBe(true);
    // (the body line is not asked of a loose outfit that returns: the rule's escape)
    expect(c.reads.some((x) => x.id === 'bodyLine')).toBe(false);
    expect(m.flair.of).toEqual(['gi', 'martialPants']);
    // the jacket's skirt ends at the thigh's widest, halving the figure: advised, in both styles
    for (const style of ['western', 'anime']) expect(outlineCritic(m, style).advice.join(' ')).toMatch(/thigh's widest/);
  });

  it('the knight: the shoulders carried out past the body, a T over the bare V', () => {
    const m = outlineMeasures(knight.mesh, knight.r);
    expect(m.bareFamily).toBe('V');
    expect(m.family).toBe('T');
    expect(m.at.shoulder.e).toBeGreaterThan(0.15);
  });
});
