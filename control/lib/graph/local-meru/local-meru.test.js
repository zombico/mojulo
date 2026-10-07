/**
 * A local meru: a mound, a spiral stairway round it, a watchtower on the summit, laid on from the trail it follows,
 * judged by its laws, and drawn as a premap before anything is built.
 */
import { describe, expect, it } from 'vitest';

import { planLocalMeru, localMeruLaws, readLocalMeru, moundRadius, moundHeightAt, LOCAL_MERU } from './plan.js';
import { localMeruPremapHtml } from './premap.js';
import { assembleStageScene } from '../era/stage.js';
import { walkModeScript } from '../scene/channels/walk.js';

const MEADOW = { after: { kit: 'isekai-meadow', seed: 8 } };
const plans = new Map();
const plan = (r = MEADOW) => { const k = JSON.stringify(r); return plans.get(k) || plans.set(k, planLocalMeru(r)).get(k); };
const broken = (p) => localMeruLaws(p).filter((l) => l.ok === false).map((l) => l.law);

describe('local meru', () => {
  it('reads a recipe against its defaults, and says what is wrong', () => {
    expect(readLocalMeru({}).mound).toEqual(LOCAL_MERU.mound);
    expect(readLocalMeru({}).path.approach).toBe(LOCAL_MERU.mound.foot + 1);
    expect(() => readLocalMeru({ height: 4 })).toThrow(/'height' is not a setting/);
    expect(() => readLocalMeru({ mound: { peak: 3 } })).toThrow(/mound\.peak is not a setting/);
    expect(() => readLocalMeru({ mound: { foot: 3, summit: 4 } })).toThrow(/wider than mound\.summit/);
    expect(() => readLocalMeru({ path: { hand: 'up' } })).toThrow(/'left'/);
  });

  it('the mound narrows from its foot to its summit, and its flank answers both ways', () => {
    const M = LOCAL_MERU.mound;
    expect(moundRadius(M, 0)).toBe(M.foot);
    expect(moundRadius(M, M.height)).toBe(M.summit);
    for (const z of [1, 4, 9]) expect(moundHeightAt(M, moundRadius(M, z))).toBeCloseTo(z, 6);
  });

  it('after the isekai meadow: every law holds, the climb starts on the seam and ends on the summit', () => {
    const p = plan();
    expect(broken(p)).toEqual([]);
    expect(p.join.from).toBe('out-trail:trail');
    expect(p.path[0].z).toBeCloseTo(p.join.at[2], 6);
    expect(p.path[p.path.length - 1].z).toBeCloseTo(p.summit.z, 6);
    expect(p.turns).toBeCloseTo(LOCAL_MERU.path.turns, 1);
    // every riser the same, every flight within the man-made index's ten
    expect(p.flights.every((f) => f.risers <= LOCAL_MERU.going.flight && f.R === p.flights[0].R)).toBe(true);
    expect(p.flights.reduce((n, f) => n + f.risers, 0)).toBe(p.going.risers);
  });

  it('the meru carries every tier in order up one axis', () => {
    const p = plan(), names = p.meru.stack.map((m) => m.name);
    expect(names[0]).toBe('seam');
    expect(names.slice(-5)).toEqual(['summit', 'deck', 'rail', 'eave', 'apex']);
    expect(names.filter((n) => n.startsWith('landing-'))).toHaveLength(p.landings.length);
    expect(p.meru.z('deck') - p.meru.z('summit')).toBeCloseTo(LOCAL_MERU.tower.deck, 6);
  });

  it('asks to have every connector joined: each anchor with its way on, a connector with its ends', () => {
    const p = plan(), A = p.anchors, ids = A.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(A.every((a) => a.level === 'local-meru:meru')).toBe(true);
    const sites = A.filter((a) => a.kind === 'site');
    expect(sites.map((a) => a.site)).toEqual([...p.flights.map(() => 'stairs'), 'climb']);
    for (const a of sites) {
      expect(Math.hypot(...a.N)).toBeCloseTo(1, 4);
      expect(a.to[2] - a.from[2]).toBeCloseTo(a.rise, 4);
      // the way on runs from the foot of the connector toward its head
      expect((a.to[0] - a.from[0]) * a.N[0] + (a.to[1] - a.from[1]) * a.N[1]).toBeGreaterThan(0);
    }
    expect(A.find((a) => a.id === 'climb-1').link).toEqual(LOCAL_MERU.tower.link);
    expect(A.find((a) => a.kind === 'junction').between).toEqual(['out-trail:trail', 'local-meru:meru']);
    // the first flight leaves the way the trail it follows was going
    expect(A.find((a) => a.id === 'foot').N).toEqual(p.join.N);
  });

  it('says when the level does not hold: a tower wider than the summit, shelves that stack, a climb too long', () => {
    expect(broken(plan({ ...MEADOW, tower: { side: 7 } }))).toEqual(['tower-fits']);
    expect(broken(plan({ ...MEADOW, path: { turns: 3 } }))).toContain('shelves');
    expect(broken(plan({ ...MEADOW, tower: { deck: 8 } }))).toEqual(['one-pull']);
    expect(broken(plan({ ...MEADOW, path: { approach: 4 } }))).toEqual(['clear']);
  });

  it('stands alone at the origin facing +y when it follows nothing; right-handed it winds the other way', () => {
    const p = plan({}), q = plan({ path: { hand: 'right' } });
    expect(p.join.from).toBe(null);
    expect(p.path[0].at[2]).toBe(0);
    expect(Math.sign(p.centre[0])).toBe(-1);
    expect(Math.sign(q.centre[0])).toBe(1);
    expect(broken(p)).toEqual([]);
  });

  it('draws its premap: the same recipe the same page, every panel, every anchor, every law', () => {
    const a = localMeruPremapHtml(MEADOW), b = localMeruPremapHtml(MEADOW), p = plan();
    expect(b).toBe(a);
    for (const h of ['1 · plan', '2 · meru', '3 · heartbeat', '4 · two-point', 'Laws', 'Anchors']) expect(a).toContain(h);
    for (const x of p.anchors) expect(a).toContain(`<b>${x.id}</b>`);
    expect(a).not.toContain('BROKEN');
    expect(localMeruPremapHtml({ ...MEADOW, tower: { side: 7 } })).toContain('BROKEN');
  });
});

describe('local meru, built (a stage with a `meru`)', () => {
  const stage = (m) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 8, ...m });

  it('builds the place in the isekai look: ground, cliff, the walk, the tower and its stand-in ladder', () => {
    const s = stage({ meru: { after: { trail: true } } }), groups = new Set(s.faces.map((f) => f.group));
    for (const g of ['isekai:ground', 'isekai:cliff', 'isekai:trail', 'isekai:wood', 'isekai:grass']) expect(groups.has(g)).toBe(true);
    expect(s.faces.some((f) => f.node === 'tower')).toBe(true);
    expect(s.faces.some((f) => f.node === 'climb-1')).toBe(true);
    expect(s.localMeru.laws.filter((l) => !l.ok)).toEqual([]);
    expect(s.anchors.map((a) => a.id)).toContain('climb-1');
    // the walk takes the climb its anchor asks for: foot, lip and way in
    const c = s.walk.climbs[0], a = s.anchors.find((q) => q.id === 'climb-1');
    expect([c.base, c.top, c.N]).toEqual([a.from, a.to, a.N]);
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
