import { sampleWaveField } from '../../../lib/graph/polygonizer/wave-field.js';
export function makeWaveGround(n=33) {
  const corners=[{x:-6,y:-6,z:0},{x:6,y:-6,z:0},{x:6,y:6,z:0},{x:-6,y:6,z:0}];
  const spec={samples:{u:n-1,v:n-1},displacement:{x:0,y:0,z:1}};
  function sample(phase){return sampleWaveField({...spec,waves:[{amplitude:1,cycles:{u:1,v:0},phase},{amplitude:0.65,cycles:{u:0,v:1},phase:phase+0.9}]},{gravity:{x:0,y:0,z:-1}},corners).gridPoints}
  const a=sample(0),b=sample(Math.PI/2);
  // Match layer row-major indexing: x = u, y = v.
  const basis0=[],basis90=[];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){basis0.push(a[x][y].z);basis90.push(b[x][y].z)}
  return {n,spacing:12/(n-1),basis0,basis90,corners,spec};
}
export function waveHeights(data,amplitude=1,phase=0){return data.basis0.map((h,i)=>amplitude*(h*Math.cos(phase)+data.basis90[i]*Math.sin(phase)))}
