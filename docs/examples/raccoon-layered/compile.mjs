import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { surfacePinFrame, placeSurfaceOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';
export const recipe=JSON.parse(readFileSync(new URL('./recipe.json',import.meta.url),'utf8'));
export function compile(input=recipe, {skullWidth=1,muzzleLength=1,details=true,creases=true}={}) {
 if (![skullWidth,muzzleLength].every(v=>Number.isFinite(v)&&v>=.7&&v<=1.35)) throw new Error('shape controls must be in [0.7,1.35]');
 const built={},pins={};
 for(const [name,part]of Object.entries(input.parts).sort(([a,x],[b,y])=>x.layer-y.layer||(a<b?-1:a>b?1:0))){
  if(part.layer>1&&!details)continue;
  const points={};
  if(part.layer===1){for(const [id,v]of Object.entries(part.points))points[id]=name==='skull'?[v[0]*skullWidth,v[1],v[2]]:[v[0],.1326+(v[1]-.1326)*muzzleLength,v[2]];}
  else{
   const parent=built[part.pin.parent];if(!parent)throw new Error(`missing parent ${part.pin.parent}`);
   if(parent.layer>=part.layer)throw new Error(`attachment ${name} must address a lower layer`);
   const frame=surfacePinFrame(parent,part.pin);pins[part.pin.id]={...frame,parent:part.pin.parent,face:part.pin.face};
   for(const [id,offset]of Object.entries(part.offsets))points[id]=placeSurfaceOffset(frame,offset);
  }
  built[name]={...part,points};
 }
 const vertices=[],pointIds=[],provenance=[],faces=[],faceIds=[],groups=[],index={};
 for(const [name,part]of Object.entries(built)){
  for(const [id,v]of Object.entries(part.points).sort(([a],[b])=>a<b?-1:a>b?1:0)){
   index[id]=vertices.length;pointIds.push(id);vertices.push(v);provenance.push({id,layer:part.layer,part:name,anchor:part.pin?.id??id});
  }
  for(const [id,f]of Object.entries(part.faces).sort(([a],[b])=>a<b?-1:a>b?1:0)){faceIds.push(id);faces.push(f.map(k=>{if(index[k]===undefined)throw new Error(`missing point ${k}`);return index[k];}));groups.push(part.groups[id]);}
 }
 const featureEdges=[],featureIds=[];
 if(creases)for(const [id,c]of Object.entries(input.creases)){
  const parent=built[c.parent];if(!parent)throw new Error(`missing crease parent ${c.parent}`);
  if(!Object.values(parent.faces).some(f=>c.edge.every(v=>f.includes(v))))throw new Error(`crease ${id} is not a shared surface edge`);
  featureEdges.push(c.edge.map(k=>index[k]));featureIds.push(id);
 }
 return {schema:'layered-head-compiled-v1',frame:input.frame,controls:{skullWidth,muzzleLength,details,creases},vertices,faces,groups,pointIds,faceIds,provenance,featureEdges,featureIds,pins,parts:built};
}
export function audit(mesh){
 const report={};
 for(const [name,p]of Object.entries(mesh.parts)){
  const edges=new Map();let degenerate=0;
  for(const f of Object.values(p.faces)){
   const [a,b,c]=f.map(k=>p.points[k]);const u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-a[k]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-12)degenerate++;
   for(let i=0;i<3;i++){const a=f[i],b=f[(i+1)%3],key=[a,b].sort().join('|');const e=edges.get(key)||{count:0,balance:0};e.count++;e.balance+=a<b?1:-1;edges.set(key,e);}
  }
  const boundary=[...edges].filter(([,e])=>e.count===1).map(([k])=>k).sort();const expected=(p.boundary||[]).map(e=>[...e].sort().join('|')).sort();
  const nonManifold=[...edges.values()].filter(e=>e.count>2).length;const windingErrors=[...edges.values()].filter(e=>e.count===2&&e.balance!==0).length;
  const boundaryValid=p.closure==='closed'?boundary.length===0:JSON.stringify(boundary)===JSON.stringify(expected);
  report[name]={layer:p.layer,closure:p.closure,boundaryEdges:boundary.length,boundaryValid,nonManifold,windingErrors,degenerate,pass:boundaryValid&&!nonManifold&&!windingErrors&&!degenerate};
 }
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv[2]||'baseline';const options=mode==='deformed'?{skullWidth:1.18,muzzleLength:1.3}:mode==='primary'?{details:false,creases:false}:{};
 if(!['baseline','deformed','primary'].includes(mode))throw new Error('unknown mode');
 const outDir=process.argv[3]?resolve(process.argv[3]):fileURLToPath(new URL('.',import.meta.url));
 const mesh=compile(recipe,options);writeFileSync(resolve(outDir,`${mode}.json`),JSON.stringify(mesh,null,2)+'\n');
 console.log(JSON.stringify(audit(mesh),null,2));
}
