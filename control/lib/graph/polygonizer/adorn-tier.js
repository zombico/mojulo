/**
 * adorn-tier — an adornment KIT (station-loft-adorn.js) drawn for its hero's TARGET (era/target.js), the tiered form's
 * rules carried onto what the hero wears. An armour or a kit is authored once at its finest; here each entry keeps only
 * what its target can show. It only ever takes away: nothing is drawn finer than its author wrote it.
 *
 *   SHELLS by their outline, on the host's rings: a shell's sides across its window are what an outline of its radius
 *     wants at the target's error (`sidesFor`), never more than the author's `nt`, and never so few that the skin pokes
 *     between two of its points: not fewer than the carrier's own slots under the window, and one more for a partial
 *     window whose ends fall between them (a chest the tiered form drew across the torso's rings bulges between a
 *     coarser plate's points), nor than a ring at standoff s over a radius r
 *     needs to clear it, cos(π/N) ≥ r / (r + s). Its stations follow by the same share, never fewer than the carrier's
 *     stations it spans.
 *   ELEMENTS by their size (the lean ear's rule): a signature's disc takes the sides its radius in pixels wants; a row of
 *     studs whose stud is under MIN_ELEMENT_PX across becomes one stud (the element the ledger reads stays).
 *   TRIM and LACING as paint (the face tint's rule): a rolled edge (armor/plate.js `edgeTrim`) narrower than MIN_TRIM_PX
 *     becomes its carrier shell's painted `rim` in the trim's group, the low-poly trim that is the plate's own edge. A
 *     lacing cord as narrow (armor/lamellar.js rowStack: `<row>o<i>c<q>` laces the row `<row><i>`) leaves its row in the
 *     cord's colour with a rim of the row's own at its top edge, as densely laced rows read from afar; a board
 *     signature's cords narrower than MIN_ELEMENT_PX leave the boards in their cord group the same way.
 *
 *   tierKit(kit, plan, target)   → { kit, trace }: the kit as its target shows it, and what was taken
 *
 * Pure and deterministic. Opt-in through the hero's tiered form (mcp/tools/layered.js); absent, no kit passes here.
 */
import { readTarget, pxPerMetre, sidesFor } from '../era/target.js';
import { planHeight } from '../era/cast-density.js';
import { tierOf } from '../era/cast-spend.js';
import { dressContext } from './hero-dress.js';
import { SLOT_FAMILIES } from './station-loft-plan.js';

/** a stud narrower than this many pixels is one stud, not a row */
export const MIN_ELEMENT_PX = 2;
/** a rolled edge narrower than this many pixels is paint on its plate's rim */
export const MIN_TRIM_PX = 3;
/** the fewest sides a disc keeps */
const MIN_DISC = 4;

const flat = (v) => (Array.isArray(v) ? v.flat(Infinity) : [v]).filter(Number.isFinite);
const twinR = (p) => p.replace(/L$/, 'R');
/** the shell's carrier name as an edge trim names it (armor/plate.js edgeTrim) */
const carrierOf = (A) => (A.id.includes(A.part) ? A.id : `${A.part}-${A.id}`);

/** The landmark head's cranium is no body segment: 16 slots addressed by INDEX (t 0 … 8 a half, armor/lamellar.js), the
 * face's half crowded, so a window's angular share is about twice its share of the indices; its radius about this share
 * of the figure's height. */
const CRANIUM = Object.freeze({ half: 8, crowd: 2, r: 0.058 });

/** Each carrier's radius (m) and how a window's t reads as a share of its circumference. */
function carriers(plan, heightM) {
  // a kit's t runs 0 … H on each half in the register's ring halves (hero-dress.js dressContext), whatever its carrier's
  const ctx = dressContext(plan.style, 1, plan);
  const split = new Set((plan.body?.refine || []).filter((e) => e.slots !== false).flatMap((e) => e.parts || []));
  const out = new Map();
  // a `rings` part (the hand, a bridge) carries points, not radii: no radius, and its pieces stay as their author drew them
  for (const g of plan.segments || []) {
    const name = twinR(g.name), r = Math.max(0, ...flat(g.rA), ...flat(g.rB), ...(g.stations || []).flatMap((s) => flat(s.r)));
    const own = SLOT_FAMILIES[g.slots ?? (g.kind === 'segment' ? plan.style?.limbSlots : plan.style?.slots)]?.length ?? 0;
    // its stations' addresses (a trunk's own `u`, which the tiered chest's band fills between the whole ones), else whole
    const us = g.stations?.length && g.stations.every((x) => Number.isFinite(x.u)) ? g.stations.map((x) => x.u) : null;
    if (r > 0) out.set(name, { r, us, slots: split.has(g.name) || split.has(name) ? own * 2 : own, half: /^(torso|pelvis|neck)/.test(name) ? ctx.Ht : /^thigh/.test(name) ? ctx.Hth ?? ctx.Hl : ctx.Hl, crowd: 1 });
  }
  out.set('cranium', { r: CRANIUM.r * heightM, slots: 0, half: CRANIUM.half, crowd: CRANIUM.crowd });
  return out;
}
/** the sides a ring at standoff `s` over radius `r` wants so its chords clear the surface beneath */
const clearSides = (r, s) => (s > 0 ? Math.PI / Math.acos(r / (r + s)) : Infinity);

/** the stations of its carrier a window [s0, s1] spans (strictly inside it): at the carrier's own addresses, else whole */
const spanned = ([a, b], us) => { const lo = Math.min(a, b), hi = Math.max(a, b);
  if (us) return us.filter((u) => u > lo + 1e-9 && u < hi - 1e-9).length;
  let n = 0; for (let s = Math.floor(lo) + 1; s < hi; s++) n++; return n; };

/** A kit as `target` shows it on `plan`'s figure. */
export function tierKit(kit, plan, targetSpec) {
  const target = readTarget(targetSpec), heightM = planHeight(plan), ppm = pxPerMetre(target, heightM), C = carriers(plan, heightM);
  const trace = { tier: tierOf(target.figurePx).id, pxPerMetre: Math.round(ppm * 100) / 100, shells: 0, discs: 0, studs: 0, cords: 0, painted: [] };
  const discSides = (r, m) => Math.min(m, Math.max(MIN_DISC, Math.ceil(sidesFor(r * ppm, target.error))));
  // the rolled edges too narrow to draw: each becomes its carrier shell's rim
  const paint = new Map(), laced = new Map(), CORD = /^(.*)o(\d+)c\d+$/;
  for (const A of kit) if (A.mode === 'strap' && A.width * ppm < MIN_TRIM_PX) {
    if (/-trim(Top)?$/.test(A.id)) paint.set(A.id, A);
    else { const m = CORD.exec(A.id); if (m) { paint.set(A.id, A); laced.set(`${m[1]}${m[2]}`, A.group); } }
  }
  const out = [];
  for (const A of kit) {
    if (paint.has(A.id)) continue;
    let E = A;
    const c = C.get(twinR(A.part));
    if ((A.mode === 'shell' || A.mode === 'band') && c && Number.isFinite(A.nt ?? 12)) {
      const nt = A.nt ?? 12, ns = A.ns ?? 4;
      const share = A.t === 'wrap' ? 1 : Math.min(1, c.crowd * Math.abs(A.t[1] - A.t[0]) / (2 * c.half));
      // a partial window's ends fall between the host's points: one more than the slots it spans
      const floor = Math.max(A.t === 'wrap' ? 3 : 1, Math.ceil(share * c.slots) + (A.t === 'wrap' ? 0 : 1), Math.ceil(share * clearSides(c.r, A.mugen ?? 0)));
      const want = Math.ceil(share * sidesFor((c.r + (A.mugen ?? 0)) * ppm, target.error));
      const nt2 = Math.min(nt, Math.max(floor, want));
      const ns2 = Math.min(ns, Math.max(spanned(A.s, c.us) + 1, Math.ceil(ns * nt2 / nt)));
      if (nt2 !== nt || ns2 !== ns) { E = { ...E, nt: nt2, ns: ns2 }; trace.shells++; }
    }
    const S = A.signature;
    if (S && Number.isFinite(S.r) && Number.isFinite(S.m)) {
      const m2 = discSides(S.r, S.m);
      let S2 = m2 !== S.m ? { ...S, m: m2 } : S;
      if (S.kind === 'studs' && S.count > 1 && 2 * S.r * ppm < MIN_ELEMENT_PX) { S2 = { ...S2, count: 1 }; trace.studs++; }
      if (S2 !== S) { E = { ...E, signature: S2 }; if (m2 !== S.m) trace.discs++; }
    }
    if (S && S.cords > 0 && Number.isFinite(S.cordR) && 2 * S.cordR * ppm < MIN_ELEMENT_PX) {
      E = { ...E, signature: { ...E.signature, cords: 0, ...(S.cordGroup ? { group: S.cordGroup } : {}) } }; trace.cords += S.cords;
    }
    // a laced row whose cords are paint: the cord's colour, the row's own on its top edge (where its rows step from)
    if (laced.has(A.id) && (A.mode === 'shell' || A.mode === 'band')) {
      const top = A.support != null && Math.abs(A.support - Math.max(...A.s)) < Math.abs(A.support - Math.min(...A.s)) ? 'high' : 'low';
      E = { ...E, group: laced.get(A.id), ...(A.rim ? {} : { rim: { group: A.group, at: top } }) };
    }
    out.push(E);
  }
  // the painted edges: the carrier shell's rim, at the edge the trim rolled (both when two trims meet on one shell)
  for (const T of paint.values()) {
    if (CORD.test(T.id)) { trace.cords++; continue; }
    const i = out.findIndex((A) => (A.mode === 'shell' || A.mode === 'band') && carrierOf(A) === T.id.replace(/-trim(Top)?$/, ''));
    if (i < 0) continue;
    const at = /Top$/.test(T.id) ? 'high' : 'low', had = out[i].rim?.at;
    out[i] = { ...out[i], rim: { group: T.group, at: had && had !== at ? 'both' : at } };
    trace.painted.push(T.id);
  }
  return { kit: out, trace };
}
