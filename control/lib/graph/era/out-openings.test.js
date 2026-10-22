/**
 * The openings as architecture (era/out-openings.js): a light's frame and glazing, a door's leaf, fanlight, surround and
 * steps, on a wall frame and through `speak`. One case per procedure; a language that writes none of it is untouched.
 */
import { describe, it, expect } from 'vitest';
import { surround, lightDress, doorDress, stepsLift } from './out-openings.js';
import { readElement, ELEMENT_SETS, OPENING_WORDS, ENTRY_WORDS } from './out-anchor-elements.js';
import { decompileAnchor, speak, ANCHOR_IDS } from './out-anchor-structure.js';
import { structureStyle } from './out-structures.js';

// a front wall: u along x, z up, d proud toward −y
const W = { len: 10, n: [0, -1, 0], at: (u, z, d = 0) => [u, -d, z] };
const rect = (uc, z0, w, hh) => [[uc - w / 2, z0], [uc + w / 2, z0], [uc + w / 2, z0 + hh], [uc - w / 2, z0 + hh]];
const NEW_PARTS = ['surround', 'glazing', 'joint', 'panel', 'glass', 'transom', 'pilaster', 'entablature', 'hood', 'bracket', 'step'];
const style = structureStyle('isekai-meadow', 1);
const dressed = (changes) => ({ ...ELEMENT_SETS['timber-hall'], elements: { ...ELEMENT_SETS['timber-hall'].elements, ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, { ...ELEMENT_SETS['timber-hall'].elements[k], ...v }])) } });

describe('a light built', () => {
  it('a surround stands proud round its shape, open at a sill\'s foot, its reveal facing in', () => {
    const out = [];
    surround(out, W, rect(2, 1, 1, 1.4), 0.08, 0.1, 'surround', 0.8, {}, { open: true });
    // three edges, each a face and two returns
    expect(out).toHaveLength(9);
    expect(out.every((f) => f.corners.every((c) => c[2] >= 1 - 1e-9))).toBe(true);
    const fronts = out.filter((f) => f.normal[1] < -0.9);
    expect(fronts.every((f) => f.corners.every((c) => Math.abs(c[1] + 0.1) < 1e-9))).toBe(true);
    // the jamb's reveal faces into the light (its normal toward the light's centre)
    const jamb = out.find((f) => Math.abs(f.normal[0]) > 0.9 && f.corners.every((c) => Math.abs(c[0] - 1.5) < 1e-9));
    expect(jamb.normal[0]).toBeGreaterThan(0.9);
    const closed = [];
    surround(closed, W, rect(2, 1, 1, 1.4), 0.08, 0.1, 'surround', 0.8, {}, { open: false });
    expect(closed).toHaveLength(12);
  });

  it('each glazing lays its bars inside the light, standing just off the glass', () => {
    const L = { kind: 'rect', uc: 2, z0: 1, w: 1, hh: 1.4, pts: rect(2, 1, 1, 1.4) };
    const counts = {};
    for (const g of ['lattice', 'sash', 'casement', 'plate', 'none']) {
      const out = [];
      lightDress(out, W, L, { glazing: g, trim: 'str:paint', trimValue: 0.9 });
      counts[g] = out.length;
      for (const f of out) for (const c of f.corners) { expect(c[0]).toBeGreaterThan(1.45); expect(c[0]).toBeLessThan(2.55); expect(c[2]).toBeGreaterThan(0.95); expect(c[2]).toBeLessThan(2.45); }
      expect(out.every((f) => f.group === 'str:paint' && f.part === 'glazing')).toBe(true);
    }
    expect(counts.plate).toBe(0);
    expect(counts.none).toBe(0);
    expect(counts.casement).toBe(2);
    expect(counts.sash).toBeGreaterThan(counts.casement);
    expect(counts.lattice).toBeGreaterThan(counts.sash);
  });
});

describe('a door built', () => {
  const door = (spec, room = 0.6) => { const out = [], D = { kind: 'rect', uc: 3, w: 1, h: 2.2, pts: rect(3, 0, 1, 2.2), room }; const r = doorDress(out, W, D, spec, { arc: 5 }); return { out, ...r }; };
  it('its steps stand below the threshold, out from the wall, and lift the floor by their rise', () => {
    const { out } = door({ steps: 2 });
    const steps = out.filter((f) => f.part === 'step');
    expect(steps.length).toBeGreaterThan(0);
    expect(Math.max(...steps.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(0, 9);
    expect(Math.min(...steps.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(-stepsLift(2), 9);
    expect(stepsLift(0)).toBe(0);
  });
  it('a fanlight keeps to the room the storey leaves: a half-round, or a segment of one', () => {
    const tall = door({ fanlight: 'arch' }, 0.8), low = door({ fanlight: 'arch' }, 0.4);
    expect(tall.top).toBeCloseTo(2.2 + 0.05 + 0.5, 9);
    expect(low.top).toBeLessThanOrEqual(2.2 + 0.4);
    expect(door({ fanlight: 'arch' }, 0.2).top).toBe(2.2);
  });
  it('each leaf and surround adds its own parts', () => {
    const parts = (spec) => new Set(door(spec).out.map((f) => f.part));
    expect(parts({ leaf: 'boards' })).toEqual(new Set(['joint']));
    expect(parts({ leaf: 'panels' })).toEqual(new Set(['panel']));
    expect(parts({ leaf: 'glazed' })).toEqual(new Set(['panel', 'glass', 'glazing']));
    expect(parts({ surround: 'pilasters' })).toEqual(new Set(['surround', 'pilaster', 'entablature']));
    expect(parts({ surround: 'hood' })).toEqual(new Set(['surround', 'hood', 'bracket']));
  });
});

describe('in the language', () => {
  it('the words ride the elements\' rails, refused off them by name', () => {
    expect(() => readElement('lights', { kind: 'light', glazing: 'stained' })).toThrow(/glazing is none \| lattice \| sash/);
    expect(() => readElement('door', { kind: 'door', steps: 5 })).toThrow(/steps is 0–3/);
    expect(() => readElement('door', { kind: 'door', surround: 'portico' })).toThrow(/surround is none \| frame/);
    expect(() => readElement('shutters', { kind: 'shutters', form: 'roller' })).toThrow(/form is flat \| boards \| louvred/);
  });

  it('a language that writes none of them speaks as it did: no new part, nothing on its proportions', () => {
    for (const id of ANCHOR_IDS) {
      const L = decompileAnchor(id), b = speak(L, 'dwelling', { w: 12, d: 18 }, style, 3, { ring: 'near' });
      expect(b.faces.filter((f) => NEW_PARTS.includes(f.part))).toEqual([]);
      expect(Object.keys(L.proportions.opening).filter((k) => OPENING_WORDS.includes(k))).toEqual([]);
      expect(Object.keys(L.proportions.entry).filter((k) => ENTRY_WORDS.includes(k))).toEqual([]);
    }
  });

  it('a language that writes them builds them, the lane face kept when the budget bites; the steps on the dims', () => {
    const L = decompileAnchor(dressed({ lights: { frame: 0.08, glazing: 'lattice', trim: 'str:timber' }, door: { leaf: 'panels', surround: 'frame', steps: 2 } }));
    const b = speak(L, 'dwelling', { w: 12, d: 18 }, style, 3, { ring: 'near' }), has = (p) => b.faces.some((f) => f.part === p);
    for (const p of ['surround', 'glazing', 'panel', 'step']) expect(has(p), p).toBe(true);
    expect(b.dims.steps).toBe(2);
    // the budget sheds the dressing off the lane face before the lane's own
    const lane = b.faces.filter((f) => f.part === 'glazing' && f.normal[1] < -0.9);
    expect(lane.length).toBeGreaterThan(0);
    const tris = b.faces.reduce((a, f) => a + f.corners.length - 2, 0);
    if (b.why.some((w) => /glazings off the lane face into the tile/.test(w))) expect(b.faces.filter((f) => f.part === 'glazing' && Math.abs(f.normal[1] + 1) > 0.3)).toEqual([]);
    expect(tris).toBeGreaterThan(0);
    // far, no dressing at all (it is a detail's depth)
    const far = speak(L, 'dwelling', { w: 12, d: 18 }, style, 3, { ring: 'far' });
    expect(far.faces.filter((f) => NEW_PARTS.includes(f.part) && f.part !== 'step')).toEqual([]);
  });
});
