import { describe, it, expect } from 'vitest';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// the smallest world that resolves: a turntable solid. The plan is the concept, not the world.
const WORLD = { kind: 'css3d-turntable', shape: 'dodecahedron', color: '#7a5fad', surface: 'vexar' };
const SHOOT = {
  cameras: [
    { id: 'orbit', type: 'two-node', lens: '35mm', keys: [{ t: 0, pos: [6, -6, 3], poi: [0, 0, 0.5], ease: 'easy ease' }, { t: 2, pos: [-6, -6, 4], poi: [0, 0, 0.5], ease: 'easy ease' }] },
  ],
};
const sketch = (extra = {}) => ({ manifest: { ...WORLD, ...extra }, title: null });

describe('a shoot plan on a world', () => {
  it('lowers onto the payload; a world without one is untouched', async () => {
    const { payload } = await resolveWorldScene(sketch({ shoot: SHOOT }));
    expect(payload.shoot.cameras).toHaveLength(1);
    expect(payload.shoot.shots).toEqual([{ name: 'orbit', camera: 'orbit', start: 0, length: 2, span: [0, 2] }]);
    const { payload: bare } = await resolveWorldScene(sketch());
    expect('shoot' in bare).toBe(false);
    // the same faces either way: the plan adds no geometry
    expect(payload.faces.length).toBe(bare.faces.length);
  });

  it('an unreadable plan is dropped, not thrown', async () => {
    const { payload } = await resolveWorldScene(sketch({ shoot: { cameras: [{ keys: [{ t: 0 }] }] } }));
    expect('shoot' in payload).toBe(false);
  });

  it('the World page draws it, but never on a capture run, and a plan-less page carries none of it', async () => {
    const { payload } = await resolveWorldScene(sketch({ shoot: SHOOT }));
    const page = emitThreeWorld(payload);
    expect(page).toContain('// --- shoot channel');
    expect(page).toContain('stepShoot(t);');
    expect(page).toContain('Look through');
    expect(emitThreeWorld({ ...payload, capture: true })).not.toContain('shoot channel');
    expect(emitThreeWorld({ ...payload, hud: false })).not.toContain('Look through');   // a game-shell iframe: no panel
    const { shoot, ...bare } = payload;
    expect(emitThreeWorld(bare)).not.toMatch(/shoot|__sh/i);
  });

  it('is deterministic', async () => {
    const a = emitThreeWorld((await resolveWorldScene(sketch({ shoot: SHOOT }))).payload);
    const b = emitThreeWorld((await resolveWorldScene(sketch({ shoot: SHOOT }))).payload);
    expect(a).toBe(b);
  });
});

describe('forge_motion plan: what it refuses before it renders', async () => {
  const { renderWorldPlan } = await import('../../motion/world-motion.js');
  it('names the tool that makes a plan, and the shots a missing one could have been', async () => {
    await expect(renderWorldPlan({ sketch: { ref: 'w', manifest: WORLD } })).rejects.toThrow(/create_shoot_plan/);
    await expect(renderWorldPlan({ sketch: { ref: 'w', manifest: { ...WORLD, shoot: SHOOT } }, params: { shot: 'nope' } })).rejects.toThrow(/shots: orbit/);
  });
});

describe('a plan in a world that plays live', async () => {
  const { shootSubjects } = await import('./subjects.js');
  const { liveNotes, normalizeShoot: norm } = await import('./plan.js');
  const LIVE = { kind: 'controllable', entities: [{ id: 'hero', transform: { pos: [2, 0, 0], heading: 0 }, rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } }],
    faces: [{ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#556655' }] };
  const PLAN = { cameras: [
    { id: 'chase', keys: [{ t: 0, pos: { follow: 'entity:hero', offset: [-3, 0, 1.5], frame: 'subject' }, poi: { follow: 'entity:hero' } }] },
    { id: 'wide', keys: [{ t: 0, pos: [8, 8, 5], poi: [0, 0, 0] }] },
  ], shots: [{ name: 'wide', camera: 'wide', span: [0, 2] }, { name: 'chase', camera: 'chase', span: [1, 4] }] };

  it('marks the world and the camera that follows a live entity, and the page runs on the world clock', async () => {
    const { payload } = await resolveWorldScene({ manifest: { ...LIVE, shoot: PLAN }, title: null });
    expect(payload.shoot.live).toBe(true);
    expect(payload.shoot.cameras.map((c) => !!c.live)).toEqual([true, false]);
    expect(payload.shoot.cameras[0].live[0].pos).toEqual({ follow: 'entity:hero', offset: [-3, 0, 1.5], frame: 'subject' });
    const page = emitThreeWorld(payload);
    expect(page).toContain("' s (live)'");
    expect(page).toContain('window.__mojCtrl && window.__mojCtrl.world');
  });

  it('notes what a live world cannot do: rewind into an overlapping shot, draw a live camera ahead', () => {
    const subjects = shootSubjects(LIVE);
    const notes = liveNotes(norm(PLAN, { subjects }).plan, subjects);
    expect(notes.some((n) => /'chase' starts at 1s, before 'wide' ends at 2s/.test(n))).toBe(true);
    expect(notes.some((n) => /camera 'chase' follows a live entity/.test(n))).toBe(true);
  });
});
