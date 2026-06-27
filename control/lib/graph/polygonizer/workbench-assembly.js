/**
 * workbench-assembly — the relative composition layer for the workbench.
 *
 * The workbench's monomer arrays (`lathes` / `extrudes` / `sweeps`) take ABSOLUTE coordinates:
 * every monomer carries its own `axisFrom`/`axisTo` in world space. Authoring a multi-part object
 * that way means the model hand-computes a running z so each part sits flush on the one below — the
 * cumulative bookkeeping is where stacks drift, parts float, and re-render loops get spent.
 *
 * An `assembly` lets the model declare each part's SIZE and how it CONNECTS, not its coordinates:
 *
 *   { assembly: { parts: [
 *       { kind:'lathe', height:1.2, profile:[{t:0,radius:3},{t:1,radius:2}] },   // base on ground
 *       { kind:'lathe', height:9,   profile:[…], harmonics:[…] },                // stacks on the foot
 *       { kind:'lathe', height:4,   profile:[…], on:'foot', gap:0.5 },           // explicit support + gap
 *   ] } }
 *
 * lowerAssembly() walks the parts in order, threading a running top-of-stack z, and emits the SAME
 * flat `{ lathes, extrudes }` the renderer already consumes — pure input-side sugar, zero geometry
 * change. The lowered monomers merge with any explicit arrays the caller also passes (so a mug is an
 * assembled lathe body + an explicit `sweep` handle).
 *
 * Stack semantics (vertical, z-up — the dominant multi-monomer case): each part sits on top of its
 * support's top face. Default support is the previous part (or the ground for the first). `on` names
 * an earlier part (by `id`, else its index) or the literal `'ground'`. `gap` lifts the part above
 * its support; `offset` shifts it off the stack axis in x/y. Sweeps stay absolute (a tube's path is
 * intrinsically a curve, not a stacked block) — author them in the explicit `sweeps` array.
 *
 * REPLICATION (array ops, same stacked z): a part can place several copies of itself —
 *   • `radial:{ count, radius, startAngle?, center? }` — `count` copies evenly around a circle of
 *     `radius` (round-stool/table legs, bolt circles, candelabra arms, fan posts). center defaults
 *     to the part's `offset`; startAngle is in degrees.
 *   • `mirror: 'x' | 'y' | 'xy'` — reflect the part's `offset` across the x=center and/or y=center
 *     planes (rectangular table/chair legs at the four corners = `offset:[a,b], mirror:'xy'`).
 * Copies are TRANSLATED, not rotated/tilted — every leg/post stays vertical. A replicated part still
 * contributes ONE top-of-stack z (its height), so a seat `on` the legs seats at the legs' top no
 * matter how they're arrayed. (Splayed legs / horizontal radial spokes need oriented axes — author
 * those as explicit monomers; oriented-axis radial is the next rung.)
 *
 * Design: control/lib/graph/workbench.plan.md §13 (relative composition).
 */

const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const TAU = Math.PI * 2;

function assertProfile(part, i) {
  if (part.kind === 'lathe') {
    if (!Array.isArray(part.profile) || part.profile.length < 1) {
      throw new Error(`assembly.parts[${i}] (lathe): needs a non-empty radius \`profile\` of { t, radius }.`);
    }
  } else if (part.kind === 'extrude') {
    if (!part.profile || typeof part.profile !== 'object') {
      throw new Error(`assembly.parts[${i}] (extrude): needs a \`profile\` of { rect } or { points }.`);
    }
  } else {
    throw new Error(`assembly.parts[${i}]: \`kind\` must be 'lathe' or 'extrude' (sweeps stay in the explicit \`sweeps\` array).`);
  }
}

/** Resolve a part's [x,y] placements — its base offset, expanded by an optional radial/mirror op. */
function placements(part, i) {
  const [dx, dy] = Array.isArray(part.offset) ? [num(part.offset[0], 0), num(part.offset[1], 0)] : [0, 0];
  if (part.radial != null && part.mirror != null) {
    throw new Error(`assembly.parts[${i}]: use either \`radial\` or \`mirror\`, not both.`);
  }

  let pts;
  if (part.radial != null) {
    const r = part.radial;
    if (!r || typeof r !== 'object') throw new Error(`assembly.parts[${i}].radial: must be an object { count, radius }.`);
    const count = num(r.count, NaN);
    if (!Number.isInteger(count) || count < 1) throw new Error(`assembly.parts[${i}].radial.count: must be an integer >= 1.`);
    const radius = num(r.radius, NaN);
    if (!(radius >= 0)) throw new Error(`assembly.parts[${i}].radial.radius: must be a number >= 0.`);
    const [cx, cy] = Array.isArray(r.center) ? [num(r.center[0], dx), num(r.center[1], dy)] : [dx, dy];
    const start = (num(r.startAngle, 0) / 180) * Math.PI;
    pts = Array.from({ length: count }, (_, k) => {
      const a = start + (k / count) * TAU;
      return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
    });
  } else if (part.mirror != null) {
    const m = String(part.mirror).toLowerCase();
    if (!['x', 'y', 'xy', 'yx'].includes(m)) throw new Error(`assembly.parts[${i}].mirror: must be 'x', 'y', or 'xy'.`);
    const xs = m.includes('x') ? [dx, -dx] : [dx];
    const ys = m.includes('y') ? [dy, -dy] : [dy];
    pts = xs.flatMap((x) => ys.map((y) => [x, y]));
  } else {
    pts = [[dx, dy]];
  }

  // Drop coincident copies (mirror across a zero offset, radius 0, …) so a no-op op doesn't z-fight.
  const seen = new Set();
  return pts.filter(([x, y]) => {
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Lower an `assembly` recipe into flat absolute monomer arrays.
 * @param {object} assembly  { parts: [ { kind, height, profile, on?, gap?, offset?, radial?, mirror?, id?, …passthrough } ] }
 * @returns {{ lathes: object[], extrudes: object[] }}
 */
export function lowerAssembly(assembly = {}) {
  const parts = Array.isArray(assembly.parts) ? assembly.parts : [];
  if (!parts.length) {
    throw new Error('assembly: needs a non-empty `parts` array.');
  }
  const tops = new Map();   // key (index AND optional id) -> top-of-stack z
  const lathes = [];
  const extrudes = [];
  let prevKey = null;

  parts.forEach((part, i) => {
    if (!part || typeof part !== 'object') {
      throw new Error(`assembly.parts[${i}]: must be an object with a \`kind\` and \`height\`.`);
    }
    assertProfile(part, i);
    const height = num(part.height, NaN);
    if (!(height > 0)) {
      throw new Error(`assembly.parts[${i}]: \`height\` must be a positive number (the part's size along the stack axis).`);
    }

    // Resolve the support: explicit `on`, else the previous part, else the ground.
    const support = part.on != null ? part.on : (i === 0 ? 'ground' : prevKey);
    let baseZ;
    if (support === 'ground') {
      baseZ = 0;
    } else if (tops.has(support)) {
      baseZ = tops.get(support);
    } else {
      throw new Error(`assembly.parts[${i}].on='${support}': no earlier part with that id/index (refer to a part declared above this one, or 'ground').`);
    }
    baseZ += num(part.gap, 0);
    const topZ = baseZ + height;

    // Strip assembly-only keys; what remains is the monomer spec, replicated across placements.
    const { kind, height: _h, on: _on, gap: _g, offset: _o, radial: _r, mirror: _m, id: _id, ...rest } = part;
    const target = part.kind === 'lathe' ? lathes : extrudes;
    for (const [x, y] of placements(part, i)) {
      target.push({ ...rest, axisFrom: { x, y, z: baseZ }, axisTo: { x, y, z: topZ } });
    }

    tops.set(i, topZ);
    if (typeof part.id === 'string' && part.id) tops.set(part.id, topZ);
    prevKey = typeof part.id === 'string' && part.id ? part.id : i;
  });

  return { lathes, extrudes };
}
