/**
 * Visual Reference — the `object` extraction target.
 *
 * Where `scene` recovers a CAMERA and `pose` recovers an ARMATURE, `object`
 * recovers a PART-GRAPH: the harness reads one object and states it as a
 * composition of workbench monomers, which lowers to a `kind:'workbench'`
 * recipe (the measured object study) and mints like any other cage.
 *
 * Two disciplines are enforced STRUCTURALLY here rather than checked after
 * the fact (see object-reference.plan.md §7, §8):
 *
 *  1. NO ABSOLUTE Z. Every height is a FRACTION of `unitHeight`, and the
 *     substrate multiplies. Authoring z by stacking part heights is
 *     over-constrained — `total = Σ heights` leaves no slack, so you cannot
 *     honour both the read part proportions and the read total. Fractions
 *     against one total make proportion drift structurally impossible.
 *  2. EVERY PART DECLARES ITS JUNCTION — `stack` | `jut` | `composite`. A
 *     build that uses one move everywhere is the classic failure; naming the
 *     move per part is what stops it.
 *
 * Perspective is NOT handled here. A non-orthographic photo must run the
 * `scene` target FIRST (it is a shipped capability) and pass its
 * `roomBasis.verticalUnit` as `scale.verticalUnit`, so band heights are read
 * in world units (px / verticalUnit) rather than raw pixels.
 */

const MONOMERS = ['lathe', 'extrude', 'sweep', 'shell'];
const JUNCTIONS = ['stack', 'jut', 'composite'];

export const OBJECT_PROTOCOL = {
  target: 'object',
  summary:
    "Read ONE object's PART-GRAPH — not its texture. State it as workbench monomers (lathe / extrude / sweep / shell) bonded by a named JUNCTION move, with every height a FRACTION of the object's total. You decompose and proportion; the substrate computes z, mints the recipe, and reports what does not contribute. A COMPLEX subject goes segment-first: several sub-objects, each judged alone, composed by gravity seating.",
  key_lines: [
    "IDENTITY LOCK first, and restate it on every pass: <=5 named repeatable traits in one sentence (colour / material / silhouette / mass / signature detail). This is the anti-drift device — if you cannot say it in a sentence, do not start.",
    "DOMAIN CHECK: is the subject an ASSEMBLY of primitives (furniture, vessels, tools, machines, props, vehicles, architecture)? An organic single mass (a running animal, a face) is the figure family's job — say so and stop.",
    "SEGMENT OR ONE-SHOT? Count the DISTINCT SEAMS — the places where the subject changes what it is (tower / island / stair flight / water base). Three or more, or more than ~10 parts, is COMPLEX: author `segments[]`, each a whole sub-object at its OWN origin with its own `heightFrac` of the total, seated on an earlier segment by `on`. One-shotting a complex whole is the proven failure mode. Simple and coaxial (a moka pot, a bottle, a lamp) stays `parts[]`.",
    "PERSPECTIVE: if the photo is NOT near-orthographic, run reference_protocol({target:'scene'}) FIRST and pass its roomBasis.verticalUnit as scale.verticalUnit. Read band heights as px/verticalUnit — never raw pixels, or your proportions will be confidently wrong.",
    "PROPORTION: fix the object's total height as `unitHeight` (real cm if the operator grounds one, else 100). Give every part `zFrom`/`zTo` as FRACTIONS of it. Never write an absolute z.",
    "DECOMPOSE: name each part; assign a monomer from the CLOSED vocabulary (lathe = surface of revolution; extrude = prism/slab; sweep = tube along a path; shell = polyhedron). A part that fits none is a VOCABULARY GAP to name, not a part to fake.",
    "SILHOUETTE: a lathe's radius profile IS its drawn silhouette — sample {t,radius} at the visible breaks (shoulders, flares, pinches). Do not smooth a break you can see.",
    "JUNCTION per part — `stack` (seat on what is below), `jut` (sink into a host so only fraction `jut` protrudes: ~0.25 a recessed frame/boss, ~0.5 a sill, ~0.9 a shelf), or `composite` (one of several masses unioned into an irregular silhouette).",
    "REPEATS as counts, not enumerated parts (railing posts, stair treads, bolt circles).",
    "OCCLUSION LEDGER: list what you could not see (the back, the interior, the underside). These are caveats, not licence to invent.",
  ],
  input_schema: {
    'insights.identity': 'string — the identity lock, <=5 traits, one sentence. REQUIRED.',
    'insights.unitHeight': "number — the object's total height (real cm if grounded, else 100). Default 100.",
    'insights.grounded': 'bool — true only if the operator named a real dimension.',
    'insights.orthographic': 'bool — is the source near-orthographic? If false, scale.verticalUnit is expected.',
    'insights.scale.verticalUnit': 'number — px per world-height unit, from a scene pass. Read heights as px/verticalUnit.',
    'insights.view': '{ az, el } — the azimuth/elevation you read at; the eyes gate re-renders here.',
    'insights.parts[]':
      '{ id, monomer:lathe|extrude|sweep|shell, junction:stack|jut|composite, tint?, material?, ' +
      'zFrom/zTo (FRACTIONS 0..1, axial parts), at:[x,y]?, profile?, endProfile?, harmonics?, ' +
      'radius? (lathe constant / shell / sweep tube), rect?:{w,h,r}, points?:[[u,v]], ' +
      'anchor:[x,y,zFrac]? + normal:[nx,ny,nz]? + depth? + jut? (0..1, for junction:"jut"), ' +
      'path?:[[x,y,zFrac]] (sweep), solid? (shell), center:[x,y,zFrac]? (shell) }',
    'insights.segments[]':
      'SEGMENT-FIRST alternative to `parts` (never both). '
      + '{ id, label?, heightFrac (FRACTION of unitHeight — this segment\'s share of the whole), '
      + 'parts:[…] (each part\'s zFrom/zTo is a fraction of THIS SEGMENT\'s height, not the whole), '
      + "on ('ground' | an EARLIER segment id — gravity seating computes the running z), gap?, "
      + 'at?:[x,y] (never z), rotate?, flip?, scale?, repeat?:{count,step} }. Lowers to a kind:\'assembler\' recipe '
      + 'plus one workbench recipe per segment, so each segment can be rendered and judged ALONE before the composition is.',
    'insights.drop': 'string[] — on a REFINING pass (stash_ref), part/segment ids a later view proves are not there.',
    'insights.caveats': 'string[] — what you could not see.',
  },
  fidelity_contract: {
    blocky:
      'DEFAULT. Massing only — the big masses and their junctions, a handful of monomers. Get the silhouette and the proportions; skip secondary hardware.',
    faithful:
      'Measured proportions plus secondary parts (frames, rails, trim). Then render, Read it beside the ORIGINAL image, and iterate with update_sketch on the same ref.',
  },
  ceiling: [
    'NO BOOLEAN SUBTRACTION. There are no cuts — a recess is a dark-tinted mass sunk into the wall (junction:"jut" with a small jut fraction). This reads well; it is not a workaround to apologise for.',
    'SEGMENTS COMPOSE BY GRAVITY, so a segment that BRIDGES (a chariot bed between its wheels) has no support to rest on. Seat it on the segment it spans and lift it with `gap` — there is no absolute z at the segment altitude.',
    'SINGLE VIEW sees one side. The back, the interior, and the underside are invented or omitted — put them in caveats. Rotational monomers are exempt (a lathe\'s back is implied by revolution).',
    'PERSPECTIVE is not corrected here. Without a scene pass on a non-orthographic photo, proportions are foreshortened and the ledger will not notice.',
    'The jut dial is RENDERER-DEPENDENT: unlit reads a feature by its outline, a lit DCC render reads it by the shadow it casts. A jut tuned unlit can dissolve when lit — budget deeper for a lit destination.',
    'material presets bake a shading response into the exported vertex colours. For a lit external render use a plain tint, or the DCC double-shades it.',
  ],
  multipass_hint:
    "One view fixes the silhouette and the vertical proportions; a SECOND view (rotate ~90deg) fixes depth, the radius-to-height scale, and any part whose extent runs toward camera. Call capture_reference again with the same stash_ref and pass ONLY THE CORRECTIONS: the pass FUSES onto what you already filed, matching parts and segments BY ID. A part you re-send is field-merged (send just `{ id, radius }` to fix one radius); a part you omit is carried forward untouched; a new id is added; `drop:['id']` removes one the second view disproves. The response reports carried / updated / added / dropped so you can see what the pass actually changed. Switching between `parts` and `segments` is a re-authoring, not a refinement — fusion is skipped and your new read stands alone. If the object sits in a scene, capture the scene target into the SAME stash so the camera and the part-graph share one anchor.",
  capture_call:
    "capture_reference({ target:'object', fidelity, insights:{ identity, unitHeight, orthographic, scale?, view?, parts:[…] OR segments:[…], caveats? }, stash_ref? })",
};

// --- helpers ---------------------------------------------------------------

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const xy = (v, d = [0, 0]) => (Array.isArray(v) && isNum(v[0]) && isNum(v[1]) ? [v[0], v[1]] : d);

function frac(v, label, errs) {
  if (!isNum(v) || v < -0.05 || v > 1.5) {
    errs.push(`${label} must be a FRACTION of unitHeight in [0,1] (got ${JSON.stringify(v)}). Never author an absolute z.`);
    return 0;
  }
  return v;
}

/** Unit vector along a monomer's axis (defaults to +z for a degenerate axis). */
function axisUnit(a, b) {
  const d = [b.x - a.x, b.y - a.y, b.z - a.z];
  const L = Math.hypot(d[0], d[1], d[2]);
  return L > 1e-9 ? [d[0] / L, d[1] / L, d[2] / L] : [0, 0, 1];
}

/** Farthest point of an extrude profile from its axis (the circumradius) — for BOUNDS. */
function profileReach(profile) {
  if (!profile) return 0;
  if (profile.rect) return Math.hypot(profile.rect.w / 2, profile.rect.h / 2);
  if (Array.isArray(profile.points)) return Math.max(0, ...profile.points.map((p) => Math.hypot(p[0], p[1])));
  return 0;
}

/**
 * NEAREST point of an extrude profile boundary to its axis (the inradius) — for
 * CONTAINMENT. Using the circumradius here is what broke the contribution check
 * on a square tower: a prism of half-width a was tested as a cylinder of radius
 * a*sqrt(2), so it "contained" every door and window mounted on its own face and
 * reported all four as 100% buried. The inradius errs the other way, which is the
 * stance this check already declares — under-report rather than cry wolf.
 */
function profileInradius(profile) {
  if (!profile) return 0;
  if (profile.rect) return Math.min(profile.rect.w, profile.rect.h) / 2;
  if (!Array.isArray(profile.points) || profile.points.length < 2) return 0;
  const pts = profile.points;
  let best = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    const A = pts[i], B = pts[(i + 1) % pts.length];
    const dx = B[0] - A[0], dy = B[1] - A[1];
    const L2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, -(A[0] * dx + A[1] * dy) / L2));
    best = Math.min(best, Math.hypot(A[0] + dx * t, A[1] + dy * t));
  }
  return Number.isFinite(best) ? best : 0;
}

/** Axis-aligned bounds for one lowered monomer — used by the contribution check. */
function aabb(kind, m) {
  if (kind === 'lathe') {
    const r = Math.max(...(m.profile || [{ radius: 0 }]).map((p) => p.radius || 0));
    const [a, b] = [m.axisFrom, m.axisTo];
    return [[Math.min(a.x, b.x) - r, Math.min(a.y, b.y) - r, Math.min(a.z, b.z)],
            [Math.max(a.x, b.x) + r, Math.max(a.y, b.y) + r, Math.max(a.z, b.z)]];
  }
  if (kind === 'extrude') {
    const [a, b] = [m.axisFrom, m.axisTo];
    const r = Math.max(profileReach(m.profile), profileReach(m.endProfile));
    // The profile sweeps PERPENDICULAR to the axis, so `r` must be projected onto
    // each world axis, not added to all three. Adding it flat inflated a wide flat
    // slab's z-extent by its own width — a 39-wide, 2.8-tall plinth measured 42
    // tall and every height check screamed. Round monomers hid it (a lathe's own
    // branch never did this); the first boxy subject surfaced it.
    const u = axisUnit(a, b);
    const ex = [r * Math.sqrt(Math.max(0, 1 - u[0] * u[0])),
                r * Math.sqrt(Math.max(0, 1 - u[1] * u[1])),
                r * Math.sqrt(Math.max(0, 1 - u[2] * u[2]))];
    return [[Math.min(a.x, b.x) - ex[0], Math.min(a.y, b.y) - ex[1], Math.min(a.z, b.z) - ex[2]],
            [Math.max(a.x, b.x) + ex[0], Math.max(a.y, b.y) + ex[1], Math.max(a.z, b.z) + ex[2]]];
  }
  if (kind === 'sweep') {
    const r = m.radius || 0;
    const xs = m.path.map((p) => p[0]), ys = m.path.map((p) => p[1]), zs = m.path.map((p) => p[2]);
    return [[Math.min(...xs) - r, Math.min(...ys) - r, Math.min(...zs) - r],
            [Math.max(...xs) + r, Math.max(...ys) + r, Math.max(...zs) + r]];
  }
  const c = m.center || { x: 0, y: 0, z: 0 }, r = m.radius || 0;
  return [[c.x - r, c.y - r, c.z - r], [c.x + r, c.y + r, c.z + r]];
}

const hits = (p, b) => p[0] >= b[0][0] && p[0] <= b[1][0] && p[1] >= b[0][1] && p[1] <= b[1][1]
                    && p[2] >= b[0][2] && p[2] <= b[1][2];

/**
 * Fraction of `box` covered by the UNION of `others`, by occupancy sampling.
 *
 * The earlier version tested containment against a SINGLE other part and
 * therefore missed the case it exists to catch — a part swallowed by several
 * overlapping neighbours (the moka pot's lid flap, enclosed by rim + upper +
 * cavity, scored `buried: []`). Sampling the union catches it.
 */
function coveredFraction(box, solids, n = 6) {
  if (!solids.length) return 0;
  const [lo, hi] = box;
  let hit = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const p = [lo[0] + ((i + 0.5) / n) * (hi[0] - lo[0]),
               lo[1] + ((j + 0.5) / n) * (hi[1] - lo[1]),
               lo[2] + ((k + 0.5) / n) * (hi[2] - lo[2])];
    if (solids.some((s) => containsPoint(s, p))) hit++;
  }
  return hit / (n * n * n);
}

// Distance from p to the segment A->B, plus the normalised position along it.
function axisProject(A, B, p) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-9;
  let t = ((p[0] - A[0]) * d[0] + (p[1] - A[1]) * d[1] + (p[2] - A[2]) * d[2]) / L2;
  const tc = Math.max(0, Math.min(1, t));
  const q = [A[0] + d[0] * tc, A[1] + d[1] * tc, A[2] + d[2] * tc];
  return { t, radial: Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) };
}

/**
 * Point-in-solid, per monomer. An AABB is far too coarse for a surface of
 * revolution — a taper's box uses its MAX radius at every height, so a cone
 * "contains" its whole bounding column. That over-reported every visible band
 * (gasket, valve, mouth) as buried. Test the actual swept solid instead.
 */
function containsPoint(s, p) {
  if (s.kind === 'lathe') {
    const A = [s.m.axisFrom.x, s.m.axisFrom.y, s.m.axisFrom.z];
    const B = [s.m.axisTo.x, s.m.axisTo.y, s.m.axisTo.z];
    const { t, radial } = axisProject(A, B, p);
    if (t < 0 || t > 1) return false;
    const prof = s.m.profile || [];
    if (!prof.length) return false;
    // radius at t, linear between profile stops
    let r = prof[prof.length - 1].radius;
    if (prof.length === 1) r = prof[0].radius;
    else for (let i = 0; i < prof.length - 1; i++) {
      const a = prof[i], b = prof[i + 1];
      if (t >= a.t && t <= b.t) { const f = (t - a.t) / ((b.t - a.t) || 1); r = a.radius + (b.radius - a.radius) * f; break; }
    }
    return radial <= r;
  }
  if (s.kind === 'sweep') {
    for (let i = 0; i < s.m.path.length - 1; i++) {
      const { t, radial } = axisProject(s.m.path[i], s.m.path[i + 1], p);
      if (t >= 0 && t <= 1 && radial <= (s.m.radius || 0)) return true;
    }
    return false;
  }
  if (s.kind === 'shell') {
    const c = s.m.center || { x: 0, y: 0, z: 0 };
    return Math.hypot(p[0] - c.x, p[1] - c.y, p[2] - c.z) <= (s.m.radius || 0);
  }
  // extrude: a prism swept along its axis, tested as the INSCRIBED cylinder — the
  // largest cylinder that fits inside the prism at every station. A tapered prism
  // (`endProfile`) narrows along the axis, so the radius is interpolated: without
  // it a tapered tower is tested at its base width all the way up, and everything
  // mounted on the upper wall reads as buried.
  const A = [s.m.axisFrom.x, s.m.axisFrom.y, s.m.axisFrom.z];
  const B = [s.m.axisTo.x, s.m.axisTo.y, s.m.axisTo.z];
  const { t, radial } = axisProject(A, B, p);
  if (t < 0 || t > 1) return false;
  const r0 = profileInradius(s.m.profile);
  const r1 = s.m.endProfile ? profileInradius(s.m.endProfile) : r0;
  return radial <= r0 + (r1 - r0) * t;
}

// --- the lowering ----------------------------------------------------------

/**
 * Lower ONE part list against a height `H`. Shared by the one-shot path and by
 * every segment of the segment-first path: the part vocabulary is identical at
 * both altitudes, and only what `H` MEANS changes (the whole object, or one
 * segment of it). Fractions are always taken against the H they are handed, so
 * a segment authored alone keeps the same no-absolute-z discipline the whole
 * object does.
 */
function lowerPartList(parts, H, errs, prefix = 'parts') {
  const lathes = [], extrudes = [], sweeps = [], shells = [];
  const index = [];   // { id, kind, idx, junction, declaredJut? }
  const seen = new Set();

  parts.forEach((p, i) => {
    const tag = `${prefix}[${i}]${p && p.id ? ` ('${p.id}')` : ''}`;
    if (!p || typeof p !== 'object') { errs.push(`${tag} must be an object.`); return; }
    if (!p.id || typeof p.id !== 'string') errs.push(`${tag}.id is required (a short name you can refer to).`);
    else if (seen.has(p.id)) errs.push(`${tag}.id '${p.id}' is duplicated.`);
    else seen.add(p.id);
    if (!MONOMERS.includes(p.monomer)) {
      errs.push(`${tag}.monomer must be one of ${MONOMERS.join(' | ')} (got ${JSON.stringify(p.monomer)}). A part that fits none is a vocabulary gap to name, not a part to fake.`);
      return;
    }
    if (!JUNCTIONS.includes(p.junction)) {
      errs.push(`${tag}.junction must be one of ${JUNCTIONS.join(' | ')} — name the move that bonds this part.`);
      return;
    }
    const tint = typeof p.tint === 'string' ? { tint: p.tint } : {};
    const mat = typeof p.material === 'string' ? { material: p.material } : {};

    // A `jut` part is placed by anchor + outward normal + how much protrudes.
    if (p.junction === 'jut' && Array.isArray(p.anchor)) {
      const jf = isNum(p.jut) ? p.jut : 0.3;
      if (jf < 0 || jf > 1) errs.push(`${tag}.jut must be in [0,1] — the FRACTION of depth that protrudes.`);
      const d = isNum(p.depth) ? p.depth : 2;
      const n = Array.isArray(p.normal) && p.normal.length === 3 ? p.normal : [0, -1, 0];
      const L = Math.hypot(...n) || 1;
      const u = [n[0] / L, n[1] / L, n[2] / L];
      const az = frac(p.anchor[2], `${tag}.anchor[2]`, errs) * H;
      const A = [p.anchor[0] || 0, p.anchor[1] || 0, az];
      const into = d * (1 - jf), out = d * jf;
      const prof = p.points ? { points: p.points } : p.rect ? { rect: p.rect } : null;
      if (!prof) { errs.push(`${tag} (jut) needs a \`points\` outline or a \`rect\` profile.`); return; }
      extrudes.push({
        profile: prof,
        axisFrom: { x: A[0] - u[0] * into, y: A[1] - u[1] * into, z: A[2] - u[2] * into },
        axisTo: { x: A[0] + u[0] * out, y: A[1] + u[1] * out, z: A[2] + u[2] * out },
        ...tint, ...mat,
      });
      index.push({ id: p.id, kind: 'extrude', idx: extrudes.length - 1, junction: p.junction, declaredJut: jf, declaredOut: d * jf });
      return;
    }

    if (p.monomer === 'sweep') {
      if (!Array.isArray(p.path) || p.path.length < 2) { errs.push(`${tag}.path needs >=2 [x,y,zFrac] points.`); return; }
      sweeps.push({
        path: p.path.map((q, k) => [q[0] || 0, q[1] || 0, frac(q[2], `${tag}.path[${k}][2]`, errs) * H]),
        radius: isNum(p.radius) ? p.radius : 0.3,
        ...(isNum(p.sides) ? { sides: p.sides } : {}), ...tint, ...mat,
        ...(p.caps === false ? { caps: false } : {}),
      });
      index.push({ id: p.id, kind: 'sweep', idx: sweeps.length - 1, junction: p.junction });
      return;
    }

    if (p.monomer === 'shell') {
      const c = Array.isArray(p.center) ? p.center : [0, 0, 0.5];
      shells.push({
        solid: p.solid || 'icosahedron',
        radius: isNum(p.radius) ? p.radius : 1,
        center: { x: c[0] || 0, y: c[1] || 0, z: frac(c[2], `${tag}.center[2]`, errs) * H },
        ...(isNum(p.frequency) ? { frequency: p.frequency } : {}),
        ...(Array.isArray(p.orient) ? { orient: p.orient } : {}), ...tint, ...mat,
      });
      index.push({ id: p.id, kind: 'shell', idx: shells.length - 1, junction: p.junction });
      return;
    }

    // axial lathe / extrude
    const z0 = frac(p.zFrom, `${tag}.zFrom`, errs) * H;
    const z1 = frac(p.zTo, `${tag}.zTo`, errs) * H;
    if (z1 <= z0) errs.push(`${tag}: zTo must be greater than zFrom.`);
    const [ox, oy] = xy(p.at);
    const axisFrom = { x: ox, y: oy, z: z0 };
    const axisTo = { x: isNum(p.atTo?.[0]) ? p.atTo[0] : ox, y: isNum(p.atTo?.[1]) ? p.atTo[1] : oy, z: z1 };

    if (p.monomer === 'lathe') {
      let profile = Array.isArray(p.profile) ? p.profile : null;
      if (!profile && isNum(p.radius)) profile = [{ t: 0, radius: p.radius }];
      if (!profile) { errs.push(`${tag} (lathe) needs a \`profile\` [{t,radius}] or a constant \`radius\`. A lathe's profile IS its drawn silhouette.`); return; }
      lathes.push({
        axisFrom, axisTo, profile,
        ...(Array.isArray(p.harmonics) ? { harmonics: p.harmonics } : {}),
        ...(isNum(p.crossSections) ? { crossSections: p.crossSections } : {}),
        ...(isNum(p.samples) ? { samples: p.samples } : {}), ...tint, ...mat,
      });
      index.push({ id: p.id, kind: 'lathe', idx: lathes.length - 1, junction: p.junction });
      return;
    }

    const prof = p.points ? { points: p.points } : p.rect ? { rect: p.rect } : null;
    if (!prof) { errs.push(`${tag} (extrude) needs \`rect\`:{w,h,r?} or \`points\`:[[u,v],…].`); return; }
    extrudes.push({
      profile: prof, axisFrom, axisTo,
      ...(p.endPoints ? { endProfile: { points: p.endPoints } } : {}),
      ...(isNum(p.wallThickness) ? { wallThickness: p.wallThickness } : {}),
      ...(typeof p.openFace === 'string' ? { openFace: p.openFace } : {}), ...tint, ...mat,
    });
    index.push({ id: p.id, kind: 'extrude', idx: extrudes.length - 1, junction: p.junction });
  });

  return { lathes, extrudes, sweeps, shells, index };
}

/** The monomer arrays of a lowered bundle, as a workbench manifest body. */
function monomerBody({ lathes, extrudes, sweeps, shells }) {
  return {
    ...(lathes.length ? { lathes } : {}), ...(extrudes.length ? { extrudes } : {}),
    ...(sweeps.length ? { sweeps } : {}), ...(shells.length ? { shells } : {}),
  };
}

/**
 * The advisory gates over ONE lowered bundle: contribution coverage, jut
 * shortfall, the measured-vs-declared height, and the junction-monoculture
 * check. Runs per SEGMENT in segment mode — a part is buried by its own
 * segment's neighbours, which is the altitude the author was reading at.
 */
function advisoryLedger(bundle, H, { scope = '', objectHeight = 0 } = {}) {
  const { lathes, extrudes, sweeps, shells, index } = bundle;
  const pick = { lathe: lathes, extrude: extrudes, sweep: sweeps, shell: shells };
  const boxes = index.map((e) => ({ id: e.id, junction: e.junction, box: aabb(e.kind, pick[e.kind][e.idx]) }));
  // CONTRIBUTION CHECK — a mass fully inside the UNION of its neighbours
  // contributes no silhouette and no visible surface: dead weight, and usually
  // a jut the author meant to protrude.
  const solids = index.map((e) => ({ id: e.id, kind: e.kind, m: pick[e.kind][e.idx] }));
  const coverage = boxes.map((a) => ({
    id: a.id,
    covered: +coveredFraction(a.box, solids.filter((s) => s.id !== a.id)).toFixed(3),
  }));
  const byId = Object.fromEntries(index.map((e) => [e.id, e]));
  const buried = coverage.filter((c) => c.covered >= 0.9);
  // JUT SHORTFALL — the sharper check. A `jut` part DECLARED how much of it
  // should protrude; measure whether it actually does. Coverage alone cannot
  // tell a deliberately-sunk mass (a recess, a vessel mouth — supposed to be
  // mostly buried) from a feature that simply failed to clear its host.
  const shortfall = coverage
    .map((c) => ({ ...c, declared: byId[c.id]?.declaredJut }))
    .filter((c) => typeof c.declared === 'number' && (1 - c.covered) < c.declared * 0.55)
    .map((c) => ({ id: c.id, declared: c.declared, exposed: +(1 - c.covered).toFixed(3) }));

  // ABSOLUTE-SCALE CHECK. Shortfall above is a RATIO — "53% of the door protrudes"
  // passes happily while the door stands 1.1 units proud of a 100-unit tower and
  // is invisible in every render. A ratio cannot see scale; measure the protrusion
  // against the OBJECT's height and say so when a feature is too small to read.
  const scaleH = objectHeight || H;
  const faint = index
    .filter((e) => typeof e.declaredOut === 'number' && scaleH > 0 && e.declaredOut < 0.02 * scaleH)
    .map((e) => ({ id: e.id, out: +e.declaredOut.toFixed(2), needed: +(0.02 * scaleH).toFixed(2) }));

  const zs = boxes.flatMap((b) => [b.box[0][2], b.box[1][2]]);
  const measuredHeight = zs.length ? Math.max(...zs) - Math.min(...zs) : 0;
  const junctions = index.reduce((o, e) => ({ ...o, [e.junction]: (o[e.junction] || 0) + 1 }), {});
  const where = scope ? `${scope}: ` : '';

  const warnings = [];
  if (buried.length) {
    warnings.push(
      `${where}${buried.length} part(s) are swallowed by the union of their neighbours and contribute little or no silhouette: `
      + `${buried.map((b) => `${b.id} (${Math.round(b.covered * 100)}% enclosed)`).join(', ')}. `
      + 'A superposed mass only reads if it BREAKS the host outline — push it out until it clears, or drop it.',
    );
  }
  if (shortfall.length) {
    warnings.push(
      `${where}${shortfall.length} jut part(s) protrude far less than declared: `
      + `${shortfall.map((c) => `${c.id} (declared jut ${c.declared}, actually ${Math.round(c.exposed * 100)}% exposed)`).join(', ')}. `
      + 'Raise `jut`, or move the anchor out — and remember the jut that reads unlit can vanish in a lit render.',
    );
  }
  if (faint.length) {
    warnings.push(
      `${where}${faint.length} jut part(s) protrude too little to READ at this object's scale: `
      + `${faint.map((f) => `${f.id} (${f.out} units proud, needs ~${f.needed}+)`).join(', ')}. `
      + 'The shortfall check measures a ratio and cannot see scale — a feature that clears its host by a hair is geometrically correct and visually absent. Deepen it, or drop it and let tint carry the read.',
    );
  }
  if (H > 0 && Math.abs(measuredHeight - H) / H > 0.05) {
    warnings.push(`${where}measured height ${measuredHeight.toFixed(1)} differs from the declared ${H.toFixed(1)} by ${(100 * Math.abs(measuredHeight - H) / H).toFixed(0)}% — some part's zFrom/zTo does not reach the declared extremes.`);
  }
  if (Object.keys(junctions).length === 1 && index.length > 3) {
    warnings.push(`${where}every part uses junction '${Object.keys(junctions)[0]}'. A build that uses one move everywhere is the classic failure — classify per junction (stack / jut / composite).`);
  }

  return {
    parts: index.length, junctions, coverage,
    buried: buried.map((b) => b.id), shortfall, ...(faint.length ? { faint } : {}),
    measuredHeight: +measuredHeight.toFixed(2),
    warnings,
  };
}

function commonPreamble(insights, errs) {
  const identity = typeof insights.identity === 'string' ? insights.identity.trim() : '';
  if (!identity) errs.push('`identity` is required — the identity lock (<=5 traits, one sentence). It is the anti-drift device.');
  if (insights.orthographic === false && !isNum(insights.scale?.verticalUnit)) {
    errs.push(
      'orthographic:false but no scale.verticalUnit — a perspective photo needs a scene pass first. '
      + "Run reference_protocol({target:'scene'}), capture it, and pass roomBasis.verticalUnit as scale.verticalUnit "
      + 'so heights read in world units (px/verticalUnit), not raw pixels.',
    );
  }
  return isNum(insights.unitHeight) && insights.unitHeight > 0 ? insights.unitHeight : 100;
}

function throwIfInvalid(errs) {
  if (errs.length) {
    throw new Error(`object cage invalid — read the workbench card (get_solid_vocab({id:'workbench'})) for the monomer + junction vocabulary:\n - ${errs.join('\n - ')}`);
  }
}

/**
 * insights -> a cage manifest. Pure: no DB, no render.
 *
 * ONE-SHOT (`insights.parts`)      -> { manifest: kind:'workbench', ledger }
 * SEGMENT-FIRST (`insights.segments`) -> { manifest: kind:'assembler', ledger, segments:[{ id, manifest, ledger }] }
 *
 * Segment-first is the path for a complex subject (distinct seams: tower /
 * island / base / props). Each segment is a whole workbench recipe authored at
 * its OWN origin and judged in isolation; the assembler composes them by
 * GRAVITY SEATING (`on`/`gap`), so the running z is computed and no absolute z
 * is ever authored at either altitude. One-shot a complex whole and you get the
 * proven failure mode (object-reference.plan.md §2d).
 */
export function lowerObjectCage(insights = {}, title = 'Object reference') {
  const hasSegments = Array.isArray(insights.segments) && insights.segments.length > 0;
  const hasParts = Array.isArray(insights.parts) && insights.parts.length > 0;
  if (hasSegments && hasParts) {
    throw new Error('Pass `segments` OR `parts`, never both — segments ARE the parts, one altitude up. Move the loose parts into a segment.');
  }
  return hasSegments ? lowerSegmented(insights, title) : lowerOneShot(insights, title);
}

function lowerOneShot(insights, title) {
  const errs = [];
  const H = commonPreamble(insights, errs);
  const parts = Array.isArray(insights.parts) ? insights.parts : [];
  if (!parts.length) errs.push('`parts` must be a non-empty array — the part-graph you read off the object. (A complex subject with distinct seams goes in `segments` instead.)');

  const bundle = lowerPartList(parts, H, errs, 'parts');
  throwIfInvalid(errs);

  const manifest = {
    kind: 'workbench', title, units: insights.units || 'cm',
    ...(isNum(insights.view?.az) ? { facing: insights.view.az } : {}),
    ...monomerBody(bundle),
  };
  const ledger = { mode: 'one-shot', unitHeight: H, ...advisoryLedger(bundle, H, { objectHeight: H }) };
  if (insights.orthographic === false) {
    ledger.warnings.push(`Source is not orthographic; heights were read via scale.verticalUnit=${insights.scale.verticalUnit}. Proportions are only as good as that scene pass.`);
  }
  return { manifest, ledger };
}

/**
 * Segment-first. Each segment declares its share of the whole as `heightFrac`
 * (a fraction of unitHeight); its parts are then fractions of the SEGMENT's own
 * height. Seating is relational: `on` names an EARLIER segment (or 'ground'),
 * and the assembler drops the part so its lowest point rests there.
 */
function lowerSegmented(insights, title) {
  const errs = [];
  const H = commonPreamble(insights, errs);
  const segments = insights.segments;
  const units = insights.units || 'cm';

  const seenIds = new Set();
  const lowered = [];

  segments.forEach((seg, i) => {
    const tag = `segments[${i}]${seg && seg.id ? ` ('${seg.id}')` : ''}`;
    if (!seg || typeof seg !== 'object') { errs.push(`${tag} must be an object.`); return; }
    if (!seg.id || typeof seg.id !== 'string') { errs.push(`${tag}.id is required — a later segment seats \`on\` it by name.`); return; }
    if (seenIds.has(seg.id)) { errs.push(`${tag}.id '${seg.id}' is duplicated.`); return; }
    const segParts = Array.isArray(seg.parts) ? seg.parts : [];
    if (!segParts.length) { errs.push(`${tag}.parts must be a non-empty array.`); return; }
    if (!isNum(seg.heightFrac) || seg.heightFrac <= 0 || seg.heightFrac > 1.5) {
      errs.push(`${tag}.heightFrac is required — this segment's height as a FRACTION of unitHeight (got ${JSON.stringify(seg.heightFrac)}). Its own parts are then fractions of THAT.`);
      return;
    }
    const hf = seg.heightFrac;
    if (Array.isArray(seg.at) && seg.at.length > 2) {
      errs.push(`${tag}.at is [x,y] only — a segment never authors z. Seat it with \`on\` and the assembler computes the running z.`);
    }
    // `on` must be 'ground' or an EARLIER segment (the assembler seats in order).
    let on = seg.on;
    let implicitSeating = false;
    if (on == null) {
      on = i === 0 ? 'ground' : segments[i - 1]?.id;
      implicitSeating = true;
    }
    if (on !== 'ground' && !seenIds.has(on)) {
      errs.push(`${tag}.on='${on}' must be 'ground' or the id of an EARLIER segment (the assembler gravity-seats in order).`);
    }
    seenIds.add(seg.id);

    const segH = hf * H;
    const bundle = lowerPartList(segParts, segH, errs, `${tag}.parts`);
    lowered.push({ seg, bundle, segH, hf, on, implicitSeating });
  });

  throwIfInvalid(errs);

  const items = [];
  const segmentOut = [];
  const warnings = [];
  let fracSum = 0;

  for (const { seg, bundle, segH, hf, on, implicitSeating } of lowered) {
    fracSum += hf;
    const body = monomerBody(bundle);
    const segManifest = {
      kind: 'workbench', title: `${title} — ${seg.id}`, units,
      ...(isNum(seg.view?.az) ? { facing: seg.view.az } : isNum(insights.view?.az) ? { facing: insights.view.az } : {}),
      ...body,
    };
    const segLedger = { unitHeight: +segH.toFixed(2), heightFrac: hf, ...advisoryLedger(bundle, segH, { scope: seg.id, objectHeight: H }) };
    warnings.push(...segLedger.warnings);

    const at = xy(seg.at);
    items.push({
      id: seg.id,
      source: body,
      on,
      ...(isNum(seg.gap) ? { gap: seg.gap } : {}),
      ...(at[0] || at[1] ? { at: [at[0], at[1], 0] } : {}),
      ...(Array.isArray(seg.rotate) ? { rotate: seg.rotate } : {}),
      ...(typeof seg.flip === 'string' ? { flip: seg.flip } : {}),
      ...(isNum(seg.scale) ? { scale: seg.scale } : {}),
      ...(seg.repeat && typeof seg.repeat === 'object' ? { repeat: seg.repeat } : {}),
    });
    segmentOut.push({
      id: seg.id, label: seg.label || seg.id, manifest: segManifest, ledger: segLedger,
      seating: { on, ...(isNum(seg.gap) ? { gap: seg.gap } : {}), ...(implicitSeating ? { implicit: true } : {}) },
    });
  }

  const implicit = segmentOut.filter((s) => s.seating.implicit).map((s) => s.id);
  if (implicit.length) {
    warnings.push(
      `${implicit.length} segment(s) did not name a support and were seated on the previous one by default: ${implicit.join(', ')}. `
      + "Naming the relation is the discipline that stops the classic failure — declare `on` explicitly ('ground' or an earlier segment id).",
    );
  }
  // Stacked segments should account for the whole height. A jut/offset composition
  // legitimately overlaps, so this is advisory and generous.
  if (Math.abs(fracSum - 1) > 0.2) {
    warnings.push(
      `Segment heightFracs sum to ${fracSum.toFixed(2)}, not ~1. That is correct when segments overlap or sit side by side, and wrong when they stack — check which you meant.`,
    );
  }
  if (insights.orthographic === false) {
    warnings.push(`Source is not orthographic; heights were read via scale.verticalUnit=${insights.scale.verticalUnit}. Proportions are only as good as that scene pass.`);
  }

  const manifest = {
    kind: 'assembler', title, units,
    ...(isNum(insights.view?.az) ? { facing: insights.view.az } : {}),
    items,
  };
  const ledger = {
    mode: 'segments',
    unitHeight: H,
    segments: segmentOut.map((s) => ({ id: s.id, heightFrac: s.ledger.heightFrac, height: s.ledger.unitHeight, parts: s.ledger.parts, junctions: s.ledger.junctions, buried: s.ledger.buried, shortfall: s.ledger.shortfall, seating: s.seating })),
    parts: segmentOut.reduce((n, s) => n + s.ledger.parts, 0),
    warnings,
  };
  return { manifest, ledger, segments: segmentOut };
}

// --- multi-pass fusion -----------------------------------------------------

const SCALARS = ['identity', 'unitHeight', 'grounded', 'orthographic', 'units', 'view', 'scale'];

function mergeById(prior = [], next = [], drop = new Set(), report, path = '') {
  const priorList = Array.isArray(prior) ? prior : [];
  const nextList = Array.isArray(next) ? next : [];
  const byId = new Map(priorList.filter((p) => p && p.id).map((p) => [p.id, p]));
  const out = [];
  const takenIds = new Set();

  for (const p of priorList) {
    if (!p || !p.id) continue;
    if (drop.has(p.id)) { report.dropped.push(`${path}${p.id}`); continue; }
    const incoming = nextList.find((n) => n && n.id === p.id);
    if (incoming) { out.push({ ...p, ...incoming }); report.updated.push(`${path}${p.id}`); }
    else { out.push(p); report.carried.push(`${path}${p.id}`); }
    takenIds.add(p.id);
  }
  for (const n of nextList) {
    if (!n || !n.id || takenIds.has(n.id)) continue;
    if (drop.has(n.id)) continue;
    out.push(n);
    report.added.push(`${path}${n.id}`);
  }
  return { merged: out, byId };
}

/**
 * FUSE a later photo pass onto the reference already filed.
 *
 * The multi-pass promise was previously only a counter: pass 2 minted an
 * independent cage from a fresh full re-authoring, and nothing the first pass
 * established survived. Fusion makes the second view do what the protocol
 * always claimed — supply only the CORRECTIONS it can see (a depth, a radius,
 * a part the first view could not observe) while everything already grounded
 * carries forward.
 *
 * Merge rules:
 *   - parts / segments merge BY ID: present in both -> shallow override
 *     (incoming field wins), prior-only -> carried, new -> added.
 *   - `next.drop:[id…]` removes a part a later view proves is not there.
 *   - scalars (identity, unitHeight, view, scale, …) -> incoming if given.
 *   - caveats -> incoming if given (a second view RESOLVES caveats; it should
 *     not inherit the list it just answered).
 *   - a MODE SWITCH (parts <-> segments) is a re-authoring, not a refinement:
 *     fusion is skipped and the incoming read stands alone.
 *
 * Returns { insights, fusion } — `fusion` is null when there was nothing to
 * fuse onto, so a first pass is byte-identical to the pre-fusion behaviour.
 */
export function fuseObjectInsights(prior, next = {}) {
  if (!prior || typeof prior !== 'object' || Array.isArray(prior)) return { insights: next, fusion: null };
  const { __ledger, ...base } = prior;

  const priorSegmented = Array.isArray(base.segments) && base.segments.length > 0;
  const nextSegmented = Array.isArray(next.segments) && next.segments.length > 0;
  const nextHasParts = Array.isArray(next.parts) && next.parts.length > 0;
  if ((nextSegmented || nextHasParts) && nextSegmented !== priorSegmented) {
    return { insights: next, fusion: { mode: 'replaced', reason: `pass switched between ${priorSegmented ? 'segments' : 'parts'} and ${nextSegmented ? 'segments' : 'parts'} — a re-authoring, not a refinement` } };
  }

  const report = { carried: [], updated: [], added: [], dropped: [] };
  const drop = new Set(Array.isArray(next.drop) ? next.drop.filter((d) => typeof d === 'string') : []);
  const out = { ...base };

  for (const k of SCALARS) if (next[k] !== undefined) out[k] = next[k];
  if (next.caveats !== undefined) out.caveats = next.caveats;

  if (priorSegmented) {
    const { merged } = mergeById(base.segments, next.segments, drop, { carried: [], updated: [], added: [], dropped: [] });
    out.segments = merged.map((seg) => {
      const priorSeg = (base.segments || []).find((s) => s && s.id === seg.id);
      const nextSeg = (next.segments || []).find((s) => s && s.id === seg.id);
      if (!priorSeg) { report.added.push(seg.id); return seg; }
      if (!nextSeg) { report.carried.push(seg.id); return priorSeg; }
      const { merged: parts } = mergeById(priorSeg.parts, nextSeg.parts, drop, report, `${seg.id}/`);
      return { ...priorSeg, ...nextSeg, parts };
    });
  } else {
    const { merged } = mergeById(base.parts, next.parts, drop, report);
    out.parts = merged;
  }

  return { insights: out, fusion: { mode: 'fused', ...report } };
}

export function summarizeObject(insights = {}, ledger = null) {
  const lines = [];
  if (insights.identity) lines.push(`**Identity lock:** ${insights.identity}`);
  if (ledger) {
    if (ledger.mode === 'segments') {
      lines.push(`Segments: ${ledger.segments.length} · parts ${ledger.parts} · unitHeight ${ledger.unitHeight}`);
      for (const s of ledger.segments) {
        lines.push(`- **${s.id}** — ${(s.heightFrac * 100).toFixed(0)}% of the whole · ${s.parts} part(s) · ${Object.entries(s.junctions).map(([k, v]) => `${k} ${v}`).join(' · ')} · seated on \`${s.seating.on}\``);
      }
    } else {
      lines.push(`Parts: ${ledger.parts} · junctions ${Object.entries(ledger.junctions).map(([k, v]) => `${k} ${v}`).join(' · ')} · unitHeight ${ledger.unitHeight}`);
    }
    for (const w of ledger.warnings) lines.push(`⚠︎ ${w}`);
  }
  return lines.join('\n\n');
}
