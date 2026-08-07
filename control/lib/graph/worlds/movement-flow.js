// ── movement-flow — the shared circulation field every placement kernel consults ─
// Pure, dependency-free geometry. Models the path a body takes through a space so that
// kernels (room generator, furnisher, building/restaurant fit-out, dungeon, city) can
// route their FREE placement choices through one field instead of N bespoke copies.
// Design + rollout in graph/movement-flow.plan.md; the room chapter is
// polygonizer/floorplan-movement-flow.plan.md.
//
// An OPENING is anything a body passes through: { x, y, edge:'N'|'S'|'E'|'W' } — a door,
// the core→hall wing-mouth, a tunnel mouth, an entry/spawn. A door on a horizontal wall
// (N/S) varies a body's path ALONG x; on a vertical wall (E/W), along y.
//
// `facing` values match the renderer's FACING_SPIN (room-scene-elements.js): the value
// names the direction a piece's FRONT points — S→−y, N→+y, E→+x, W→−x.

export const alongAxis = (edge) => (edge === 'N' || edge === 'S' ? 'x' : 'y');
export const acrossAxis = (edge) => (alongAxis(edge) === 'x' ? 'y' : 'x');

// opening-object convenience (reads o.edge)
export const openAlongAxis = (o) => alongAxis(o.edge);
export const openAcrossAxis = (o) => acrossAxis(o.edge);
export const openAlong = (o) => o[openAlongAxis(o)];     // position along the wall it sits on
export const openAcross = (o) => o[openAcrossAxis(o)];   // depth of that wall into the plan

// ── small rect/segment helpers ─────────────────────────────────────────────────
export const pointInRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
export const rectSpan = (r, ax) => (ax === 'x' ? [r.x, r.x + r.w] : [r.y, r.y + r.h]);
export const overlap1d = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Bounding box of a set of {x,y,w,h} cells → { x0,y0,x1,y1 }. */
export function bbox(cells) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cells) {
    x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.w); y1 = Math.max(y1, c.y + c.h);
  }
  return { x0, y0, x1, y1 };
}

// ── the field queries ──────────────────────────────────────────────────────────

/** Through-shot test: two openings on the same pierce axis, collinear within `band`. */
export const onAxis = (aAlong, bAlong, band) => Math.abs(aAlong - bAlong) < band;

/**
 * Command cell — the rest point inside `rect` an anchor object wants: back to the wall
 * OPPOSITE the opening, offset to the along-side AWAY from the opening so it's off the
 * door axis. Returns { x, y, backWall:'N'|'S'|'E'|'W', facing:'N'|'S'|'E'|'W' } where
 * `facing` points the object's front back toward the opening (it "commands" the door).
 */
export function commandCell(rect, opening) {
  const ax = openAlongAxis(opening), dax = openAcrossAxis(opening);
  const [a0, a1] = rectSpan(rect, ax), [d0, d1] = rectSpan(rect, dax);
  const oa = opening[ax], od = opening[dax];
  const farD = Math.abs(od - d0) < Math.abs(od - d1) ? d1 : d0;     // wall opposite the opening
  const farA = (oa - a0) > (a1 - oa) ? a0 : a1;                     // along-side away from the opening
  const restA = (farA + (a0 + a1) / 2) / 2;                        // between far side and center
  const restD = farD === d0 ? d0 + (d1 - d0) * 0.18 : d1 - (d1 - d0) * 0.18;  // just off the far wall
  const facing = facingToward(farD, od, dax);                      // front points back to the door
  const backWall = dax === 'y' ? (farD === d0 ? 'N' : 'S') : (farD === d0 ? 'W' : 'E');
  return ax === 'x'
    ? { x: restA, y: restD, backWall, facing }
    : { x: restD, y: restA, backWall, facing };
}

/**
 * Cardinal an object should FACE so its front points from `fromAcross` toward
 * `towardAcross` along the depth axis `dax`. Matches FACING_SPIN (S→−y … E→+x).
 */
export function facingToward(fromAcross, towardAcross, dax) {
  if (dax === 'y') return towardAcross < fromAcross ? 'S' : 'N';
  return towardAcross < fromAcross ? 'W' : 'E';
}

/**
 * The far-diagonal REST CORNER of a region relative to an entry opening — the deepest
 * still point, which draining/wet things should yield. Returns a corner sub-rect
 * { x, y, w, h } sized to `frac` of each side.
 */
export function restCorner(region, entry, frac = 0.34) {
  const { x0, y0, x1, y1 } = region;
  const ax = openAlongAxis(entry), dax = openAcrossAxis(entry);
  const [aLo, aHi] = ax === 'x' ? [x0, x1] : [y0, y1];
  const [dLo, dHi] = dax === 'x' ? [x0, x1] : [y0, y1];
  const farD = Math.abs(entry[dax] - dLo) < Math.abs(entry[dax] - dHi) ? dHi : dLo;
  const farA = (entry[ax] - aLo) > (aHi - entry[ax]) ? aLo : aHi;
  const qa = (aHi - aLo) * frac, qd = (dHi - dLo) * frac;
  const cA = farA === aLo ? [aLo, aLo + qa] : [aHi - qa, aHi];
  const cD = farD === dLo ? [dLo, dLo + qd] : [dHi - qd, dHi];
  const [X0, X1] = ax === 'x' ? cA : cD;
  const [Y0, Y1] = ax === 'x' ? cD : cA;
  return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 };
}

/**
 * A door's APPROACH clearance — a rect straddling the opening on both sides, the space a
 * fit-out must leave empty so nothing lands in the door's mouth (the "no object in the
 * door's path" rule). One source for every kernel's door clearances.
 * @param door { x, y, edge, width? }
 * @param opts { clr=3, slack=0.6, half? } — clr: approach depth each side; the half-width is
 *   `half` if given, else (width/2 + slack). Pass `half` to ignore per-door width (fixed jamb).
 * @returns { x0, x1, y0, y1 }
 */
export function doorApproach(door, { clr = 3, slack = 0.6, half } = {}) {
  const w = half != null ? half : (door.width || 3) / 2 + slack;
  const horiz = door.edge === 'N' || door.edge === 'S';
  return horiz
    ? { x0: door.x - w, x1: door.x + w, y0: door.y - clr, y1: door.y + clr }
    : { x0: door.x - clr, x1: door.x + clr, y0: door.y - w, y1: door.y + w };
}

/** Door approaches for a list of doors (skips malformed entries). */
export const doorApproaches = (doors, opts) => (doors || []).filter((d) => d && d.x != null && d.y != null).map((d) => doorApproach(d, opts));

/** A desire line between two points (entry→target), as a segment. */
export const desireLine = (a, b) => ({ a, b });

/**
 * Does an axis-aligned rect sit in (block) a desire-line segment, within `slack`?
 * Cheap conservative test: sample the segment and check rect containment with margin.
 */
export function segBlocksRect(line, rect, slack = 0.5) {
  const { a, b } = line;
  const r = { x: rect.x - slack, y: rect.y - slack, w: rect.w + 2 * slack, h: rect.h + 2 * slack };
  const n = 24;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    if (pointInRect(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r)) return true;
  }
  return false;
}

// ── feng-shui check (scene-wide, spike-time guard) ───────────────────────────────
// The reusable assessment a world spike runs so a poison-arrow layout fails loudly
// instead of being caught by eyeballing a render. Each kernel DECLARES its graph
// (entries a body passes through + solid features it shouldn't face head-on); this
// runs the shared checks and reports in the impairment vocabulary. Advisory, like the
// room chapter: it surfaces faults, it does not gate (the operator can ship through it).

/** Convert a {x0,x1,y0,y1} rect to movement-flow's {x,y,w,h} convention. */
export const rectFromBounds = (r) => ({ x: r.x0, y: r.y0, w: r.x1 - r.x0, h: r.y1 - r.y0 });

/**
 * Scene-level feng-shui assessment over a declared circulation graph.
 * Every ENTRY shoots a straight ray into the space (across the wall it sits on); any
 * FEATURE that ray pierces is an `axial-through-shot` (the classic poison arrow — a door
 * facing a lift bank / stair / fixed mass head-on). Mirrors assessFlow's shape.
 * @param graph {{
 *   entries:  [{ x, y, edge:'N'|'S'|'E'|'W', label? }],   // openings a body walks through
 *   features: [{ rect:{x,y,w,h}, label?, kind? }],         // solid masses a path shouldn't aim at
 *   region?:  { x0,y0,x1,y1 },                             // bounds (sets ray reach); optional
 *   band?:    number,                                       // collinearity slack (ft), default 1.5
 * }}
 * @returns {{ impairment:number, necessary:{rule,detail}[], preferential:{rule,detail}[], ok:boolean }}
 */
export function assessFengShui({ entries = [], features = [], region, band = 1.5 } = {}) {
  const necessary = [], preferential = [];
  const reach = region ? Math.max(region.x1 - region.x0, region.y1 - region.y0) : 120;
  // direction a body travels stepping in through each wall (S→+y, N→−y, W→+x, E→−x)
  const into = { S: [0, 1], N: [0, -1], W: [1, 0], E: [-1, 0] };
  for (const e of entries) {
    const dir = into[e.edge] || [0, 1];
    const line = desireLine({ x: e.x, y: e.y }, { x: e.x + dir[0] * reach, y: e.y + dir[1] * reach });
    for (const f of features) {
      if (f.rect && segBlocksRect(line, f.rect, band)) {
        necessary.push({ rule: 'axial-through-shot', detail: `${e.label || 'entry'} fires straight into ${f.label || f.kind || 'a feature'} (poison arrow — offset it off the entry axis)` });
      }
    }
  }
  return { impairment: necessary.length * 10 + preferential.length * 3, necessary, preferential, ok: necessary.length === 0 };
}

/** Format a feng-shui assessment as a short report block (for spike logs). */
export function reportFengShui(label, a) {
  const head = `feng-shui · ${label}: ${a.ok ? 'OK' : 'IMPAIRED'} (penalty ${a.impairment})`;
  const lines = [head];
  for (const n of a.necessary) lines.push(`  ✗ ${n.rule}: ${n.detail}`);
  for (const p of a.preferential) lines.push(`  ~ ${p.rule}: ${p.detail}`);
  return lines.join('\n');
}

// ── field layer (city / diffuse flow) ───────────────────────────────────────────
// A coarse raster of flow vectors + intensity, for kernels where circulation is diffuse
// (streets) rather than a few openings. Sources push flow outward (entries, street
// centerlines weighted by class); barriers zero a cell; sinks (attractors) pull. Built
// lazily by the city adapter; the core queries above don't need it.

/**
 * Build a flow field over `region` ({x0,y0,x1,y1}) at `cell` resolution.
 * sources/sinks: [{ x, y, weight }]. barriers: [{x,y,w,h}] (zero those cells).
 * @returns { cols, rows, cell, x0, y0, at(x,y)→{flow:[dx,dy], intensity} }
 */
export function flowField({ region, sources = [], sinks = [], barriers = [], cell = 0.5 }) {
  const cols = Math.max(1, Math.ceil((region.x1 - region.x0) / cell));
  const rows = Math.max(1, Math.ceil((region.y1 - region.y0) / cell));
  const intensity = new Float32Array(cols * rows);
  const fx = new Float32Array(cols * rows), fy = new Float32Array(cols * rows);
  const idx = (c, r) => r * cols + c;
  const blocked = (cx, cy) => barriers.some((b) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = region.x0 + (c + 0.5) * cell, cy = region.y0 + (r + 0.5) * cell;
      if (blocked(cx, cy)) continue;
      let inten = 0, vx = 0, vy = 0;
      for (const s of sources) {
        const dx = cx - s.x, dy = cy - s.y, d2 = dx * dx + dy * dy + 1;
        const w = (s.weight ?? 1) / d2;
        inten += w; vx += (dx / Math.sqrt(d2)) * w; vy += (dy / Math.sqrt(d2)) * w;
      }
      for (const k of sinks) {
        const dx = k.x - cx, dy = k.y - cy, d2 = dx * dx + dy * dy + 1;
        const w = (k.weight ?? 1) / d2;
        vx += (dx / Math.sqrt(d2)) * w; vy += (dy / Math.sqrt(d2)) * w;
      }
      const m = Math.hypot(vx, vy) || 1;
      intensity[idx(c, r)] = inten; fx[idx(c, r)] = vx / m; fy[idx(c, r)] = vy / m;
    }
  }
  return {
    cols, rows, cell, x0: region.x0, y0: region.y0,
    at(x, y) {
      const c = clamp(Math.floor((x - region.x0) / cell), 0, cols - 1);
      const r = clamp(Math.floor((y - region.y0) / cell), 0, rows - 1);
      return { flow: [fx[idx(c, r)], fy[idx(c, r)]], intensity: intensity[idx(c, r)] };
    },
  };
}
