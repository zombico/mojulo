/** Small exterior assemblies: geometry and material-readable parts in metres. */
const mix=(a,b,t)=>a+(b-a)*t;
const rounded=p=>p.map(v=>Math.round(v*1e4)/1e4);
const quad=(a,b,c,d,fill,part,extra={})=>({corners:[a,b,c,d].map(rounded),fill,part,...extra});
const outline=[[0,0.18],[0.08,0],[0.92,0],[1,0.18],[1,0.82],[0.92,1],[0.08,1],[0,0.82]];
function cap(points,fill,part,extra={}) {
  const center=points[0].map((_,k)=>points.reduce((sum,p)=>sum+p[k],0)/points.length);
  return Array.from({length:points.length/2},(_,j)=>{const i=j*2;return quad(points[i],points[i+1],points[(i+2)%points.length],center,fill,part,extra);});
}

export const HEADLIGHT_STYLES=Object.freeze(['round','catEye','slim']);
export function resolveHeadlightStyle(style='auto',language='aeroWedge') {
  if(style==='auto')return {grandTourer:'round',aeroWedge:'catEye',trackSpecial:'slim'}[language];
  if(!HEADLIGHT_STYLES.includes(style))throw new Error('vehicle-odm: unknown headlightStyle');
  return style;
}

export function lampAssembly({x0,x1,y,z0,z1,rear=false,language='aeroWedge',quality='game',style='auto'}) {
  style=resolveHeadlightStyle(style,language);
  const faces=[],w=Math.abs(x1-x0),h=z1-z0;
  const segments={game:12,studio:16,hero:24}[quality];
  const point=(u,v)=>[mix(x0,x1,u),y,mix(z0,z1,v)];
  const mounted=offset=>({fasciaMount:true,mountOffset:offset});
  const contour=rear?outline:Array.from({length:segments},(_,i)=>{
    const theta=i*2*Math.PI/segments,c=Math.cos(theta),s=Math.sin(theta);
    if(style==='round') {
      const radius=Math.min(w,h)*0.48;
      return [0.5+radius*c/w,0.5+radius*s/h];
    }
    if(style==='catEye')return [0.5+0.5*c,0.5+0.40*s*Math.pow(Math.abs(s),0.6)+0.23*c];
    return [0.5+0.5*Math.sign(c)*Math.pow(Math.abs(c),0.55),0.5+0.48*Math.sign(s)*Math.pow(Math.abs(s),0.75)];
  });
  const ring=(sx,sy)=>contour.map(([u,v])=>point(0.5+(u-0.5)*sx,0.5+(v-0.5)*(!rear&&style==='round'?sx:sy)));
  const bands=[ring(1,1),ring(0.92,0.82),ring(0.88,0.72)];
  for(let i=0;i<contour.length;i++) {
    const j=(i+1)%contour.length;
    faces.push(quad(bands[0][i],bands[0][j],bands[1][j],bands[1][i],'#171d25','lamp.bezel',mounted(0.004)));
    faces.push(quad(bands[1][i],bands[1][j],bands[2][j],bands[2][i],'#080e15','lamp.seal',mounted(0.006)));
  }
  faces.push(...cap(bands[2],rear?'#32101a':'#101c29',rear?'lamp.rear.lens':'lamp.front.lens',mounted(0.007)));
  const strip=(part,u0,u1,v0,v1,color,depth=0.011)=>faces.push(quad(point(u0,v0),point(u1,v0),point(u1,v1),point(u0,v1),color,part,mounted(depth)));
  if(rear) {
    strip('taillamp',0.12,0.88,0.72,0.83,'#dc2838');
    strip('taillamp',0.12,0.78,0.20,0.29,'#ad182a');
    strip('lamp.reverse',0.12,0.25,0.43,0.59,'#bdcbd3');
    strip('lamp.indicator',0.80,0.90,0.41,0.61,'#d88d2d',0.010);
  } else {
    // Follow the actual lens contour. Round lamps have an annular running light;
    // the swept and slim families use only the upper contour as their signature.
    const drlOuter=ring(0.81,0.65),drlInner=ring(0.76,0.58);
    for(let i=0;i<contour.length;i++) {
      const j=(i+1)%contour.length;
      if(style==='round'||Math.sin((i+0.5)*2*Math.PI/segments)>0)
        faces.push(quad(drlOuter[i],drlOuter[j],drlInner[j],drlInner[i],'#dceaf5','headlamp',mounted(0.011)));
    }
    const radius=style==='round'?Math.min(w,h)*0.23:Math.min(0.023,h*0.17,w*0.08);
    const centers=style==='slim'?[0.36,0.60]:[0.48];
    for(const center of centers) {
      const v=style==='catEye'?0.48+0.46*(center-0.5):0.48;
      const at=(r,t)=>point(center+r*Math.cos(t)/w,v+r*Math.sin(t)/h);
      const optic=[];
      for(let i=0;i<segments;i++) {
        const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
        faces.push(quad(at(radius*1.24,a),at(radius*1.24,b),at(radius,b),at(radius,a),'#a4b4c2','lamp.reflector',mounted(0.009)));
        optic.push(at(radius,a));
      }
      const c=point(center,v);
      for(let i=0;i<segments;i+=2)faces.push(quad(optic[i],optic[i+1],optic[(i+2)%segments],c,'#bdd5ea','headlamp',mounted(0.010)));
    }
    if(style==='round')strip('lamp.indicator',0.44,0.56,0.22,0.27,'#d88d2d',0.010);
    else if(style==='catEye')strip('lamp.indicator',0.70,0.79,0.58,0.63,'#d88d2d',0.010);
    else strip('lamp.indicator',0.78,0.86,0.40,0.55,'#d88d2d',0.010);
  }
  return faces;
}

export function frontIntake({width,y,z0,z1}) {
  const profile=[[0,0.22],[0.10,0],[0.90,0],[1,0.22],[0.85,0.82],[0.75,1],[0.25,1],[0.15,0.82]];
  const point=(u,v)=>[mix(-width,width,u),y,mix(z0,z1,v)];
  const outer=profile.map(([u,v])=>point(u,v));
  const inner=profile.map(([u,v])=>point(0.5+(u-0.5)*0.94,0.5+(v-0.5)*0.76));
  const faces=[];
  for(let i=0;i<8;i++) {
    const j=(i+1)%8;
    faces.push(quad(outer[i],outer[j],inner[j],inner[i],'#303740','intake.front.lip',{fasciaMount:true,mountOffset:0.006}));
  }
  faces.push(...cap(inner,'#101720','intake.front',{fasciaMount:true,mountOffset:0.003}));
  // A narrow horizontal vane makes the opening readable at close range.
  faces.push(quad(point(0.20,0.44),point(0.80,0.44),point(0.80,0.49),point(0.20,0.49),'#3c4249','intake.front.vane',{fasciaMount:true,mountOffset:0.007}));
  return faces;
}

export function mirrorAssembly({side,inner,outer,y,z,mount,paint}) {
  const faces=[];
  const at=(u,v,dy)=>[mix(inner,outer,u),y+dy,z+0.09*v];
  const rim=outline.map(([u,v])=>at(u,v,-0.085));
  const front=outline.map(([u,v])=>at(0.5+(u-0.5)*0.80,0.58+(v-0.5)*0.76,0.095));
  const gasket=outline.map(([u,v])=>at(0.5+(u-0.5)*0.90,0.5+(v-0.5)*0.80,-0.088));
  const lens=outline.map(([u,v])=>at(0.5+(u-0.5)*0.84,0.5+(v-0.5)*0.68,-0.090));
  for(let i=0;i<8;i++) {
    const j=(i+1)%8,underside=(outline[i][1]+outline[j][1])/2<0.35;
    faces.push(quad(rim[i],rim[j],front[j],front[i],underside?'#20252a':paint,underside?'mirror.undershell':'mirror.housing'));
    faces.push(quad(rim[i],rim[j],gasket[j],gasket[i],paint,'mirror.rim'));
    faces.push(quad(gasket[i],gasket[j],lens[j],lens[i],'#101720','mirror.seal'));
  }
  faces.push(...cap(front,paint,'mirror.housing'));
  faces.push(...cap(lens,'#b6c5d1','mirror.glass'));
  faces.push(quad(at(0.34,0.40,0.097),at(0.83,0.40,0.097),at(0.83,0.51,0.097),at(0.34,0.51,0.097),'#d79b37','mirror.indicator'));
  // Rectangular stalk with a real underside; its outer end enters the pod.
  const a=mount,b=[inner+side*0.02,y,z+0.030];
  const ring=p=>[[p[0],p[1]-0.019,p[2]-0.010],[p[0],p[1]+0.019,p[2]-0.010],[p[0],p[1]+0.019,p[2]+0.010],[p[0],p[1]-0.019,p[2]+0.010]];
  const A=ring(a),B=ring(b);
  for(let i=0;i<4;i++)faces.push(quad(A[i],A[(i+1)%4],B[(i+1)%4],B[i],'#20252a','mirror.stalk'));
  faces.push(quad(...A,'#20252a','mirror.stalk'),quad(...B,'#20252a','mirror.stalk'));
  return faces;
}
