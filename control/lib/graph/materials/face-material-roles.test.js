import { describe, it, expect } from 'vitest';
import { stampFaceMaterial } from './face-material-roles.js';

const mk = () => ({
  kind: 'controllable',
  faces: [
    { corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0]], fill: '#8a8f97' },   // floor
    { corners: [[0, 0, 40], [10, 0, 40], [10, 0, 150]], fill: '#424b57' }, // tall wall panel
    { corners: [[0, 0, 145], [10, 0, 150], [10, 10, 148]], fill: '#ffe9c4' }, // high flat (skylight)
  ],
});

describe('stampFaceMaterial', () => {
  it('blanket preset stamps every face and reports the count', () => {
    const { map, count } = stampFaceMaterial(mk(), 'brushed-hull');
    expect(count).toBe(3);
    expect(map.faces.every((f) => f.material === 'brushed-hull')).toBe(true);
  });

  it('is pure — the source map is untouched', () => {
    const src = mk();
    const before = JSON.stringify(src);
    stampFaceMaterial(src, 'gradient-plate');
    expect(JSON.stringify(src)).toBe(before);
  });

  it('absent/empty spec returns the map unchanged (same reference, count 0)', () => {
    const src = mk();
    const a = stampFaceMaterial(src, null);
    const b = stampFaceMaterial(src, []);
    expect(a.count).toBe(0); expect(a.map).toBe(src);
    expect(b.count).toBe(0); expect(b.map).toBe(src);
  });

  it('height-band filter stamps only faces inside [minZ,maxZ]', () => {
    const { map, count } = stampFaceMaterial(mk(), { preset: 'weathered-hull', minZ: 140 });
    expect(count).toBe(1);                                  // only the high skylight face
    expect(map.faces[2].material).toBe('weathered-hull');
    expect(map.faces[0].material).toBeUndefined();
  });

  it('fills filter stamps only faces whose baked fill matches (role-by-colour)', () => {
    const { map, count } = stampFaceMaterial(mk(), { preset: 'brushed-steel', fills: ['#8a8f97'] });
    expect(count).toBe(1);
    expect(map.faces[0].material).toBe('brushed-steel');
    expect(map.faces[1].material).toBeUndefined();
  });

  it('ordered rule array is first-match-wins', () => {
    const { map } = stampFaceMaterial(mk(), [
      { preset: 'gradient-plate', fills: ['#8a8f97'] },     // floor → plate
      { preset: 'weathered-heavy' },                        // everything else → heavy
    ]);
    expect(map.faces[0].material).toBe('gradient-plate');
    expect(map.faces[1].material).toBe('weathered-heavy');
    expect(map.faces[2].material).toBe('weathered-heavy');
  });

  it('an unknown preset throws loud (typo fails at mint, not silent at render)', () => {
    expect(() => stampFaceMaterial(mk(), 'brushed-chrome')).toThrow(/unknown preset/);
    expect(() => stampFaceMaterial(mk(), { preset: 'nope' })).toThrow(/unknown preset/);
  });
});
