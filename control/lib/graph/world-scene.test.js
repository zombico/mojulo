import { describe, expect, it } from 'vitest';

import { resolveWorldScene } from './world-scene.js';

// resolveWorldScene takes a stored-sketch-like { manifest, title }. orbit-view is a pure assembler
// (no DB / no textures), so it exercises the generic motion layer without touching SketchRepository.
const sketch = (manifest) => ({ manifest, title: 'test' });

describe('world-scene — generic opt-in motion layer', () => {
  it('leaves a payload untouched when the manifest carries no `motion`', async () => {
    const a = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    const b = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(JSON.stringify(a.payload.movers)).toBe(JSON.stringify(b.payload.movers));
  });

  it('appends placed movers from a `motion` spec to ANY world', async () => {
    const base = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    const withMotion = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      motion: [{ rule: 'free-fall', params: { height: 10 }, at: [30, 0, 0], group: 'drop' }],
    }));
    expect(withMotion.payload.movers.length).toBe(base.payload.movers.length + 1);
    const drop = withMotion.payload.movers.find((m) => m.group === 'drop');
    expect(drop).toBeTruthy();
    expect(drop.path[0]).toEqual([30, 0, 10]);   // free-fall starts at [0,0,H], placed at [30,0,0]
  });

  it('works on a world kind that has no movers of its own (motion is the only mover source)', async () => {
    const withMotion = await resolveWorldScene(sketch({
      kind: 'molecule-view',
      atoms: [{ symbol: 'C', pos: [0, 0, 0] }, { symbol: 'O', pos: [1.2, 0, 0] }],
      motion: [{ rule: 'pendulum', params: { length: 8 }, at: [0, 0, 0], loop: true }],
    }));
    expect(Array.isArray(withMotion.payload.movers)).toBe(true);
    expect(withMotion.payload.movers.length).toBe(1);
    expect(withMotion.payload.movers[0].loop).toBe(true);
  });

  it('skips an unknown rule name without breaking the render', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      motion: [{ rule: 'teleport', at: [0, 0, 0] }],
    }));
    const base = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(out.payload.movers.length).toBe(base.payload.movers.length);   // nothing appended
  });
});

describe('world-scene — controllable channel passthrough', () => {
  it('passes manifest entities + camera onto the payload and flags nonBakeable', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      entities: [{ id: 'd', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }],
      camera: { rule: 'follow', target: 'd' },
    }));
    expect(out.payload.entities.length).toBe(1);
    expect(out.payload.camera.rule).toBe('follow');
    expect(out.payload.nonBakeable).toBe(true);
  });

  it('leaves a payload untouched when no entities are declared', async () => {
    const out = await resolveWorldScene(sketch({ kind: 'orbit-view', scenario: 'circular' }));
    expect(out.payload.entities).toBeUndefined();
    expect(out.payload.camera).toBeUndefined();
  });

  it('renders a STANDALONE controllable world (kind:controllable) with no other kind', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'controllable',
      entities: [{ id: 'drone', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }],
      camera: { rule: 'follow', target: 'drone' },
    }));
    expect(out.kind).toBe('controllable');
    expect(out.payload).toBeTruthy();              // standalone stage produced a payload (not 422)
    expect(out.payload.faces.length).toBeGreaterThan(0);   // default floor
    expect(out.payload.entities.length).toBe(1);
    expect(out.payload.nonBakeable).toBe(true);
  });

  it('bakes a figure-frames figure spec at resolve time (recipe → frames)', async () => {
    const out = await resolveWorldScene(sketch({
      kind: 'orbit-view', scenario: 'circular',
      entities: [{ id: 'hero', rule: { type: 'walk' }, body: { type: 'figure-frames', figure: 'male' } }],
      figures: { male: { motion: 'walk', proto: 'male', frames: 2 } },
    }));
    expect(out.payload.figures.male.length).toBe(2);             // baked to 2 frames
    expect(Array.isArray(out.payload.figures.male[0].faces)).toBe(true);
  });
});
