/**
 * THE MASCOT'S ADORNMENT: one signature piece (docs/mascot.md, Adornment), built on the core adornment layer
 * (polygonizer/station-loft-adorn.js: a shell or band worn over the body, lifted by mugen, its one SIGNATURE element).
 *
 * The laws (Ad1–Ad6):
 *   Ad1  one piece, the accessory people draw from memory (a bell collar, a scarf, a bow); never a costume
 *   Ad2  it sits on a silhouette edge: the neck, the crown, the waist, the wrists, the back
 *   Ad3  big and simple, sized to the head; its signature element reads at 64 px
 *   Ad4  it carries the colour the body lacks: the accent, with one gold shine on its signature
 *   Ad5  it says the promise: speed trails a scarf, cheer wears a bow, mischief a bandana, might a champion's belt,
 *        comfort a bell collar, pride a medal, wonder a pack
 *   Ad6  it rides the body (a rigid piece its bone, a ribbon trailing) and never covers the face or the hook
 *
 *   ADORNS                 the pieces: what each reads as, where it sits, the note it writes
 *   mascotAdorn(f, ctx)    → plan.adorn: the piece as adornment data, in shares of its carrier (`share: true`), so
 *                            one reading fits every form; ctx: { R (the head's radius), orb }
 * Pure data and pure functions.
 */

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const S = (pts, R) => pts.map((p) => p.map((x) => r4(x * R)));

/** the pieces: where each sits (Ad2) and the line it writes on the sheet */
export const ADORNS = Object.freeze({
  none: { reads: 'unadorned', at: null, note: 'nothing worn: the shape alone carries it' },
  collar: { reads: 'a bell collar', at: 'neck', note: 'a collar at the neck in the accent, a big gold bell at its front' },
  scarf: { reads: 'a scarf', at: 'neck', note: 'a scarf at the neck in the accent, its two tails streaming back' },
  bow: { reads: 'a bow', at: 'crown', note: 'a bow on the crown in the accent, its loops wider than an ear' },
  belt: { reads: 'a champion\'s belt', at: 'waist', note: 'a belt at the waist in the accent, a big gold buckle at its front' },
  medal: { reads: 'a medal', at: 'neck', note: 'a ribbon round the neck in the accent, a gold medal on the chest' },
  bandana: { reads: 'a bandana', at: 'neck', note: 'a kerchief at the neck in the accent, its knot\'s tails down the front' },
  pack: { reads: 'a pack', at: 'back', note: 'a pack on the back on a band round the body' },
  bands: { reads: 'wristbands', at: 'wrists', note: 'a band on each wrist in the accent, studs in gold' },
});
export const ADORN_IDS = Object.freeze(Object.keys(ADORNS));
/** what the orb can wear: it has no neck, no waist and stub arms */
export const ORB_ADORNS = Object.freeze(['none', 'bow']);

/** The plan's adornment for the sheet's piece. Every size is a share of the head's radius R (Ad3). */
export function mascotAdorn(f, { R, orb }) {
  const piece = f.adorn ?? 'none';
  if (piece === 'none' || (orb && !ORB_ADORNS.includes(piece))) return [];
  const band = (id, part, s, thick, signature, extra = {}) => ({ id, mode: 'band', part, share: true, s, t: 'wrap', nt: 16, ns: 2, mugen: r4(0.012 * R), thick: r4(thick * R), group: 'Adorn', ...extra, signature });
  switch (piece) {
    case 'collar': return [band('collar', 'body', [0.82, 0.97], 0.09, { kind: 'bell', k: 0, side: 'R', links: 2, len: r4(0.04 * R), clear: r4(0.05 * R), link: r4(0.014 * R),
      profile: [0.5, 0.95, 1, 0.9, 0.55], r: r4(0.22 * R), top: r4(0.04 * R), step: r4(0.065 * R), m: 12, capTop: r4(0.03 * R), capBottom: r4(0.34 * R), group: 'Shine', beneath: ['body'] })];
    case 'scarf': return [band('scarf', 'body', [0.78, 0.98], 0.11, { kind: 'ribbon', k: 'mid', j: -1, spread: [-1, 1], spine: S([[0, 0, 0], [0.08, -0.4, -0.08], [0.16, -0.85, 0.02], [0.22, -1.3, 0.18]], R),
      width: r4(0.24 * R), thick: r4(0.035 * R), tip: 'swallow', group: 'Adorn' })];
    case 'bandana': return [band('bandana', 'body', [0.78, 0.98], 0.09, { kind: 'ribbon', k: 0, j: 0, spread: [-1, 1], spine: S([[0, 0, 0], [0.09, 0.08, -0.22], [0.13, 0.1, -0.46]], R),
      width: r4(0.22 * R), thick: r4(0.025 * R), tip: 'point', group: 'Adorn' })];
    case 'belt': return [band('belt', 'body', [0.12, 0.28], 0.07, { kind: 'buckle', k: 0, j: 1, w: r4(0.22 * R), h: r4(0.17 * R), bar: r4(0.05 * R), standoff: r4(0.025 * R), group: 'Shine' })];
    case 'medal': return [band('medal', 'body', [0.86, 0.97], 0.04, { kind: 'medallion', k: 0, j: 0, anchor: [0, r4(0.01 * R), r4(-0.01 * R)], links: 4, len: r4(0.07 * R), clear: r4(0.09 * R), link: r4(0.016 * R),
      surfaces: ['body'], out: [0, 1, 0], drop: r4(0.1 * R), dropClear: r4(0.08 * R), face: [0, 1, 0.15], r: r4(0.2 * R), h: r4(0.05 * R), m: 16, rim: 0.6, group: 'Shine', beneath: ['body'] })];
    case 'pack': return [band('pack', 'body', [0.42, 0.78], 0.03, { kind: 'pack', w: r4(0.5 * R), h: r4(0.55 * R), d: r4(0.28 * R), lift: 0, chamfer: r4(0.12 * R), group: 'Pack' })];
    case 'bands': return ['R', 'L'].map((side) => band(`band${side}`, `foreArm${side}`, [0.45, 0.95], 0.07, { kind: 'studs', r: r4(0.045 * R), h: r4(0.015 * R), count: 3, m: 8, group: 'Shine' }));
    case 'bow': return [{ id: 'bow', mode: 'shell', part: 'head', share: true, s: [0.84, 0.92], t: [0.3, 0.75], side: 'R', nt: 4, ns: 2, mugen: r4(0.01 * R), thick: r4(0.05 * R), group: 'Adorn',
      signature: { kind: 'ribbon', k: 'mid', j: 'mid', spread: [-1, 1], spine: S([[0, 0, 0], [0.22, -0.02, 0.14], [0.42, -0.02, 0.08], [0.36, 0, -0.06]], R), width: r4(0.3 * R), thick: r4(0.05 * R), tip: 'square', group: 'Adorn' } }];
    default: return [];
  }
}
