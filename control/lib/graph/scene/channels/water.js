import { b64, safeJson } from '../emit-util.js';

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
