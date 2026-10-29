/**
 * rig-import — a model made ELSEWHERE worn as a skin over layer 0 (docs/foes.md): a rigged humanoid glTF binary (a
 * Mixamo, VRM, Unreal mannequin or Rigify export) read into the packed rig every foe body is (station-loft-rig.js
 * packLayeredRig's shape: `{ rig, layered, bones: [{ id, head, tail }], parts, clips, figH }`), so every shelf that
 * addresses layer 0 (the cuts, the shed, the states, the target rim, the library's clips) takes it as it takes our own.
 *
 *   importRig(bytes, { height?, images? })  → { pack, ledger }
 *     bytes    the .glb (a skinned mesh: JOINTS_0 / WEIGHTS_0 under a skin); a model with no skin is refused by name
 *     height   metres the figure is scaled to stand (absent: its own, or 1.8 when its own is out of a body's range)
 *     images   { <image index>: { px, W, H } } decoded textures the caller read (a JPEG is decoded off this module:
 *              decodeModelImages); a PNG is read here; an image not given colours by its material's factor alone
 *
 * The read, in order:
 *   1. its BONES BY NAME: each skin joint's humanoid bone (VRM's names) from the file's own VRM map (VRMC_vrm, VRM 0.x)
 *      when it has one, else from the joint's name (JOINT_WORDS: the conventions above, the side from left | right | l | r
 *      as a word); the spine's joints counted up from the hips (spine, chest, the rest the chest's upper part)
 *   2. its REST: every vertex skinned once by its own weights at the nodes' rest (so the armature's own scale and turn are
 *      in it, as an engine draws it), each joint where its node stands
 *   3. its FRAME: turned so its head is up (+z), its right leg on +x and its face to +y (the native frame), standing on
 *      z = 0 over its hips, scaled to `height`
 *   4. its PARTS: each triangle on the bone that moves it most (its corners' weights summed, each joint's weight carried to
 *      the nearest humanoid bone above it), coloured by its material (its factor × its vertex colour × its texture at the
 *      corner, in linear light) and shaded by the studio key as every rig foe's part is; each corner's weights kept, on
 *      the humanoid bones, for an export that skins
 *
 * The bone ids are the hero's (figure-humanoid-map.js HERO_BONE_TO_VRM), so the T-pose mold, the cuts' limbs and the
 * library's retarget read it unchanged. The model's own clips are not read: its states play the clip library's, as every
 * person on the field does. Rigid per bone on the page, as every rig foe is. Pure: the same bytes give the same pack.
 */
import { parseGlb, readAccessor, mul4, trsMatrix, IDENT } from './scene-gltf-read.js';
import { decodePng } from '../era/tone.js';
import { b64f32, b64u8 } from '../figures/rig-bake.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0]; };

/** The studio key every rig foe's parts are shaded by (station-loft-rig.js packLayeredRig's `light`). */
const KEY = unit([0.35, -0.55, 0.75]);
/** A body's height range (metres); a model outside it was written in another unit and stands at DEFAULT_HEIGHT. */
const BODY_RANGE = [0.3, 12], DEFAULT_HEIGHT = 1.8;

// ── names ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A joint's words: its name after any namespace (`mixamorig:`), a Rigify layer (`DEF-`) or a Biped root (`Bip01`),
 * split at case and punctuation, lower case. */
export function jointWords(name) {
  const bare = String(name).replace(/^.*[:|]/, '').replace(/^(DEF|ORG|MCH)[-_.]/i, '').replace(/^Bip0*1[ _]?/i, '').replace(/^CC_Base_/i, '');
  return bare.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}
const SIDE_WORDS = { left: 'left', l: 'left', right: 'right', r: 'right' };
// the words a humanoid bone goes by (the side apart), its VRM name's stem; `spine` is counted up the chain
const JOINT_WORDS = Object.freeze({
  hips: ['hips', 'hip', 'pelvis'],
  spine: ['spine', 'spine0', 'spine1', 'spine2', 'spine3', 'spine4', 'spine5', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine001', 'spine002', 'spine003', 'spine004', 'torso', 'abdomen'],
  chest: ['chest'], upperChest: ['upperchest'],
  neck: ['neck', 'neck1', 'neck01', 'neck001'], head: ['head'],
  Shoulder: ['shoulder', 'clavicle', 'collar'],
  UpperArm: ['arm', 'upperarm', 'uparm'], LowerArm: ['forearm', 'lowerarm'], Hand: ['hand', 'wrist'],
  UpperLeg: ['upleg', 'upperleg', 'thigh'], LowerLeg: ['leg', 'lowerleg', 'calf', 'shin'], Foot: ['foot', 'ankle'], Toes: ['toebase', 'toes', 'toe', 'ball'],
});
const STEM_OF = new Map(Object.entries(JOINT_WORDS).flatMap(([stem, ws]) => ws.map((w) => [w, stem])));
const SIDED = new Set(['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes']);

/** A joint's humanoid bone by its name (VRM's: `leftUpperArm`, `hips`), `spine` for any spine joint, or null (a finger,
 * an eye, a twist, an end: it rides the bone above it). */
export function vrmOfName(name) {
  const w = jointWords(name);
  if (w.some((x) => /^(thumb|index|middle|ring|pinky|little|finger|eye|jaw|twist|roll|end|nub|top|tip|helper|ik|pole|target)/.test(x))) return null;
  const side = w.map((x) => SIDE_WORDS[x]).find(Boolean) ?? null;
  const stem = STEM_OF.get(w.filter((x) => !SIDE_WORDS[x]).join(''));
  if (!stem) return null;
  if (SIDED.has(stem)) return side ? `${side}${stem}` : null;
  return side ? null : stem;
}

// the file's own VRM map (VRMC_vrm 1.0: humanoid.humanBones.<bone>.node; VRM 0.x: humanoid.humanBones[{ bone, node }])
function fileVrmMap(json) {
  const out = new Map();
  const v1 = json.extensions?.VRMC_vrm?.humanoid?.humanBones;
  if (v1 && typeof v1 === 'object') for (const [b, o] of Object.entries(v1)) if (Number.isInteger(o?.node)) out.set(o.node, b);
  const v0 = json.extensions?.VRM?.humanoid?.humanBones;
  if (Array.isArray(v0)) for (const o of v0) if (Number.isInteger(o?.node) && typeof o.bone === 'string') out.set(o.node, o.bone);
  return out.size ? out : null;
}

// VRM bone → the hero's bone id (figure-humanoid-map.js HERO_BONE_TO_VRM, INSERTED_TO_VRM's clavicles)
const BONE_ID = { hips: 'pelvis', neck: 'neck', head: 'head' };
for (const [S, s] of [['L', 'left'], ['R', 'right']]) Object.assign(BONE_ID, { [`${s}Shoulder`]: `clavicle${S}`, [`${s}UpperArm`]: `upperArm${S}`, [`${s}LowerArm`]: `foreArm${S}`, [`${s}Hand`]: `hand${S}`, [`${s}UpperLeg`]: `thigh${S}`, [`${s}LowerLeg`]: `shank${S}`, [`${s}Foot`]: `foot${S}`, [`${s}Toes`]: `toes${S}` });
/** The humanoid bones a model must have to be worn (VRM's required set). */
export const MODEL_REQUIRED = Object.freeze(['hips', 'spine', 'head', ...['left', 'right'].flatMap((s) => ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot'].map((b) => s + b))]);

// ── matrices (column-major, glTF's) ───────────────────────────────────────────────────────────────────────────────
function inv4(m) {
  const a = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  const det = a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det || 1e-30, c = (r, k) => a[(k + 1) % 3][(r + 1) % 3] * a[(k + 2) % 3][(r + 2) % 3] - a[(k + 1) % 3][(r + 2) % 3] * a[(k + 2) % 3][(r + 1) % 3];
  const b = [0, 1, 2].map((r) => [0, 1, 2].map((k) => c(r, k) / d));
  const t = [m[12], m[13], m[14]], bt = [0, 1, 2].map((r) => -(b[r][0] * t[0] + b[r][1] * t[1] + b[r][2] * t[2]));
  return [b[0][0], b[1][0], b[2][0], 0, b[0][1], b[1][1], b[2][1], 0, b[0][2], b[1][2], b[2][2], 0, bt[0], bt[1], bt[2], 1];
}
const xf = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
const xfv = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function sampleImage(img, u, v) {
  const fx = u - Math.floor(u), fy = v - Math.floor(v);
  const x = Math.min(img.W - 1, Math.floor(fx * img.W)), y = Math.min(img.H - 1, Math.floor(fy * img.H)), q = (y * img.W + x) * 4;
  return [toLinear(img.px[q] / 255), toLinear(img.px[q + 1] / 255), toLinear(img.px[q + 2] / 255)];
}
/** The images a model's materials colour by, as bytes: { <image index>: { mime, bytes } } (a caller decodes what this
 * module does not: decodeModelImages). */
export function modelImages(bytes) {
  const { json, bin } = parseGlb(bytes), out = {};
  (json.images || []).forEach((im, i) => {
    const view = json.bufferViews?.[im.bufferView];
    if (!view || !bin) return;
    out[i] = { mime: im.mimeType || null, bytes: bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength) };
  });
  return out;
}

/** Decode every image a model carries: a PNG here, a JPEG or a WebP through sharp when it is installed (an optional
 * worker: absent, that image colours by its factor alone). → { images: { <index>: { px, W, H } }, undecoded: [<index>] } */
export async function decodeModelImages(bytes) {
  const images = {}, undecoded = [];
  for (const [i, im] of Object.entries(modelImages(bytes))) {
    if (im.mime === 'image/png') { const d = decodePng(`data:image/png;base64,${Buffer.from(im.bytes).toString('base64')}`); if (d) { images[i] = d; continue; } }
    try {
      const { default: sharp } = await import('sharp');
      const { data, info } = await sharp(Buffer.from(im.bytes)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      images[i] = { px: data, W: info.width, H: info.height };
    } catch { undecoded.push(Number(i)); }
  }
  return { images, undecoded };
}

// ── the import ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function importRig(bytes, { height = null, images = null } = {}) {
  const { json, bin } = parseGlb(bytes);
  const skin = json.skins?.[0];
  if (!skin) throw new Error('rig-import: the model has no skin (no skeleton it moves by): a rigged humanoid is what is worn as a foe');
  const nodes = json.nodes || [];
  // every node's global matrix at rest, and its parent
  const parent = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
  const G = new Array(nodes.length);
  const glob = (i) => G[i] ?? (G[i] = parent[i] < 0 ? trsMatrix(nodes[i]) : mul4(glob(parent[i]), trsMatrix(nodes[i])));
  nodes.forEach((_, i) => glob(i));
  // each skin's joints, each its skinning matrix at rest (a model may skin its meshes to several skins over one skeleton:
  // a visor's own); the humanoid is read off the first
  const jointsOf = (sk) => {
    const IBM = sk.inverseBindMatrices != null ? readAccessor(json, bin, sk.inverseBindMatrices) : null;
    return sk.joints.map((node, k) => ({ node, name: nodes[node].name || `joint${k}`, M: mul4(G[node], IBM ? IBM.slice(k * 16, k * 16 + 16) : IDENT), at: [G[node][12], G[node][13], G[node][14]] }));
  };
  const J = jointsOf(skin);
  const jointOf = new Map(J.map((j, k) => [j.node, k]));

  // 1. the bones by name
  const own = fileVrmMap(json);
  const vrm = new Map();
  for (const j of J) { const v = own ? own.get(j.node) ?? null : vrmOfName(j.name); if (v) vrm.set(j.node, v); }
  if (!own) {
    // (the spine's joints, up from the hips: the first the spine, the second the chest, the rest the chest's upper part)
    const hips = [...vrm].find(([, v]) => v === 'hips')?.[0];
    const depth = (n) => { let d = 0; for (let p = n; p >= 0; p = parent[p]) d++; return d; };
    const spine = [...vrm].filter(([n, v]) => v === 'spine' && (hips === undefined || (() => { for (let p = parent[n]; p >= 0; p = parent[p]) if (p === hips) return true; return false; })())).map(([n]) => n).sort((a, b) => depth(a) - depth(b) || a - b);
    for (const [n, v] of [...vrm]) if (v === 'spine' && !spine.includes(n)) vrm.delete(n);
    spine.forEach((n, i) => vrm.set(n, i === 0 ? 'spine' : i === 1 ? 'chest' : 'upperChest'));
  }
  // one joint per bone (the first by the skin's order), the upper chest the chest's when both stand
  const nodeOf = {};
  for (const j of J) { const v = vrm.get(j.node); if (v && nodeOf[v] === undefined) nodeOf[v] = j.node; }
  const missing = MODEL_REQUIRED.filter((v) => nodeOf[v] === undefined);
  if (missing.length) throw new Error(`rig-import: not a humanoid skeleton (no ${missing.join(', ')} among its joints: ${J.slice(0, 12).map((j) => j.name).join(', ')}${J.length > 12 ? ' …' : ''}); its bones are read by name (Mixamo, VRM, Unreal, Rigify)`);
  const ids = [];
  const idOf = (v) => (v === 'spine' ? (nodeOf.chest !== undefined ? 'lumbar' : 'torso') : v === 'chest' || v === 'upperChest' ? 'torso' : BONE_ID[v]);
  const ORDER = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', ...['left', 'right'].flatMap((s) => ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes'].map((b) => s + b))];
  const boneOfVrm = {};
  for (const v of ORDER) if (nodeOf[v] !== undefined) { const id = idOf(v); if (!ids.includes(id)) ids.push(id); boneOfVrm[v] = ids.indexOf(id); }
  // each joint's bone: its own, else the nearest humanoid joint above it's (a finger its hand's); above the hips, the hips'
  const boneOfNode = (n) => { for (let p = n; p >= 0; p = parent[p]) { const v = vrm.get(p); if (v && boneOfVrm[v] !== undefined) return boneOfVrm[v]; } return boneOfVrm.hips; };
  const skins = (json.skins || []).map((sk) => { const js = sk === skin ? J : jointsOf(sk); return { J: js, bone: js.map((j) => boneOfNode(j.node)) }; });

  // 2. the rest: every vertex skinned by its own weights
  const tris = [];   // { p: [3][3], n: [3][3] | null, w: [3] Map(bone → weight), col: [3][3] }
  const ledger = { bones: {}, riders: 0, triangles: 0, colour: new Set(), undecoded: [], dropped: [] };
  const meshNodes = nodes.map((n, i) => [n, i]).filter(([n]) => n.mesh !== undefined && n.skin !== undefined);
  for (const [n, ni] of meshNodes) {
    const { J: SJ, bone: jointBone } = skins[n.skin];
    if (!jointBone.some((b) => b !== boneOfVrm.hips) && n.skin !== 0) { ledger.dropped.push(`${n.name || 'a mesh'}: skinned to another skeleton`); continue; }
    for (const prim of json.meshes[n.mesh].primitives || []) {
      if ((prim.mode ?? 4) !== 4) { ledger.dropped.push(`${n.name || 'a mesh'}: a primitive not of triangles`); continue; }
      const A = prim.attributes || {};
      if (A.POSITION === undefined || A.JOINTS_0 === undefined || A.WEIGHTS_0 === undefined) { ledger.dropped.push(`${n.name || 'a mesh'}: a primitive without its weights`); continue; }
      const P = readAccessor(json, bin, A.POSITION), N = A.NORMAL !== undefined ? readAccessor(json, bin, A.NORMAL) : null;
      const JN = readAccessor(json, bin, A.JOINTS_0), WT = readAccessor(json, bin, A.WEIGHTS_0);
      const mat = json.materials?.[prim.material] ?? {}, pbr = mat.pbrMetallicRoughness ?? {};
      const fac = Array.isArray(pbr.baseColorFactor) ? pbr.baseColorFactor : [1, 1, 1, 1];
      const texInfo = pbr.baseColorTexture, img = texInfo ? json.textures?.[texInfo.index]?.source : undefined;
      const tex = img !== undefined ? images?.[img] ?? (() => { const im = modelImages(bytes)[img]; return im?.mime === 'image/png' ? decodePng(`data:image/png;base64,${Buffer.from(im.bytes).toString('base64')}`) : null; })() : null;
      if (img !== undefined && !tex && !ledger.undecoded.includes(img)) ledger.undecoded.push(img);
      const UV = tex && A[`TEXCOORD_${texInfo.texCoord ?? 0}`] !== undefined ? readAccessor(json, bin, A[`TEXCOORD_${texInfo.texCoord ?? 0}`]) : null;
      const C0 = A.COLOR_0 !== undefined ? readAccessor(json, bin, A.COLOR_0) : null, cw = C0 ? json.accessors[A.COLOR_0].type === 'VEC4' ? 4 : 3 : 0;
      ledger.colour.add(UV ? 'texture' : C0 ? 'vertex' : 'factor');
      const count = json.accessors[A.POSITION].count;
      const vert = new Array(count);
      const at = (i) => {
        if (vert[i]) return vert[i];
        const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], w = new Map();
        let pos = [0, 0, 0], nrm = [0, 0, 0], ws = 0;
        for (let k = 0; k < 4; k++) {
          const wk = WT[i * 4 + k]; if (!(wk > 0)) continue;
          const jk = JN[i * 4 + k], j = SJ[jk]; if (!j) continue;
          pos = add(pos, mul(xf(j.M, p), wk)); if (N) nrm = add(nrm, mul(xfv(j.M, [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]]), wk)); ws += wk;
          w.set(jointBone[jk], (w.get(jointBone[jk]) || 0) + wk);
        }
        if (!(ws > 0)) { pos = xf(G[ni], p); w.set(boneOfVrm.hips, 1); ws = 1; }
        let c = [fac[0], fac[1], fac[2]];
        if (C0) c = [c[0] * C0[i * cw], c[1] * C0[i * cw + 1], c[2] * C0[i * cw + 2]];
        if (UV) { const s = sampleImage(tex, UV[i * 2], UV[i * 2 + 1]); c = [c[0] * s[0], c[1] * s[1], c[2] * s[2]]; }
        return (vert[i] = { p: mul(pos, 1 / ws), n: N ? unit(nrm) : null, w, c });
      };
      const idx = prim.indices !== undefined ? readAccessor(json, bin, prim.indices) : Array.from({ length: count }, (_, i) => i);
      for (let t = 0; t + 2 < idx.length; t += 3) tris.push([at(idx[t]), at(idx[t + 1]), at(idx[t + 2])]);
    }
  }
  if (!tris.length) throw new Error('rig-import: the model has no triangles skinned to its skeleton');
  ledger.riders = J.filter((j) => !vrm.has(j.node)).length;

  // 3. the frame: up the hips → head, right the left leg → the right leg, the face to their cross
  const jat = (v) => J[jointOf.get(nodeOf[v])].at;
  const up = unit(sub(jat('head'), jat('hips')));
  const across = sub(jat('rightUpperLeg'), jat('leftUpperLeg'));
  const right = unit(sub(across, mul(up, dot(across, up)))), fwd = cross(up, right);
  const turn = (v) => [dot(right, v), dot(fwd, v), dot(up, v)];
  let lo = Infinity, hi = -Infinity;
  for (const T of tris) for (const c of T) { const z = dot(up, c.p); if (z < lo) lo = z; if (z > hi) hi = z; }
  const own_h = hi - lo, fits = own_h >= BODY_RANGE[0] && own_h <= BODY_RANGE[1];
  const H = Number.isFinite(height) && height > 0 ? height : fits ? own_h : DEFAULT_HEIGHT, s = H / (own_h || 1);
  const hip = turn(jat('hips'));
  const place = (v) => { const q = turn(v); return [(q[0] - hip[0]) * s, (q[1] - hip[1]) * s, (q[2] - lo) * s]; };
  ledger.height = { own: r4(own_h), stands: r4(H), ...(!fits && !(height > 0) ? { rescaled: true } : {}) };

  // the bones: a head at its joint, a tail at the next joint down its chain, a limb's end out to its own flesh
  const restHead = ids.map(() => null);
  for (const v of ORDER) if (boneOfVrm[v] !== undefined && !restHead[boneOfVrm[v]]) { restHead[boneOfVrm[v]] = place(jat(v)); ledger.bones[ids[boneOfVrm[v]]] = J[jointOf.get(nodeOf[v])].name; }
  const parts = ids.map(() => ({ pos: [], col: [], jnt: [], wgt: [], faces: 0 }));
  for (const T of tris) {
    const sum = new Map(); for (const c of T) for (const [b, w] of c.w) sum.set(b, (sum.get(b) || 0) + w);
    const bi = [...sum].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0], P = parts[bi];
    const p = T.map((c) => place(c.p)), fn = unit(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    P.faces++; ledger.triangles++;
    T.forEach((c, k) => {
      const n = c.n ? unit(turn(c.n)) : fn, shade = 0.55 + 0.45 * Math.max(0, dot(n, KEY));
      P.pos.push(...p[k]); P.col.push(c.c[0] * shade, c.c[1] * shade, c.c[2] * shade);
      const top = [...c.w].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), ws = top.reduce((t, e) => t + e[1], 0) || 1;
      while (top.length < 4) top.push([0, 0]);
      P.jnt.push(...top.map((e) => e[0])); P.wgt.push(...top.map((e) => e[1] / ws));
    });
  }
  // a chain's next bone, by VRM name; a limb's end (the head, a hand, a foot without toes, the toes) out along its line
  const NEXT = { hips: ['spine'], spine: ['chest', 'neck', 'head'], chest: ['neck', 'head'], upperChest: ['neck', 'head'], neck: ['head'] };
  for (const s of ['left', 'right']) Object.assign(NEXT, { [`${s}Shoulder`]: [`${s}UpperArm`], [`${s}UpperArm`]: [`${s}LowerArm`], [`${s}LowerArm`]: [`${s}Hand`], [`${s}UpperLeg`]: [`${s}LowerLeg`], [`${s}LowerLeg`]: [`${s}Foot`], [`${s}Foot`]: [`${s}Toes`] });
  const tail = ids.map(() => null);
  const reach = (bi, from, dir) => { const P = parts[bi].pos; let m = 0; for (let k = 0; k < P.length; k += 3) m = Math.max(m, dot(sub([P[k], P[k + 1], P[k + 2]], from), dir)); return m; };
  for (const v of ORDER) {
    const bi = boneOfVrm[v]; if (bi === undefined || tail[bi]) continue;
    if (v === 'chest' && boneOfVrm.upperChest === bi) continue;   // (the torso's tail is the upper chest's)
    const nx = (NEXT[v] || []).find((x) => boneOfVrm[x] !== undefined && boneOfVrm[x] !== bi);
    if (nx) { tail[bi] = restHead[boneOfVrm[nx]]; continue; }
    // a limb's end: the line it carries on (the head up, a hand along its forearm, a foot forward and down to its toes,
    // the toes forward), as far as its own flesh reaches, never shorter than a tenth of its parent bone
    const s = v.startsWith('left') ? 'left' : 'right';
    const from = restHead[bi];
    const prev = v === 'head' ? null : v.endsWith('Hand') ? `${s}LowerArm` : v.endsWith('Foot') ? `${s}LowerLeg` : v.endsWith('Toes') ? `${s}Foot` : null;
    let dir = v === 'head' ? [0, 0, 1] : prev ? unit(sub(from, restHead[boneOfVrm[prev]])) : [0, 0, 1];
    if (v.endsWith('Foot') || v.endsWith('Toes')) dir = unit([0, 1, v.endsWith('Foot') ? -0.25 : 0]);
    const floor = prev ? 0.1 * len(sub(from, restHead[boneOfVrm[prev]])) : 0.05 * H;
    tail[bi] = add(from, mul(dir, Math.max(floor, reach(bi, from, dir))));
  }
  let mx = 0; for (const P of parts) for (let k = 2; k < P.pos.length; k += 3) mx = Math.max(mx, P.pos[k]);
  const pack = {
    rig: true, layered: true,
    bones: ids.map((id, i) => ({ id, head: restHead[i].map(r4), tail: tail[i].map(r4) })),
    parts: parts.map((P) => (P.faces ? { pos: b64f32(P.pos), col: b64u8(P.col), faces: P.faces, jnt: Buffer.from(Uint8Array.from(P.jnt).buffer).toString('base64'), wgt: b64f32(P.wgt) } : null)),
    clips: {}, figH: r4(mx),
  };
  return { pack, ledger: { ...ledger, colour: [...ledger.colour].sort(), joints: J.length } };
}
