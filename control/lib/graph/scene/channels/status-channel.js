import { safeJson } from '../emit-util.js';
import { ELEMENTS, elementMotifs } from '../../playscape/elements/elements.js';
import { FIRE_COLORANTS } from '../../fire/fire.js';

/**
 * status-channel — the page's side of the cast's STATUSES (playscape/elements): each element a character carries
 * (e.statuses, held by the character world, put on and lifted by the bus) is drawn on its body as it moves:
 *
 *   the FRESNEL COAT   a second draw of each of the body's meshes (the toon ink hull's idiom: the same triangles, a
 *                      patched basic material, so the page's log depth holds), a rim `pow(1 - |n·v|, p)` added in the
 *                      element's colour, or laid in black for a dark element; its strength follows the coat's shape
 *                      (breathe at hz, grow, flash, flicker), fading in over 0.15 s and out over a timed status's last
 *                      quarter second
 *   the MARKS          the element's beads as additive sprites round the feet (the shelf's paths, deterministic in ph)
 *   the BOLTS          kokusen's black-flash currents: camera-facing black ribbons, struck afresh 8 times a second
 *
 * Rides the events channel's frame step (__stepStatus after the cast ops land); ph runs on the world clock from the
 * status's own start, so a replay draws the same. Emitted only when a world's cues put a status on someone, with only
 * the elements they name. `?values` on the page shows the canvas in greys (the values check is the eyes' to make).
 */

/** The elements a world's events put on its characters (its status reactions), in first-named order. */
export function statusElements(events) {
  const out = [];
  for (const r of (events && events.reactions) || []) if (r && r.do === 'ctrl' && r.op === 'status' && ELEMENTS[r.is] && !out.includes(r.is)) out.push(r.is);
  return out;
}

export function statusScript(ids) {
  const els = ids.filter((id) => ELEMENTS[id]);
  const spec = Object.fromEntries(els.map((id) => { const E = ELEMENTS[id]; return [id, { color: E.color, rate: E.rate, size: E.size, params: E.params, coat: E.coat, dark: E.tone === 'dark', trail: E.trail }]; }));
  const burns = els.some((id) => ELEMENTS[id].fire);
  return `
// STATUS: the elements the cast carries, drawn on their bodies (coat, marks, bolts; a burning one's flames are the fire channel's)
const __EL = ${safeJson(spec)};${burns ? `
// a burning status's colour is a colorant's lines (or '#rrggbb'); its coat glows in it
const __FCOL = ${safeJson(FIRE_COLORANTS)};
const __elFireCol = (c) => (__FCOL[c] ? __FCOL[c] : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255));` : ''}
${elementMotifs(els)}
const __elTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(0.6, 'rgba(255,255,255,0.13)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill(); return new THREE.CanvasTexture(cv); })();
const __elLive = {};   // '<who>|<is>' → { coats, mats, sprs, ribbon }
function __elCoatMat(color, dark, p) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]), transparent: true, depthWrite: false, blending: dark ? THREE.NormalBlending : THREE.AdditiveBlending });
  m.userData.uK = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimK = m.userData.uK; sh.uniforms.uRimP = { value: p }; sh.uniforms.uRimDark = { value: dark ? 1 : 0 };
    sh.vertexShader = 'varying vec3 vRimN;\\nvarying vec3 vRimV;\\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\\ntransformed += normal * 0.015;').replace('#include <project_vertex>', '#include <project_vertex>\\nvRimN = normalize(normalMatrix * normal);\\nvRimV = normalize(-mvPosition.xyz);');
    sh.fragmentShader = 'uniform float uRimK;\\nuniform float uRimP;\\nuniform float uRimDark;\\nvarying vec3 vRimN;\\nvarying vec3 vRimV;\\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\\nfloat rim = clamp(pow(1.0 - abs(dot(normalize(vRimN), normalize(vRimV))), uRimP) * uRimK, 0.0, 1.0);\\ngl_FragColor = uRimDark > 0.5 ? vec4(0.0, 0.0, 0.0, rim) : vec4(gl_FragColor.rgb * rim, 1.0);');
  };
  return m;
}
function __elMake(e, is, st) {
  const S = __EL[is], color = ${burns ? "typeof st.color === 'string' ? __elFireCol(st.color) : " : ''}st.color || S.color, body = window.__mojCtrl.bodies && window.__mojCtrl.bodies[e.id];
  const L = { coats: [], mat: __elCoatMat(color, S.dark, S.coat.p), sprs: [], ribbon: null };
  if (body) {
    const meshes = []; body.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.normal && !(o.userData && (o.userData.ink || o.userData.coat))) meshes.push(o); });
    for (const o of meshes) { const c = new THREE.Mesh(o.geometry, L.mat); c.userData.coat = true; c.raycast = function () {}; c.renderOrder = 4; o.add(c); L.coats.push(c); }
  }
  // each bead leads its trail: ghosts a beat behind on the same path, smaller and fainter
  const n = __ELM[is].beads([0, 0, 0], 0, S.params).length * (1 + S.trail);
  for (let i = 0; i < n; i++) { const m = new THREE.SpriteMaterial({ map: __elTex, color: new THREE.Color(color[0], color[1], color[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); const s = new THREE.Sprite(m); s.visible = false; s.raycast = function () {}; scene.add(s); L.sprs.push(s); }
  if (__ELM[is].bolts) {
    // the bolts: a black stroke over a wider glow edge in the element's colour (the black flash's red), quads per segment
    let segs = 0; for (const b of __ELM[is].bolts([0, 0, 0], 0, S.params)) segs += b.nodes.length - 1;
    const rib = (mat, order) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs * 18), 3)); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.raycast = function () {}; m.renderOrder = order; scene.add(m); return m; };
    L.glow = rib(new THREE.MeshBasicMaterial({ color: new THREE.Color(color[0], color[1], color[2]), side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }), 4);
    L.ribbon = rib(new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, transparent: true, depthWrite: false }), 5);
  }
  return L;
}
function __elDrop(L) {
  for (const c of L.coats) if (c.parent) c.parent.remove(c);
  for (const s of L.sprs) { scene.remove(s); s.material.dispose(); }
  for (const r of [L.ribbon, L.glow]) if (r) { scene.remove(r); r.geometry.dispose(); r.material.dispose(); }
  L.mat.dispose();
}
const __elA = new THREE.Vector3(), __elB = new THREE.Vector3(), __elD = new THREE.Vector3(), __elV = new THREE.Vector3(), __elS = new THREE.Vector3();
// one ribbon of strokes: each segment a quad facing the camera, as wide at each end as its node's thickness
function __elStroke(mesh, bolts, width) {
  const pos = mesh.geometry.attributes.position, a = pos.array; let i = 0;
  for (const b of bolts) for (let k = 1; k < b.nodes.length; k++) {
    __elA.fromArray(b.nodes[k - 1]); __elB.fromArray(b.nodes[k]);
    const wa = b.w > 0 ? width * b.t[k - 1] : 0, wb = b.w > 0 ? width * b.t[k] : 0;
    __elD.subVectors(__elB, __elA); __elV.subVectors(camera.position, __elA); __elS.crossVectors(__elD, __elV).normalize();
    const sa = [__elS.x * wa, __elS.y * wa, __elS.z * wa], sb = [__elS.x * wb, __elS.y * wb, __elS.z * wb];
    const q = [__elA.x - sa[0], __elA.y - sa[1], __elA.z - sa[2], __elA.x + sa[0], __elA.y + sa[1], __elA.z + sa[2], __elB.x + sb[0], __elB.y + sb[1], __elB.z + sb[2], __elB.x - sb[0], __elB.y - sb[1], __elB.z - sb[2]];
    for (const j of [0, 1, 2, 0, 2, 3]) { a[i++] = q[j * 3]; a[i++] = q[j * 3 + 1]; a[i++] = q[j * 3 + 2]; }
  }
  pos.needsUpdate = true;
}
// the feet of a character: its eye above them, or half its height, else where it stands
function __elFoot(e) { const p = e.transform.pos, r = e.rule || {}, b = e.body || {}; return [p[0], p[1], p[2] - (Number.isFinite(r.eye) ? r.eye : Array.isArray(b.size) ? b.size[2] / 2 : Number.isFinite(b.radius) ? b.radius : 0)]; }
function __stepStatus() {
  const W = window.__mojCtrl && window.__mojCtrl.world; if (!W) return;
  const now = W.time || 0, seen = {};
  for (const e of W.entities) {
    if (!e.statuses) continue;
    for (const is in e.statuses) {
      if (!__EL[is]) continue;
      const key = e.id + '|' + is, st = e.statuses[is], S = __EL[is]; seen[key] = 1;
      const L = __elLive[key] || (__elLive[key] = __elMake(e, is, st));
      const age = now - st.t0, ph = age * S.rate, show = !e.gone;
      const fade = Math.min(1, age / 0.15) * (st.until != null ? Math.min(1, Math.max(0, (st.until - now) / 0.25)) : 1);
      const C = S.coat;
      const k = C.k * fade * (C.shape === 'grow' ? Math.min(1, 0.25 + age / 2) * (C.hz ? 0.8 + 0.2 * Math.sin(age * C.hz * 6.283) : 1)
        : C.shape === 'flash' ? Math.exp(-age / 0.25)
        : C.shape === 'flicker' ? 0.65 + 0.35 * (((Math.floor(age * 8) * 7919) % 13) / 12)
        : 0.7 + 0.3 * Math.sin(age * C.hz * 6.283));
      L.mat.userData.uK.value = k;
      for (const c of L.coats) c.visible = show;
      const cc = __elFoot(e), M = __ELM[is], bs = M.beads(cc, ph, S.params), nb = bs.length;
      for (let g = 0; g <= S.trail; g++) {
        const gs = g ? M.beads(cc, (age - 0.06 * g) * S.rate, S.params) : bs;
        for (let i = 0; i < nb; i++) {
          const b = gs[i], s = L.sprs[g * nb + i];
          if (!show || !b || b.w * fade < 0.05 || (g && b.s)) { s.visible = false; continue; }
          s.visible = true; s.position.set(b.p[0], b.p[1], b.p[2]);
          // beads differ in size by their place in the motif, and a trail's ghosts shrink and fade behind
          const vary = 0.7 + 0.6 * (((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1);
          const sz = S.size * (b.s || vary) * (0.35 + 0.65 * Math.min(1, b.w)) * Math.pow(0.78, g);
          s.scale.set(sz, sz, 1); s.material.opacity = Math.min(1, 0.35 + 0.65 * b.w) * fade * (g ? 0.5 / g : 1);
          if (b.white) s.material.color.setRGB(1, 0.97, 0.85);
        }
      }
      if (L.ribbon) {
        L.ribbon.visible = L.glow.visible = show; L.ribbon.material.opacity = fade; L.glow.material.opacity = 0.55 * fade;
        if (show) { const bolts = M.bolts(cc, ph, S.params); __elStroke(L.ribbon, bolts, S.params.width); __elStroke(L.glow, bolts, S.params.width * 2.6); }
      }
    }
  }
  for (const key in __elLive) if (!seen[key]) { __elDrop(__elLive[key]); delete __elLive[key]; }
}
if (/[?&]values\\b/.test(location.search)) renderer.domElement.style.filter = 'grayscale(1)';
window.__mojStatus = { live: () => Object.keys(__elLive) };`;
}
