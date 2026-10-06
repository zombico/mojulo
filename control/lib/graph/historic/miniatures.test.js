import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { planHistoricCity, assembleHistoricCityScene, METRES_PER_UNIT } from './historic-city.js';
import { historicOptions } from './historic-kind.js';
import { miniatureFaces, DRESS } from './miniatures.js';
import { HISTORIC_CULTURES } from './cultures/index.js';
import { pedestrianFaces, CUTS } from '../figures/pedestrian-asset.js';
import { beastFaces } from '../figures/beast-asset.js';
import { BEASTS, HERDS } from './beasts.js';

const s = 1 / METRES_PER_UNIT;
const hash = (x) => createHash('sha1').update(JSON.stringify(x)).digest('hex');

describe('historic miniatures', () => {
  const plan = planHistoricCity({ culture: 'pompeii' });

  it('stands citizens in the town and field hands outside it, the same each time', () => {
    const a = miniatureFaces(plan, true, s, 1), b = miniatureFaces(plan, true, s, 1);
    expect(a.citizens).toBeGreaterThan(100);
    expect(a.hands).toBeGreaterThan(50);
    expect(hash(a.faces)).toBe(hash(b.faces));
    expect(hash(miniatureFaces(plan, true, s, 2).faces)).not.toBe(hash(a.faces));
  });

  it('is a figure of a few hundred quads at a man\'s height', () => {
    const one = miniatureFaces(plan, { density: 0.02, hands: false }, s, 1);
    const per = one.faces.length / one.citizens;
    expect(per).toBeLessThan(320);
    const top = Math.max(...one.faces.flatMap((f) => f.corners.map((c) => c[2]))) / s;
    expect(top).toBeGreaterThan(1.3);
    expect(top).toBeLessThan(2.2);
  });

  it('turns each half off, and thins with density', () => {
    expect(miniatureFaces(plan, { citizens: false }, s).citizens).toBe(0);
    expect(miniatureFaces(plan, { hands: false }, s).hands).toBe(0);
    expect(miniatureFaces(plan, { density: 0.1 }, s).citizens).toBeLessThan(miniatureFaces(plan, { density: 0.9 }, s).citizens);
  });

  it('adds nothing when absent, and nothing to the CSS page', () => {
    const off = assembleHistoricCityScene({ culture: 'pompeii', world: true });
    expect(off.stats.people).toBeUndefined();
    const page = assembleHistoricCityScene({ culture: 'pompeii', people: true });
    expect(page.stats.people).toBeUndefined();
    expect(hash(page.faces)).toBe(hash(assembleHistoricCityScene({ culture: 'pompeii' }).faces));
    const on = assembleHistoricCityScene({ culture: 'pompeii', world: true, people: true });
    expect(on.faces.length).toBeGreaterThan(off.faces.length);
    expect(on.stats.people.citizens).toBeGreaterThan(0);
  }, 180000);   // four Pompeii builds

  it('dresses every culture, nobody bare: a shirt on every body and a skirt cut to a hem', () => {
    for (const c of Object.keys(HISTORIC_CULTURES)) for (const k of ['skin', 'man', 'woman', 'hand']) {
      expect(DRESS[c][k].length, `${c}.${k}`).toBeGreaterThan(0);
      if (k !== 'skin') for (const g of DRESS[c][k]) { expect(g.shirt, `${c}.${k}`).toMatch(/^#[0-9a-f]{6}$/); expect(Object.keys(CUTS), `${c}.${k}`).toContain(g.cut); }
    }
  });

  it('a cut clothes the figure in a fitted skirt and leaves out the legs under it', () => {
    const bare = pedestrianFaces({ lod: 'mini', pose: 'stoop' }), robe = pedestrianFaces({ lod: 'mini', pose: 'stoop', cut: 'ankle', palette: { skin: '#000000', shirt: '#111111', skirt: '#ffffff', pants: '#000000', shoe: '#000000' } });
    expect(robe.some((f) => f.fill !== '#000000' && parseInt(f.fill.slice(1, 3), 16) > 0x60)).toBe(true);   // the skirt, lit
    expect(robe.length).toBeLessThan(bare.length + 30);
  });

  it('stands beasts of burden from the culture\'s herd, and taking them away moves no one', () => {
    const on = miniatureFaces(plan, true, s, 1), off = miniatureFaces(plan, { beasts: false }, s, 1);
    expect(on.beasts).toBeGreaterThan(10);
    expect(off.beasts).toBe(0);
    const herd = new Set([...HERDS.pompeii.field, ...HERDS.pompeii.town]);
    for (const b of on.herd) expect(herd.has(b.kind), b.kind).toBe(true);
    expect(on.herd.some((b) => b.kind === 'ox')).toBe(true);
    // the people come first and the beasts on their own stream: everyone stands where they stood without them
    expect(hash(on.faces.slice(0, off.faces.length))).toBe(hash(off.faces));
  });

  it('shades the miniatures smooth (per-corner colour), and the city\'s pedestrians stay flat', () => {
    expect(pedestrianFaces({}).some((f) => f.cornerFills)).toBe(false);
    const soft = pedestrianFaces({ lod: 'mini', cut: 'knee', smooth: true });
    expect(soft.every((f) => f.cornerFills && f.cornerFills.length === 4)).toBe(true);
    expect(soft.some((f) => new Set(f.cornerFills).size > 1)).toBe(true);   // the corners differ across a face
    expect(miniatureFaces(plan, { density: 0.05, beasts: false }, s).faces.every((f) => f.cornerFills)).toBe(true);   // (a yoke or a pannier is a plain box)
  });

  it('bakes each creature-creator recipe low-poly, standing at its height', () => {
    for (const [k, b] of Object.entries(BEASTS)) {
      const f = beastFaces({ key: k, recipe: b.recipe, height: b.height });
      expect(f.length, k).toBeLessThan(500);
      const zs = f.flatMap((q) => q.corners.map((c) => c[2]));
      expect(Math.min(...zs), k).toBeCloseTo(0, 1);
      expect(Math.max(...zs), k).toBeCloseTo(b.height, 1);
    }
  });

  it('the historic kind takes people, checked', () => {
    expect(historicOptions({ culture: 'pompeii', people: true }).opts.people).toBe(true);
    expect(historicOptions({ culture: 'pompeii', people: { density: 0.3 } }).opts.people).toEqual({ density: 0.3 });
    expect(historicOptions({ culture: 'pompeii' }).opts.people).toBeUndefined();
    expect(() => historicOptions({ culture: 'pompeii', people: { density: 2 } })).toThrow(/density/);
    expect(() => historicOptions({ culture: 'pompeii', people: 'lots' })).toThrow(/people/);
  });
});
