/**
 * A local meru: tiers stacked up one meru, each saying how the walk gets up it; laid on from the trail it follows,
 * judged by its laws, drawn as a premap before anything is built, and built on an isekai stage.
 */
import { describe, expect, it } from 'vitest';

import { planLocalMeru, localMeruLaws, readLocalMeru, moundRadius, moundHeightAt, planFactor, LOCAL_MERU, FORMS, UPS } from './plan.js';
import { LOCAL_MERU_PRESETS, LOCAL_MERU_PRESET_IDS } from './presets.js';
import { localMeruPremapHtml } from './premap.js';
import { assembleStageScene } from '../era/stage.js';
import { walkModeScript } from '../scene/channels/walk.js';

const AFTER = { after: { kit: 'isekai-meadow', seed: 8 } };
const plans = new Map();
const plan = (r = AFTER) => { const k = JSON.stringify(r); return plans.get(k) || plans.set(k, planLocalMeru(r)).get(k); };
const broken = (p) => localMeruLaws(p).filter((l) => l.ok === false).map((l) => l.law);

describe('local meru: the recipe', () => {
  it('reads tiers against their forms and ways up, and says what is wrong', () => {
    const R = readLocalMeru({});
    expect(R.tiers.map((t) => [t.id, t.form, t.up.via])).toEqual([['mound', 'mound', 'spiral'], ['tower', 'tower', 'climb']]);
    expect(R.tiers[0]).toMatchObject(FORMS.mound.dials);
    expect(R.tiers[0].up).toMatchObject(UPS.spiral);
    expect(readLocalMeru({ tiers: [{ form: 'mound' }, { form: 'mound' }] }).tiers.map((t) => t.id)).toEqual(['mound-1', 'mound-2']);
    expect(() => readLocalMeru({ height: 4 })).toThrow(/'height' is not a setting/);
    expect(() => readLocalMeru({ tiers: [{ form: 'castle' }] })).toThrow(/'castle' is not a form/);
    expect(() => readLocalMeru({ tiers: [{ form: 'mound', peak: 3 }] })).toThrow(/a mound has no 'peak'/);
    expect(() => readLocalMeru({ tiers: [{ form: 'tower', up: { via: 'spiral' } }] })).toThrow(/a tower is climbed by climb/);
    expect(() => readLocalMeru({ tiers: [{ form: 'mound', up: { turns: 1, rope: 2 } }] })).toThrow(/a spiral has no 'rope'/);
    expect(() => readLocalMeru({ tiers: [{ form: 'tower' }, { form: 'mound' }] })).toThrow(/a mound on a tower/);
    expect(() => readLocalMeru({ tiers: [{ form: 'mound', sides: 2 }] })).toThrow(/sides is 0/);
    expect(() => readLocalMeru({ preset: 'castle' })).toThrow(/preset 'castle' is not one/);
  });

  it('the older words still read: one mound, its spiral, a tower', () => {
    const R = readLocalMeru({ mound: { height: 10 }, path: { turns: 1, approach: 20 }, tower: { side: 2.5, link: { prefer: 'rope' } } });
    expect(R.approach).toBe(20);
    expect(R.tiers.map((t) => [t.form, t.up.via])).toEqual([['mound', 'spiral'], ['tower', 'climb']]);
    expect([R.tiers[0].height, R.tiers[0].up.turns, R.tiers[1].side, R.tiers[1].up.link.prefer]).toEqual([10, 1, 2.5, 'rope']);
  });

  it('a mound narrows from its foot to its summit, its flank answers both ways, a polygon stands out at its corners', () => {
    const M = FORMS.mound.dials;
    expect(moundRadius(M, 0)).toBe(M.foot);
    expect(moundRadius(M, M.height)).toBe(M.summit);
    for (const z of [1, 4, 9]) expect(moundHeightAt(M, moundRadius(M, z))).toBeCloseTo(z, 6);
    expect(planFactor(0, 0, 1.2)).toBe(1);
    expect(planFactor(4, 0, Math.PI / 4)).toBeCloseTo(1, 9);          // a face's middle: the apothem
    expect(planFactor(4, 0, 0)).toBeCloseTo(Math.SQRT2, 9);           // a corner
  });
});

describe('local meru: the plan', () => {
  it('the default after the isekai meadow: every law holds, from the seam to the top of the tower', () => {
    const p = plan(), [m, t] = p.tiers, L = p.links[0];
    expect(broken(p)).toEqual([]);
    expect(p.join.from).toBe('out-trail:trail');
    expect(L.path[0].z).toBeCloseTo(p.join.at[2], 6);
    expect(L.path[L.path.length - 1].z).toBeCloseTo(m.top, 6);
    expect(L.turns).toBeCloseTo(m.up.turns, 1);
    expect(L.flights.every((f) => f.risers <= LOCAL_MERU.going.flight)).toBe(true);
    expect(L.flights.reduce((n, f) => n + f.risers, 0)).toBe(L.going.n);
    expect(t.base).toBe(m.top);
    expect(t.deckZ - t.base).toBeCloseTo(t.deck, 6);
  });

  it('the meru carries every tier in height order up one axis', () => {
    const p = plan(), names = p.meru.stack.map((m) => m.name);
    expect(names[0]).toBe('seam');
    expect(names.slice(-5)).toEqual(['mound', 'tower', 'tower.rail', 'tower.eave', 'tower.apex']);
    expect(names.filter((n) => n.startsWith('mound.landing-'))).toHaveLength(p.links[0].landings.length);
  });

  it('asks to have every connector joined: each with its way on, its ends and what it prefers', () => {
    const p = plan(), A = p.anchors, ids = A.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(A.every((a) => a.level === 'local-meru:meru')).toBe(true);
    const sites = A.filter((a) => a.kind === 'site');
    expect(sites.map((a) => a.site)).toEqual([...p.links[0].flights.map(() => 'stairs'), 'climb']);
    for (const a of sites) {
      expect(Math.hypot(...a.N)).toBeCloseTo(1, 4);
      expect(a.to[2] - a.from[2]).toBeCloseTo(a.rise, 4);
      expect((a.to[0] - a.from[0]) * a.N[0] + (a.to[1] - a.from[1]) * a.N[1]).toBeGreaterThan(0);
    }
    expect(A.find((a) => a.id === 'tower.climb').link).toEqual(UPS.climb.link);
    expect(A.find((a) => a.kind === 'junction').between).toEqual(['out-trail:trail', 'local-meru:meru']);
    expect(A.find((a) => a.id === 'foot').N).toEqual(p.join.N);
  });

  it('says when the level does not hold', () => {
    expect(broken(plan({ ...AFTER, tiers: [{ form: 'mound' }, { form: 'tower', side: 7 }] }))).toEqual(['tower: fits']);
    expect(broken(plan({ ...AFTER, tiers: [{ form: 'mound', up: { turns: 3 } }] }))).toContain('mound: shelves');
    expect(broken(plan({ ...AFTER, tiers: [{ form: 'mound' }, { form: 'tower', deck: 8 }] }))).toEqual(['tower: one-pull']);
    expect(broken(plan({ ...AFTER, approach: 4 }))).toEqual(['clear']);
    expect(broken(plan({ ...AFTER, tiers: [{ form: 'mound', foot: 16, summit: 6 }, { form: 'mound', foot: 5, summit: 2, height: 4, up: { via: 'stair' } }] }))).toContain('mound-2: stair-room');
  });

  it('stands alone at the origin facing +y; right-handed it winds the other way', () => {
    const p = plan({}), q = plan({ tiers: [{ form: 'mound', up: { hand: 'right' } }] });
    expect(p.join.from).toBe(null);
    expect(p.route[0].at[2]).toBe(0);
    expect(Math.sign(p.tiers[0].centre[0])).toBe(-1);
    expect(Math.sign(q.tiers[0].centre[0])).toBe(1);
    expect(broken(p)).toEqual([]);
  });

  it('every tier faces the way the walk arrives: a way up a stacked tier leaves from where the one below landed', () => {
    const p = plan({ ...AFTER, preset: 'terraced-mountain' }), [lo, hi] = p.tiers, L = p.links[1];
    const aArr = Math.atan2(lo.arrive.at[1] - lo.centre[1], lo.arrive.at[0] - lo.centre[0]);
    expect(L.a0).toBeCloseTo(aArr, 9);
    expect(hi.centre).toEqual(lo.centre);
  });
});

describe('local meru: the presets', () => {
  for (const id of LOCAL_MERU_PRESET_IDS) {
    it(`${id}: ${LOCAL_MERU_PRESETS[id].about} — every law holds, every tier on the one below`, () => {
      const p = plan({ ...AFTER, preset: id });
      expect(broken(p)).toEqual([]);
      p.tiers.forEach((t, k) => expect(t.base).toBeCloseTo(k ? p.tiers[k - 1].top : p.join.at[2], 9));
      expect(p.route[p.route.length - 1].at[2]).toBeCloseTo(p.top.top, 6);
    });
  }
});

describe('local meru: the premap', () => {
  it('the same recipe the same page, every panel, every anchor, every law', () => {
    const a = localMeruPremapHtml(AFTER), b = localMeruPremapHtml(AFTER), p = plan();
    expect(b).toBe(a);
    for (const h of ['1 · plan', '2 · meru', '3 · heartbeat', '4 · two-point', 'Tiers', 'Laws', 'Anchors']) expect(a).toContain(h);
    for (const x of p.anchors) expect(a).toContain(`<b>${x.id}</b>`);
    expect(a).not.toContain('BROKEN');
    expect(localMeruPremapHtml({ ...AFTER, tiers: [{ form: 'mound' }, { form: 'tower', side: 7 }] })).toContain('BROKEN');
  });

  it('draws every preset', () => {
    for (const id of LOCAL_MERU_PRESET_IDS) expect(localMeruPremapHtml({ ...AFTER, preset: id })).not.toContain('BROKEN');
  });
});

describe('local meru: built (a stage with a `meru`)', () => {
  const stage = (m) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 8, ...m });

  it('builds the place in the isekai look, what people build in the kit\'s made style', () => {
    const s = stage({ meru: { after: { trail: true } } }), groups = new Set(s.faces.map((f) => f.group));
    for (const g of ['isekai:ground', 'isekai:cliff', 'isekai:trail', 'isekai:grass', 'meru:timber']) expect(groups.has(g)).toBe(true);
    expect(s.faces.some((f) => f.node === 'tower')).toBe(true);
    expect(s.faces.some((f) => f.node === 'tower.climb')).toBe(true);
    expect(s.localMeru.laws.filter((l) => !l.ok)).toEqual([]);
    expect(s.localMeru.made.kit).toBe('isekai-meadow');
    const c = s.walk.climbs[0], a = s.anchors.find((q) => q.id === 'tower.climb');
    expect([c.base, c.top, c.N]).toEqual([a.from, a.to, a.N]);
  });

  it('a stair stands in as blocks in the kit\'s edge material; a tower with a tier on it has no roof', () => {
    const pyr = stage({ meru: { preset: 'temple-pyramid', after: { trail: true } } });
    expect(pyr.faces.some((f) => f.group === 'meru:timber' || f.group === 'meru:stone')).toBe(true);
    const two = stage({ meru: { preset: 'stacked-lookout', after: { trail: true } } }), p = plan({ ...AFTER, preset: 'stacked-lookout' });
    const lowTop = Math.max(...two.faces.filter((f) => f.node === 'tower-1').flatMap((f) => f.corners.map((q) => q[2])));
    expect(lowTop).toBeLessThan(p.tiers[0].railZ + 0.3);
    expect(two.walk.climbs).toHaveLength(2);
  });

  it('the same recipe the same faces; a meru on a kit that is not isekai is refused', () => {
    expect(JSON.stringify(stage({ meru: { after: { trail: true } } }).faces)).toBe(JSON.stringify(stage({ meru: { after: { trail: true } } }).faces));
    expect(() => assembleStageScene({ kind: 'stage', kit: 'trail-valley', meru: {} })).toThrow(/not an isekai kit/);
  });

  it('the walk script carries a climb only when the walk asks for one', () => {
    const cfg = { speed: 6, spawn: [0, 0, 1.7], radius: 0.4, minEye: 1.7, gravity: 22, jump: 8, bob: null };
    expect(walkModeScript(cfg, [0, 0, 0])).not.toContain('stepClimb');
    expect(walkModeScript({ ...cfg, climbs: [{ base: [0, 0, 0], top: [0, 1, 6], N: [0, 1, 0], width: 1, speed: 2 }] }, [0, 0, 0])).toContain('stepClimb');
  });
});
