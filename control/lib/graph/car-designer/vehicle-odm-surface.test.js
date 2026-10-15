import { describe,it,expect } from 'vitest';
import { compileSupercarSurface } from './vehicle-odm-surface.js';
describe('supercar surface patches',()=>{
  it('generates finite, bounded quads and named parts',()=>{
    const c=compileSupercarSurface({seed:1014});
    expect(c.census.totalFaces).toBeGreaterThan(500);
    for(const f of Object.values(c.faces).flat()) {
      expect(f.corners.length).toBe(4);
      expect(f.corners.flat().every(Number.isFinite)).toBe(true);
      expect(f.part).toBeTruthy();
    }
  });
  it('increases detail with LOD and stays deterministic',()=>{
    const q={seed:17,architecture:'rearEngine',language:'trackSpecial'};
    const g=compileSupercarSurface(q,{quality:'game'});
    const s=compileSupercarSurface(q,{quality:'studio'});
    const h=compileSupercarSurface(q,{quality:'hero'});
    expect(g.census.totalFaces).toBeLessThan(s.census.totalFaces);
    expect(s.census.totalFaces).toBeLessThan(h.census.totalFaces);
    expect(s).toEqual(compileSupercarSurface(q,{quality:'studio'}));
  });
  it('rejects invalid fidelity and paint',()=>{
    expect(()=>compileSupercarSurface({}, {quality:'ultra'})).toThrow(/quality/);
    expect(()=>compileSupercarSurface({}, {paint:'not-a-color'})).toThrow(/paint/);
  });
});
