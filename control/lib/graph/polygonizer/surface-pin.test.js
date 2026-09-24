import { describe, it, expect } from 'vitest';
import { surfacePinFrame, placeSurfaceOffset, surfaceLocalOffset } from './surface-pin.js';
const surface={points:{a:[0,0,0],b:[2,0,0],c:[0,0,2]},faces:{brow:['a','b','c']}};
const pin={face:'brow',weights:[.2,.3,.5],tangentEdge:['a','b']};
describe('named surface pins',()=>{
 it('follows shape edits and is independent of map insertion order',()=>{
  const f=surfacePinFrame(surface,pin);expect(f.origin).toEqual([.6,0,1]);
  const edited={points:{c:[0,0,2],b:[4,0,0],a:[0,0,0]},faces:surface.faces};
  expect(surfacePinFrame(edited,pin).origin).toEqual([1.2,0,1]);
  expect(surfacePinFrame({...surface,points:{c:surface.points.c,a:surface.points.a,b:surface.points.b}},pin)).toEqual(f);
 });
 it('roundtrips offsets and explicitly mirrors frame handedness',()=>{
  for(const handedness of [1,-1]){
   const f=surfacePinFrame(surface,{...pin,handedness});
   const offset=[.2,-.1,.05];surfaceLocalOffset(f,placeSurfaceOffset(f,offset)).forEach((x,i)=>expect(x).toBeCloseTo(offset[i],12));
   expect(Math.hypot(...f.normal)).toBeCloseTo(1,12);
  }
 });
 it('rejects deleted anchors, bad weights, ambiguous tangent and degenerate faces',()=>{
  expect(()=>surfacePinFrame(surface,{...pin,face:'deleted'})).toThrow(/face/);
  expect(()=>surfacePinFrame(surface,{...pin,weights:[1,1,1]})).toThrow(/weights/);
  expect(()=>surfacePinFrame(surface,{...pin,tangentEdge:['a','missing']})).toThrow(/tangent/);
  expect(()=>surfacePinFrame({...surface,points:{a:[0,0,0],b:[0,0,0],c:[0,0,2]}},pin)).toThrow(/degenerate/);
 });
});
