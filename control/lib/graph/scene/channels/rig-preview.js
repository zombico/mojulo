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
//
// STAND (`solid: 'stand'` on a preview — the layered hero standing in its gesture): the static solid IS
// the stand, skinned exactly, so the page opens on it (not on the first clip's rigidly moved parts) and
// its entry reads 'stand (the solid)'. No preview carrying it ⇒ both interpolations are the old text.
//
// INK (`toonInk`, passed by the emitter only when a preview carries `ink` and the world draws the toon
// ink): the moving parts wear the outline themselves — each bone mesh gets the toon setup channel's
// `__inkBuild` pair as CHILDREN, so the hull poses with its bone — and the static pair registered under
// the hidden group (`__mojInk.reg[hide]`) hides with the static solid, instead of standing frozen around
// the animated figure. A part's hull takes its first `inkFaces` faces (the drawn features packed after
// them take none), pushed along the WINDING normals (a layered mesh winds outward — the static outline's
// normals are the same face normals). No `toonInk` ⇒ every interpolation below is '' ⇒ byte-identical.
//
// DRAW LAYERS (`layers`, passed by the emitter only on a page drawing them — channels/draw-layers.js): the static
// solid is split by layer (`body:hair`, `body:through`, `body:veil`), so the preview hides every `<hide>:*` group and
// outline with the solid; each part's fill takes the fill rule (`__layerFill`), and a part carrying `ranges` (the rig
// pack's [plain | hair | veil | marks | through] order, station-loft-rig characterRigParts) draws each span as a child
// mesh of its bone with that layer's rule and order — the moving brows show through the moving fringe — and outlines
// its plain, hair and veil spans as separate hulls, each with its layer's test (a moving lock's line never draws over
// hair). No `layers` ⇒ every interpolation below is its old text ⇒ byte-identical.
//
// OVERLAYS (a bank figure carrying `overlays: [{ bone, pos, col, faces, alpha, clips }]`, the bug rig's blurred wingbeat):
// see-through meshes riding a bone, shown only while one of their `clips` plays; a clip carrying `hide: [bone index]`
// hides those bones' meshes while it plays (the beating wings the fan stands for). Engine exports read neither. No
// figure carrying either ⇒ every interpolation below is '' ⇒ byte-identical.
//
// TIMING (a bank clip carrying `s`, its designed duration — the anime hero's, station-loft-rig packLayeredRig
// `seconds`): that clip plays one cycle over `s` seconds, the length the GLB and the Godot pack give it; a clip without
// one keeps the preview's period (3 s). No clip carrying `s` ⇒ the phase line is its old text ⇒ byte-identical.
export function rigPreviewChannelScript(previews, bank, { toonInk = null, layers = false } = {}) {
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
  const inkBlock = toonInk && layers ? `
const __RPINK = ${safeJson(toonInk)};
for (const pv of RPREV) if (pv.ink && RBANK[pv.figure]) RBANK[pv.figure].__rpInk = true;
function __rpInk(mesh, part, fig) {   // one part's outline, children of its bone mesh (they pose with it): a hull per draw layer
  const all = mesh.geometry.getAttribute('position').array;
  const n = Number.isInteger(part.inkFaces) ? part.inkFaces : all.length / 9, R = part.ranges || {};
  const r = fig.figH > 0 ? fig.figH / 2 : 1, q = Math.max(r * 1.5e-3, 1e-6);
  const width = __RPINK.widthAbs != null ? __RPINK.widthAbs : __RPINK.width * r;
  const spans = [[0, Math.min(n, R.hair ? R.hair[0] : n, R.veil ? R.veil[0] : n), null]];
  if (R.hair) spans.push([R.hair[0], R.hair[1], 'hair']);
  if (R.veil) spans.push([R.veil[0], R.veil[1], 'veil']);
  let inked = false;
  for (const [a, b, layer] of spans) {
    const pos = all.subarray(a * 9, b * 9);
    if (pos.length < 9) continue;
    const e = __inkBuild(pos, __inkGeoNormals(pos), width, __RPINK.crease, q, __RPINK.color);
    if (layer && __layerHull(e.hullMat, layer)) e.hull.renderOrder = 3;
    mesh.add(e.hull);${toonInk.lines === false ? '' : ' mesh.add(e.lines);'} inked = true;
  }
  if (inked) { mesh.material.polygonOffset = true; mesh.material.polygonOffsetFactor = 1; mesh.material.polygonOffsetUnits = 1; mesh.material.needsUpdate = true; }
}` : toonInk ? `
const __RPINK = ${safeJson(toonInk)};
for (const pv of RPREV) if (pv.ink && RBANK[pv.figure]) RBANK[pv.figure].__rpInk = true;
function __rpInk(mesh, part, fig) {   // one part's outline, a child of its bone mesh (poses with it)
  const all = mesh.geometry.getAttribute('position').array;
  const pos = Number.isInteger(part.inkFaces) ? all.subarray(0, part.inkFaces * 9) : all;
  if (pos.length < 9) return;
  const r = fig.figH > 0 ? fig.figH / 2 : 1, q = Math.max(r * 1.5e-3, 1e-6);
  const width = __RPINK.widthAbs != null ? __RPINK.widthAbs : __RPINK.width * r;
  const e = __inkBuild(pos, __inkGeoNormals(pos), width, __RPINK.crease, q, __RPINK.color);
  mesh.add(e.hull);${toonInk.lines === false ? '' : ' mesh.add(e.lines);'}
  mesh.material.polygonOffset = true; mesh.material.polygonOffsetFactor = 1; mesh.material.polygonOffsetUnits = 1; mesh.material.needsUpdate = true;
}` : '';
  const layerBlock = layers ? `
function __rpLayer(mesh, part, fig) {   // the draw layers on one part: its fill's rule; each span of its ranges a child mesh of the bone
  if (typeof __layerFill !== 'function') return;
  __layerFill(mesh.material, null);
  const R = part.ranges; if (!R) return;
  const F = part.faces, n = Number.isInteger(part.inkFaces) ? part.inkFaces : F;
  const span = (a, b, layer) => {
    if (!(b > a)) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', mesh.geometry.getAttribute('position')); g.setAttribute('color', mesh.geometry.getAttribute('color'));
    g.setDrawRange(a * 3, (b - a) * 3); g.boundingSphere = mesh.geometry.boundingSphere;
    const c = new THREE.Mesh(g, mesh.material.clone()); c.frustumCulled = false;
    const order = __layerFill(c.material, layer); if (order) c.renderOrder = order;${hasRim ? `
    if (Array.isArray(fig.rim)) __rpRim(c, fig.rim);` : ''}
    mesh.add(c);
  };
  // the bone mesh keeps the plain faces; the marks (between the outlined faces and the through faces) and each range are its children
  mesh.geometry.setDrawRange(0, Math.min(n, R.hair ? R.hair[0] : n, R.veil ? R.veil[0] : n) * 3);
  span(n, R.through ? R.through[0] : F, null);
  if (R.hair) span(R.hair[0], R.hair[1], 'hair');
  if (R.veil) span(R.veil[0], R.veil[1], 'veil');
  if (R.through) span(R.through[0], R.through[1], 'through');
}` : '';
  const timed = Object.values(bank || {}).some((f) => Object.values(f?.clips || {}).some((c) => c?.s > 0));
  const overlaid = Object.values(bank || {}).some((f) => (Array.isArray(f?.overlays) && f.overlays.length) || Object.values(f?.clips || {}).some((c) => Array.isArray(c?.hide)));
  const overlayBuild = overlaid ? `
  const overlays = (fig.overlays || []).map((o) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(o.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(o.col), 3, true));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: o.alpha, depthWrite: false }));
    mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
    group.add(mesh);
    return { mesh, bone: o.bone, clips: o.clips || [] };
  });` : '';
  const overlayRet = overlaid ? ', overlays' : '';
  const overlayStep = overlaid ? `
    const hideBones = Array.isArray(clip.hide) ? clip.hide : null;
    for (let bi = 0; bi < fig.bones.length; bi++) { const mesh = r.rig.boneMeshes[bi]; if (mesh) mesh.visible = !(hideBones && hideBones.includes(bi)); }
    for (const o of r.rig.overlays) { const on = o.clips.includes(r.state.clip); o.mesh.visible = on; if (!on) continue;
      __rpBone(fig, clip, phase, o.bone, __rpq, __rpHead); const rh = fig.bones[o.bone].head;
      __rph.set(rh[0], rh[1], rh[2]).applyQuaternion(__rpq); __rpv.set(__rpHead[0] - __rph.x, __rpHead[1] - __rph.y, __rpHead[2] - __rph.z);
      o.mesh.matrix.compose(__rpv, __rpq, __rpONE); }` : '';
  const stand = previews.some((pv) => pv && pv.solid === 'stand');
  const standStart = stand ? " || pv.solid === 'stand'" : '';
  const restLabel = stand ? "(pv.solid === 'stand' ? 'stand (the solid)' : 'rest (the solid)')" : "'rest (the solid)'";
  const inkHook = toonInk ? `
    if (fig.__rpInk && typeof __inkBuild === 'function') __rpInk(mesh, part, fig);` : '';
  const layerHook = layers ? `
    __rpLayer(mesh, part, fig);` : '';
  const inkHide = toonInk && layers ? `
  if (pv.ink && pv.hide && window.__mojInk) for (const k in window.__mojInk.reg) if (k === pv.hide || k.startsWith(pv.hide + ':')) { const e = window.__mojInk.reg[k]; hidden.push(e.hull, e.lines); }` : toonInk ? `
  if (pv.ink && pv.hide && window.__mojInk && window.__mojInk.reg[pv.hide]) { const e = window.__mojInk.reg[pv.hide]; hidden.push(e.hull, e.lines); }` : '';
  const hideTest = layers ? "(o.userData.g === pv.hide || String(o.userData.g).startsWith(pv.hide + ':'))" : 'o.userData.g === pv.hide';
  return `
// ---- rig preview channel (a rigged solid playing its clips in place) ----
let stepRigPreview = () => {};
{
const RPREV = ${safeJson(previews)};
const RBANK = ${safeJson(bank)};${rimBlock}${inkBlock}${layerBlock}
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
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${rimHook}${inkHook}${layerHook}
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });${overlayBuild}
  scene.add(group);
  return { group, boneMeshes${overlayRet} };
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
  const state = { clip: names.includes(__rpParam) ? __rpParam : (__rpParam === 'rest'${standStart} ? null : names[0] || null) };
  const hidden = [];
  if (pv.hide) scene.traverse((o) => { if (o.userData && ${hideTest} && o.isMesh) hidden.push(o); });${inkHide}
  const sel = document.createElement('select');
  sel.className = 'rig-preview';   // a capture-contract WORLD_HIDE_SELECTORS entry: live-only, baked out
  sel.style.cssText = 'position:fixed;left:12px;bottom:' + (12 + pi * 34) + 'px;z-index:30;font:12px/1.4 system-ui,sans-serif;background:rgba(14,16,20,.85);color:#e8ecf1;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 8px';
  for (const n of ['rest', ...names]) { const o = document.createElement('option'); o.value = n; o.textContent = n === 'rest' ? ${restLabel} : 'clip: ' + n; sel.appendChild(o); }
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
    const phase = (sec / ${timed ? '(clip.s > 0 ? clip.s : r.period)' : 'r.period'}) % 1;
    for (let bi = 0; bi < fig.bones.length; bi++) {
      const mesh = r.rig.boneMeshes[bi];
      if (!mesh) continue;
      __rpBone(fig, clip, phase, bi, __rpq, __rpHead);
      // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
      const rh = fig.bones[bi].head;
      __rph.set(rh[0], rh[1], rh[2]).applyQuaternion(__rpq);
      __rpv.set(__rpHead[0] - __rph.x, __rpHead[1] - __rph.y, __rpHead[2] - __rph.z);
      mesh.matrix.compose(__rpv, __rpq, __rpONE);
    }${overlayStep}
    probe.phase = phase;
  }
};
}`;
}
