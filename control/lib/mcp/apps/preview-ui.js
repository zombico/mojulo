import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const view = document.querySelector('#view'), status = document.querySelector('#status');
const label = document.querySelector('#label'), refresh = document.querySelector('#refresh');
const reset = document.querySelector('#reset');
let ref, revision, model, camera, controls, renderer, scene, requestId = 0, generation = 0;
const pending = new Map();
const notify = (method, params) => parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
function request(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Host request timed out. Try again.')); }, 60000);
    pending.set(id, { resolve, reject, timer });
    parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}
function dispose(root) {
  const textures = new Set(), materials = new Set();
  root?.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) materials.add(m); });
  for (const m of materials) { for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); m.dispose(); }
  for (const t of textures) { t.source?.data?.close?.(); t.dispose(); }
}
function frameModel() {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, .1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1, .7, 1).normalize().multiplyScalar(radius * 3));
  camera.near = radius / 1000; camera.far = radius * 100; camera.updateProjectionMatrix(); controls.update();
}
function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#111820');
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', '3D mesh; drag to orbit, scroll to zoom');
  view.append(renderer.domElement); scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, .01, 10000);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.listenToKeyEvents(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 2));
  const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 5, 4); scene.add(light);
  new ResizeObserver(() => { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(view);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
}
async function show(result) {
  if (result?.isError) throw new Error(result.content?.find(c => c.type === 'text')?.text || 'Preview failed');
  const data = result?._meta?.['mojulo/preview'];
  if (!data) return;
  if (typeof data.ref !== 'string' || typeof data.glb !== 'string' || data.glb.length > 12 * 1024 * 1024) throw new Error('Invalid preview payload');
  if (revision === data.revision && ref === data.ref) { status.textContent = 'Current · Drag to orbit, scroll to zoom'; return; }
  const ticket = ++generation;
  const bytes = Uint8Array.from(atob(data.glb), c => c.charCodeAt(0));
  // The server supplies its own GLB. Forbid external resources even if a host sends other data.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => { if (!url.startsWith('blob:') && !url.startsWith('data:')) throw new Error('External preview assets are not allowed'); return url; });
  const gltf = await new GLTFLoader(manager).parseAsync(bytes.buffer, '');
  if (ticket !== generation) { dispose(gltf.scene); return; }
  if (!renderer) setup();
  const sameRef = ref === data.ref;
  if (model) { scene.remove(model); dispose(model); }
  model = gltf.scene; scene.add(model); ref = data.ref; revision = data.revision;
  label.textContent = data.title || data.ref;
  if (!sameRef) frameModel();
  refresh.disabled = false; reset.disabled = false;
  status.textContent = 'Drag to orbit, scroll to zoom · Mesh snapshot';
}
const fail = error => { status.textContent = error?.message || 'Preview unavailable. Use the exported files.'; };
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.jsonrpc !== '2.0') return;
  const message = event.data;
  if (message.id !== undefined && pending.has(message.id)) {
    const p = pending.get(message.id); clearTimeout(p.timer); pending.delete(message.id);
    if (message.error) p.reject(new Error(message.error.message)); else p.resolve(message.result);
  } else if (message.method === 'ui/notifications/tool-result') show(message.params).catch(fail);
});
const ready = request('ui/initialize', { appInfo: { name: 'mojulo-preview', version: '0.1.0' }, appCapabilities: {}, protocolVersion: '2026-01-26' })
  .then(() => { notify('ui/notifications/initialized', {}); notify('ui/notifications/size-changed', { height: 500 }); });
ready.catch(fail);
refresh.addEventListener('click', async () => {
  refresh.disabled = true; status.textContent = 'Refreshing…';
  const requestedRef = ref, requestedGeneration = generation;
  try {
    await ready;
    const result = await request('tools/call', { name: 'preview_world', arguments: { ref: requestedRef } });
    if (ref === requestedRef && generation === requestedGeneration) await show(result);
  }
  catch (error) { fail(error); }
  finally { refresh.disabled = !ref; }
});
reset.addEventListener('click', frameModel);
