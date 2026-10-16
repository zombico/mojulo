import { describe, it, expect } from 'vitest';
import { assembleStageScene } from '../era/stage.js';
import { standsRepeats } from '../era/stands.js';
import { arenaManifest, ARENA_PLANE } from './versus-arena.js';

describe('versus arena: a stage set open to the camera, the crowd behind the plane', () => {
  const m = arenaManifest({ width: 14, depth: 13, crowd: { rows: 2 } });
  const P = assembleStageScene(m, {});

  it('is a stage recipe of a few words; the stands are built on the read', () => {
    expect(m.kind).toBe('stage');
    expect(m.rooms[0].open).toEqual(['-y']);
    expect(JSON.stringify(m).length).toBeLessThan(800);
    expect(m.versus).toMatchObject({ plane: ARENA_PLANE, half: 6 });
    expect(P.repeats.length).toBeGreaterThan(1);
  });

  it('builds only what the camera sees: every stand and every person stands behind the plane, inside the room', () => {
    const pts = P.repeats.flatMap((r) => r.transforms.flatMap((t) => r.template.flatMap((f) => f.corners.map((c) => [c[0] + t.pos[0], c[1] + t.pos[1]]))));
    expect(Math.min(...pts.map((p) => p[1]))).toBeGreaterThan(ARENA_PLANE + 1);
    expect(Math.max(...pts.map((p) => p[1]))).toBeLessThan(13);
    expect(Math.max(...pts.map((p) => Math.abs(p[0])))).toBeLessThan(7);
  });

  it('is a function of its seed, and a stage without stands has no repeats', () => {
    const again = standsRepeats(m.stands, m.rooms);
    expect(JSON.stringify(again.repeats)).toBe(JSON.stringify(P.repeats));
    expect(standsRepeats({ ...m.stands, seed: 9 }, m.rooms).repeats).not.toEqual(again.repeats);
    const { stands: _s, ...bare } = m;
    expect(assembleStageScene(bare, {}).repeats).toBeUndefined();
  });

  it('faces an open side on any side, and says when there is none', () => {
    const rooms = [{ id: 'r', x: 0, y: 0, w: 8, d: 14, h: 6, open: ['+x'] }];
    const S = standsRepeats({ rows: 1, from: 4 }, rooms);
    const xs = S.repeats.flatMap((r) => r.transforms.map((t) => t.pos[0]));
    expect(S.people).toBeGreaterThan(0);
    expect(Math.max(...xs.filter((x) => x !== 0))).toBeLessThan(8 - 4);
    expect(() => standsRepeats({}, [{ id: 'r', x: 0, y: 0, w: 8, d: 8, h: 6 }])).toThrow(/one open side/);
  });
});
