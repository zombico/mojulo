/**
 * carve-solid — a render primitive: any closed vector OUTLINE → an extruded,
 * BEVELLED solid, ready to vexar-shade into smooth metal.
 *
 * The carver generalizes past glyphs: its input is `contours` (closed [x,y]
 * rings; holes are just more rings, drawn evenodd). Sources are pluggable —
 * `parseSvgPath` turns an SVG `d` string into contours (logos, icons, any vector
 * shape); the glyph-carver supplies font outlines. The core is source-agnostic.
 *
 * `extrudeProfile` builds the solid with an optional rounded BEVEL: the front
 * edge curves back over N steps (a quarter-round fillet), so a light sweeping the
 * surface reads as a smooth metallic edge instead of a hard 90° wall. Output is
 * flat faces (caps + bevel/side quads) in a local frame (x right, y up, z =
 * depth: 0 front … depth back); the renderer transforms, computes normals,
 * shades (vexar + specular = "metalify"), culls, sorts, projects.
 *
 * Pure geometry — no camera, no shading, no fs.
 */

// ── contour helpers ──
const signedArea = (ring) => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return s / 2; };
const norm2 = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/** Offset every contour by `delta` along the outward normal of the SOLID
 *  (+ dilates, − erodes/insets); holes handled via per-ring orientation. */
export function offsetContours(contours, delta) {
  if (!delta) return contours;
  return contours.map((ring) => {
    const sgn = Math.sign(signedArea(ring)) || 1;
    return ring.map((p, i) => {
      const a = ring[(i - 1 + ring.length) % ring.length], b = ring[(i + 1) % ring.length];
      const e1 = norm2([p[0] - a[0], p[1] - a[1]]), e2 = norm2([b[0] - p[0], b[1] - p[1]]);
      const nrm = norm2([(e1[1] + e2[1]) * sgn, -(e1[0] + e2[0]) * sgn]);
      return [p[0] + nrm[0] * delta, p[1] + nrm[1] * delta];
    });
  });
}

/** Fit contours into a unit box (default [-0.5,0.5], aspect-preserved), y-up. */
export function normalizeContours(contours, { box = 1, flipY = true, center = true } = {}) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of contours) for (const [x, y] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const w = maxX - minX || 1, h = maxY - minY || 1, s = box / Math.max(w, h);
  const cx = center ? (minX + maxX) / 2 : minX, cy = center ? (minY + maxY) / 2 : minY;
  return contours.map((r) => r.map(([x, y]) => [(x - cx) * s, (flipY ? -1 : 1) * (y - cy) * s]));
}

// ── SVG path → contours (M L H V C S Q T Z, abs + rel; A approximated as a line) ──
const qbez = (p0, c, p1, t) => { const m = 1 - t; return [m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1]]; };
const cbez = (p0, a, b, p1, t) => { const m = 1 - t; return [m*m*m*p0[0] + 3*m*m*t*a[0] + 3*m*t*t*b[0] + t*t*t*p1[0], m*m*m*p0[1] + 3*m*m*t*a[1] + 3*m*t*t*b[1] + t*t*t*p1[1]]; };

// an SVG arc (the endpoint form: rx ry rotation large-arc sweep x y) as points along it, the end point last; a radius too
// small for the chord is scaled up, as SVG does; a zero radius is a line
function arcPoints(p0, rx, ry, phiDeg, large, sweep, p1, steps) {
  if (!(rx && ry) || (p0[0] === p1[0] && p0[1] === p1[1])) return [p1];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2, x1 = c * dx + s * dy, y1 = -s * dx + c * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den)), cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx;
  const cx = c * cx1 - s * cy1 + (p0[0] + p1[0]) / 2, cy = s * cx1 + c * cy1 + (p0[1] + p1[1]) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(2, Math.ceil((steps * Math.abs(dt)) / (Math.PI / 2))), out = [];
  for (let i = 1; i < n; i++) { const t = t0 + (dt * i) / n, ex = rx * Math.cos(t), ey = ry * Math.sin(t); out.push([c * ex - s * ey + cx, s * ex + c * ey + cy]); }
  out.push(p1);
  return out;
}

/** An SVG path's `d` → its contours. `arcs`: an arc (A) drawn along the arc, `curveSteps` points a quarter turn; absent,
 * an arc is a line to its end (the carved solids' reading, kept so their bytes never move). */
export function parseSvgPath(d, { curveSteps = 18, arcs = false } = {}) {
  const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  const contours = [];
  let ring = null, cur = [0, 0], start = [0, 0], cmd = null, prevC = null, prevQ = null, k = 0;
  const num = () => parseFloat(toks[k++]);
  const push = (p) => ring.push(p);
  const reflect = (ctrl) => ctrl ? [2 * cur[0] - ctrl[0], 2 * cur[1] - ctrl[1]] : [...cur];
  while (k < toks.length) {
    if (/[a-zA-Z]/.test(toks[k])) { cmd = toks[k++]; } // else: implicit repeat of last cmd
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    const off = rel ? cur : [0, 0];
    if (C === 'M') { if (ring && ring.length > 2) contours.push(ring); cur = [num() + off[0], num() + off[1]]; start = [...cur]; ring = [cur]; prevC = prevQ = null; cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { cur = [num() + off[0], num() + off[1]]; push(cur); prevC = prevQ = null; }
    else if (C === 'H') { cur = [num() + off[0], cur[1]]; push(cur); prevC = prevQ = null; }
    else if (C === 'V') { cur = [cur[0], num() + off[1]]; push(cur); prevC = prevQ = null; }
    else if (C === 'C' || C === 'S') {
      const a = C === 'S' ? reflect(prevC) : [num() + off[0], num() + off[1]];
      const b = [num() + off[0], num() + off[1]], p1 = [num() + off[0], num() + off[1]];
      for (let i = 1; i <= curveSteps; i++) push(cbez(cur, a, b, p1, i / curveSteps));
      prevC = b; prevQ = null; cur = p1;
    } else if (C === 'Q' || C === 'T') {
      const c = C === 'T' ? reflect(prevQ) : [num() + off[0], num() + off[1]];
      const p1 = [num() + off[0], num() + off[1]];
      for (let i = 1; i <= curveSteps; i++) push(qbez(cur, c, p1, i / curveSteps));
      prevQ = c; prevC = null; cur = p1;
    } else if (C === 'A') {
      if (arcs) { const rx = num(), ry = num(), rot = num(), large = num() ? 1 : 0, sweep = num() ? 1 : 0, p1 = [num() + off[0], num() + off[1]]; for (const p of arcPoints(cur, rx, ry, rot, large, sweep, p1, curveSteps)) push(p); cur = p1; }
      else { k += 5; cur = [num() + off[0], num() + off[1]]; push(cur); } // arc → line (approx)
      prevC = prevQ = null;
    }
    else if (C === 'Z') { if (ring && ring.length > 2) contours.push(ring); ring = [start.slice()]; cur = [...start]; prevC = prevQ = null; }
    else break;
  }
  if (ring && ring.length > 2) contours.push(ring);
  return contours;
}

// ── the extruder: contours → bevelled solid faces ──
const at = (ring, z) => ring.map(([x, y]) => [x, y, z]);

/**
 * @param {Array<Array<[number,number]>>} contours  styled 2D outline (y up)
 * @param {object} opts  { depth, bevel, bevelSteps }
 * @returns {{ faces: Array<{kind:'cap'|'quad', contours?, pts?, side?}>, depth }}
 *   caps carry their contour rings (evenodd); quads are 4-pt panels. Points 3D.
 */
export function extrudeProfile(contours, { depth = 0.5, bevel = 0, bevelSteps = 5 } = {}) {
  const faces = [];
  const wallQuads = (front, back) => {
    front.forEach((ring, ci) => { const F = front[ci], B = back[ci]; for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; faces.push({ kind: 'quad', pts: [F[i], F[j], B[j], B[i]] }); } });
  };

  if (bevel > 0 && bevelSteps >= 1) {
    const b = Math.min(bevel, depth / 2);
    // rings of the front fillet: s=0 → inset b at z=0 (flat top); s=B → full at z=b.
    const rings = [];
    for (let s = 0; s <= bevelSteps; s++) { const phi = (s / bevelSteps) * (Math.PI / 2); rings.push({ c: offsetContours(contours, -b * Math.cos(phi)), z: b * Math.sin(phi) }); }
    faces.push({ kind: 'cap', side: 'front', contours: rings[0].c.map((r) => at(r, 0)) });   // flat metal top
    for (let s = 0; s < bevelSteps; s++) wallQuads(rings[s].c.map((r) => at(r, rings[s].z)), rings[s + 1].c.map((r) => at(r, rings[s + 1].z)));
    wallQuads(rings[bevelSteps].c.map((r) => at(r, b)), contours.map((r) => at(r, depth)));     // straight side
    faces.push({ kind: 'cap', side: 'back', contours: contours.map((r) => at(r, depth)) });
  } else {
    faces.push({ kind: 'cap', side: 'front', contours: contours.map((r) => at(r, 0)) });
    wallQuads(contours.map((r) => at(r, 0)), contours.map((r) => at(r, depth)));
    faces.push({ kind: 'cap', side: 'back', contours: contours.map((r) => at(r, depth)) });
  }
  return { faces, depth };
}
