import { describe, expect, it } from 'vitest';

import { familyOf, gaitRouted, gaitFit, foeGaitOf, FOE_FAMILIES, WALK_OVER } from './foe-families.js';
import { RAILS } from './rails.js';
import { FOE_CLASSES } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { beastFieldOf, beastMovesOf, beastGaitsOf } from '../egocube/moves.js';
import { motionGaits, motionBehaviors } from '../fauna/rig.js';

// a figure whose run and walk each slide a known way: two feet, planted half a cycle, `m` metres a cycle
const slid = (m, k = 20) => {
  // (planted the first half of its cycle, sliding back m/2 over it: m a cycle)
  const foot = (u) => { const w = ((u % 1) + 1) % 1; return w < 0.5 ? [m / 4 - w * m, 0] : [-m / 4 + (w - 0.5) * m, 0.2]; };
  const b = [];
  for (let f = 0; f < k; f++) { const L = foot(f / k), R = foot(f / k + 0.5); b.push(0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, -0.1, L[0], L[1], 0, 0, 0, 1, 0.1, R[0], R[1]); }
  return { k, b };
};
const BONES = [{ id: 'hip', head: [0, 0, 1], tail: [0, 0, 0.6] }, { id: 'footL', parent: 0, head: [-0.1, 0, 0], tail: [-0.1, 0.2, 0] }, { id: 'footR', parent: 0, head: [0.1, 0, 0], tail: [0.1, 0.2, 0] }];

describe('the foe families: the rails whose foes walk as their bodies do', () => {
  it('a world is routed by the rail its feel\'s template is; any other, and none, as it was', () => {
    const routed = Object.keys(FOE_FAMILIES)[0], pole = RAILS[routed].handles.pole;
    expect(familyOf({ feel: pole })).toMatchObject({ rail: routed });
    expect(gaitRouted({ feel: { pole } })).toBe(true);
    const other = Object.values(RAILS).find((R) => R.handles.pole && !FOE_FAMILIES[Object.keys(RAILS).find((k) => RAILS[k] === R)]);
    expect(gaitRouted({ feel: other.handles.pole })).toBe(false);
    expect(gaitRouted({})).toBe(false);
  });

  it('a flier is made to fly; a foe on its feet is not', () => {
    const flier = Object.values(FOE_CLASSES).find((c) => MOVES[c.move].rule?.flier || MOVES[c.move].needs?.includes('wings'));
    const walker = Object.values(FOE_CLASSES).find((c) => MOVES[c.move].needs?.includes('ground') && !MOVES[c.move].rule?.flier);
    expect(foeGaitOf({ class: flier.id }).fly).toBe(true);
    expect(foeGaitOf({ class: walker.id }).fly).toBe(false);
  });

  it('its run and its walk measured off the clips it plays them with, at its body\'s scale; its walk\'s pace from the walk\'s seconds', () => {
    const F = { bones: BONES, clips: { forward: { ...slid(1.6), s: 0.6 }, walk: { ...slid(1), s: 1 } } };
    const G = gaitFit(F, 0.8);
    expect(G.stride).toBeCloseTo(1.6 * 0.8, 1);
    expect(G.walkStride).toBeCloseTo(0.8, 1);
    expect(G.walkPace).toBeCloseTo(WALK_OVER * G.walkStride / 1, 2);
    // (a figure whose walk is its run, or whose feet never plant, says nothing of it)
    expect(gaitFit({ bones: BONES, clips: { forward: F.clips.forward, walk: F.clips.forward } })).not.toHaveProperty('walkStride');
  });

  it('on the runtime: under its walk\'s pace it walks, at its walk\'s stride; over it, it runs; without the words, the one gait', () => {
    const E = composeLive(), DT = 1 / 30;
    const pacer = Object.values(FOE_CLASSES).find((c) => c.move === 'pace'), f = resolveFoe({ class: pacer.id });
    const body = (id, rule) => ({ id, team: 'foes', rule: { ...f.entity.rule, eye: 0, collideRadius: 0.4, collideHeight: 1, foe: { ...f.entity.rule.foe, stretch: 40 }, ...rule }, body: { type: 'none', hp: 3 }, transform: { pos: [0, 0, 0], heading: 0 } });
    const far = { id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'none' }, transform: { pos: [0, -200, 0], heading: 0 } };
    const run = (rule) => { const st = E.createWorld({ entities: [far, body('w', rule)] }); for (let i = 0; i < 30; i++) E.stepWorld(st, {}, DT, { ground: () => 0 }); return st.byId.w; };
    const slow = run({ speed: 1, walkStride: 0.8, walkPace: 1.5, stride: 1.6 });
    expect(slow.locomotion).toBe('walk');
    expect(slow.gaitPhase).toBeCloseTo(Math.abs(slow.transform.pos[0]) / 0.8, 1);
    expect(run({ speed: 3, walkStride: 0.8, walkPace: 1.5, stride: 1.6 }).locomotion).toBe('forward');
    expect(run({ speed: 1, stride: 1.6 }).locomotion).toBe('forward');
  });

  it('a beast\'s figure: its walk a walk, its relax its idle, a flier\'s flight its way across; absent, as it was', () => {
    const ground = Object.values(FOE_CLASSES).map((c) => c.standIn).find((s) => motionBehaviors(s).includes('relax') && !motionGaits(s).includes('fly'));
    const F = beastFieldOf(ground, { gait: { fly: false } }), g = beastGaitsOf(ground);
    expect(F.own).toMatchObject({ walk: g[0], forward: g.at(-1), idle: 'relax' });
    expect(beastMovesOf(ground, { gait: { fly: false } }).motion).toContain('relax');
    expect(beastFieldOf(ground).own).not.toHaveProperty('walk');
    const flier = Object.values(FOE_CLASSES).map((c) => c.standIn).find((s) => motionGaits(s).includes('fly'));
    expect(beastFieldOf(flier, { gait: { fly: true } }).own.forward).toBe('fly');
  });
});
