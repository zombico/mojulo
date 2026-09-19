/**
 * field-contribution — does each `fields[].terms` entry actually SHOW?
 *
 * The workbench has a contribution check for MONOMERS (a part swallowed by its neighbours
 * contributes no silhouette and is dead weight in the recipe). A `fields` term list has never
 * had one, and that is exactly where the cost goes when a character is sculpted as blended
 * distance terms: the first read buries the nose inside the maxilla, the brow inside the
 * forehead and the ears inside the jaw ramus, all three look fine on paper, and the only thing
 * that tells you is a render you have to look at.
 *
 * Two distinct failures, reported separately because the fixes are opposite:
 *
 *   BURIED    — the term's own surface lies inside the union of the others. It breaks no
 *               silhouette, so it costs bytes and sampling time and draws nothing. Move it out.
 *               (The lighthouse rule, in a new family: a superposed mass only reads if it breaks
 *               its host's silhouette. "Juts out just ENOUGH" is a real lower bound.)
 *
 *   ABSORBED  — the term IS proud of its neighbours, but by less than its own `blend` radius,
 *               so the smooth-union bulge swallows what little it clears. Geometrically correct,
 *               visually absent. Raise the protrusion or lower the blend.
 *
 * Method: point-in-solid against the union — the version that ranked correctly for monomers,
 * and which is exact here because every term already IS a signed distance function. Each term is
 * surfaced alone on a coarse grid (its own zero set, via the shipped surface net), and each face
 * centroid is tested against every other term. No AABBs: a bounding box lies about a taper, which
 * is how the monomer check first got this wrong.
 *
 * ADVISORY, never gating — like every workbench warning. Pure and deterministic: fixed
 * iteration order, no dice, no Date.
 *
 * v1 scope: `add` terms, tested against other `add` terms and against `subtract` removal.
 * Domain ops (`transform`/`repeat`/`twist`/`bend`/`taper`/`elongate`) warp the accumulator rather
 * than contributing a nameable mass, so a list containing one is reported as unaudited rather
 * than audited wrongly.
 */

import { shapeFromSpec, padBounds, FIELD_DOMAIN_OPS } from './field-terms.js';
import { surfaceNetFaces } from './field-mesh.js';

// Grid for surfacing ONE term alone. This is a contribution question, not a render — 20 cells
// puts a few hundred sample points on a monomer-sized mass, which is plenty to tell "entirely
// swallowed" from "clears its host", and keeps the whole audit well under a render's cost.
const PROBE_CELLS = 20;
// A term whose surface is this fraction exposed or less reads as nothing. Not zero: a grazing
// tangency emits a few stray samples, and flagging those would be the over-eager version of the
// check that cried wolf on the moka pot.
const BURIED_AT = 0.02;
// Below this the report stays quiet about absorption — a term that clears its neighbours by a
// hair is already caught by the buried check.
const MIN_PROTRUSION = 1e-6;

const isAdd = (t) => t && t.op === 'add';
const isSub = (t) => t && t.op === 'subtract';
const blendOf = (t) => (Number.isFinite(t?.blend) && t.blend > 0 ? t.blend : 0);

/** The smooth-union bulge is bounded by a fraction of k, not by k itself (quadratic smin). */
const BULGE_OF_K = 0.25;

function centroidsOfTerm(term, cellHint) {
  const b = term.bounds;
  const longest = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  if (!(longest > 0)) return [];
  const cells = cellHint || PROBE_CELLS;
  // The surface must never graze the grid boundary or the truncated cells drop their quads —
  // the same two-cell margin field-faces uses.
  const faces = surfaceNetFaces(term.d, padBounds(b, (longest / cells) * 2), { cells });
  return faces.map((f) => {
    const c = f.corners;
    return {
      x: (c[0].x + c[1].x + c[2].x + c[3].x) / 4,
      y: (c[0].y + c[1].y + c[2].y + c[3].y) / 4,
      z: (c[0].z + c[1].z + c[2].z + c[3].z) / 4,
    };
  });
}

/**
 * Audit one `fields[]` spec's term list.
 *
 * @param {{terms:object[]}} spec
 * @param {{cells?:number}} [opts]
 * @returns {{
 *   audited: boolean,
 *   reason?: string,
 *   terms: Array<{ id:string, exposure:number, protrusion:number, blend:number,
 *                  buried:boolean, absorbed:boolean }>,
 *   warnings: string[],
 * }}
 */
export function auditFieldContribution(spec, { cells } = {}) {
  const terms = Array.isArray(spec?.terms) ? spec.terms : [];
  const adds = terms.filter(isAdd);
  if (adds.length < 2) return { audited: true, terms: [], warnings: [] };
  if (terms.some((t) => FIELD_DOMAIN_OPS.includes(t?.op))) {
    return {
      audited: false,
      reason: 'the term list contains a domain op (transform/repeat/twist/bend/taper/elongate), which warps the accumulator rather than adding a nameable mass — contribution is not audited for this solid',
      terms: [],
      warnings: [],
    };
  }

  // Resolve every shape ONCE — shapeFromSpec is the same resolver composeFieldTerms uses, so a
  // term audits against exactly the geometry it will be folded from.
  const built = terms.map((t, i) => ({
    spec: t,
    id: typeof t.id === 'string' && t.id ? t.id : `term${i}`,
    index: i,
    shape: shapeFromSpec(t.shape),
  }));
  const addSet = built.filter((b) => isAdd(b.spec));
  const subSet = built.filter((b) => isSub(b.spec));

  const rows = [];
  for (const me of addSet) {
    const others = addSet.filter((o) => o !== me);
    const pts = centroidsOfTerm(me.shape, cells);
    if (!pts.length) {
      rows.push({ id: me.id, exposure: 0, protrusion: 0, blend: blendOf(me.spec), buried: true, absorbed: false });
      continue;
    }
    let exposed = 0;
    let protrusion = 0;
    for (const p of pts) {
      // Removed by a cut → never on the final surface, whatever the other masses do.
      let removed = false;
      for (const s of subSet) { if (s.shape.d(p) <= 0) { removed = true; break; } }
      if (removed) continue;
      // Distance to the nearest OTHER mass: > 0 means this point is outside all of them, and
      // the value is how far proud it stands — directly comparable to a blend radius.
      let nearest = Infinity;
      for (const o of others) { const d = o.shape.d(p); if (d < nearest) nearest = d; }
      if (nearest > 0) {
        exposed += 1;
        if (nearest > protrusion) protrusion = nearest;
      }
    }
    const exposure = exposed / pts.length;
    const bulge = blendOf(me.spec) * BULGE_OF_K;
    rows.push({
      id: me.id,
      exposure: Math.round(exposure * 1000) / 1000,
      protrusion: Math.round(protrusion * 1000) / 1000,
      blend: blendOf(me.spec),
      buried: exposure <= BURIED_AT,
      absorbed: exposure > BURIED_AT && protrusion > MIN_PROTRUSION && protrusion < bulge,
    });
  }

  const warnings = [];
  const buried = rows.filter((r) => r.buried);
  if (buried.length) {
    warnings.push(
      `${buried.length} field term(s) are BURIED inside the union of the others and draw nothing: `
      + `${buried.map((r) => `${r.id} (${Math.round(r.exposure * 100)}% exposed)`).join(', ')}. `
      + 'A superposed mass only reads if it BREAKS its host\'s silhouette — move each one out along its own axis until it clears, or drop it from the recipe.',
    );
  }
  const absorbed = rows.filter((r) => r.absorbed);
  if (absorbed.length) {
    warnings.push(
      `${absorbed.length} field term(s) stand proud by LESS than their own blend bulge, so the smooth union swallows them: `
      + `${absorbed.map((r) => `${r.id} (proud ${r.protrusion}, blend ${r.blend})`).join(', ')}. `
      + 'Raise the protrusion or lower `blend` on those terms — geometrically correct and visually absent is the failure this catches.',
    );
  }
  return { audited: true, terms: rows, warnings };
}

export { PROBE_CELLS, BURIED_AT, BULGE_OF_K };
