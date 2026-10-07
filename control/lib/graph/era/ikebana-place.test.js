import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { SOFT_GROUP, SOLID_GROUP } from './ikebana-place.js';

const TRAIL = { id: 'garden', heartbeat: 0.7, bumpiness: 0.5, bounds: { '+y': 'open' } };

describe('ikebana placed: a garden level', () => {
  const p = assembleStageScene({ kind: 'stage', kit: 'isekai-garden', seed: 12, trail: TRAIL });
  const arr = p.anchors.filter((a) => a.kind === 'arrangement');
  it('paints arrangements along the banks, each keeping its laws, the trail\'s own laws intact', () => {
    expect(arr.length).toBeGreaterThan(6);
    for (const a of arr) expect(a.laws).toEqual([]);
    expect(p.outTrail.laws.filter((l) => !l.ok)).toEqual([]);
    expect(arr.some((a) => a.odd)).toBe(true);
  });
  it('stands every element on the land, coloured from the kit, soft where a walker passes through', () => {
    const soft = p.faces.filter((f) => f.group === SOFT_GROUP), solid = p.faces.filter((f) => f.group === SOLID_GROUP);
    expect(soft.length).toBeGreaterThan(0); expect(solid.length).toBeGreaterThan(0);
    for (const f of [...soft, ...solid].slice(0, 400)) expect(f.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(p.soft).toEqual([SOFT_GROUP]);
  });
  it('gives an engine its blockers as colliders, every one clear of the trail', () => {
    const ik = p.colliders.filter((c) => String(c.of).startsWith('ikebana'));
    expect(ik.length).toBeGreaterThan(0);
    for (const c of ik) expect(c.max[2]).toBeGreaterThan(c.min[2]);
  });
  it('the page walks through the soft group, and a world without one emits as before', () => {
    expect(emitThreeWorld({ ...p, inline: true })).toContain('__SOFT');
    const m = assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', seed: 12, trail: TRAIL });
    expect(m.soft).toBeUndefined();
    const a = emitThreeWorld({ ...m, inline: true }), b = emitThreeWorld({ ...m, soft: null, inline: true });
    expect(a).toBe(b); expect(a).not.toContain('__SOFT');
  });
  it('is deterministic', () => {
    const q = assembleStageScene({ kind: 'stage', kit: 'isekai-garden', seed: 12, trail: TRAIL });
    expect(JSON.stringify(q.anchors)).toBe(JSON.stringify(p.anchors));
    expect(q.faces.length).toBe(p.faces.length);
  });
});
