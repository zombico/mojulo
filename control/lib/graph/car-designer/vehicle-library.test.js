import {describe,it,expect} from 'vitest';
import {composeSupercar} from './vehicle-library.js';
import {createCabinProfile} from './vehicle-cabin.js';
import {spoilerAssembly} from './vehicle-aero.js';
import {solveSupercarDesign} from './vehicle-odm.js';

const key=(a,b)=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
function edgeCounts(faces) {
  const edges=new Map();
  for(const f of faces)for(let i=0;i<4;i++) {
    const k=key(f.corners[i],f.corners[(i+1)%4]);edges.set(k,(edges.get(k)||0)+1);
  }
  return edges;
}
const allEdges=faces=>new Set(edgeCounts(faces).keys());

describe('composable cabin, cooling and aero',()=>{
  it('keeps cabin curves smooth at roof transitions and glazing feet fitted to the deck',()=>{
    const design=solveSupercarDesign({seed:1014}),deck=(t,x)=>[x,design.frame.L*(.5-t),.65+.03*x*x];
    for(const style of ['wedge','teardrop','fastback']) {
      const c=createCabinProfile(design,style),eps=1e-5;
      for(const t of [c.roofStart,c.peak,c.roofEnd]) {
        const left=(c.height(t)-c.height(t-eps))/eps,right=(c.height(t+eps)-c.height(t))/eps;
        expect(Math.abs(left-right)).toBeLessThan(.02);
      }
      for(let i=0;i<=100;i++) {
        const t=c.start+(c.end-c.start)*i/100;
        expect(c.height(t)).toBeGreaterThanOrEqual(-1e-8);
        expect(c.height(t)).toBeLessThanOrEqual(1.0000001);
      }
      expect(c.footWidth(c.end)).toBeLessThan(c.footWidth(c.start));
      for(const t of [c.start,c.end])for(const u of [-1,0,1]) {
        const p=c.roofPoint(deck,t,u);
        expect(p[2]-deck(t,p[0])[2]).toBeCloseTo(.003,6);
      }
      const foot=c.roofPoint(deck,c.start,0),top=c.roofPoint(deck,c.roofStart,0);
      const rake=Math.atan2(top[2]-foot[2],foot[1]-top[1])*180/Math.PI;
      expect(rake).toBeLessThan(45);
    }
  });
  it('surrounds real vent recesses with joined perimeter walls and closed louvre blades',()=>{
    for(const preset of ['razor','touring']) {
      const c=composeSupercar({preset,seed:1014,surface:{quality:'game'}});
      const vent=c.faces.body.filter(f=>f.part.startsWith('vent.'));
      const surrounding=allEdges(c.faces.body.filter(f=>!f.part.startsWith('vent.')));
      const boundary=[...edgeCounts(vent)].filter(([,n])=>n===1).map(([edge])=>edge);
      expect(boundary.length).toBeGreaterThan(4);
      for(const edge of boundary)expect(surrounding.has(edge),edge).toBe(true);
      for(const f of vent.filter(f=>f.part.endsWith('.lip'))) {
        if(f.part.startsWith('vent.side')) {
          const outside=(Math.abs(f.corners[0][0])+Math.abs(f.corners[1][0]))/2;
          const inside=(Math.abs(f.corners[2][0])+Math.abs(f.corners[3][0]))/2;
          expect(outside-inside).toBeGreaterThan(.025);
        }
        expect(f.material).toBe('carbon');
      }
      const blades=c.faces.detail.filter(f=>f.part.startsWith('vent.')&&f.part.endsWith('.blade'));
      expect(blades.length).toBeGreaterThan(0);
      expect([...edgeCounts(blades).values()].every(n=>n===2)).toBe(true);
    }
  });
  it('closes wing blades, endplates and both mounts, with mounts reaching the deck and blade',()=>{
    const design=solveSupercarDesign({seed:1014}),deck=(t,x)=>[x,design.frame.L*(.5-t),.65];
    for(const style of ['ducktail','pedestal','swanNeck']) {
      const faces=spoilerAssembly({design,style,quality:'game',deck,paint:'#af2632'});
      for(const assembly of new Set(faces.map(f=>f.assembly))) {
        expect([...edgeCounts(faces.filter(f=>f.assembly===assembly)).values()].every(n=>n===2),assembly).toBe(true);
      }
      if(style!=='ducktail') {
        const wing=faces.filter(f=>f.part==='aero.wing').flatMap(f=>f.corners);
        for(const side of [-1,1]) {
          const points=faces.filter(f=>f.assembly===`spoiler.${side}.support`).flatMap(f=>f.corners);
          const bottom=Math.min(...points.map(p=>p[2])),top=Math.max(...points.map(p=>p[2]));
          expect(bottom).toBeLessThan(.65);
          expect(bottom).toBeGreaterThan(.63);
          expect(top).toBeGreaterThan(Math.min(...wing.map(p=>p[2])));
        }
      }
    }
    expect(spoilerAssembly({design,style:'none',quality:'game',deck,paint:'#af2632'})).toEqual([]);
  });
  it('replays composition recipes, supports independent choices, and keeps geometric detail inside each budget',()=>{
    for(const preset of ['razor','touring','endurance'])for(const quality of ['game','studio','hero']) {
      const c=composeSupercar({preset,seed:17,surface:{quality}});
      expect(c.census.triangles).toBeLessThanOrEqual(c.census.triangleBudget);
      expect(c.census.materialGroups).toBe(9);
      for(const f of Object.values(c.faces).flat()) {
        const [a,b,d]=f.corners,u=b.map((x,i)=>x-a[i]),v=d.map((x,i)=>x-a[i]);
        expect(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]),f.part).toBeGreaterThan(1e-9);
        for(const p of f.corners) {
          expect(p.every(Number.isFinite)).toBe(true);
          expect(Math.abs(p[0])).toBeLessThanOrEqual(c.design.frame.W/2+.001);
          expect(Math.abs(p[1])).toBeLessThanOrEqual(c.design.frame.L/2+.003);
          expect(p[2]).toBeGreaterThanOrEqual(-.001);
          expect(p[2]).toBeLessThanOrEqual(c.design.frame.H+.01);
        }
      }
    }
    const c=composeSupercar({preset:'razor',seed:1014,surface:{quality:'game',headlightStyle:'slim',cabinStyle:'teardrop',spoilerStyle:'ducktail'}});
    expect(composeSupercar(c.composition)).toEqual(c);
    expect(c.headlightStyle).toBe('slim');expect(c.cabinStyle).toBe('teardrop');expect(c.spoilerStyle).toBe('ducktail');
    const longCabin=composeSupercar({preset:'touring',surface:{quality:'game',ventStyle:'sideBlades'}});
    expect(longCabin.ventStyle).toBe('hoodLouvers');
    const clean=composeSupercar({preset:'strada',surface:{quality:'game',ventStyle:'none',spoilerStyle:'none'}});
    expect(Object.values(clean.faces).flat().some(f=>f.part.startsWith('vent.')||f.part==='aero.ducktail'||f.part==='aero.wing'||f.part==='aero.support')).toBe(false);
    expect(()=>composeSupercar({preset:'missing'})).toThrow(/preset/);
    expect(()=>composeSupercar({surface:{cabinStyle:'missing'}})).toThrow(/cabinStyle/);
    expect(()=>composeSupercar({surface:{ventStyle:'missing'}})).toThrow(/ventStyle/);
    expect(()=>composeSupercar({surface:{spoilerStyle:'missing'}})).toThrow(/spoilerStyle/);
  });
});
