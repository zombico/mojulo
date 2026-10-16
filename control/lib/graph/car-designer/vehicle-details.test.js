import {describe,it,expect} from 'vitest';
import {mirrorAssembly} from './vehicle-details.js';
import {compileSupercarSurface} from './vehicle-odm-surface.js';

const edgeKey=(a,b)=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
function edgeCounts(faces) {
  const edges=new Map();
  for(const f of faces)for(let i=0;i<4;i++) {
    const key=edgeKey(f.corners[i],f.corners[(i+1)%4]);
    edges.set(key,(edges.get(key)||0)+1);
  }
  return [...edges.values()];
}

describe('readable exterior detail assemblies',()=>{
  it('closes the mirror pod, surrounds its glass with a seal and gives its stalk a solid underside',()=>{
    for(const side of [-1,1]) {
      const inner=side*0.8,outer=side*0.99,y=0.3,z=0.9;
      const faces=mirrorAssembly({side,inner,outer,y,z,mount:[side*0.65,y,z],paint:'#ad2530'});
      const pod=faces.filter(f=>!['mirror.stalk','mirror.indicator'].includes(f.part));
      expect(edgeCounts(pod).every(n=>n===2)).toBe(true);
      const stalk=faces.filter(f=>f.part==='mirror.stalk');
      expect(edgeCounts(stalk).every(n=>n===2)).toBe(true);
      const glass=faces.filter(f=>f.part==='mirror.glass');
      const sealEdges=new Set(faces.filter(f=>f.part==='mirror.seal').flatMap(f=>f.corners.map((p,i)=>edgeKey(p,f.corners[(i+1)%4]))));
      const glassEdges=new Map();
      for(const f of glass)for(let i=0;i<4;i++) {
        const key=edgeKey(f.corners[i],f.corners[(i+1)%4]);
        glassEdges.set(key,(glassEdges.get(key)||0)+1);
      }
      for(const [edge,n] of glassEdges)if(n===1)expect(sealEdges.has(edge)).toBe(true);
      // The outer stalk cap enters the pod's physical envelope.
      for(const p of stalk.at(-1).corners) {
        expect(Math.abs(p[0])).toBeGreaterThan(Math.abs(inner));
        expect(Math.abs(p[0])).toBeLessThan(Math.abs(outer));
        expect(p[1]).toBeGreaterThan(y-0.085);
        expect(p[1]).toBeLessThan(y+0.095);
        expect(p[2]).toBeGreaterThan(z);
        expect(p[2]).toBeLessThan(z+0.09);
      }
    }
  });
  it('keeps lenses, reflector rings and mirror glass distinct without adding material draws at any LOD',()=>{
    for(const quality of ['game','studio','hero'])for(const language of ['aeroWedge','grandTourer','trackSpecial']) {
      const c=compileSupercarSurface({seed:1014,language},{quality});
      expect(c.census.triangles).toBeLessThanOrEqual(c.census.triangleBudget);
      expect(c.census.materialGroups).toBe(9);
      const faces=c.faces.detail;
      for(const [part,material] of [['lamp.front.lens','glass'],['lamp.rear.lens','glass'],['lamp.reflector','alloy'],['headlamp','lamp'],['taillamp','tail'],['mirror.glass','alloy'],['mirror.seal','seal'],['mirror.undershell','carbon']]) {
        const selected=faces.filter(f=>f.part===part);
        expect(selected.length,part).toBeGreaterThan(0);
        expect(selected.every(f=>f.material===material),part).toBe(true);
      }
      const lens=faces.find(f=>f.part==='lamp.front.lens');
      const projector=faces.find(f=>f.part==='headlamp');
      expect(projector.mountOffset).toBeGreaterThan(lens.mountOffset);
      expect(projector.albedo).not.toBe(lens.albedo);
    }
  });
});
