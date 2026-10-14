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
