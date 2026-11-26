import { safeJson } from '../emit-util.js';
import { HELD_WALK_SOURCE } from './traffic-model.js';

// The WALKERS channel (city/walkers.plan.md P0): ambient human rig figures that walk a LOOPED path
// forever. Deliberately NOT the entity/AI `controllable` stack (that is the mobile-suit combat actor:
// targeting, collision, chase-cams, hunt-the-pilot). Ambient walkers want only deterministic seeded
// loops — no AI, no collision, no physics — so this is a small self-contained channel.
//
// It REUSES the rig-bake data format (bones + rigid parts + a `forward` pose-curve clip, from
// bakeProtoformRig) and the page-level b64 decoders, but carries its OWN compact bone poser so it
// never depends on the controllable channel being emitted (that block owns the rig runtime AND its
// globals — __world, __bodies — which an ambient world has no reason to pay for). The poser math is
// the exact frame-pair quaternion nlerp the controllable runtime uses (__rigBone), inlined verbatim.
//
// Per frame, per walker, three things are coupled (the gait cycle itself plays IN PLACE; the path
// supplies the travel):
//   1. POSITION — walked along the path by ARC LENGTH, so ground speed is constant regardless of how
//      unevenly the path is sampled (constant-parameter-rate would speed up through long segments).
//   2. HEADING — the figure yaws to the path tangent (a walker baked facing +y would otherwise
//      crab-walk sideways along the route).
//   3. CLIP PHASE — driven by GROUND DISTANCE / strideDistance (one gait cycle = 2 steps), so the
//      planted foot tracks the ground it passes over instead of skating.
//
// Two loop styles, ONE driver — only the path geometry differs:
//   • bumble — a CLOSED circuit (path start ≈ end): rounds it seamlessly, no visible seam.
//   • pacman — an OPEN edge-to-edge corridor: streams across and, at the wrap, relands at the far
//     edge. The pop reads correctly because it lands exactly on the map boundary.
//
// Emitted only when the caller passes a non-empty `walkers`; a walker-free world is byte-identical.
// `cast` (the world runs the cast-shadow channel): walker bone meshes flag themselves as casters
// at construction so ambient figures throw real silhouettes; false ⇒ byte-identical template.
// `holds` (a planned city's walkers, with the cars' `signals`): a held walker is STEPPED from clock zero at a fixed dt,
// waiting at each crossing's kerb until the street it crosses is red and the one it walks along has green enough left to
// cross on (the cars' own phaseAt); a replay is the same people. Absent ⇒ the closed-form loop, byte-identical.
// `follow` (one walker, local-meru/dummy.js): the orbit's target rides that walker and the camera keeps its offset from
// it, so the view still turns and zooms round it; a 'follow' button lets it go, and the walk (walk.js) takes the camera
// while it is on, the chase seated again behind the walker after. A still capture (`capture`) keeps its own camera.
// Absent ⇒ byte-identical.
// `blend` (a walker's own, on a figure whose parts carry their corners' skin, `jnt` and `wgt`: every layered pack's): the
// figure is ONE SKIN, each corner placed by the bones it is weighed to, in the vertex shader. A rigid part rides one bone,
// and a triangle is handed whole to the bone its corners vote for, so where a body bends along its whole length (a fish,
// a ray, an eel: anything that goes forward in an S) the parts' edges open in a sawtooth; blended, two triangles that
// share a corner meet in every frame. The bones are posed as before (the same clip, the same frame pair), their
// transforms handed to the skin's material in place of the part meshes' matrices; the depth prepass is told the same
// move (`userData.prepass`, channels/creases.js). No walker asking, or no figure carrying its skin ⇒ byte-identical.
// `WALKER_BLEND`: `most` the bones a corner is weighed to (the pack's); `holds` the most a blended skin may stretch one of
// its own edges, as a share of the body's size, and still be drawn as one skin (walkerSkinStretch): past it the figure's
// own binding sets neighbouring corners on bones that part, which rigid parts hide as a seam and one skin shows as a spike.
// `react` (a played district's people, the open city: scene-three passes it where the level's pilot gets into cars):
// a passer-by struck by the player or run down by a car falls and lies a while, then gets up and runs; trouble near (a
// blow, a fall, mayhem, a fight begun, a car bearing down) sends those near running away along their own walk, faster,
// then they walk on from where they ran to. A walker downed is mayhem the page tells the bus (`mayhem:assault`,
// `mayhem:runover`: the law's wanted level). Absent ⇒ byte-identical.
export const WALKER_BLEND = Object.freeze({ most: 4, holds: 0.1 });

/**
 * A SKIN'S MEASURE: how far the blend stretches the worst of a figure's edges over its `forward` clip, as a share of the
 * body's size (its rest extent). Each corner is placed as the page places it (its bones' transforms by its weights);
 * a skin that holds keeps every edge near its rest length. → { stretch, size, holds } (a figure with no skin: null).
 * Pure; the figure as packed (base64 parts, a clip of { k, b }).
 */
export function walkerSkinStretch(fig, { clips = null } = {}) {
  if (!fig || !Array.isArray(fig.parts) || !fig.parts.some((p) => p && p.jnt && p.wgt)) return null;
  // (`clips: 'all'`: over every clip the figure carries, a body that also eats, flinches and falls; the worst of them)
  if (clips === 'all') {
    const each = [...new Set(Object.values(fig.clips || {}))].filter((c) => c && c.k && c.b).map((c) => walkerSkinStretch({ ...fig, clips: { forward: c } }));
    if (!each.length) return null;
    const worst = each.reduce((m, e) => (e.stretch > m.stretch ? e : m));
    return { ...worst, holds: worst.stretch <= WALKER_BLEND.holds };
  }
  const clip = fig.clips && (fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]]);
  if (!clip) return null;
  const buf = (s) => Buffer.from(s, 'base64'), f32 = (s) => { const u = buf(s); return new Float32Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength)); };
  const nb = fig.bones.length, K = clip.k, B = Array.isArray(clip.b) ? clip.b : f32(clip.b);
  const one = (key, j, p, o) => {
    const q = (key * nb + j) * 7, x = B[q], y = B[q + 1], z = B[q + 2], w = B[q + 3], h = fig.bones[j].head, a = p[0] - h[0], b = p[1] - h[1], c = p[2] - h[2];
    const tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
    o[0] = B[q + 4] + a + w * tx + (y * tz - z * ty); o[1] = B[q + 5] + b + w * ty + (z * tx - x * tz); o[2] = B[q + 6] + c + w * tz + (x * ty - y * tx);
  };
  let worst = 0, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const m = [0, 0, 0], P = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  fig.parts.forEach((part, bi) => {
    if (!part) return;
    const pos = f32(part.pos), J = part.jnt ? buf(part.jnt) : null, W = part.wgt ? f32(part.wgt) : null, n = pos.length / 3;
    for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], pos[v * 3 + c]); hi[c] = Math.max(hi[c], pos[v * 3 + c]); }
    for (let key = 0; key < K; key++) for (let t = 0; t + 2 < n; t += 3) {
      for (let k = 0; k < 3; k++) {
        const v = t + k, r = R[k], o = P[k]; r[0] = pos[v * 3]; r[1] = pos[v * 3 + 1]; r[2] = pos[v * 3 + 2];
        let ws = 0; o[0] = o[1] = o[2] = 0;
        if (J) for (let i = 0; i < 4; i++) { const w = W[v * 4 + i]; if (!(w > 0)) continue; one(key, J[v * 4 + i], r, m); o[0] += w * m[0]; o[1] += w * m[1]; o[2] += w * m[2]; ws += w; }
        if (ws > 1e-4) { o[0] /= ws; o[1] /= ws; o[2] /= ws; } else one(key, bi, r, o);
      }
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const d = Math.abs(Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]) - Math.hypot(R[a][0] - R[b][0], R[a][1] - R[b][1], R[a][2] - R[b][2]));
        if (d > worst) worst = d;
      }
    }
  });
  const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1, stretch = Math.round((worst / size) * 1e4) / 1e4;
  return { stretch, size: Math.round(size * 1e4) / 1e4, holds: stretch <= WALKER_BLEND.holds };
}
/** How far a passer-by is drawn, in its own heights (a 1.8 m figure: 144 m): `far` in the camera's view, `near` all
 *  round (its shadow may fall into the view). Past them it walks on, unposed and undrawn. A capture draws them all. */
export const WALKER_DRAW = Object.freeze({ far: 80, near: 12 });
/** A passer-by with a NEAR figure (`near`, a figure's name: figures/crowd-figure.js realCrowdFigure at a near walker's
 *  budget) is drawn as it within `WALKER_DETAIL.near` of its heights of the camera, and as its own figure past it (the far
 *  one); its near rig built the first time it comes so close. No walker naming one ⇒ not a byte of it. */
export const WALKER_DETAIL = Object.freeze({ near: 8 });
/** A LIT walker (`lit`, a realistic person: its colours its skin and cloth, not light baked in) is drawn in the scene's
 *  light, its normals turned with its bones; `floor` the share of its own colours it shows where no light reaches it (a
 *  street's lamp pools are painted on the ground and light no one). No lit walker ⇒ not a byte of it. */
export const WALKER_LIT = Object.freeze({ floor: 0.16 });
export function walkersChannelScript(walkers, bank, { cast = false, signals = null, capture = false, react = false } = {}) {
  const held = walkers.some((w) => Array.isArray(w.holds));
  const skinOf = (f) => !!f && Array.isArray(f.parts) && f.parts.some((p) => p && p.jnt && p.wgt);
  // (a crowd figure's packed parts, figures/crowd-figure.js: an index into its corners; none packed ⇒ not a byte)
  const packedIn = Object.values(bank || {}).some((f) => f && Array.isArray(f.parts) && f.parts.some((p) => p && p.idx));
  const blend = walkers.some((w) => w.blend && skinOf(bank[w.figure]));
  const bones = blend ? Math.max(...walkers.filter((w) => w.blend && skinOf(bank[w.figure])).map((w) => bank[w.figure].bones.length)) : 0;
  const lod = walkers.some((w) => typeof w.near === 'string' && bank[w.near]);
  // (a looped walker's own place on its loop at clock zero, `startFrac`: a six's groups a quarter of the loop apart and
  // its pairs a step apart, never one on top of another; a held walker starts there already; none ⇒ not a byte)
  // (a LIT walker, `lit`: one whose colours are what it is made of (a realistic person's, its skin and cloth painted on),
  // not light baked in, so the scene's light falls on it, the sun by day and the lamps by night; none ⇒ not a byte)
  // (and never darker than WALKER_LIT.floor of its own colours, so between a street's lamps, whose pools are painted on the
  // ground and light no one, a passer-by is a person in the half-light and not a hole)
  const lit = walkers.some((w) => w.lit);
  // (a walk whose stride is measured, a realistic person's: stepped by it; none ⇒ not a byte)
  const measured = walkers.some((w) => bank[w.figure]?.clips?.forward?.stride > 0);
  const starts = walkers.some((w) => !Array.isArray(w.holds) && w.loop !== false && Number.isFinite(w.startFrac) && w.startFrac % 1);
  const follow = !capture && walkers.some((w) => w.follow);
  return `
// ---- walkers channel (ambient rig figures on looped paths) ----
let stepWalkers = () => {};
{
const WALKERS = ${safeJson(walkers)};
const WBANK = ${safeJson(bank)};
const __wONE = new THREE.Vector3(1, 1, 1);${held ? `
// the crossings' signals, read as the cars read them, and a held walker's stepping (traffic-model.js heldWalk)
const WSIGNALS = ${safeJson(signals || [])};
${HELD_WALK_SOURCE}
const __wStep = (r, sec) => heldWalk(r.w.holds, r.w.speed, r.held, r.total, sec, WSIGNALS);` : ''}
${packedIn ? `// a packed part's index (a crowd figure's, figures/crowd-figure.js: its corners once each): 16-bit, or 32 past 65535
const __wIdx = (part) => { const b = decodeU8(part.idx).slice(); return part.n > 65535 ? new Uint32Array(b.buffer) : new Uint16Array(b.buffer); };
` : ''}// build one rig group per walker from its referenced bake — a compact __makeRigGroup (bone meshes
// only; no muzzle / thruster / weapon locators, since ambient walkers never fight).
${lit ? `// (a lit walker's material: the scene's light on its colours, and its floor where none reaches)
const __wFloor = (m) => { m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\\n  totalEmissiveRadiance += diffuseColor.rgb * ${WALKER_LIT.floor};'); }; m.customProgramCacheKey = () => 'walker-lit'; return m; };
` : ''}function __buildWalkerRig(fig${lit ? ', lit' : ''}) {
  const group = new THREE.Group();
  const boneMeshes = fig.bones.map((bn, bi) => {
    const part = fig.parts[bi];
    if (!part) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
${packedIn ? '    if (part.idx) geo.setIndex(new THREE.BufferAttribute(__wIdx(part), 1));\n' : ''}    geo.computeBoundingSphere();${lit ? `
    if (lit) geo.computeVertexNormals();` : ''}
    const mesh = new THREE.Mesh(geo, ${lit ? 'lit ? __wFloor(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })) : ' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${cast ? '\n    mesh.castShadow = true;' : ''}
    mesh.matrixAutoUpdate = false;   // one composed matrix per bone per frame
    mesh.frustumCulled = false;      // matrices mutate every frame
    group.add(mesh);
    return mesh;
  });
  scene.add(group);
  return { fig, group, boneMeshes };
}${blend ? `
// ONE SKIN (a walker's \`blend\`): the figure's parts as they are packed, each corner carrying the bones it is weighed to
// and their weights; the bones' transforms are the material's (one array a walker, written each frame), so a corner
// between two bones is placed between them and no part's edge opens.
const __wSkinPars = 'attribute vec4 aWJ;\\nattribute vec4 aWW;\\nuniform mat4 uWB[ ${bones} ];\\n';
const __wSkinMove = '#include <begin_vertex>\\n  { vec4 wp = vec4( position, 1.0 ); float ws = aWW.x + aWW.y + aWW.z + aWW.w;\\n    if ( ws > 1e-4 ) transformed = ( aWW.x * ( uWB[ int( aWJ.x ) ] * wp ).xyz + aWW.y * ( uWB[ int( aWJ.y ) ] * wp ).xyz + aWW.z * ( uWB[ int( aWJ.z ) ] * wp ).xyz + aWW.w * ( uWB[ int( aWJ.w ) ] * wp ).xyz ) / ws; }';${lit ? `
// (a lit walker's normals turned with its bones as its corners are, so the light reads its pose)
const __wSkinNormal = '#include <beginnormal_vertex>\\n  { float ns = aWW.x + aWW.y + aWW.z + aWW.w;\\n    if ( ns > 1e-4 ) objectNormal = normalize( aWW.x * mat3( uWB[ int( aWJ.x ) ] ) * objectNormal + aWW.y * mat3( uWB[ int( aWJ.y ) ] ) * objectNormal + aWW.z * mat3( uWB[ int( aWJ.z ) ] ) * objectNormal + aWW.w * mat3( uWB[ int( aWJ.w ) ] ) * objectNormal ); }';` : ''}
${lod ? 'const __wSkinGeo = new Map();\n' : ''}function __buildWalkerSkin(fig${lit ? ', lit' : ''}) {
  const group = new THREE.Group(), B = Array.from({ length: ${bones} }, () => new THREE.Matrix4()), U = { value: B };
  const mat = ${lit ? 'lit ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) : ' : ''}new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uWB = U; sh.vertexShader = __wSkinPars + sh.vertexShader.replace('#include <begin_vertex>', __wSkinMove)${lit ? `.replace('#include <beginnormal_vertex>', lit ? __wSkinNormal : '#include <beginnormal_vertex>');
    if (lit) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\\n  totalEmissiveRadiance += diffuseColor.rgb * ${WALKER_LIT.floor};')` : ''}; };
  mat.customProgramCacheKey = () => ${lit ? "lit ? 'walker-skin-lit' : " : ''}'walker-skin';
  mat.userData.prepass = (vs) => ({ vertexShader: __wSkinPars + vs.replace('#include <begin_vertex>', __wSkinMove), uniforms: { uWB: U } });
  // (its parts one mesh: one skin, one material, the bones the material's, so a passer-by is one draw and one shadow)
${lod ? `  // (one body a person, its walkers' each their own bones: the walkers of one person share its skin's geometry)
  let geo = __wSkinGeo.get(fig);
  if (!geo) {
` : ''}  const P = [], C = [], JJ = [], WW = [], I = [];
  let base = 0;
  fig.parts.forEach((part, bi) => {
    if (!part) return;
    const n = ${packedIn ? 'part.idx ? part.n : ' : ''}part.faces * 3, pos = decodeF32(part.pos), col = decodeU8(part.col);
    // (a part with no skin of its own, a held thing, rides its bone whole)
    const J = part.jnt ? decodeU8(part.jnt) : null, W = part.wgt ? (${packedIn ? 'part.wq === 8 ? Float32Array.from(decodeU8(part.wgt), (x) => x / 255) : ' : ''}decodeF32(part.wgt)) : null;
    for (let k = 0; k < n * 3; k++) { P.push(pos[k]); C.push(col[k]); }
    for (let k = 0; k < n * 4; k++) { JJ.push(J ? J[k] : bi); WW.push(W ? W[k] : (k % 4 ? 0 : 1)); }${packedIn ? `
    if (part.idx) { const ix = __wIdx(part); for (let k = 0; k < ix.length; k++) I.push(base + ix[k]); } else` : ''} for (let k = 0; k < n; k++) I.push(base + k);
    base += n;
  });
  ${lod ? 'geo' : 'const geo'} = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(Uint8Array.from(C), 3, true));
  geo.setAttribute('aWJ', new THREE.BufferAttribute(Float32Array.from(JJ), 4)); geo.setAttribute('aWW', new THREE.BufferAttribute(Float32Array.from(WW), 4));
  geo.setIndex(new THREE.BufferAttribute(base > 65535 ? Uint32Array.from(I) : Uint16Array.from(I), 1));${lit ? `
  if (lit) geo.computeVertexNormals();` : ''}${lod ? `
  __wSkinGeo.set(fig, geo);
  }` : ''}
  const mesh = new THREE.Mesh(geo, mat);${cast ? '\n  mesh.castShadow = true;' : ''}
  mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
  group.add(mesh);
  scene.add(group);
  return { fig, group, boneMeshes: [], B };
}
const __wCanBlend = (fig) => fig.parts.some((p) => p && p.jnt && p.wgt);` : ''}
// arc-length table: cumulative length at each path vertex + total. Lets us place the body by DISTANCE
// (constant ground speed) rather than by raw parameter. For a closed loop the path repeats its first
// point at the end, so the closing segment is included and s % total wraps seamlessly.
function __arcTable(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { cum, total: cum[cum.length - 1] || 1e-6 };
}
// position + segment tangent at arc-length s (caller wraps/clamps s for loop vs corridor).
const __wout = { pos: [0, 0, 0], tan: [1, 0, 0] };
function __atArc(path, cum, s) {
  const total = cum[cum.length - 1];
  s = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1e-6, t = (s - cum[i - 1]) / seg;
  const a = path[i - 1], b = path[i];
  __wout.pos[0] = a[0] + (b[0] - a[0]) * t; __wout.pos[1] = a[1] + (b[1] - a[1]) * t; __wout.pos[2] = a[2] + (b[2] - a[2]) * t;
  __wout.tan[0] = b[0] - a[0]; __wout.tan[1] = b[1] - a[1]; __wout.tan[2] = b[2] - a[2];
  return __wout;
}
// one bone's [q, head'] from the walk clip at phase p — the frame-pair quaternion nlerp over the
// clip's sparse keys (wrapping), byte-for-byte the controllable runtime's __rigBone math.
const __wq = new THREE.Quaternion(), __wh = new THREE.Vector3(), __wv = new THREE.Vector3();
const __wheadP = [0, 0, 0];
function __walkerBone(fig, clip, p, bi, outQ, outP) {
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
const __walkerRigs = WALKERS.map((w) => {
  const fig = WBANK[w.figure];
  const rig = ${blend ? `(w.blend && __wCanBlend(fig)) ? __buildWalkerSkin(fig${lit ? ', w.lit' : ''}) : ` : ''}__buildWalkerRig(fig${lit ? ', w.lit' : ''});${lod ? `
  // (a walker with a near figure: its far rig now, its near one the first time it comes close, __wTier)
  if (WBANK[w.near]) rig.group.userData.tier = 'far';` : ''}
  const at = __arcTable(w.path);
  const clip = fig.clips.forward || fig.clips[Object.keys(fig.clips)[0]];
  // scale the whole rig group (a world-scaled bake dropped into a differently-scaled world — e.g. a
  // ~1.8-unit human sized down to the ~0.6-unit people of a fractal city). Applied once (constant).
  const scale = w.scale > 0 ? w.scale : 1;
  rig.group.scale.setScalar(scale);
  return { w, rig, cum: at.cum, total: at.total, clip, scale,
    // constant ground speed: prefer an explicit period, else derive it from speed × loop length so
    // loops of different sizes all walk at the same pace; else a sane default.
    period: w.period > 0 ? w.period : (w.speed > 0 ? Math.max(0.5, at.total / w.speed) : 8),
    yaw: w.yaw != null ? w.yaw : -Math.PI / 2,   // rig faces +y → subtract 90° so heading 0 aims +x
    // world units advanced per full gait cycle (2 steps). Defaults off the baked figure height (times
    // the group scale, so the scaled foot swing matches the ground it passes over); overridable (P3 tune).
    // (a walk that carries its own stride, measured off its planted feet (figures/walker-pace.js walkStride): stepped by it,
    // so its feet stay where they land)
    stride: w.stride > 0 ? w.stride : ${measured ? 'clip.stride > 0 ? clip.stride * scale : ' : ''}Math.max(0.05, (fig.figH || 1.8) * 0.72 * scale)${held ? `,
    held: Array.isArray(w.holds) ? { s0: ((w.startFrac || 0) % 1) * at.total, s: ((w.startFrac || 0) % 1) * at.total, t: 0 } : null` : ''} };
});
${lod ? `// (a walker's near rig: made once, hidden until it comes near. Every one is made now, while the page warms behind the
// shell's loading screen (the game channel's warm watch), so no one hitches the play the first time they are walked up to)
function __wNearRig(r) {
  const w = r.w, nf = WBANK[w.near];
  r.rigs = r.rigs || { far: r.rig, near: null };
  r.rigs.near = ${blend ? `(w.blend && __wCanBlend(nf)) ? __buildWalkerSkin(nf${lit ? ', w.lit' : ''}) : ` : ''}__buildWalkerRig(nf${lit ? ', w.lit' : ''});
  r.rigs.near.group.scale.setScalar(r.scale); r.rigs.near.group.userData.tier = 'near'; r.rigs.near.group.visible = false;
}
for (const r of __walkerRigs) if (WBANK[r.w.near]) __wNearRig(r);
` : ''}${react ? `// PASSERS-BY WHO REACT: what the street does to them this frame (the pilot, its car, its swing, the trouble heard)
const WREACT = { run: 4.2, flee: 7, near: 22, down: 6, carR: 0.5, carV: 4, dodge: 9, dodgeV: 6, swingR: 1.8, press: 1.5 };
let __wT = null, __wLogN = 0, __wSwing = false, __wPressT = {};
function __wPress(type, sec) { const B = window.__mojBus; if (!B || !B.press || sec - (__wPressT[type] || -9) < WREACT.press) return; __wPressT[type] = sec; B.press(type); }
function __wStreet(sec) {
  const dt = __wT === null ? 0 : Math.min(0.1, Math.max(0, sec - __wT)); __wT = sec;
  const C = window.__mojCtrl && window.__mojCtrl.world, out = { dt, alarms: [], cars: [], swing: null };
  if (!C || !C.byId) return out;
  const P = C.byId[C.pilotId], hero = P && P.mount ? C.byId[P.riderId] : P;
  // (trouble the bus has heard, at whoever it was, else the player)
  const B = window.__mojBus, log = B && B.state && B.state.log;
  if (log) { if (log.length < __wLogN) __wLogN = 0; for (let i = __wLogN; i < log.length; i++) { const ty = log[i] && log[i].type; if (!ty || !/^(hit:|down$|mayhem:|encounter:|busted$|wasted$)/.test(ty)) continue; const at = log[i].entity && C.byId[log[i].entity], q = at || P; if (q && q.transform) out.alarms.push(q.transform.pos); } __wLogN = log.length; }
  // (the cars that move: the one the pilot drives, the law's)
  for (const e of C.entities) if (!e.gone && (e.carHull || (e.mount && e.mount.cab && e === P)) && Math.abs(e.speed || 0) > 0.5) out.cars.push({ p: e.transform.pos, h: e.transform.heading, v: e.speed, hull: e.carHull || e.mount.hull || [1, 2.3], mine: e === P });
  // (a swing begun by the player on foot)
  const sw = !!(hero && !hero.mountedOn && hero.swingT != null);
  if (sw && !__wSwing && hero.transform) out.swing = { p: hero.transform.pos, h: hero.transform.heading };
  __wSwing = sw;
  return out;
}
function __wReact(r, wi, p, sec, S) {
  const R = r.react || (r.react = { ds: 0, ph: 0, prev0: null, prevS: null, flee: 0, dir: 1, down: 0, from: null });
  if (R.down > 0) { R.down -= S.dt; if (R.down <= 0) { R.flee = WREACT.flee; } return R; }
  const away = (q) => { const dx = p[0] - q[0], dy = p[1] - q[1]; return { d: Math.hypot(dx, dy), dx, dy }; };
  // struck: the player's swing, before them, in reach
  if (S.swing) { const a = away(S.swing.p), f = Math.cos(S.swing.h) * a.dx + Math.sin(S.swing.h) * a.dy; if (a.d < WREACT.swingR && f > 0.2 * a.d) { R.down = WREACT.down; R.from = S.swing.p; __wPress('mayhem:assault', sec); return R; } }
  for (const c of S.cars) {
    const dx = p[0] - c.p[0], dy = p[1] - c.p[1], fx = Math.cos(c.h), fy = Math.sin(c.h), u = dx * fx + dy * fy, v = -dx * fy + dy * fx;
    // run down: inside its box, at speed
    if (Math.abs(c.v) > WREACT.carV && Math.abs(u) < c.hull[1] + WREACT.carR && Math.abs(v) < c.hull[0] + WREACT.carR) { R.down = WREACT.down; R.from = c.p; if (c.mine) __wPress('mayhem:runover', sec); return R; }
    // a car bearing down: ahead of it, near its line, coming fast
    if (Math.abs(c.v) > WREACT.dodgeV && u * Math.sign(c.v) > 0 && Math.abs(u) < WREACT.dodge && Math.abs(v) < 3 && R.flee <= 0) { R.flee = WREACT.flee * 0.5; R.from = c.p; }
  }
  for (const q of S.alarms) if (away(q).d < WREACT.near && R.flee <= 0) { R.flee = WREACT.flee; R.from = q; }
  if (R.flee > 0) R.flee -= S.dt;
  return R;
}
` : ''}// probe/debug seam (a traversal audit surface, like __mojCtrl entities): the live pose of every walker.
window.__mojWalkers = __walkerRigs.map((r) => ({ figure: r.w.figure, style: r.w.style || null, pos: [0, 0, 0], heading: 0, phase: 0 }));${capture ? '' : `
// (a passer-by drawn only where it can be seen: in the camera's view within WALKER_DRAW.far of its height, or within
// WALKER_DRAW.near, where its shadow may fall into the view; one unseen is walked on but not posed, and draws nothing)
const __wDraw = ${safeJson(WALKER_DRAW)}, __wFr = new THREE.Frustum(), __wPM = new THREE.Matrix4(), __wIV = new THREE.Matrix4(), __wSph = new THREE.Sphere();
const __wSeen = (p, h) => {
  __wSph.center.set(p[0], p[1], p[2] + h * 0.5); __wSph.radius = h;
  const d = __wSph.center.distanceTo(camera.position);
  return d < __wDraw.near * h || (d < __wDraw.far * h && __wFr.intersectsSphere(__wSph));
};`}
${lod ? `// THE NEAR FIGURE (WALKER_DETAIL): within its near reach a walker is drawn as its near figure, past it as its own; the
// tier chosen on where it stood the frame before, its near rig built the first time it is wanted and kept
const __wNear = ${WALKER_DETAIL.near};
function __wTier(r) {
  const w = r.w; if (!WBANK[w.near]) return;
  const gp = r.rig.group.position, h = (r.rig.fig.figH || 1.8) * r.scale;
  const want = gp.distanceTo(camera.position) < __wNear * h ? 'near' : 'far';
  if ((r.rig.group.userData.tier || 'far') === want) return;
  r.rigs = r.rigs || { far: r.rig, near: null };
  if (want === 'near' && !r.rigs.near) __wNearRig(r);
  const next = r.rigs[want];
  next.group.position.copy(gp); next.group.rotation.copy(r.rig.group.rotation);
  r.rig.group.visible = false; next.group.visible = true;
  r.rig = next;
}
` : ''}stepWalkers = (t) => {
  const sec = t / 1000;${capture ? '' : `
  camera.updateMatrixWorld(); __wFr.setFromProjectionMatrix(__wPM.multiplyMatrices(camera.projectionMatrix, __wIV.copy(camera.matrixWorld).invert()));`}${react ? `
  const __wS = __wStreet(sec);` : ''}
  for (let wi = 0; wi < __walkerRigs.length; wi++) {${lod ? `
    __wTier(__walkerRigs[wi]);` : ''}
    const r = __walkerRigs[wi], w = r.w, fig = r.rig.fig, g = r.rig.group;
    // ground distance travelled. loop (bumble) wraps the arc length; open (pacman) clamps at the end
    // until it laps, at which point the wrap relands it at the far edge.
    const ${react ? 's0' : 's'} = ${held ? 'r.held ? __wStep(r, sec) : ' : ''}w.loop === false
      ? Math.min(r.total, (sec / r.period) * r.total)
      : ${starts ? '((sec / r.period + (w.startFrac || 0)) % 1)' : '((sec / r.period) % 1)'} * r.total;
${react ? `    // (a passer-by who reacts: off its own walk's clock by what it has run, frozen while it lies, running away)
    const R = r.react || (r.react = { ds: 0, ph: 0, prev0: null, prevS: null, flee: 0, dir: 1, down: 0, from: null });
    let d0 = R.prev0 === null ? 0 : s0 - R.prev0; if (d0 < -r.total / 2) d0 += r.total; R.prev0 = s0;
    if (R.down > 0) R.ds -= d0;
    else if (R.flee > 0) R.ds += R.dir * WREACT.run * __wS.dt - d0;
    const s = ((s0 + R.ds) % r.total + r.total) % r.total;
    let at = __atArc(w.path, r.cum, s), p = at.pos;
    __wReact(r, wi, p, sec, __wS);
    // (which way it runs: along its walk, the way that takes it from the trouble)
    if (R.flee > 0 && R.from && R.fleeFrom !== R.from) { R.fleeFrom = R.from; R.dir = at.tan[0] * (p[0] - R.from[0]) + at.tan[1] * (p[1] - R.from[1]) >= 0 ? 1 : -1; }
    const tan = at.tan;
    let mv = R.prevS === null ? 0 : Math.abs(s - R.prevS); if (mv > r.total / 2) mv = r.total - mv; R.prevS = s;
    if (R.down <= 0) R.ph += mv / r.stride;
    const heading = Math.atan2(tan[1], tan[0]) + (R.flee > 0 && R.dir < 0 ? Math.PI : 0);
    g.position.set(p[0], p[1], p[2] + (R.down > 0 ? 0.12 : 0));
    if (R.down > 0) g.rotation.set(-Math.PI / 2, 0, heading + r.yaw, 'ZXY'); else g.rotation.set(0, 0, heading + r.yaw, 'XYZ');
    const phase = R.ph;` : `    const at = __atArc(w.path, r.cum, s), p = at.pos, tan = at.tan;
    const heading = Math.atan2(tan[1], tan[0]);
    g.position.set(p[0], p[1], p[2]);
    g.rotation.set(0, 0, heading + r.yaw);
    const phase = s / r.stride;                 // clip phase from ground distance (no skate)`}
${capture ? '' : `    const __seen = __wSeen(p, (fig.figH || 1.8) * r.scale);
    if (g.visible !== __seen) g.visible = __seen;
`}    ${capture ? '' : 'if (__seen) '}for (let bi = 0; bi < fig.bones.length; bi++) {
      const mesh = r.rig.boneMeshes[bi];
      if (!mesh${blend ? ' && !r.rig.B' : ''}) continue;
      __walkerBone(fig, r.clip, phase, bi, __wq, __wheadP);
      // M·v = head' + q·(v − restHead)  →  compose(position = head' − q·restHead, q, 1)
      const rh = fig.bones[bi].head;
      __wh.set(rh[0], rh[1], rh[2]).applyQuaternion(__wq);
      __wv.set(__wheadP[0] - __wh.x, __wheadP[1] - __wh.y, __wheadP[2] - __wh.z);
      ${blend ? '(r.rig.B ? r.rig.B[bi] : mesh.matrix)' : 'mesh.matrix'}.compose(__wv, __wq, __wONE);
    }
    const wo = window.__mojWalkers[wi];
    wo.pos[0] = p[0]; wo.pos[1] = p[1]; wo.pos[2] = p[2]; wo.heading = heading; wo.phase = phase;
${react ? `    wo.down = R.down > 0; wo.fleeing = R.flee > 0;
` : ''}  }${follow ? `
  __wFollow();` : ''}
};${follow ? `
// the followed walker: seated behind and above it along its heading, then carried with it (a pure translation, so the
// orbit's turn and zoom are kept); let go by the button, or while the walk has the camera
const __wF = __walkerRigs.findIndex((r) => r.w.follow), __wFLast = new THREE.Vector3();
let __wFOn = true, __wFSeat = true;
const __wFBtn = document.createElement('button'); __wFBtn.textContent = 'follow'; __wFBtn.classList.add('on');
__wFBtn.onclick = () => { __wFOn = !__wFOn; __wFSeat = true; __wFBtn.classList.toggle('on', __wFOn); };
if (hud) hud.appendChild(__wFBtn);
function __wFollow() {
  if (__wF < 0 || !__wFOn || (typeof walkOn !== 'undefined' && walkOn)) { __wFSeat = true; return; }
  const r = __walkerRigs[__wF], g = r.rig.group.position, up = (r.rig.fig.figH || 1.8) * r.scale * 0.6;
  if (__wFSeat) {
    const h = window.__mojWalkers[__wF].heading;
    controls.target.set(g.x, g.y, g.z + up);
    camera.position.set(g.x - Math.cos(h) * 7, g.y - Math.sin(h) * 7, g.z + up + 3.5);
    camera.lookAt(controls.target);
    __wFSeat = false;
  } else {
    const dx = g.x - __wFLast.x, dy = g.y - __wFLast.y, dz = g.z - __wFLast.z;
    controls.target.x += dx; controls.target.y += dy; controls.target.z += dz;
    camera.position.x += dx; camera.position.y += dy; camera.position.z += dz;
  }
  __wFLast.copy(g);
}` : ''}
}`;
}
