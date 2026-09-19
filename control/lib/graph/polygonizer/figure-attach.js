/**
 * figure-attach — mount a workbench recipe on a figure landmark, and let it ride the pose.
 *
 * `buildHeldShield` (figure-render.js) proved the seam: lower a workbench recipe with the leaf
 * face-lowerers, scale it to the figure, place it on the posed forearm, and it composites with the
 * body and follows the pose. But it is welded to ONE prop and ONE landmark — an ms-shield between
 * elbow and wrist. A character with a helmet, a spear and greaves needs the same move at four more
 * places, and a fifth next week.
 *
 * This is that move, generalised. The division of labour it unlocks is the whole point:
 *
 *   BODY        — the figure family, parametrically (`cast:'chibi'` + `proto` + a wardrobe).
 *                 Already solved; nothing to sculpt, and it poses and animates for free.
 *   ACCESSORIES — workbench recipes, the object lane (lathe / extrude / sweep / field …).
 *                 Manufactured gear is exactly what that lane is for.
 *   THIS FILE   — the seam between them.
 *
 * Going body-first is also what makes articulation free. Fitting an armature to a finished mesh is
 * a research problem; hanging gear off an armature that already exists is arithmetic.
 *
 * Spec, per attachment:
 *   { id, recipe,                  a workbench manifest (its monomer arrays are lowered here)
 *     at,                          a landmark name, or [a, b] with `t` to lerp along the bone
 *     t?      = 0.5,               position along an [a, b] pair
 *     size?   = 0.3,               target extent in STAND units (see `fit`). MEASURE THE FIGURE
 *                                  FIRST — a cast changes the scale it is relative to: measured at
 *                                  `headTop`, the default armature stands ~0.93 and a `chibi` ~0.52.
 *                                  Better still, declare a fractional `span` through figure-cluster
 *                                  and never write an absolute here at all.
 *     fit?    = 'height',          which extent `size` means — height | width | depth | max
 *     anchor? = 'center',          which point of the prop lands on the mount — center|base|top
 *     offset? = [0,0,0],           figure-frame nudge, STAND units, applied after placement
 *     rotate? = [0,0,0],           degrees about the prop's own anchor, applied BEFORE fitting
 *     align?  = null }             'bone' turns the prop's +z to the a→b direction
 *
 * Order is rotate → align → fit → anchor → place → offset, so `size` always means the extent of
 * the prop AS ORIENTED, which is what an author is actually looking at.
 *
 * Pure and deterministic: fixed iteration order, no dice. A prop that fails to lower returns no
 * faces rather than throwing — a figure renders gearless, never broken, which is the same posture
 * the ms-shield shelf takes.
 */

import { latheToFaces } from './lathe-faces.js';
import { extrudeToFaces } from './extrude-faces.js';
import { sweepToFaces } from './sweep-faces.js';
import { loftToFaces } from './loft-faces.js';
import { shellToFaces } from './shell-faces.js';
import { fieldToFaces } from './field-faces.js';

// Every monomer array a prop recipe may carry, and the leaf lowerer for each. `drapes` is left
// out on purpose: a cloth sheet needs the garment path's two-sided shading, not this one.
// `reliefs` is left out for a harder reason: relief-faces.js reads a font FROM DISK (`node:fs`,
// via lib/motion/glyph-carver.js), and figure-render.js — which imports this file — is reachable
// from the browser bundle through image-outcomes/manifest.js -> sketch-manifest.js -> the client
// sketch surfaces. A static edge to it makes webpack fail the client compile on the `node:` scheme
// (next.config.mjs stubs bare `fs`, which never matches a `node:`-prefixed request), and a lettered
// relief could not run browser-side anyway. Carved lettering stays a workbench-path monomer.
const LOWERERS = [
  ['lathes', latheToFaces],
  ['extrudes', extrudeToFaces],
  ['sweeps', sweepToFaces],
  ['lofts', loftToFaces],
  ['fields', fieldToFaces],
  ['shells', shellToFaces],
];

export const ATTACH_ANCHORS = Object.freeze(['center', 'base', 'top']);
export const ATTACH_FITS = Object.freeze(['height', 'width', 'depth', 'max']);

const num = (v, d) => (Number.isFinite(v) ? v : d);
const triple = (v, d = [0, 0, 0]) => (Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? v : d);

/**
 * Lower a prop recipe to raw faces with `[x,y,z]` corners, in the recipe's OWN coordinates.
 * Imports only leaf lowerers — pulling in workbench.js here would drag the scene/world chain in
 * and cycle back through the renderer.
 */
export function lowerPropFaces(recipe) {
  if (!recipe || typeof recipe !== 'object') return [];
  const out = [];
  for (const [key, lower] of LOWERERS) {
    const rows = Array.isArray(recipe[key]) ? recipe[key] : [];
    for (const spec of rows) {
      try {
        // `latheToFaces` reads its colour from OPTS, not from the spec — pass the same option bag
        // the workbench lowering passes, or every turned part comes back default grey. (Found by
        // the Roman: the crest and blade were coloured and the helmet dome, shield and shaft
        // were not.) Lowerers that read the spec directly ignore the extra keys.
        const tint = spec && (spec.tint || spec.fill || (spec.style && spec.style.fill));
        const faces = lower(spec, { ...(tint ? { tint } : {}), material: spec && spec.material, caps: spec && spec.caps });
        if (Array.isArray(faces)) out.push(...faces);
      } catch { /* one bad monomer must not cost the whole prop */ }
    }
  }
  return out;
}

const asArr = (c) => (Array.isArray(c) ? [c[0], c[1], c[2]] : [c.x, c.y, c.z]);

function boundsOf(faces) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    for (const c of f.corners) {
      const p = asArr(c);
      for (let i = 0; i < 3; i++) { if (p[i] < lo[i]) lo[i] = p[i]; if (p[i] > hi[i]) hi[i] = p[i]; }
    }
  }
  return Number.isFinite(lo[0]) ? { lo, hi } : null;
}

const DEG = Math.PI / 180;
function eulerMatrix([rx, ry, rz]) {
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  // Z then Y then X, applied to a column vector (the order the vocab cards use elsewhere).
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
const apply = (m, p) => [
  m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2],
  m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2],
  m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2],
];

/** Rotation taking unit +z onto `d` (Rodrigues; identity when already aligned, flip when opposed). */
function zToDirection(d) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const v = [d[0] / l, d[1] / l, d[2] / l];
  const c = v[2];                                  // dot(+z, v)
  if (c > 0.999999) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (c < -0.999999) return [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const ax = [-v[1], v[0], 0];                     // cross(+z, v)
  const s2 = ax[0] * ax[0] + ax[1] * ax[1];
  const k = (1 - c) / s2;
  return [
    [1 - k * (ax[1] * ax[1]), k * ax[0] * ax[1], ax[1]],
    [k * ax[0] * ax[1], 1 - k * (ax[0] * ax[0]), -ax[0]],
    [-ax[1], ax[0], 1 - k * s2],
  ];
}

function mountPoint(nodes, at, t) {
  if (typeof at === 'string') {
    const n = nodes[at];
    return n ? { p: [n.x, n.y, n.z], dir: null } : null;
  }
  if (Array.isArray(at) && at.length === 2) {
    const a = nodes[at[0]], b = nodes[at[1]];
    if (!a || !b) return null;
    const u = num(t, 0.5);
    return {
      p: [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u],
      dir: [b.x - a.x, b.y - a.y, b.z - a.z],
    };
  }
  return null;
}

/**
 * Build the attached props for a posed figure.
 *
 * @param {object} nodes   the POSED, balanced armature map (STAND units) — mount on this, not the
 *                         rest pose, or the gear sits where the figure used to be.
 * @param {Array}  list    attachment specs
 * @param {number} scale   STAND → render world (the caller's PROTO_SCALE)
 * @returns {Array<{id:string, faces:Array}>}  same currency the held-shield seam returns
 */
export function buildAttachments(nodes, list, scale = 1) {
  if (!Array.isArray(list) || !list.length || !nodes) return [];
  const out = [];
  list.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') return;
    const id = typeof spec.id === 'string' && spec.id ? spec.id : `attach${i}`;
    const mount = mountPoint(nodes, spec.at, spec.t);
    if (!mount) return;                                  // unknown landmark — gearless, never fatal
    const raw = lowerPropFaces(spec.recipe);
    if (!raw.length) return;

    // 1. orient, in the prop's own frame
    let m = eulerMatrix(triple(spec.rotate));
    if (spec.align === 'bone' && mount.dir) {
      const r = zToDirection(mount.dir);
      m = [0, 1, 2].map((a) => [0, 1, 2].map((b) => r[a][0] * m[0][b] + r[a][1] * m[1][b] + r[a][2] * m[2][b]));
    }
    const oriented = raw.map((f) => ({ ...f, pts: f.corners.map((c) => apply(m, asArr(c))) }));

    // 2. measure AS ORIENTED, so `size` means what the author is looking at
    const b = boundsOf(oriented.map((f) => ({ corners: f.pts })));
    if (!b) return;
    const ext = [b.hi[0] - b.lo[0], b.hi[1] - b.lo[1], b.hi[2] - b.lo[2]];
    const fit = ATTACH_FITS.includes(spec.fit) ? spec.fit : 'height';
    const span = fit === 'width' ? ext[0] : fit === 'depth' ? ext[1] : fit === 'max' ? Math.max(...ext) : ext[2];
    const k = num(spec.size, 0.3) / (span || 1);

    // 3. the prop point that lands on the landmark
    const anchor = ATTACH_ANCHORS.includes(spec.anchor) ? spec.anchor : 'center';
    const ap = [
      (b.lo[0] + b.hi[0]) / 2,
      (b.lo[1] + b.hi[1]) / 2,
      anchor === 'base' ? b.lo[2] : anchor === 'top' ? b.hi[2] : (b.lo[2] + b.hi[2]) / 2,
    ];

    // 4. place, nudge, and into render world
    const off = triple(spec.offset);
    const mp = [mount.p[0] + off[0], mount.p[1] + off[1], mount.p[2] + off[2]];
    const faces = oriented.map((f) => ({
      fill: f.fill,
      doubleSided: f.doubleSided,
      ...(f.outNormal ? { outNormal: f.outNormal } : {}),
      corners: f.pts.map((p) => ({
        x: (mp[0] + (p[0] - ap[0]) * k) * scale,
        y: (mp[1] + (p[1] - ap[1]) * k) * scale,
        z: (mp[2] + (p[2] - ap[2]) * k) * scale,
      })),
    }));
    out.push({ id: `attach:${id}`, faces });
  });
  return out;
}

/** Mint-time validation, so a bad mount is a clear 400 rather than a silently gearless figure. */
export function validateAttachments(list, nodeNames) {
  const errors = [];
  if (list == null) return errors;
  if (!Array.isArray(list)) return ['attachments: must be an array'];
  const known = nodeNames instanceof Set ? nodeNames : new Set(nodeNames || []);
  const nameOk = (n) => !known.size || known.has(n);
  list.forEach((spec, i) => {
    const at = `attachments[${i}]`;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) { errors.push(`${at}: must be an object`); return; }
    if (!spec.recipe || typeof spec.recipe !== 'object') errors.push(`${at}.recipe: required — a workbench manifest (lathes / extrudes / sweeps / lofts / fields / shells)`);
    if (typeof spec.at === 'string') {
      if (!nameOk(spec.at)) errors.push(`${at}.at: unknown landmark '${spec.at}'`);
    } else if (Array.isArray(spec.at)) {
      if (spec.at.length !== 2 || !spec.at.every((n) => typeof n === 'string')) errors.push(`${at}.at: a pair must be [landmarkA, landmarkB]`);
      else for (const n of spec.at) if (!nameOk(n)) errors.push(`${at}.at: unknown landmark '${n}'`);
    } else {
      errors.push(`${at}.at: required — a landmark name, or [a, b] to lerp along a bone`);
    }
    if (spec.anchor !== undefined && !ATTACH_ANCHORS.includes(spec.anchor)) errors.push(`${at}.anchor: must be one of ${ATTACH_ANCHORS.join(' | ')}`);
    if (spec.fit !== undefined && !ATTACH_FITS.includes(spec.fit)) errors.push(`${at}.fit: must be one of ${ATTACH_FITS.join(' | ')}`);
    if (spec.size !== undefined && !(Number.isFinite(spec.size) && spec.size > 0)) errors.push(`${at}.size: must be a positive number (STAND units)`);
    if (spec.align !== undefined && spec.align !== 'bone') errors.push(`${at}.align: the only value is 'bone' (needs \`at\` to be a pair)`);
    if (spec.align === 'bone' && !Array.isArray(spec.at)) errors.push(`${at}.align: 'bone' needs \`at\` to be a [a, b] pair to take a direction from`);
  });
  return errors;
}
