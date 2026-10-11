import { describe, it, expect } from 'vitest';
import { CUT_PRESETS, CUT_PRESET_IDS, readCut, cutOf, SOURCE_CUTS, BEAM_CUTS, ELEMENT_CUTS, CUT_PATTERNS } from './cuts.js';
import { BEAM_NAMES } from '../elements/beams.js';
import { LOOKS } from '../elements/elements.js';
import { cleave } from './cleave.js';
import { slicing } from './interceptors.js';
import { obox, blockSink } from '../../era/props.js';

// a crate: one box on the floor, built as a skin builds it
function crate() {
  const out = blockSink();
  obox(out, [0, 0, 0.5], [1, 0, 0], [0, 1, 0], [0, 0, 1], [0.5, 0.5, 0.5], { key: null, scale: 1, tint: [0.6, 0.6, 0.6], group: 'obj:body' }, 8);
  return { blocks: out.boxes, frame: { at: [0, 0, 0], N: [0, -1, 0], U: [1, 0, 0] } };
}

describe('the cut', () => {
  it('names its presets, each a cut cleave and slicing take', () => {
    expect(CUT_PATTERNS).toEqual(['grid', 'voronoi', 'slice', 'dismantle']);
    const item = crate();
    for (const id of CUT_PRESET_IDS) {
      const c = readCut(id);
      expect(c, id).toEqual(CUT_PRESETS[id]);
      if (c.pattern === 'dismantle') continue;
      const cut = cleave(item, { pattern: c.pattern, count: c.count, seed: 3 });
      expect(cut.chunks.length, id).toBeGreaterThan(1);
      expect(slicing(cut, item, { style: c.style, seed: 3 }).style, id).toBe(c.style);
    }
  });

  it('reads a cut, a preset under the words given, and says what is wrong', () => {
    expect(readCut({ is: 'shatter', count: 12 })).toEqual({ pattern: 'voronoi', count: 12, style: 'impact' });
    expect(readCut({ pattern: 'grid', style: 'laser', cell: 0.3 })).toEqual({ pattern: 'grid', style: 'laser', cell: 0.3 });
    expect(() => readCut('smash')).toThrow(/a cut's name \(slash, cleave/);
    expect(() => readCut({ pattern: 'melt', style: 'blade' })).toThrow(/pattern is one of grid, voronoi, slice, dismantle/);
    expect(() => readCut({ is: 'slash', style: 'glow' })).toThrow(/style is one of blade, laser, anime, impact/);
    expect(() => readCut({ is: 'slash', count: 5 })).toThrow(/1 to 3 for a slice/);
    expect(() => readCut({ is: 'slash', heat: 2 })).toThrow(/heat is not part of a cut/);
  });

  it('a blow\'s cut: the thing\'s own, the blow\'s own, its element\'s, else its source\'s', () => {
    expect(cutOf({ source: 'swing' })).toEqual(CUT_PRESETS.slash);
    expect(cutOf({ source: 'back' })).toEqual(CUT_PRESETS.cleave);
    expect(cutOf({ source: 'beam', kind: 'laser' })).toEqual(CUT_PRESETS.burn);
    expect(cutOf({ source: 'beam', kind: 'laser', element: 'ice' })).toEqual(CUT_PRESETS.shatter);
    expect(cutOf({ source: 'swing', element: 'wet' })).toEqual(CUT_PRESETS.slash);   // a look with no cut keeps the source's
    expect(cutOf({ source: 'swing', element: 'fire', blow: 'dice' })).toEqual(CUT_PRESETS.dice);
    expect(cutOf({ source: 'swing', blow: 'dice', thing: 'shatter' })).toEqual(CUT_PRESETS.shatter);   // glass shatters whatever hits it
    expect(cutOf({ source: 'nothing' })).toEqual(CUT_PRESETS.chip);
  });

  it('every row names what exists: every beam kind, real element looks, real presets', () => {
    expect(Object.keys(BEAM_CUTS).sort()).toEqual([...BEAM_NAMES].sort());
    for (const look of Object.keys(ELEMENT_CUTS)) expect(LOOKS[look], look).toBeTruthy();
    for (const p of [...Object.values(SOURCE_CUTS), ...Object.values(BEAM_CUTS), ...Object.values(ELEMENT_CUTS)]) expect(CUT_PRESET_IDS).toContain(p);
  });
});
