/**
 * craft-parts — one builder per craft-* part kind. A builder reads an inventory row (its `dims`
 * and `build`) and the resolved colours, and returns the part's workbench monomers in METRES
 * around the part's MOUNT at the origin, plus its named hardpoints in the same frame.
 *
 * Craft space: +y forward, +z up, +x right. A left-hand part is the right-hand one under
 * `flip: 'x'`; a lower starfighter foil is the upper one under `flip: 'z'`. Builders never
 * read a seed: an inventory row is one part number and always makes the same part.
 */

import { DEG, airfoil, extrudeWorld, facetSection, lathe, loftWorld, planeUV, round3, section, sweep } from './craft-common.js';

const r3v = (v) => v.map(round3);

// ---- fuselage / hull ---------------------------------------------------------------------------

/** Linear read of the station table at s: { w, h, z } fractions. */
function stationAt(rows, s) {
  if (s <= rows[0][0]) return { w: rows[0][1], h: rows[0][2], z: rows[0][3] };
  for (let i = 1; i < rows.length; i += 1) {
    const [s1, w1, h1, z1] = rows[i];
    if (s <= s1) {
      const [s0, w0, h0, z0] = rows[i - 1];
      const k = (s - s0) / (s1 - s0);
      return { w: w0 + k * (w1 - w0), h: h0 + k * (h1 - h0), z: z0 + k * (z1 - z0) };
    }
  }
  const last = rows[rows.length - 1];
  return { w: last[1], h: last[2], z: last[3] };
}

/**
 * A fuselage or hull: a loft nose (y = 0) → tail (y = −length), its stations
 * `[s, width, height, centre, n?]` as fractions of the row's dims (n overrides the section's
 * superellipse exponent there, so a round nose can square off into a chined body). `facets` swaps
 * the superellipse for a flat-paneled polygon, lofted linearly so every panel stays flat. The
 * lowest skin point sits at z = 0. Named points `[s, xf, zf]` land on the local section: xf and zf
 * in −1..1 of its half-width and half-height.
 */
function buildFuselage(row, C) {
  const { length: L, width: W, height: H } = row.dims;
  const b = row.build;
  const belly = b.belly || 1;
  const rows = b.stations;
  const shape = (a, h, n) => (b.facets ? facetSection(a, h, b.facets) : section(a, h, n, belly));
  const lowOf = (a, h, n) => Math.min(...shape(a, h, n).map(([, z]) => z));
  const zMin = Math.min(...rows.map(([, w, h, z, n]) => z * H + lowOf(Math.max(w * W / 2, 0.005), Math.max(h * H / 2, 0.005), n || b.n || 2)));
  const zp = H / 2;
  const from = [0, 0, zp];
  const to = [0, -L, zp];
  const stations = rows.map(([s, w, h, z, n]) => ({
    t: s,
    points: shape(Math.max(w * W / 2, 0.005), Math.max(h * H / 2, 0.005), n || b.n || 2)
      .map(([x, zz]) => [x, 0, z * H - zMin + zz - zp]),
  }));
  const smooth = !b.facets;
  const lofts = [loftWorld('hull', from, to, stations, C.paint, smooth ? { interp: 'smooth', segments: b.segments || 5 } : {})];
  const point = ([s, xf, zf]) => {
    const st = stationAt(rows, s);
    const halfH = (st.h * H) / 2;
    return r3v([xf * (st.w * W) / 2, -s * L, st.z * H - zMin + (zf < 0 ? zf * halfH * belly : zf * halfH)]);
  };
  const hardpoints = { mount: [0, 0, 0] };
  for (const [name, spec] of Object.entries(b.points || {})) hardpoints[name] = point(spec);
  // A glazed band (an airliner's flight deck, a shuttle's windscreen): a thin loft hugging the skin.
  if (b.windscreen) {
    const [s0, s1] = b.windscreen;
    const ws = [s0, (s0 + s1) / 2, s1].map((s, i) => {
      const st = stationAt(rows, s);
      const a = (st.w * W) / 2 * 1.012;
      const hh = (st.h * H) / 2 * 1.012;
      const zc = st.z * H - zMin;
      const k = i === 1 ? 1 : 0.92;
      return {
        t: (s - s0) / (s1 - s0),
        points: shape(a * k, hh * k, st.n || b.n || 2).map(([x, zz]) => [x, 0, zc + Math.max(zz, hh * 0.25) - zp]),
      };
    });
    lofts.push(loftWorld('windscreen', [0, -s0 * L, zp], [0, -s1 * L, zp], ws, C.glass, { material: 'glass' }));
  }
  // a radome or nose cone in the trim colour, the hull's first stretch
  if (b.nose) {
    const s1 = b.nose;
    const ns = rows.filter(([s]) => s < s1);
    const end = stationAt(rows, s1);
    const list = [...ns, [s1, end.w, end.h, end.z, ns.length ? ns[ns.length - 1][4] : undefined]];
    const st = list.map(([s, w, h, z, n]) => ({
      t: s / s1,
      points: shape(Math.max(w * W / 2, 0.005) * 1.006, Math.max(h * H / 2, 0.005) * 1.006, n || b.n || 2).map(([x, zz]) => [x, 0, z * H - zMin + zz - zp]),
    }));
    lofts.push(loftWorld('nose', [0, 0.005, zp], [0, -s1 * L, zp], st, C.trim, smooth ? { interp: 'smooth', segments: 4 } : {}));
  }
  return { lofts, hardpoints };
}

/** A ball hull (a twin-panel interceptor's cockpit pod): a sphere lathed nose → tail, z ≥ 0. */
function buildBall(row, C) {
  const D = row.dims.length;
  const R = D / 2;
  const pairs = [];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    pairs.push([t, R * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))]);
  }
  const lathes = [lathe('ball', [0, 0, R], [0, -D, R], pairs, C.paint, { crossSections: 24, samples: 28 })];
  // the equatorial collar and the rear hatch ring
  lathes.push(lathe('collar', [0, -R + 0.08, R], [0, -R - 0.08, R], [[0, R * 1.02], [1, R * 1.02]], C.trim));
  const hardpoints = { mount: [0, 0, 0] };
  for (const [name, [s, xf, zf]] of Object.entries(row.build.points || {})) {
    hardpoints[name] = r3v([xf * R, -s * D, R + zf * R]);
  }
  return { lathes, hardpoints };
}

// ---- lifting surfaces --------------------------------------------------------------------------

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/**
 * A wing, a stabilizer, a fin or a starfighter foil: lofts of wing sections from the root leading
 * edge (the mount) out to the tip. Horizontal panels run along +x (the right-hand panel); a fin runs
 * up +z, leaning outboard by `cant`.
 *
 *  - `planform`: `[f, chord, lead?, lift?]` stations across the span (f 0 root → 1 tip; chord in
 *    metres; lead = how far the leading edge sits aft of the root's; lift = how high). A missing lead
 *    or lift follows `sweep` / `dihedral`. Without one, the panel is a straight taper root → tip.
 *    Cranks, raked tips, a gull's dip and a strake's long root chord are stations.
 *  - `fold: { at, angle, fixed? }`: a chordwise hinge at span fraction `at`; the outer panel turns
 *    `angle` degrees about it (+ folds up) at `opts.fold` (0 spread … 1 folded). `fixed` bakes the
 *    fold in: a bent panel.
 *  - `winglet: { height, root, tip, sweep, cant }`: an upturned tip (chords as fractions of the tip
 *    chord, cant from vertical).
 */
function buildLiftingSurface(row, C, opts = {}) {
  const b = row.build;
  const span = row.dims.span;
  const vertical = Boolean(b.vertical);
  const sweepT = Math.tan((b.sweep || 0) * DEG);
  const dihT = Math.tan((b.dihedral || 0) * DEG);
  const plan = (b.planform || [[0, b.rootChord], [1, b.tipChord]]).map(([f, chord, lead, lift]) => ({
    f, chord, lead: lead ?? f * span * sweepT, lift: lift ?? f * span * dihT,
  }));
  const at = (f) => {
    let i = 1;
    while (i < plan.length - 1 && f > plan[i].f) i += 1;
    const p = plan[i - 1];
    const q = plan[i];
    const k = q.f === p.f ? 0 : (f - p.f) / (q.f - p.f);
    return { chord: p.chord + k * (q.chord - p.chord), lead: p.lead + k * (q.lead - p.lead), lift: p.lift + k * (q.lift - p.lift) };
  };
  const thickAt = (f) => b.thickness + f * ((b.tipThickness ?? b.thickness) - b.thickness);
  const fold = b.fold || null;
  const hingeF = fold ? fold.at : 1;
  const foldA = fold ? fold.angle * DEG * (fold.fixed ? 1 : clamp01(opts.fold)) : 0;
  const pivot = fold ? [hingeF * span, at(hingeF).lift] : [0, 0];
  const cant = (b.cant || 0) * DEG;
  // local (s spanwise, y chordwise, h thickness-wise) → world, the outer panel turned about the hinge
  const toWorld = ([sl, y, h], outer) => {
    let ss = sl;
    let hh = h;
    if (outer && foldA) {
      const ds = sl - pivot[0];
      const dh = h - pivot[1];
      ss = pivot[0] + ds * Math.cos(foldA) - dh * Math.sin(foldA);
      hh = pivot[1] + ds * Math.sin(foldA) + dh * Math.cos(foldA);
    }
    const w = vertical ? [hh, y, ss] : [ss, y, hh];
    if (!cant) return w;
    return [w[0] * Math.cos(cant) + w[2] * Math.sin(cant), w[1], -w[0] * Math.sin(cant) + w[2] * Math.cos(cant)];
  };
  const wingSection = (f, tw = (b.twist || 0) * DEG * f) => {
    const { chord, lead, lift } = at(f);
    // no skin thinner than 4 cm, however thin the ratio: a razor tip does not close
    return airfoil({ thickness: Math.max(thickAt(f), 0.04 / chord), camber: b.camber || 0, kind: b.section || 'naca' }).map(([c, t]) => {
      const y0 = -c * chord;
      const z0 = t * chord;
      // washout: the tip's leading edge drops
      return [f * span, y0 * Math.cos(tw) + z0 * Math.sin(tw) - lead, -y0 * Math.sin(tw) + z0 * Math.cos(tw) + lift];
    });
  };
  // one straight loft per side of the hinge; its stations lie square to its own axis
  const loftAcross = (id, fs, pointsAt, tint, extra) => {
    const out = [];
    const cuts = [[0, hingeF], [hingeF, 1]].filter(([a, z]) => z > a);
    for (const [f0, f1] of cuts) {
      const outer = Boolean(fold) && f0 >= hingeF;
      const inner = [...new Set([f0, ...fs.filter((f) => f > f0 && f < f1), f1])].filter((f) => f >= fs[0] && f <= fs[fs.length - 1]).sort((p, q) => p - q);
      if (inner.length < 2) continue;
      const a0 = toWorld([inner[0] * span, 0, outer ? pivot[1] : 0], outer);
      const a1 = toWorld([inner[inner.length - 1] * span, 0, outer ? pivot[1] : 0], outer);
      const st = inner.map((f) => {
        const t = (f - inner[0]) / (inner[inner.length - 1] - inner[0]);
        const c = [a0[0] + t * (a1[0] - a0[0]), a0[1] + t * (a1[1] - a0[1]), a0[2] + t * (a1[2] - a0[2])];
        return { t, points: pointsAt(f).map((p) => { const w = toWorld(p, outer); return [w[0] - c[0], w[1] - c[1], w[2] - c[2]]; }) };
      });
      out.push(loftWorld(cuts.length > 1 ? `${id}_${outer ? 'outer' : 'inner'}` : id, a0, a1, st, tint, extra));
    }
    return out;
  };
  const fs = [...new Set([...plan.map((p) => p.f), ...(fold ? [hingeF] : [])])].sort((p, q) => p - q);
  const lofts = loftAcross('panel', fs, (f) => wingSection(f), C.paint);
  // a control-surface band along the trailing edge reads the hinge line (flap / elevator / rudder)
  if (b.hinge) {
    const [f0, f1, frac] = b.hinge;
    const band = (f) => {
      const { chord, lead, lift } = at(f);
      const yTe = -chord - lead;
      const yH = yTe + frac * chord;
      const th = Math.max(0.006, thickAt(f) * chord * 0.22) * 1.15;
      return [[yH, th], [yTe, th * 0.3], [yTe, -th * 0.3], [yH, -th]].map(([y, h]) => [f * span, y, h + lift]);
    };
    const bandFs = [f0, ...fs.filter((f) => f > f0 && f < f1), f1];
    lofts.push(...loftAcross('hinge', bandFs, band, C.trim));
  }
  if (b.winglet) {
    const wl = b.winglet;
    const tip = at(1);
    const lean = (wl.cant || 0) * DEG;
    const dir = [Math.sin(lean), Math.cos(lean)];               // (s, h): up, leaning outboard
    const nrm = [Math.cos(lean), -Math.sin(lean)];              // the winglet's thickness direction
    const c0 = tip.chord * wl.root;
    const c1 = tip.chord * wl.tip;
    const base = [span, tip.lift];
    const wsec = (t) => {
      const chord = c0 + t * (c1 - c0);
      const yLe = -tip.lead - (tip.chord - c0) - t * wl.height * Math.tan((wl.sweep || 0) * DEG);
      const sc = base[0] + dir[0] * wl.height * t;
      const hc = base[1] + dir[1] * wl.height * t;
      return airfoil({ thickness: 0.09, kind: 'naca' }).map(([c, h]) => [sc + nrm[0] * h * chord, yLe - c * chord, hc + nrm[1] * h * chord]);
    };
    const a0 = toWorld([base[0], 0, base[1]], true);
    const a1 = toWorld([base[0] + dir[0] * wl.height, 0, base[1] + dir[1] * wl.height], true);
    const st = [0, 1].map((t) => {
      const c = [a0[0] + t * (a1[0] - a0[0]), a0[1] + t * (a1[1] - a0[1]), a0[2] + t * (a1[2] - a0[2])];
      return { t, points: wsec(t).map((p) => { const w = toWorld(p, true); return [w[0] - c[0], w[1] - c[1], w[2] - c[2]]; }) };
    });
    lofts.push(loftWorld('winglet', a0, a1, st, C.trim));
  }
  const point = ([f, c, face = 'mid']) => {
    const { chord, lead, lift } = at(f);
    const half = thickAt(f) * chord * 0.5;
    const off = face === 'lower' ? -half : face === 'upper' ? half : 0;
    return r3v(toWorld([f * span, -c * chord - lead, lift + off], f > hingeF));
  };
  const hardpoints = { mount: [0, 0, 0] };
  for (const [name, spec] of Object.entries(b.points || {})) hardpoints[name] = point(spec);
  return { lofts, hardpoints, ...(fold ? { fold: round3(foldA / DEG) } : {}) };
}

// A panel's outline in its own plane, (y forward, z up), each in −1..1 of half the chord and half the height.
const PANEL_OUTLINES = {
  // the line fighter's hexagon, vertex up
  hex: [[0, 1], [1, 0.5], [1, -0.5], [0, -1], [-1, -0.5], [-1, 0.5]],
  // the interceptor's dagger: two blades reaching forward past a notched leading edge
  dagger: [[1, 1], [0.1, 0.32], [0.1, -0.32], [1, -1], [-0.55, -0.78], [-0.3, 0], [-0.55, 0.78]],
};

/**
 * A flat panel wing standing in the y-z plane (a twin-panel fighter's solar wing), its inner face
 * on the mount: an outline extruded through its thickness, spars from the hub to every corner on
 * the outer face. `points` name places on the outer face in outline coordinates (a blade tip's gun).
 */
function buildPanel(row, C) {
  const { span: T, height: Hh, chord: Wd } = row.dims;
  const b = row.build;
  const outline = (PANEL_OUTLINES[b.outline || 'hex']).map(([y, z]) => [(y * Wd) / 2, (z * Hh) / 2]);
  // `bend`: the upper and lower halves turn inward about the hub's chord line (a bomber's creased panels)
  const beta = (b.bend || 0) * DEG;
  const halves = beta ? [1, -1].map((side) => {
    const half = [];
    outline.forEach((p, i) => {
      const q = outline[(i + 1) % outline.length];
      if (p[1] * side >= 0) half.push(p);
      if ((p[1] * side > 0 && q[1] * side < 0) || (p[1] * side < 0 && q[1] * side > 0)) {
        const t = p[1] / (p[1] - q[1]);
        half.push([p[0] + t * (q[0] - p[0]), 0]);
      }
    });
    return { side, pts: half };
  }) : [{ side: 0, pts: outline }];
  // a point of the panel's plane (offset x across its thickness) → craft space, bent with its half
  const place = (x, y, z, side) => {
    const a = side * beta;   // upper half leans its top inboard (−x), the lower half its bottom
    return [x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)];
  };
  const extrudes = [];
  const sweeps = [];
  for (const { side, pts } of halves) {
    const from = place(0, 0, 0, side);
    const to = place(T, 0, 0, side);
    let ring = pts.map(([y, z]) => { const w = place(0, y, z, side); return [w[0] - from[0], w[1] - from[1], w[2] - from[2]]; });
    // the kernel wants a counter-clockwise ring in its own (u, v): reverse a clockwise outline
    const uv = planeUV(from, to, ring);
    const area = uv.reduce((acc, p, i) => { const q = uv[(i + 1) % uv.length]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (area < 0) ring = ring.reverse();
    const tag = side > 0 ? '_upper' : side < 0 ? '_lower' : '';
    extrudes.push(extrudeWorld(`panel${tag}`, from, to, ring, C.paint));
    // the spars: a rib from the hub to each outer corner on the outer face
    pts.filter(([, z]) => Math.abs(z) > 1e-9 || !side).forEach(([y, z], i) => {
      sweeps.push(sweep(`rib${tag}_${i}`, [place(T, 0, 0, side), place(T, y * 0.97, z * 0.97, side)], 0.06, C.trim));
    });
  }
  const lathes = [lathe('hub', [0, 0, 0], [T + 0.12, 0, 0], [[0, 0.55], [1, 0.42]], C.trim)];
  const hardpoints = { mount: [0, 0, 0], center: [round3(T), 0, 0] };
  for (const [name, [y, z]] of Object.entries(b.points || {})) {
    hardpoints[name] = r3v(place(T, (y * Wd) / 2, (z * Hh) / 2, beta ? Math.sign(z) || 1 : 0));
  }
  return { extrudes, sweeps, lathes, hardpoints };
}

// ---- propulsion -------------------------------------------------------------------------------

function buildEngine(row, C) {
  const b = row.build;
  const L = row.dims.length;
  const R = row.dims.diameter / 2;
  const fam = b.family;
  if (fam === 'turbofan' || fam === 'turboprop') {
    const yf = (b.mountAt ?? 0.35) * L;
    // hung from a pylon by its top, or (an aft-fuselage engine) by its inboard flank
    const inboard = b.mountFace === 'inboard';
    const xc = inboard ? R : 0;
    const zc = inboard ? 0 : -R;
    const lathes = [];
    const nacelle = fam === 'turbofan'
      ? [[0, 0.86 * R], [0.05, 0.97 * R], [0.28, R], [0.72, 0.9 * R], [1, 0.6 * R]]
      : [[0, 0.55 * R], [0.12, 0.92 * R], [0.35, R], [0.7, 0.85 * R], [1, 0.25 * R]];
    lathes.push(lathe('nacelle', [xc, yf, zc], [xc, yf - L, zc], nacelle, C.paint, { crossSections: 18, samples: 28 }));
    const hardpoints = { mount: [0, 0, 0] };
    if (fam === 'turbofan') {
      const fanR = (b.fanDiameter || 1.6 * R) / 2;
      lathes.push(lathe('fan', [xc, yf + 0.01, zc], [xc, yf - 0.06 * L, zc], [[0, fanR * 0.98], [1, fanR * 0.98]], C.rubber));
      lathes.push(lathe('spinner', [xc, yf - 0.02 * L, zc], [xc, yf - 0.16 * L, zc], [[0, 0.02], [1, fanR * 0.3]], C.chrome));
      lathes.push(lathe('plug', [xc, yf - 0.95 * L, zc], [xc, yf - 1.12 * L, zc], [[0, 0.42 * R], [1, 0.03]], C.chrome));
    } else {
      // turboprop: the propeller hub is the nacelle's nose, the exhaust a stub on the side
      lathes.push(lathe('exhaust', [xc + 0.7 * R, yf - 0.32 * L, zc + 0.2 * R], [xc + 1.05 * R, yf - 0.42 * L, zc + 0.2 * R], [[0, 0.16 * R], [1, 0.16 * R]], C.chrome));
      hardpoints.propHub = r3v([xc, yf, zc]);
    }
    return { lathes, hardpoints };
  }
  if (fam === 'cowl') {
    // a nose cowling over a flat engine: the mount is the firewall, the hub the cowl's nose
    const lathes = [lathe('cowl', [0, 0, 0], [0, L, 0], [[0, R], [0.6, R * 0.96], [1, R * 0.7]], C.paint, { crossSections: 12, samples: 24 })];
    const sweeps = [sweep('exhaust', [[R * 0.3, L * 0.25, -R * 0.9], [R * 0.35, L * 0.05, -R * 1.12]], R * 0.07, C.chrome)];
    return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], propHub: [0, round3(L), 0] } };
  }
  if (fam === 'inline') {
    // a liquid-cooled vee buried in the nose: the block, and the six stacks a side that show
    const w = row.dims.width;
    const h = row.dims.height;
    const box = [[-w / 2, 0, -h / 2], [w / 2, 0, -h / 2], [w / 2, 0, h / 2], [-w / 2, 0, h / 2]];
    const extrudes = [extrudeWorld('block', [0, 0, 0], [0, L, 0], box, C.paint)];
    const sweeps = [];
    for (let i = 0; i < 6; i += 1) {
      const y = L * (0.18 + 0.12 * i);
      for (const sx of [1, -1]) sweeps.push(sweep(`stack_${sx > 0 ? 'r' : 'l'}${i}`, [[sx * w * 0.45, y, h * 0.2], [sx * (w * 0.62), y - 0.08, h * 0.12]], 0.035, C.trim));
    }
    return { extrudes, sweeps, hardpoints: { mount: [0, 0, 0], propHub: [0, round3(L + 0.1), 0] } };
  }
  if (fam === 'core') {
    // a bare afterburning engine: the mount is its compressor face, the nozzle its tail
    const lathes = [
      lathe('case', [0, 0, 0], [0, -L * 0.82, 0], [[0, R * 0.92], [0.1, R], [0.85, R * 0.95], [1, R * 0.9]], C.chrome, { crossSections: 12, samples: 24 }),
      lathe('nozzle', [0, -L * 0.82, 0], [0, -L, 0], [[0, R * 0.9], [1, R * 0.78]], C.trim, { harmonics: [{ n: 15, amplitude: 0.03 }] }),
      lathe('burner', [0, -L * 0.97, 0], [0, -L * 0.995, 0], [[0, R * 0.7], [1, R * 0.7]], C.light, { material: 'neon' }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0], nozzle: [0, round3(-L), 0] } };
  }
  if (fam === 'pod') {
    // a starfighter drive pod: the mount is its axis at mid length; a glowing aft face
    const lathes = [
      lathe('pod', [0, L / 2, 0], [0, -L / 2, 0], [[0, R * 0.55], [0.06, R * 0.9], [0.14, R], [0.9, R], [1, R * 0.92]], C.paint, { crossSections: 14, samples: 24 }),
      lathe('intake', [0, L / 2 + 0.02, 0], [0, L / 2 - 0.04, 0], [[0, R * 0.5], [1, R * 0.5]], C.rubber),
      lathe('band', [0, L * 0.18, 0], [0, L * 0.08, 0], [[0, R * 1.04], [1, R * 1.04]], C.trim),
      lathe('glow', [0, -L / 2, 0], [0, -L / 2 - 0.04, 0], [[0, R * 0.78], [1, R * 0.78]], C.light, { material: 'neon' }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0], exhaust: [0, round3(-L / 2), 0], top: [0, round3(-L * 0.3), round3(R * 0.95)], bottom: [0, round3(-L * 0.3), round3(-R * 0.95)] } };
  }
  if (fam === 'radial') {
    // a big radial under a short cowl: the mount is the firewall, the dark ring is the cylinder heads
    const lathes = [
      lathe('cowl', [0, 0, 0], [0, L, 0], [[0, R * 0.9], [0.45, R], [0.9, R * 0.97], [1, R * 0.84]], C.paint, { crossSections: 10, samples: 28 }),
      lathe('flaps', [0, 0.02, 0], [0, -0.12, 0], [[0, R * 0.92], [1, R * 0.86]], C.trim, { harmonics: [{ n: 18, amplitude: 0.025 }] }),
      lathe('heads', [0, L - 0.04, 0], [0, L + 0.01, 0], [[0, R * 0.8], [1, R * 0.8]], C.rubber, { harmonics: [{ n: 18, amplitude: 0.06 }] }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0], propHub: [0, round3(L + 0.02), 0] } };
  }
  if (fam === 'bell') {
    // a main-drive bell: the mount is the throat ring, the bell flares aft
    const lathes = [
      lathe('bell', [0, 0, 0], [0, -L, 0], [[0, R * 0.55], [0.25, R * 0.62], [1, R]], C.chrome, { crossSections: 12, samples: 24 }),
      lathe('glow', [0, -L * 0.55, 0], [0, -L * 0.6, 0], [[0, R * 0.62], [1, R * 0.62]], C.light, { material: 'neon' }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0], exhaust: [0, round3(-L), 0] } };
  }
  if (fam === 'ionVent') {
    // a twin ion vent set into a hull's aft face: two glowing barrels side by side
    const gap = b.gap || R * 2.4;
    const lathes = [];
    for (const sx of [1, -1]) {
      const x = (sx * gap) / 2;
      lathes.push(lathe(`vent_${sx > 0 ? 'r' : 'l'}`, [x, 0, 0], [x, -L, 0], [[0, R], [1, R * 0.92]], C.trim));
      lathes.push(lathe(`glow_${sx > 0 ? 'r' : 'l'}`, [x, -L, 0], [x, -L - 0.03, 0], [[0, R * 0.75], [1, R * 0.75]], C.light, { material: 'neon' }));
    }
    return { lathes, hardpoints: { mount: [0, 0, 0] } };
  }
  if (fam === 'nacelle') {
    // a long drive nacelle on a crossbar: intake ring forward, cage struts, a glowing tail
    const lathes = [
      lathe('nacelle', [0, L / 2, 0], [0, -L / 2, 0], [[0, R * 0.7], [0.05, R], [0.25, R * 0.92], [0.75, R * 0.92], [0.92, R], [1, R * 0.85]], C.paint, { crossSections: 16, samples: 24 }),
      lathe('intake', [0, L / 2 + 0.05, 0], [0, L / 2 - 0.25, 0], [[0, R * 1.08], [1, R * 1.08]], C.trim),
      lathe('glow', [0, -L / 2, 0], [0, -L / 2 - 0.05, 0], [[0, R * 0.7], [1, R * 0.7]], C.light, { material: 'neon' }),
    ];
    const sweeps = [0, 1, 2, 3].map((i) => {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const x = Math.cos(a) * R * 0.97;
      const z = Math.sin(a) * R * 0.97;
      return sweep(`cage_${i}`, [[x, L * 0.25, z], [x, -L * 0.25, z]], 0.05, C.chrome);
    });
    return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], exhaust: [0, round3(-L / 2), 0] } };
  }
  throw new Error(`Unknown craft-engine family '${fam}'`);
}

/** A propeller: spinner forward of the mount, blades lofted root → tip with their twist. */
function buildPropeller(row, C) {
  const b = row.build;
  const D = row.dims.diameter;
  const sl = b.spinnerLength;
  const hubR = b.hubDiameter / 2;
  const yBlade = sl * 0.3;
  const lathes = [lathe('spinner', [0, 0, 0], [0, sl, 0], [[0, hubR], [0.4, hubR * 0.92], [1, 0.02]], C.chrome, { crossSections: 10, samples: 24 })];
  const lofts = [];
  for (let k = 0; k < b.blades; k += 1) {
    const phi = (k / b.blades) * 2 * Math.PI + Math.PI / 2 / b.blades;
    const rhat = [Math.cos(phi), 0, Math.sin(phi)];
    const that = [-Math.sin(phi), 0, Math.cos(phi)];
    const station = (f) => {
      const beta = (b.rootPitch + f * (b.tipPitch - b.rootPitch)) * DEG;
      const chord = b.rootChord + f * (b.tipChord - b.rootChord);
      const thick = chord * (0.16 - 0.1 * f);
      const c = [that[0] * Math.cos(beta), Math.sin(beta), that[2] * Math.cos(beta)];
      const nrm = [-that[0] * Math.sin(beta), Math.cos(beta), -that[2] * Math.sin(beta)];
      const pts = [];
      for (let i = 0; i < 8; i += 1) {
        const th = (i / 8) * 2 * Math.PI;
        const a = (chord / 2) * Math.cos(th);
        const tt = (thick / 2) * Math.sin(th);
        pts.push([a * c[0] + tt * nrm[0], a * c[1] + tt * nrm[1], a * c[2] + tt * nrm[2]]);
      }
      return pts;
    };
    const from = [rhat[0] * hubR * 0.8, yBlade, rhat[2] * hubR * 0.8];
    const to = [rhat[0] * D / 2, yBlade, rhat[2] * D / 2];
    lofts.push(loftWorld(`blade_${k}`, from, to, [{ t: 0, points: station(0) }, { t: 0.35, points: station(0.35) }, { t: 1, points: station(1) }], C.trim));
  }
  return { lathes, lofts, hardpoints: { mount: [0, 0, 0] } };
}

/** A reaction-control quad: a block on the hull with four nozzles in its plane. */
function buildThruster(row, C) {
  const s = row.dims.width;
  const box = [[-s / 2, 0, -s / 2], [s / 2, 0, -s / 2], [s / 2, 0, s / 2], [-s / 2, 0, s / 2]];
  const extrudes = [extrudeWorld('block', [0, s / 2, s / 2], [0, -s / 2, s / 2], box, C.trim)];
  const lathes = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy], i) => lathe(`nozzle_${i}`,
    [dx * s * 0.45, dy * s * 0.45, s / 2], [dx * s * 0.8, dy * s * 0.8, s / 2], [[0, s * 0.12], [1, s * 0.2]], C.chrome));
  return { extrudes, lathes, hardpoints: { mount: [0, 0, 0] } };
}

// ---- undercarriage ----------------------------------------------------------------------------

function wheel(id, x, y, z, D, Wt, C) {
  const R = D / 2;
  return [
    lathe(`${id}_tyre`, [x - Wt / 2, y, z], [x + Wt / 2, y, z], [[0, R * 0.62], [0.12, R * 0.93], [0.5, R], [0.88, R * 0.93], [1, R * 0.62]], C.rubber, { crossSections: 8, samples: 22 }),
    lathe(`${id}_hub`, [x - Wt * 0.52, y, z], [x + Wt * 0.52, y, z], [[0, R * 0.5], [1, R * 0.5]], C.chrome, { samples: 16 }),
  ];
}

/**
 * Landing gear, mount at the top of the strut (the gear well). `contact` is where the tyre (or
 * the skid pad) meets the ground in the part's frame: the assembler lifts the craft by it.
 */
function buildGear(row, C) {
  const b = row.build;
  const S = b.strut;
  const D = b.tyre ? b.tyre[0] : 0;
  const Wt = b.tyre ? b.tyre[1] : 0;
  const sweeps = [];
  const lathes = [];
  let axle;
  if (b.family === 'spring') {
    // a light aircraft's spring-steel leg splaying outboard to one wheel
    axle = [b.splay, 0, -S];
    sweeps.push(sweep('leg', [[0, 0, 0], [b.splay * 0.6, 0, -S * 0.7], axle], 0.035, C.chrome));
    lathes.push(...wheel('w', b.splay + Wt * 0.6, 0, -S, D, Wt, C));
    axle = [b.splay + Wt * 0.6, 0, -S];
  } else if (b.family === 'leg') {
    // an oleo leg, its wheels side by side on one axle (one or two)
    axle = [0, b.rake || 0, -S];
    sweeps.push(sweep('oleo', [[0, 0, 0], [0, (b.rake || 0) * 0.5, -S * 0.5], axle, [0, axle[1], -S - b.oleo * 0.8]], b.oleo, C.chrome));
    const n = b.wheels || 1;
    if (n === 1) lathes.push(...wheel('w', 0, axle[1], -S, D, Wt, C));
    else {
      const half = (Wt + b.oleo * 3) / 2;
      lathes.push(lathe('axle', [-half, axle[1], -S], [half, axle[1], -S], [[0, b.oleo * 0.7], [1, b.oleo * 0.7]], C.chrome));
      lathes.push(...wheel('wl', -half, axle[1], -S, D, Wt, C), ...wheel('wr', half, axle[1], -S, D, Wt, C));
    }
  } else if (b.family === 'bogie') {
    // a main-gear truck: one oleo onto a beam carrying `rows` axles of two wheels
    axle = [0, 0, -S];
    sweeps.push(sweep('oleo', [[0, 0, 0], [0, 0, -S - b.oleo * 0.8]], b.oleo, C.chrome));
    const rows = b.rows;
    const pitch = D * 1.12;
    const y0 = ((rows - 1) * pitch) / 2;
    sweeps.push(sweep('beam', [[0, y0 + D * 0.2, -S], [0, -y0 - D * 0.2, -S]], b.oleo * 0.7, C.chrome));
    const half = (Wt + b.oleo * 2.2) / 2;
    for (let i = 0; i < rows; i += 1) {
      const y = y0 - i * pitch;
      // two wheels a row on a truck; one a row on a tandem (a transport's sponson gear)
      if (b.single) lathes.push(...wheel(`w${i}`, 0, y, -S, D, Wt, C));
      else lathes.push(...wheel(`l${i}`, -half, y, -S, D, Wt, C), ...wheel(`r${i}`, half, y, -S, D, Wt, C));
    }
  } else if (b.family === 'skid') {
    // a landing strut and pad (spacecraft): no wheels
    const pad = b.pad;
    axle = [0, 0, -S];
    sweeps.push(sweep('strut', [[0, 0, 0], [0, 0, -S + 0.05]], b.oleo, C.chrome));
    lathes.push(lathe('pad', [0, 0, -S + 0.06], [0, 0, -S], [[0, pad[0] / 2], [1, pad[0] / 2]], C.trim));
    const contact = [0, 0, round3(-S)];
    return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], contact } };
  } else {
    throw new Error(`Unknown craft-gear family '${b.family}'`);
  }
  const contact = r3v([axle[0], axle[1], axle[2] - D / 2]);
  return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], contact } };
}

// ---- cockpit, mounts, weapons -----------------------------------------------------------------

/** A canopy: a glazed dome lofted from its front sill (the mount) aft; or a round window. */
function buildCanopy(row, C) {
  const { length: L, width: W, height: H } = row.dims;
  const b = row.build;
  if (b.family === 'roundWindow') {
    const R = W / 2;
    const lathes = [
      lathe('frame', [0, 0, 0], [0, 0.12, 0], [[0, R], [1, R * 0.96]], C.trim),
      lathe('glass', [0, 0.12, 0], [0, 0.15, 0], [[0, R * 0.9], [1, R * 0.9]], C.glass, { material: 'glass' }),
    ];
    const sweeps = [];
    for (let i = 0; i < (b.spokes || 8); i += 1) {
      const a = (i / (b.spokes || 8)) * 2 * Math.PI;
      sweeps.push(sweep(`spoke_${i}`, [[0, 0.16, 0], [Math.cos(a) * R * 0.92, 0.16, Math.sin(a) * R * 0.92]], 0.035, C.trim));
    }
    return { lathes, sweeps, hardpoints: { mount: [0, 0, 0] } };
  }
  const rows = b.stations || [[0, 0.3, 0.25], [0.3, 1, 0.92], [0.7, 0.95, 1], [1, 0.6, 0.55]];
  // a blown bubble, or (`facets`) flat panes like a faceted stealth canopy
  const FACET = [[1, 0], [0.62, 0.7], [0.18, 1], [-0.18, 1], [-0.62, 0.7], [-1, 0], [-0.9, -0.03], [0.9, -0.03]];
  const stations = rows.map(([s, w, h]) => ({
    t: s,
    points: (b.facets ? facetSection(Math.max(w * W / 2, 0.01), Math.max(h * H, 0.01), FACET) : section(Math.max(w * W / 2, 0.01), Math.max(h * H, 0.01), b.n || 2, 0.02)).map(([x, z]) => [x, 0, z]),
  }));
  const lofts = [loftWorld('glass', [0, 0, 0], [0, -L, 0], stations, C.glass, { ...(b.facets ? {} : { interp: 'smooth' }), material: 'glass' })];
  const sweeps = [];
  for (const f of b.bows || []) {
    const st = rows.reduce((acc, r) => (r[0] <= f ? r : acc), rows[0]);
    const a = (st[1] * W) / 2 * 1.03;
    const h = st[2] * H * 1.03;
    const path = [];
    for (let i = 0; i <= 6; i += 1) { const th = (i / 6) * Math.PI; path.push([Math.cos(th) * a, -f * L, Math.sin(th) * h]); }
    sweeps.push(sweep(`bow_${Math.round(f * 100)}`, path, 0.025, C.trim));
  }
  return { lofts, ...(sweeps.length ? { sweeps } : {}), hardpoints: { mount: [0, 0, 0] } };
}

/**
 * An air intake on the fuselage: a duct lofted aft from its mouth (the mount at the mouth's inner
 * edge), a dark face inside the lip, and for `halfCone` the shock cone standing in it. `side` sits
 * outboard of the mount (a left one is its mirror); `chin` hangs below it.
 */
function buildIntake(row, C) {
  const { length: L, width: w, height: h } = row.dims;
  const b = row.build;
  const n = b.n || 4;
  const off = b.family === 'chin' ? [0, -h / 2] : [w / 2, 0];
  const ring = (k) => section((w / 2) * k, (h / 2) * k, n, 1).map(([x, z]) => [x + off[0], 0, z + off[1]]);
  const lofts = [loftWorld('duct', [0, 0, 0], [0, -L, 0], [{ t: 0, points: ring(1) }, { t: 0.35, points: ring(1.02) }, { t: 1, points: ring(0.6) }], C.paint, { interp: 'smooth' })];
  const extrudes = [extrudeWorld('mouth', [0, 0.01, 0], [0, -0.06, 0], ring(0.84), C.rubber)];
  const lathes = [];
  if (b.family === 'halfCone') {
    const r = Math.min(w, h) * 0.32;
    lathes.push(lathe('cone', [off[0] - w * 0.12, w * 0.55, off[1]], [off[0] - w * 0.12, -0.08, off[1]], [[0, 0.01], [0.75, r * 0.9], [1, r]], C.chrome));
  }
  return { lofts, extrudes, ...(lathes.length ? { lathes } : {}), hardpoints: { mount: [0, 0, 0] } };
}

/** A pylon or a mount arm: the mount is its root, `carry` the far end where the store hangs. */
function buildPylon(row, C) {
  const b = row.build;
  const L = row.dims.length;
  const foil = airfoil({ thickness: b.thickness || 0.12 });
  if (b.family === 'underwing') {
    // hangs down and forward from under a wing's leading edge to the top of a nacelle
    const drop = row.dims.height;
    const fwd = b.forward;
    const at = (f) => foil.map(([c, h]) => [h * L * (1 - f * 0.3), -c * L * (1 - f * 0.25) + f * fwd, 0]);
    const lofts = [loftWorld('pylon', [0, 0, 0], [0, 0, -drop], [{ t: 0, points: at(0) }, { t: 1, points: at(1) }], C.paint)];
    return { lofts, hardpoints: { mount: [0, 0, 0], carry: r3v([0, fwd - L * 0.25, -drop]) } };
  }
  if (b.family === 'stub' || b.family === 'crossbar') {
    // a horizontal stub from the hull to a pod (an aft-fuselage engine, a crossbar nacelle)
    const chord = row.dims.chord;
    const st = foil.map(([c, h]) => [0, chord / 2 - c * chord, h * chord]);
    const lofts = [loftWorld('pylon', [0, 0, 0], [L, 0, 0], [{ t: 0, points: st }, { t: 1, points: st.map(([x, y, z]) => [x, y * 0.85, z * 0.85]) }], b.family === 'crossbar' ? C.trim : C.paint)];
    return { lofts, hardpoints: { mount: [0, 0, 0], carry: [round3(L), 0, 0] } };
  }
  if (b.family === 'arm') {
    // a round mount arm with a collar at each end (a panel wing's pylon)
    const r = row.dims.diameter / 2;
    const sweeps = [sweep('arm', [[0, 0, 0], [L, 0, 0]], r, C.paint)];
    const lathes = [
      lathe('collar_in', [0.05, 0, 0], [0.35, 0, 0], [[0, r * 1.5], [1, r * 1.2]], C.trim),
      lathe('collar_out', [L - 0.35, 0, 0], [L, 0, 0], [[0, r * 1.2], [1, r * 1.6]], C.trim),
    ];
    return { sweeps, lathes, hardpoints: { mount: [0, 0, 0], carry: [round3(L), 0, 0] } };
  }
  throw new Error(`Unknown craft-pylon family '${b.family}'`);
}

/** A weapon on a hardpoint: the mount is its breech; barrels point +y. */
function buildWeapon(row, C) {
  const b = row.build;
  const L = row.dims.length;
  const D = row.dims.diameter;
  const R = D / 2;
  if (b.family === 'cannon') {
    const bodyL = L * (b.body ?? 0.35);
    const lathes = [
      lathe('body', [0, -bodyL * 0.5, 0], [0, bodyL * 0.5, 0], [[0, R * 1.6], [0.8, R * 1.6], [1, R * 1.1]], C.trim),
      lathe('barrel', [0, bodyL * 0.5, 0], [0, L - bodyL * 0.5 - L * 0.12, 0], [[0, R], [1, R * 0.8]], C.chrome, { samples: 14 }),
      lathe('muzzle', [0, L - bodyL * 0.5 - L * 0.12 - 0.03, 0], [0, L - bodyL * 0.5, 0], [[0, 0.004], [0.08, R * 1.35], [0.9, R * 1.2], [1, 0.004]], C.trim, { harmonics: [{ n: 6, amplitude: 0.12 }] }),
      lathe('tip', [0, L - bodyL * 0.5 - 0.03, 0], [0, L - bodyL * 0.5 + 0.03, 0], [[0, R * 0.6], [1, 0.004]], C.light, { material: 'neon' }),
    ];
    return { lathes, hardpoints: { mount: [0, 0, 0], muzzle: [0, round3(L - bodyL * 0.5), 0] } };
  }
  if (b.family === 'rotary') {
    const lathes = [lathe('housing', [0, 0, 0], [0, L * 0.45, 0], [[0, R], [1, R * 0.9]], C.trim)];
    const sweeps = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * 2 * Math.PI;
      sweeps.push(sweep(`barrel_${i}`, [[Math.cos(a) * R * 0.55, L * 0.4, Math.sin(a) * R * 0.55], [Math.cos(a) * R * 0.55, L, Math.sin(a) * R * 0.55]], R * 0.16, C.chrome));
    }
    return { lathes, sweeps, hardpoints: { mount: [0, 0, 0], muzzle: [0, round3(L), 0] } };
  }
  if (b.family === 'missile') {
    const lathes = [lathe('body', [0, 0, 0], [0, L, 0], [[0, R * 0.8], [0.04, R], [0.88, R], [1, 0.01]], C.paint, { samples: 14 })];
    // four tail fins: plates holding the body axis and a radius, thin across the tangent
    const extrudes = [0, 90, 180, 270].map((deg, i) => {
      const c = Math.cos(deg * DEG + Math.PI / 4);
      const s = Math.sin(deg * DEG + Math.PI / 4);
      const t = 0.006;
      const fin = [[0, R], [L * 0.1, R], [L * 0.04, R * 2.6], [0, R * 2.6]];
      return extrudeWorld(`fin_${i}`, [s * t, 0.02, -c * t], [-s * t, 0.02, c * t], fin.map(([y, r]) => [c * r, y, s * r]), C.trim);
    });
    return { lathes, extrudes, hardpoints: { mount: [0, 0, 0], muzzle: [0, round3(L), 0] } };
  }
  if (b.family === 'launcher') {
    const w = row.dims.width;
    const box = [[-w / 2, 0, -D / 2], [w / 2, 0, -D / 2], [w / 2, 0, D / 2], [-w / 2, 0, D / 2]];
    const extrudes = [extrudeWorld('box', [0, 0, 0], [0, L, 0], box, C.trim)];
    const lathes = [];
    const n = b.tubes || 2;
    for (let i = 0; i < n; i += 1) {
      const x = (i - (n - 1) / 2) * (w / n);
      lathes.push(lathe(`tube_${i}`, [x, L, 0], [x, L + 0.02, 0], [[0, Math.min(w / n, D) * 0.36], [1, Math.min(w / n, D) * 0.36]], C.rubber));
    }
    return { extrudes, lathes, hardpoints: { mount: [0, 0, 0], muzzle: [0, round3(L), 0] } };
  }
  if (b.family === 'turret') {
    const base = row.dims.width;
    const lathes = [
      lathe('ring', [0, 0, 0], [0, 0, D * 0.3], [[0, base / 2], [1, base * 0.45]], C.trim),
      lathe('dome', [0, 0, D * 0.3], [0, 0, D], [[0, base * 0.42], [0.6, base * 0.32], [1, 0.02]], C.paint),
    ];
    for (const sx of [1, -1]) lathes.push(lathe(`barrel_${sx > 0 ? 'r' : 'l'}`, [sx * base * 0.16, 0, D * 0.55], [sx * base * 0.16, L, D * 0.55], [[0, 0.07], [1, 0.05]], C.chrome));
    return { lathes, hardpoints: { mount: [0, 0, 0], muzzle: [0, round3(L), round3(D * 0.55)] } };
  }
  throw new Error(`Unknown craft-weapon family '${b.family}'`);
}

export const CRAFT_BUILDERS = {
  'craft-fuselage': (row, C) => (row.build.family === 'ball' ? buildBall(row, C) : buildFuselage(row, C)),
  'craft-wing': (row, C, opts) => (row.build.family === 'panel' ? buildPanel(row, C) : buildLiftingSurface(row, C, opts)),
  'craft-stabilizer': buildLiftingSurface,
  'craft-fin': buildLiftingSurface,
  'craft-engine': buildEngine,
  'craft-propeller': buildPropeller,
  'craft-thruster': buildThruster,
  'craft-gear': buildGear,
  'craft-canopy': buildCanopy,
  'craft-pylon': buildPylon,
  'craft-weapon': buildWeapon,
  'craft-intake': buildIntake,
};
