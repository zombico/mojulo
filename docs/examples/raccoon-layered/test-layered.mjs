import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile, audit, recipe } from './compile.mjs';
import { surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';
const baseline=compile(),deformed=compile(recipe,{skullWidth:1.18,muzzleLength:1.3});
const close=(a,b,tol=1e-10)=>assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<tol,`${a} != ${b}`);
test('baseline exactly reproduces the imported head and all parts meet closure contracts',()=>{
 const old=JSON.parse(readFileSync(new URL('../raccoon-head-wire/head-source.json',import.meta.url)));
 for(const [i,id] of baseline.pointIds.entries())close(baseline.vertices[i],old.vertices[Number(id.split('point-')[1])]);
 for(const mesh of [baseline,deformed])assert.ok(Object.values(audit(mesh)).every(r=>r.pass));
});
test('details follow their named frames with unchanged local offsets',()=>{
 for(const [name,part] of Object.entries(recipe.parts))if(part.pin){
  for(const [id,offset]of Object.entries(part.offsets))close(surfaceLocalOffset(deformed.pins[part.pin.id],deformed.parts[name].points[id]),offset);
 }
 assert.ok(Math.abs(deformed.pins['eye.R/surface-pin'].origin[0])>Math.abs(baseline.pins['eye.R/surface-pin'].origin[0]));
 assert.ok(deformed.pins['nose/surface-pin'].origin[1]>baseline.pins['nose/surface-pin'].origin[1]);
});
test('mirrored details stay mirrored after a symmetric form edit',()=>{
 for(const mesh of [baseline,deformed])for(const family of ['eye','ear','ear-inset']){
  const left=Object.values(mesh.parts[family+'.L'].points);
  for(const p of Object.values(mesh.parts[family+'.R'].points))assert.ok(left.some(q=>Math.hypot(q[0]+p[0],q[1]-p[1],q[2]-p[2])<1e-9));
 }
});
test('IDs and output geometry survive property reorder; missing pins fail rather than rebind',()=>{
 const edited=structuredClone(recipe);edited.parts=Object.fromEntries(Object.entries(edited.parts).reverse());
 for(const part of Object.values(edited.parts))for(const key of ['points','offsets','faces'])if(part[key])part[key]=Object.fromEntries(Object.entries(part[key]).reverse());
 const reordered=compile(edited);assert.deepEqual(reordered.pointIds,baseline.pointIds);assert.deepEqual(reordered.vertices,baseline.vertices);assert.deepEqual(reordered.faces,baseline.faces);
 const broken=structuredClone(recipe);delete broken.parts.skull.faces[broken.parts['eye.R'].pin.face];assert.throws(()=>compile(broken),/face/);
});
test('detail and crease channels emit no geometry when disabled; L1 is unchanged',()=>{
 const primary=compile(recipe,{details:false,creases:false});assert.deepEqual(Object.keys(primary.parts),['muzzle','skull']);assert.deepEqual(primary.pins,{});assert.deepEqual(primary.featureEdges,[]);
 for(const part of ['skull','muzzle'])assert.deepEqual(primary.parts[part].points,baseline.parts[part].points);
 assert.deepEqual(compile(recipe,{creases:false}).vertices,baseline.vertices);
 assert.deepEqual(compile(recipe,{creases:false}).faces,baseline.faces);
 for(const [i,edge]of baseline.featureEdges.entries())assert.equal(edge.length,2);
});

test('attachments cannot address their own or a higher layer',()=>{
 const invalid=structuredClone(recipe);invalid.parts['eye.R'].pin.parent='ear.R';assert.throws(()=>compile(invalid),/lower layer/);
});
