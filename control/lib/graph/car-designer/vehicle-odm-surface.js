/**
 * Surface-patch compiler for the vehicle ODM.
 * Quad exterior geometry, material tags, shading normals and baked fallback colours.
 * Output matches Mojulo's { corners, fill, part } face vocabulary; +y forward.
 * This is a studio/display mesh, not a watertight manufacturing solid.
 */
import { solveSupercarDesign } from './vehicle-odm.js';
import { finishVehicleFaces, VEHICLE_MATERIALS, material } from './vehicle-surface-finish.js';
import { paintHex, liveryOf, applyLivery } from './vehicle-livery.js';
import { lampAssembly, mirrorAssembly, resolveHeadlightStyle, frontIntake } from './vehicle-details.js';
import { frontEnvelope } from './vehicle-front.js';
import { createCabinProfile } from './vehicle-cabin.js';
import { spoilerAssembly, resolveSpoilerStyle } from './vehicle-aero.js';
import { createCoolingLayout } from './vehicle-vents.js';

// Game samples spend more of the cross-body budget on the outer fender roll.
export const SUPERCAR_LODS = Object.freeze({
  game: Object.freeze({ longitudinal: 24, cross: 6, side: 4, arch: 16, wheel: 24, triangleBudget: 10000 }),
  studio: Object.freeze({ longitudinal: 40, cross: 12, side: 6, arch: 24, wheel: 40, triangleBudget: 22000 }),
  hero: Object.freeze({ longitudinal: 72, cross: 20, side: 10, arch: 40, wheel: 64, triangleBudget: 44000 }),
});

/** The streamlined line's sampling: a finer body (more stations along it and across it, rounder arches and wheels). */
export const STREAMLINE_LODS = Object.freeze({
  game: Object.freeze({ longitudinal: 34, cross: 8, side: 5, arch: 22, wheel: 30 }),
  studio: Object.freeze({ longitudinal: 56, cross: 14, side: 7, arch: 30, wheel: 48 }),
  hero: Object.freeze({ longitudinal: 96, cross: 22, side: 12, arch: 46, wheel: 72 }),
});
/** The streamlined line's ceilings: its aero kit, its wider tyres and its split spokes spend them. */
export const STREAMLINE_BUDGETS = Object.freeze({ game: 15000, studio: 32000, hero: 64000 });
export const SUPERCAR_LINES = Object.freeze(['classic','streamline']);

/** A livery's share over a quality's triangle ceiling: its cut lines. */
export const LIVERY_ALLOWANCE = 0.1;

const r4 = x => Math.round(x * 1e4) / 1e4;
const mix = (a,b,t) => a + (b-a)*t;
const HEX = Object.freeze({ glass:'#182d3d', rubber:'#15171b', rim:'#a5aab3', carbon:'#20252a', lamp:'#dbeafa', tail:'#a92129', seal:'#252c35', reflection:'#294553' });
const face=(corners,fill,part)=>({corners:corners.map(p=>p.map(r4)),fill,part});
const point=(x,y,z)=>[x,y,z];
const quad=(a,b,c,d,color,part)=>face([a,b,c,d],color,part);
// Tapered window ends are triangles. Subdivide them into three real quads
// instead of retaining a collapsed fourth corner at the windscreen foot.
function windowPatch(corners,color,part) {
  const points=corners.map(p=>p.map(r4));
  const unique=points.filter((p,i)=>points.findIndex(q=>q.every((v,j)=>v===p[j]))===i);
  if(unique.length!==3) return [face(points,color,part)];
  const center=unique[0].map((_,j)=>unique.reduce((sum,p)=>sum+p[j],0)/3);
  const midpoint=(a,b)=>a.map((v,j)=>(v+b[j])/2);
  return unique.map((p,i)=>quad(p,midpoint(p,unique[(i+1)%3]),center,
    midpoint(unique[(i+2)%3],p),color,part));
}
function section(stations,t) {
  let i=0; while (i<stations.length-2 && stations[i+1].t<t) i++;
  const a=stations[i], b=stations[i+1], q=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
  // Smoothed stations preserve the defining shoulder and arch volumes.
  const u=q*q*(3-2*q);
  return { halfWidth:mix(a.halfWidth,b.halfWidth,u), top:mix(a.zTop,b.zTop,u), bottom:mix(a.zBottom,b.zBottom,u) };
}
// `k` widens the tyre about its outer face (the streamlined line's staggered rubber, set inward under the arch);
// `split` pairs each spoke
function wheel(cx,cy,cz,r,side,quality,k=1,split=false,n=SUPERCAR_LODS[quality].wheel) {
  const out=[];
  const p=(axial,rad,theta)=>point(cx+side*(axial*k-(k-1)*0.32)*r,cy+rad*r*Math.cos(theta),cz+rad*r*Math.sin(theta));
  // Rounded tread shoulders and sidewalls, not a straight cylindrical tyre.
  const profile=[[-0.27,0.76],[-0.29,0.90],[-0.23,0.98],[-0.14,1],[0.14,1],[0.23,0.98],[0.29,0.90],[0.27,0.76]];
  const push=(f,axial=false)=>{
    if(axial) f.outNormal=[side,0,0];
    else {
      const center=f.corners[0].map((_,i)=>f.corners.reduce((s,p)=>s+p[i],0)/4);
      f.outNormal=[(center[0]-cx)*3,center[1]-cy,center[2]-cz];
    }
    out.push(f);
  };
  for(let j=0;j<n;j++) {
    const a=2*Math.PI*j/n,b=2*Math.PI*(j+1)/n;
    for(let k=0;k<profile.length-1;k++) {
      const [x0,r0]=profile[k],[x1,r1]=profile[k+1];
      push(quad(p(x0,r0,a),p(x0,r0,b),p(x1,r1,b),p(x1,r1,a),HEX.rubber,k===0||k===6?'sidewall':'tyre'));
    }
    // Bead, recessed rim barrel and brake rotor. Five spokes remain five at
    // every LOD, so changing tessellation never changes the wheel design.
    push(quad(p(0.27,0.76,a),p(0.27,0.76,b),p(0.30,0.69,b),p(0.30,0.69,a),HEX.rim,'rim.lip'),true);
    push(quad(p(0.30,0.69,a),p(0.30,0.69,b),p(0.13,0.66,b),p(0.13,0.66,a),HEX.carbon,'rim.barrel'));
    push(quad(p(0.11,0.61,a),p(0.11,0.61,b),p(0.11,0.16,b),p(0.11,0.16,a),'#747a80','wheel.brake'),true);
    // Circular hub to a small square centre: true quads without a collapsed fan.
    const square=t=>p(0.32,0.065/Math.max(Math.abs(Math.cos(t)),Math.abs(Math.sin(t))),t);
    push(quad(p(0.32,0.18,a),p(0.32,0.18,b),square(b),square(a),HEX.rim,'wheel.hub'),true);
  }
  const hp=(u,v)=>point(cx+side*r*0.32,cy+u*r,cz+v*r);
  push(quad(hp(-0.065,-0.065),hp(0.065,-0.065),hp(0.065,0.065),hp(-0.065,0.065),HEX.carbon,'wheel.hub'),true);
  for(let j=0;j<5;j++) {
    const a=2*Math.PI*j/5;
    if(split) for(const d of [-0.115,0.115]) push(quad(p(0.32,0.17,a+d*0.55-0.075),p(0.32,0.17,a+d*0.55+0.075),p(0.30,0.68,a+d+0.04),p(0.30,0.68,a+d-0.04),HEX.rim,'wheel.spoke'),true);
    else push(quad(p(0.32,0.17,a-0.16),p(0.32,0.17,a+0.16),p(0.30,0.68,a+0.075),p(0.30,0.68,a-0.075),HEX.rim,'wheel.spoke'),true);
  }
  return out;
}

/** Compile design or brief to viewable studio faces. */
export function compileSupercarSurface(brief={}, {quality='studio', paint='scarlet', livery, headlightStyle='auto', cabinStyle='auto', ventStyle='auto', spoilerStyle='auto', line='classic'}={}) {
  if (!['game','studio','hero'].includes(quality)) throw new Error('vehicle-odm: unknown surface quality');
  if (!SUPERCAR_LINES.includes(line)) throw new Error(`vehicle-odm: line is ${SUPERCAR_LINES.join(' or ')}`);
  // the streamlined line: fenders that flow over the wheels, an undercut sill, tight arches round wider tyres, an aero
  // kit, exhaust tips, calipers and a light bar (absent, the classic line, byte for byte)
  const S2=line==='streamline';
  const paintBase=paintHex(paint),scheme=liveryOf(livery,paint);
  const design=brief?.frame && brief?.topology ? brief : solveSupercarDesign(brief);
  if (!design.valid) throw new Error('vehicle-odm: design fails physical constraints');
  headlightStyle=resolveHeadlightStyle(headlightStyle,design.language);
  const {L,W,H,wheelRadius:r,track,groundClearance:clearance}=design.frame;
  const lod=S2?STREAMLINE_LODS[quality]:SUPERCAR_LODS[quality];
  const N=lod.longitudinal,bands=lod.cross,archSteps=lod.arch;
  const body=[],detail=[],wheels=[];
  const sts=design.topology.stations;
  const y=t=>L*(0.5-t);
  const wheelYs=[design.topology.anchors.wheelFL[1],design.topology.anchors.wheelRL[1]];
  const archLift=S2?0.045:0.07,archR=r+archLift;
  const front=frontEnvelope({frame:design.frame,language:design.language,frontWheelY:wheelYs[0],archRadius:archR});
  const cabinProfile=createCabinProfile(design,cabinStyle);
  cabinStyle=cabinProfile.style;
  const {start,end,peak,roofStart,roofEnd}=cabinProfile;
  const hoodStart=0.065,hoodEnd=start-0.018;
  const seam=0.007, seamT=seam/L;
  const doorStart=Math.max(start+0.008,(L/2-wheelYs[0]+archR*1.06)/L);
  const doorEnd=Math.min(end-0.012,(L/2-wheelYs[1]-archR*1.06)/L);
  const doorLow=0.16,doorHigh=0.94,seamH=0.014;
  const cooling=createCoolingLayout({style:ventStyle,design,doorEnd,hoodStart,hoodEnd,wheelYs,archRadius:archR});
  ventStyle=cooling.style;
  // The elliptical opening envelopes the round tyre down to the sill,
  // rather than deleting rectangular strips of the shoulder. Shared samples keep the arch and body connected.
  const archAngle=Math.PI/2;
  const panelCuts=[0,1,...front.samples,...cooling.cuts,...sts.map(s=>s.t),hoodStart,hoodStart+seamT,
    hoodEnd-seamT,hoodEnd,doorStart,doorStart+seamT,doorEnd-seamT,doorEnd];
  const samples=new Set(panelCuts);
  // Keep semantic boundaries exact when an LOD or arch sample falls nearby.
  const addSample=t=>{if(panelCuts.every(c=>Math.abs(c-t)>0.0001)) samples.add(t);};
  for(let i=0;i<=N;i++) addSample(i/N);
  for(const wy of wheelYs) for(let i=0;i<=archSteps;i++) {
    const theta=mix(-archAngle,archAngle,i/archSteps);
    addSample((L/2-wy-archR*Math.sin(theta))/L);
  }
  const ts=[...samples].filter(t=>t>=0&&t<=1).sort((a,b)=>a-b)
    .filter((t,i,a)=>!i||t-a[i-1]>0.0001);
  const archBottom=t=>Math.max(clearance,...wheelYs.map(wy=>{
    const d=Math.abs(y(t)-wy);
    return d<=archR ? clearance+(2*r+archLift-clearance)*Math.sqrt(Math.max(0,1-d*d/(archR*archR))) : clearance;
  }));
  const shoulder=t=>{
    const s=section(sts,t);
    const wheelInfluence=Math.max(...wheelYs.map(wy=>Math.exp(-Math.pow((y(t)-wy)/(r*(S2?2.5:1.7)),2))));
    // (streamlined: the shoulder a long line rising to the rear haunch, the fender a broad swell over its wheel)
    if(S2) return {
      width:mix(Math.max(s.halfWidth,W*0.34),W*0.49,wheelInfluence),
      z:Math.max(H*(0.40+0.17*Math.sin(Math.PI*Math.pow(t,0.8))),mix(H*0.40,2*r+0.085,wheelInfluence),archBottom(t)+0.035),
    };
    return {
      width:mix(Math.max(s.halfWidth,W*0.34),W*0.49,wheelInfluence),
      z:Math.max(H*(0.35+0.21*Math.sin(Math.PI*t)),mix(H*0.34,2*r+0.11,wheelInfluence),archBottom(t)+0.045),
    };
  };
  const deck=(t,x)=>{
    const s=shoulder(t);
    // (streamlined: the deck a wedge, low at the nose and rising through the cabin to the tail)
    const center=S2?H*(mix(0.345,0.40,t)+0.24*Math.sin(Math.PI*t)):H*(0.38+0.23*Math.sin(Math.PI*t));
    const q=Math.max(0,Math.min(1,(t-hoodStart)/(hoodEnd-hoodStart)));
    const crown=0.025*Math.sin(Math.PI*q)*Math.pow(Math.max(0,1-Math.abs(x)/(s.width*0.66)),2);
    return point(x,y(t),mix(center,s.z,Math.pow(Math.abs(x/s.width),2))+crown);
  };
  const paintColor=design.finish==='carbon'?HEX.carbon:paintBase;
  const hoodWidth=t=>mix(0.58,0.70,Math.max(0,Math.min(1,(t-hoodStart)/(hoodEnd-hoodStart))));
  const deckLanes=t=>{
    const u=hoodWidth(t),gap=seam/shoulder(t).width;
    return [-1,(-1-u-gap)/2,-u-gap,...Array.from({length:bands+1},(_,j)=>mix(-u,u,j/bands)),u+gap,(1+u+gap)/2,1];
  };
  const hoodPoint=(t,u)=>{
    const p=deck(t,shoulder(t).width*u);
    const inside=Math.max(0,Math.min(1,(t-hoodStart)/seamT,(hoodEnd-t)/seamT,
      (hoodWidth(t)+seam/shoulder(t).width-Math.abs(u))*shoulder(t).width/seam));
    p[2]-=inside*0.003;
    return p;
  };
  const sidePoint=(t,h,side,offset=0)=>{
    const s=shoulder(t);
    const inset=Math.max(0,Math.min(1,(t-doorStart)/seamT,(doorEnd-t)/seamT,
      (h-doorLow)/seamH,(doorHigh-h)/seamH))*0.003;
    // (streamlined: the sill tucked under a character line a third of the way up, the side above it full)
    if(S2) {const q=Math.min(1,h/0.32),u=q*q*(3-2*q);return point(side*(s.width*mix(0.945,1,u)+W*0.004*Math.sin(Math.PI*h)-inset+offset),y(t),mix(archBottom(t),s.z,h));}
    return point(side*(s.width*(h<0.55?mix(0.98,1,h/0.55):1)+W*0.006*Math.sin(Math.PI*h)-inset+offset),
      y(t),mix(archBottom(t),s.z,h));
  };
  const hoodVentPoint=(t,q,j,offset=0)=>{
    const lanes=deckLanes(t),u=mix(lanes[j],lanes[j+1],q),p=hoodPoint(t,u);
    p[2]+=offset;return p;
  };
  const doorCuts=[0,doorLow,doorLow+seamH,0.55,doorHigh-seamH,doorHigh,1];
  const doorBands=[...doorCuts,...Array.from({length:lod.side-1},(_,i)=>(i+1)/lod.side)
    .filter(h=>doorCuts.every(c=>Math.abs(c-h)>0.001))].sort((a,b)=>a-b);
  for(let i=0;i<ts.length-1;i++) {
    const a=ts[i],b=ts[i+1];
    const lanesA=deckLanes(a),lanesB=deckLanes(b),middle=(a+b)/2;
    for(let j=0;j<lanesA.length-1;j++) {
      const u=(lanesA[j]+lanesA[j+1])/2;
      const inHood=middle>hoodStart&&middle<hoodEnd;
      const lateralSeam=j===2||j===lanesA.length-4;
      const endSeam=middle<hoodStart+seamT||middle>hoodEnd-seamT;
      const hoodLane=j>=2&&j<=lanesA.length-4;
      const gap=inHood&&hoodLane&&(lateralSeam||endSeam);
      const hood=inHood&&!gap&&Math.abs(u)<hoodWidth(middle);
      const vent=(j===0||j===lanesA.length-2)?cooling.hoodCell({t0:a,t1:b,point:(t,q,offset)=>hoodVentPoint(t,q,j,offset)}):null;
      if(vent){body.push(...vent);continue;}
      body.push(quad(hoodPoint(a,lanesA[j]),hoodPoint(b,lanesB[j]),
        hoodPoint(b,lanesB[j+1]),hoodPoint(a,lanesA[j+1]),gap?HEX.seal:paintColor,
        gap?'body.deck.hood-seam':hood?'body.deck.hood':'body.deck'));
    }
    for(const side of [-1,1]) {
      const name=side<0?'port':'starboard';
      for(let j=0;j<doorBands.length-1;j++) {
        const lo=doorBands[j],hi=doorBands[j+1],h=(lo+hi)/2;
        const inDoor=middle>doorStart&&middle<doorEnd&&h>doorLow&&h<doorHigh;
        const gap=inDoor&&(middle<doorStart+seamT||middle>doorEnd-seamT||h<doorLow+seamH||h>doorHigh-seamH);
        const part=gap?`door.${name}.seam`:inDoor?`door.${name}.skin`:hi<=0.55?'body.sill':'body.shoulder';
        const vent=cooling.sideCell({t0:a,t1:b,h0:lo,h1:hi,point:(t,h,offset)=>sidePoint(t,h,side,offset)});
        if(vent){body.push(...vent);continue;}
        body.push(quad(sidePoint(a,lo,side),sidePoint(b,lo,side),sidePoint(b,hi,side),sidePoint(a,hi,side),gap?HEX.seal:paintColor,part));
      }
      const bottom=t=>sidePoint(t,0,side);
      // Recessed well closes the view through the wheel opening, without
      // covering the tyre. A radial clearance remains at every quality.
      if(wheelYs.some(wy=>Math.abs(y(middle)-wy)<archR*Math.sin(archAngle))) {
        const inner=(t)=>{
          const x=side*(track/2-r*(S2?0.62:0.30));
          return point(x,y(t),Math.min(archBottom(t),deck(t,x)[2]-0.12));
        };
        detail.push(quad(bottom(a),bottom(b),inner(b),inner(a),HEX.carbon,'wheel.well'));
      }
    }
  }
  for(const side of [-1,1])detail.push(...cooling.sideBlades((t,h,offset)=>sidePoint(t,h,side,offset)));
  for(const j of [0,deckLanes(0).length-2])detail.push(...cooling.hoodBlades((t,q,offset)=>hoodVentPoint(t,q,j,offset)));
  // End panels share the deck boundary; lamps sit on these panels, not on
  // guessed interior longitudinal stations that could leave them floating.
  for(const t of [0,1]) {
    const s=shoulder(t);
    const lanes=deckLanes(t);
    const fasciaRows=doorBands;
    const cap=(x,h)=>{
      const lane=x/s.width;
      const edge=sidePoint(t,h,1)[0]-s.width;
      return point(x+Math.sign(x)*edge*Math.pow(Math.abs(lane),3),y(t),mix(clearance,deck(t,x)[2],h));
    };
    for(let j=0;j<lanes.length-1;j++) for(let k=0;k<fasciaRows.length-1;k++) {
      const x0=s.width*lanes[j],x1=s.width*lanes[j+1],lo=fasciaRows[k],hi=fasciaRows[k+1];
      body.push(quad(cap(x0,lo),cap(x1,lo),cap(x1,hi),cap(x0,hi),paintColor,t===0?'body.nose':'body.tail'));
    }
    const panelY=y(t)+(t===0?0.003:-0.003);
    const vent=(x,z)=>point(x,panelY,z);
    if(t===0)detail.push(...frontIntake({width:s.width*0.43,y:y(t),z0:clearance+0.035,z1:s.z*0.49}));
    else detail.push(quad(vent(-s.width*0.43,clearance+0.035),vent(s.width*0.43,clearance+0.035),vent(s.width*0.34,s.z*0.49),vent(-s.width*0.34,s.z*0.49),HEX.carbon,'aero.diffuser'));
    // (streamlined: a light bar across the tail between the lamps, on the fascia as they are)
    if(S2&&t===1)detail.push({...quad(vent(-s.width*0.48,s.z*0.60),vent(s.width*0.48,s.z*0.60),vent(s.width*0.48,s.z*0.64),vent(-s.width*0.48,s.z*0.64),HEX.tail,'taillamp'),fasciaMount:true,mountOffset:0.004});
    for(const side of [-1,1]) {
      const x0=side*s.width*0.48,x1=side*s.width*0.89;
      // (the streamlined tail's corners stand higher than its middle: its lamps a little lower on it)
      const heights=t===1?(S2?[0.55,0.74]:[0.61,0.82]):headlightStyle==='round'?[0.38,0.88]:headlightStyle==='slim'?[0.71,0.86]:[0.56,0.88];
      // (a streamlined lamp's top kept under the deck at its own inner edge: its ends dip toward the middle)
      const z1=S2?Math.min(s.z*heights[1],deck(t,x0)[2]-0.02):s.z*heights[1],z0=S2?Math.max(clearance+0.08,Math.min(s.z*heights[0],z1-(s.z*(heights[1]-heights[0])))):s.z*heights[0];
      detail.push(...lampAssembly({x0,x1,y:y(t),z0,z1,
        rear:t===1,language:design.language,quality,style:headlightStyle}));
    }
  }
  // The cabin is an assembly: painted pillars, rubber seals, door glass,
  // rear quarter panes and separate front/rear screens. Its bottom follows
  // the actual crowned deck across the full width, with no floating edge.

  const pillarHalf=0.035/L,screenSeal=0.012/L;
  const cabinTs=[...new Set([start,start+screenSeal,roofStart-screenSeal,roofStart,
    peak,roofEnd,roofEnd+screenSeal,end-screenSeal,end,
    roofEnd-pillarHalf,roofEnd+pillarHalf,
    ...Array.from({length:bands+1},(_,i)=>mix(start,end,i/bands))])].sort((a,b)=>a-b)
    .filter((t,i,a)=>!i||t-a[i-1]>0.0001);
  const roofPoint=(t,u)=>cabinProfile.roofPoint(deck,t,u);
  const windowPoint=(t,h,side)=>cabinProfile.windowPoint(deck,t,h,side);
  const glazingLanes=[-1,-0.92,...Array.from({length:bands+1},(_,i)=>mix(-0.88,0.88,i/bands)),0.92,1];
  const windowBands=[0,0.045,0.09,0.88,0.94,1];
  for(let i=0;i<cabinTs.length-1;i++) {
    const a=cabinTs[i],b=cabinTs[i+1],t=(a+b)/2;
    const onRoof=t>=roofStart&&t<=roofEnd;
    const screenEdge=t<start+screenSeal||Math.abs(t-roofStart)<screenSeal||
      (t>roofEnd&&t<roofEnd+screenSeal)||t>end-screenSeal;
    for(let j=0;j<glazingLanes.length-1;j++) {
      const u=glazingLanes[j],v=glazingLanes[j+1],outer=Math.abs((u+v)/2);
      const pillar=!onRoof&&outer>0.92;
      const seal=!onRoof&&!pillar&&(outer>0.88||screenEdge);
      const color=onRoof?(design.finish==='twoTone'?HEX.carbon:paintColor):pillar?paintColor:seal?HEX.seal:HEX.glass;
      const part=onRoof?'body.roof':pillar?'cabin.pillar':seal?'cabin.screen-seal':t<roofStart?'glass.screen':'glass.rear';
      detail.push(quad(roofPoint(a,u),roofPoint(b,u),roofPoint(b,v),roofPoint(a,v),color,part));
    }
    for(const side of [-1,1]) for(let j=0;j<windowBands.length-1;j++) {
      const lo=windowBands[j],hi=windowBands[j+1],h=(lo+hi)/2;
      const pillar=Math.abs(t-roofEnd)<pillarHalf||t<start+screenSeal||t>end-screenSeal||h<0.045||h>0.94;
      const seal=!pillar&&(h<0.09||h>0.88);
      const color=pillar?paintColor:seal?HEX.seal:HEX.glass;
      const part=pillar?'cabin.pillar':seal?'cabin.window-seal':t>roofEnd?'glass.quarter':'glass.side';
      detail.push(...windowPatch([windowPoint(a,lo,side),windowPoint(b,lo,side),windowPoint(b,hi,side),windowPoint(a,hi,side)],color,part));
    }
  }
  for(const side of [-1,1]) {
    // Handles follow the actual recessed door, including its changing width.
    const t=doorEnd-0.030;
    const handle=(dt,h,offset)=>sidePoint(t+dt,h,side,offset);
    detail.push(quad(handle(-0.017,0.72,0.004),handle(0.017,0.72,0.004),handle(0.017,0.80,0.004),handle(-0.017,0.80,0.004),HEX.seal,'door.handle-pocket'));
    detail.push(quad(handle(-0.013,0.745,0.008),handle(0.013,0.745,0.008),handle(0.013,0.775,0.008),handle(-0.013,0.775,0.008),design.language==='grandTourer'?HEX.rim:HEX.carbon,'door.handle'));
    // A short stalk mounts the mirror at the base of the A pillar. Overall
    // width includes the housings, so mirrors stay inside the design envelope.
    const mt=mix(start,roofStart,0.40),yy=y(mt),mount=windowPoint(mt,0.18,side);
    const z=Math.max(mount[2]+0.02,shoulder(mt).z+0.045);
    const inner=side*W*0.400,outer=side*W*0.495;
    detail.push(...mirrorAssembly({side,inner,outer,y:yy,z,mount,paint:paintColor}));
  }
  for(const side of [-1,1]) {
    for(const wy of wheelYs) wheels.push(...wheel(side*track/2,wy,r,r,side,quality,S2?(wy===wheelYs[0]?1.22:1.45):1,S2,lod.wheel));
    if(S2)for(const wy of wheelYs)detail.push(...caliper(side*track/2,wy,r,side,wy===wheelYs[0]?1.22:1.45,design.language));
    // The dark sill insert is fitted onto the body between the wheel wells.
    const a=(L/2-wheelYs[0]+archR*1.1)/L,b=(L/2-wheelYs[1]-archR*1.1)/L;
    if(a<b) {
      const p=(t,h)=>sidePoint(t,h,side,0.003);
      detail.push(quad(p(a,0.12),p(b,0.12),p(b,0.38),p(a,0.31),HEX.carbon,'intake.side'));
    }
  }
  spoilerStyle=resolveSpoilerStyle(spoilerStyle,design);
  detail.push(...spoilerAssembly({design,style:spoilerStyle,quality,deck,paint:paintColor}));
  // Round fascia corners and bevel their top/bottom edges. Apply the same
  // deformation to lamps, seams and deck vertices so attachments stay fitted.
  // Tyres keep their exact circular profile and axle positions.
  const endPoint=p=>{
    const [x,yy,z]=p;
    if(yy>0)return front.deform(p,{noseWidth:shoulder(0).width,noseTop:deck(0,x)[2],clearance});
    const sign=-1,d=L/2-Math.abs(yy);
    const q=Math.max(0,Math.min(1,d/0.18)),weight=Math.pow(1-q*q,2);
    const top=deck(1,x)[2];
    const h=Math.max(0,Math.min(1,(z-clearance)/(top-clearance)));
    // (streamlined: a boat tail, its corners drawn in further and its edges rounder)
    const inset=(S2?0.16:0.10)*Math.pow(Math.abs(x)/(W/2),2)+(S2?0.06:0.035)*Math.pow(2*h-1,2);
    return point(x,r4(yy-sign*weight*inset),z);
  };
  const fittedEndParts=new Set(['headlamp','taillamp','intake.front','aero.diffuser']);
  const mounted=[];
  for(const f of detail) {
    if(!fittedEndParts.has(f.part)&&!f.fasciaMount) {mounted.push(f);continue;}
    const at=(u,v)=>f.corners[0].map((_,k)=>mix(mix(f.corners[0][k],f.corners[1][k],u),mix(f.corners[3][k],f.corners[2][k],u),v));
    const xs=f.corners.map(p=>p[0]),zs=f.corners.map(p=>p[2]);
    const nx=Math.max(1,Math.min(6,Math.ceil((Math.max(...xs)-Math.min(...xs))/0.075)));
    const nz=Math.max(1,Math.min(4,Math.ceil((Math.max(...zs)-Math.min(...zs))/0.04)));
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++) mounted.push({...f,...quad(at(i/nx,j/nz),at((i+1)/nx,j/nz),at((i+1)/nx,(j+1)/nz),at(i/nx,(j+1)/nz),f.fill,f.part)});
  }
  detail.splice(0,detail.length,...mounted);
  const shell=[...body,...detail].map(f=>({...f,corners:f.corners.map(endPoint)}));
  const caps=[1,-1].map(sign=>shell.filter(f=>f.part===(sign>0?'body.nose':'body.tail'))
    .flatMap(f=>[[f.corners[0],f.corners[1],f.corners[2]],[f.corners[0],f.corners[2],f.corners[3]]]));
  // Project the small lens/intake patches onto the actual triangulated fascia,
  // not only its analytic curve; mismatched triangulation otherwise clips them.
  const project=(p,offset,part)=>{
    const sign=p[1]>0?1:-1;
    for(const [a,b,c] of caps[sign>0?0:1]) {
      const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if(Math.abs(den)<1e-10)continue;
      const u=((b[2]-c[2])*(p[0]-c[0])+(c[0]-b[0])*(p[2]-c[2]))/den;
      const v=((c[2]-a[2])*(p[0]-c[0])+(a[0]-c[0])*(p[2]-c[2]))/den;
      if(u>=-0.0001&&v>=-0.0001&&u+v<=1.0001) return point(p[0],r4(u*a[1]+v*b[1]+(1-u-v)*c[1]+sign*offset),p[2]);
    }
    throw new Error(`vehicle-odm: ${part} leaves the fascia envelope${process.env.ODM_DEBUG ? ` at ${p}` : ""}`);
  };
  const conform=(f,depth=0)=>{
    if(!fittedEndParts.has(f.part)&&!f.fasciaMount)return [f];
    const offset=f.mountOffset??0.004;
    const corners=f.corners.map(p=>project(p,offset,f.part));
    const at=(u,v)=>corners[0].map((_,k)=>mix(mix(corners[0][k],corners[1][k],u),mix(corners[3][k],corners[2][k],u),v));
    const average=ids=>[0,1,2].map(k=>ids.reduce((sum,i)=>sum+corners[i][k],0)/ids.length);
    // Include the actual emitted triangle interiors and shared diagonal;
    // bilinear quad centres alone can miss a twisted patch cutting the body.
    const probes=[...[[0.5,0],[1,0.5],[0.5,1],[0,0.5]].map(([u,v])=>at(u,v)),average([0,1,2]),average([0,2,3]),average([0,2])];
    if(depth<3&&probes.some(p=>Math.abs(p[1]-project(p,offset,f.part)[1])>0.00135)) {
      return [[0,0],[0.5,0],[0,0.5],[0.5,0.5]].flatMap(([u,v])=>conform({...f,corners:[at(u,v),at(u+0.5,v),at(u+0.5,v+0.5),at(u,v+0.5)]},depth+1));
    }
    return [{...f,corners}];
  };
  const fittedDetail=shell.slice(body.length).flatMap(f=>conform(f));
  shell.splice(body.length,shell.length-body.length,...fittedDetail);
  // the streamlined line's aero kit and pipes, laid on the shell as it stands (its true nose and tail)
  if(S2)shell.push(...aeroKit({shell:shell.slice(0,body.length),W,clearance,quality,sidePoint,shoulder,L,wheelYs,archR}));
  // The livery cuts the shell at its pattern's planes and paints the pieces (absent, nothing is cut).
  const painted=f=>material(f)==='paint';
  const [bodyShell,detailShell]=[shell.slice(0,body.length),shell.slice(body.length)].map(fs=>applyLivery(fs,{paint:paintColor,livery:scheme,frame:design.frame,isPaint:painted}));
  const finished=finishVehicleFaces([...bodyShell,...detailShell,...wheels]);
  const faces={body:finished.slice(0,bodyShell.length),detail:finished.slice(bodyShell.length,bodyShell.length+detailShell.length),wheels:finished.slice(bodyShell.length+detailShell.length)};
  const triangles=finished.reduce((sum,f)=>sum+f.corners.length-2,0);
  // (a livery's lines are geometry: it has its own allowance over the quality's ceiling)
  const ceiling=S2?STREAMLINE_BUDGETS[quality]:lod.triangleBudget;
  const budget=scheme.pattern==='mono'?ceiling:Math.round(ceiling*(1+LIVERY_ALLOWANCE));
  if(triangles>budget) throw new Error(`vehicle-odm: ${quality} mesh exceeds ${budget} triangle budget (${triangles})`);
  const census={bodyFaces:bodyShell.length,detailFaces:detailShell.length,wheelFaces:wheels.length,totalFaces:finished.length,
    triangles,triangleBudget:budget,remainingTriangles:budget-triangles,
    trianglesByPart:finished.reduce((counts,f)=>{counts[f.part]=(counts[f.part]||0)+f.corners.length-2;return counts;},{}),
    materialGroups:new Set(finished.map(f=>f.material)).size,
    uniquePositions:new Set(finished.flatMap(f=>f.corners.map(p=>p.join(',')))).size};
  return {design,quality,headlightStyle,cabinStyle,ventStyle,spoilerStyle,...(S2?{line}:{}),...(scheme.pattern!=='mono'?{livery:scheme}:{}),faces,materials:VEHICLE_MATERIALS,census};
}

// a brake caliper on the trailing quarter of the rotor, between it and the spokes, in the language's colour
const CALIPER=Object.freeze({aeroWedge:'#c8102e',trackSpecial:'#e8b31c',grandTourer:'#3a3f47'});
function caliper(cx,cy,r,side,k,language) {
  const out=[],col=CALIPER[language]??CALIPER.aeroWedge,ax=(a)=>cx+side*(a*k-(k-1)*0.32)*r;
  const at=(a,rad,th)=>point(ax(a),cy+rad*r*Math.cos(th),r+rad*r*Math.sin(th));
  const th0=Math.PI*0.62,th1=Math.PI*0.88,a0=0.12,a1=0.22,r0=0.44,r1=0.63,n=3;
  for(let i=0;i<n;i++){
    const u=mix(th0,th1,i/n),v=mix(th0,th1,(i+1)/n);
    out.push(quad(at(a1,r0,u),at(a1,r0,v),at(a1,r1,v),at(a1,r1,u),col,'brake.caliper'));
    out.push(quad(at(a0,r1,u),at(a0,r1,v),at(a1,r1,v),at(a1,r1,u),col,'brake.caliper'));
    out.push(quad(at(a0,r0,u),at(a1,r0,u),at(a1,r0,v),at(a0,r0,v),col,'brake.caliper'));
  }
  for(const th of [th0,th1])out.push(quad(at(a0,r0,th),at(a1,r0,th),at(a1,r1,th),at(a0,r1,th),col,'brake.caliper'));
  return out;
}
// the streamlined aero kit on the shell's true ends: a splitter under the nose, a skirt along each sill, strakes in the
// diffuser, and the pipes where the figure's flames come out (supercar-figure.js: ±W·0.18, the clearance and 0.12)
function aeroKit({shell,W,clearance,quality,sidePoint,shoulder,L,wheelYs,archR}) {
  const out=[],ys=shell.flatMap(f=>f.corners.map(p=>p[1])),noseY=Math.max(...ys),tailY=Math.min(...ys);
  const box=(x0,x1,y0,y1,z0,z1,part)=>{
    const c=(x,y,z)=>point(x,y,z);
    out.push(quad(c(x0,y0,z1),c(x1,y0,z1),c(x1,y1,z1),c(x0,y1,z1),HEX.carbon,part));
    out.push(quad(c(x0,y1,z0),c(x1,y1,z0),c(x1,y0,z0),c(x0,y0,z0),HEX.carbon,part));
    out.push(quad(c(x0,y1,z0),c(x0,y1,z1),c(x1,y1,z1),c(x1,y1,z0),HEX.carbon,part));
    out.push(quad(c(x0,y0,z0),c(x1,y0,z0),c(x1,y0,z1),c(x0,y0,z1),HEX.carbon,part));
    out.push(quad(c(x0,y0,z0),c(x0,y0,z1),c(x0,y1,z1),c(x0,y1,z0),HEX.carbon,part));
    out.push(quad(c(x1,y0,z0),c(x1,y1,z0),c(x1,y1,z1),c(x1,y0,z1),HEX.carbon,part));
  };
  // the splitter: a blade standing proud of the nose's foot
  const sw=shoulder(0.03).width*0.78;
  box(-sw,sw,noseY-0.30,noseY+0.025,clearance-0.012,clearance+0.006,'aero.splitter');
  // the skirts: a blade along each sill between the arches
  const ta=(L/2-wheelYs[0]+archR*1.05)/L,tb=(L/2-wheelYs[1]-archR*1.05)/L,steps=quality==='game'?6:quality==='studio'?10:16;
  for(const side of [-1,1])for(let i=0;i<steps;i++){
    const a=mix(ta,tb,i/steps),b=mix(ta,tb,(i+1)/steps),lo=(t,o)=>sidePoint(t,0.02,side,o),hi=(t)=>sidePoint(t,0.10,side,0);
    const dn=(p)=>[p[0],p[1],p[2]-0.028];
    out.push(quad(hi(a),hi(b),lo(b,side*0.035),lo(a,side*0.035),HEX.carbon,'aero.skirt'));
    out.push(quad(lo(a,side*0.035),lo(b,side*0.035),dn(lo(b,side*0.035)),dn(lo(a,side*0.035)),HEX.carbon,'aero.skirt'));
  }
  // the diffuser's strakes: fins rising toward the tail
  for(const x of [-0.30,-0.14,0.14,0.30].map(u=>u*W))for(const [s0,s1] of [[x-0.007,x+0.007]]){
    const yF=tailY+0.30,yT=tailY+0.02,zb=clearance+0.004,c=(xx,yy,zz)=>point(xx,yy,zz);
    for(const xx of [s0,s1])out.push(quad(c(xx,yF,zb),c(xx,yT,zb),c(xx,yT,clearance+0.09),c(xx,yF,clearance+0.02),HEX.carbon,'aero.strake'));
    out.push(quad(c(s0,yF,clearance+0.02),c(s0,yT,clearance+0.09),c(s1,yT,clearance+0.09),c(s1,yF,clearance+0.02),HEX.carbon,'aero.strake'));
  }
  // the pipes: a polished tip proud of the tail and its dark bore
  const n={game:10,studio:16,hero:24}[quality],R=0.046,Ri=0.036,z=clearance+0.12;
  for(const x of [-1,1].map(s=>s*W*0.18))for(let i=0;i<n;i++){
    const a=2*Math.PI*i/n,b=2*Math.PI*(i+1)/n,ring=(rad,yy,t)=>point(x+rad*Math.cos(t),yy,z+rad*Math.sin(t));
    out.push(quad(ring(R,tailY+0.05,a),ring(R,tailY+0.05,b),ring(R,tailY-0.03,b),ring(R,tailY-0.03,a),HEX.rim,'exhaust.tip'));
    out.push(quad(ring(R,tailY-0.03,a),ring(R,tailY-0.03,b),ring(Ri,tailY-0.03,b),ring(Ri,tailY-0.03,a),HEX.rim,'exhaust.tip'));
    out.push(quad(ring(Ri,tailY-0.03,a),ring(Ri,tailY-0.03,b),ring(Ri,tailY+0.03,b),ring(Ri,tailY+0.03,a),HEX.seal,'exhaust.bore'));
  }
  return out;
}
