import { describe, it, expect } from 'vitest';
import { assembleDungeonScene, buildDungeonFaces, planDungeon } from './dungeon-designer.js';

const spec = {
  chambers: [{ id: 'a', at: [0, 0], radius: 3, height: 4 }, { id: 'b', at: [10, 0], elevation: -2, radius: 3, height: 4 }],
  tunnels: [{ from: 'a', to: 'b', style: 'corridor', width: 3, height: 3 }],
  style: { palette: { wall: '#556677', floor: '#445566', ceiling: '#667788' } },
};

describe('cave lit handoff', () => {
  it('keeps the baked path unchanged when the option is absent or false', () => {
    expect(assembleDungeonScene(spec)).toEqual(assembleDungeonScene(spec, { unshaded: false }));
    expect(assembleDungeonScene(spec).lights).toBeUndefined();
    expect(assembleDungeonScene(spec).sky).toBeUndefined();
  });
  it('exports the same geometry with albedo independent of torch intensity', () => {
    const a = assembleDungeonScene(spec, { unshaded: true });
    const b = assembleDungeonScene({ ...spec, lighting: { fireIntensity: 9, gain: 5, tint: [0.2, 1, 0.3] } }, { unshaded: true });
    expect(a.faces).toEqual(b.faces);
    expect(a.faces.map(f => f.corners)).toEqual(assembleDungeonScene(spec).faces.filter(f => !f.glow).map(f => f.corners));
    expect(a.lights).toHaveLength(4);
    expect(a.sky).toEqual({ preset: 'interior' });
    expect(a.lights[0].intensity).not.toEqual(b.lights[0].intensity);
    const raw = buildDungeonFaces(planDungeon(spec), { unshaded: true });
    expect(a.lights.map(l => l.position)).toEqual(raw.sources.map(s => s.pos));
    expect(new Set(a.faces.map(f => f.fill))).toEqual(new Set(['#556677', '#445566', '#667788', '#6f5a40']));
  });
});
