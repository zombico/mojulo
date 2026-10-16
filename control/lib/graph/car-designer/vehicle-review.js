/** Offline physically lit inspection of the same mesh used by the baked path. */
import { faceListToMesh } from '../figures/face-mesh.js';
import { inlineImportmap, safeJson, escapeHtml } from '../scene/emit-util.js';

// Index only vertices whose position, normal AND colour agree. Keep panel creases.
export function packVehicleReview(compiled) {
  const buckets=new Map();
  for(const f of Object.values(compiled.faces).flat()) {
    if(!buckets.has(f.material)) buckets.set(f.material,[]);
    const {cornerFills:_baked,...raw}=f;
    buckets.get(f.material).push({...raw,fill:f.albedo});
  }
  return [...buckets].map(([material,faces])=>{
    const mesh=faceListToMesh(faces,{decollide:false,withNormals:true});
    const positions=[],normals=[],colors=[],indices=[],lookup=new Map();
    for(let i=0;i<mesh.vertexCount;i++) {
      const p=Array.from(mesh.positions.slice(i*3,i*3+3)),n=Array.from(mesh.normals.slice(i*3,i*3+3)),c=Array.from(mesh.colors.slice(i*3,i*3+3));
      const key=[...p,...n,...c].map(v=>Math.round(v*1e5)).join(',');
      if(!lookup.has(key)) {lookup.set(key,positions.length/3);positions.push(...p);normals.push(...n);colors.push(...c);}
      indices.push(lookup.get(key));
    }
    return {material,positions,normals,colors,indices};
  });
}
export function vehicleReviewStats(compiled,groups=packVehicleReview(compiled)) {
  return {...compiled.census,
    triangles:groups.reduce((n,g)=>n+g.indices.length/3,0),
    gpuVertices:groups.reduce((n,g)=>n+g.positions.length/3,0),
    geometryBufferBytes:groups.reduce((n,g)=>n+(g.positions.length+g.normals.length+g.colors.length)*4+g.indices.length*(g.positions.length/3>65535?4:2),0),
    vehicleDrawCalls:groups.length};
}

export function emitVehicleReview(compiled,{title='Supercar material review',cameraPosition=[6,7,3.3],lookAt=[0,0,0.65],horizontalFov=42}={}) {
  const groups=packVehicleReview(compiled),stats=vehicleReviewStats(compiled,groups),triangles=stats.triangles;
  const payload={groups,materials:compiled.materials,cameraPosition,lookAt,horizontalFov,stats};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#c6ccd1}#wrap{width:100vw;height:100vh}canvas{display:block}aside{position:absolute;bottom:12px;left:14px;color:#263343;font:12px system-ui;background:#ffffffc9;padding:8px 10px;border-radius:5px;pointer-events:none}button{position:absolute;top:14px;right:14px;border:1px solid #7b8998;background:#ffffffdd;color:#263343;padding:8px 12px;border-radius:5px;cursor:pointer}</style>
<script type="importmap">${inlineImportmap()}</script></head><body><div id="wrap"></div><button id="wireframe" aria-pressed="false">Wireframe</button><aside>${escapeHtml(title)} · ${triangles.toLocaleString('en-US')} triangles · ${groups.length} material draws · drag to orbit</aside>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const DATA=${safeJson(payload)};
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.9;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.getElementById('wrap').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#c6ccd1');
const camera=new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(DATA.horizontalFov)/2)/(innerWidth/innerHeight))),innerWidth/innerHeight,0.05,100);
camera.up.set(0,0,1);camera.position.fromArray(DATA.cameraPosition);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.fromArray(DATA.lookAt);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=18;controls.maxPolarAngle=Math.PI*0.49;controls.update();
// Procedural studio reflection field: no HDR or other external assets.
const room=new THREE.Scene();room.background=new THREE.Color('#515e6d');
const walls=new THREE.Mesh(new THREE.BoxGeometry(30,30,20),new THREE.MeshBasicMaterial({color:'#6c7682',side:THREE.BackSide}));walls.position.z=5;room.add(walls);
for(const [x,y,z,sx,sy,rx] of [[-5,2,6,3,8,0],[4,1,8,2,10,0],[0,-7,4,7,4,Math.PI/2]]) {
 const card=new THREE.Mesh(new THREE.PlaneGeometry(sx,sy),new THREE.MeshBasicMaterial({color:new THREE.Color(3,3,3),side:THREE.DoubleSide}));card.position.set(x,y,z);card.rotation.x=rx;room.add(card);
}
const pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,0.04);scene.environment=env.texture;pmrem.dispose();
const ambient=new THREE.HemisphereLight('#dcecff','#53504a',0.55);ambient.position.set(0,0,1);scene.add(ambient);
const key=new THREE.DirectionalLight('#fff5e9',2.6);key.position.set(3,4,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.normalBias=0.015;key.shadow.bias=-0.0002;scene.add(key);
const fill=new THREE.DirectionalLight('#d6e5ff',0.65);fill.position.set(-4,-3,4);scene.add(fill);
const vehicleMeshes=[];
for(const g of DATA.groups) {
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(g.positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(g.colors,3));geo.setIndex(g.indices);
 const mat=new THREE.MeshPhysicalMaterial({...DATA.materials[g.material],vertexColors:true,side:THREE.DoubleSide,envMapIntensity:0.65});
 const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);vehicleMeshes.push(mesh);
}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:'#a6adb1',roughness:0.7}));floor.position.z=-0.012;floor.receiveShadow=true;scene.add(floor);
document.getElementById('wireframe').addEventListener('click',e=>{const on=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(on));for(const mesh of vehicleMeshes)mesh.material.wireframe=on;});
let frames=0;const errors=[];renderer.debug.onShaderError=(gl,program)=>{errors.push(gl.getProgramInfoLog(program));};
window.__supercarReview={stats:DATA.stats,errors,ready:false};
function draw(){controls.update();renderer.render(scene,camera);frames++;if(frames===3){renderer.shadowMap.autoUpdate=false;window.__supercarReview.ready=true;}window.__supercarReview.frame=frames;window.__supercarReview.renderInfo={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};requestAnimationFrame(draw);}draw();
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(DATA.horizontalFov)/2)/camera.aspect));camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
</script></body></html>`;
}
