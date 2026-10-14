/**
 * THE RACER'S PARTS LIBRARY — the ODM's catalogue a cartoon racer is composed from (racer.js solves it). Each row is a
 * part as data an agent can read, change and write more of:
 *
 *   family    what it is on the machine (body, wheel, engine, exhaust, aero, nose, lamps, tail, seat, steering, cockpit,
 *             fender, hero, booster)
 *   fits      what it suits: weights over the vehicle sheet's facets (silhouette, motif, era, engine, stance, cockpit)
 *             and the driver's (archetype, order: bound | free); the solver scores a family's rows by them
 *   mount     the socket it hangs on (the body's: seat, deck, tail, nose, bonnet, flank, dash, hub, mast; an engine's
 *             stacks); `mirror` a pair either side
 *   size      its params as expressions over the MACHINE's frame (racer.js FRAME_VARS: the rear wheel's diameter D, the
 *             track T, the deck's height, the driver's torso and head, the body's length L and half width W …): a part
 *             fits any machine before the laws resize it
 *   fx        where the game's states show on it (juice.js): an exhaust's tip, a wheel's contact, a lamp, a booster's
 *             nozzle, each local to the part
 *   moves     how it lives in the page: spin (a wheel's roll), steer (a front wheel), wobble (a mast), squash (the body)
 *   block     its geometry: a scapeshift block (era/blocks.js: primitives on rails, numbers as expressions), in its own
 *             frame (+y forward, +x right, z up; its origin the socket it mounts on)
 *
 * A body is not a block: it is LOFTED from its PROFILE (racer.js), stations from the tail (t 0) to the nose (t 1), each
 * [t, half width (share of W), bottom (share of D), top (share of the deck)] and a `taper` (the section's top width over
 * its bottom's) and `round` (its corners, 0 square … 1 an ellipse; the motif's when it says).
 *
 * Paint slots are surface groups: tech:body the primary, tech:skin the secondary, tech:trim the trim's metal, str:paint
 * the accent (the hero's alone), tech:frame the dark chassis, tech:glass glass, tech:light a lamp, tech:cable rubber.
 *
 * HERO_OF: the archetype's one hero piece (the outfit's FOCAL, for a machine).
 * Pure data.
 */

const B = (id, read, params, parts, sig, lead, tier = 'machine') => Object.freeze({ id, read, tier, mounts: ['socket'], functions: [], params, parts, sig, lead });
const row = (r) => Object.freeze(r);

// ── bodies: lofted profiles ──
export const BODIES = Object.freeze({
  tub: row({ id: 'tub', family: 'body', read: 'a bathtub on wheels: high sides to the driver\'s chest, round at both ends', fits: { silhouette: { tub: 3, barrel: 1 }, archetype: { innocent: 1, caregiver: 1, everyman: 1 } },
    profile: [[0, 0.7, 0.32, 0.92], [0.07, 0.86, 0.22, 1], [0.3, 0.95, 0.18, 1.04], [0.62, 0.92, 0.18, 1], [0.86, 0.78, 0.2, 0.88], [1, 0.5, 0.3, 0.62]], taper: 0.86, round: 0.6, tail: 0.95, nose: 1.05, sill: 0.5 }),
  dart: row({ id: 'dart', family: 'body', read: 'a dart: a low nose rising in a straight line to a high tail', fits: { silhouette: { wedge: 3 }, archetype: { hero: 1, explorer: 1 } },
    profile: [[0, 0.8, 0.3, 1.2], [0.08, 0.9, 0.2, 1.18], [0.35, 0.9, 0.16, 0.98], [0.7, 0.72, 0.15, 0.66], [0.92, 0.48, 0.16, 0.42], [1, 0.26, 0.2, 0.3]], taper: 0.7, round: 0.3, tail: 0.9, nose: 1.5, sill: 0.3 }),
  pencil: row({ id: 'pencil', family: 'body', read: 'a pencil: long and narrow, a needle nose, a cigar of a body', fits: { silhouette: { needle: 3 }, archetype: { outlaw: 1, lover: 1, jester: 0.5 } },
    profile: [[0, 0.42, 0.34, 0.86], [0.1, 0.56, 0.24, 0.96], [0.4, 0.6, 0.2, 0.92], [0.72, 0.42, 0.2, 0.62], [0.92, 0.18, 0.26, 0.42], [1, 0.05, 0.32, 0.36]], taper: 0.8, round: 0.8, tail: 0.8, nose: 2.4, sill: 0.28 }),
  carriage: row({ id: 'carriage', family: 'body', read: 'a carriage: tall and upright, flaring wide to the wheels', fits: { silhouette: { bell: 3 }, archetype: { ruler: 1.5, sage: 1, magician: 1 } },
    profile: [[0, 0.82, 0.3, 1.25], [0.08, 0.96, 0.2, 1.36], [0.4, 1, 0.18, 1.4], [0.72, 0.94, 0.2, 1.2], [0.9, 0.76, 0.24, 0.9], [1, 0.52, 0.3, 0.66]], taper: 0.58, round: 0.45, tail: 0.9, nose: 1.0, sill: 0.42 }),
  crate: row({ id: 'crate', family: 'body', read: 'a crate: square to the wind, flat sides and a flat top', fits: { silhouette: { brick: 3, column: 2 }, archetype: { everyman: 1, creator: 1 }, motif: { riveted: 1, faceted: 0.5 } },
    profile: [[0, 0.9, 0.24, 1.05], [0.04, 0.95, 0.2, 1.1], [0.5, 0.95, 0.18, 1.12], [0.94, 0.92, 0.2, 1.02], [1, 0.86, 0.26, 0.92]], taper: 0.94, round: 0.12, tail: 0.85, nose: 0.9, sill: 0.4 }),
  bean: row({ id: 'bean', family: 'body', read: 'a bean: swollen at the middle, the ends drawn in', fits: { silhouette: { barrel: 3, bubble: 1 }, archetype: { caregiver: 1, everyman: 0.5 } },
    profile: [[0, 0.5, 0.34, 0.78], [0.12, 0.84, 0.22, 1.04], [0.45, 1.06, 0.16, 1.16], [0.75, 0.88, 0.18, 1], [0.94, 0.56, 0.26, 0.74], [1, 0.34, 0.34, 0.56]], taper: 0.72, round: 0.85, tail: 0.95, nose: 1.1, sill: 0.4 }),
  pod: row({ id: 'pod', family: 'body', read: 'a pod: no corner anywhere, a bubble on wheels', fits: { silhouette: { bubble: 3 }, archetype: { innocent: 1.5, jester: 0.5 }, motif: { smooth: 1, organic: 1 } },
    profile: [[0, 0.36, 0.4, 0.66], [0.1, 0.78, 0.24, 1], [0.42, 0.96, 0.18, 1.12], [0.74, 0.86, 0.2, 1], [0.93, 0.5, 0.3, 0.72], [1, 0.2, 0.42, 0.56]], taper: 0.66, round: 1, tail: 1.0, nose: 1.15, sill: 0.36 }),
  slipper: row({ id: 'slipper', family: 'body', read: 'a slipper: a low open shell, the driver sitting on top of it', fits: { silhouette: { wedge: 1.5, needle: 1, tub: 1 }, archetype: { explorer: 1, outlaw: 0.5 }, cockpit: { open: 1 } },
    profile: [[0, 0.74, 0.28, 0.78], [0.08, 0.84, 0.2, 0.8], [0.45, 0.84, 0.16, 0.72], [0.8, 0.6, 0.16, 0.5], [1, 0.3, 0.22, 0.36]], taper: 0.8, round: 0.5, tail: 0.9, nose: 1.3, sill: 0.15 }),
});

// ── the rest: blocks ──
// wheels: built round their hub at (0, 0, r) (the solver brings the hub to its axle), turning about x; the outer face +x
const tyre = (sides = 16) => ({ id: 'tyre', prim: 'wheel', role: 'running', axis: 'x', r: 'r', w: 'w', sides, group: 'tech:cable', value: 0.2 });
export const PARTS = Object.freeze({
  slick: row({ family: 'wheel', fits: { era: { modern: 2, future: 1 }, stance: { low: 1 } }, mount: 'hub', moves: ['spin'], fx: { contact: [0, 0, 0] }, size: { r: 'rw', w: 'ww' },
    block: B('slick', 'a fat slick on a deep rim, two spokes and a lug that show it turning', { r: [0.1, 1.2], w: [0.05, 0.9] }, [
      tyre(18),
      { id: 'rim', prim: 'drum', role: 'running', axis: 'x', r: 'max(0.02, r * 0.62)', h: 'w + 0.02', sides: 14, at: ['-w / 2 - 0.01', 0, 'r'], group: 'tech:skin', value: 0.72 },
      { id: 'spokes', prim: 'box', role: 'trim', size: [0.04, 'r * 1.1', 'max(0.04, r * 0.16)'], at: ['w / 2 + 0.02', 0, 'r * 0.92'], group: 'tech:body', value: 0.6 },
      { id: 'lug', prim: 'drum', role: 'trim', axis: 'x', r: 'max(0.02, r * 0.12)', h: 0.04, at: ['w / 2 + 0.02', 'r * 0.38', 'r'], group: 'tech:frame', value: 0.3 },
    ], ['tyre'], 'tyre') }),
  chunky: row({ family: 'wheel', fits: { stance: { raised: 3 }, motif: { riveted: 1, spiked: 1, faceted: 1 } }, mount: 'hub', moves: ['spin'], fx: { contact: [0, 0, 0] }, size: { r: 'rw * 1.04', w: 'ww * 1.1' },
    block: B('chunky', 'a chunky off-road tyre (its polygon the tread), a small rim, a cross of spokes', { r: [0.1, 1.3], w: [0.05, 1] }, [
      tyre(9),
      { id: 'rim', prim: 'drum', role: 'running', axis: 'x', r: 'r * 0.5', h: 'w + 0.02', sides: 8, at: ['-w / 2 - 0.01', 0, 'r'], group: 'tech:skin', value: 0.65 },
      { id: 'cross', prim: 'box', role: 'trim', size: [0.04, 'r * 0.8', 'max(0.04, r * 0.14)'], at: ['w / 2 + 0.02', 0, 'r * 0.93'], group: 'tech:frame', value: 0.35 },
      { id: 'cross2', prim: 'box', role: 'trim', size: [0.04, 'max(0.04, r * 0.14)', 'r * 0.8'], at: ['w / 2 + 0.02', 0, 'r * 0.6'], group: 'tech:frame', value: 0.35 },
    ], ['tyre'], 'tyre') }),
  wire: row({ family: 'wheel', fits: { era: { vintage: 3, classic: 0.5 }, archetype: { sage: 1 } }, mount: 'hub', moves: ['spin'], fx: { contact: [0, 0, 0] }, size: { r: 'rw', w: 'ww * 0.6' },
    block: B('wire', 'a thin tyre on a wire wheel: six spokes to a bright hub', { r: [0.1, 1.2], w: [0.04, 0.6] }, [
      tyre(18),
      ...[[1, 0], [0.5, 0.866], [-0.5, 0.866], [-1, 0], [-0.5, -0.866], [0.5, -0.866]].map(([c, s], k) => ({ id: `spoke${k}`, prim: 'tube', role: 'trim', r: 0.012, from: ['w / 2', 0, 'r'], to: ['w / 2', `r * ${0.8 * c}`, `r + r * ${0.8 * s}`], group: 'tech:trim', value: 0.8 })),
      { id: 'hub', prim: 'drum', role: 'running', axis: 'x', r: 'r * 0.2', h: 'w + 0.06', sides: 8, at: ['-w / 2 - 0.03', 0, 'r'], group: 'tech:trim', value: 0.85 },
    ], ['tyre'], 'tyre') }),
  disc: row({ family: 'wheel', fits: { era: { classic: 2, future: 2 }, motif: { smooth: 1 }, archetype: { innocent: 0.5, ruler: 0.5 } }, mount: 'hub', moves: ['spin'], fx: { contact: [0, 0, 0] }, size: { r: 'rw', w: 'ww' },
    block: B('disc', 'a full hubcap: a flat disc with a stripe across it, turning', { r: [0.1, 1.2], w: [0.05, 0.9] }, [
      tyre(16),
      { id: 'cap', prim: 'drum', role: 'running', axis: 'x', r: 'r * 0.7', h: 'w + 0.03', sides: 16, at: ['-w / 2 - 0.015', 0, 'r'], group: 'tech:skin', value: 0.8 },
      { id: 'stripe', prim: 'box', role: 'trim', size: [0.04, 'r * 1.3', 'max(0.04, r * 0.22)'], at: ['w / 2 + 0.03', 0, 'r * 0.89'], group: 'tech:body', value: 0.6 },
    ], ['tyre'], 'tyre') }),
  star: row({ family: 'wheel', fits: { era: { modern: 1.5, classic: 1 }, motif: { faceted: 1, ornate: 1 }, archetype: { hero: 1, magician: 0.5 } }, mount: 'hub', moves: ['spin'], fx: { contact: [0, 0, 0] }, size: { r: 'rw', w: 'ww' },
    block: B('star', 'a five-spoke star wheel', { r: [0.1, 1.2], w: [0.05, 0.9] }, [
      tyre(16),
      { id: 'rim', prim: 'drum', role: 'running', axis: 'x', r: 'r * 0.64', h: 'w', sides: 15, at: ['-w / 2', 0, 'r'], group: 'tech:skin', value: 0.5 },
      ...[[0, 1], [0.951, 0.309], [0.588, -0.809], [-0.588, -0.809], [-0.951, 0.309]].map(([c, s], k) => ({ id: `spoke${k}`, prim: 'tube', role: 'trim', r: 'max(0.01, r * 0.07)', sides: 4, from: ['w / 2 + 0.01', 0, 'r'], to: ['w / 2 + 0.01', `r * ${0.6 * c}`, `r + r * ${0.6 * s}`], group: 'tech:trim', value: 0.8 })),
    ], ['tyre'], 'tyre') }),

  // engines: on the deck behind the seat (or the bonnet), their origin the foot of the block, front +y
  single: row({ family: 'engine', fits: { engine: { exposed: 2 }, era: { vintage: 1, classic: 1 }, archetype: { everyman: 1, caregiver: 0.5, innocent: 0.5 } }, mount: 'deck', power: 7, provides: { stacks: [[0, '-d * 0.5', 'h * 0.6']] }, size: { w: 'D * 0.5', d: 'D * 0.4', h: 'D * 0.38' },
    block: B('single', 'a single: one finned cylinder on a crankcase', { w: [0.1, 1], d: [0.1, 1], h: [0.1, 1] }, [
      { id: 'case', prim: 'box', role: 'body', size: ['w', 'd', 'h * 0.45'], group: 'tech:skin', value: 0.55 },
      { id: 'barrel', prim: 'drum', role: 'body', r: 'w * 0.26', h: 'h * 0.6', sides: 10, at: [0, 0, 'h * 0.4'], group: 'tech:trim', value: 0.65 },
      { id: 'fins', prim: 'drum', role: 'trim', r: 'w * 0.34', h: 0.025, sides: 10, at: [0, 0, 'h * 0.55'], repeat: { n: 4, step: [0, 0, 'h * 0.1'] }, group: 'tech:trim', value: 0.75 },
    ], ['case', 'barrel'], 'case') }),
  twin: row({ family: 'engine', fits: { engine: { exposed: 2, oversized: 1 }, archetype: { outlaw: 1, explorer: 1, hero: 0.5 }, motif: { riveted: 1, spiked: 0.5 } }, mount: 'deck', power: 9, provides: { stacks: [['-w * 0.3', '-d * 0.5', 'h * 0.5'], ['w * 0.3', '-d * 0.5', 'h * 0.5']] }, size: { w: 'D * 0.66', d: 'D * 0.44', h: 'D * 0.46' },
    block: B('twin', 'a V-twin: two cylinders splayed on one case', { w: [0.34, 1.2], d: [0.3, 1], h: [0.34, 1.2] }, [
      { id: 'case', prim: 'box', role: 'body', size: ['w * 0.7', 'd', 'h * 0.42'], group: 'tech:skin', value: 0.55 },
      { id: 'cyl', prim: 'drum', role: 'body', r: 'w * 0.17', h: 'h * 0.62', sides: 10, at: ['-w * 0.24', 0, 'h * 0.36'], repeat: { n: 2, step: ['w * 0.48', 0, 0] }, group: 'tech:trim', value: 0.68 },
      { id: 'heads', prim: 'box', role: 'trim', size: ['w * 0.4', 'd * 0.5', 'h * 0.12'], at: ['-w * 0.24', 0, 'h * 0.92'], repeat: { n: 2, step: ['w * 0.48', 0, 0] }, group: 'tech:frame', value: 0.3 },
    ], ['case', 'cyl'], 'case') }),
  bigblock: row({ family: 'engine', fits: { engine: { oversized: 3 }, archetype: { ruler: 1, hero: 1, outlaw: 1 }, era: { classic: 1 } }, mount: 'deck', power: 13, provides: { stacks: [['-w * 0.42', '-d * 0.3', 'h * 0.5'], ['w * 0.42', '-d * 0.3', 'h * 0.5']] }, size: { w: 'D * 0.8', d: 'D * 0.7', h: 'D * 0.5' },
    block: B('bigblock', 'a big block: a V8 with a blower and its scoop standing through the deck', { w: [0.2, 1.6], d: [0.2, 1.6], h: [0.19, 1.4] }, [
      { id: 'block', prim: 'box', role: 'body', size: ['w * 0.8', 'd', 'h * 0.6'], group: 'tech:skin', value: 0.55 },
      { id: 'banks', prim: 'box', role: 'body', size: ['w * 0.3', 'd * 0.92', 'h * 0.22'], at: ['-w * 0.3', 0, 'h * 0.5'], repeat: { n: 2, step: ['w * 0.6', 0, 0] }, group: 'tech:trim', value: 0.7 },
      { id: 'blower', prim: 'box', role: 'intake', size: ['w * 0.42', 'd * 0.62', 'h * 0.34'], at: [0, 0, 'h * 0.6'], group: 'tech:trim', value: 0.78 },
      { id: 'scoop', prim: 'box', role: 'intake', size: ['w * 0.34', 'd * 0.4', 'h * 0.26'], at: [0, 'd * 0.12', 'h * 0.94'], group: 'tech:body', value: 0.6 },
    ], ['block', 'blower'], 'block') }),
  turbine: row({ family: 'engine', fits: { engine: { exposed: 1, oversized: 2 }, era: { future: 3 }, archetype: { creator: 1, magician: 1 } }, mount: 'deck', power: 11, provides: { stacks: [[0, '-d * 0.5', 'h * 0.5']] }, size: { w: 'D * 0.56', d: 'D * 0.8', h: 'D * 0.56' },
    block: B('turbine', 'a turbine: a drum with an intake ring and a tail cone', { w: [0.34, 1.2], d: [0.42, 1.6], h: [0.34, 1.2] }, [
      { id: 'drum', prim: 'drum', role: 'body', axis: 'y', r: 'h * 0.42', h: 'd * 0.8', sides: 14, at: [0, '-d * 0.4', 'h * 0.5'], group: 'tech:trim', value: 0.72 },
      { id: 'intake', prim: 'ring', role: 'intake', axis: 'y', r: 'h * 0.44', tube: 'h * 0.06', sides: 14, at: [0, 'd * 0.42', 'h * 0.5'], group: 'tech:frame', value: 0.35 },
      { id: 'mount', prim: 'box', role: 'frame', size: ['w * 0.5', 'd * 0.6', 'h * 0.12'], group: 'tech:frame', value: 0.3 },
    ], ['drum'], 'drum') }),
  cowl: row({ family: 'engine', fits: { engine: { hidden: 3 } }, mount: 'deck', power: 8, provides: { stacks: [[0, '-d * 0.5', 'h * 0.25']] }, size: { w: 'D * 0.6', d: 'D * 0.5', h: 'D * 0.22' },
    block: B('cowl', 'the engine under a cowl: a smooth hump on the deck, a grille at its back', { w: [0.4, 1.2], d: [0.4, 1.2], h: [0.26, 0.8] }, [
      { id: 'hump', prim: 'box', role: 'shell', size: ['w', 'd', 'h * 0.6'], group: 'tech:body', value: 0.62 },
      { id: 'crown', prim: 'box', role: 'shell', size: ['w * 0.7', 'd * 0.86', 'h * 0.4'], at: [0, 0, 'h * 0.6'], group: 'tech:body', value: 0.7 },
      { id: 'grille', prim: 'panel', role: 'trim', size: ['w * 0.6', 'h * 0.4'], t: 0.02, at: [0, '-d / 2 - 0.012', 'h * 0.3'], aim: [0, -1, 0], group: 'tech:frame', value: 0.25 },
    ], ['hump'], 'hump') }),

  // exhausts: from the engine's stacks back past the tail; the tip their fx (a flame, a puff), pointing −y (or up)
  pipes: row({ family: 'exhaust', fits: { engine: { exposed: 1, oversized: 1, hidden: 1 }, era: { modern: 1, future: 0.5 } }, mount: 'stacks', size: { len: 'max(0.2, stackY - tailY + 0.12)', r: 'D * 0.06', drop: 'stackZ - deck * 0.8' }, fx: { tip: [[0, '-len', '-drop'], [0, -1, 0]] },
    block: B('pipes', 'a pipe running back from the stack, a flared tip past the tail', { len: [0.1, 3], r: [0.02, 0.2], drop: [-1, 1] }, [
      { id: 'pipe', prim: 'tube', role: 'outlet', r: 'r', sides: 8, from: [0, 0, 0], to: [0, '-len', '-drop'], group: 'tech:trim', value: 0.75 },
      { id: 'tip', prim: 'drum', role: 'outlet', axis: 'y', r: 'r * 1.5', h: 'r * 2.2', sides: 10, at: [0, '-len - r * 1.4', '-drop'], group: 'tech:trim', value: 0.85 },
    ], ['pipe'], 'pipe', 'part') }),
  stacks: row({ family: 'exhaust', fits: { engine: { exposed: 2, oversized: 2 }, era: { classic: 1, vintage: 1 }, archetype: { outlaw: 1, hero: 0.5 }, stance: { raised: 1 } }, mount: 'stacks', size: { len: 'D * 0.55', r: 'D * 0.065' }, fx: { tip: [[0, '-r * 0.6', 'len + r * 1.8'], [0, -0.9, 0.45]] },
    block: B('stacks', 'stacks: pipes standing up behind the driver, trumpets at their tops', { len: [0.1, 2], r: [0.02, 0.2] }, [
      { id: 'pipe', prim: 'tube', role: 'outlet', r: 'r', sides: 8, from: [0, 0, 0], to: [0, '-r * 0.6', 'len'], group: 'tech:trim', value: 0.78 },
      { id: 'trumpet', prim: 'cone', role: 'outlet', r: 'r', r2: 'r * 1.8', h: 'r * 1.8', sides: 10, at: [0, '-r * 0.6', 'len'], group: 'tech:trim', value: 0.86 },
    ], ['pipe'], 'pipe', 'part') }),
  sidepipes: row({ family: 'exhaust', fits: { silhouette: { needle: 1.5, wedge: 1 }, archetype: { outlaw: 1.5, lover: 0.5 }, motif: { spiked: 0.5 } }, mount: 'stacks', size: { len: 'max(0.3, stackY - tailY + 0.2)', r: 'D * 0.07', out: 'W - stackX + D * 0.12', drop: 'stackZ - deck * 0.55' }, fx: { tip: [['out', '-len', '-drop'], [0, -1, 0]] },
    block: B('sidepipes', 'side pipes: out of the flank and along it, past the tail', { len: [0.1, 3], r: [0.02, 0.2], out: [-0.5, 1.5], drop: [-1, 1] }, [
      { id: 'out', prim: 'tube', role: 'outlet', r: 'r', sides: 8, from: [0, 0, 0], to: ['out', '-r * 2', '-drop'], group: 'tech:trim', value: 0.75 },
      { id: 'run', prim: 'tube', role: 'outlet', r: 'r * 1.15', sides: 8, from: ['out', '-r * 2', '-drop'], to: ['out', '-len', '-drop'], group: 'tech:trim', value: 0.8 },
    ], ['run'], 'run', 'part') }),

  // aero on the deck at the tail
  wing: row({ family: 'aero', fits: { era: { modern: 1.5, future: 1 }, silhouette: { wedge: 1, tub: 0.5 }, archetype: { hero: 0.5, explorer: 0.5 } }, mount: 'deck', at: [0, 'tailY - deckY + D * 0.12', 0], size: { w: 'T - wR * 0.4', h: 'head * 1.1', c: 'D * 0.42' },
    block: B('wing', 'a rear wing on two struts, end plates at its tips', { w: [0.43, 3], h: [0.16, 1.2], c: [0.15, 1] }, [
      { id: 'struts', prim: 'box', role: 'frame', size: [0.04, 'c * 0.4', 'h'], at: ['-w * 0.22', 0, 0], repeat: { n: 2, step: ['w * 0.44', 0, 0] }, group: 'tech:frame', value: 0.35 },
      { id: 'plane', prim: 'panel', role: 'body', size: ['w', 'c'], t: 0.04, at: [0, 0, 'h'], aim: [0, -0.25, 1], group: 'tech:skin', value: 0.7 },
      { id: 'plates', prim: 'panel', role: 'trim', size: ['c * 1.1', 'c * 0.7'], t: 0.03, at: ['-w / 2', 0, 'h'], aim: [1, 0, 0], repeat: { n: 2, step: ['w', 0, 0] }, group: 'tech:body', value: 0.6 },
    ], ['plane'], 'plane', 'part') }),
  ducktail: row({ family: 'aero', fits: { era: { classic: 1.5, vintage: 0.5 }, silhouette: { bell: 1, brick: 1, barrel: 1, bubble: 1 }, motif: { smooth: 0.5 } }, mount: 'deck', at: [0, 'tailY - deckY + D * 0.1', 0], size: { w: 'W * 1.4', c: 'D * 0.28' },
    block: B('ducktail', 'a ducktail: the deck kicked up at the tail', { w: [0.3, 3], c: [0.1, 1] }, [
      { id: 'lip', prim: 'panel', role: 'body', size: ['w', 'c'], t: 0.05, at: [0, 0, 'c * 0.2'], aim: [0, -0.6, 0.8], group: 'tech:body', value: 0.62 },
    ], ['lip'], 'lip', 'part') }),

  // noses
  bumper: row({ family: 'nose', fits: { era: { classic: 1, vintage: 1 }, archetype: { everyman: 1, caregiver: 0.5 } }, mount: 'nose', size: { w: 'max(Tf - wF * 1.4, W * 1.2)', r: 'D * 0.05' },
    block: B('bumper', 'a bumper bar across the nose on two stays', { w: [0.3, 3], r: [0.02, 0.15] }, [
      { id: 'bar', prim: 'tube', role: 'armour', r: 'r', sides: 8, from: ['-w / 2', 'r * 4', 0], to: ['w / 2', 'r * 4', 0], group: 'tech:trim', value: 0.85 },
      { id: 'stays', prim: 'tube', role: 'frame', r: 'r * 0.6', sides: 6, from: ['-w * 0.25', 0, 0], to: ['-w * 0.25', 'r * 4', 0], group: 'tech:frame', value: 0.35 },
      { id: 'stays2', prim: 'tube', role: 'frame', r: 'r * 0.6', sides: 6, from: ['w * 0.25', 0, 0], to: ['w * 0.25', 'r * 4', 0], group: 'tech:frame', value: 0.35 },
    ], ['bar'], 'bar', 'part') }),
  ram: row({ family: 'nose', fits: { motif: { spiked: 3 }, archetype: { outlaw: 1.5, hero: 0.5 } }, mount: 'nose', size: { r: 'D * 0.14', l: 'D * 0.5' },
    block: B('ram', 'a ram: a plate across the nose and a spike out of it', { r: [0.06, 0.5], l: [0.15, 1.2] }, [
      { id: 'plate', prim: 'panel', role: 'armour', size: ['r * 4', 'r * 2'], t: 0.05, at: [0, 0.03, 0], aim: [0, 1, 0], group: 'tech:frame', value: 0.4 },
      { id: 'spike', prim: 'tube', role: 'weapon', r: 'r * 0.5', sides: 6, from: [0, 0, 0], to: [0, 'l', 0], group: 'tech:trim', value: 0.82 },
    ], ['plate'], 'plate', 'part') }),
  pillow: row({ family: 'nose', fits: { archetype: { innocent: 2, caregiver: 2, jester: 1 }, motif: { smooth: 1, organic: 0.5 } }, mount: 'nose', size: { w: 'W * 1.5', r: 'D * 0.13' },
    block: B('pillow', 'a soft round bumper wrapped across the nose', { w: [0.3, 3], r: [0.04, 0.4] }, [
      { id: 'roll', prim: 'drum', role: 'armour', axis: 'x', r: 'r', h: 'w', sides: 12, at: ['-w / 2', 'r * 0.6', 0], group: 'tech:skin', value: 0.75 },
    ], ['roll'], 'roll', 'part') }),
  grille: row({ family: 'nose', fits: { silhouette: { bell: 1.5, brick: 1.5, barrel: 1 }, era: { vintage: 1, classic: 1 }, archetype: { ruler: 1, sage: 1 }, motif: { ornate: 1 } }, mount: 'nose', size: { w: 'W * 0.9', h: 'deck * 0.42' },
    block: B('grille', 'an upright grille: a framed panel of bars', { w: [0.2, 2], h: [0.1, 1] }, [
      { id: 'frame', prim: 'panel', role: 'trim', size: ['w', 'h'], t: 0.05, at: [0, 0.02, 0], aim: [0, 1, 0], group: 'tech:trim', value: 0.85 },
      { id: 'bars', prim: 'panel', role: 'trim', size: ['max(0.1, w * 0.08)', 'max(0.1, h * 0.86)'], t: 0.03, at: ['-w * 0.36', 0.05, 0], aim: [0, 1, 0], repeat: { n: 5, step: ['w * 0.18', 0, 0] }, group: 'tech:frame', value: 0.3 },
    ], ['frame'], 'frame', 'part') }),

  // lamps: the head lamps on the nose (fx: head), the tail lamps on the tail (fx: brake)
  eyes: row({ family: 'lamps', fits: { era: { modern: 1, classic: 1 }, archetype: { innocent: 1.5, jester: 1, caregiver: 1 }, silhouette: { bubble: 1, barrel: 1, tub: 1 } }, mount: 'bonnet', mirror: true, size: { r: 'D * 0.13' }, fx: { head: [[0, 'r * 0.6', 'r'], [0, 1, 0]] },
    block: B('eyes', 'a big round lamp like an eye, its glass bright', { r: [0.05, 0.4] }, [
      { id: 'bezel', prim: 'drum', role: 'frame', axis: 'y', r: 'r', h: 'r * 0.5', sides: 12, at: [0, 0, 'r'], group: 'tech:trim', value: 0.8 },
      { id: 'glass', prim: 'drum', role: 'lamp', axis: 'y', r: 'r * 0.78', h: 'max(0.02, r * 0.12)', sides: 12, at: [0, 'r * 0.5', 'r'], group: 'tech:light', value: 0.95 },
    ], ['bezel'], 'bezel', 'part') }),
  stalks: row({ family: 'lamps', fits: { era: { vintage: 3, classic: 1 }, archetype: { sage: 1, ruler: 0.5 } }, mount: 'bonnet', mirror: true, size: { r: 'D * 0.1', h: 'D * 0.22' }, fx: { head: [[0, 'r * 0.7', 'h + r'], [0, 1, 0]] },
    block: B('stalks', 'a round lamp on a stalk', { r: [0.06, 0.3], h: [0.11, 0.6] }, [
      { id: 'stalk', prim: 'tube', role: 'frame', r: 'r * 0.18', sides: 6, from: [0, 0, 0], to: [0, 0, 'h'], group: 'tech:frame', value: 0.35 },
      { id: 'bowl', prim: 'drum', role: 'frame', axis: 'y', r: 'r', h: 'r * 0.7', sides: 12, at: [0, '-r * 0.2', 'h + r'], group: 'tech:trim', value: 0.82 },
      { id: 'glass', prim: 'drum', role: 'lamp', axis: 'y', r: 'r * 0.8', h: 'max(0.02, r * 0.1)', sides: 12, at: [0, 'r * 0.5', 'h + r'], group: 'tech:light', value: 0.95 },
    ], ['bowl'], 'bowl', 'part') }),
  lightbar: row({ family: 'lamps', fits: { era: { future: 3, modern: 0.5 }, archetype: { creator: 1, magician: 0.5 }, motif: { faceted: 0.5 } }, mount: 'nose', size: { w: 'W * 1.4', h: 'D * 0.07' }, fx: { head: [[0, 0.04, 0], [0, 1, 0]] },
    block: B('lightbar', 'a light bar across the face', { w: [0.2, 3], h: [0.1, 0.3] }, [
      { id: 'bar', prim: 'panel', role: 'lamp', size: ['w', 'h'], t: 0.04, at: [0, 0.02, 0], aim: [0, 1, 0], group: 'tech:light', value: 0.95 },
    ], ['bar'], 'bar', 'part') }),
  taillamps: row({ family: 'tail', fits: {}, mount: 'tail', mirror: true, size: { w: 'D * 0.2', h: 'D * 0.12' }, fx: { brake: [[0, -0.03, 0], [0, -1, 0]] },
    block: B('taillamps', 'a tail lamp: the brake light', { w: [0.15, 0.6], h: [0.11, 0.4] }, [
      { id: 'lens', prim: 'panel', role: 'lamp', size: ['w', 'h'], t: 0.04, at: [0, -0.02, 0], aim: [0, -1, 0], group: 'tech:light', value: 0.5 },
    ], ['lens'], 'lens', 'part') }),

  // the cockpit
  bucket: row({ family: 'seat', fits: { archetype: { hero: 0.5, outlaw: 0.5, explorer: 0.5, jester: 0.5, lover: 0.5, innocent: 0.5, everyman: 0.5, caregiver: 0.5, creator: 0.5 } }, mount: 'seat', size: { w: 'hipW * 2.3', h: 'torso * 0.7' },
    block: B('bucket', 'a bucket seat: a pan and a back that hugs', { w: [0.15, 1.2], h: [0.1, 1.2] }, [
      { id: 'pan', prim: 'box', role: 'body', size: ['w', 'w * 0.8', 0.08], at: [0, 'w * 0.2', -0.08], group: 'tech:frame', value: 0.3 },
      { id: 'back', prim: 'box', role: 'body', size: ['w', 0.1, 'h'], at: [0, '-w * 0.22', -0.06], group: 'tech:frame', value: 0.32 },
    ], ['back'], 'back', 'part') }),
  throne: row({ family: 'seat', fits: { archetype: { ruler: 3, sage: 1.5, magician: 1 }, motif: { ornate: 1 } }, mount: 'seat', size: { w: 'hipW * 2.6', h: 'torso * 1.25' },
    block: B('throne', 'a throne: a tall back above the head, a crest at its top', { w: [0.15, 1.4], h: [0.1, 2] }, [
      { id: 'pan', prim: 'box', role: 'body', size: ['w', 'w * 0.8', 0.1], at: [0, 'w * 0.2', -0.1], group: 'tech:skin', value: 0.55 },
      { id: 'back', prim: 'box', role: 'body', size: ['w', 0.12, 'h'], at: [0, '-w * 0.22', -0.08], group: 'tech:skin', value: 0.6 },
      { id: 'crest', prim: 'cone', role: 'trim', r: 'w * 0.18', r2: 0, h: 'w * 0.3', sides: 4, at: [0, '-w * 0.22', 'h - 0.08'], group: 'tech:trim', value: 0.85 },
    ], ['back'], 'back', 'part') }),
  wheelset: row({ family: 'steering', fits: {}, mount: 'dash', size: { r: 'max(0.1, head * 0.42)' },
    block: B('wheelset', 'a steering wheel on its column', { r: [0.1, 0.4] }, [
      { id: 'rim', prim: 'ring', role: 'grip', axis: 'y', r: 'r', tube: 'max(0.02, r * 0.12)', sides: 12, group: 'tech:frame', value: 0.3 },
      { id: 'column', prim: 'tube', role: 'frame', r: 0.02, sides: 5, from: [0, 0, 0], to: [0, 'r * 2', '-r * 1.2'], group: 'tech:frame', value: 0.3 },
    ], ['rim'], 'rim', 'part') }),
  hoop: row({ family: 'cockpit', fits: { cockpit: { canopy: 3, closed: 3 } }, mount: 'seat', size: { w: 'hipW * 3.2', h: 'torso + head * 1.1', s: 'torso * 0.55' },
    block: B('hoop', 'a roll hoop over the driver and a windscreen before them', { w: [0.28, 1.6], h: [0.3, 2], s: [0.11, 1] }, [
      { id: 'hoop', prim: 'arm', role: 'frame', r: 0.035, at: ['-w / 2', '-w * 0.3', 0], segs: ['h', 'w', 'h'], bend: [0, 90, 90], turn: 0, group: 'tech:trim', value: 0.8 },
      { id: 'screen', prim: 'panel', role: 'shell', size: ['w * 0.8', 's'], t: 0.02, at: [0, 's * 1.5', 's * 0.9'], aim: [0, 0.7, 0.7], group: 'tech:glass', value: 0.5 },
    ], ['hoop'], 'hoop', 'part') }),
  wings: row({ family: 'fender', fits: { era: { vintage: 3, classic: 1 }, silhouette: { bell: 1 } }, mount: 'hub', size: { r: 'rw', w: 'ww * 1.3' },
    block: B('wings', 'a cycle wing: a guard arched over the tyre', { r: [0.16, 1.2], w: [0.11, 1] }, [
      { id: 'top', prim: 'panel', role: 'shell', size: ['w', 'r * 0.9'], t: 0.03, at: [0, 0, 'r * 2.12'], aim: [0, 0, 1], group: 'tech:body', value: 0.65 },
      { id: 'front', prim: 'panel', role: 'shell', size: ['w', 'r * 0.7'], t: 0.03, at: [0, 'r * 0.72', 'r * 1.75'], aim: [0, 0.75, 0.66], group: 'tech:body', value: 0.62 },
      { id: 'back', prim: 'panel', role: 'shell', size: ['w', 'r * 0.7'], t: 0.03, at: [0, '-r * 0.72', 'r * 1.75'], aim: [0, -0.75, 0.66], group: 'tech:body', value: 0.62 },
    ], ['top'], 'top', 'part') }),

  // boosters: a nozzle at the tail (fx: boost)
  rocket: row({ family: 'booster', fits: { era: { future: 2 }, archetype: { jester: 1.5, creator: 1.5, magician: 1 } }, mount: 'tail', size: { r: 'D * 0.16', l: 'D * 0.55' }, fx: { boost: [[0, '-l - r * 0.4', 0], [0, -1, 0]] },
    block: B('rocket', 'a rocket: a fat tube along the tail, a flared nozzle out of it', { r: [0.07, 0.5], l: [0.16, 1.6] }, [
      { id: 'tube', prim: 'drum', role: 'source', axis: 'y', r: 'r', h: 'l', sides: 12, at: [0, '-l', 0], group: 'tech:trim', value: 0.75 },
      { id: 'nozzle', prim: 'drum', role: 'outlet', axis: 'y', r: 'r * 1.25', h: 'r * 0.5', sides: 12, at: [0, '-l - r * 0.4', 0], group: 'tech:frame', value: 0.32 },
      { id: 'band', prim: 'drum', role: 'trim', axis: 'y', r: 'r * 1.05', h: 'r * 0.3', sides: 12, at: [0, '-l * 0.5', 0], group: 'tech:skin', value: 0.7 },
    ], ['tube'], 'tube', 'part') }),

  // hero pieces: the archetype's one exaggerated feature, worn in the accent
  crest: row({ family: 'hero', fits: { archetype: { ruler: 3 } }, mount: 'bonnet', size: { r: 'D * 0.16' },
    block: B('crest', 'a crown on the bonnet: a band and its points', { r: [0.08, 0.6] }, [
      { id: 'band', prim: 'drum', role: 'trim', r: 'r', h: 'r * 0.5', sides: 10, group: 'str:paint', value: 0.8 },
      { id: 'points', prim: 'cone', role: 'trim', r: 'r * 0.28', r2: 0, h: 'r * 0.7', sides: 4, at: ['r * 0.75', 0, 'r * 0.5'], repeat: { n: 5, around: 'r * 0.75' }, group: 'str:paint', value: 0.85 },
    ], ['band'], 'band', 'part') }),
  orb: row({ family: 'hero', fits: { archetype: { sage: 3, magician: 2 } }, mount: 'mast', size: { h: 'head * 2.6', r: 'D * 0.12' }, moves: ['wobble'],
    block: B('orb', 'an orb on a crooked mast', { h: [0.28, 2.5], r: [0.06, 0.5] }, [
      { id: 'mast', prim: 'tube', role: 'frame', r: 'r * 0.18', sides: 6, from: [0, 0, 0], to: [0, '-r', 'h'], group: 'tech:frame', value: 0.4 },
      { id: 'orb', prim: 'lamp', role: 'lamp', r: 'r', at: [0, '-r', 'h - r * 0.2'], group: 'str:paint', value: 0.9 },
    ], ['orb'], 'orb', 'part') }),
  blade: row({ family: 'hero', fits: { archetype: { hero: 3, explorer: 1 } }, mount: 'deck', at: [0, 'tailY - deckY + D * 0.15', 0], size: { l: 'L * 0.4', h: 'head * 2' },
    block: B('blade', 'a dorsal fin: a blade rising along the tail', { l: [0.2, 3], h: [0.1, 2] }, [
      { id: 'fin', prim: 'fin', role: 'body', l: 'l', h: 'h', t: 0.05, yaw: -90, group: 'str:paint', value: 0.7 },
    ], ['fin'], 'fin', 'part') }),
  horns: row({ family: 'hero', fits: { archetype: { outlaw: 3, jester: 0.5 } }, mount: 'bonnet', mirror: true, size: { r: 'D * 0.07', l: 'D * 0.5' },
    block: B('horns', 'a steer\'s horn on the bonnet, swept out and up', { r: [0.02, 0.3], l: [0.1, 1.4] }, [
      { id: 'root', prim: 'tube', role: 'weapon', r: 'r', sides: 6, from: [0, 0, 0], to: ['l * 0.6', 'l * 0.2', 'l * 0.15'], group: 'str:paint', value: 0.8 },
      { id: 'tip', prim: 'tube', role: 'weapon', r: 'r * 0.55', sides: 6, from: ['l * 0.6', 'l * 0.2', 'l * 0.15'], to: ['l', 'l * 0.3', 'l * 0.55'], group: 'str:paint', value: 0.85 },
    ], ['root'], 'root', 'part') }),
  shield: row({ family: 'hero', fits: { archetype: { caregiver: 3, everyman: 1 } }, mount: 'nose', size: { r: 'D * 0.24' },
    block: B('shield', 'a round shield on the nose: an emblem with a boss', { r: [0.08, 0.8] }, [
      { id: 'disc', prim: 'drum', role: 'armour', axis: 'y', r: 'r', h: 0.05, sides: 14, at: [0, 0.02, 0], group: 'str:paint', value: 0.72 },
      { id: 'boss', prim: 'drum', role: 'trim', axis: 'y', r: 'r * 0.3', h: 0.06, sides: 10, at: [0, 0.07, 0], group: 'tech:trim', value: 0.88 },
    ], ['disc'], 'disc', 'part') }),
  flag: row({ family: 'hero', fits: { archetype: { explorer: 3, everyman: 0.5 } }, mount: 'mast', size: { h: 'head * 3', w: 'D * 0.6' }, moves: ['wobble'],
    block: B('flag', 'a pennant on a whip mast', { h: [0.3, 3], w: [0.1, 1.2] }, [
      { id: 'mast', prim: 'tube', role: 'frame', r: 0.018, sides: 5, from: [0, 0, 0], to: [0, 0, 'h'], group: 'tech:frame', value: 0.4 },
      { id: 'pennant', prim: 'fin', role: 'trim', l: 'w', h: 'w * 0.5', t: 0.02, yaw: -90, at: [0, 0, 'h - w * 0.5'], group: 'str:paint', value: 0.75 },
    ], ['pennant'], 'pennant', 'part') }),
  heart: row({ family: 'hero', fits: { archetype: { lover: 3 } }, mount: 'bonnet', size: { r: 'D * 0.12' },
    block: B('heart', 'a heart on the bonnet: two round lobes and a point', { r: [0.04, 0.5] }, [
      { id: 'lobes', prim: 'drum', role: 'trim', axis: 'y', r: 'r', h: 'r * 0.6', sides: 12, at: ['-r * 0.7', '-r * 0.3', 'r * 1.6'], repeat: { n: 2, step: ['r * 1.4', 0, 0] }, group: 'str:paint', value: 0.75 },
      { id: 'point', prim: 'cone', role: 'trim', r: 'r * 1.3', r2: 'r * 1.7', h: 'r * 1.5', sides: 4, at: [0, 0, 0.0], group: 'str:paint', value: 0.72 },
    ], ['lobes'], 'lobes', 'part') }),
  propeller: row({ family: 'hero', fits: { archetype: { jester: 3, innocent: 1 } }, mount: 'mast', size: { h: 'head * 2.2', r: 'D * 0.3' }, moves: ['spin'],
    block: B('propeller', 'a propeller on a mast, turning in the wind', { h: [0.36, 2.5], r: [0.15, 1] }, [
      { id: 'mast', prim: 'tube', role: 'frame', r: 0.02, sides: 5, from: [0, 0, 0], to: [0, 0, 'h'], group: 'tech:frame', value: 0.4 },
      { id: 'blades', prim: 'box', role: 'source', size: ['r * 2', 'max(0.04, r * 0.22)', 0.04], at: [0, 0, 'h'], group: 'str:paint', value: 0.75 },
      { id: 'cap', prim: 'cone', role: 'trim', r: 'r * 0.14', r2: 0, h: 'r * 0.2', sides: 8, at: [0, 0, 'h + 0.03'], group: 'tech:trim', value: 0.85 },
    ], ['blades'], 'blades', 'part') }),
  antenna: row({ family: 'hero', fits: { archetype: { creator: 3, sage: 0.5 } }, mount: 'mast', size: { h: 'head * 3.2', r: 'D * 0.07' }, moves: ['wobble'],
    block: B('antenna', 'a whip antenna with a bright ball at its tip', { h: [0.42, 3.5], r: [0.04, 0.3] }, [
      { id: 'whip', prim: 'tube', role: 'sensor', r: 0.012, sides: 4, from: [0, 0, 0], to: [0, 0, 'h'], group: 'tech:frame', value: 0.4 },
      { id: 'ball', prim: 'lamp', role: 'lamp', r: 'r', at: [0, 0, 'h - r'], group: 'str:paint', value: 0.9 },
    ], ['ball'], 'ball', 'part') }),
  daisy: row({ family: 'hero', fits: { archetype: { innocent: 3 } }, mount: 'bonnet', size: { r: 'D * 0.13', h: 'D * 0.18' },
    block: B('daisy', 'a daisy on the bonnet: petals round a bright centre, on a short stem', { r: [0.06, 0.5], h: [0.07, 0.6] }, [
      { id: 'stem', prim: 'tube', role: 'frame', r: 0.02, sides: 5, from: [0, 0, 0], to: [0, 0, 'h'], group: 'tech:frame', value: 0.35 },
      { id: 'petals', prim: 'drum', role: 'trim', axis: 'y', r: 'r * 0.45', h: 0.03, sides: 8, at: ['r * 0.6', 0, 'h + r'], repeat: { n: 6, around: 'r * 0.6' }, group: 'str:paint', value: 0.9 },
      { id: 'centre', prim: 'drum', role: 'trim', axis: 'y', r: 'r * 0.4', h: 0.05, sides: 10, at: [0, 0.01, 'h + r'], group: 'tech:trim', value: 0.85 },
    ], ['petals'], 'petals', 'part') }),
  klaxon: row({ family: 'hero', fits: { archetype: { everyman: 3 } }, mount: 'bonnet', size: { r: 'D * 0.1', l: 'D * 0.45' },
    block: B('klaxon', 'a klaxon: a long horn with a bell mouth, pointing ahead', { r: [0.06, 0.4], l: [0.18, 1.4] }, [
      { id: 'horn', prim: 'tube', role: 'outlet', r: 'r * 0.4', sides: 8, from: [0, 0, 'r'], to: [0, 'l', 'r'], group: 'tech:trim', value: 0.85 },
      { id: 'bell', prim: 'drum', role: 'outlet', axis: 'y', r: 'r', h: 'r * 0.4', sides: 12, at: [0, 'l', 'r'], group: 'str:paint', value: 0.8 },
    ], ['bell'], 'bell', 'part') }),
});

/** The archetype's one hero piece (the outfit's FOCAL, read for a machine), and why. */
export const HERO_OF = Object.freeze({
  ruler: ['crest', 'the ruler\'s office on the bonnet: a crown'], sage: ['orb', 'the sage\'s light carried high'], magician: ['orb', 'the magician\'s focus over the machine'],
  hero: ['blade', 'the hero\'s fin: the line of the charge'], outlaw: ['horns', 'the outlaw\'s horns: the threat out front'], caregiver: ['shield', 'the caregiver\'s shield before the others'],
  explorer: ['flag', 'the explorer\'s pennant, to be found by'], innocent: ['daisy', 'the innocent\'s flower'], everyman: ['klaxon', 'the everyman\'s horn: here I come'],
  jester: ['propeller', 'the jester\'s propeller, turning for the joke'], lover: ['heart', 'the lover\'s heart worn on the bonnet'], creator: ['antenna', 'the creator\'s antenna, listening'],
});
export const FAMILIES = Object.freeze(['body', 'wheel', 'engine', 'exhaust', 'aero', 'nose', 'lamps', 'tail', 'seat', 'steering', 'cockpit', 'fender', 'booster', 'hero']);
