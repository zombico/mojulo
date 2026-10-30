/**
 * THE FEATURE SILHOUETTES: the structure's shapes (docs/feature-style.md: silhouettes vary across a cast; never the one
 * bubble figure eight for every animal). A species' silhouette is read from its own body in the fauna roster (fauna/
 * species.js speciesParams: the torso's length against its girth, where its girth peaks, the legs' and the neck's
 * lengths), so a gorilla is top-heavy, an otter a long upright tube, a deer high on its legs and a pigeon a bird.
 *
 *   speciesMetrics(id)   → { lenGirth, frontBack, leg, neck, bellyContrast, limbless } (null where the roster lacks one)
 *   silhouetteOf(id, family, plan) → a SILHOUETTES key
 *   bellyOf(id, silhouette, { plan, pattern, tune }) → { kind, regions }: the belly designed on this body (BELLIES), or
 *                        none: a pale belly is a species' feature where its roster says so, never a default
 *   SILHOUETTES          each: heads tall, the head's centre and forward offset, its neck (pinch | visible | merged | long),
 *                        the body's masses, the shoulder and the arm's direction and links, the legs (hidden under the
 *                        haunches, or cones), the hips, the tail's anchor, the back's line (where spines run), the belly's
 *                        regions (its shapes on this body: an oval, an underside strip, a bib, a breast, a countershade)
 *
 * Head units (h), z up from the soles, y front, +x right; a name ending R mirrored to its L twin.
 * Pure: data and arithmetic.
 */
import { SPECIES, speciesParams } from '../fauna/species.js';

const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lum = (h) => { if (typeof h !== 'string' || h[0] !== '#') return null; const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

/** a species' body read off the roster's realistic animal */
export function speciesMetrics(id) {
  let p = null; try { p = speciesParams(id); } catch { return {}; }
  const T = p?.torso ?? [], J = p?.joints ?? {};
  const ys = T.map((s) => s.at?.[1]).filter(Number.isFinite), R = T.map((s) => (Array.isArray(s.r) ? Math.max(...s.r) : s.r)).filter(Number.isFinite);
  const len = ys.length ? Math.max(...ys) - Math.min(...ys) : 0, girth = R.length ? Math.max(...R) : 0;
  const front = R.length ? Math.max(...R.slice(Math.floor(R.length / 2))) : 0, back = R.length ? Math.max(...R.slice(0, Math.ceil(R.length / 2))) : 0;
  const legH = J.shoulder && J.forePaw ? J.shoulder[2] - J.forePaw[2] : J.hip && J.ankle ? J.hip[2] - J.ankle[2] : null;
  const neck = J.neckBase && J.neckTop ? Math.hypot(...J.neckTop.map((x, k) => x - J.neckBase[k])) : null;
  const c = p?.colors ?? {}, cl = lum(c.coat), bl = lum(c.belly);
  const limbless = Array.isArray(SPECIES[id]?.legs) && SPECIES[id].legs.length === 0;
  const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
  return { lenGirth: girth ? r2(len / girth) : null, frontBack: back ? r2(front / back) : null, leg: legH != null && girth ? r2(legH / girth) : null, neck: neck != null && girth ? r2(neck / girth) : null, bellyContrast: cl != null && bl != null ? r2(bl - cl) : null, limbless };
}

/** the silhouette a species' body reads as, in its plan: the order is the decision (a long low body before a heavy front,
 *  a heavy front before long legs, the rest round, rear-heavy or even) */
export function silhouetteOf(id, family, plan) {
  const m = speciesMetrics(id), lg = m.lenGirth ?? 3, fb = m.frontBack ?? 1, leg = m.leg, nk = m.neck ?? 0.6;
  if (plan === 'bird') return lg < 1 ? 'teardrop' : (leg ?? 0) >= 2.6 || nk >= 1.8 ? 'wader' : 'perch';
  if (family === 'anuran') return 'squat';
  if (plan === 'orb') return family === 'pinniped' ? 'teardrop' : 'orb';
  if (m.limbless) return 'coil';                                    // (a snake: no legs to stand on, so it rises from its coils)
  if (lg < 1.2 && (leg ?? 0) >= 2) return 'noodle';                 // (an upright animal already: a meerkat, a kangaroo)
  if ((lg >= 4.4 && leg != null && leg <= 1.4) || (lg >= 3.6 && leg != null && leg <= 1)) return 'noodle';
  if (fb >= 1.3 && (leg ?? 0) < 3) return 'wedge';
  if ((leg ?? 0) >= 3 || (plan === 'hoofed' && (lg >= 4.4 || ['equine', 'cervid', 'giraffid'].includes(family)))) return 'leggy';
  if (fb <= 0.92) return 'pear';
  return 'barrel';
}

const ARM_OUT = unit([0.86, 0.12, -0.5]), ARM_FOLD = unit([0.45, -0.75, -0.5]);

/** the silhouettes. `body` the masses (eggs; bones torso, pelvis, thighR), `legs` 'hidden' (an egg under the haunch) or
 *  cones from the hip to the ankle, `arm` the shoulder, the arm's direction and its links' lengths and radii */
export const SILHOUETTES = Object.freeze({
  // THE PEAR (the raccoon's): the body the dominant mass, low, rear-heavy; the head a ball on it (a figure eight)
  pear: { heads: 3.3, hz: 2.82, hy: 0, neck: 'pinch', seam: 1, knee: [0.56, 0.08, 0.32],
    body: [
      { name: 'chest', c: [0, 0.05, 1.86], u: [0, 0, 1], r: [0.46, 0.88, 0.78], e: 0.25, bone: 'torso', join: 0.35 },
      { name: 'belly', c: [0, 0.12, 1.12], u: [0, 0, 1], r: [0.95, 1.2, 1.02], e: 0.25, bone: 'pelvis', join: 0.35 },
      { name: 'front', c: [0, 0.5, 1.2], u: [0, 0, 1], r: [0.85, 0.85, 0.62], e: 0.15, bone: 'pelvis', group: 'Belly', join: 0.3 },
      { name: 'haunchR', c: [0.62, 0.0, 0.5], u: [0, 0, 1], r: [0.4, 0.42, 0.45], e: 0.2, bone: 'thighR', join: 0.28 }],
    legs: 'hidden', hip: [0.58, 0, 0.55], foot: [0.56, 0.28], arm: { sh: [0.84, 0.1, 1.95], dir: ARM_OUT, len: [0.42, 0.38], r: [0.2, 0.16, 0.13] },
    neckZ: 2.3, tail: [0, -0.88, 0.6], back: [[3.2, -0.3], [2.6, -0.72], [1.9, -1.0], [1.2, -1.12], [0.75, -1.25]],
    belly: { oval: { c: [0, 0.9, 1.32], u: [0, -0.1, 1], r: [1.02, 0.82, 0.55], e: 0.3 }, strip: { c: [0, 1.0, 1.35], u: [0, -0.1, 1], r: [1.0, 0.42, 0.45], e: 0.3 }, bib: { c: [0, 0.78, 2.0], u: [0, 0.1, -1], r: [0.5, 0.48, 0.4], e: 0.5 } } },
  // THE WEDGE (top-heavy: a gorilla, a boar): the chest and the shoulders the mass, the hips small, the head forward and low
  wedge: { heads: 3.2, hz: 2.66, hy: 0.16, neck: 'pinch', seam: 1,
    body: [
      { name: 'chest', c: [0, 0.12, 1.92], u: [0, 0, -1], r: [0.66, 1.2, 0.92], e: 0.3, bone: 'torso', join: 0.35 },
      { name: 'belly', c: [0, 0.14, 1.02], u: [0, 0, 1], r: [0.68, 0.8, 0.76], e: 0.15, bone: 'pelvis', join: 0.32 },
      { name: 'haunchR', c: [0.46, 0.0, 0.55], u: [0, 0, 1], r: [0.34, 0.36, 0.4], e: 0.2, bone: 'thighR', join: 0.24 }],
    legs: 'cones', legR: [0.22, 0.16], hip: [0.44, 0, 0.6], foot: [0.46, 0.28], arm: { sh: [1.06, 0.14, 2.08], dir: ARM_OUT, len: [0.5, 0.46], r: [0.26, 0.22, 0.17] },
    neckZ: 2.36, tail: [0, -0.7, 0.75], back: [[3.0, -0.3], [2.5, -0.85], [1.9, -0.95], [1.2, -0.8], [0.8, -0.75]],
    belly: { oval: { c: [0, 0.82, 1.3], u: [0, -0.1, 1], r: [0.75, 0.6, 0.42], e: 0.2 }, strip: { c: [0, 0.95, 1.5], u: [0, -0.1, 1], r: [0.95, 0.4, 0.42], e: 0.2 }, bib: { c: [0, 1.0, 2.1], u: [0, 0.1, -1], r: [0.5, 0.56, 0.4], e: 0.5 } } },
  // THE BARREL (even and round: a bear, a hippo, a pig): one round mass, short thick legs showing, broad shoulders
  barrel: { heads: 3.1, hz: 2.62, hy: 0.04, neck: 'pinch', seam: 1,
    body: [
      { name: 'chest', c: [0, 0.06, 1.92], u: [0, 0, 1], r: [0.5, 1.0, 0.9], e: 0.15, bone: 'torso', join: 0.38 },
      { name: 'belly', c: [0, 0.08, 1.22], u: [0, 0, 1], r: [1.0, 1.16, 1.1], e: 0.1, bone: 'pelvis', join: 0.38 },
      { name: 'haunchR', c: [0.64, 0.0, 0.56], u: [0, 0, 1], r: [0.38, 0.4, 0.42], e: 0.15, bone: 'thighR', join: 0.26 }],
    legs: 'cones', legR: [0.28, 0.24], hip: [0.62, 0, 0.55], foot: [0.62, 0.24], arm: { sh: [0.98, 0.1, 1.98], dir: ARM_OUT, len: [0.4, 0.36], r: [0.25, 0.22, 0.19] },
    neckZ: 2.36, tail: [0, -1.0, 0.75], back: [[3.0, -0.3], [2.5, -0.8], [1.9, -1.0], [1.2, -1.15], [0.75, -1.1]],
    belly: { oval: { c: [0, 1.0, 1.3], u: [0, -0.1, 1], r: [0.95, 0.78, 0.5], e: 0.2 }, strip: { c: [0, 1.1, 1.35], u: [0, -0.1, 1], r: [1.0, 0.44, 0.45], e: 0.2 }, bib: { c: [0, 0.92, 2.05], u: [0, 0.1, -1], r: [0.5, 0.5, 0.4], e: 0.5 } } },
  // THE NOODLE (long and low on four legs, stood up long: an otter, a lizard; a meerkat already upright): a tall slim
  // tube, a visible slender neck, a small head, short limbs
  noodle: { heads: 3.9, hz: 3.4, hy: 0.06, neck: 'visible', seam: 1,
    body: [
      { name: 'chest', c: [0, 0.05, 2.42], u: [0, 0, 1], r: [0.5, 0.62, 0.58], e: 0.15, bone: 'torso', join: 0.3 },
      { name: 'belly', c: [0, 0.1, 1.45], u: [0, 0, 1], r: [0.98, 0.74, 0.66], e: 0.15, bone: 'pelvis', join: 0.32 },
      { name: 'haunchR', c: [0.42, 0.0, 0.62], u: [0, 0, 1], r: [0.3, 0.34, 0.36], e: 0.2, bone: 'thighR', join: 0.24 }],
    legs: 'hidden', hip: [0.4, 0, 0.62], foot: [0.42, 0.26], arm: { sh: [0.64, 0.1, 2.55], dir: ARM_OUT, len: [0.36, 0.32], r: [0.15, 0.13, 0.11] },
    neckZ: 2.86, neckEgg: { c: [0, 0.04, 2.92], r: [0.3, 0.42, 0.4] }, tail: [0, -0.7, 0.7], back: [[3.7, -0.3], [3.0, -0.48], [2.4, -0.6], [1.6, -0.72], [0.9, -0.7]],
    belly: { oval: { c: [0, 0.72, 1.6], u: [0, -0.05, 1], r: [1.15, 0.5, 0.36], e: 0.2 }, strip: { c: [0, 0.75, 1.9], u: [0, 0, 1], r: [1.45, 0.36, 0.36], e: 0.15 }, bib: { c: [0, 0.6, 2.7], u: [0, 0.1, -1], r: [0.45, 0.4, 0.34], e: 0.5 } } },
  // LEGGY (high on long legs: a fox, a deer, a horse, a cat): a compact body raised high, a visible neck, the legs two
  // cones each, slender arms
  leggy: { heads: 3.9, hz: 3.4, hy: 0.06, neck: 'visible', seam: 1,
    body: [
      { name: 'chest', c: [0, 0.08, 2.42], u: [0, 0, 1], r: [0.5, 0.74, 0.68], e: 0.15, bone: 'torso', join: 0.3 },
      { name: 'belly', c: [0, 0.08, 1.78], u: [0, 0, 1], r: [0.62, 0.76, 0.7], e: 0.2, bone: 'pelvis', join: 0.3 },
      { name: 'haunchR', c: [0.42, -0.02, 1.38], u: [0, 0, 1], r: [0.34, 0.36, 0.42], e: 0.2, bone: 'thighR', join: 0.22 }],
    legs: 'cones', legR: [0.19, 0.12], hip: [0.4, 0, 1.35], knee: [0.42, 0.08, 0.72], foot: [0.42, 0.22], arm: { sh: [0.68, 0.1, 2.58], dir: ARM_OUT, len: [0.52, 0.48], r: [0.16, 0.13, 0.1] },
    neckZ: 2.88, neckEgg: { c: [0, 0.08, 2.96], r: [0.34, 0.42, 0.4] }, tail: [0, -0.66, 1.62], back: [[3.7, -0.3], [3.0, -0.55], [2.4, -0.68], [1.8, -0.72], [1.5, -0.66]],
    belly: { oval: { c: [0, 0.74, 1.95], u: [0, 0, 1], r: [0.72, 0.5, 0.36], e: 0.2 }, strip: { c: [0, 0.78, 2.15], u: [0, 0, 1], r: [0.95, 0.34, 0.36], e: 0.15 }, bib: { c: [0, 0.72, 2.62], u: [0, 0.1, -1], r: [0.48, 0.46, 0.36], e: 0.5 } } },
  // THE TEARDROP (upright already: an owl, a penguin, a seal, a frog): one egg, fat at its foot, the head merged into
  // its top, short wings or flippers at the sides, the feet small
  teardrop: { heads: 2.8, hz: 2.3, hy: 0.04, neck: 'merged', seam: 0,
    body: [
      { name: 'belly', c: [0, 0.05, 1.18], u: [0, 0, 1], r: [1.22, 1.05, 0.95], e: 0.3, bone: 'pelvis', join: 0.4 },
      { name: 'chest', c: [0, 0.05, 1.86], u: [0, 0, 1], r: [0.5, 0.86, 0.8], e: 0.1, bone: 'torso', join: 0.42 },
      { name: 'haunchR', c: [0.46, 0.0, 0.4], u: [0, 0, 1], r: [0.32, 0.34, 0.34], bone: 'thighR', join: 0.24 }],
    legs: 'hidden', hip: [0.44, 0, 0.45], foot: [0.44, 0.28], arm: { sh: [0.86, 0.04, 1.72], dir: unit([0.5, -0.1, -0.86]), len: [0.38, 0.34], r: [0.18, 0.15, 0.12] },
    neckZ: 2.0, tail: [0, -0.86, 0.5], back: [[2.6, -0.3], [2.0, -0.82], [1.4, -0.95], [0.8, -0.9], [0.5, -0.8]],
    belly: { oval: { c: [0, 0.86, 1.2], u: [0, 0, 1], r: [1.1, 0.78, 0.5], e: 0.2 }, strip: { c: [0, 0.9, 1.3], u: [0, 0, 1], r: [1.2, 0.48, 0.5], e: 0.2 }, bib: { c: [0, 0.82, 1.8], u: [0, 0.1, -1], r: [0.5, 0.5, 0.4], e: 0.4 } } },
  // THE PERCH (a bird standing: a pigeon, a crow, an eagle): a body tilted forward, the breast puffed out, a visible
  // neck, the wings folded along the sides back over the tail, thin legs under it, the tail behind
  perch: { heads: 3.0, hz: 2.56, hy: 0.22, neck: 'visible', seam: 1, bird: true,
    body: [
      { name: 'belly', c: [0, -0.15, 1.3], u: unit([0, -0.85, -0.45]), r: [1.0, 0.84, 0.8], e: 0.35, hint: [1, 0, 0], bone: 'pelvis', join: 0.36 },
      { name: 'chest', c: [0, 0.38, 1.62], u: unit([0, 0.4, 1]), r: [0.66, 0.8, 0.72], e: 0.15, bone: 'torso', join: 0.38 },
      { name: 'haunchR', c: [0.34, -0.05, 0.82], u: [0, 0, 1], r: [0.24, 0.26, 0.28], bone: 'thighR', join: 0.18 }],
    legs: 'cones', legR: [0.09, 0.06], hip: [0.32, 0.0, 0.82], knee: [0.34, 0.1, 0.46], foot: [0.34, 0.14], arm: { sh: [0.66, 0.28, 1.95], dir: ARM_FOLD, len: [0.42, 0.42], r: [0.16, 0.13, 0.1] },
    neckZ: 2.12, neckEgg: { c: [0, 0.32, 2.2], r: [0.36, 0.44, 0.44] }, tail: [0, -0.95, 0.85], back: [[2.9, 0.0], [2.3, -0.2], [1.85, -0.62], [1.4, -0.95], [1.0, -1.1]],
    belly: { oval: { c: [0, 0.92, 1.55], u: [0, 0.2, 1], r: [0.75, 0.62, 0.4], e: 0.2 }, strip: { c: [0, 0.8, 1.35], u: [0, 0.3, 1], r: [0.95, 0.42, 0.45], e: 0.2 }, bib: { c: [0, 0.82, 1.95], u: [0, 0.1, -1], r: [0.45, 0.5, 0.4], e: 0.4 } } },
  // THE WADER (a long-legged long-necked bird: a flamingo, an ostrich): a small body high on stilts, a long neck
  wader: { heads: 4.3, hz: 3.8, hy: 0.42, neck: 'long', seam: 1, bird: true,
    body: [
      { name: 'belly', c: [0, -0.1, 2.3], u: unit([0, -0.9, -0.3]), r: [0.86, 0.62, 0.6], e: 0.3, hint: [1, 0, 0], bone: 'pelvis', join: 0.3 },
      { name: 'chest', c: [0, 0.3, 2.5], u: unit([0, 0.3, 1]), r: [0.44, 0.56, 0.5], e: 0.1, bone: 'torso', join: 0.3 },
      { name: 'haunchR', c: [0.24, -0.05, 2.05], u: [0, 0, 1], r: [0.18, 0.2, 0.22], bone: 'thighR', join: 0.14 }],
    legs: 'cones', legR: [0.07, 0.05], hip: [0.24, 0, 2.05], knee: [0.26, 0.06, 1.05], foot: [0.26, 0.14], arm: { sh: [0.48, 0.25, 2.62], dir: ARM_FOLD, len: [0.36, 0.36], r: [0.13, 0.11, 0.09] },
    neckZ: 2.7, neckEgg: { c: [0, 0.38, 3.2], u: [0, 0.15, 1], r: [0.62, 0.22, 0.22] }, tail: [0, -0.9, 2.2], back: [[4.0, 0.2], [3.3, 0.3], [2.75, -0.3], [2.5, -0.7], [2.3, -0.9]],
    belly: { oval: { c: [0, 0.55, 2.3], u: [0, 0.2, 1], r: [0.5, 0.4, 0.3], e: 0.2 }, strip: { c: [0, 0.55, 2.3], u: [0, 0.2, 1], r: [0.6, 0.3, 0.3], e: 0.2 }, bib: { c: [0, 0.5, 2.75], u: [0, 0.1, -1], r: [0.35, 0.3, 0.28], e: 0.4 } } },
  // THE ORB (the head is the body: a fish, a whale): one egg, the face on its front, fins for limbs
  orb: { heads: 2.6, hz: 2.0, hy: 0.24, neck: 'merged', seam: 0,
    body: [
      { name: 'belly', c: [0, 0.0, 1.2], u: [0, 0, 1], r: [1.22, 1.28, 1.18], e: 0.05, bone: 'pelvis', join: 0.4 },
      { name: 'chest', c: [0, 0.04, 1.75], u: [0, 0, 1], r: [0.5, 0.9, 0.86], bone: 'torso', join: 0.42 },
      { name: 'haunchR', c: [0.44, 0.0, 0.32], u: [0, 0, 1], r: [0.28, 0.3, 0.3], bone: 'thighR', join: 0.24 }],
    legs: 'hidden', hip: [0.42, 0, 0.4], foot: [0.44, 0.26], arm: { sh: [1.0, 0.1, 1.5], dir: unit([0.7, 0.0, -0.7]), len: [0.32, 0.3], r: [0.16, 0.14, 0.12] },
    neckZ: 1.95, tail: [0, -1.05, 0.9], back: [[2.6, 0.0], [2.2, -0.7], [1.7, -1.05], [1.1, -1.15], [0.7, -1.0]],
    belly: { oval: { c: [0, 1.0, 1.0], u: [0, 0.3, 1], r: [1.0, 0.9, 0.55], e: 0.15 }, strip: { c: [0, 0.9, 0.85], u: [0, 0.4, 1], r: [1.2, 1.0, 0.6], e: 0.1 }, bib: { c: [0, 1.0, 1.4], u: [0, 0.1, -1], r: [0.5, 0.6, 0.4], e: 0.4 } } },
  // THE SQUAT (a frog, a toad): wide and low, the head merged into the body's front, the hind legs folded big at the
  // sides, the arms propped forward, the feet splayed out in front
  squat: { heads: 2.5, hz: 1.95, hy: 0.18, neck: 'merged', seam: 0,
    body: [
      { name: 'belly', c: [0, 0.05, 0.85], u: [0, 0, 1], r: [0.78, 1.32, 1.08], e: 0.3, bone: 'pelvis', join: 0.4 },
      { name: 'chest', c: [0, 0.12, 1.4], u: unit([0, 0.2, 1]), r: [0.45, 1.05, 0.85], bone: 'torso', join: 0.42 },
      { name: 'haunchR', c: [0.82, -0.18, 0.42], u: unit([0.3, 0.6, 0.2]), r: [0.5, 0.42, 0.4], hint: [0, 0, 1], bone: 'thighR', join: 0.22 }],
    legs: 'hidden', hip: [0.7, -0.1, 0.45], foot: [0.85, 0.45], arm: { sh: [0.78, 0.35, 1.15], dir: unit([0.35, 0.45, -0.82]), len: [0.3, 0.28], r: [0.13, 0.11, 0.09] },
    neckZ: 1.6, tail: [0, -0.9, 0.5], back: [[2.2, 0.0], [1.8, -0.6], [1.3, -0.95], [0.8, -1.0], [0.45, -0.9]],
    belly: { oval: { c: [0, 0.85, 0.95], u: [0, 0.2, 1], r: [0.75, 0.95, 0.5], e: 0.2 }, strip: { c: [0, 0.7, 0.6], u: [0, 0.6, 1], r: [0.9, 1.0, 0.5], e: 0.1 }, bib: { c: [0, 0.9, 1.25], u: [0, 0.1, -1], r: [0.4, 0.6, 0.35], e: 0.4 } } },
  // THE COIL (a snake: no legs, so it rises out of its own coils): a ring of loops on the ground, the body an S up out of
  // it, a slender neck reaching forward, the head held out front; the arms are vestiges inside the body
  coil: { heads: 3.6, hz: 3.1, hy: 0.42, neck: 'visible', seam: 1, limbless: true,
    body: [
      { name: 'coilR', c: [0.52, -0.12, 0.3], u: [0, 1, 0], r: [0.72, 0.34, 0.3], hint: [1, 0, 0], bone: 'thighR', join: 0.26 },
      { name: 'coilBack', c: [0, -0.78, 0.3], u: [1, 0, 0], r: [0.72, 0.34, 0.3], hint: [0, 1, 0], bone: 'pelvis', join: 0.26 },
      { name: 'coilFront', c: [0, 0.48, 0.28], u: [1, 0, 0], r: [0.6, 0.32, 0.28], hint: [0, 1, 0], bone: 'pelvis', join: 0.26 },
      { name: 'belly', c: [0, -0.08, 1.12], u: unit([0, 0.2, 1]), r: [0.72, 0.44, 0.44], e: 0.2, bone: 'pelvis', join: 0.3 },
      { name: 'chest', c: [0, 0.06, 1.94], u: unit([0, 0.3, 1]), r: [0.58, 0.4, 0.4], e: 0.15, bone: 'torso', join: 0.3 }],
    legs: 'hidden', hip: [0.4, 0, 0.42], foot: [0.4, 0.1], arm: { sh: [0.18, 0.1, 1.9], dir: ARM_OUT, len: [0.08, 0.06], r: [0.06, 0.05, 0.04] },
    neckZ: 2.5, neckEgg: { c: [0, 0.24, 2.58], u: unit([0, 0.4, 1]), r: [0.46, 0.33, 0.33] }, tail: [0, -0.9, 0.36], back: [[3.3, 0.1], [2.6, -0.1], [1.9, -0.32], [1.2, -0.5], [0.5, -1.0]],
    belly: { oval: { c: [0, 0.3, 1.5], u: unit([0, 0.25, 1]), r: [1.0, 0.3, 0.3], e: 0.1 }, strip: { c: [0, 0.32, 1.6], u: unit([0, 0.3, 1]), r: [1.3, 0.3, 0.3], e: 0.1 }, bib: { c: [0, 0.4, 2.5], u: unit([0, 0.4, 1]), r: [0.5, 0.3, 0.3], e: 0.3 } } },
});

/** THE BELLIES: what a pale (or dark) underside is on each silhouette. A belly is a species' feature, read from the roster
 *  (its belly's lightness against its coat's): a species with none has none, and its family may name one the roster
 *  lacks (FAMILY_TUNE `belly`: the raccoon's oval, a fox's bib). A belly darker than the coat is the same shape in its
 *  own colour. A tuxedo (a penguin) is the whole front.
 *    oval          a designed egg low on the front (the pear's, the barrel's, an upright animal's)
 *    bib           the chest alone (a top-heavy animal, a fox's white chest)
 *    underside     a strip from the groin up the front to a bib under the chin (a long body, a leggy one)
 *    breast        a bird's puffed breast
 *    countershade  the whole underside (a fish, a whale)
 *    scutes        a reptile's belly strip */
export const BELLIES = Object.freeze({
  oval: (B) => [B.oval], bib: (B) => [B.bib], underside: (B) => [B.strip, B.bib], breast: (B) => [B.oval],
  countershade: (B) => [B.strip], scutes: (B) => [B.strip],
});
const BELLY_OF = Object.freeze({ squat: 'oval', pear: 'oval', barrel: 'oval', teardrop: 'oval', wedge: 'bib', noodle: 'underside', leggy: 'underside', perch: 'breast', wader: 'breast', orb: 'countershade', coil: 'scutes' });

/** the least lightness between a belly and its coat that shows as a designed belly (less reads as one colour) */
export const BELLY_CONTRAST = 0.12;

export function bellyOf(id, silhouette, { plan, pattern, tune } = {}) {
  const B = SILHOUETTES[silhouette].belly;
  if (pattern === 'tuxedo') { const o = B.oval; return { kind: 'tuxedo', regions: [{ ...o, c: [0, o.c[1] * 0.85, o.c[2] + 0.25], r: [o.r[0] * 1.32, o.r[1] * 1.22, o.r[2] * 1.27], e: 0.2 }] }; }
  const c = speciesMetrics(id).bellyContrast;
  let kind = tune ?? (c == null || Math.abs(c) < BELLY_CONTRAST ? 'none' : BELLY_OF[silhouette]);
  if (plan === 'reptile' && kind !== 'none' && silhouette !== 'coil') kind = 'scutes';
  return { kind, regions: kind === 'none' ? [] : BELLIES[kind](B) };
}

export { SPECIES };
