import { describe, it, expect } from 'vitest';
import { stylismErrors, resolveStylism, heighten, spendDetail, ZONES } from './stylism.js';
import { resolveMutagen, oozeFauna } from './index.js';
import { MOTIFS } from './motif.js';
import { SPECIES, speciesParams } from '../fauna/species.js';
import { PER_RIG } from '../fauna/test-cases.js';

// The creature stylist: the hero tuner's laws, read on pushes the test makes and on one ring-headed species.
const ALL = { horns: true, cheeks: true, hackles: true, shoulders: true, ruff: true, spurs: true, bands: true, tailSpikes: true, tipGlow: true };
const COST = { horns: 3, cheeks: 2, hackles: 3, shoulders: 2, ruff: 2, spurs: 2, tailSpikes: 2, bands: 1, tipGlow: 1 };
const ZONE = { horns: 'head', cheeks: 'head', hackles: 'back', shoulders: 'shoulders', ruff: 'shoulders', spurs: 'forelegs', bands: 'forelegs', tailSpikes: 'tail', tipGlow: 'tail' };
const worn = (p) => Object.keys(COST).filter((k) => (k === 'bands' || k === 'tipGlow' ? !!p[k] : k === 'tailSpikes' || k === 'hackles' ? !!p[k]?.count : !!p[k]?.size));
const weights = (p) => { const w = Object.fromEntries(ZONES.map((z) => [z, 0])); for (const k of worn(p)) w[ZONE[k]] += COST[k]; return w; };

describe('the creature stylist', () => {
  it('refuses words it does not know, naming the ones it does', () => {
    expect(stylismErrors({ register: 'epic' })[0]).toMatch(/grounded \| storybook \| heroic \| mythic/);
    expect(stylismErrors({ detail: 2 })[0]).toMatch(/plain \| considered/);
    expect(stylismErrors({ focal: 'wings' })[0]).toMatch(/head, shoulders/);
    expect(stylismErrors({ motif: 'jade' })[0]).toMatch(/horn, bone/);
    expect(stylismErrors({ genre: 'fantasy' })[0]).toMatch(/not a stylism word/);
    expect(stylismErrors(undefined)).toEqual([]);
  });

  it('the spec\'s words stand over the rows\', key by key; the defaults are storybook and considered', () => {
    expect(resolveStylism([undefined], undefined)).toBeNull();
    const S = resolveStylism([{ register: 'mythic', detail: 'rich' }], { detail: 'plain' });
    expect([S.r, S.d, S.a, S.focal]).toEqual([1, 0, 1, 'head']);
    expect(resolveStylism([], { focal: 'tail' })).toMatchObject({ r: 0.35, d: 0.35, a: 0, c: 0, focal: 'tail' });
    expect(resolveStylism([], { register: 'mythic' }).c).toBe(0.66);   // a mythic register is hybrid unless told
    expect(resolveStylism([], { register: 'mythic', chimera: 'pure' }).c).toBe(0);
    expect(stylismErrors({ chimera: 'griffin' })[0]).toMatch(/pure \| touched \| hybrid \| chimera/);
  });

  it('the warp: storybook is the design itself; above it departures grow, ornaments and the creature grow, counts stay', () => {
    const form = { scale: 1.2 }, push = { wedge: { fore: 1.4 }, horns: { size: 1 }, hackles: { count: 6, height: 0.5 }, expression: { jawOpen: 10 }, head: { pace: 0.5 } };
    expect(heighten(form, push, 0)).toEqual({ form, push });
    const H = heighten(form, push, 1);
    expect(H.push.wedge.fore).toBeCloseTo(1.4 ** 1.6, 6);
    expect(H.push.horns.size).toBe(1.5);
    expect(H.push.hackles).toEqual({ count: 6, height: 0.75 });
    expect(H.push.expression.jawOpen).toBe(13);
    expect(H.push.head.pace).toBe(0.5);
    expect(H.form.scale).toBe(1.5);
    expect(push.wedge.fore).toBe(1.4);   // the design is not touched
  });

  it('the budget is spent from the focal out, never past itself, and no zone reaches the focal\'s weight', () => {
    for (const d of [0.35, 0.7, 1]) for (const focal of ZONES) for (const base of [{}, { hackles: { count: 6, height: 0.5 } }]) {
      const S = { r: 0.7, d, a: 0.538, focal }, D = spendDetail(S, base, ALL), w = weights(D.push);
      const spent = worn(D.push).filter((k) => !worn(base).includes(k)).reduce((t, k) => t + COST[k], 0) + (D.push.motifGlow ? 1 : 0);
      expect(spent, `${focal} ${d}`).toBeLessThanOrEqual(D.budget);
      expect(D.left, `${focal} ${d}`).toBe(D.budget - spent);
      // the stylist never raises a zone to the focal's weight; where the oozes' own design already outweighs it, it says so
      const added = new Set(worn(D.push).filter((k) => !worn(base).includes(k)).map((k) => ZONE[k]));
      for (const z of added) if (z !== focal) expect(w[z], `${focal} ${d}: ${z}`).toBeLessThan(w[focal]);
      if (ZONES.some((z) => z !== focal && w[z] >= w[focal] && w[z] > 0)) expect(D.notes.some((n) => n.technique === 'stalled'), `${focal} ${d}`).toBe(true);
    }
    expect(worn(spendDetail({ r: 0.35, d: 0, a: 0, focal: 'head' }, {}, ALL).push)).toEqual([]);   // plain spends nothing
  });

  it('the echo is the motif again away from the focal; the accent comes from heroic up; the notes say why', () => {
    const D = spendDetail({ r: 0.7, d: 1, a: 0.538, focal: 'head', motif: 'horn' }, {}, ALL);
    const echo = D.notes.find((n) => n.technique === 'echo');
    expect(echo.where).not.toBe('head');
    expect(D.push.motifGlow).toBe(true);
    expect(spendDetail({ r: 0.35, d: 1, a: 0, focal: 'head', motif: 'horn' }, {}, ALL).push.motifGlow).toBeUndefined();
    expect(D.notes[0]).toMatchObject({ stage: 'detail', principle: 'how many, never how big' });
    expect(D.push.horns.size).toBeCloseTo(1 + 0.5 * 0.538, 6);   // the register's growth on what the budget adds
  });

  it('a body that cannot wear the focal moves it, and says so', () => {
    const D = spendDetail({ r: 0.35, d: 0.7, a: 0, focal: 'head' }, {}, { ...ALL, horns: false, cheeks: false });
    expect(D.focal).not.toBe('head');
    expect(D.notes.some((n) => /a worn head mesh/.test(n.why))).toBe(true);
  });
});

describe('the creature stylist on a body', () => {
  const id = PER_RIG[0], P = speciesParams(id);
  it('a stylism alone styles a plain species: ornaments on joints of their own, in the motif, a clear step from the coat', () => {
    const r = {}, plan = oozeFauna(P, resolveMutagen(undefined, { key: id, stylism: { register: 'heroic', detail: 'rich' } }), r);
    expect(r.notes[0].stage).toBe('register');
    expect(plan.heads[0].plan.ornaments.some((o) => o.name === 'oozeCheek')).toBe(true);
    expect(plan.heads[0].plan.ornaments.some((o) => o.name === 'oozeHorn')).toBe(false);   // horns are the chimera's (pure here)
    const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    expect(Math.abs(lum(plan.palette.Motif) - lum(P.colors.coat))).toBeGreaterThan(0.08);
  });

  it('a worn head mesh takes no horns: the detail gathers elsewhere', () => {
    const mesh = Object.keys(SPECIES).find((s) => speciesParams(s).headMesh), r = {};
    const plan = oozeFauna(speciesParams(mesh), resolveMutagen(undefined, { key: mesh, stylism: { detail: 'rich' } }), r);
    expect(plan.heads?.[0]?.plan?.ornaments?.some((o) => o.name === 'oozeHorn') ?? false).toBe(false);
    expect(r.notes.some((n) => n.technique.startsWith('focal '))).toBe(true);
  });

  it('every motif names a colour and a curl', () => {
    for (const [k, m] of Object.entries(MOTIFS)) { expect(m.color, k).toMatch(/^#[0-9a-f]{6}$/i); expect(m.curl, k).toBeGreaterThanOrEqual(0); }
  });
});
