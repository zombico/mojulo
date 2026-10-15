/** Solid exterior aero assemblies. Shape vocabulary, not a performance model. */
const mix=(a,b,t)=>a+(b-a)*t;
const rounded=p=>p.map(v=>Math.round(v*1e4)/1e4);
const face=(a,b,c,d,part,fill='#20252a',extra={})=>({corners:[a,b,c,d].map(rounded),part,fill,...extra});
export const SPOILER_STYLES=Object.freeze(['none','ducktail','pedestal','swanNeck']);
export function resolveSpoilerStyle(style,design) {
  if(style==='auto')style=design.aero==='clean'?'none':design.aero==='track'?'swanNeck':design.language==='grandTourer'?'ducktail':'pedestal';
  if(!SPOILER_STYLES.includes(style))throw new Error('vehicle-odm: unknown spoilerStyle');
  return style;
}
function endCap(points,part,fill,extra={}) {
  if(points.length===4)return [face(...points,part,fill,extra)];
  const center=[0,1,2].map(k=>points.reduce((sum,p)=>sum+p[k],0)/points.length);
  return Array.from({length:points.length/2},(_,j)=>{const i=j*2;return face(points[i],points[i+1],points[(i+2)%points.length],center,part,fill,extra);});
}
function loft(rings,part,fill,extra={}) {
  const faces=[];
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<rings[j].length;i++) {
    const next=(i+1)%rings[j].length;
    faces.push(face(rings[j][i],rings[j+1][i],rings[j+1][next],rings[j][next],part,fill,extra));
  }
  faces.push(...endCap(rings[0],part,fill,extra),...endCap(rings.at(-1),part,fill,extra));
  return faces;
}
function prism(profile,halfWidth,part,fill,extra={}) {
  return loft([-1,1].map(side=>profile.map(([x,y,z])=>[x+side*halfWidth,y,z])),part,fill,extra);
}
function hookedSupport(path,assembly) {
  const rings=path.map((p,i)=>{
    const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];
    const dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dy,dz);
    const n=[-dz/length*0.010,dy/length*0.010];
    return [[p[0]-.012,p[1]+n[0],p[2]+n[1]],[p[0]+.012,p[1]+n[0],p[2]+n[1]],
      [p[0]+.012,p[1]-n[0],p[2]-n[1]],[p[0]-.012,p[1]-n[0],p[2]-n[1]]];
  });
  return loft(rings,'aero.support','#303740',{assembly});
}
export function spoilerAssembly({design,style='auto',quality='game',deck,paint}) {
  style=resolveSpoilerStyle(style,design);
  if(style==='none')return [];
  const {W,H,L}=design.frame;
  const segments={game:8,studio:12,hero:20}[quality];
  if(style==='ducktail') {
    const span=W*.36,rings=Array.from({length:segments+1},(_,i)=>{
      const x=mix(-span,span,i/segments),a=deck(.945,x),b=deck(.982,x);
      return [[x,a[1],a[2]+.003],[x,b[1],b[2]+.055],[x,b[1],b[2]-.003],[x,a[1],a[2]-.005]];
    });
    return loft(rings,'aero.ducktail',paint,{assembly:'spoiler.blade'});
  }
  const span=W*(style==='swanNeck'?.46:.42),centerY=L*(.5-.91);
  const centerZ=Math.max(H*(style==='swanNeck'?.79:.70),deck(.91,0)[2]+(style==='swanNeck'?.17:.11));
  const profile=[[0,0],[.08,.018],[.45,.026],[.92,.045],[1,.035],[.88,.018],[.45,-.010],[.08,-.012]];
  const wingPoint=(x,q,z)=>{
    const tip=Math.pow(Math.abs(x/span),2),chord=W*mix(.17,.125,tip);
    return [x,centerY-chord*(q-.45)-.07*tip,centerZ+.025*tip+z];
  };
  const rings=Array.from({length:segments+1},(_,i)=>{
    const x=mix(-span,span,i/segments);
    return profile.map(([q,z])=>wingPoint(x,q,z));
  });
  const faces=loft(rings,'aero.wing','#20252a',{assembly:'spoiler.blade'});
  for(const side of [-1,1]) {
    const x=side*span,front=wingPoint(x,0,0),rear=wingPoint(x,1,0),z=front[2];
    const fin=[[x,front[1]+.015,z-.02],[x,front[1],z+.035],[x,rear[1]+.035,z+.10],[x,rear[1]-.02,z+.075],
      [x,rear[1]-.02,z-.035],[x,rear[1]+.005,z-.055],[x,front[1]-.04,z-.055],[x,front[1]+.01,z-.04]];
    const plate=prism(fin,.006,'aero.endplate','#252c35',{assembly:`spoiler.${side}.endplate`});
    plate[1].part='aero.endplate.accent';plate[1].fill=paint;
    faces.push(...plate);
    const sx=side*W*.22,base=deck(.865,sx),tip=wingPoint(sx,.55,.018);
    if(style==='swanNeck') {
      base[2]-=.006;
      faces.push(...hookedSupport([base,[sx,tip[1]+.13,tip[2]+.09],[sx,tip[1]+.08,tip[2]+.115],
        [sx,tip[1]-.025,tip[2]+.095],[sx,tip[1]-.035,tip[2]]],`spoiler.${side}.support`));
    } else {
      const a=deck(.885,sx),b=deck(.915,sx),ta=wingPoint(sx,.30,-.003),tb=wingPoint(sx,.70,.004);
      a[2]-=.006;b[2]-=.006;
      faces.push(...prism([a,b,tb,ta],.013,'aero.support','#303740',{assembly:`spoiler.${side}.support`}));
    }
  }
  return faces;
}
