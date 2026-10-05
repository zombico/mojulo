import { b64, safeJson } from '../emit-util.js';
import { aquaPatchScript } from './aqua-glsl.js';

// In-page script: the translucent water sheet. A standalone mesh (NOT in the opaque face groups)
// whose colour attribute is 4-component, so three applies per-vertex alpha (USE_COLOR_ALPHA) —
// shallows read clear, deeps opaque. depthWrite:false + renderOrder 1 so it blends over the
// already-drawn opaque lakebed (depth-tested against terrain) without self-occluding.
export function waterMeshScript(wm) {
  return `
// --- translucent water sheet (per-vertex alpha) ---
{
  const pos = decodeF32(${safeJson(b64(wm.positions))});
  const col = decodeF32(${safeJson(b64(wm.colors))});
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 1;
  scene.add(m);
}`;
}

// In-page script: the LIQUID sheet — water faces that name a kind (`liquid: 'lake'`), shaded with the aqua look
// (channels/aqua-glsl.js): detail ripples tilt the flat sheet's normal, the sky reflects by Fresnel, the sun glints,
// and grazing water turns opaque the way a mirror does (alpha rises with F). The body colour and depth alpha are
// still the per-vertex RGBA the producer baked. Ripples ride window.__mojClock (pinned by capture frame()/step()).
export function liquidMeshScript(wm, look, toLight) {
  return `${aquaPatchScript()}
// --- liquid sheet (aqua look: ${look.kind}) ---
{
  const AQ = ${safeJson(look)};
  const pos = decodeF32(${safeJson(b64(wm.positions))});
  const col = decodeF32(${safeJson(b64(wm.colors))});
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const U = __aqPatch(mat, AQ, { sun: ${safeJson(toLight.map((v) => +(+v).toFixed(6)))}, up: true });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 1;
  __aqShared.meshes.push(m);
  m.onBeforeRender = () => { U.uAqTime.value = (window.__mojClock != null ? window.__mojClock : (typeof performance !== 'undefined' ? performance.now() : 0)) / 1000; };
  scene.add(m);
}`;
}
