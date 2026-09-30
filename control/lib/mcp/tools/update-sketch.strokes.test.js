// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { createLayeredHandler } from './layered.js';
import { updateSketchHandler } from './sketches.js';
import { measureSolidHandler } from './measure-solid.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// Stroke affordances S0/S1: a stroke is stored on a layered row as data, given the camera it was drawn against,
// resolved into the ledger on every edit; a `solve` op turns a silhouette into a dial solve. A row without
// strokes keeps its bytes.
beforeEach(() => { closeDb(); });

const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body',
  stations: [
    { id: 'st0', points: { top: [0, 0, 1], sideR: [1, 0, 0.5], bottom: [0, 0, 0], sideL: [-1, 0, 0.5] } },
    { id: 'st1', points: { top: [0, 1, 1], sideR: [1, 1, 0.5], bottom: [0, 1, 0], sideL: [-1, 1, 0.5] } },
  ],
  caps: { back: [0, -0.5, 0.5], tip: [0, 1.5, 0.5] },
};
const recipe = {
  frame: { up: '+z', front: '+y' },
  dials: {
    width: { min: 0.5, max: 2, rest: 1, op: 'scale', axis: 'x', pivot: 0, parts: ['body'], blend: { st0: 1, st1: 1 } },
    lift: { min: 0, max: 1, rest: 0, op: 'offset', axis: 'z', slots: ['top'], parts: ['body'], blend: { st0: 1, st1: 1 } },
  },
  parts: { body },
};
// a wide outline around the middle of the frontal view: wider than the body at rest, so the solve has somewhere to go
const OUTLINE = { id: 's1', view: 'frontal', intent: 'silhouette', points: [[0.2, 0.3, 0.6], [0.8, 0.3, 0.6], [0.8, 0.75, 0.6], [0.2, 0.75, 0.6]] };

describe('update_sketch on layered rows — strokes', () => {
  it('stores a stroke with the camera it was drawn against and resolves it into the ledger; the readout carries it', async () => {
    const m = await createLayeredHandler({ recipe, ref: 'lay-stroke' });
    expect(m.ok).toBe(true);
    const r = await updateSketchHandler({ ref: 'lay-stroke', patch: [{ op: 'set', path: '/strokes/-', value: OUTLINE }] });
    expect(r.ok).toBe(true);
    const stored = SketchRepository.getByRef('lay-stroke').manifest;
    expect(stored.strokes).toHaveLength(1); expect(stored.strokes[0].id).toBe('s1');
    expect(stored.strokes[0].camera).toMatchObject({ azimuth: 180, elevation: 10, size: 900 }); expect(stored.strokes[0].camera.target).toHaveLength(3);
    expect(stored.ledger.strokes.s1).toMatchObject({ intent: 'silhouette', points: 4 }); expect(stored.ledger.strokes.s1.hits + stored.ledger.strokes.s1.misses).toBe(4);
    expect(r.stats.strokes.s1).toEqual(stored.ledger.strokes.s1); expect(r.stats.solved).toBeUndefined();
    expect(stored.dials).toEqual({ width: 1, lift: 0 });   // storing a stroke moves nothing
  });

  it('a `solve` op on a silhouette moves the shape dials and records the solve on the stroke; a later edit keeps both', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-solve' });
    await updateSketchHandler({ ref: 'lay-solve', patch: [{ op: 'set', path: '/strokes/-', value: OUTLINE }] });
    const r = await updateSketchHandler({ ref: 'lay-solve', patch: [{ op: 'solve', from: '/strokes/s1' }] });
    expect(r.ok).toBe(true); expect(r.stats.solved).toHaveLength(1);
    const S = r.stats.solved[0]; expect(S.id).toBe('s1'); expect(S.iou).toBeGreaterThan(S.before); expect(S.residual.share).toBeGreaterThanOrEqual(0);
    const stored = SketchRepository.getByRef('lay-solve').manifest;
    expect(stored.dials).not.toEqual({ width: 1, lift: 0 }); expect(stored.dials).toEqual(expect.objectContaining(S.dials));
    expect(stored.strokes[0].solved).toMatchObject({ iou: S.iou, before: S.before }); expect(stored.ledger.strokes.s1.solved.iou).toBe(S.iou);
    // (the layered kind keeps no revision history today — REVISIONED_KINDS is a decision, not a default; the stroke record is the trail)
    // a later dial edit keeps the stroke and its solve, and re-stamps the resolve
    const r2 = await updateSketchHandler({ ref: 'lay-solve', patch: [{ op: 'set', path: '/dials/lift', value: 0.2 }] });
    expect(r2.stats.strokes.s1.solved.iou).toBe(S.iou); expect(SketchRepository.getByRef('lay-solve').manifest.strokes[0].solved.iou).toBe(S.iou);
  });

  it('a solve may name the dials it moves and a compile budget', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-named', strokes: [OUTLINE] });
    const stored0 = SketchRepository.getByRef('lay-named').manifest; expect(stored0.strokes[0].camera).toBeTruthy(); expect(stored0.ledger.strokes.s1).toBeTruthy();
    const r = await updateSketchHandler({ ref: 'lay-named', patch: [{ op: 'solve', from: '/strokes/s1', dials: ['width'], budget: 20 }] });
    const stored = SketchRepository.getByRef('lay-named').manifest;
    expect(stored.dials.lift).toBe(0); expect(r.stats.solved[0].compiles).toBeLessThanOrEqual(20);
  });

  it('measure_solid reads the strokes back: what the form reaches now, the residual box, and the bound the solve stopped on', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-measure', strokes: [OUTLINE] });
    const before = await measureSolidHandler({ ref: 'lay-measure', volume: false, exposure: false });
    expect(before.strokes.s1).toMatchObject({ intent: 'silhouette', points: 4 }); expect(before.strokes.s1.now.reached).toBeLessThan(1); expect(before.strokes.s1.now.residual.bbox).toHaveLength(4);
    await updateSketchHandler({ ref: 'lay-measure', patch: [{ op: 'solve', from: '/strokes/s1' }] });
    const after = await measureSolidHandler({ ref: 'lay-measure', volume: false, exposure: false });
    expect(after.strokes.s1.now.iou).toBeGreaterThan(before.strokes.s1.now.iou); expect(after.strokes.s1.solved.iou).toBe(after.strokes.s1.now.iou);
    if (after.strokes.s1.solved.bounds) expect(after.strokes.s1.hint).toMatch(/stopped on a bound/);
    const plain = await createLayeredHandler({ recipe, ref: 'lay-measure-plain' }); expect((await measureSolidHandler({ ref: plain.ref, volume: false, exposure: false })).strokes).toBeUndefined();
  });

  it('a `solve` on a contour grows a strip along it (a layer-2 part carrying `from`); a re-solve replaces it; mirror makes two', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-contour' });
    // a line down the right flank as seen from the side: view points over the body's middle
    const line = { id: 'c1', view: 'lateral', intent: 'contour', points: [[0.35, 0.45, 0.9], [0.45, 0.46, 0.9], [0.55, 0.47, 0.9], [0.65, 0.48, 0.9]] };
    await updateSketchHandler({ ref: 'lay-contour', patch: [{ op: 'set', path: '/strokes/-', value: line }] });
    const r = await updateSketchHandler({ ref: 'lay-contour', patch: [{ op: 'solve', from: '/strokes/c1' }] });
    const S = r.stats.solved[0]; expect(S.intent).toBe('contour'); expect(S.parts).toEqual(['stroke.c1R']); expect(S.carrier).toBe('body'); expect(S.hits).toBe(4);
    const stored = SketchRepository.getByRef('lay-contour').manifest;
    expect(stored.recipe.parts['stroke.c1R']).toMatchObject({ layer: 2, from: 'c1', follow: true }); expect(stored.strokes[0].solved.parts).toEqual(['stroke.c1R']);
    expect(r.stats.parts.map((p) => p.id)).toContain('stroke.c1R'); expect(r.stats.closed).toBe(true);
    const again = await updateSketchHandler({ ref: 'lay-contour', patch: [{ op: 'set', path: '/strokes/0/mirror', value: true }, { op: 'solve', from: '/strokes/c1', height: 0.06 }] });
    expect(again.stats.solved[0].parts).toEqual(['stroke.c1R', 'stroke.c1L']); expect(again.stats.solved[0].height).toBe(0.06);
    const parts = Object.keys(SketchRepository.getByRef('lay-contour').manifest.recipe.parts); expect(parts.filter((n) => n.startsWith('stroke.')).sort()).toEqual(['stroke.c1L', 'stroke.c1R']);
    const m = await measureSolidHandler({ ref: 'lay-contour', volume: false, exposure: false }); expect(m.strokes.c1.solved.parts).toHaveLength(2);
    // a contour that misses the solid refuses by name and leaves the row alone
    await updateSketchHandler({ ref: 'lay-contour', patch: [{ op: 'set', path: '/strokes/-', value: { id: 'c2', view: 'lateral', intent: 'contour', points: [[0.02, 0.02], [0.05, 0.02]] } }] });
    await expect(updateSketchHandler({ ref: 'lay-contour', patch: [{ op: 'solve', from: '/strokes/c2' }] })).rejects.toThrow(/no-surface-under-stroke/);
    expect(Object.keys(SketchRepository.getByRef('lay-contour').manifest.recipe.parts).filter((n) => n.startsWith('stroke.')).length).toBe(2);
  });

  it('a `solve` on a brush adds a `brush` dial at 1 that pushes the skin along it and replays under a later dial; a re-solve replaces it', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-brush' });
    const line = { id: 'b1', view: 'lateral', intent: 'brush', points: [[0.4, 0.45, 1], [0.5, 0.46, 1], [0.6, 0.47, 1]] };
    await updateSketchHandler({ ref: 'lay-brush', patch: [{ op: 'set', path: '/strokes/-', value: line }] });
    // the two-station body has few points: a wide brush so the flank's vertices sit inside it
    const r = await updateSketchHandler({ ref: 'lay-brush', patch: [{ op: 'solve', from: '/strokes/b1', amp: 0.1, radius: 1.2 }] });
    const S = r.stats.solved[0]; expect(S.intent).toBe('brush'); expect(S.dial).toBe('stroke.b1'); expect(S.pointsMoved).toBeGreaterThan(0); expect(S.maxPush).toBeGreaterThan(0.01);
    const stored = SketchRepository.getByRef('lay-brush').manifest;
    expect(stored.recipe.dials['stroke.b1']).toMatchObject({ op: 'brush', from: 'b1', parts: ['body'] }); expect(stored.dials['stroke.b1']).toBe(1);
    const off = await updateSketchHandler({ ref: 'lay-brush', patch: [{ op: 'set', path: '/dials/stroke.b1', value: 0 }] }); expect(off.ok).toBe(true);   // turned down by name
    // `mirror` is the stroke's field: on the op it would be ignored, so it is refused and points at the stroke
    await expect(updateSketchHandler({ ref: 'lay-brush', patch: [{ op: 'solve', from: '/strokes/b1', mirror: true }] }))
      .rejects.toThrow(/patch\[0\]: a brush solve reads from, path, amp, radius, direction — not mirror\. `mirror` is the stroke's own field: set \/strokes\/0\/mirror/);
    // a re-solve with the stroke mirrored replaces the one dial with a twinned one (3 entries a side)
    const again = await updateSketchHandler({ ref: 'lay-brush', patch: [{ op: 'set', path: '/strokes/0/mirror', value: true }, { op: 'solve', from: '/strokes/b1' }] });
    expect(Object.keys(SketchRepository.getByRef('lay-brush').manifest.recipe.dials).filter((n) => n.startsWith('stroke.'))).toEqual(['stroke.b1']); expect(again.stats.solved[0].entries).toBe(6);
    expect(SketchRepository.getByRef('lay-brush').manifest.recipe.dials['stroke.b1'].entries.map((e) => e.side).sort()).toEqual(['L', 'L', 'L', 'R', 'R', 'R']);
    const m = await measureSolidHandler({ ref: 'lay-brush', volume: false, exposure: false }); expect(m.strokes.b1.solved.dial).toBe('stroke.b1');
  });

  it('the World page carries the overlay only when the row opts in with channels.strokes', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-page', strokes: [OUTLINE], channels: { strokes: true } });
    const on = await resolveWorldScene(SketchRepository.getByRef('lay-page'));
    expect(on.payload.strokeOverlay).toMatchObject({ ref: 'lay-page', views: expect.objectContaining({ frontal: 180 }) });
    expect(on.payload.strokeOverlay.strokes[0].camera).toBeTruthy(); expect(on.payload.strokeOverlay.residuals.s1.runs.length).toBeGreaterThan(0);
    expect(on.payload.strokeOverlay.framing.distance).toBe(SketchRepository.getByRef('lay-page').manifest.strokes[0].camera.distance);   // the page's snap is the stroke's camera
    await createLayeredHandler({ recipe, ref: 'lay-nopage', strokes: [OUTLINE] });
    expect((await resolveWorldScene(SketchRepository.getByRef('lay-nopage'))).payload.strokeOverlay).toBeUndefined();
  });

  it('absent strokes, a row keeps its shape: no `strokes` key, no `ledger.strokes`', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-plain' });
    const before = SketchRepository.getByRef('lay-plain').manifest;
    expect('strokes' in before).toBe(false); expect(Object.keys(before.ledger).sort()).toEqual(['closed', 'faces', 'recipe_bytes']);
    const r = await updateSketchHandler({ ref: 'lay-plain', patch: [{ op: 'set', path: '/dials/width', value: 1.3 }] });
    expect(r.ok).toBe(true); expect(r.stats.strokes).toBeUndefined();
    const after = SketchRepository.getByRef('lay-plain').manifest;
    expect('strokes' in after).toBe(false); expect(Object.keys(after.ledger).sort()).toEqual(['closed', 'faces', 'recipe_bytes']);
  });

  it('refuses by name: a malformed stroke, a solve on a stroke that is not there, a solve on an intent that has no solver yet', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-refuse' });
    await expect(updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'set', path: '/strokes/-', value: { id: 's1', view: 'frontal', intent: 'scribble', points: [[0.1, 0.1], [0.2, 0.2]] } }] }))
      .rejects.toThrow(/strokes refused[\s\S]*intent/);
    await expect(updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'solve', from: '/strokes/s9' }] })).rejects.toThrow(/needs a stored stroke/);
    await updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'set', path: '/strokes/-', value: { id: 'f1', view: 'frontal', intent: 'fold', points: [[0.4, 0.4], [0.6, 0.6]] } }] });
    await expect(updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'solve', from: '/strokes/s9' }] })).rejects.toThrow(/no stroke 's9'/);
    await expect(updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'solve', from: '/strokes/f1' }] })).rejects.toThrow(/silhouette, contour and brush strokes solve today/);
    await expect(updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'solve' }] })).rejects.toThrow(/from: '\/strokes\/<id>'/);
    // a key the stroke's solver does not read is refused by name, not ignored
    await updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'set', path: '/strokes/-', value: OUTLINE }] });
    await expect(updateSketchHandler({ ref: 'lay-refuse', patch: [{ op: 'solve', from: '/strokes/s1', height: 0.1 }] })).rejects.toThrow(/a silhouette solve reads from, path, dials, budget — not height/);
    expect(SketchRepository.getByRef('lay-refuse').manifest.dials).toEqual({ width: 1, lift: 0 });   // every refusal left the row alone
  });

  it('solve ops come last and every refusal names the op\'s own patch index', async () => {
    await createLayeredHandler({ recipe, ref: 'lay-order', strokes: [OUTLINE] });
    // a set after a solve would run BEFORE it (solves run in the layered gate, after the generic ops): refused, naming the set
    await expect(updateSketchHandler({ ref: 'lay-order', patch: [{ op: 'solve', from: '/strokes/s1' }, { op: 'set', path: '/nope/x', value: 1 }] }))
      .rejects.toThrow(/Invalid patch: patch\[1\]: a 'set' op after a `solve` \(patch\[0\]\)/);
    // a generic op keeps its index, and a solve after it is numbered in the whole patch, not among the solves
    await expect(updateSketchHandler({ ref: 'lay-order', patch: [{ op: 'set', path: '/nope/x', value: 1 }, { op: 'solve', from: '/strokes/s1' }] }))
      .rejects.toThrow(/patch\[0\]: `path` '\/nope\/x'/);
    await expect(updateSketchHandler({ ref: 'lay-order', patch: [{ op: 'set', path: '/dials/lift', value: 0.1 }, { op: 'solve', from: '/strokes/s1' }, { op: 'solve', from: '/strokes/s9' }] }))
      .rejects.toThrow(/patch\[2\]: no stroke 's9'/);
    expect(SketchRepository.getByRef('lay-order').manifest.dials).toEqual({ width: 1, lift: 0 });
  });
});
