process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createShootPlanHandler, updateShootPlanHandler } from './shoot-plan.js';
import { forgeMotionHandler } from './motion.js';

// the plan is written through forge_motion's `shoot` (the door users ask by); the folded names still answer
const shoot = (ref, s) => forgeMotionHandler({ subject: { world_ref: ref }, shoot: s });

// the smallest world that resolves; the plan, not the world, is under test
const WORLD = { kind: 'css3d-turntable', shape: 'dodecahedron', color: '#7a5fad', surface: 'vexar' };
const PLAN = {
  cameras: [{ id: 'orbit', type: 'two-node', lens: '35mm', keys: [
    { t: 0, pos: [6, -6, 3], look_at: [0, 0, 0.5], ease: 'easy ease' },
    { t: 2, pos: [-6, -6, 4], poi: [0, 0, 0.5], ease: 'easy ease' },
  ] }],
};

beforeEach(() => {
  closeDb();
  SketchRepository.create({ ref: 'stage', title: 'stage', manifest: WORLD });
});

describe("forge_motion's shoot plan", () => {
  it('writes the plan onto the world and answers with the readout', async () => {
    const res = await shoot('stage', { plan: PLAN });
    expect(res.ok).toBe(true);
    expect(res.render).toMatch(/motion: 'plan'/);   // written, not rendered: the same call renders it with shot.motion 'plan'
    expect(res.world_url).toBe('/api/sketches/stage/world');
    expect(res.readout.duration_s).toBe(2);
    expect(res.readout.cameras[0]).toMatchObject({ id: 'orbit', type: 'two_node', lens_mm: [35, 35] });
    expect(res.readout.cameras[0].path_m).toBeGreaterThan(10);   // metres: this world is 1 m a unit
    const stored = SketchRepository.getByRef('stage').manifest;
    expect(stored.kind).toBe(WORLD.kind);
    expect(stored.shoot.cameras[0].keys[0].poi).toEqual([0, 0, 0.5]);   // stored canonical: look_at read as poi
  });

  it('edits op by op and says what each op did', async () => {
    await shoot('stage', { plan: PLAN });
    const res = await shoot('stage', { ops: [
      { op: 'set_key', camera: 'orbit', t: 2, lens: '85mm', ease: 'hold' },
      { op: 'add_shot', shot: { name: 'tight', camera: 'orbit', span: [1, 2] } },
    ] });
    expect(res.did).toHaveLength(2);
    expect(res.readout.cameras[0].lens_mm).toEqual([35, 85]);
    expect(res.readout.shots.map((s) => s.name)).toEqual(['orbit', 'tight']);
    const keys = SketchRepository.getByRef('stage').manifest.shoot.cameras[0].keys;
    expect(keys[1]).toMatchObject({ focal_mm: 85, ease: 'hold' });
  });

  it('a bad op names itself and leaves the stored plan alone', async () => {
    await shoot('stage', { plan: PLAN });
    const before = JSON.stringify(SketchRepository.getByRef('stage').manifest.shoot);
    await expect(shoot('stage', { ops: [{ op: 'ease', camera: 'orbit', ease: 'easy ease' }, { op: 'remove_key', camera: 'orbit', t: 9 }] }))
      .rejects.toThrow(/op 1 \(remove_key\): orbit: no key at 9s/);
    expect(JSON.stringify(SketchRepository.getByRef('stage').manifest.shoot)).toBe(before);
  });

  it('points the way when there is no plan or no world', async () => {
    await expect(shoot('stage', { ops: [{ op: 'set', fps: 30 }] })).rejects.toThrow(/shoot: \{ plan \}/);
    await expect(shoot('stage', { plan: PLAN, ops: [] })).rejects.toThrow(/pass one/);
    await expect(shoot('stage', 'a plan')).rejects.toThrow(/`shoot` is \{ plan \}/);
    SketchRepository.create({ ref: 'chart', title: 'chart', manifest: { title: 'c', viewBox: { width: 100, height: 100 }, stations: [] } });
    await expect(shoot('chart', { plan: PLAN })).rejects.toThrow(/not a 3D world/);
    const listing = await shoot('stage', {});   // no plan: what can be followed (nothing moves here)
    expect(listing.subjects.counts).toEqual({});
  });

  it('the folded names still answer by name, writing the same plan', async () => {
    await createShootPlanHandler({ ref: 'stage', plan: PLAN });
    const res = await updateShootPlanHandler({ ref: 'stage', ops: [{ op: 'set', fps: 30 }] });
    expect(res.ok).toBe(true);
    expect(SketchRepository.getByRef('stage').manifest.shoot.fps).toBe(30);
  });
});
