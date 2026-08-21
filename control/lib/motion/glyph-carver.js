/**
 * glyph-carver — turn any UTF-8 character into a CARVED 3D solid, tunably.
 *
 * The carver is the workflow's reusable method: (char + style) → an extruded
 * prism (front/back caps + cut walls) the renderer can place, light (vexar), and
 * project. It is font-backed via opentype.js, so it reaches ANY character the
 * supplied font covers — Latin, accents, symbols, CJK — instead of hand-authored
 * silhouettes. Style is a separate knob set (depth, weight, blocky, slant), so
 * the SAME pipeline yields slick-thin or chunky-blocky treatments. Pure geometry:
 * no camera, no shading here — that stays with the renderer.
 *
 * char ─opentype outline→ contours (em, y-up; holes are just more contours, drawn
 *   evenodd) ─style→ transformed contours ─extrude→ { frontContours, backContours,
 *   walls } in a local frame (x right, y up, z = depth: 0 front … depth back).
 *
 * See lite-template/integration/0610/kinetic-typography.plan.md (the carver).
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
// Lazy so the font lib is only pulled when a font is actually parsed. Keeping it
// off module-load means an ops install that never carves text can shed
// opentype.js (an optionalDependency) without breaking `next build`'s page-data
// collection, which module-loads every route. Same deferral posture as
// beats-render's node-web-audio-api import. require() is sync, so no async churn.
let _opentype;
const opentype = () => (_opentype ??= require('opentype.js'));   // resolved from control/node_modules

/** Parse a font from a path or a Buffer/ArrayBuffer. The caller picks the font,
 *  so "different fonts for different looks" is just a different buffer. */
export function loadFont(pathOrBuffer) {
  const buf = typeof pathOrBuffer === 'string' ? readFileSync(pathOrBuffer) : pathOrBuffer;
  const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return opentype().parse(ab);
}

const qbez = (p0, c, p1, t) => { const m = 1 - t; return [m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1]]; };
const cbez = (p0, c1, c2, p1, t) => { const m = 1 - t; return [m*m*m*p0[0] + 3*m*m*t*c1[0] + 3*m*t*t*c2[0] + t*t*t*p1[0], m*m*m*p0[1] + 3*m*m*t*c1[1] + 3*m*t*t*c2[1] + t*t*t*p1[1]]; };

/** Flatten a glyph's outline into closed contours in em space (y UP, baseline 0). */
export function glyphContours(font, char, { curveSteps = 10 } = {}) {
  const glyph = font.charToGlyph(char);
  const upm = font.unitsPerEm;
  const cmds = glyph.getPath(0, 0, upm).commands;     // SVG coords: y DOWN, baseline 0
  const em = ([x, y]) => [x / upm, -y / upm];          // → em, y up
  const contours = [];
  let cur = null, p0 = null;
  for (const c of cmds) {
    if (c.type === 'M') { if (cur && cur.length > 2) contours.push(cur); cur = [em([c.x, c.y])]; p0 = [c.x, c.y]; }
    else if (c.type === 'L') { cur.push(em([c.x, c.y])); p0 = [c.x, c.y]; }
    else if (c.type === 'Q') { for (let i = 1; i <= curveSteps; i++) cur.push(em(qbez(p0, [c.x1, c.y1], [c.x, c.y], i / curveSteps))); p0 = [c.x, c.y]; }
    else if (c.type === 'C') { for (let i = 1; i <= curveSteps; i++) cur.push(em(cbez(p0, [c.x1, c.y1], [c.x2, c.y2], [c.x, c.y], i / curveSteps))); p0 = [c.x, c.y]; }
    else if (c.type === 'Z') { if (cur && cur.length > 2) contours.push(cur); cur = null; }
  }
  if (cur && cur.length > 2) contours.push(cur);
  return { contours: contours.map(dedupe), advance: glyph.advanceWidth / upm };
}

function dedupe(ring) {
  const out = [];
  for (const p of ring) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p); }
  if (out.length > 1) { const a = out[0], b = out[out.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) out.pop(); }
  return out;
}

const signedArea = (ring) => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return s / 2; };

/**
 * Style transforms in em space. `weight` dilates(+)/erodes(−) the solid;
 * `blocky` snaps to a 1/N grid (staircased, chunky); `slant` shears (italic).
 */
export function styleContours(contours, { weight = 0, blocky = 0, slant = 0 } = {}) {
  let out = contours;
  if (weight) out = out.map((ring) => {
    const sgn = Math.sign(signedArea(ring)) || 1;   // grow the solid for outer AND hole
    return ring.map((p, i) => {
      const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length];
      const e1 = norm([p[0] - a[0], p[1] - a[1]]), e2 = norm([b[0] - p[0], b[1] - p[1]]);
      const nrm = norm([(e1[1] + e2[1]) * sgn, -(e1[0] + e2[0]) * sgn]);   // outward of solid
      return [p[0] + nrm[0] * weight, p[1] + nrm[1] * weight];
    });
  });
  if (slant) out = out.map((ring) => ring.map(([x, y]) => [x + slant * y, y]));
  if (blocky) out = out.map((ring) => dedupe(ring.map(([x, y]) => [Math.round(x * blocky) / blocky, Math.round(y * blocky) / blocky]))).filter((r) => r.length > 2);
  return out;
}
const norm = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/**
 * Carve one glyph into a local-frame prism. Returns { char, advance, depth,
 * frontContours, backContours, walls } where points are [x, y, z], z∈[0,depth].
 * The renderer transforms → world, computes normals, shades (vexar), projects.
 */
export function carveGlyph(font, char, style = {}) {
  const { depth = 0.55 } = style;
  const { contours, advance } = glyphContours(font, char, style);
  const styled = styleContours(contours, style);
  const front = styled.map((ring) => ring.map(([x, y]) => [x, y, 0]));
  const back = styled.map((ring) => ring.map(([x, y]) => [x, y, depth]));
  const walls = [];
  styled.forEach((ring, ci) => {
    const F = front[ci], B = back[ci];
    for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; walls.push([F[i], F[j], B[j], B[i]]); }
  });
  return { char, advance, depth, frontContours: front, backContours: back, walls };
}

/**
 * Carve a whole string: lay glyphs left-to-right by advance (+tracking), centre
 * the run on x=0. Returns { glyphs, width } with every point already positioned
 * (still in em units; the renderer scales/places the run as a block).
 */
export function carveText(font, text, style = {}) {
  const { tracking = 0.06, depth = 0.55 } = style;
  let cursor = 0;
  const placed = [];
  for (const ch of [...text]) {
    if (ch === ' ') { cursor += 0.45 + tracking; continue; }
    const g = carveGlyph(font, ch, style);
    placed.push({ g, x: cursor });
    cursor += g.advance + tracking;
  }
  const width = Math.max(cursor - tracking, 0.001);
  const shift = -width / 2;
  const off = (rings, dx) => rings.map((r) => r.map(([x, y, z]) => [x + dx, y, z]));
  const glyphs = placed.map(({ g, x }) => ({
    char: g.char, depth,
    frontContours: off(g.frontContours, x + shift),
    backContours: off(g.backContours, x + shift),
    walls: g.walls.map((q) => q.map(([px, py, pz]) => [px + x + shift, py, pz])),
  }));
  return { glyphs, width };
}

/**
 * Lay a string out into positioned 2D contours (em, y up; run centred on x=0),
 * WITHOUT extruding. The carved-solid render primitive extrudes these through
 * carve-solid.extrudeProfile (so text gains the same bevel/metal as shapes).
 * Returns { glyphs: [{ char, contours }], width }.
 */
export function layoutText(font, text, style = {}) {
  const { tracking = 0.06 } = style;
  let cursor = 0;
  const placed = [];
  for (const ch of [...text]) {
    if (ch === ' ') { cursor += 0.45 + tracking; continue; }
    const { contours, advance } = glyphContours(font, ch, style);
    placed.push({ ch, contours: styleContours(contours, style), x: cursor });
    cursor += advance + tracking;
  }
  const width = Math.max(cursor - tracking, 0.001), shift = -width / 2;
  const glyphs = placed.map(({ ch, contours, x }) => ({
    char: ch,
    contours: contours.map((r) => r.map(([px, py]) => [px + x + shift, py])),
  }));
  return { glyphs, width };
}

/** Named style presets — the "different styles" surface. Tunable / extensible. */
export const CARVE_STYLES = {
  slick:   { depth: 0.5, weight: 0, blocky: 0, tracking: 0.05, curveSteps: 12 },
  blocky:  { depth: 0.62, weight: 0.012, blocky: 12, tracking: 0.07, curveSteps: 10 },
  heavy:   { depth: 0.8, weight: 0.03, blocky: 0, tracking: 0.06, curveSteps: 12 },
  thin:    { depth: 0.4, weight: -0.02, blocky: 0, tracking: 0.05, curveSteps: 12 },
  italic:  { depth: 0.55, weight: 0, blocky: 0, slant: 0.22, tracking: 0.05, curveSteps: 12 },
};
