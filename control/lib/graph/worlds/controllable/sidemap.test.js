// The side map's runtime (sidemap.js), on a laid map (gameworld/side-map/play.js) played by Galaxy Boy's own rule. The
// concepts: the frame holds a run's height as the hero runs it, and turns the corner into a shaft eased, never snapped;
// a rising frame the hero does not climb leaves it under the frame's bottom, and that is a fall: to limbo (where the
// catch zone counts it), then back at its zone's checkpoint; up at a ladder takes it, its back to the camera, and the top
// steps it off onto the floor; a held room is never left backward, and a boss's room shuts behind the hero, its door a wall while it is shut, a fall in
// it putting the hero back before its door and the room as it was; a page without the camera keeps every byte.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { deriveZoneEvents } from '../event-bus.js';
import { feelRule } from '../../gameworld/feel/lower.js';
import { reachOf } from '../../gameworld/feel/reach.js';
import { readFeel } from '../../gameworld/feel/lower.js';
import { layoutSideMap } from '../../gameworld/side-map/layout.js';
import { sideMapPlay, SIDE_FALL } from '../../gameworld/side-map/play.js';
import { groundOf } from '../../playscape/terrain.js';

const E = composeLive(), DT = 1 / 60, STATURE = 1.67;
const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const RULE = feelRule({ pole: 'galaxy-boy', takes: true });
const play = (zones) => { const L = layoutSideMap({ zones }, { reach, stature: STATURE }), P = sideMapPlay(L, { stature: STATURE }); return { L, P, hooks: { ground: groundOf(P.colliders, -1e4) } }; };
const world = ({ P, hooks }, at) => { const st = E.createWorld({
  entities: [{ id: 'hero', pilotable: true, rule: { ...RULE, type: 'platform', eye: 0, collideRadius: 0.3, collideHeight: STATURE, move: 'lane', lane: [[0, -50], [0, 2000]] }, transform: { pos: at ?? P.spawn, heading: Math.PI / 2 } }, ...P.ladders],
  camera: P.camera, pilot: 'hero', colliders: P.colliders,
}); st.hooks = hooks; return st; };
const step = (st, input = {}, n = 1, each) => { for (let i = 0; i < n; i++) { E.stepWorld(st, input, DT, st.hooks); if (each) each(st); } return st; };
const cam = (st) => st.camera;

describe('the side map\'s camera', () => {
  it('holds a run\'s height as the hero runs it, and turns into a shaft eased', () => {
    const G = play([{ run: 'across', screens: 3, beat: 'rest' }, { run: 'up', screens: 2, climb: 'ladder' }]), st = world(G);
    const z0 = G.L.zones[0].rect[2], seen = [];
    step(st, { strafe: 1 }, 60 * 15, (s) => seen.push({ ...cam(s).frame }));
    const inRun = seen.filter((f) => f.zone === 0);
    expect(inRun.length).toBeGreaterThan(60);
    for (const f of inRun.slice(30)) expect(f.z0).toBeCloseTo(z0, 1);
    expect(seen.at(-1).zone).toBe(1);
    const centre = (G.L.zones[1].rect[0] + G.L.zones[1].rect[1]) / 2;
    expect((seen.at(-1).s0 + seen.at(-1).s1) / 2).toBeCloseTo(centre, 0);
    for (let k = 1; k < seen.length; k++) expect(Math.abs(seen[k].s0 - seen[k - 1].s0)).toBeLessThan(1);
  });
  it('a rising frame the hero does not climb is a fall: to limbo, counted there, then back at the checkpoint', () => {
    const G = play([{ run: 'across', screens: 1 }, { run: 'up', screens: 3, climb: 'chimney', rises: true }]);
    const cp = G.P.camera.zones[1].checkpoint, st = world(G, [0, cp[0], cp[1] + 0.05]);
    let prev, entered = false;
    for (let i = 0; i < 60 * 40 && !st.sideFalls; i++) {
      step(st);
      const z = deriveZoneEvents(st.entities, prev, [G.P.catch]); prev = z.prev;
      entered = entered || z.events.some((e) => e.type === 'enter' && e.zone === SIDE_FALL);
    }
    expect(st.byId.hero.fellOut).toBe(1);
    step(st);
    expect(st.sideFalls).toBe(1);
    const z = deriveZoneEvents(st.entities, prev, [G.P.catch]);
    expect(entered || z.events.some((e) => e.type === 'enter' && e.zone === SIDE_FALL)).toBe(true);
    step(st, {}, 60);
    const p = st.byId.hero.transform.pos;
    expect(p[1]).toBeCloseTo(cp[0], 1);
    expect(p[2]).toBeGreaterThan(cp[1] - 1);
    expect(cam(st).frame.zone).toBe(1);
  });
  it('up at a ladder takes it, the hero\'s back to the camera, and its top steps it off onto the floor', () => {
    const G = play([{ run: 'up', screens: 1, climb: 'ladder' }]), [lad] = G.P.ladders, st = world(G, [0, lad.rule.base[1], lad.rule.base[2] + 0.05]);
    step(st, {}, 20);
    step(st, { forward: 1 });
    const h = st.byId.hero;
    expect(h.climbing).toBeTruthy();
    expect(Math.cos(h.transform.heading)).toBeCloseTo(-1, 3);
    step(st, { forward: 1 }, Math.ceil((lad.rule.length / lad.rule.speed + 1) / DT));
    expect(h.climbing).toBeFalsy();
    expect(h.transform.pos[2]).toBeCloseTo(lad.rule.top[2], 0);
  });
  it('a held room is never left backward', () => {
    const G = play([{ run: 'across', screens: 1 }, { room: [1, 1], teach: 'boss' }]), R = G.L.zones[1];
    const st = world(G, [0, R.rect[0] + 3, R.exit[1] + 0.05]);
    step(st, {}, 30);
    expect(cam(st).frame.zone).toBe(1);
    st.byId.hero.transform.pos = [0, R.rect[0] - 4, R.exit[1] + 0.05];
    step(st, {}, 30);
    expect(cam(st).frame.zone).toBe(1);
  });
  it('a boss\'s room SHUTS behind the hero: open as it comes in, walled up once it is past its doorway', () => {
    const G = play([{ run: 'across', screens: 1 }, { room: [1, 1], teach: 'boss' }]), S = G.P.camera.zones[1].shut;
    expect(S).toBeDefined();
    expect(S.at).toBeGreaterThan(S.s);
    // (at the doorway, not yet past it: open, and back out it can go)
    const st = world(G, [0, S.s - 1, S.z0 + 0.05]);
    step(st, { strafe: 1 }, 6);
    expect(cam(st)._shut?.[1]).toBeUndefined();
    // (in past it: shut, the time it closed; and walking back stops at the shutter)
    step(st, { strafe: 1 }, 90);
    expect(cam(st)._shut[1]).toBeGreaterThan(0);
    step(st, { strafe: -1 }, 120);
    expect(st.byId.hero.transform.pos[1]).toBeGreaterThanOrEqual(S.s);
    // (a room that holds no boss has no shutter)
    expect(play([{ run: 'across', screens: 1 }, { room: [1, 1] }]).P.camera.zones[1].shut).toBeUndefined();
  });
  it('shut, the door is a wall (slid down like the far one); a fall in the room comes back before its door, the room as it was', () => {
    const G = play([{ run: 'across', screens: 1 }, { room: [1, 1], teach: 'boss' }]), Z = G.P.camera.zones[1], S = Z.shut;
    const st = world(G, [0, S.s - 1, S.z0 + 0.05]);
    const foe = { id: 'boss-x', team: 'foes', rule: { type: 'static' }, body: { type: 'none', hp: 200 }, transform: { pos: [0, Z.rect[1] - 3, S.z0], heading: -Math.PI / 2 } };
    st.entities.push(foe); st.byId[foe.id] = foe;
    step(st, { strafe: 1 }, 90);
    expect(cam(st)._shut[1]).toBeGreaterThan(0);
    expect(st.colliders.filter((c) => c.of === 'shutter:1')).toHaveLength(1);
    // (falling against the shut door with the stick into it, the hero is held to it: a wall)
    const h = st.byId.hero; h.transform.pos = [0, S.s + 1, S.z0 + 2.5]; h.vel = [0, 0, 0]; h.grounded = false;
    let clung = 0;
    step(st, { strafe: -1, jumpHeld: true }, 30, () => { if (h.cling) clung++; });
    expect(clung).toBeGreaterThan(0);
    // (hurt, then out of the frame's bottom: back before the door, the door open, the boss whole where it stood)
    foe.body.hp = 40; foe.transform.pos[1] -= 4;
    h.transform.pos = [0, S.s + 3, -9000];
    step(st, {}, 70);
    expect(h.transform.pos[1]).toBeLessThan(S.s);
    expect(cam(st)._shut[1]).toBeUndefined();
    expect(st.colliders.filter((c) => c.of === 'shutter:1')).toHaveLength(0);
    expect(foe.body.hp).toBe(200);
    expect(foe.transform.pos[1]).toBeCloseTo(Z.rect[1] - 3, 3);
  });
  it('a page without the side map\'s camera keeps every byte', () => {
    expect(emissionSource({})).not.toContain("'side-map'");
    expect(emissionSource({ sidemap: true })).toContain("'side-map'");
  });
});
