import {describe,it,expect} from 'vitest';
import {frontEnvelope} from './vehicle-front.js';
import {solveSupercarDesign} from './vehicle-odm.js';
import {compileSupercarSurface} from './vehicle-odm-surface.js';
import {lampAssembly} from './vehicle-details.js';

const edgeKey=(a,b)=>[JSON.stringify(a),JSON.stringify(b)].sort().join('|');
const edges=faces=>new Set(faces.flatMap(f=>f.corners.map((p,i)=>edgeKey(p,f.corners[(i+1)%4]))));

describe('rolled nose and headlight families',()=>{
  it('rolls the nose without folding the loft or moving the wheel-opening region',()=>{
    for(const language of ['grandTourer','aeroWedge','trackSpecial']) {
      const d=solveSupercarDesign({seed:1014,language}),{L,W,H,groundClearance}=d.frame;
      const frontWheelY=d.topology.anchors.wheelFL[1],archRadius=d.frame.wheelRadius+0.07;
      const front=frontEnvelope({frame:d.frame,language,frontWheelY,archRadius});
      const params={noseWidth:W*0.36,noseTop:H*0.43,clearance:groundClearance};
      const lower=front.deform([0,L/2,groundClearance+0.28*(params.noseTop-groundClearance)],params);
      const upper=front.deform([0,L/2,params.noseTop],params);
      const corner=front.deform([params.noseWidth,L/2,params.noseTop],params);
      expect(lower[1]).toBeGreaterThan(upper[1]);
      expect(upper[1]).toBeGreaterThan(corner[1]);
      expect(upper[2]).toBeLessThan(params.noseTop);
      // A rounded four-decimal nose coordinate can lie 0.05 mm ahead of L/2.
      expect(front.deform([0,L/2+0.00005,params.noseTop],params)[1]).toBeLessThan(L/2);
      for(const h of [0,0.28,0.7,1])for(const x of [0,params.noseWidth]) {
        let previous=Infinity;
        for(let i=0;i<=40;i++) {
          const p=[x,L/2-front.run*i/40,groundClearance+h*(params.noseTop-groundClearance)];
          const q=front.deform(p,params);
          expect(q[1]).toBeLessThan(previous);
          previous=q[1];
        }
      }
      const wheelEdge=[W/2,frontWheelY+archRadius,H*0.5];
      expect(front.deform(wheelEdge,params)).toEqual(wheelEdge);
    }
  });
  it('joins the curved end caps to both body flanks at every LOD',()=>{
    for(const quality of ['game','studio','hero']) {
      const c=compileSupercarSurface({seed:1014},{quality});
      const flanks=edges(c.faces.body.filter(f=>['body.sill','body.shoulder'].includes(f.part)));
      for(const part of ['body.nose','body.tail']) {
        const capEdges=edges(c.faces.body.filter(f=>f.part===part));
        expect([...capEdges].filter(e=>flanks.has(e)).length,part).toBeGreaterThanOrEqual(8);
      }
    }
  });
  it('uses a circular round housing, an outward-swept cat eye, and a low slim housing',()=>{
    const make=(style,h)=>lampAssembly({x0:0,x1:0.32,y:2,z0:0,z1:h,style});
    const contour=faces=>faces.filter(f=>f.part==='lamp.bezel').map(f=>f.corners[0]);
    const round=contour(make('round',0.24));
    const radius=0.24*0.48;
    for(const p of round)expect(Math.hypot(p[0]-0.16,p[2]-0.12)).toBeCloseTo(radius,3);
    const cat=contour(make('catEye',0.16));
    const inside=cat.reduce((a,b)=>a[0]<b[0]?a:b),outside=cat.reduce((a,b)=>a[0]>b[0]?a:b);
    expect(outside[2]-inside[2]).toBeGreaterThan(0.06);
    const slim=contour(make('slim',0.06));
    const width=Math.max(...slim.map(p=>p[0]))-Math.min(...slim.map(p=>p[0]));
    const height=Math.max(...slim.map(p=>p[2]))-Math.min(...slim.map(p=>p[2]));
    expect(width/height).toBeGreaterThan(5);
  });
  it('allows independent headlight selection without changing the solved vehicle or exceeding game budget',()=>{
    const brief={seed:17,architecture:'frontEngine',language:'grandTourer'};
    const auto=compileSupercarSurface(brief,{quality:'game'});
    expect(auto.headlightStyle).toBe('round');
    for(const headlightStyle of ['round','catEye','slim']) {
      const c=compileSupercarSurface(brief,{quality:'game',headlightStyle});
      expect(c.design).toEqual(auto.design);
      expect(c.headlightStyle).toBe(headlightStyle);
      expect(c.census.triangles).toBeLessThanOrEqual(c.census.triangleBudget);
      expect(c.census.materialGroups).toBe(auto.census.materialGroups);
    }
    expect(()=>compileSupercarSurface(brief,{headlightStyle:'unknown'})).toThrow(/headlightStyle/);
  });
});
