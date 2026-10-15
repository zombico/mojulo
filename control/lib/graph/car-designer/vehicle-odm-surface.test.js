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

describe('supercar visual geometry regressions',()=>{
  it('keeps sampled wheel openings clear of the tyres at every LOD and architecture',()=>{
    for(const architecture of ['midEngine','frontEngine','rearEngine'])
      for(const quality of ['game','studio','hero']) {
        const c=compileSupercarSurface({seed:1014,architecture},{quality});
        const r=c.design.frame.wheelRadius;
        const centers=[c.design.topology.anchors.wheelFL,c.design.topology.anchors.wheelRL];
        for(const f of c.faces.body.filter(f=>f.part==='body.sill')) {
          const [a,b]=f.corners;
          for(let i=0;i<=8;i++) {
            const y=a[1]+(b[1]-a[1])*i/8,z=a[2]+(b[2]-a[2])*i/8;
            for(const center of centers) expect(Math.hypot(y-center[1],z-r)).toBeGreaterThan(r+0.008);
          }
        }
      }
  });
  it('keeps wheel-well liners below the visible body deck',()=>{
    const c=compileSupercarSurface({seed:1014},{quality:'game'});
    const sections=new Map();
    for(const f of c.faces.body.filter(f=>f.part.startsWith('body.deck'))) for(const [x,y,z] of f.corners) {
      if(!sections.has(y)) sections.set(y,new Map());
      sections.get(y).set(x,z);
    }
    for(const f of c.faces.detail.filter(f=>f.part==='wheel.well')) {
      for(const [a,b] of [[f.corners[0],f.corners[3]],[f.corners[1],f.corners[2]]]) {
        const row=[...sections.get(a[1])].sort((a,b)=>a[0]-b[0]);
        for(let i=0;i<=4;i++) {
          const x=a[0]+(b[0]-a[0])*i/4,z=a[2]+(b[2]-a[2])*i/4;
          const j=row.findIndex(p=>p[0]>=x);
          expect(j).toBeGreaterThan(0);
          const [x0,z0]=row[j-1],[x1,z1]=row[j];
          const deckZ=z0+(z1-z0)*(x-x0)/(x1-x0);
          expect(z).toBeLessThan(deckZ-0.001);
        }
      }
    }
  });
  it('closes both ends and fits entire lamp and intake patches outside the curved fascia',()=>{
    for(const quality of ['game','studio','hero']) {
      const c=compileSupercarSurface({seed:1014},{quality});
      for(const [part,cap,sign] of [['headlamp','body.nose',1],['taillamp','body.tail',-1],['intake.front','body.nose',1],['aero.diffuser','body.tail',-1]]) {
        const capFaces=c.faces.body.filter(f=>f.part===cap),panel=capFaces.flatMap(f=>f.corners);
        const deckEdges=allEdges(c.faces.body.filter(f=>f.part.startsWith('body.deck')));
        expect([...allEdges(capFaces)].filter(edge=>deckEdges.has(edge)).length).toBeGreaterThan(4);
        const triangles=capFaces.flatMap(f=>[[f.corners[0],f.corners[1],f.corners[2]],[f.corners[0],f.corners[2],f.corners[3]]]);
        const xs=panel.map(p=>p[0]),zs=panel.map(p=>p[2]);
        for(const f of c.faces.detail.filter(f=>f.part===part || (f.fasciaMount && part === (f.corners[0][1]>0?'headlamp':'taillamp')))) {
          // Corners alone do not catch a flat lens cutting through a curved
          // bumper between its endpoints. Inspect each patch centre too.
          const center=f.corners[0].map((_,i)=>f.corners.reduce((sum,p)=>sum+p[i],0)/4);
          const triangleCenters=[[0,1,2],[0,2,3]].map(ids=>[0,1,2].map(k=>ids.reduce((sum,i)=>sum+f.corners[i][k],0)/3));
          for(const p of [...f.corners,center,...triangleCenters]) {
            let fitted=false;
            for(const [a,b,d] of triangles) {
              const den=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2]);
              if(Math.abs(den)<1e-10)continue;
              const u=((b[2]-d[2])*(p[0]-d[0])+(d[0]-b[0])*(p[2]-d[2]))/den;
              const v=((d[2]-a[2])*(p[0]-d[0])+(a[0]-d[0])*(p[2]-d[2]))/den;
              if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001) {
                const distance=sign*(p[1]-(u*a[1]+v*b[1]+(1-u-v)*d[1]));
                if(Math.abs(distance-(f.mountOffset??0.004))<0.002)fitted=true;
              }
            }
            expect(fitted,part).toBe(true);
            expect(p[0]).toBeGreaterThan(Math.min(...xs));
            expect(p[0]).toBeLessThan(Math.max(...xs));
            expect(p[2]).toBeGreaterThan(Math.min(...zs));
            expect(p[2]).toBeLessThan(Math.max(...zs));
          }
        }
      }
    }
  });
  it('gives raised wings solid mounts and omits them for clean designs',()=>{
    const c=compileSupercarSurface({seed:1014,aero:'track'});
    const wing=c.faces.detail.filter(f=>f.part==='aero.wing').flatMap(f=>f.corners);
    const supports=c.faces.detail.filter(f=>f.part==='aero.support');
    expect(wing.length).toBeGreaterThan(4);
    const deckTriangles=c.faces.body.filter(f=>f.part.startsWith('body.deck')).flatMap(triangulate);
    const wingTriangles=c.faces.detail.filter(f=>f.part==='aero.wing').flatMap(triangulate);
    const assemblies=new Set(supports.map(f=>f.assembly));
    expect(assemblies.size).toBe(2);
    for(const assembly of assemblies) {
      const points=supports.filter(f=>f.assembly===assembly).flatMap(f=>f.corners);
      expect(Math.min(...points.map(p=>p[2]))).toBeLessThan(Math.min(...wing.map(p=>p[2])));
      expect(Math.max(...points.map(p=>p[2]))).toBeGreaterThan(Math.min(...wing.map(p=>p[2])));
      for(const p of points)expect(Math.abs(p[0])).toBeLessThan(Math.max(...wing.map(p=>Math.abs(p[0]))));
      const unique=[...new Map(points.map(p=>[JSON.stringify(p),p])).values()];
      const gaps=unique.flatMap(p=>heightsAt(deckTriangles,p).map(z=>p[2]-z));
      expect(Math.min(...gaps)).toBeLessThan(.002);
      expect(Math.min(...gaps)).toBeGreaterThan(-.03);
      expect(unique.some(p=>{
        const heights=heightsAt(wingTriangles,p);
        return heights.length>=2&&p[2]>=Math.min(...heights)-.001&&p[2]<=Math.max(...heights)+.001;
      })).toBe(true);
    }
    expect(compileSupercarSurface({aero:'clean'}).faces.detail.some(f=>f.part.startsWith('aero.wing')||f.part==='aero.support')).toBe(false);
  });
  it('bakes multiple paint values and produces nondegenerate quads within the physical envelope',()=>{
    for(const language of ['aeroWedge','grandTourer','trackSpecial']) {
      const c=compileSupercarSurface({seed:1014,language});
      expect(new Set(c.faces.body.map(f=>f.fill)).size).toBeGreaterThan(5);
      for(const f of Object.values(c.faces).flat()) {
        const [a,b,d]=f.corners;
        const u=b.map((v,i)=>v-a[i]),v=d.map((x,i)=>x-a[i]);
        const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
        expect(area, f.part).toBeGreaterThan(1e-9);
        for(const p of f.corners) {
          expect(Math.abs(p[0])).toBeLessThanOrEqual(c.design.frame.W/2+0.001);
          expect(Math.abs(p[1])).toBeLessThanOrEqual(c.design.frame.L/2+0.003);
          expect(p[2]).toBeGreaterThanOrEqual(-0.001);
          expect(p[2]).toBeLessThanOrEqual(c.design.frame.H+0.01);
        }
      }
    }
  });
});

// Boundary checks inspect the emitted mesh: a named panel is only separated
// when its whole perimeter meets the surrounding recessed seam or frame.
const edgeKey=(a,b)=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
function boundaryEdges(faces) {
  const edges=new Map();
  for(const f of faces) for(let i=0;i<4;i++) {
    const key=edgeKey(f.corners[i],f.corners[(i+1)%4]);
    edges.set(key,(edges.get(key)||0)+1);
  }
  return [...edges].filter(([,count])=>count===1).map(([key])=>key);
}
function allEdges(faces) {
  return new Set(faces.flatMap(f=>f.corners.map((p,i)=>edgeKey(p,f.corners[(i+1)%4]))));
}
describe('fitted hood, doors and cabin',()=>{
  it('surrounds the hood and both door skins with continuous shut lines at every LOD',()=>{
    for(const seed of [1,17,1014]) for(const quality of ['game','studio','hero']) {
      const c=compileSupercarSurface({seed},{quality});
      for(const [panel,seam] of [['body.deck.hood','body.deck.hood-seam'],['door.port.skin','door.port.seam'],['door.starboard.skin','door.starboard.seam']]) {
        const boundary=boundaryEdges(c.faces.body.filter(f=>f.part===panel));
        const surrounding=allEdges(c.faces.body.filter(f=>f.part===seam));
        expect(boundary.length,panel).toBeGreaterThan(4);
        for(const edge of boundary) expect(surrounding.has(edge),panel).toBe(true);
      }
    }
  });
  it('fits seals or painted pillars around every edge of the windshield',()=>{
    for(const architecture of ['midEngine','frontEngine','rearEngine']) {
      const c=compileSupercarSurface({seed:1014,architecture});
      const boundary=boundaryEdges(c.faces.detail.filter(f=>f.part==='glass.screen'));
      const surround=allEdges(c.faces.detail.filter(f=>['cabin.screen-seal','cabin.pillar'].includes(f.part)));
      expect(boundary.length).toBeGreaterThan(4);
      for(const edge of boundary) expect(surround.has(edge)).toBe(true);
    }
  });
  it('preserves real, finite cabin quads across architectures and detail levels',()=>{
    for(const architecture of ['midEngine','frontEngine','rearEngine']) for(const quality of ['game','studio','hero']) {
      const c=compileSupercarSurface({seed:1014,architecture},{quality});
      for(const f of c.faces.detail.filter(f=>/^(cabin|glass|mirror|door)\./.test(f.part))) {
        expect(new Set(f.corners.map(p=>JSON.stringify(p))).size,f.part).toBe(4);
        const [a,b,d]=f.corners,u=b.map((v,i)=>v-a[i]),v=d.map((x,i)=>x-a[i]);
        expect(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]),f.part).toBeGreaterThan(1e-9);
        for(const p of f.corners) expect(p.every(Number.isFinite)).toBe(true);
      }
    }
  });
});

function triangulate(f) {
  return [[f.corners[0],f.corners[1],f.corners[2]],[f.corners[0],f.corners[2],f.corners[3]]];
}
function heightsAt(triangles,p) {
  const heights=[];
  for(const [a,b,c] of triangles) {
    const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(den)<1e-10)continue;
    const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den;
    const v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;
    if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001)heights.push(u*a[2]+v*b[2]+(1-u-v)*c[2]);
  }
  return heights;
}
