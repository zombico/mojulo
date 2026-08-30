// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createFigureHandler } from './figure.js';
import { createEdificeHandler } from './edifice.js';
import { updateSketchHandler } from './sketches.js';

// edit-3d-recipes.plan.md Phase 2: solids and edifices were always editable in
// place through update_sketch's world branch (their kinds live in WORLD_KINDS),
// but nothing documented or tested it — create_figure even taught "re-mint".
// These tests pin the path so the starter thesis holds for 3D objects.

beforeEach(() => { closeDb(); });

const CAMPUS = {
  masses: [
    { id: 'commons', at: [0, 0], footprint: { w: 60, d: 44 }, floors: 2, facade: { material: 'glass', rhythm: 'curtain', glass: '#8fb6c8', frame: '#34383c' }, roof: 'flat' },
    { id: 'wing', on: { anchor: 'commons', side: 'E', align: 'start', gap: 14 }, footprint: { w: 34, d: 74 }, floors: 3, facade: { material: 'brick', rhythm: 'punched', glass: '#9a6650', frame: '#6f4636' }, roof: 'mission' },
  ],
  concourses: [{ from: 'commons', to: 'wing', width: 12 }],
  entrance: 'commons',
};

describe('update_sketch on solid recipes (figure)', () => {
  it('a pose-dial edit updates IN PLACE (no new ref, no diagram validator)', async () => {
    const fig = await createFigureHandler({ title: 'Subject', ref: 'fig-iterate', animate: false });
    const stored = SketchRepository.getByRef(fig.ref);
    const edited = { ...stored.manifest, pose: { ...(stored.manifest.pose || {}), elbowL: 90, head: { yaw: 15, pitch: 0 } } };
    const r = await updateSketchHandler({ ref: fig.ref, manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.ref).toBe('fig-iterate');
    const after = SketchRepository.getByRef('fig-iterate');
    expect(after.manifest.kind).toBe('figure');
    expect(after.manifest.pose.elbowL).toBe(90);
    expect(after.manifest.pose.head.yaw).toBe(15);
  });

  it('an out-of-range dial is accepted, not refused — joint LIMITS clamp at render, so an edit can never break the form', async () => {
    const fig = await createFigureHandler({ title: 'Subject', ref: 'fig-clamp', animate: false });
    const stored = SketchRepository.getByRef(fig.ref);
    const edited = { ...stored.manifest, pose: { ...(stored.manifest.pose || {}), elbowL: 400 } };
    const r = await updateSketchHandler({ ref: fig.ref, manifest: edited });
    expect(r.ok).toBe(true);   // validated by RESOLVING the figure scene — the clamp holds, the render succeeds
  });
});

describe('update_sketch on edifice recipes', () => {
  it('a mass edit updates IN PLACE (add a floor to the wing)', async () => {
    await createEdificeHandler({ ...CAMPUS, title: 'Campus', ref: 'ed-iterate' });
    const stored = SketchRepository.getByRef('ed-iterate');
    const edited = {
      ...stored.manifest,
      masses: stored.manifest.masses.map((m) => (m.id === 'wing' ? { ...m, floors: 4 } : m)),
    };
    const r = await updateSketchHandler({ ref: 'ed-iterate', manifest: edited });
    expect(r.ok).toBe(true);
    expect(r.ref).toBe('ed-iterate');
    const after = SketchRepository.getByRef('ed-iterate');
    expect(after.manifest.kind).toBe('edifice');
    expect(after.manifest.masses.find((m) => m.id === 'wing').floors).toBe(4);
  });

  it('a broken edit is refused with a WORLD error, and the stored recipe never moves', async () => {
    await createEdificeHandler({ ...CAMPUS, title: 'Campus', ref: 'ed-broken' });
    const stored = SketchRepository.getByRef('ed-broken');
    // collapse both masses onto the same spot — the building resolver refuses
    const broken = {
      ...stored.manifest,
      masses: stored.manifest.masses.map((m) => ({ ...m, at: [0, 0], on: undefined })),
    };
    await expect(updateSketchHandler({ ref: 'ed-broken', manifest: broken }))
      .rejects.toThrow(/Invalid world manifest \(kind 'edifice'\)/);
    await expect(updateSketchHandler({ ref: 'ed-broken', manifest: broken }))
      .rejects.not.toThrow(/viewBox is required/);
    const after = SketchRepository.getByRef('ed-broken');
    expect(after.manifest.masses.find((m) => m.id === 'wing').on).toBeTruthy();
  });
});
