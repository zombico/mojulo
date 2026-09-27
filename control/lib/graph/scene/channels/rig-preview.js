import { safeJson } from '../emit-util.js';

// The RIG PREVIEW channel (rig-preview plan): a rigged solid's packed figure (station-loft-rig.js
// packLayeredRig, or any rig-bake output) playing one of its clips IN PLACE on the World page, so the
// eyes gate for rig work is the page the operator already looks at. Deliberately not the controllable
// stack (no entity, no AI, no camera rig) and not a walker (no path): one figure, standing where its
// solid stands, cycling a clip; a `<select>` in the corner switches clips or returns to the rest solid.
//
// It reuses the rig-bake data format (bones + rigid parts + pose-curve clips) and the page-level b64
// decoders, and carries its OWN compact bone poser — the frame-pair quaternion nlerp the walkers channel
// inlines, verbatim — so it never depends on the controllable or walkers blocks being emitted.
//
// While a clip plays, the static meshes of the figure's embodied group (`hide`, the same group the
// skinned export drops) are hidden so the animated figure does not stand inside a frozen ghost of
// itself; choosing "rest" shows the solid again and hides the rig.
//
// `?clip=<name>` selects the starting clip; else the first declared clip. `window.__mojRigPreview` is
// the probe seam (figure, clip, phase). Emitted only when a packed figure carries `preview`; a page
// without one is byte-identical.
export function rigPreviewChannelScript(previews, bank) {
  // rim (shader-look phase 4): a bank figure carrying `rim: [r,g,b,strength,power]` gets
  // ms-contrast's additive fresnel edge on every part material. The patch is DUPLICATED from the
  // controllable channel's __rimPatch by design — this channel never depends on the controllable
  // block being emitted. No rim anywhere ⇒ both interpolations are '' ⇒ byte-identical page.
  const hasRim = Object.values(bank || {}).some((f) => f && Array.isArray(f.rim));
  const rimBlock = hasRim ? `
const __rpRim = (m, rim) => {
  const prev = m.material.onBeforeCompile;
  m.material.onBeforeCompile = (sh) => {
    if (prev) prev(sh);
    sh.uniforms.uRim = { value: new THREE.Vector4(rim[0], rim[1], rim[2], rim[3]) };
    sh.uniforms.uRimP = { value: rim[4] };
    sh.vertexShader = 'varying vec3 vRimWp;\\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\\nvRimWp = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform vec4 uRim;\\nuniform float uRimP;\\nvarying vec3 vRimWp;\\n' + sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      'vec3 rN = normalize(cross(dFdx(vRimWp), dFdy(vRimWp)));\\n' +
      'vec3 rV = normalize(cameraPosition - vRimWp);\\n' +
      'if (dot(rN, rV) < 0.0) rN = -rN;\\n' +
      'float rF = pow(1.0 - max(dot(rN, rV), 0.0), uRimP);\\n' +
      'gl_FragColor.rgb += uRim.rgb * (uRim.a * rF);\\n' +
      '#include <dithering_fragment>');
  };
  m.material.needsUpdate = true;
};` : '';
  const rimHook = hasRim ? `
    if (Array.isArray(fig.rim)) __rpRim(mesh, fig.rim);` : '';
  return `
// ---- rig preview channel (a rigged solid playing its clips in place) ----
let stepRigPreview = () => {};
{
const RPREV = ${safeJson(previews)};
const RBANK = ${safeJson(bank)};${rimBlock}
const __rpONE = new THREE.Vector3(1, 1, 1);
const __rpq = new THREE.Quaternion(), __rph = new THREE.Vector3(), __rpv = new THREE.Vector3();
const __rpHead = [0, 0, 0];
function __rpBuild(fig) {
  const group = new THREE.Group();
  const boneMeshes = fig.bones.map((bn, bi) => {
    const part = fig.parts[bi];
    if (!part) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${rimHook}
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return { group, boneMeshes };
}
// one bone's [q, head'] from a clip at phase p — the frame-pair quaternion nlerp over the clip's sparse
// keys (wrapping), byte-for-byte the walkers / controllable runtime's math.
function __rpBone(fig, clip, p, bi, outQ, outP) {
  const nb = fig.bones.length, K = clip.k, B = clip.b;
  const kf = (((p % 1) + 1) % 1) * K;
  const i0 = Math.floor(kf) % K, i1 = (i0 + 1) % K, t = kf - Math.floor(kf);
  const o0 = (i0 * nb + bi) * 7, o1 = (i1 * nb + bi) * 7;
  const sgn = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
  outQ.set(B[o0] + (sgn * B[o1] - B[o0]) * t, B[o0 + 1] + (sgn * B[o1 + 1] - B[o0 + 1]) * t,
           B[o0 + 2] + (sgn * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (sgn * B[o1 + 3] - B[o0 + 3]) * t).normalize();
  outP[0] = B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t;
  outP[1] = B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t;
  outP[2] = B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t;
}
const __rpParam = new URLSearchParams(location.search).get('clip');
const __rpRigs = RPREV.map((pv, pi) => {
  const fig = RBANK[pv.figure];
  const rig = __rpBuild(fig);
  const names = (pv.clips || Object.keys(fig.clips)).filter((c) => fig.clips[c]);
  const state = { clip: names.includes(__rpParam) ? __rpParam : (__rpParam === 'rest' ? null : names[0] || null) };
  const hidden = [];
  if (pv.hide) scene.traverse((o) => { if (o.userData && o.userData.g === pv.hide && o.isMesh) hidden.push(o); });
  const sel = document.createElement('select');
  sel.style.cssText = 'position:fixed;left:12px;bottom:' + (12 + pi * 34) + 'px;z-index:30;font:12px/1.4 system-ui,sans-serif;background:rgba(14,16,20,.85);color:#e8ecf1;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 8px';
  for (const n of ['rest', ...names]) { const o = document.createElement('option'); o.value = n; o.textContent = n === 'rest' ? 'rest (the solid)' : 'clip: ' + n; sel.appendChild(o); }
  sel.value = state.clip || 'rest';
  sel.addEventListener('change', () => { state.clip = sel.value === 'rest' ? null : sel.value; });
  document.body.appendChild(sel);
  return { pv, fig, rig, hidden, state, period: pv.period > 0 ? pv.period : 3 };
});
window.__mojRigPreview = __rpRigs.map((r) => ({ figure: r.pv.figure, clip: r.state.clip, phase: 0 }));
stepRigPreview = (t) => {
  const sec = t / 1000;
  for (let ri = 0; ri < __rpRigs.length; ri++) {
    const r = __rpRigs[ri], fig = r.fig, playing = !!r.state.clip;
    r.rig.group.visible = playing;
    for (const o of r.hidden) o.visible = !playing;
    const probe = window.__mojRigPreview[ri]; probe.clip = r.state.clip;
    if (!playing) continue;
    const clip = fig.clips[r.state.clip];
    const phase = (sec / r.period) % 1;
    for (let bi = 0; bi < fig.bones.length; bi++) {
      const mesh = r.rig.boneMeshes[bi];
      if (!mesh) continue;
      __rpBone(fig, clip, phase, bi, __rpq, __rpHead);
      // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
      const rh = fig.bones[bi].head;
      __rph.set(rh[0], rh[1], rh[2]).applyQuaternion(__rpq);
      __rpv.set(__rpHead[0] - __rph.x, __rpHead[1] - __rph.y, __rpHead[2] - __rph.z);
      mesh.matrix.compose(__rpv, __rpq, __rpONE);
    }
    probe.phase = phase;
  }
};
}`;
}
