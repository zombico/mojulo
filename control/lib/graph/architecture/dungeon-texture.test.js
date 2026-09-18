import { describe, it, expect } from 'vitest';
import { assembleDungeonScene, buildDungeonFaces, planDungeon, padTrianglesForWorld } from './dungeon-designer.js';

const spec = {
  chambers: [{ id: 'a', at: [0, 0], radius: 3, height: 4 }, { id: 'b', at: [10, 0], elevation: -2, radius: 3, height: 4 }],
  tunnels: [{ from: 'a', to: 'b', style: 'corridor', width: 3, height: 3 }, { from: 'b', to: 'a', style: 'tube' }],
};

describe('dungeon surface texture (L2)', () => {
  it('absent ⇒ no face carries a texture key (byte-identical shell)', () => {
    const { faces } = buildDungeonFaces(planDungeon(spec));
    expect(faces.some((f) => f.texture || f.uv)).toBe(false);
    expect(planDungeon(spec).chambers[0].texture).toBeNull();
  });
  it('a bare key textures every chamber surface and the tunnels, multiply-lit, with a uv per corner', () => {
    const { faces } = buildDungeonFaces(planDungeon({ ...spec, style: { texture: 'rock-cave' } }));
    const rock = faces.filter((f) => !f.glow);
    expect(rock.length).toBeGreaterThan(0);
    for (const f of rock) {
      expect(f.texture).toBe('rock-cave');
      expect(f.textureLit).toBe(true);
      expect(f.uv).toHaveLength(f.corners.length);
      for (const uv of f.uv) expect(uv.every(Number.isFinite)).toBe(true);
    }
  });
  it('per-surface keys, chamber override, tunnels inherit the wall key', () => {
    const plan = planDungeon({ ...spec, chambers: [spec.chambers[0], { ...spec.chambers[1], texture: { floor: 'rock-granite' } }], style: { texture: { wall: 'rock-cave', scale: 1.5 } } });
    expect(plan.chambers[0].texture).toEqual({ wall: 'rock-cave', scale: 1.5 });
    expect(plan.chambers[1].texture).toEqual({ wall: 'rock-cave', scale: 1.5, floor: 'rock-granite' });
    expect(plan.tunnels.map((t) => t.texture)).toEqual(['rock-cave', 'rock-cave']);
    const { faces } = buildDungeonFaces(plan);
    expect(faces.some((f) => f.texture === 'rock-granite')).toBe(true);
    expect(faces.some((f) => !f.glow && !f.texture)).toBe(true);   // untextured ceilings/floors remain plain
  });
  it('wall uv runs along the ring without a ±π seam inside a face', () => {
    const { faces } = buildDungeonFaces(planDungeon({ ...spec, style: { texture: 'rock-cave' } }));
    for (const f of faces) {
      if (!f.uv || f.corners.length < 4) continue;
      const us = f.uv.map((p) => p[0]);
      expect(Math.max(...us) - Math.min(...us)).toBeLessThan(6);   // a 3 m-radius ring seam would jump ~2π·3/2.4 ≈ 7.9
    }
  });
  it('an unknown key refuses at plan time (the mint gate)', () => {
    expect(() => planDungeon({ ...spec, style: { texture: 'no-such-tile' } })).toThrow(/unknown surface texture/);
    expect(() => planDungeon({ ...spec, chambers: [{ ...spec.chambers[0], texture: { wall: 'bogus' } }] })).toThrow(/chamber 'a' texture.wall/);
    expect(() => planDungeon({ ...spec, style: { texture: { wall: 'rock-cave', scale: -1 } } })).toThrow(/scale/);
  });
  it('a textured fan triangle keeps its uv in step when padded for the World', () => {
    const [f] = padTrianglesForWorld([{ corners: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], uv: [[0, 0], [1, 0], [0, 1]], texture: 'rock-cave' }]);
    expect(f.corners).toHaveLength(4);
    expect(f.uv).toHaveLength(4);
    expect(f.uv[3]).toEqual([0, 1]);
    const scene = assembleDungeonScene({ ...spec, style: { texture: 'rock-cave' } });
    for (const f of scene.faces) if (f.uv) expect(f.uv).toHaveLength(f.corners.length);
  });
});
