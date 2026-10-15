/**
 * Surface-patch compiler for the vehicle ODM.
 * Pure geometry: quad body patches, dark glazing, wheels and optional aero.
 * Output matches Mojulo's { corners, fill, part } face vocabulary; +y forward.
 * This is a studio/display mesh, not a watertight manufacturing solid.
 */
import { solveSupercarDesign } from './vehicle-odm.js';

const r4 = x => Math.round(x * 1e4) / 1e4;
const mix = (a,b,t) => a + (b-a)*t;
const PAINTS = Object.freeze({
  scarlet: '#af2632', obsidian: '#1c2630', pearl: '#cdd4df',
  cobalt: '#1b559a', amber: '#c78928',
});
const HEX = Object.freeze({ glass:'#182d3d', rubber:'#15171b', rim:'#a5aab3', carbon:'#20252a', lamp:'#dbeafa', tail:'#a92129' });
const face=(corners,fill,part)=>({corners:corners.map(p=>p.map(r4)),fill,part});
const point=(x,y,z)=>[x,y,z];
const quad=(a,b,c,d,color,part)=>face([a,b,c,d],color,part);
function section(stations,t) {
  let i=0; while (i<stations.length-2 && stations[i+1].t<t) i++;
  const a=stations[i], b=stations[i+1], q=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
  // Smoothed stations preserve the defining shoulder and arch volumes.
  const u=q*q*(3-2*q);
  return { halfWidth:mix(a.halfWidth,b.halfWidth,u), top:mix(a.zTop,b.zTop,u), bottom:mix(a.zBottom,b.zBottom,u) };
}
function wheel(cx,cy,cz,r,side,quality) {
  const out=[], n=quality==='hero'?32:quality==='studio'?20:12;
  const half= r*0.27, x0=cx-side*half, x1=cx+side*half;
  for(let j=0;j<n;j++){
    const a=2*Math.PI*j/n,b=2*Math.PI*(j+1)/n;
    const p=(x,rad,theta)=>point(x,cy+rad*Math.cos(theta),cz+rad*Math.sin(theta));
    out.push(quad(p(x0,r,a),p(x0,r,b),p(x1,r,b),p(x1,r,a),HEX.rubber,'tyre'));
    out.push(quad(p(x1,r,a),p(x1,r,b),p(x1,r*0.64,b),p(x1,r*0.64,a),HEX.rubber,'sidewall'));
    out.push(quad(p(x1,r*0.63,a),p(x1,r*0.63,b),p(x1,r*0.21,b),p(x1,r*0.21,a),j%2?HEX.rim:HEX.carbon,'rim'));
  }
  return out;
}
/** Compile design or brief to viewable studio faces. */
export function compileSupercarSurface(brief={}, {quality='studio', paint='scarlet'}={}) {
  if (!['game','studio','hero'].includes(quality)) throw new Error('vehicle-odm: unknown surface quality');
  if (!(paint in PAINTS)) throw new Error('vehicle-odm: unknown paint');
  const design=brief?.frame && brief?.topology ? brief : solveSupercarDesign(brief);
  if (!design.valid) throw new Error('vehicle-odm: design fails physical constraints');
  const {L,W,H,wheelRadius:r,track}=design.frame;
  const N=quality==='hero'?72:quality==='studio'?40:20;
  const M=quality==='hero'?24:quality==='studio'?16:10;
  const surface=[],detail=[],wheels=[];
  const sts=design.topology.stations;
  const canopyStart=sts[2].t, canopyEnd=sts[4].t, canopyPeak=sts[3].t;
  const y=t=>L*(0.5-t);
  const profile=(t,theta)=>{
    const s=section(sts,t), c=Math.cos(theta), sn=Math.sin(theta);
    const bulge=1+0.045*Math.sin(Math.PI*t)*Math.pow(Math.abs(c),4);
    const x=s.halfWidth*Math.sign(c)*Math.pow(Math.abs(c),0.82)*bulge;
    const z=s.bottom+(s.top-s.bottom)*(0.5+0.5*sn);
    return point(x,y(t),z);
  };
  for(let i=0;i<N;i++) for(let j=0;j<M;j++){
    const a=i/N,b=(i+1)/N,u=2*Math.PI*j/M,v=2*Math.PI*(j+1)/M;
    // body patches have semantic part ids for future materials, LOD and attachment.
    const part='body.'+(j<M/2?'starboard':'port');
    // Wheel openings are negative space, not a painted layer over the tyre.
    // Cull patches on outer shoulders inside each wheel's swept envelope.
    // This is an intentionally faceted opening pending conformal patch remeshing.
    const tc=(a+b)/2, angle=(u+v)/2, z=profile(tc,angle)[2], yc=y(tc);
    const outer=Math.abs(Math.cos(angle))>0.62;
    const nearWheel=[design.topology.anchors.wheelFL[1],design.topology.anchors.wheelRL[1]]
      .some(wy=>Math.abs(yc-wy)<r*1.15 && z<r*2.12);
    if (outer && nearWheel) continue;
    surface.push(quad(profile(a,u),profile(b,u),profile(b,v),profile(a,v),PAINTS[paint],part));
  }
  // Raised teardrop canopy: transparent *looking* glass panels, no transparency required.
  const cabinW=W*0.31, roofZ=H*1.008;
  const C=quality==='hero'?28:quality==='studio'?16:8;
  for(let i=0;i<C;i++) {
    const t0=mix(canopyStart,canopyEnd,i/C),t1=mix(canopyStart,canopyEnd,(i+1)/C);
    const roof=(t)=> {
      const q=(t-canopyStart)/(canopyEnd-canopyStart);
      return H*0.68 + (roofZ-H*0.68)*Math.pow(Math.max(0,1-Math.abs(t-canopyPeak)/Math.max(canopyPeak-canopyStart,canopyEnd-canopyPeak)),0.7);
    };
    const w=(t)=>cabinW*(0.83+0.17*Math.sin(Math.PI*(t-canopyStart)/(canopyEnd-canopyStart)));
    detail.push(quad(point(-w(t0),y(t0),roof(t0)),point(-w(t1),y(t1),roof(t1)),point(w(t1),y(t1),roof(t1)),point(w(t0),y(t0),roof(t0)),HEX.glass,'glass.roof'));
    for(const side of [-1,1]) detail.push(quad(point(side*w(t0),y(t0),roof(t0)),point(side*w(t1),y(t1),roof(t1)),point(side*w(t1)*1.18,y(t1),H*0.59),point(side*w(t0)*1.18,y(t0),H*0.59),HEX.glass,'glass.side'));
  }
  for(const side of [-1,1]) {
    const x=side*(track/2);
    wheels.push(...wheel(x,design.topology.anchors.wheelFL[1],r,r,side,quality));
    wheels.push(...wheel(x,design.topology.anchors.wheelRL[1],r,r,side,quality));
    // Surface-safe side intake treatment: later pass can cut an actual duct.
    const tx=side*W*0.49;
    detail.push(quad(point(tx,y(0.60),H*0.29),point(tx,y(0.73),H*0.31),point(tx,y(0.70),H*0.52),point(tx,y(0.61),H*0.47),HEX.carbon,'intake.side'));
    detail.push(quad(point(side*W*0.25,y(0.025),H*0.38),point(side*W*0.44,y(0.025),H*0.38),point(side*W*0.44,y(0.025),H*0.44),point(side*W*0.25,y(0.025),H*0.44),HEX.lamp,'headlamp'));
    detail.push(quad(point(side*W*0.24,y(0.982),H*0.44),point(side*W*0.46,y(0.982),H*0.44),point(side*W*0.46,y(0.982),H*0.48),point(side*W*0.24,y(0.982),H*0.48),HEX.tail,'taillamp'));
  }
  if (design.topology.aero.wing!=='none') {
    const z=H*(design.topology.aero.wing==='fixed'?0.94:0.80), yy=y(0.93);
    detail.push(quad(point(-W*0.43,yy-0.07,z),point(W*0.43,yy-0.07,z),point(W*0.43,yy+0.13,z+0.025),point(-W*0.43,yy+0.13,z+0.025),HEX.carbon,'aero.wing'));
  }
  return { design, quality, faces:{body:surface, detail, wheels}, census:{bodyFaces:surface.length,detailFaces:detail.length,wheelFaces:wheels.length,totalFaces:surface.length+detail.length+wheels.length}};
}
