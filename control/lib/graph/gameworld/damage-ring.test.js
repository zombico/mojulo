// THE DAMAGE RING (damage-ring.js): where the fire is coming from. The bearing of a hit from where a body faces; the
// tracker stepped off a scene (a mark from the pilot's own count of hits and who dealt the last, standing for its life,
// following its attacker, turning with the pilot, the newest first, so many at once); what a world may write; the page's
// block; and the level that carries it: a quick shooter's on foot and a deathmatch, no other.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { RING, hitBearing, ringTracker, readDamageRing, damageRingSource } from './damage-ring.js';
import { damageRingChannelScript } from '../scene/channels/damage-ring.js';
import { quickWorld } from './quick.js';
import { runSteps } from './runner.js';

// a scene as the page's probe gives it: the pilot, who stands round it, the clock
const scene = () => {
  const me = { id: 'p', pilotable: true, hits: 0, lastHitBy: null, transform: { pos: [0, 0, 1.7], heading: 0 } };
  const foes = { a: { id: 'a', transform: { pos: [10, 0, 0] } }, b: { id: 'b', transform: { pos: [-10, 0, 0] } }, c: { id: 'c', transform: { pos: [0, 10, 0] } } };
  const W = { time: 0, byId: { p: me, ...foes }, entities: [me, ...Object.values(foes)] };
  const hit = (id) => { me.hits++; me.lastHitBy = id; };
  return { W, me, foes, hit };
};

// the marks' bearings (each mark also says how much of its life it has left: its own test below)
const bear = (marks) => marks.map((m) => ({ bearing: m.bearing }));

describe('the damage ring', () => {
  it('reads a hit\'s bearing from where the body faces: ahead, its right, behind, its left', () => {
    const at = [0, 0, 0];
    expect([[10, 0, 0], [0, -10, 0], [-10, 0, 0], [0, 10, 0]].map((from) => hitBearing(at, 0, from))).toEqual([0, 90, 180, 270]);
    expect(hitBearing(at, Math.PI / 2, [0, 10, 0])).toBe(0);
  });
  it('marks a hit where it came from, for its life, the newest first; no hit, no mark', () => {
    const { W, me, hit } = scene(), T = ringTracker(RING, hitBearing);
    expect(bear(T.step(W, me))).toEqual([]);
    hit('b'); expect(bear(T.step(W, me))).toEqual([{ bearing: 180 }]);
    W.time = 0.5; hit('c'); expect(bear(T.step(W, me))).toEqual([{ bearing: 270 }, { bearing: 180 }]);
    // the first has stood its life; the second still stands
    W.time = RING.life + 0.2; expect(bear(T.step(W, me))).toEqual([{ bearing: 270 }]);
    W.time = RING.life + 1; expect(bear(T.step(W, me))).toEqual([]);
  });
  it('says how much of its life a mark has left, so it fades as it ages', () => {
    const { W, me, hit } = scene(), T = ringTracker({ life: 2, most: 6 }, hitBearing);
    T.step(W, me);
    hit('a'); expect(T.step(W, me)[0].fade).toBe(1);
    W.time = 1; expect(T.step(W, me)[0].fade).toBe(0.5);
    W.time = 1.9; expect(T.step(W, me)[0].fade).toBe(0.1);
  });
  it('follows its attacker and turns with the pilot; another hit from the same one begins its moment again', () => {
    const { W, me, foes, hit } = scene(), T = ringTracker(RING, hitBearing);
    // (the ring counts from its first frame: what was taken before it stood is not marked)
    T.step(W, me);
    hit('a'); expect(bear(T.step(W, me))).toEqual([{ bearing: 0 }]);
    foes.a.transform.pos = [0, -10, 0]; expect(bear(T.step(W, me))).toEqual([{ bearing: 90 }]);
    me.transform.heading = -Math.PI / 2; expect(bear(T.step(W, me))).toEqual([{ bearing: 0 }]);
    W.time = RING.life - 0.1; hit('a'); T.step(W, me);
    W.time = RING.life + 0.5; expect(T.step(W, me).length).toBe(1);
  });
  it('marks nothing for a hit nobody dealt, and at most so many at once', () => {
    const { W, me, hit } = scene(), T = ringTracker({ life: RING.life, most: 2 }, hitBearing);
    T.step(W, me);
    hit(null); expect(bear(T.step(W, me))).toEqual([]);
    hit('gone'); expect(bear(T.step(W, me))).toEqual([]);
    for (const id of ['a', 'b', 'c']) { W.time += 0.1; hit(id); T.step(W, me); }
    expect(bear(T.step(W, me))).toEqual([{ bearing: 270 }, { bearing: 180 }]);
  });
  it('is read as written, and a wrong one taught', () => {
    expect(readDamageRing(true)).toEqual({ life: RING.life, most: RING.most });
    expect(readDamageRing({ life: 3 })).toEqual({ life: 3, most: RING.most });
    expect(() => readDamageRing({ colour: 'red' })).toThrow(/not a damage ring setting/);
    expect(() => readDamageRing({ life: 99 })).toThrow(/seconds a mark stands/);
    expect(() => readDamageRing('on')).toThrow(/is true, or/);
  });
  it('is one block on the page, the same from the same ring, publishing its probe; the module imports nothing', () => {
    const a = damageRingChannelScript(true);
    expect(a).toBe(damageRingChannelScript({ life: RING.life, most: RING.most }));
    expect(a).toContain('window.__mojDamageRing');
    expect(() => new Function(damageRingSource(true))).not.toThrow();
    const src = readFileSync(fileURLToPath(new URL('./damage-ring.js', import.meta.url)), 'utf8');
    expect([...src.matchAll(/^import /gm)]).toEqual([]);
  });
});

describe('the level that carries it', () => {
  const levelOf = (quick) => runSteps(quickWorld({ id: 'r', name: 'R', seed: 2, quick }), { ref: 'r' }).find((s) => /^level-/.test(s.key)).order.manifest;
  it('a quick shooter on foot and a deathmatch carry the ring; a level nobody shoots in does not', () => {
    expect(levelOf({ goal: 'shoot' }).damageRing).toBe(true);
    expect(levelOf({ goal: 'deathmatch' }).damageRing).toBe(true);
    expect(levelOf({ goal: 'reach' }).damageRing).toBeUndefined();
    // (and with it the shooter's HUD, no mission in it: the mission channel's plain page, in the world's look)
    expect(levelOf({ goal: 'shoot' }).mission).toMatchObject({ tasks: [], plain: true });
    expect(levelOf({ goal: 'deathmatch' }).mission).toMatchObject({ tasks: [], plain: true });
    expect(levelOf({ goal: 'reach' }).mission).toBeUndefined();
  });
  it('a mission carries none of its own: it draws the ring in its HUD', () => {
    const m = levelOf({ goal: 'shoot', arms: ['rifle'], mission: true });
    expect(m.damageRing).toBeUndefined();
    expect(Array.isArray(m.mission.tasks)).toBe(true);
  });
});
