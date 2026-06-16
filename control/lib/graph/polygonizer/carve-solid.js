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

export function parseSvgPath(d, { curveSteps = 18 } = {}) {
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
    } else if (C === 'A') { k += 5; cur = [num() + off[0], num() + off[1]]; push(cur); prevC = prevQ = null; } // arc → line (approx)
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
