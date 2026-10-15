/** Engine-neutral material tags, crease-aware normals and baked fallback colours. */
export const VEHICLE_MATERIALS = Object.freeze({
  paint: Object.freeze({ metalness: 0.22, roughness: 0.27, clearcoat: 1, clearcoatRoughness: 0.12 }),
  glass: Object.freeze({ metalness: 0.08, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06 }),
  rubber: Object.freeze({ metalness: 0, roughness: 0.88 }),
  alloy: Object.freeze({ metalness: 0.88, roughness: 0.23 }),
  brake: Object.freeze({ metalness: 0.65, roughness: 0.55 }),
  carbon: Object.freeze({ metalness: 0.08, roughness: 0.42, clearcoat: 0.35 }),
  seal: Object.freeze({ metalness: 0, roughness: 0.9 }),
  lamp: Object.freeze({ metalness: 0, roughness: 0.2, emissive: '#dbeafa', emissiveIntensity: 0.6 }),
  tail: Object.freeze({ metalness: 0, roughness: 0.24, emissive: '#a92129', emissiveIntensity: 0.35 }),
});
const unit=n=>{const d=Math.hypot(...n)||1;return n.map(v=>v/d);};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function normal(f) {
  if(f.outNormal) return unit(f.outNormal);
  const n=[0,0,0],c=f.corners;
  for(let i=0;i<c.length;i++) {
    const a=c[i],b=c[(i+1)%c.length];
    n[0]+=(a[1]-b[1])*(a[2]+b[2]);
    n[1]+=(a[2]-b[2])*(a[0]+b[0]);
    n[2]+=(a[0]-b[0])*(a[1]+b[1]);
  }
  const center=c[0].map((_,i)=>c.reduce((s,p)=>s+p[i],0)/c.length);
  const top=f.part.startsWith('body.deck')||['body.roof','glass.screen','glass.rear'].includes(f.part);
  const outward=top?n[2]:dot(n,[center[0],center[1],center[2]-0.4]);
  return unit(outward<0?n.map(v=>-v):n);
}
/** A face's material, by its part. */
export function material(f) {
  if(f.part==='aero.ducktail'||f.part==='aero.endplate.accent')return 'paint';
  if(f.part==='headlamp'||f.part==='lamp.reverse') return 'lamp';
  if(f.part==='lamp.reflector'||f.part==='mirror.glass')return 'alloy';
  if(/^(lamp\.(front|rear)\.lens|lamp.indicator|mirror.indicator)$/.test(f.part))return 'glass';
  if(f.part==='lamp.bezel'||f.part==='mirror.undershell')return 'carbon';
  if(f.part==='taillamp') return 'tail';
  if(/^glass\./.test(f.part)) return 'glass';
  if(/^(tyre|sidewall)$/.test(f.part)) return 'rubber';
  if(/^(rim|wheel.spoke|wheel.hub)/.test(f.part)) return 'alloy';
  if(f.part==='wheel.brake') return 'brake';
  if(/seam|seal|handle-pocket/.test(f.part)) return 'seal';
  if(/^(intake|vent|aero|wheel.well|mirror.stalk)/.test(f.part)) return 'carbon';
  return 'paint';
}
function shade(hex,n) {
  const k=0.64+0.42*Math.max(0,dot(n,[0.35,0.25,0.902]));
  return '#'+hex.slice(1).match(/../g).map(h=>Math.min(255,Math.round(parseInt(h,16)*k)).toString(16).padStart(2,'0')).join('');
}
/** Smooth only coincident vertices with compatible normals/materials; retain panel creases. */
export function finishVehicleFaces(faces) {
  const normals=faces.map(normal),materials=faces.map(material),vertices=new Map();
  const key=(i,p)=>materials[i]+':'+p.join(',');
  for(let i=0;i<faces.length;i++) for(const p of faces[i].corners) {
    const k=key(i,p);if(!vertices.has(k)) vertices.set(k,[]);vertices.get(k).push(i);
  }
  const crease=Math.cos(45*Math.PI/180);
  return faces.map((f,i)=>{
    const cornerNormals=f.corners.map(p=>{
      const neighbors=vertices.get(key(i,p)).filter(j=>dot(normals[i],normals[j])>crease);
      return unit(neighbors.reduce((sum,j)=>sum.map((v,k)=>v+normals[j][k]),[0,0,0]));
    });
    const emissive=['lamp','tail'].includes(materials[i]);
    return {...f,albedo:f.fill,material:materials[i],outNormal:normals[i],cornerNormals,
      fill:emissive?f.fill:shade(f.fill,normals[i]),
      cornerFills:cornerNormals.map(n=>emissive?f.fill:shade(f.fill,n))};
  });
}
