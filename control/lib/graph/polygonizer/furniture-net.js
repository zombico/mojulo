/**
 * furniture-net — assemble a furniture box-net from planner geometry + data cards.
 *
 * The furniture twin of vehicle-face-net.js's buildFaceNetSceneShapes: given a
 * projected room-planner height-manji (footprint, top plane, support pins,
 * meru height) and a furniture net descriptor, it embeds each face's data card
 * onto the matching box face via the shared embedSurfaceQuad and emits
 * renderer-native marks. Faces a card leaves unpainted stay transparent, so the
 * legs at the support pins show through.
 *
 * Output marks are screen-space polygons/lines ({ kind, points:[[x,y],...],
 * fill, stroke, strokeWidth, role, dist }) — `dist` is camera distance for the
 * painter's sort. Stage 3 adapts this to feed expandBoxNetMark in neo-rembrandt.
 */

import { embedSurfaceQuad, cylinderSurfaceSegments } from './box-net.js';
import { getFurnitureNet, getFurnitureFaceCard } from './furniture-cards.js';

const DEFAULT_LIGHT = normalize3([0.34, 0.40, -0.85]);

// ── vec helpers ─────────────────────────────────────────────────────────────
function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function len3(a) { return Math.hypot(a[0], a[1], a[2]); }
function normalize3(a) { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function centroid3(cs) { const s = cs.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]); return [s[0] / cs.length, s[1] / cs.length, s[2] / cs.length]; }
function faceNormal(cs, toward) {
  let n = normalize3(cross3(sub3(cs[1], cs[0]), sub3(cs[2], cs[0])));
  if (toward && dot3(n, sub3(toward, centroid3(cs))) < 0) n = [-n[0], -n[1], -n[2]];
  return n;
}

// ── color ──────────────────────────────────────────────────────────────────
function hexToRgb(h) { const s = String(h).replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
function rgbToHex(rgb) { const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`; }
function scaleColor(hex, f) { if (!/^#[0-9a-f]{6}$/i.test(String(hex))) return hex; return rgbToHex(hexToRgb(hex).map((v) => v * f)); }
function shade(color, style, factor) { return style === 'shaded' ? scaleColor(color, factor) : color; }

// The builder speaks three modes: 'shaded' (vexar Lambert matte), 'flat'
// (flat-color fills + strokes), 'wireframe' (strokes only). But the scene-level
// `renderStyle` axis is shared with painted-landscape, whose vocabulary is
// 'painterly' | 'topographic' | 'wireframe' (see RENDER_STYLES there). This
// normalizer reconciles the two so a scene authored in EITHER vocabulary lights
// its furniture coherently, instead of silently falling through to flat on an
// unrecognized value. Unknown → 'shaded' (the codified default per the
// 2026-06-10 vexar decision), so a typo reads as the default look, not a blank.
const STYLE_ALIASES = Object.freeze({
  shaded: 'shaded',
  painterly: 'shaded',   // landscape's Lambert-blocks ≡ furniture's vexar matte
  flat: 'flat',
  topographic: 'flat',   // landscape's bordered vector-map ≡ furniture's flat-vector
  wireframe: 'wireframe',
});
/** Collapse a furniture- OR landscape-vocabulary style into the builder's three modes. */
export function normalizeFurnitureStyle(style) { return STYLE_ALIASES[style] || 'shaded'; }

// ── part → marks (the data-grammar renderer) ────────────────────────────────
function pt(embed, u, v) { const p = embed(u, v); return [p.x, p.y]; }
function quadPoints(embed, u0, v0, u1, v1) { return [pt(embed, u0, v0), pt(embed, u1, v0), pt(embed, u1, v1), pt(embed, u0, v1)]; }

function fillMark(points, part, style, factor, dist) {
  if (style === 'wireframe') {
    return { kind: 'polygon', points, fill: 'none', stroke: part.stroke || part.fill || '#000', strokeWidth: 0.8, role: part.role, dist };
  }
  return {
    kind: 'polygon', points,
    fill: part.fill ? shade(part.fill, style, factor) : 'none',
    stroke: part.stroke ? shade(part.stroke, style, factor) : 'none',
    strokeWidth: part.strokeWidth || 0,
    opacity: part.opacity,
    role: part.role, dist,
  };
}

/** Expand one data part onto an embedded face. Returns an array of marks. */
export function partToMarks(part, embed, style, factor, dist) {
  switch (part.kind) {
    case 'band':
      return [fillMark(quadPoints(embed, 0, part.v, 1, part.v + part.h), part, style, factor, dist)];
    case 'rect':
      return [fillMark(quadPoints(embed, part.u, part.v, part.u + part.w, part.v + part.h), part, style, factor, dist)];
    case 'repeat': {
      const span = part.u1 - part.u0;
      const gap = part.gap ?? 0;
      const w = part.w ?? (span - gap * (part.count - 1)) / part.count;
      const step = part.count > 1 ? (span - w) / (part.count - 1) : 0;
      const out = [];
      for (let i = 0; i < part.count; i += 1) {
        const u0 = part.u0 + i * step;
        const fill = Array.isArray(part.fills) ? part.fills[i % part.fills.length] : part.fill;
        out.push(fillMark(quadPoints(embed, u0, part.v, u0 + w, part.v + part.h), { ...part, fill }, style, factor, dist));
      }
      return out;
    }
    case 'poly':
      return [fillMark(part.points.map((p) => pt(embed, p.u, p.v)), part, style, factor, dist)];
    case 'circle': {
      // r is a fraction of the face v-extent; correct u so the disc stays round.
      const du = (part.r * embed.vLen) / (embed.uLen || embed.vLen || 1);
      const points = [];
      for (let i = 0; i < 20; i += 1) { const t = (Math.PI * 2 * i) / 20; points.push(pt(embed, part.u + du * Math.cos(t), part.v + part.r * Math.sin(t))); }
      return [fillMark(points, part, style, factor, dist)];
    }
    case 'line': {
      const a = pt(embed, part.u0, part.v0); const b = pt(embed, part.u1, part.v1);
      const stroke = style === 'wireframe' ? (part.stroke || '#000') : shade(part.stroke || '#000', style, factor);
      return [{ kind: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke, strokeWidth: part.strokeWidth || 1, role: part.role, dist }];
    }
    default:
      return [];
  }
}

function renderCard(card, embed, style, factor, dist) {
  if (!card) return [];
  return card.parts.flatMap((part) => partToMarks(part, embed, style, factor, dist));
}

// ── box-net assembly from a projected planner manji ─────────────────────────
function faceCornersFromManji(manji) {
  const base = manji.element.worldCorners; // floor quad [a,b,c,d]
  const top = manji.topPlane.corners;       // lifted quad
  return {
    center: top,
    front: [base[0], base[1], top[1], top[0]],
    right: [base[1], base[2], top[2], top[1]],
    back: [base[2], base[3], top[3], top[2]],
    left: [base[3], base[0], top[0], top[3]],
  };
}

const LEG_HEX = '#7a5b33';

function lambertFor(normal, light) {
  return 0.55 + 0.55 * Math.max(0, dot3(normal, [-light[0], -light[1], -light[2]]));
}

function legMarks(manji, project, style, light, center, cameraPosition) {
  const out = [];
  for (const s of manji.supports) {
    const height = s.top[2] - s.bottom[2];
    const legDist = cameraPosition
      ? len3(sub3([s.bottom[0], s.bottom[1], s.bottom[2] + height / 2], cameraPosition))
      : 0;
    if (s.kind === 'cylinder') {
      // Round leg: tessellated front arc (back-face culled) + per-segment Lambert.
      const segs = cylinderSurfaceSegments({
        center: [s.bottom[0], s.bottom[1]], radius: s.radius || 0.04, height, z0: s.bottom[2],
        project, cameraPosition, segments: 10,
      });
      for (const seg of segs) {
        const points = seg.corners.map((c) => [c.x, c.y]);
        if (style === 'wireframe') {
          out.push({ kind: 'polygon', points, fill: 'none', stroke: '#3a2c19', strokeWidth: 0.6, role: 'leg', dist: legDist });
        } else {
          out.push({ kind: 'polygon', points, fill: shade(LEG_HEX, style, lambertFor(seg.normal, light)), stroke: 'none', strokeWidth: 0, role: 'leg', dist: legDist });
        }
      }
    } else {
      // Block leg: flat camera-facing quad.
      const r = (s.radius || 0.04) * 1.6;
      const corners = [
        [s.bottom[0] - r, s.bottom[1], s.bottom[2]], [s.bottom[0] + r, s.bottom[1], s.bottom[2]],
        [s.top[0] + r, s.top[1], s.top[2] - 0.06], [s.top[0] - r, s.top[1], s.top[2] - 0.06],
      ];
      const factor = lambertFor(faceNormal(corners, center), light);
      const part = { kind: 'band', v: 0, h: 1, role: 'leg', fill: LEG_HEX, stroke: '#3a2c19', strokeWidth: 0.6 };
      out.push(...partToMarks(part, embedSurfaceQuad(corners, project), style, factor, legDist));
    }
  }
  return out;
}

// Painter's-sort key: world distance of a face centroid from the camera.
function camDist(corners, cameraPosition) {
  if (!cameraPosition) return 0;
  return len3(sub3(centroid3(corners), cameraPosition));
}

/**
 * Build a furniture box-net's marks from a projected planner height-manji.
 * @param {object} opts
 * @param {string} opts.type        planner element type (table | cabinet | chair | …)
 * @param {object} opts.manji       a projectRoomHeightManjis entry (has element.worldCorners, topPlane, supports)
 * @param {(p:number[])=>{x:number,y:number,depth?:number}} opts.project  scene camera
 * @param {string} [opts.style]     'shaded' | 'flat' | 'wireframe'
 * @param {number[]} [opts.light]   world light direction
 * @returns {Array} marks, each tagged with `dist` for the painter's sort
 */
export function buildFurnitureNet({ type, manji, project, cameraPosition, style = 'shaded', light = DEFAULT_LIGHT }) {
  const net = getFurnitureNet(type);
  if (!net) return [];
  const faces = faceCornersFromManji(manji);
  const center = centroid3([...manji.element.worldCorners, ...manji.topPlane.corners]);
  const marks = [];

  // legs first (painted behind the box faces near them).
  if (Array.isArray(manji.supports) && manji.supports.length) {
    marks.push(...legMarks(manji, project, style, light, center, cameraPosition));
  }

  // four cardinal sides, then center (top) — center painted last (nearest from above).
  for (const slot of ['front', 'right', 'back', 'left', 'center']) {
    const corners = faces[slot];
    const card = getFurnitureFaceCard(net.faces[slot]);
    const factor = 0.55 + 0.55 * Math.max(0, dot3(faceNormal(corners, center), [-light[0], -light[1], -light[2]]));
    const embed = embedSurfaceQuad(corners, project);
    const dist = camDist(corners, cameraPosition) - (slot === 'center' ? 0.2 : 0);
    marks.push(...renderCard(card, embed, style, factor, dist));
  }
  return marks;
}
