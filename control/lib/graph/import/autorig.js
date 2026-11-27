/**
 * autorig — a figure made ELSEWHERE with no skeleton (or one that does not read as a humanoid) rigged onto the vajra:
 * its landmarks fitted from its shape, a humanoid skeleton stood on them, every vertex weighted to the bones near it,
 * and the whole written as a SKINNED GLB whose joints carry the VRM humanoid names. That GLB is then what any rigged
 * import is: rig-import.js reads it by name into layer 0's pack (the hero's bone ids, the clip library's retarget, the
 * cuts, the skinned export), so nothing downstream knows it was fitted.
 *
 *   autoRig(glb, { as?, shape? }) → { bytes, landmarks, ledger }
 *     as      'body' | 'mascot' (classify.js reads it when absent; a prop or a creature is refused, naming why)
 *   bakeRest(glb) → { json, bin }        the model at rest as one plain mesh: every primitive's vertices where they
 *                                         stand (skinned, or carried by their nodes), smooth normals, its materials and
 *                                         textures, no skeleton, no clips, no morphs (stripSkin is this as a GLB)
 *   fitLandmarks(tris, shape, cls) → { at: { <VRM bone>: [x, y, z] }, forward, ledger }   in the native frame
 *
 * The fit (the native frame, z up), on classify.js's grid of bands and pieces:
 *   legs      below the crotch, the two pieces each band parts into: a hip a little above the crotch over each, a knee
 *             at a little over half the leg, an ankle at a tenth, the toes forward along the sole
 *   facing    the way the soles reach past the ankles (a foot points forward); flat, glTF's +z
 *   head      the chin where the neck pinches (classify.js), the crown the top
 *   torso     the hips, the spine and the chest up the core's middle, the shoulders a neck below the chin (a body's
 *             neck is long, a mascot's short), at the torso's edge
 *   arms      the cells off the torso's sides: the tip the one farthest from the shoulder, the elbow and the wrist along
 *             the line to it (at an arm's own proportions), each pulled to the middle of the limb there. An arm held
 *             against the body (no cells off its side) cannot be fitted: refused, naming the pose a fit needs
 *
 * The weights: each vertex's REGION is its nearest bone's (a leg, an arm, the trunk), its candidates that region's bones
 * and the joints it meets; among them, by inverse distance to each bone's segment (a mascot's sharper: it bends at its
 * joints like a toy), the four strongest kept, then smoothed over the mesh's own edges so a joint folds rather than
 * tears. Pure and deterministic: the same bytes and words give the same GLB.
 */
import { parseGlb, readAccessor } from '../scene/scene-gltf-read.js';
import { packGlb } from './to-glb.js';
import { restPrimitives, toNative } from './inspect.js';
import { classifyShape, rasterize, pieces, legTrack, BANDS } from './classify.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const unit3 = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [1, 0, 0]; };
const fail = (m) => new Error(`import: auto-rig: ${m}`);
/** native (z up) → glTF (y up): the inverse of inspect.js toNative */
const toGltf = ([x, y, z]) => [x, z, -y];

// ── the model at rest, as one plain mesh ─────────────────────────────────────────────────────────────────────────────
const MATERIAL_EXTENSIONS = /^KHR_(materials_|texture_transform|texture_basisu)/;

/** The model at rest as one plain mesh (see the header): { json, bin, prims: [{ P, idx }], ledger }. */
export function bakeRest(glb) {
  const { json, bin } = parseGlb(Buffer.isBuffer(glb) ? glb : Buffer.from(glb));
  const ledger = { dropped: [] };
  if ((json.animations || []).length) ledger.dropped.push(`${json.animations.length} clip${json.animations.length === 1 ? '' : 's'}`);
  if ((json.meshes || []).some((m) => (m.primitives || []).some((p) => (p.targets || []).length))) ledger.dropped.push('its morph targets');
  const out = { asset: { version: '2.0', generator: 'mojulo import (rest)' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'body', mesh: 0 }], meshes: [{ name: 'body', primitives: [] }], accessors: [], bufferViews: [] };
  const parts = [];
  let size = 0;
  const view = (buf, target) => {
    const at = (size + 3) & ~3; if (at > size) parts.push(Buffer.alloc(at - size)); parts.push(buf); size = at + buf.length;
    out.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: buf.length, ...(target ? { target } : {}) });
    return out.bufferViews.length - 1;
  };
  const floats = (arr, type, extra = {}) => {
    const b = Buffer.alloc(arr.length * 4); for (let i = 0; i < arr.length; i++) b.writeFloatLE(arr[i], i * 4);
    out.accessors.push({ bufferView: view(b, 34962), componentType: 5126, count: arr.length / { VEC2: 2, VEC3: 3, VEC4: 4 }[type], type, ...extra });
    return out.accessors.length - 1;
  };
  // its look: materials, textures and samplers as they were, each image's bytes carried over
  for (const k of ['materials', 'textures', 'samplers']) if (json[k]) out[k] = JSON.parse(JSON.stringify(json[k]));
  if (json.images) out.images = json.images.map((im) => {
    if (im.bufferView == null) return { ...im };
    const v = json.bufferViews[im.bufferView];
    return { mimeType: im.mimeType, ...(im.name ? { name: im.name } : {}), bufferView: view(Buffer.from(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength))) };
  });
  const used = (json.extensionsUsed || []).filter((e) => MATERIAL_EXTENSIONS.test(e));
  if (used.length) out.extensionsUsed = used;
  const prims = [];
  for (const { prim, P } of restPrimitives(json, bin)) {
    const mode = prim.mode ?? 4, n = P.length / 3;
    if (mode !== 4 && mode !== 5 && mode !== 6) { ledger.dropped.push('a primitive not of triangles'); continue; }
    const raw = prim.indices != null ? readAccessor(json, bin, prim.indices) : Array.from({ length: n }, (_, i) => i);
    const idx = [];
    if (mode === 4) for (let t = 0; t + 2 < raw.length; t += 3) idx.push(raw[t], raw[t + 1], raw[t + 2]);
    else if (mode === 5) for (let t = 0; t + 2 < raw.length; t++) idx.push(raw[t], raw[t + 1 + (t & 1)], raw[t + 2 - (t & 1)]);
    else for (let t = 1; t + 1 < raw.length; t++) idx.push(raw[0], raw[t], raw[t + 1]);
    if (!idx.length) continue;
    // smooth normals from the baked triangles (area-weighted at each vertex)
    const N = new Array(P.length).fill(0);
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
      const A = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], B = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]], C = [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]];
      const u = sub(B, A), v = sub(C, A), f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      for (const i of [a, b, c]) { N[i * 3] += f[0]; N[i * 3 + 1] += f[1]; N[i * 3 + 2] += f[2]; }
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; if (!N[i * 3] && !N[i * 3 + 1] && !N[i * 3 + 2]) N[i * 3 + 1] = 1; }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = P[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
    const attributes = { POSITION: floats(P, 'VEC3', { min: min.map(r4), max: max.map(r4) }), NORMAL: floats(N, 'VEC3') };
    const A = prim.attributes || {};
    if (A.TEXCOORD_0 != null) attributes.TEXCOORD_0 = floats(readAccessor(json, bin, A.TEXCOORD_0), 'VEC2');
    if (A.COLOR_0 != null) attributes.COLOR_0 = floats(readAccessor(json, bin, A.COLOR_0), json.accessors[A.COLOR_0].type);
    const big = n > 65535, ib = Buffer.alloc(idx.length * (big ? 4 : 2));
    idx.forEach((v, i) => (big ? ib.writeUInt32LE(v, i * 4) : ib.writeUInt16LE(v, i * 2)));
    out.accessors.push({ bufferView: view(ib, 34963), componentType: big ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
    out.meshes[0].primitives.push({ attributes, indices: out.accessors.length - 1, ...(prim.material != null ? { material: prim.material } : {}) });
    prims.push({ P, idx, attributes });
  }
  if (!prims.length) throw fail('the model draws no triangles');
  const merged = Buffer.concat(parts);
  out.buffers = [{ byteLength: merged.length }];
  return { json: out, bin: merged, prims, ledger };
}

/** The model at rest with no skeleton, as a GLB (bakeRest's). */
export const stripSkin = (glb) => { const { json, bin } = bakeRest(glb); return packGlb(json, bin); };

// ── the landmarks ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The humanoid joints a fit stands, each with its parent (null at the root), in the order they are written. */
export const FIT_BONES = Object.freeze([
  ['hips', null], ['spine', 'hips'], ['chest', 'spine'], ['neck', 'chest'], ['head', 'neck'],
  ['leftShoulder', 'chest'], ['leftUpperArm', 'leftShoulder'], ['leftLowerArm', 'leftUpperArm'], ['leftHand', 'leftLowerArm'],
  ['rightShoulder', 'chest'], ['rightUpperArm', 'rightShoulder'], ['rightLowerArm', 'rightUpperArm'], ['rightHand', 'rightLowerArm'],
  ['leftUpperLeg', 'hips'], ['leftLowerLeg', 'leftUpperLeg'], ['leftFoot', 'leftLowerLeg'], ['leftToes', 'leftFoot'],
  ['rightUpperLeg', 'hips'], ['rightLowerLeg', 'rightUpperLeg'], ['rightFoot', 'rightLowerLeg'], ['rightToes', 'rightFoot'],
]);
/** Each bone's segment ends past its last joint: a limb's tip (the hand's fingertips, the toes' end, the crown). */
const END = Object.freeze({ head: 'crown', leftHand: 'leftTip', rightHand: 'rightTip', leftToes: 'leftToeTip', rightToes: 'rightToeTip' });

/** The arm's joints along the line from the shoulder to the fingertips (an arm's proportions: the elbow at 0.43, the
 * wrist at 0.77 for a body; a mascot's hand is bigger, its wrist at 0.7). */
const ARM = Object.freeze({ body: Object.freeze({ elbow: 0.43, wrist: 0.77 }), mascot: Object.freeze({ elbow: 0.45, wrist: 0.7 }) });
/** The neck's length under the chin, in heads (a body's long, a mascot's short). */
const NECK = Object.freeze({ body: 0.4, mascot: 0.15 });

/** The landmarks of a biped at rest (see the header). */
export function fitLandmarks(tris, shape, cls) {
  const g = rasterize(tris);
  const NB = BANDS;
  const P = g.bands.map((s) => pieces(s, g.nx));
  const H = g.height, z0 = g.zmin, top = z0 + H;
  const zOf = (b) => z0 + (b + 0.5) * g.bandH;
  const bandOf = (z) => Math.min(NB - 1, Math.max(0, Math.floor((z - z0) / g.bandH)));
  const wx = (cx) => g.x0 + (cx + 0.5) * g.cell, wy = (cy) => g.y0 + (cy + 0.5) * g.cell;
  const extent = (p) => { let lo = Infinity, hi = -Infinity; for (const q of p.cells) { const x = q % g.nx; if (x < lo) lo = x; if (x > hi) hi = x; } return [wx(lo) - g.cell / 2, wx(hi) + g.cell / 2]; };
  const real = (ps) => ps.filter((p) => p.area >= Math.max(2, 0.1 * (ps[0]?.area ?? 0)));
  const ledger = { notes: [] };
  if (shape.crotch === null) throw fail('its legs do not part (a robe, a skirt or legs held together): a fit needs the legs apart from the hips down');
  // the legs as followed down from the trunk (classify.js legTrack): each side the followed cells on its side of the
  // trunk's middle, so knees that touch still read as two legs and a hand by a thigh is left out
  const track = legTrack(g, P);
  if (track.fork === null) throw fail('its legs do not part from its trunk');
  let crotchZ = z0 + shape.crotch;
  // thighs held together read a crotch at the knees: a body's is near half its height (never under 0.38 of it)
  if (cls === 'body' && shape.crotch < 0.38 * H) { crotchZ = z0 + 0.46 * H; ledger.notes.push(`its legs touch above the knee (they part at ${r4(shape.crotch / H)} of its height): the crotch is taken at a person's 0.46`); }
  const L = crotchZ - z0;
  const sideCells = (b) => {
    const cells = track.legCells[b];
    if (!cells || !cells.length) return null;
    const acc = [[0, 0, 0], [0, 0, 0]];
    for (const c of cells) { const x = c % g.nx, k = x < track.mid ? 0 : 1; acc[k][0] += wx(x); acc[k][1] += wy(Math.floor(c / g.nx)); acc[k][2]++; }
    if (!acc[0][2] || !acc[1][2]) return null;
    return acc.map(([x, y, n]) => [x / n, y / n, zOf(b)]);
  };
  // a leg's middle at a height: the nearest band at or below it the following reached with both sides
  const legAt = (z) => { for (let b = Math.min(bandOf(z), track.fork); b >= 0; b--) { const r = sideCells(b); if (r) return r.map((q) => [q[0], q[1], z]); } return null; };
  const hipBand = legAt(Math.min(crotchZ, zOf(track.fork)) - 0.05 * L);
  // (a knee stands at a little over half the hip's height, an ankle at a twentieth of the figure)
  const hipZ0 = crotchZ + 0.15 * L;
  const knee = legAt(z0 + 0.53 * (hipZ0 - z0)), ankle = legAt(z0 + 0.1 * L), sole = legAt(z0 + 0.02 * L);
  if (!hipBand || !knee || !ankle) throw fail('its legs do not stay apart down to the feet');
  // the facing: the soles reach forward of the ankles (a foot points the way it walks)
  const reach = sole ? (sole[0][1] - ankle[0][1] + sole[1][1] - ankle[1][1]) / 2 : 0;
  const forward = Math.abs(reach) > 0.01 * H ? Math.sign(reach) : -1;
  ledger.facing = Math.abs(reach) > 0.01 * H ? 'by its feet' : 'by glTF\'s facing (+z): its feet do not say';
  // the figure's right is on +x facing +y (native), so on −x facing −y
  const rightIsHigherX = forward > 0;
  const side = (pair) => (rightIsHigherX ? { left: pair[0], right: pair[1] } : { left: pair[1], right: pair[0] });
  // the trunk's middle at a height: the core piece there (the piece holding the crotch's middle, followed up)
  const cxMid = (hipBand[0][0] + hipBand[1][0]) / 2;
  const trunkAt = (z) => {
    const ps = real(P[bandOf(z)]);
    if (!ps.length) return null;
    const near = ps.slice().sort((p, q) => Math.abs(wx(p.cx) - cxMid) - Math.abs(wx(q.cx) - cxMid) || q.area - p.area)[0];
    return { at: [wx(near.cx), wy(near.cy), zOf(bandOf(z))], x: extent(near), piece: near };
  };
  // the head
  const chinZ = shape.chin !== null ? z0 + shape.chin : crotchZ + 0.5 * (top - crotchZ);
  const headH = top - chinZ;
  const shoulderZ = Math.max(crotchZ + 0.35 * (chinZ - crotchZ), chinZ - NECK[cls] * headH);
  const hipZ = hipZ0;
  const at = {};
  const mid = (z) => trunkAt(z)?.at ?? [cxMid, 0, z];
  at.hips = [cxMid, mid(hipZ)[1], hipZ];
  at.spine = mid(hipZ + 0.3 * (shoulderZ - hipZ));
  at.chest = mid(hipZ + 0.65 * (shoulderZ - hipZ));
  at.neck = mid(shoulderZ + 0.1 * (chinZ - shoulderZ));
  const headMid = mid(chinZ + 0.4 * headH);
  at.head = [headMid[0], headMid[1], chinZ + 0.15 * headH];
  at.crown = [headMid[0], headMid[1], top];
  // the legs
  const legs = { hip: side(hipBand), knee: side(knee), ankle: side(ankle), sole: sole ? side(sole) : null };
  for (const s of ['left', 'right']) {
    at[`${s}UpperLeg`] = [cxMid + 0.85 * (legs.hip[s][0] - cxMid), at.hips[1], hipZ];
    at[`${s}LowerLeg`] = legs.knee[s];
    at[`${s}Foot`] = legs.ankle[s];
    const footLen = Math.max(0.06 * H, sole ? Math.abs(legs.sole[s][1] - legs.ankle[s][1]) * 2 : 0.08 * H);
    at[`${s}Toes`] = [legs.ankle[s][0], legs.ankle[s][1] + forward * 0.55 * footLen, z0 + 0.02 * H];
    at[`${s}ToeTip`] = [legs.ankle[s][0], legs.ankle[s][1] + forward * 0.95 * footLen, z0 + 0.01 * H];
  }
  // the arms: the cells off the torso's sides, from the shoulders down past the hips
  // the torso's width: its narrowest band between the hips and the shoulders (an arm that touches it at one height
  // widens that band, not every band)
  let torso = null;
  for (let t = 0.2; t <= 0.8001; t += 0.05) { const tr = trunkAt(hipZ + t * (shoulderZ - hipZ)); if (tr && (!torso || tr.x[1] - tr.x[0] < torso.x[1] - torso.x[0])) torso = tr; }
  if (!torso) throw fail('it has no trunk between its hips and its shoulders');
  const [tx0, tx1] = torso.x, tcx = (tx0 + tx1) / 2, hw = (tx1 - tx0) / 2;
  // the arms: in a T or an A pose a hand is the figure's farthest reach to its side (hair and a skirt hang nearer the
  // middle), so each fingertip is the point farthest out on its side above a third of the height; the arm is the line
  // from it back to the shoulder, its joints along that line pulled to the middle of the limb
  // (points over the surface, not its vertices alone: a low-poly arm is a few long triangles)
  const pts = [];
  const step = 0.01 * H;
  for (let i = 0; i + 8 < tris.length; i += 9) {
    const a = [tris[i], tris[i + 1], tris[i + 2]], b = [tris[i + 3], tris[i + 4], tris[i + 5]], c = [tris[i + 6], tris[i + 7], tris[i + 8]];
    const n = Math.min(64, Math.max(1, Math.ceil(Math.max(len(sub(a, b)), len(sub(b, c)), len(sub(c, a))) / step)));
    for (let p = 0; p <= n; p++) for (let q = 0; q <= n - p; q++) {
      const u = p / n, v = q / n, w = 1 - u - v;
      const z = u * a[2] + v * b[2] + w * c[2];
      if (z >= z0 + 0.3 * H && z <= top - 0.05 * H) pts.push([u * a[0] + v * b[0] + w * c[0], u * a[1] + v * b[1] + w * c[1], z]);
    }
  }
  const centroid = (ps) => mul(ps.reduce((acc, p) => add(acc, p), [0, 0, 0]), 1 / ps.length);
  for (const s of ['left', 'right']) {
    const sg = (s === 'right') === rightIsHigherX ? 1 : -1;
    let tip = null;
    for (const p of pts) if (!tip || sg * p[0] > sg * tip[0]) tip = p;
    if (!tip || sg * (tip[0] - tcx) < 1.3 * hw + 0.05 * H) throw fail(`its ${s} arm is not held away from its body (its farthest reach to that side is ${tip ? r4(sg * (tip[0] - tcx)) : 0} from its middle, its torso ${r4(hw)} to its edge): a fit needs a T or an A pose`);
    const sx = tcx + sg * 0.85 * hw;
    // the arm's middle traced in from the fingertip, slab by slab across the side, each slab's points near the last
    // centre (an arm is a tube: its middle moves a little from slab to slab), to the torso's edge
    const slab = 0.02 * H, win = 0.05 * H;
    const trace = [tip];
    let cur = tip;
    for (let x = tip[0] - sg * slab; sg * (x - tcx) > 1.15 * hw; x -= sg * slab) {
      const near = pts.filter((p) => Math.abs(p[0] - x) <= slab / 2 && Math.abs(p[2] - cur[2]) <= win && Math.abs(p[1] - cur[1]) <= 1.5 * win);
      if (!near.length) continue;
      // (an arm rises or falls at most about fifty degrees across a slab: a jump is hair or a collar, not the arm)
      const c = centroid(near);
      if (Math.abs(c[2] - cur[2]) > 1.2 * slab && trace.length > 2) continue;
      cur = c; trace.push(cur);
    }
    // the shoulder: the trace's line carried on to the shoulder's x
    let shoulder = [sx, mid(shoulderZ)[1], shoulderZ];
    if (trace.length >= 4) {
      // (its middle third: past the fingers' spread, short of the armpit)
      const inner = trace.slice(Math.floor(trace.length / 3), Math.max(Math.floor(trace.length / 3) + 2, Math.ceil(trace.length * 2 / 3)));
      const a0 = inner[0], a1 = inner[inner.length - 1], dx = a1[0] - a0[0];
      const t = Math.abs(dx) > 1e-6 ? (sx - a0[0]) / dx : 1;
      shoulder = [sx, a0[1] + t * (a1[1] - a0[1]), Math.min(top - 0.08 * H, Math.max(crotchZ, a0[2] + t * (a1[2] - a0[2])))];
      ledger[`${s}ArmTraced`] = trace.length;
    } else ledger.notes.push(`its ${s} arm could not be traced in from its hand: its shoulder is set a neck under its chin`);
    // a joint along the traced middle at a share of its length from the shoulder
    const path = [shoulder, ...trace.slice().reverse()];
    const seglen = path.slice(1).map((q, i) => len(sub(q, path[i])));
    const total = seglen.reduce((x, y) => x + y, 0) || 1;
    const along = (f) => { let d = f * total; for (let i = 0; i < seglen.length; i++) { if (d <= seglen[i]) return lerp(path[i], path[i + 1], seglen[i] ? d / seglen[i] : 0); d -= seglen[i]; } return path[path.length - 1]; };
    const armLen = total;
    const A = ARM[cls];
    at[`${s}Shoulder`] = [tcx + sg * 0.25 * hw, at.chest[1], Math.min(shoulder[2], shoulderZ) - 0.03 * headH];
    at[`${s}UpperArm`] = shoulder;
    at[`${s}LowerArm`] = along(A.elbow);
    at[`${s}Hand`] = along(A.wrist);
    at[`${s}Tip`] = tip;
    ledger[`${s}Arm`] = r4(armLen);
  }
  ledger.measures = { height: r4(H), crotch: r4(shape.crotch), chin: r4(chinZ - z0), headH: r4(headH), shoulder: r4(shoulderZ - z0), torsoHalfWidth: r4(hw) };
  for (const k of Object.keys(at)) at[k] = at[k].map(r4);
  return { at, forward, ledger };
}

// ── the weights ──────────────────────────────────────────────────────────────────────────────────────────────────────
const REGION = (bone) => (/^left(Upper|Lower)Leg|^leftFoot|^leftToes/.test(bone) ? 'legL' : /^right(Upper|Lower)Leg|^rightFoot|^rightToes/.test(bone) ? 'legR'
  : /^left(Upper|Lower)Arm|^leftHand/.test(bone) ? 'armL' : /^right(Upper|Lower)Arm|^rightHand/.test(bone) ? 'armR' : 'trunk');
// the bones a region's vertex may take: its own, and those of the joints it meets
const MEETS = Object.freeze({
  legL: ['hips'], legR: ['hips'], armL: ['leftShoulder', 'chest'], armR: ['rightShoulder', 'chest'],
  trunk: ['leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg'],
});
function segDist(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1e-12)));
  return len(sub(p, add(a, mul(ab, t))));
}

/** Each baked primitive's weights: [{ J: Uint8Array(4n), W: Float32Array(4n) }] over FIT_BONES' order. */
export function solveWeights(prims, at, cls) {
  const names = FIT_BONES.map(([n]) => n);
  const segs = names.map((n) => {
    const child = FIT_BONES.find(([c, p]) => p === n && !/Shoulder$/.test(c) && !(n === 'hips' && /Leg$/.test(c)) && !(n === 'chest' && /Shoulder$/.test(c)));
    const end = child ? at[child[0]] : at[END[n]];
    return { name: n, a: at[n], b: end ?? at[n], region: REGION(n) };
  });
  const regionBones = {};
  for (const r of ['legL', 'legR', 'armL', 'armR', 'trunk']) regionBones[r] = names.map((n, i) => [n, i]).filter(([n]) => REGION(n) === r || MEETS[r].includes(n)).map(([, i]) => i);
  const pw = cls === 'mascot' ? 8 : 4;
  const out = [];
  // all vertices, native frame, with a position key so seams (a vertex split for its uv) smooth as one
  for (const { P, idx } of prims) {
    const n = P.length / 3;
    const w = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = toNative([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      let best = Infinity, region = 'trunk';
      const d = segs.map((s) => segDist(p, s.a, s.b));
      d.forEach((v, k) => { if (v < best) { best = v; region = segs[k].region; } });
      const row = new Float64Array(names.length);
      let sum = 0;
      for (const k of regionBones[region]) { const v = 1 / Math.pow(d[k] + 1e-4, pw); row[k] = v; sum += v; }
      for (let k = 0; k < row.length; k++) row[k] /= sum;
      w[i] = row;
    }
    // smoothing over the mesh's own edges (two passes for a body, one for a mascot), shared positions as one vertex
    const key = new Map(), keyOf = new Array(n);
    for (let i = 0; i < n; i++) { const k = `${Math.round(P[i * 3] * 1e5)},${Math.round(P[i * 3 + 1] * 1e5)},${Math.round(P[i * 3 + 2] * 1e5)}`; if (!key.has(k)) key.set(k, key.size); keyOf[i] = key.get(k); }
    const nbr = Array.from({ length: key.size }, () => new Set());
    for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = keyOf[idx[t + e]], b = keyOf[idx[t + (e + 1) % 3]]; if (a !== b) { nbr[a].add(b); nbr[b].add(a); } }
    let K = Array.from({ length: key.size }, () => new Float64Array(names.length));
    const cnt = new Array(key.size).fill(0);
    for (let i = 0; i < n; i++) { const k = keyOf[i]; for (let j = 0; j < names.length; j++) K[k][j] += w[i][j]; cnt[k]++; }
    K.forEach((row, k) => { for (let j = 0; j < row.length; j++) row[j] /= cnt[k]; });
    for (let pass = 0; pass < (cls === 'mascot' ? 1 : 2); pass++) {
      const next = K.map((row, k) => {
        const o = Float64Array.from(row, (v) => v * 0.5);
        const ns = [...nbr[k]];
        if (!ns.length) return Float64Array.from(row);
        for (const m of ns) for (let j = 0; j < o.length; j++) o[j] += (0.5 * K[m][j]) / ns.length;
        return o;
      });
      K = next;
    }
    const J = new Uint8Array(n * 4), W = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const row = K[keyOf[i]];
      const top = [...row].map((v, j) => [j, v]).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4).filter((e) => e[1] > 1e-4);
      const s = top.reduce((t, e) => t + e[1], 0) || 1;
      top.forEach(([j, v], k) => { J[i * 4 + k] = j; W[i * 4 + k] = v / s; });
      if (!top.length) { J[i * 4] = 0; W[i * 4] = 1; }
    }
    out.push({ J, W });
  }
  return out;
}

// ── the whole ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** An unrigged biped rigged onto the vajra, as a skinned GLB (see the header). */
export function autoRig(glb, { as = null, shape = null } = {}) {
  const baked = bakeRest(glb);
  const tris = [];
  for (const { P, idx } of baked.prims) for (const i of idx) { const q = toNative([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); tris.push(q[0], q[1], q[2]); }
  const sh = shape ?? classifyShape(tris);
  const cls = as ?? sh.class;
  if (cls !== 'body' && cls !== 'mascot') throw fail(`it reads as a ${cls} (${sh.basis}): a body or a mascot is rigged onto the vajra; say \`as: 'body'\` or \`as: 'mascot'\` if it is one`);
  const fit = fitLandmarks(tris, sh, cls);
  const weights = solveWeights(baked.prims, fit.at, cls);
  // the skeleton: joints at the fitted landmarks (glTF frame, translations only), each the child of its parent
  const { json, bin } = baked;
  const base = json.nodes.length;
  const names = FIT_BONES.map(([n]) => n);
  const world = names.map((n) => toGltf(fit.at[n]));
  names.forEach((n, i) => {
    const p = FIT_BONES[i][1], pi = p ? names.indexOf(p) : -1;
    json.nodes.push({ name: n, translation: (pi < 0 ? world[i] : sub(world[i], world[pi])).map(r4), children: [] });
    if (pi >= 0) json.nodes[base + pi].children.push(base + i);
  });
  for (const nd of json.nodes.slice(base)) if (!nd.children.length) delete nd.children;
  json.nodes[0].skin = 0;
  json.scenes[0].nodes = [0, base];
  // the inverse binds: each joint's world translation undone (the joints carry no turn), the mesh's world its own
  const parts = [bin];
  let size = bin.length;
  const view = (buf, target) => {
    const at = (size + 3) & ~3; if (at > size) parts.push(Buffer.alloc(at - size)); parts.push(buf); size = at + buf.length;
    json.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: buf.length, ...(target ? { target } : {}) });
    return json.bufferViews.length - 1;
  };
  const ibm = Buffer.alloc(names.length * 64);
  world.forEach((t, i) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -t[0], -t[1], -t[2], 1].forEach((v, k) => ibm.writeFloatLE(v, i * 64 + k * 4)));
  json.accessors.push({ bufferView: view(ibm), componentType: 5126, count: names.length, type: 'MAT4' });
  json.skins = [{ name: 'vajra', joints: names.map((_, i) => base + i), inverseBindMatrices: json.accessors.length - 1, skeleton: base }];
  json.meshes[0].primitives.forEach((prim, k) => {
    const { J, W } = weights[k];
    json.accessors.push({ bufferView: view(Buffer.from(J.buffer, J.byteOffset, J.byteLength), 34962), componentType: 5121, count: J.length / 4, type: 'VEC4' });
    prim.attributes.JOINTS_0 = json.accessors.length - 1;
    const wb = Buffer.alloc(W.length * 4); W.forEach((v, i) => wb.writeFloatLE(v, i * 4));
    json.accessors.push({ bufferView: view(wb, 34962), componentType: 5126, count: W.length / 4, type: 'VEC4' });
    prim.attributes.WEIGHTS_0 = json.accessors.length - 1;
  });
  const merged = Buffer.concat(parts);
  json.buffers = [{ byteLength: merged.length }];
  json.asset.generator = 'mojulo import (auto-rig onto the vajra)';
  return { bytes: packGlb(json, merged), landmarks: fit.at, class: cls, shape: sh, ledger: { ...fit.ledger, ...baked.ledger, forward: fit.forward } };
}
