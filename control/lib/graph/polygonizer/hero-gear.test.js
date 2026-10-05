// hero-gear — gear on the hero: the door stores the words (laws stamped) and refuses by name, a held item's grip sits
// in the fist and a shield on the forearm at true size, the stand carries the gear with its bone, the World page shows it
// and the rig pack carries it on its bone with weight 1, and a hero without gear is untouched.
import { describe, expect, it } from 'vitest';

import { validateGear, gearRecord, gearMounts, gearRestPoint, gearFaces, gearPackParts, gearReadout, ANIME_STYLIZE } from './hero-gear.js';
import { validateRig, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { WORLD_KINDS } from '../worlds/world-kinds.js';
import { LAWS_VERSION } from '../equipment/expand.js';
import { WORKBENCH_LIGHT } from '../worlds/workbench.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
/** distance from p to the segment a→b */
const segDist = (p, a, b) => { const ab = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])); };
const heroOf = (spec) => { const hero = heroRecord(spec); const m = expandLayeredManifest({ kind: 'layered', hero }); return { hero, m, R: validateRig(m.recipe.rig) }; };

describe('the door', () => {
  it('stores each slot\'s words with the laws stamped; absent gear is no key', () => {
    const { hero } = heroOf({ cast: 'male', gear: { right: { item: 'sword', style: 'elven' } } });
    expect(hero.gear).toEqual({ right: { item: 'sword', style: 'elven', laws: LAWS_VERSION } });
    expect('gear' in heroRecord({ cast: 'male' })).toBe(false);
    expect(gearRecord({})).toBeNull();
  });
  it('refuses by name: a slot, an item, a style', () => {
    const errs = validateGear({ belt: { item: 'sword' }, right: { item: 'swrod' }, left: { item: 'shield', style: 'elvish' } }).join('\n');
    expect(errs).toMatch(/gear\.belt: not a slot — use right, left, back, hip/);
    expect(errs).toMatch(/gear\.right: .*dagger, sword/);
    expect(errs).toMatch(/gear\.left: .*historical, elven/);
    expect(() => heroRecord({ cast: 'male', gear: { right: { item: 'axe' } } })).toThrow(/gear\.right/);
  });
});

describe('the mounts', () => {
  const { hero, R } = heroOf({ cast: 'male', gear: { right: { item: 'sword', style: 'historical' }, left: { item: 'shield', style: 'dwarven' }, back: { item: 'bow', style: 'elven' }, hip: { item: 'dagger', style: 'eastern' } } });
  const G = Object.fromEntries(gearMounts(hero, R).map((g) => [g.slot, g]));
  const J = R.joints;
  it('a sword\'s grip sits in the right fist, true size, the tip forward and down, above the floor', () => {
    const g = G.right; expect(g.bone).toBe('handR');
    // in the curled fingers (hero-gear.js gripCentre: the circle the hand's `grip` closes on), in front of the palm's line
    expect(segDist(gearRestPoint(g, g.sockets.grip.origin), J.wristR, J.knucklesR)).toBeLessThan(0.03);
    expect(g.length).toBeGreaterThan(0.9); expect(g.length).toBeLessThan(1.05);   // a 98 cm sword
    const tip = gearRestPoint(g, g.sockets.tip.origin), grip = gearRestPoint(g, g.sockets.grip.origin);
    expect(tip[1] - grip[1]).toBeGreaterThan(0.4);   // forward (+y)
    expect(tip[2]).toBeLessThan(grip[2]); expect(tip[2]).toBeGreaterThan(0.02);   // down, clear of the floor
  });
  it('a shield rides the left forearm, its face outward', () => {
    const g = G.left; expect(g.bone).toBe('foreArmL');
    const face = gearRestPoint(g, g.sockets.focal.origin), back = gearRestPoint(g, g.sockets.grip.origin);
    expect(face[0]).toBeLessThan(back[0]);            // the left side is −x: the face further out
  });
  it('a staff\'s heel and a bow\'s lower tip stay above the floor', () => {
    const { hero: h2, R: R2 } = heroOf({ cast: 'female', gear: { right: { item: 'staff', style: 'druid' }, left: { item: 'bow', style: 'elven' } } });
    const [st, bw] = gearMounts(h2, R2);
    expect(gearRestPoint(st, st.sockets.heel.origin)[2]).toBeGreaterThan(0.01); expect(gearRestPoint(st, st.sockets.heel.origin)[2]).toBeLessThan(0.1);
    expect(gearRestPoint(bw, [0, 0, -1.5])[2]).toBeGreaterThan(0.01);
    expect(gearRestPoint(bw, bw.sockets.nockTop.origin)[1]).toBeLessThan(gearRestPoint(bw, [0.44, 0, 180])[1]);   // the string behind the limb
  });
  it('back and hip gear ride the torso and the pelvis, behind and at the side', () => {
    expect(G.back.bone).toBe('torso'); expect(G.hip.bone).toBe('pelvis');
    const mid = gearRestPoint(G.back, [0, 0, G.back.trace.length / 2]); expect(mid[1]).toBeLessThan(J.navel[1] - 0.05);
    expect(gearRestPoint(G.hip, G.hip.sockets.grip.origin)[0]).toBeLessThan(0);   // the left hip
  });
  it('the stand carries the gear with its bone: the grip rides the hand frame', () => {
    const { hero: h2, m, R: R2 } = heroOf({ cast: 'male', gesture: 'guard', gear: { right: { item: 'sword' } } });
    const [g] = gearMounts(h2, R2); const pose = m.recipe.clips.gesture ? {} : null; expect(pose).not.toBeNull();
    const { nodes } = rigNodesAt(R2, (m.recipe.clips.gesture[0])); const frames = boneFrames(R2, R2.joints, nodes);
    const posed = gearFaces([g], { frames, light: WORKBENCH_LIGHT }); const rest = gearFaces([g], { light: WORKBENCH_LIGHT });
    expect(posed.length).toBe(rest.length);
    // the posed grip lies on the posed hand segment as the rest grip lies on the rest one
    const at = gearRestPoint(g, g.sockets.grip.origin); const f = frames[g.boneIndex];
    const ride = [0, 1, 2].map((r) => f.head[r] + dot(f.m[r], sub(at, f.restHead)));
    expect(Math.abs(segDist(ride, nodes.wristR, nodes.knucklesR) - segDist(at, R2.joints.wristR, R2.joints.knucklesR))).toBeLessThan(0.001);
  });
  it('an anime hero\'s gear leans stylized unless the build says', () => {
    const { hero: a, R: Ra } = heroOf({ cast: 'female', head: 'anime', gear: { right: { item: 'sword', style: 'elven' }, left: { item: 'dagger', dials: { stylize: 0.1 } } } });
    const [r, l] = gearMounts(a, Ra); expect(r.build.dials.stylize).toBe(ANIME_STYLIZE); expect(l.build.dials.stylize).toBe(0.1);
    expect(a.gear.right.dials).toBeUndefined();   // read at plan time, never stored
  });
  it('the readout names each slot', () => {
    const out = gearReadout(Object.values(G), R);
    expect(out.right).toMatchObject({ item: 'sword', hold: 'blade', bone: 'handR' });
    expect(out.left.hold).toBe('forearm'); expect(out.back.hold).toBe('back');
    expect(out.right.share).toBeGreaterThan(0.5);
  });
});

describe('the World page and the pack', () => {
  it('the gear shows on the static solid and rides its bone in the pack with weight 1', async () => {
    const plain = heroOf({ cast: 'male', gesture: 'relaxed' }), armed = heroOf({ cast: 'male', gesture: 'relaxed', gear: { right: { item: 'sword', style: 'dwarven' } } });
    const [a, b] = await Promise.all([WORLD_KINDS.layered.resolve(plain.m, { title: 't' }), WORLD_KINDS.layered.resolve(armed.m, { title: 't' })]);
    expect(b.faces.length).toBeGreaterThan(a.faces.length + 100);
    const [g] = gearMounts(armed.hero, armed.R); const extra = gearPackParts([g], { light: WORKBENCH_LIGHT })[0].tris.length;
    const hand = g.boneIndex; expect(b.figures.body.parts[hand].faces - (a.figures.body.parts[hand]?.faces || 0)).toBe(extra);
    // the clips move only where the hand closes on the grip (layered.js gripHands: the right hand's digits take `grip`
    // in every key); every other bone keeps its frames, key for key (seven numbers a bone a key: its turn and its head)
    const ids = armed.R.bones.map((x) => x.id), grips = (id) => /^(thumb|index|middle|ring|little)\dR$/.test(id);
    for (const [name, c] of Object.entries(a.figures.body.clips)) {
      const d = b.figures.body.clips[name]; expect(d.k).toBe(c.k);
      for (let i = 0; i < c.b.length; i++) if (!grips(ids[Math.floor(i / 7) % ids.length])) expect(d.b[i], `${name} ${ids[Math.floor(i / 7) % ids.length]}`).toBe(c.b[i]);
      expect(d.b.some((x, i) => x !== c.b[i])).toBe(true);
    }
  });
});
