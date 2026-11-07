/**
 * The player: the heroine (the cast's anime lead, docs/examples/humanoid/cast/heroine.json) as the pilot of a
 * controllable world, through the World page's own path: the figures map resolves her rig, the runtime picks her clip
 * by its state, the page is emitted with her as a figure-rig body.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { playerHero, playerStates, playerWorld, testCourse, PLAYER_CLIPS, LIBRARY_STATES, HERO_GAIT_STRIDE, HERO_WALK_RUN, LIBRARY_BOB, RUN_BOB } from './player.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { groundOf } from './terrain.js';

const cast = JSON.parse(readFileSync(new URL('../../../../docs/examples/humanoid/cast/heroine.json', import.meta.url), 'utf8'));
const HEROINE = { ...cast.hero, palette: { ...cast.hero.palette, ...cast.palette } };

describe('a run is smooth', () => {
  it('each library run\'s hips bob as LIBRARY_BOB holds it, measured off its hub; a run past RUN_BOB gives way to the hero\'s own jog', async () => {
    const L = (await import('../figures/library/quaternius-ual.js')).default;
    for (const [clip, bob] of Object.entries(LIBRARY_BOB['quaternius-ual'])) {
      const zs = L.clips[clip].hips.filter((_, i) => i % 3 === 2);
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(bob, 3);
    }
    expect(LIBRARY_BOB['quaternius-ual'][LIBRARY_STATES['quaternius-ual'].forward]).toBeGreaterThan(RUN_BOB);
    expect(LIBRARY_BOB['quaternius-ual'][LIBRARY_STATES['quaternius-ual'].walk]).toBeLessThan(RUN_BOB);
  });
});

describe('the move set', () => {
  it('adds the jump to a hero, never over a clip of its own', () => {
    const s = playerHero(HEROINE);
    expect(Object.keys(s.clips)).toEqual(expect.arrayContaining(['run', 'idleRelaxed', 'greet', 'squat', 'leap']));
    expect(playerHero({ cast: 'female', clips: { leap: { seconds: 1, keys: [{ crouch: 0.1 }] } } }).clips.leap.seconds).toBe(1);
    expect(Object.keys(PLAYER_CLIPS)).toEqual(['squat', 'leap']);
  });

  it('names a hero clip for each runtime state: she runs, idles relaxed, and holds the flight in the air', () => {
    expect(playerStates(['idle', 'walk', 'wave', 'run', 'idleRelaxed', 'squat', 'leap'])).toEqual({ forward: 'run', idle: 'idleRelaxed', leap: 'leap', boost: 'leap', squat: 'squat', turn: 'walk', strafe: 'run' });
    expect(playerStates(['idle', 'walk'])).toEqual({ forward: 'walk', idle: 'idle', turn: 'walk', strafe: 'walk' });
  });

  it('a library names the clip for every state it has; the hero\'s own fill the rest', () => {
    const s = playerStates(['idle', 'walk', 'run', 'idleRelaxed', 'squat', 'leap', 'climb'], 'quaternius-ual');
    expect(s).toMatchObject({ forward: 'Jog_Fwd_Loop', idle: 'Idle_Loop', leap: 'Jump_Loop', squat: 'Jump_Start', turn: 'Walk_Loop' });
    expect(Object.keys(LIBRARY_STATES['quaternius-ual'])).not.toContain('climb');   // a gap the library leaves
    expect(() => playerStates(['idle'], 'mixamo')).toThrow(/no states for the library/);
  });

  it('on a library she walks its walk and runs her own jog (the library\'s crouches too far to be smooth); her own gaits play without one', () => {
    const s = playerStates(['idle', 'walk', 'jog'], 'quaternius-ual', ['walk', 'jog']);
    expect(s).toMatchObject({ walk: 'Walk_Loop', forward: 'jog', strafe: 'jog', turn: 'Walk_Loop', idle: 'Idle_Loop', leap: 'Jump_Loop' });
    // (a hero with no jog of her own runs the library's)
    expect(playerStates(['idle'], 'quaternius-ual', [])).toMatchObject({ forward: 'Jog_Fwd_Loop', strafe: 'Jog_Fwd_Loop' });
    // the pilot walks at the library walk's pace and runs at the game's speed, each over its own cycle's length
    const W = playerWorld({ heroRef: 'sk_x', gaits: ['walk', 'jog'] });
    expect(W.figures.hero.clips).toMatchObject({ walk: 'Walk_Loop', forward: 'jog' });
    expect(W.entities[0].rule).toMatchObject({ speed: 3.6, stride: HERO_GAIT_STRIDE.jog, walkSpeed: 1.6, walkStride: 2 });
    expect(JSON.stringify(W.events)).toContain(HERO_WALK_RUN);
    // a lane or a runner keeps the run (no walk); without a library her own calibrated jog runs, and nothing walks
    expect(playerWorld({ heroRef: 'sk_x', walk: false }).entities[0].rule.walkSpeed).toBeUndefined();
    const own = playerWorld({ heroRef: 'sk_x', gaits: ['walk', 'jog'], library: false });
    expect(own.figures.hero.clips.forward).toBe('jog');
    expect(own.entities[0].rule).toMatchObject({ stride: HERO_GAIT_STRIDE.jog });
    expect(own.entities[0].rule.walkSpeed).toBeUndefined();
  });
});

describe('the heroine in a world', () => {
  const manifest = playerWorld({ hero: HEROINE, id: 'heroine' });
  let resolved;
  const scene = async () => resolved || (resolved = await resolveWorldScene({ ref: 'sk_player_test', title: 'player test', manifest }));

  it('resolves her rig as a figure-rig body, every state a clip she plays, the library\'s retargeted onto her', async () => {
    const { payload } = await scene();
    const fig = payload.figures.heroine;
    expect(manifest.figures.heroine.library).toBe('quaternius-ual');
    expect(fig.clips.forward).toBe(fig.clips.Jog_Fwd_Loop);
    expect(fig.clips.squat.once).toBe(true);   // the jump's start plays once and holds
    expect(fig.clips.idle.once).toBeUndefined();
    expect(fig.rig).toBe(true);
    expect(fig.preview).toBeUndefined();
    for (const [state, clip] of Object.entries(manifest.figures.heroine.clips)) expect(fig.clips[state]).toBe(fig.clips[clip]);
    expect(payload.entities[0]).toMatchObject({ id: 'heroine', pilotable: true, body: { type: 'figure-rig', figure: 'heroine' } });
    expect(payload.colliders.length).toBeGreaterThan(5);
  }, 60000);

  it('a clip name the hero and the library lack is refused by name', async () => {
    const bad = playerWorld({ hero: HEROINE, id: 'h', clips: { forward: 'moonwalk' } });
    await expect(resolveWorldScene({ ref: 'sk_bad', manifest: bad })).rejects.toThrow(/clips.forward names 'moonwalk'.*the quaternius-ual library has/);
  }, 60000);

  it('without a library she plays her own run and the move set\'s jump', async () => {
    const own = playerWorld({ hero: HEROINE, id: 'h', library: false });
    expect(own.figures.h.library).toBeUndefined();
    expect(own.figures.h.clips).toMatchObject({ forward: 'run', idle: 'idleRelaxed', leap: 'leap' });
  });

  it('emits a World page that drives her', async () => {
    const { payload } = await scene();
    const html = emitThreeWorld(payload);
    expect(html).toContain('"figure":"heroine"');
    expect(html).toContain('Space  jump');
  }, 60000);
});

describe('the course, driven', () => {
  const world = () => {
    const m = playerWorld({ hero: { cast: 'female' }, id: 'p' });
    return { w: createWorld({ entities: m.entities, colliders: m.colliders, camera: m.camera }), m };
  };
  const ground = (w) => (pos) => groundOf(w.colliders)(pos);

  it('W runs her in the run state; Z held walks her; a pad\'s stick walks tilted and runs pushed; F is no boost', () => {
    // (each pace on a fresh course, a second from its start: the first block stands 8 m on)
    let w;
    const { m } = world(), R = m.entities[0].rule, y = () => w.byId.p.transform.pos[1];
    const go = (input, n = 60) => { ({ w } = world()); const y0 = y(); for (let i = 0; i < n; i++) stepWorld(w, input, 1 / 60, { ground: ground(w) }); return y() - y0; };
    // a key is the stick's full travel: the run, at the game's speed
    expect(go({ forward: 1 })).toBeCloseTo(R.speed, 1);
    expect(w.byId.p.locomotion).toBe('forward');
    // the walk key held: the walk, at its own pace
    expect(go({ forward: 1, walk: 1 })).toBeCloseTo(R.walkSpeed, 1);
    expect(w.byId.p.locomotion).toBe('walk');
    // a pad's stick: tilted half way to the run's threshold, half the walk; past it, a run that meets the walk there
    expect(go({ forward: 0.3 })).toBeCloseTo(R.walkSpeed * 0.5, 1);
    expect(w.byId.p.locomotion).toBe('walk');
    expect(go({ forward: 0.8 })).toBeCloseTo(R.walkSpeed + (R.speed - R.walkSpeed) * 0.5, 1);
    expect(w.byId.p.locomotion).toBe('forward');
    // F is nothing of a person's: the run as it was, never the boost's flight pose, its thrust or its three and a half times
    expect(go({ forward: 1, boost: 1 })).toBeCloseTo(R.speed, 1);
    expect(w.byId.p.locomotion).toBe('forward');
    expect(w.byId.p.boosting).toBe(false);
    expect(w.byId.p.thrust).toBe(0);
    for (let i = 0; i < 30; i++) stepWorld(w, {}, 1 / 60, { ground: ground(w) });
    expect(w.byId.p.moving).toBe(false);
  });

  it('a hero that SPRINTS (rule.sprint): F held runs her at the sprint on her run\'s legs, on a stamina gauge that winds her empty', () => {
    // (the boost gauge as stamina: 2 s of sprint, back in 2 s, winded until full again; on a long flat floor)
    const mk = () => { const m = playerWorld({ hero: { cast: 'female' }, id: 'p', rule: { sprint: true, boostSpeed: 9, boostMax: 2, boostRegen: 1, overheatRegen: 0.5 } }); return createWorld({ entities: m.entities, colliders: [], camera: m.camera }); };
    const flat = () => 0;
    let w = mk();
    const p = () => w.byId.p, y = () => p().transform.pos[1];
    // (the stick at rest: F alone is nothing, no sprint, no stamina spent)
    for (let i = 0; i < 30; i++) stepWorld(w, { boost: 1 }, 1 / 60, { ground: flat });
    expect(p().boosting).toBe(false); expect(p().boost).toBe(2);
    // sprinting: the sprint's speed, the run's clip, a second of stamina spent a second
    let y0 = y();
    for (let i = 0; i < 60; i++) stepWorld(w, { forward: 1, boost: 1 }, 1 / 60, { ground: flat });
    expect(y() - y0).toBeGreaterThan(8);
    expect(p().locomotion).toBe('sprint');
    expect(p().boost).toBeCloseTo(1, 1);
    // run dry: WINDED, back to the run's speed, and no sprint until the gauge is full again
    for (let i = 0; i < 70; i++) stepWorld(w, { forward: 1, boost: 1 }, 1 / 60, { ground: flat });
    expect(p().boostLock).toBe(true);
    y0 = y();
    for (let i = 0; i < 60; i++) stepWorld(w, { forward: 1, boost: 1 }, 1 / 60, { ground: flat });
    expect(y() - y0).toBeLessThan(p().rule.speed + 0.2);
    for (let i = 0; i < 300; i++) stepWorld(w, {}, 1 / 60, { ground: flat });
    expect(p().boostLock).toBe(false); expect(p().boost).toBe(2);
    // a jump is free of it
    w = mk();
    for (let i = 0; i < 60; i++) stepWorld(w, { jump: i === 2 ? 1 : 0, jumpHeld: i < 20 ? 1 : 0 }, 1 / 60, { ground: flat });
    expect(p().boost).toBe(2);
  });

  it('an ORBIT camera: the mouse turns the camera round her, never her; W runs her the way it looks, and she turns to face her run', () => {
    const m = playerWorld({ hero: { cast: 'female' }, id: 'p', rule: { move: 'world', moveYaw: 'camera', faceRate: 20 } });
    const w = createWorld({ entities: m.entities, colliders: [], camera: { ...m.camera, orbit: true, mouseLook: true } });
    const flat = () => 0, p = w.byId.p, h0 = p.transform.heading;
    // (the mouse alone: the camera swings a quarter turn round her; she stands as she was)
    for (let i = 0; i < 10; i++) stepWorld(w, { lookDX: (Math.PI / 2) / 0.0025 / 10 }, 1 / 60, { ground: flat });
    expect(p.transform.heading).toBeCloseTo(h0, 5);
    expect(w.camera.orbitYaw).toBeCloseTo(h0 + Math.PI / 2, 3);
    // (the camera stands behind her along its own yaw, not her heading)
    for (let i = 0; i < 120; i++) stepWorld(w, {}, 1 / 60, { ground: flat });
    const c = w.camera.transform.pos, back = [c[0] - p.transform.pos[0], c[1] - p.transform.pos[1]];
    expect(Math.atan2(-back[1], -back[0])).toBeCloseTo(w.camera.orbitYaw, 1);
    // W: she runs the way the camera looks, turned to face it
    const x0 = [...p.transform.pos];
    for (let i = 0; i < 60; i++) stepWorld(w, { forward: 1 }, 1 / 60, { ground: flat });
    const d = [p.transform.pos[0] - x0[0], p.transform.pos[1] - x0[1]];
    expect(Math.atan2(d[1], d[0])).toBeCloseTo(w.camera.orbitYaw, 1);
    expect(Math.cos(p.transform.heading - w.camera.orbitYaw)).toBeGreaterThan(0.99);
  });

  it('an ORBIT camera holding a LOCK: the camera swings round behind her to hold the foe ahead', () => {
    const m = playerWorld({ hero: { cast: 'female' }, id: 'p', rule: { move: 'world', moveYaw: 'camera' } });
    const foe = { id: 'f', team: 'foes', body: { type: 'box', size: [1, 1, 2], hittable: true }, rule: { type: 'static' }, transform: { pos: [0, 10, 0], heading: 0 } };
    const w = createWorld({ entities: [...m.entities, foe], colliders: [], camera: { ...m.camera, orbit: true, mouseLook: true, lockTrack: true }, lock: { range: 30, cone: 180 } });
    const flat = () => 0, p = w.byId.p;
    p.transform.heading = Math.PI / 2;   // (she faces the foe, due north of her)
    for (let i = 0; i < 5; i++) stepWorld(w, {}, 1 / 60, { ground: flat });
    // (the camera turned away, a quarter round)
    w.camera.orbitYaw = 0;
    stepWorld(w, { lock: 1 }, 1 / 60, { ground: flat });
    expect(w.lock && w.lock.target).toBe('f');
    for (let i = 0; i < 120; i++) stepWorld(w, {}, 1 / 60, { ground: flat });
    expect(Math.cos(w.camera.orbitYaw - Math.PI / 2)).toBeGreaterThan(0.95);
  });

  it('a sprinting hero DODGES on a double tap of the sprint\'s key: a dash, invulnerable, a second of her stamina, never all of it', () => {
    const m = playerWorld({ hero: { cast: 'female' }, id: 'p', rule: { sprint: true, boostSpeed: 9, boostMax: 6, dodge: true, dodgeDur: 0.4, dodgeSpeed: 8, dodgeBoostCost: 1, dodgeOverheat: false, dodgeCooldown: 0.2 } });
    const w = createWorld({ entities: m.entities, colliders: [], camera: m.camera }), p = w.byId.p, flat = () => 0;
    for (let i = 0; i < 10; i++) stepWorld(w, {}, 1 / 60, { ground: flat });
    // (tap, let go, tap again inside the window)
    const seq = [{ boost: 1 }, {}, { boost: 1 }];
    let sawDodge = false, sawInvincible = false;
    for (const inp of seq) { stepWorld(w, { ...inp, forward: 1 }, 1 / 60, { ground: flat }); }
    for (let i = 0; i < 30; i++) { stepWorld(w, { forward: 1 }, 1 / 60, { ground: flat }); sawDodge ||= p.dodgeT != null; sawInvincible ||= !!p.invincible; }
    expect(p.dodgeCount).toBe(1);
    expect(sawDodge || sawInvincible).toBe(true);
    expect(p.boostLock).toBeFalsy();
    expect(p.boost).toBeGreaterThan(4.5);
  });

  it('Space winds up, then she is in the air in the leap state, and lands', () => {
    const { w } = world();
    let sawSquat = false, sawLeap = false, top = 0;
    for (let i = 0; i < 90; i++) {
      stepWorld(w, { jump: i === 5 ? 1 : 0, jumpHeld: i >= 5 && i < 30 ? 1 : 0 }, 1 / 60, { ground: ground(w) });
      sawSquat ||= w.byId.p.locomotion === 'squat'; sawLeap ||= w.byId.p.locomotion === 'leap';
      top = Math.max(top, w.byId.p.transform.pos[2]);
    }
    expect(sawSquat).toBe(true);
    expect(sawLeap).toBe(true);
    expect(top).toBeGreaterThan(0.6);   // a hop of about a metre
    expect(w.byId.p.grounded).toBe(true);
  });

  it('the first hop-up block is a jump onto, not a walk onto', () => {
    const { w } = world();
    // run into it: stopped at its face
    for (let i = 0; i < 180; i++) stepWorld(w, { forward: 1 }, 1 / 60, { ground: ground(w) });
    expect(w.byId.p.transform.pos[1]).toBeLessThan(4);
    // jump while running: she lands on it
    for (let i = 0; i < 60; i++) stepWorld(w, { forward: 1, jump: i === 0 ? 1 : 0, jumpHeld: i < 20 ? 1 : 0 }, 1 / 60, { ground: ground(w) });
    expect(w.byId.p.transform.pos[2]).toBeGreaterThanOrEqual(0.44);
  });

  it('the course is the stairs, the blocks and a wall, every part solid', () => {
    const c = testCourse();
    expect(c.colliders.length).toBeGreaterThan(5);
    expect(c.faces.every((f) => f.corners.length === 4)).toBe(true);
  });
});
