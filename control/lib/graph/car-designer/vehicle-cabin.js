/** Shared cabin silhouette and glazing surface; metres, +y forward, z up. */
const clamp=x=>Math.max(0,Math.min(1,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=x=>{const q=clamp(x);return q*q*(3-2*q);};
export const CABIN_STYLES=Object.freeze(['wedge','teardrop','fastback']);
export function resolveCabinStyle(style,language) {
  if(style==='auto')style={aeroWedge:'wedge',grandTourer:'fastback',trackSpecial:'teardrop'}[language];
  if(!CABIN_STYLES.includes(style))throw new Error('vehicle-odm: unknown cabinStyle');
  return style;
}
function monotoneCurve(xs,ys) {
  const slopes=xs.slice(1).map((x,i)=>(ys[i+1]-ys[i])/(x-xs[i]));
  const tangents=xs.map((_,i)=>i===0?slopes[0]:i===xs.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2/(1/slopes[i-1]+1/slopes[i]));
  return t=>{
    let i=0;while(i<xs.length-2&&t>xs[i+1])i++;
    const span=xs[i+1]-xs[i],u=clamp((t-xs[i])/span),u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*ys[i]+(u3-2*u2+u)*span*tangents[i]+(-2*u3+3*u2)*ys[i+1]+(u3-u2)*span*tangents[i+1];
  };
}
export function createCabinProfile(design,style='auto') {
  style=resolveCabinStyle(style,design.language);
  const {W,H,L}=design.frame,sts=design.topology.stations;
  const peak=sts[3].t+(style==='wedge'?0.012:-0.008);
  const start=Math.min(sts[2].t-(style==='wedge'?0.025:0.018),peak-0.16);
  const end=sts[4].t+(style==='fastback'?0.035:style==='teardrop'?0.027:0.012);
  const roofStart=mix(start,peak,0.90),roofEnd=mix(peak,end,style==='fastback'?0.18:0.43);
  const height=monotoneCurve([start,roofStart,peak,roofEnd,end],[0,0.94,1,0.93,0]);
  const footWidth=t=>W*mix(0.32,style==='teardrop'?0.275:0.30,smooth((t-peak)/(end-peak)));
  const roofHeight=H*(style==='wedge'?0.96:style==='teardrop'?0.97:0.99);
  const roofPoint=(deck,t,u)=>{
    const q=height(t),foot=footWidth(t);
    const upper=W*mix(style==='fastback'?0.25:0.235,0.215,smooth((t-peak)/(end-peak)));
    const x=mix(foot,upper,q)*u;
    return [x,L*(0.5-t),mix(deck(t,x)[2],roofHeight-H*0.028*u*u,q)+0.003];
  };
  const windowPoint=(deck,t,h,side)=>{
    const bottom=deck(t,side*footWidth(t)),top=roofPoint(deck,t,side);
    bottom[2]+=0.003;
    const p=bottom.map((v,i)=>mix(v,top[i],h));
    p[0]+=side*0.006*Math.sin(Math.PI*h)*height(t);
    return p;
  };
  return {style,start,end,peak,roofStart,roofEnd,height,footWidth,roofPoint,windowPoint};
}
