/**
 * links — where scapeshift meets playscape. Scapeshift makes the PLACE: its kits and style cards, its trails and rooms,
 * and the places in it that ask to be joined (an anchor: a trail's stairs site where the walk grew too steep, a pit, a
 * stream's crossing; a room's doorway). Playscape makes what HAPPENS there: a link is a VERB that joins two places, and
 * an entry that performs it. Scapeshift never imports playscape; playscape reads scapeshift's anchors, its kit tokens
 * and its laws, so one vocabulary runs through both:
 *
 *   LINK_VERBS                          walk, climb, cross, ride, launch, hop, drop: how the body gets from one to the other
 *   riseLinks(from, to, { rider })      every way between two levels that fits the rise and the room on the ground, with
 *                                       the entry that does it and how long it takes, quickest first
 *   linkStyle(kitId, seed, made)        a scapeshift kit's made tokens (era/out-made.js madeStyle) read as the words the
 *                                       entries take (timber, joint, edge) and the swatch each part is toned from later
 *   answerAnchor(anchor, { kit, seed, made, prefer, rider })
 *                                       a scapeshift anchor answered: { verb, entry, spec, object, others } — the object
 *                                       resolved in the kit's style, its laws measured, the other verbs that would also do
 *
 * The object laws judge how a link looks (laws.js); the man-made index's laws (era/out-made.js) and each entry's own
 * judge whether it stands and can be walked. Both advise; neither refuses. Values only: the swatch map is data for the
 * tone (era/tone.js), nothing here colours a face.
 */
import { madeStyle, MADE_RAILS } from '../era/out-made.js';
import { resolveObject } from './objects/index.js';
import { goingRange } from './objects/stairs.js';
import { endsOver } from './objects/bridge.js';
import { RIDER } from './objects/catapult.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5 + 0;
const Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

export const LINK_VERBS = Object.freeze({
  walk: 'the body never leaves its feet: a flight, steps, a ramp (entry stairs)',
  climb: 'hand over hand: a ladder, fixed rungs, a rope, a net (entry ladder)',
  cross: 'over a gap, level: a bridge (entry bridge)',
  ride: 'carried: a lift (entry lift)',
  launch: 'thrown: a catapult (entry catapult)',
  hop: 'a jump the walker already has: a lip within reach of its jump (no object)',
  drop: 'one way down: a fall the walker lands (no object)',
});

// the walker the platform rule makes by default: its jump's apex is how high a lip it can hop onto
const PLATFORM = { jumpSpeed: 8.5, gravity: 20, speed: 6, height: 1.8 };
const apexOf = (r) => (r.jumpSpeed * r.jumpSpeed) / (2 * r.gravity);
// the lip a body can hop: its apex less the body it has to bring over the edge (a hand's span), and the drop it lands
export const HOP_MARGIN = 0.35, SAFE_DROP = 3.5;

/**
 * Every way between two levels: `from` on one, `to` on the other (the lip, or the far side), and the room the ground
 * gives between them (their level distance). Each answer: { verb, entry, variant, seconds, oneWay, fits, why }, the
 * ones that fit first, quickest first. Stairs and ramps need their going's run; a lean ladder or a net a little; rungs,
 * a rope and a lift none; a hop a lip under the jump's apex; a drop only goes down.
 */
export function riseLinks(from, to, { rider = {} } = {}) {
  const R = { ...PLATFORM, ...rider }, up = to[2] >= from[2];
  const lo = up ? from : to, hi = up ? to : from, rise = r5(hi[2] - lo[2]), room = r5(Math.hypot(to[0] - from[0], to[1] - from[1]));
  const out = [], say = (verb, entry, variant, fits, seconds, why, extra = {}) => out.push({ verb, entry, variant, fits, seconds: r5(seconds), why, ...extra });
  for (const v of ['flight', 'steps', 'ramp']) {
    if (rise < 0.2) break;
    const g = goingRange(v, rise), run = room > g.max ? g.comfortable : Math.max(room, g.min);
    say('walk', 'stairs', v, room >= g.min - 1e-6, Math.hypot(run, rise) / { flight: 2.4, steps: 2.2, ramp: 4.5 }[v],
      room < g.min - 1e-6 ? `its going needs ${g.min} m at its steepest; there are ${room}` : room > g.max ? `its going, ${g.comfortable} m, laid in the middle of the ${room} m there` : `its going fitted to the ${room} m there`,
      { going: g });
  }
  if (rise >= 0.6) {
    say('climb', 'ladder', 'ladder', room >= rise / 4 - 1e-6 && rise <= 9, rise / 2.2 / Math.sin(Math.atan(4)) + 0.5, rise > 9 ? 'past 9 m a lean ladder is a fixed one' : `its foot stands ${r5(rise / 4)} m out (4:1)`);
    say('climb', 'ladder', 'rungs', true, rise / 2 + 0.5, rise > 6 ? 'caged: the rise is past 6 m' : 'up the face, no room needed');
    say('climb', 'ladder', 'rope', true, rise / 1.4 + 0.5, 'hung from the lip');
    say('climb', 'ladder', 'net', room >= rise / Math.tan((80 * Math.PI) / 180) - 1e-6 && rise <= 6, Math.hypot(rise, rise / Math.tan(Math.PI / 3)) / 1.2 + 0.5, rise > 6 ? 'a net past 6 m sags off its bar' : 'draped from the lip');
  }
  if (rise >= 2.1) say('ride', 'lift', 'ride', true, rise / 1.5 + 2, 'two stops: step on and it goes');
  const apex = apexOf(R);
  if (up) say('hop', null, null, rise <= apex - HOP_MARGIN, (2 * R.jumpSpeed) / R.gravity, `the jump's apex is ${r5(apex)} m; a lip up to ${r5(apex - HOP_MARGIN)} m is hopped`);
  if (up && rise > apex - HOP_MARGIN) say('launch', 'catapult', 'fixed', true, Math.sqrt((2 * (rise + 1)) / RIDER.gravity) * 2, 'thrown onto the lip: the catapult solves its power for the target');
  if (!up) say('drop', null, null, rise <= SAFE_DROP, Math.sqrt((2 * rise) / R.gravity), rise <= SAFE_DROP ? 'one way: a fall the walker lands' : `a ${rise} m fall is past a safe ${SAFE_DROP} m`, { oneWay: true });
  return out.map((l) => ({ oneWay: false, ...l })).sort((a, b) => Number(b.fits) - Number(a.fits) || a.seconds - b.seconds);
}

// which swatch role (era/out-made.js MADE_RAILS `swatch`) paints each part an entry names, for the tone later
export const PART_SWATCH = Object.freeze({
  timber: ['rails', 'rungs', 'horns', 'feet', 'pegs', 'notches', 'beam', 'bar', 'stakes', 'boards', 'cleats', 'planks', 'stringers', 'posts', 'braces', 'treads', 'risers', 'balusters', 'handrail', 'newels', 'landing', 'nosings', 'edging', 'deck', 'kerbs', 'trestles'],
  stone: ['chocks', 'abutments', 'piers', 'ring', 'crown', 'keystone', 'spandrels', 'parapets', 'coping', 'dentils', 'band', 'bank', 'pins'],
  rope: ['rope', 'wraps', 'tail', 'cords', 'knots', 'lip', 'lashings', 'footropes', 'handropes', 'suspenders'],
  paint: ['grabs', 'cage', 'brackets', 'collars'],
});
const SWATCH_OF = Object.fromEntries(Object.entries(PART_SWATCH).flatMap(([role, parts]) => parts.map((p) => [p, role])));

/** A scapeshift kit's made tokens, as the words the entries take, and its swatch roles. */
export function linkStyle(kitId, seed = 1, made) {
  const S = madeStyle(kitId, seed, made), T = S.tokens;
  const joint = T.joint === 'lashed' || T.joint === 'pegged' || T.joint === 'notched' ? T.joint : 'pegged';
  return {
    kit: kitId, seed, tokens: T,
    ladder: { timber: T.timber, joint },
    stairs: { edge: T.edge },
    // the bridge a kit builds by its joinery: lashed culm hangs a rope bridge, pegged or notched timber decks one
    bridge: { variant: T.joint === 'lashed' ? 'rope' : 'deck' },
    swatch: Object.fromEntries(Object.entries(S.swatch).map(([role, s]) => [role, s.ramp])),
  };
}

/** The parts of a resolved object, each with the swatch role and the kit's ramp that will tone it. */
export function partSwatches(object, style) {
  return Object.fromEntries((object.elements || []).map((p) => [p, SWATCH_OF[p] ? { role: SWATCH_OF[p], ramp: style ? style.swatch[SWATCH_OF[p]] ?? null : null } : null]));
}

// a stairs site's two ends: the site's middle, half its run each way along the trail, the rise split about it
function siteEnds(a) {
  const D = a.N ? [a.N[0], a.N[1], 0] : [0, 1, 0], half = (a.s1 - a.s0) / 2, h = Math.abs(a.rise) / 2, sg = a.rise >= 0 ? 1 : -1;
  return { from: add(add(a.at, mul(D, -half * sg)), mul(Z, -h)).map(r5), to: add(add(a.at, mul(D, half * sg)), mul(Z, h)).map(r5) };
}

/**
 * A scapeshift anchor answered. A trail's stairs site → the walk that fits its run (steps, a flight, a ramp), else a
 * climb; a pit → a crossing (a bridge over it) beside the hop it already is; a stream's crossing → a bridge over the
 * water; anything with two ends `{ from, to }` → riseLinks. `prefer` names a verb or an entry to take first when it
 * fits. The object comes back resolved in the kit's style, with its laws.
 */
export function answerAnchor(anchor, { kit, seed = 1, made, prefer, rider } = {}) {
  const style = kit && MADE_RAILS[kit] ? linkStyle(kit, seed, made) : null;
  const pick = (cands) => (prefer && cands.find((c) => c.fits && (c.verb === prefer || c.entry === prefer || c.variant === prefer))) || cands.find((c) => c.fits && c.entry) || null;
  const build = (c, ends) => {
    if (!c || !c.entry) return null;
    const flat = [ends.hi[0] - ends.lo[0], ends.hi[1] - ends.lo[1]], room = Math.hypot(...flat), D = room > 1e-6 ? [flat[0] / room, flat[1] / room] : [0, 1];
    const rise = r5(ends.hi[2] - ends.lo[2]);
    // a stair spans the ends when its going can be fitted to them, else lays its own going in the middle of them
    const stairEnds = () => {
      if (!c.going || room <= c.going.max) return { from: ends.lo, to: ends.hi };
      const m = (room - c.going.comfortable) / 2;
      return { from: [ends.lo[0] + D[0] * m, ends.lo[1] + D[1] * m, ends.lo[2]].map(r5), rise, facing: D };
    };
    const spec = c.entry === 'stairs' ? { entry: 'stairs', variant: c.variant, ...stairEnds(), ...(style ? style.stairs : {}) }
      // a ladder stands at the lip and sets its own foot (4:1): it does not lie along the whole way
      : c.entry === 'ladder' ? { entry: 'ladder', variant: c.variant, to: ends.hi, rise, facing: [-D[0], -D[1]], ...(style ? style.ladder : {}) }
      : c.entry === 'bridge' ? { entry: 'bridge', ...(c.variant ? { variant: c.variant } : style ? style.bridge : {}), ...ends.bridge }
      : c.entry === 'lift' ? { entry: 'lift', at: ends.lo, stops: [0, r5(ends.hi[2] - ends.lo[2])] }
      : c.entry === 'catapult' ? { entry: 'catapult', variant: 'fixed', at: ends.lo, target: ends.hi, dir: [ends.hi[0] - ends.lo[0], ends.hi[1] - ends.lo[1]] }
      : null;
    return spec;
  };
  let cands, ends;
  if (anchor.kind === 'site' && anchor.site === 'stairs') {
    const e = siteEnds(anchor), lo = e.from[2] <= e.to[2] ? e.from : e.to, hi = lo === e.from ? e.to : e.from;
    ends = { lo, hi };
    // a trail is walked: a walk before a climb wherever one fits, the trail's own outdoor steps first (as the man-made
    // index draws them), then the quickest
    cands = riseLinks(lo, hi, { rider }).filter((c) => c.verb !== 'drop' && c.verb !== 'hop' && c.verb !== 'launch');
    cands.sort((a, b) => Number(b.fits) - Number(a.fits) || Number(b.verb === 'walk') - Number(a.verb === 'walk') || Number(b.variant === 'steps') - Number(a.variant === 'steps') || a.seconds - b.seconds);
  } else if (anchor.kind === 'hazard' && (anchor.hazard === 'pit' || anchor.hazard === 'water')) {
    const E = endsOver(anchor);
    ends = { lo: E.from, hi: E.to, bridge: anchor.hazard === 'pit' ? { over: anchor } : { from: E.from, to: E.to, width: Math.min(E.width, 1.4) } };
    const span = Math.hypot(E.to[0] - E.from[0], E.to[1] - E.from[1]);
    cands = [
      { verb: 'cross', entry: 'bridge', variant: span < 2.5 ? 'plank' : null, fits: true, seconds: r5(span / PLATFORM.speed), why: `a ${r5(span)} m span`, oneWay: false },
      ...(anchor.hazard === 'pit' ? [{ verb: 'hop', entry: null, variant: null, fits: (anchor.jump ?? span) <= 3, seconds: r5((2 * PLATFORM.jumpSpeed) / PLATFORM.gravity), why: `the pit asks a ${anchor.jump ?? r5(span)} m jump`, oneWay: false }] : []),
      ...(anchor.hazard === 'water' ? [{ verb: 'walk', entry: null, variant: null, fits: (anchor.depth ?? 0) <= 0.6, seconds: r5(span / 1.5), why: `ford it: ${anchor.depth ?? '?'} m deep, slow`, oneWay: false }] : []),
    ];
  } else if (anchor.from && anchor.to) {
    const lo = anchor.from[2] <= anchor.to[2] ? anchor.from : anchor.to, hi = lo === anchor.from ? anchor.to : anchor.from;
    ends = { lo, hi };
    cands = riseLinks(anchor.from, anchor.to, { rider });
  } else {
    throw new Error(`links: an anchor answered is a trail's stairs site, a pit or water hazard, or anything with { from, to } (got kind '${anchor.kind}')`);
  }
  const c = pick(cands), spec = build(c, ends), object = spec ? resolveObject(spec) : null;
  return {
    anchor: anchor.id ?? null, verb: c ? c.verb : null, entry: c ? c.entry : null, variant: object ? object.variant : null, why: c ? c.why : 'nothing fits',
    spec, object, laws: object?.laws ?? [], swatches: object ? partSwatches(object, style) : {},
    others: cands.filter((x) => x !== c).map(({ verb, entry, variant, fits, seconds, why }) => ({ verb, entry, variant, fits, seconds, why })),
  };
}
