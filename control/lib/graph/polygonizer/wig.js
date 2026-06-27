/**
 * wig — a reusable HAIR primitive, the sibling of the GARMENTS catalog for the head.
 *
 * Hair is a scalp-anchored shell expressed as ring-stacks, so it flows through the same
 * cloth-flow behaviors as a gown (flowDrape pins it at the crown, drapeCollide rests it on
 * the head/shoulders). A wig is therefore pure DATA — a few dials over one geometry generator:
 *
 *   • DOME CAP   the crown is covered by a sphere-cap whose radius → 0 at the apex (so the
 *               scalp never pokes through), flowing into a hanging fall.
 *   • CANONICAL HAIRLINE  `hairline` ∈ [0,1] raises the part from the brow toward the crown,
 *               WITHOUT touching the cap's coverage.
 *   • BANGS      `part` is the front-opening half-angle: ~0.18 wraps to a "split hoodie",
 *               ~0.5 = face-showing bangs, ~0.62 = a fuller curtain.
 *   • LENGTH / FULLNESS / FLARE / BACKFALL / CURL / COLOR — the rest of the silhouette.
 *
 * Four `kind`s, all the same currency: `curtain` (cap + fall; +`coil`/`ridge`/`roundBottom` give
 * afros + cornrows), `tail` (cap + a gathered tube; +`segments` = a braid), `strands` (cap + N
 * hanging tubes = box braids / locs), `knots` (cap + a grid of coiled spheres = bantu knots).
 *
 * `buildWig(body, spec)` reads the head from the posed body and returns ring-stack(s); the
 * caller flows them (flowDrape/drapeCollide) and meshes them. Stacks with `closed:true` are tubes
 * (mesh as loops); the curtain `wig` stack is an open sheet. See cloth-flow.plan.md.
 */

const TAU = 2 * Math.PI;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// The validated wardrobe of wigs (female figure). Each is a tuning of the same generator.
export const WIGS = {
  // long, parted, gently waved — the canonical flow.
  longWave:  { kind: 'curtain', color: '#6a3a1e', length: 4.7,  fullness: 1.28, hairline: 0.20, part: 0.50, flare: 0.45, backFall: 0.55, curl: { amp: 0.06, freq: 2.5, az: 5 } },
  // chin-length blunt bob — short, full, low flare.
  bob:       { kind: 'curtain', color: '#211a1d', length: 9.1,  fullness: 1.36, hairline: 0.10, part: 0.40, flare: 0.10, backFall: 0.18 },
  // cropped pixie — hugs the head, short, face wide open.
  pixie:     { kind: 'curtain', color: '#b8884e', length: 10.05, fullness: 1.10, hairline: 0.04, part: 0.66, flare: 0.04, backFall: 0.05 },
  // wrapped split-hood — pulled around to a narrow front split.
  splitHood: { kind: 'curtain', color: '#3a2418', length: 5.2,  fullness: 1.30, hairline: 0.26, part: 0.18, flare: 0.50, backFall: 0.60 },
  // long curls — heavy baked ripple down the fall.
  curls:     { kind: 'curtain', color: '#54301a', length: 5.0,  fullness: 1.34, hairline: 0.18, part: 0.52, flare: 0.50, backFall: 0.50, curl: { amp: 0.16, freq: 5.5, az: 9 } },
  // sleek ponytail — a smooth cap + a gathered tail down the back.
  ponytail:  { kind: 'tail', color: '#241a18', capLength: 9.7, capFull: 1.12, part: 0.5, gatherBack: 0.8, tailTip: 6.0, tailR: 0.22 },

  // ── braids + African textures ──────────────────────────────────────────────────
  // afro — a tall knobbly halo (vertical-stretched ellipsoid, lifted + round bottom + coil texture).
  afro:       { kind: 'curtain', color: '#46372a', fullness: 1.95, tall: 1.3, rise: 0.55, roundBottom: true, hairline: 0.30, part: 0.34, flare: 0, backFall: 0, coil: { amp: 0.16, az: 22, freq: 7 } },
  // short afro (TWA) — a close-cropped textured cap hugging the head.
  shortAfro:  { kind: 'curtain', color: '#3e3024', fullness: 1.2, tall: 1.06, rise: 0.06, roundBottom: true, hairline: 0.22, part: 0.42, flare: 0, backFall: 0, coil: { amp: 0.13, az: 26, freq: 9 } },
  // cornrows — flat braided rows hugging the scalp, running front→back, to the nape.
  cornrows:   { kind: 'curtain', color: '#3b2d23', length: 8.7, fullness: 1.06, hairline: 0.05, part: 0.42, flare: 0.06, backFall: 0.12, ridge: { count: 8, amp: 0.36 } },
  // box braids — many thin, ISOLATED braided strands fanned over the scalp, knotted along their length.
  boxBraids:  { kind: 'strands', color: '#3a2c22', count: 52, layers: 3, spread: 0.5, strandR: 0.05, length: 4.4, capFull: 1.04, part: 0.5, hairline: 0.34, segments: { amp: 0.55, freq: 9 } },
  // locs — fewer, thicker rope strands, lightly segmented.
  locs:       { kind: 'strands', color: '#523c24', count: 30, layers: 3, spread: 0.42, strandR: 0.085, length: 5.0, capFull: 1.04, part: 0.52, hairline: 0.34, segments: { amp: 0.2, freq: 5 } },
  // a single thick braid down the back (a plait).
  braid:      { kind: 'tail', color: '#4a3322', capLength: 9.6, capFull: 1.1, part: 0.5, gatherBack: 0.85, tailTip: 5.0, tailR: 0.3, segments: { amp: 0.34, freq: 8 } },
  // bantu knots — a grid of small coiled knots over the dome.
  bantuKnots: { kind: 'knots', color: '#3e2f24', rows: 3, cols: 4, knotR: 0.2, part: 0.6, hairline: 0.4 },

  // ── short / masculine cuts (read well on the male protoform; unisex) ──────────────
  // buzz — uniform very short cap, sitting high (forehead shows).
  buzz:       { kind: 'curtain', color: '#2e2620', length: 10.75, fullness: 1.03, hairline: 0.06, part: 0.18, flare: 0.02, backFall: 0.03 },
  // crew cut — a touch fuller/longer than buzz, neat.
  crewCut:    { kind: 'curtain', color: '#3a2e22', length: 10.5, fullness: 1.06, hairline: 0.1, part: 0.22, flare: 0.03, backFall: 0.05 },
  // slick-back — covers the crown, swept back, medium length, minimal front gap.
  slickBack:  { kind: 'curtain', color: '#2a2018', length: 9.6, fullness: 1.12, hairline: 0.05, part: 0.08, flare: 0.06, backFall: 0.42 },
  // pompadour — volume lifted up + forward on top.
  pompadour:  { kind: 'curtain', color: '#2e221a', length: 10.1, fullness: 1.15, tall: 1.22, rise: 0.34, hairline: 0.12, part: 0.26, flare: 0.05, backFall: 0.12 },
  // high-top — a tall textured block of hair on a short-sided cut.
  hightop:    { kind: 'curtain', color: '#1f1a18', length: 10.4, fullness: 1.18, tall: 1.55, rise: 0.4, hairline: 0.12, part: 0.16, flare: 0.04, backFall: 0.05, coil: { amp: 0.1, az: 24, freq: 8 } },
  // man-bun — a flat cap gathered into a knot at the back crown.
  manBun:     { kind: 'bun', color: '#2a2018', capLength: 10.2, capFull: 1.06, part: 0.34, hairline: 0.28, bunBack: 0.5, bunR: 0.42, bunRise: 0.18 },
  // taper — a traditional WAVY men's cut: hair on top + sides, the FOREHEAD AND FACE SHOWN (the front
  // opens above the hairline — not bangs over the face), volume on top (tall + rise), light wave texture.
  taper:      { kind: 'curtain', color: '#3a2a1c', length: 10.85, fullness: 1.0, hug: 0.06, topVol: 0.16, part: 0.0, frontLift: 0.78, flare: 0, backFall: 0, coil: { amp: 0.07, az: 8, freq: 3 } },
};

function headFrame(body) {
  const head = body.find((s) => s.id === 'headEgg');
  if (!head) throw new Error('wig: figure has no headEgg');
  let hx = 0, hy = 0, n = 0, crownZ = -Infinity, headR = 0, rc = 0;
  for (const r of head.rings) { hx += r.center.x; hy += r.center.y; n++; }
  hx /= n; hy /= n;
  for (const r of head.rings) for (const p of r.polyline) { if (p.z > crownZ) crownZ = p.z; headR += Math.hypot(p.x - r.center.x, p.y - r.center.y); rc++; }
  // radius-by-height profile of the skull (for `hug` cuts that follow the egg instead of an ellipsoid)
  const prof = head.rings.map((r) => { let s = 0, m = 0; for (const p of r.polyline) { s += Math.hypot(p.x - r.center.x, p.y - r.center.y); m++; } return { z: r.center.z, r: s / m }; }).sort((a, b) => a.z - b.z);
  const radiusAt = (z) => {
    if (z <= prof[0].z) return prof[0].r;
    if (z >= prof[prof.length - 1].z) return prof[prof.length - 1].r;
    for (let i = 0; i < prof.length - 1; i++) if (z >= prof[i].z && z <= prof[i + 1].z) { const t = (z - prof[i].z) / ((prof[i + 1].z - prof[i].z) || 1); return prof[i].r + (prof[i + 1].r - prof[i].r) * t; }
    return prof[prof.length - 1].r;
  };
  return { hx, hy, crownZ, headR: headR / rc, radiusAt };
}

// The curtain generator: dome cap → hanging fall, with the canonical hairline + bangs.
function buildCurtain(body, spec) {
  const { hx, hy, crownZ, headR, radiusAt } = headFrame(body);
  const M = 40, L = 34, front = Math.PI / 2;                            // +y = face
  const domeR = headR * spec.fullness;                                  // horizontal radius
  const vertR = domeR * (spec.tall ?? 1);                               // vertical radius (>domeR = taller, e.g. an afro)
  const apexZ = crownZ + 0.06 + (spec.rise ?? 0);                       // `rise` pushes the whole shape up
  const centerZ = apexZ - vertR, equatorZ = centerZ, browZ = equatorZ - 0.05;
  const ellip = (z) => domeR * Math.sqrt(Math.max(0, 1 - ((z - centerZ) / vertR) ** 2));   // ellipsoid radius at height z
  // `roundBottom` continues the ellipsoid below the equator (an afro puff that closes), so the
  // length is the underside rather than a hanging hem.
  const tipZ = spec.roundBottom ? centerZ - vertR + 0.05 : spec.length;
  // CANONICAL HAIRLINE — where the part opens, raised toward the crown. `hairline` is the per-wig
  // dial; HAIRLINE_LIFT raises the whole catalog a further 25% of the remaining brow→crown gap (the
  // part sits higher on the head). Moves only the opening — the dome cap's coverage is untouched.
  const HAIRLINE_LIFT = 0.25;
  const lifted = HAIRLINE_LIFT + (1 - HAIRLINE_LIFT) * (spec.hairline ?? 0);
  const faceTopZ = browZ + lifted * (apexZ - browZ);
  const part = spec.part, flare = spec.flare, backFall = spec.backFall;
  const curl = spec.curl, coil = spec.coil, ridge = spec.ridge;        // surface textures
  // FRONT HAIRLINE — raise just the FRONT edge of the cap to this height (a clean men's hairline,
  // no center part); the face below it shows. `frontLift` = distance below the crown.
  const frontHairZ = spec.frontLift != null ? crownZ - spec.frontLift : null;
  const rings = [];
  for (let t = 0; t <= L; t++) {
    const tf = t / L, z = apexZ + (tipZ - apexZ) * tf;
    let rr, yoff = 0, below = 0;
    if (spec.hug != null) {                                            // HUG: follow the skull's own radius (so it can't sink inside the head), + crown volume on top
      const topV = spec.topVol ? spec.topVol * clamp01((z - (crownZ - 1.0)) / 1.0) : 0;
      rr = radiusAt(z) + spec.hug + topV;
    } else if (z >= equatorZ || spec.roundBottom) { rr = ellip(z); }   // ellipsoid cap (and closing bottom for afros)
    else { below = (equatorZ - z) / Math.max(1e-6, equatorZ - tipZ); rr = domeR * (1 + flare * below); yoff = -backFall * below; }
    const open = part > 0 ? part * clamp01((faceTopZ - z) / 0.4) : 0;   // bangs part below the hairline (skip when closed)
    const span = TAU - 2 * open, poly = [];
    for (let k = 0; k <= M; k++) {
      const frac = k / M, aa = front + open + span * frac;
      let r = rr;
      if (curl && below > 0) r *= 1 + curl.amp * Math.sin(curl.freq * below * TAU + curl.az * frac * TAU) * smooth(below * 3);
      if (coil) r *= 1 + coil.amp * (0.5 + 0.5 * Math.sin(coil.az * frac * TAU)) * (0.5 + 0.5 * Math.sin(coil.freq * tf * TAU + frac * 9));   // knobbly afro texture
      if (ridge) r *= 1 + ridge.amp * (0.5 + 0.5 * Math.cos(ridge.count * frac * TAU));   // front→back cornrow ridges
      let vz = z;
      if (frontHairZ != null && z < frontHairZ) { const fw = clamp01((Math.cos(aa - front) - 0.62) / 0.38); vz = z + fw * (frontHairZ - z); }   // lift ONLY the front-centre to the hairline; temples/sides keep hair
      poly.push({ x: hx + Math.cos(aa) * r, y: hy + Math.sin(aa) * r + yoff, z: vz });
    }
    rings.push({ center: { x: hx, y: hy, z }, polyline: poly });
  }
  return { id: 'wig', rings, hex: spec.color };
}

// STRANDS — N ISOLATED tubes (box braids / locs / twists), distributed over the scalp in a few
// layered rings and hung with per-strand variation so they read as separate braids, not a sheet.
// A small skullcap sits under them; `segments` pulses each strand's radius into braid knots.
const hash = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };   // deterministic 0..1
function buildStrands(body, spec) {
  const { hx, hy, crownZ, headR } = headFrame(body);
  const apexZ = crownZ + 0.06, front = Math.PI / 2, faceHalf = spec.part ?? 0.55;
  const domeR = headR * (spec.capFull ?? 1.04), equatorZ = apexZ - domeR;
  // a small DARK skullcap (short, hugs the head) — not a curtain, so it can't read as drape.
  const cap = buildCurtain(body, { color: spec.color, length: equatorZ + 0.1, fullness: spec.capFull ?? 1.04, hairline: spec.hairline ?? 0.4, part: faceHalf, flare: 0.03, backFall: 0.05 });
  const N = spec.count ?? 36, M = 7, L = 20, strandR = spec.strandR ?? 0.06, seg = spec.segments;
  const layers = spec.layers ?? 3, spread = spec.spread ?? 0.55, baseLen = spec.length;
  const stacks = [cap];
  let si = 0;
  for (let li = 0; li < layers; li++) {
    const lz = li / Math.max(1, layers - 1);                            // 0 = back/lowest ring … 1 = highest, pulled in
    const rootZ = equatorZ - 0.15 + lz * (domeR * 0.85);               // root band climbs the dome
    const dd = rootZ - equatorZ, rootR = Math.sqrt(Math.max(0.04, domeR * domeR - dd * dd)) * 1.02;
    const per = Math.max(4, Math.round(N / layers));
    for (let ci = 0; ci < per; ci++) {
      const h1 = hash(si), h2 = hash(si + 101.7);
      const jit = (h1 - 0.5) * (1 / per) * 0.9;                         // break the ring so strands don't align
      const aa = front + faceHalf + (TAU - 2 * faceHalf) * (clamp01(ci / (per - 1) + jit));
      const ux = Math.cos(aa), uy = Math.sin(aa);
      const tipZ = baseLen + (uy < 0 ? -0.3 : 0.5) + (h2 - 0.5) * 0.8;  // back longer, plus per-strand variation
      const rings = [];
      for (let t = 0; t <= L; t++) {
        const tf = t / L, z = rootZ + (tipZ - rootZ) * tf;
        const drift = rootR + (spread + 0.4 * h1) * tf;                 // FAN out as it falls → isolation
        const cx = hx + ux * drift, cy = hy + uy * drift - (uy < 0 ? 0.6 : 0.25) * tf;
        let rr = strandR * (1 - 0.55 * tf);                            // taper to a point
        if (seg) rr *= 1 + seg.amp * Math.abs(Math.sin(seg.freq * tf * TAU + h1 * 6));   // braid knots, phase-varied
        const poly = [];
        for (let k = 0; k <= M; k++) { const ka = TAU * k / M; poly.push({ x: cx + Math.cos(ka) * rr, y: cy + Math.sin(ka) * rr, z }); }
        rings.push({ center: { x: cx, y: cy, z }, polyline: poly });
      }
      stacks.push({ id: `wig:strand${si}`, rings, hex: spec.color, closed: true });
      si++;
    }
  }
  return stacks;
}

// KNOTS — a scalp cap + a grid of small coiled spheres over the dome (bantu knots).
function buildKnots(body, spec) {
  const { hx, hy, crownZ, headR } = headFrame(body);
  const apexZ = crownZ + 0.06, front = Math.PI / 2, faceHalf = spec.part ?? 0.6;
  const domeR = headR * 1.05, equatorZ = apexZ - domeR;
  const cap = buildCurtain(body, { color: spec.color, length: equatorZ - 0.2, fullness: 1.05, hairline: spec.hairline ?? 0.4, part: faceHalf, flare: 0.04, backFall: 0.06 });
  const rows = spec.rows ?? 3, cols = spec.cols ?? 4, knotR = spec.knotR ?? 0.19, Mk = 10, stacks = [cap];
  for (let ri = 0; ri < rows; ri++) {
    const zt = ri / (rows - 1), z = apexZ - 0.25 - zt * (domeR * 1.1);  // crown → nape
    const d = z - (apexZ - domeR), ringR = Math.sqrt(Math.max(0.02, domeR * domeR - d * d)) + knotR * 0.6;
    for (let ci = 0; ci < cols; ci++) {
      const aa = front + faceHalf + (TAU - 2 * faceHalf) * (ci / (cols - 1));
      const kx = hx + Math.cos(aa) * ringR, ky = hy + Math.sin(aa) * ringR, rings = [];
      for (let p = 0; p <= Mk; p++) {                                  // a small sphere
        const ph = (p / Mk) * Math.PI, rr = Math.sin(ph) * knotR, poly = [];
        for (let k = 0; k <= Mk; k++) { const ka = TAU * k / Mk; poly.push({ x: kx + Math.cos(ka) * rr, y: ky + Math.sin(ka) * rr, z: z + knotR - Math.cos(ph) * knotR }); }
        rings.push({ center: { x: kx, y: ky, z: z + knotR - Math.cos(ph) * knotR }, polyline: poly });
      }
      stacks.push({ id: `wig:knot${ri}_${ci}`, rings, hex: spec.color, closed: true });
    }
  }
  return stacks;
}

// Ponytail: a smooth cap (a short, low-flare curtain) + a closed-tube tail down the back.
function buildTail(body, spec) {
  const cap = buildCurtain(body, { ...spec, length: spec.capLength, fullness: spec.capFull, hairline: 0.1, part: spec.part, flare: 0.05, backFall: 0.12, curl: null });
  const { hx, hy, crownZ, headR } = headFrame(body);
  const Gx = hx, Gy = hy - headR * (spec.gatherBack ?? 0.8), Gz = crownZ - 0.4;   // gather at the back crown
  const Lt = 24, M = 18, tailTip = spec.tailTip, tailR = spec.tailR, seg = spec.segments, rings = [];
  for (let t = 0; t <= Lt; t++) {
    const tf = t / Lt, z = Gz + (tailTip - Gz) * tf;
    const cx = Gx, cy = Gy - 0.6 * tf;
    let rr = tailR * (1 - 0.45 * tf);                                   // narrows toward the end
    if (seg) rr *= 1 + seg.amp * Math.abs(Math.sin(seg.freq * tf * TAU));   // braid knots
    const poly = [];
    for (let k = 0; k <= M; k++) { const aa = TAU * k / M; poly.push({ x: cx + Math.cos(aa) * rr, y: cy + Math.sin(aa) * rr, z }); }
    rings.push({ center: { x: cx, y: cy, z }, polyline: poly });
  }
  return [cap, { id: 'wig:tail', rings, hex: spec.color, closed: true }];
}

/**
 * Build a wig on a posed figure. Returns an array of ring-stacks (the curtain is one open
 * sheet; the ponytail is a cap + a closed `:tail` tube). Flow + mesh them in the caller.
 * @param {Array} body   figure stacks (needs `headEgg`)
 * @param {string|object} spec  a WIGS key or an inline spec
 */
// BUN — a scalp cap + a single coiled sphere gathered at the back crown (man-bun / top-knot).
function buildBun(body, spec) {
  const cap = buildCurtain(body, { color: spec.color, length: spec.capLength ?? 10.4, fullness: spec.capFull ?? 1.06, hairline: spec.hairline ?? 0.3, part: spec.part ?? 0.4, flare: 0.03, backFall: 0.1 });
  const { hx, hy, crownZ, headR } = headFrame(body);
  const bx = hx, by = hy - headR * (spec.bunBack ?? 0.5), bz = crownZ + (spec.bunRise ?? 0.2);
  const R = spec.bunR ?? 0.42, Mk = 12, rings = [];
  for (let p = 0; p <= Mk; p++) {
    const ph = (p / Mk) * Math.PI, rr = Math.sin(ph) * R, zc = bz + R - Math.cos(ph) * R, poly = [];
    for (let k = 0; k <= Mk; k++) { const ka = TAU * k / Mk; poly.push({ x: bx + Math.cos(ka) * rr, y: by + Math.sin(ka) * rr, z: zc }); }
    rings.push({ center: { x: bx, y: by, z: zc }, polyline: poly });
  }
  return [cap, { id: 'wig:bun', rings, hex: spec.color, closed: true }];
}

// Hair colour palette — natural shades + a few fashion tones. Decoupled from style: any wig can be
// any colour (pass a key or a hex to buildWig opts.color), with optional tip ombre + strand highlights.
export const HAIR_COLORS = {
  black: '#1c1a1d', darkBrown: '#3a2a20', brown: '#5a3a24', chestnut: '#6b3f24',
  auburn: '#7a3b22', red: '#8a3a1e', dirtyBlonde: '#9a7442', blonde: '#c8a25e',
  platinum: '#d8cba0', silver: '#b9bcc2', white: '#e6e3df', jetBlue: '#22202e',
  pink: '#c85a8a', teal: '#2f8a86', violet: '#7a4fb0', emerald: '#2f8a52',
};
const resolveColor = (c) => (typeof c === 'string' && HAIR_COLORS[c]) ? HAIR_COLORS[c] : c;

/**
 * Build a wig on a posed figure. Returns an array of ring-stacks. `opts` carries colour variations,
 * independent of the style: { color, tipColor, highlight } — each a HAIR_COLORS key OR a hex.
 *   color      overrides the style's base colour.
 *   tipColor   ombre: the mesher ramps each hair stack base→tip along its length.
 *   highlight  recolours every 3rd strand (strand kinds) for streaks.
 */
export function buildWig(body, spec, opts = {}) {
  const base0 = typeof spec === 'string' ? WIGS[spec] : spec;
  if (!base0) throw new Error(`wig: unknown style '${spec}'`);
  const color = resolveColor(opts.color ?? base0.color);
  const tip = (opts.tipColor ?? base0.tipColor) != null ? resolveColor(opts.tipColor ?? base0.tipColor) : null;
  const hl = opts.highlight != null ? resolveColor(opts.highlight) : null;
  const s = { ...base0, color };
  let stacks;
  switch (s.kind) {
    case 'tail': stacks = buildTail(body, s); break;
    case 'strands': stacks = buildStrands(body, s); break;
    case 'knots': stacks = buildKnots(body, s); break;
    case 'bun': stacks = buildBun(body, s); break;
    default: stacks = [buildCurtain(body, s)];
  }
  let strandSeen = 0;
  return stacks.map((st) => {
    let hex = st.hex;
    if (hl && st.id.includes('strand')) { if (strandSeen % 3 === 0) hex = hl; strandSeen++; }
    const out = { ...st, hex };
    if (tip) out.ramp = [hex, tip];                                     // ombre: roots → tips (mesher lerps per ring)
    return out;
  });
}
