// The dressed outline read (dress-outline.js) on the realistic body, one case per concept: the bare figure (nothing worn
// reads as nothing: no shift, no division, no flair, every return); trousers alone (their sash the one division, their
// leg the flair, the ankle's cuff a return); the gi over them (loose above and below, coming back at the belt, the
// wrists and the ankles; the jacket's skirt at the thigh's widest advised); the knight (the plates on the body: the V kept);
// the authored game body read the same way (its own bare family, a skirt's hem a division, the hero's readout carrying it).
// Deterministic. (Beside the module, not in the critical tier: each case mints a realistic body.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest, dressReadout, heroPlanOf } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { outlineMeasures, outlineCritic } from './dress-outline.js';

const read = (extra) => { const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', ...extra }) }).recipe; return { r, mesh: compileLayered(r) }; };

describe('the dressed outline', () => {
  let bare, pants, gi, knight;
  beforeAll(() => { bare = read({}); pants = read({ outfit: ['martialPants'] }); gi = read({ outfit: ['martialPants', 'gi'] }); knight = read({ adorn: { type: 'armor', style: 'knight' } }); }, 600_000);

  it('the bare figure: its own family, nothing moved, nothing dividing it, the body line whole', () => {
    const m = outlineMeasures(bare.mesh, bare.r);
    expect(m.family).toBe(m.bareFamily);
    expect(m.bareFamily).toBe('V');
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
    // (a box over wide legs: the waist unmarked, the hem near the shoulders' width; on the realistic body rounded out the
    // jacket blouses at the belt past the hip, so the box reads between the families, not a clean H)
    expect(m.family).toBe('between');
    expect(m.ratios.waistOverShoulder).toBeGreaterThan(0.8);
    // the jacket's skirt ends at the thigh's widest, halving the figure: advised, in both styles
    for (const style of ['western', 'anime']) expect(outlineCritic(m, style).advice.join(' ')).toMatch(/thigh's widest/);
  });

  it('the knight: the plates lie on the body, the shoulders carried a little past it, the bare V kept', () => {
    // (the realistic armour fitted to the body rounded out wraps the chest and the shoulders: it no longer carries them out
    // into a T, the outline stays the body's V)
    const m = outlineMeasures(knight.mesh, knight.r);
    expect(m.bareFamily).toBe('V');
    expect(m.family).toBe('V');
    expect(m.at.shoulder.e).toBeGreaterThan(0.05);
    expect(m.at.shoulder.e).toBeLessThan(0.15);
  });

  it('the authored game body read the same way: a bare family of its own, a skirt\'s hem a division, the readout carrying it', () => {
    const hero = heroRecord({ cast: 'female', outfit: { type: 'outfit', style: 'sundress' } }), m = expandLayeredManifest({ kind: 'layered', hero }), mesh = compileLayered(m.recipe, m.dials);
    const M = outlineMeasures(mesh, m.recipe);
    expect(M.family).not.toBe(M.bareFamily);
    expect(M.divisions.some((d) => d.kind === 'hem' && d.f > 0.6)).toBe(true);
    const out = dressReadout(hero, heroPlanOf(hero), mesh, m.recipe);
    expect(out.outline).toMatchObject({ family: M.family, bare: M.bareFamily });
    expect(Object.keys(out.outline.advice)).toEqual(['western', 'anime']);
    expect(out.realisticOnly).toBeUndefined();
    // (what the game body wears plain or not at all is said, never refused: the tailoring, a plated suit, a footwear card)
    const suit = heroRecord({ cast: 'male', outfit: { type: 'outfit', style: 'business' } }), sm = expandLayeredManifest({ kind: 'layered', hero: suit });
    expect(dressReadout(suit, heroPlanOf(suit), null, sm.recipe).realisticOnly.join(' ')).toMatch(/tailoring \(.*outer.*tie/);
    const words = heroRecord({ cast: 'male', outfit: ['powerSuit', 'oxfords'] });
    const said = dressReadout(words, heroPlanOf(words), null, null).realisticOnly.join(' ');
    expect(said).toMatch(/powerSuit: plated suits are worn on the realistic body/); expect(said).not.toMatch(/oxfords/);
    const lean = heroRecord({ cast: 'male', core: 'streamlined', outfit: ['oxfords'] });
    expect(dressReadout(lean, heroPlanOf(lean), null, null).realisticOnly.join(' ')).toMatch(/oxfords: worn as plain .* streamlined core/);
  }, 300_000);

  it('the value gradient, the anime/game canon\'s: dark shoes under a light chest in band, light shoes under a dark chest advised', () => {
    const hero = (palette) => { const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', palette, outfit: { type: 'outfit', style: 'casual' } }) }).recipe; return outlineMeasures(compileLayered(r), r); };
    const good = hero({ Top: '#e8e4dc', Shoes: '#2a1d14' }), bad = hero({ Top: '#1d1f24', Shoes: '#f2efe8' });
    expect(good.values.feet).toBeLessThan(good.values.chest); expect(bad.values.feet).toBeGreaterThan(bad.values.chest);
    const reads = (m, st) => outlineCritic(m, st, { sex: 'male' }).reads.filter((r) => r.id === 'gradient');
    expect(reads(good, 'anime')[0].in).toBe(true); expect(reads(bad, 'anime')[0].in).toBe(false);
    expect(outlineCritic(bad, 'anime', { sex: 'male' }).advice.join(' ')).toMatch(/dark shoes under a light chest/);
    expect(reads(bad, 'western')).toEqual([]);
  }, 300_000);
});
