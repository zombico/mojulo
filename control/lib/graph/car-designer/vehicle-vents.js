/** Recesses replace body cells; perimeter walls and louvres use their actual surfaces. */
const mix=(a,b,t)=>a+(b-a)*t;
const rounded=p=>p.map(v=>Math.round(v*1e4)/1e4);
const face=(corners,part,fill='#17202a')=>({corners:corners.map(rounded),part,fill});
export const VENT_STYLES=Object.freeze(['none','sideBlades','hoodLouvers']);
function recessedCell(outer,inner,boundaries,part) {
  const result=[face(inner,`${part}.throat`,'#0d141c')];
  for(const i of boundaries)result.push(face([outer[i],outer[(i+1)%4],inner[(i+1)%4],inner[i]],`${part}.lip`,'#343d48'));
  return result;
}
function blade(point,part) {
  const rings=[0,1].map(depth=>[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>point(u,v,depth)));
  const faces=[face(rings[0],part,'#59616c'),face(rings[1],part,'#303a46')];
  for(let i=0;i<4;i++)faces.push(face([rings[0][i],rings[0][(i+1)%4],rings[1][(i+1)%4],rings[1][i]],part,'#394653'));
  return faces;
}
export function createCoolingLayout({style='auto',design,doorEnd,hoodStart,hoodEnd,wheelYs,archRadius}) {
  const {L}=design.frame;
  if(style==='auto')style=design.topology.cooling==='front'?'hoodLouvers':'sideBlades';
  if(!VENT_STYLES.includes(style))throw new Error('vehicle-odm: unknown ventStyle');
  const sideA=doorEnd+.008,sideB=Math.min((L/2-wheelYs[1]-archRadius)/L-.006,sideA+.075);
  // A long-cabin architecture may leave no quarter-panel area for side ducts.
  if(style==='sideBlades'&&sideB-sideA<.02)style='hoodLouvers';
  const a=style==='sideBlades'?sideA:Math.max(hoodStart+.025,hoodEnd-.085);
  const b=style==='sideBlades'?sideB:hoodEnd-.025;
  const low=.55,high=.94;
  const sideInner=(point,t,h)=>point(mix(a+.008/L,b-.008/L,(t-a)/(b-a)),mix(low+.035,high-.035,(h-low)/(high-low)),-.042);
  const hoodInner=(point,t,q)=>point(mix(a+.008/L,b-.008/L,(t-a)/(b-a)),mix(.10,.90,q),-.025);
  return {
    style,cuts:style==='none'?[]:[a,b],range:[a,b],
    sideCell({t0,t1,h0,h1,point}) {
      if(style!=='sideBlades'||t0<a-1e-6||t1>b+1e-6||h0<low-1e-6||h1>high+1e-6)return null;
      const params=[[t0,h0],[t1,h0],[t1,h1],[t0,h1]],outer=params.map(([t,h])=>point(t,h,0)),inner=params.map(([t,h])=>sideInner(point,t,h));
      const boundaries=[];
      if(Math.abs(h0-low)<1e-6)boundaries.push(0);
      if(Math.abs(t1-b)<1e-6)boundaries.push(1);
      if(Math.abs(h1-high)<1e-6)boundaries.push(2);
      if(Math.abs(t0-a)<1e-6)boundaries.push(3);
      return recessedCell(outer,inner,boundaries,'vent.side');
    },
    hoodCell({t0,t1,point}) {
      if(style!=='hoodLouvers'||t0<a-1e-6||t1>b+1e-6)return null;
      const params=[[t0,0],[t1,0],[t1,1],[t0,1]],outer=params.map(([t,q])=>point(t,q,0)),inner=params.map(([t,q])=>hoodInner(point,t,q));
      const boundaries=[0,2];
      if(Math.abs(t0-a)<1e-6)boundaries.push(3);
      if(Math.abs(t1-b)<1e-6)boundaries.push(1);
      return recessedCell(outer,inner,boundaries,'vent.hood');
    },
    sideBlades(point) {
      if(style!=='sideBlades')return [];
      return [0.25,0.50,0.75].flatMap(s=>blade((u,v,d)=>{
        const t=mix(a,b,s)+(u-.5)*.018/L,h=mix(low+.055,high-.055,v);
        return point(t,h,-.010-.015*u-.003*d);
      },'vent.side.blade'));
    },
    hoodBlades(point) {
      if(style!=='hoodLouvers')return [];
      return [0.23,0.50,0.77].flatMap(s=>blade((u,v,d)=>{
        const t=mix(a,b,s)+(u-.5)*.020/L,q=mix(.15,.85,v);
        return point(t,q,-.004-.012*u-.003*d);
      },'vent.hood.blade'));
    },
  };
}
