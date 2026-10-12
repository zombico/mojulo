/**
 * equipment/tier — an expanded item (workbench monomers, in the item's own units) drawn for the pixels it covers on
 * screen: the target's outline rule (era/target.js `sidesFor`) applied to each monomer, as the tiered hero applies it to
 * its rings (era/cast-density.js) and its armour (polygonizer/adorn-tier.js). It only ever takes away: no monomer is
 * drawn finer than its builder wrote it (or than its lowerer's default, where the builder named none).
 *
 *   lathe   its samples round the axis are what its widest radius wants (never fewer than its harmonics need), its cross
 *           sections one per SECTION_PX of its length (never fewer than its profile's spans)
 *   sweep   its sides are what its tube's radius wants, its path thinned to a point per SECTION_PX (ends kept)
 *   field   its cells are FIELD_CELLS_PER_PX per pixel of its largest shape (the gem's polygonized lattice)
 *
 *   tierMonomers(monomers, { ppu, error })   ppu: pixels per item unit at the target; error: the outline's, in pixels
 *
 * Pure and deterministic. Opt-in through the hero's tiered form (polygonizer/hero-gear.js); absent, no item passes here.
 */
import { sidesFor } from '../era/target.js';
import { DEFAULT_CROSS_SECTIONS, DEFAULT_SAMPLES } from '../polygonizer/lathe-faces.js';

/** a lathe's cross section or a sweep's path point per this many pixels of its length */
export const SECTION_PX = 4;
/** a field's cells per pixel of its largest shape, and the fewest it keeps */
export const FIELD_CELLS_PER_PX = 1.5;
const MIN_CELLS = 8;
const MIN_SIDES = 3;

const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);
const dist = (a, b) => { const [x, y, z] = xyz(a), [u, v, w] = xyz(b); return Math.hypot(x - u, y - v, z - w); };
const sides = (rPx, error, own) => Math.min(own, Math.max(MIN_SIDES, Math.ceil(sidesFor(rPx, error))));

function lathe(L, ppu, error) {
  const own = Number.isInteger(L.samples) ? L.samples : DEFAULT_SAMPLES, cs = Number.isInteger(L.crossSections) ? L.crossSections : DEFAULT_CROSS_SECTIONS;
  const r = Math.max(0, ...(L.profile || []).map((p) => p.radius ?? 0));
  const harm = Math.max(0, ...(L.harmonics || []).map((h) => 4 * (h.n ?? 0)));
  const samples = Math.min(own, Math.max(harm, sides(r * ppu, error, own)));
  const spans = Math.max(1, (L.profile?.length ?? 2) - 1);
  const crossSections = Math.min(cs, Math.max(spans, Math.ceil(dist(L.axisFrom, L.axisTo) * ppu / SECTION_PX)));
  return samples === own && crossSections === cs ? L : { ...L, samples, crossSections };
}

function sweep(S, ppu, error) {
  const own = Number.isInteger(S.sides) ? S.sides : null;
  const out = { ...S };
  if (own && Number.isFinite(S.radius)) out.sides = sides(S.radius * ppu, error, own);
  const P = S.path;
  if (Array.isArray(P) && P.length > 3) {
    let len = 0; for (let i = 1; i < P.length; i++) len += dist(P[i - 1], P[i]);
    const stride = Math.max(1, Math.floor((SECTION_PX * (P.length - 1)) / Math.max(1e-9, len * ppu)));
    if (stride > 1) {
      const keep = P.filter((_, i) => i % stride === 0);
      if (keep[keep.length - 1] !== P[P.length - 1]) keep.push(P[P.length - 1]);
      if (keep.length >= 3) out.path = keep;
    }
  }
  return out.sides === S.sides && out.path === S.path ? S : out;
}

function field(F, ppu) {
  if (!Number.isInteger(F.cells)) return F;
  const size = Math.max(0, ...(F.terms || []).map((t) => t.shape?.size ?? 0));
  if (!(size > 0)) return F;
  const cells = Math.min(F.cells, Math.max(MIN_CELLS, Math.ceil(FIELD_CELLS_PER_PX * size * ppu)));
  return cells === F.cells ? F : { ...F, cells };
}

/** The monomers as the target shows them (the arrays a build expands to, or a manifest carrying them). */
export function tierMonomers(m, { ppu, error = 1 }) {
  const out = { ...m };
  if (Array.isArray(m.lathes)) out.lathes = m.lathes.map((L) => lathe(L, ppu, error));
  if (Array.isArray(m.sweeps)) out.sweeps = m.sweeps.map((S) => sweep(S, ppu, error));
  if (Array.isArray(m.fields)) out.fields = m.fields.map((F) => field(F, ppu));
  return out;
}
