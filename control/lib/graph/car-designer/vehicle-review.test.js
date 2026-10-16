import {describe,it,expect} from 'vitest';
import {compileSupercarSurface,SUPERCAR_LODS} from './vehicle-odm-surface.js';
import {packVehicleReview,emitVehicleReview} from './vehicle-review.js';
import {faceListToMesh,faceColorLinear} from '../figures/face-mesh.js';

describe('close-camera vehicle budget and materials',()=>{
  it('keeps real emitted triangles within the LOD ceiling across design variants',()=>{
    for(const architecture of ['midEngine','frontEngine','rearEngine']) for(const quality of Object.keys(SUPERCAR_LODS)) {
      const c=compileSupercarSurface({seed:17,architecture},{quality});
      const faces=Object.values(c.faces).flat();
      const mesh=faceListToMesh(faces,{decollide:false,withNormals:true});
      expect(mesh.positions.length/9).toBe(c.census.triangles);
      expect(c.census.triangles).toBeLessThanOrEqual(c.census.triangleBudget);
      expect(c.census.remainingTriangles).toBe(c.census.triangleBudget-c.census.triangles);
      for(const f of faces) {
        expect(c.materials[f.material]).toBeDefined();
        expect(f.cornerNormals).toHaveLength(f.corners.length);
        for(const n of f.cornerNormals) {
          expect(n.every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...n)).toBeCloseTo(1,5);
        }
      }
    }
  });
  it('keeps five-spoke wheels and the same tyre radius across detail levels',()=>{
    let radius=null;
    for(const quality of Object.keys(SUPERCAR_LODS)) {
      const c=compileSupercarSurface({seed:1014},{quality});
      expect(c.faces.wheels.filter(f=>f.part==='wheel.spoke')).toHaveLength(20);
      const z=c.faces.wheels.filter(f=>f.part==='tyre').flatMap(f=>f.corners.map(p=>p[2]));
      const measured=(Math.max(...z)-Math.min(...z))/2;
      expect(measured).toBeCloseTo(c.design.frame.wheelRadius,4);
      if(radius!==null)expect(measured).toBe(radius);
      radius=measured;
    }
  });
  it('indexes the lit mesh without changing triangles, dropping materials or double-baking colours',()=>{
    const c=compileSupercarSurface({seed:1014},{quality:'game'}),groups=packVehicleReview(c);
    expect(groups.reduce((n,g)=>n+g.indices.length/3,0)).toBe(c.census.triangles);
    expect(groups.length).toBe(c.census.materialGroups);
    expect(groups.reduce((n,g)=>n+g.positions.length/3,0)).toBeLessThan(c.census.triangles*3);
    for(const g of groups) {
      expect(g.normals.length).toBe(g.positions.length);
      expect(g.colors.length).toBe(g.positions.length);
      expect(Math.max(...g.indices)).toBeLessThan(g.positions.length/3);
    }
    const rawPaint=Object.values(c.faces).flat().find(f=>f.material==='paint').albedo;
    const expected=faceColorLinear({fill:rawPaint});
    const paint=groups.find(g=>g.material==='paint');
    for(let i=0;i<3;i++)expect(paint.colors[i]).toBeCloseTo(expected[i],6);
    const html=emitVehicleReview(c,{title:'</script><vehicle>'});
    expect(html).toContain('&lt;/script&gt;&lt;vehicle&gt;');
    expect(html).toContain('MeshPhysicalMaterial');
    expect(html).toContain('window.__supercarReview');
  });
});
