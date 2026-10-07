/**
 * The player: the heroine (the cast's anime lead, docs/examples/humanoid/cast/heroine.json) as the pilot of a
 * controllable world, through the World page's own path: the figures map resolves her rig, the runtime picks her clip
 * by its state, the page is emitted with her as a figure-rig body.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { playerHero, playerStates, playerWorld, testCourse, PLAYER_CLIPS, LIBRARY_STATES } from './player.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { groundOf } from './terrain.js';

const cast = JSON.parse(readFileSync(new URL('../../../../docs/examples/humanoid/cast/heroine.json', import.meta.url), 'utf8'));
const HEROINE = { ...cast.hero, palette: { ...cast.hero.palette, ...cast.palette } };

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

  it('W runs her forward in the run state; still, she idles', () => {
    const { w } = world();
    for (let i = 0; i < 60; i++) stepWorld(w, { forward: 1 }, 1 / 60, { ground: ground(w) });
    expect(w.byId.p.locomotion).toBe('forward');
    expect(w.byId.p.transform.pos[1]).toBeGreaterThan(-1.5);
    for (let i = 0; i < 30; i++) stepWorld(w, {}, 1 / 60, { ground: ground(w) });
    expect(w.byId.p.moving).toBe(false);
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
    // walk into it: stopped at its face
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
