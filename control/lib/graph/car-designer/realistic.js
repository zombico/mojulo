/**
 * THE REALISTIC POLE COMPILED: a vehicle sheet (sheet.js) whose pole is `realistic` → a vehicle at its class's true
 * numbers, in metres. The body is LOFTED from them (roads/fleet.js: length, width, height, wheelbase, track and wheel
 * radius, round wheels), never stretched: the vehicle designer's parts have toy proportions (its sedan about 2.7 times
 * as long as it is tall where a midsize is 3.4), and stretching per axis would squash the wheels. The sheet's
 * vehicle-designer words still decide the look, read as the loft's style:
 *
 *   body = …       the side profile (PROFILES: where the bonnet ends, the roof starts and stops, the deck, the belt)
 *   bodyplan = …   a truck's or a bus's (the fleet's straight truck, tractor-trailer, bus)
 *   wheel = …      the hub (HUBS: a wire wheel's small bright centre, a steelie's cap, an alloy's wide face)
 *   lights = …     the lamps (round, rect, a bar)
 *   era            the body's LANGUAGE (roads/bodywork.js, ERA_LANGUAGE): the road today's rounded plan, crowned roof,
 *                  raked glass and wrapping lamps for a modern sheet, further for a future one; a classic or vintage
 *                  sheet keeps the fleet's three-box (slab sides, upright glass); a faceted motif draws it crisper
 *   proportion.rideHeight ±, proportion.wheelScale +   a lift (or a drop) and bigger tyres, within REALISTIC_BAND;
 *                  every other proportion is held at the class (the realistic pole is true to it)
 *   livery.* / livery facet / wear facet   the paint: a second colour on the roof, stripes, a number, a patched panel
 *   physics.*      read in the readout only: a realistic vehicle drives its class's own row (roads/vehicles.js)
 *
 *   compileRealistic(sheet, { keys? }) → { spec, faces: { root, wheels: [{ bone, faces, hub }] }, figure, census,
 *                                          rule, envelope, reads }
 *   realisticCensus(compiled)           → measured bounds, wheelbase, track and wheel radius against the class
 *
 * The figure is the browser's rig-figure (vehicle-designer/vehicle-rig.js packVehicleFigure): the hull the root, each
 * wheel its own bone, turning in the `roll` clip; vehicle space (+y forward). Pure and deterministic.
 */
import { buildVehicle, FLEET, PAINTS } from '../roads/fleet.js';
import { bodyShape } from '../roads/bodywork.js';
import { VEHICLES, vehicleRule, envelope } from '../roads/vehicles.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { readDerive } from './channels.js';
import { HEAVY } from './facets.js';
import { mulberry32 } from '../vegetation/grow.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (n) => Math.round(n * 1e4) / 1e4 + 0;

/** Side profiles by body family: stations as fractions of the length from the nose (where the bonnet ends, the roof
 *  starts and stops, the deck starts) and heights as fractions of the class's height (bonnet, deck, belt). The fleet's
 *  measured classes are their sources (a midsize a three-box sedan); a two-box hatch's roof runs on to a short tailgate
 *  (the fleet's compact is drawn as a sedan, a three-box at traffic distance). */
export const PROFILES = Object.freeze({
  sedanThree:   { kind: 'car', hood: 0.28, roofA: 0.44, roofB: 0.72, deck: 0.85, zHood: 0.556, zDeck: 0.694, zBelt: 0.653 },
  wagonTwo:     { kind: 'car', hood: 0.28, roofA: 0.44, roofB: 0.83, deck: 0.96, zHood: 0.55, zDeck: 0.74, zBelt: 0.65 },
  coupeThree:   { kind: 'car', hood: 0.32, roofA: 0.48, roofB: 0.7, deck: 0.86, zHood: 0.54, zDeck: 0.7, zBelt: 0.66 },
  crossoverTwo: { kind: 'car', hood: 0.25, roofA: 0.4, roofB: 0.86, deck: 0.97, zHood: 0.58, zDeck: 0.77, zBelt: 0.64 },
  fastbackEV:   { kind: 'car', hood: 0.26, roofA: 0.42, roofB: 0.66, deck: 0.95, zHood: 0.55, zDeck: 0.66, zBelt: 0.64 },
  sleekEV:      { kind: 'car', hood: 0.24, roofA: 0.4, roofB: 0.62, deck: 0.96, zHood: 0.52, zDeck: 0.62, zBelt: 0.62 },
  vanOne:       { kind: 'box', hood: 0.12, roofA: 0.22, roofB: 1, deck: 1, zHood: 0.45, zDeck: 1, zBelt: 0.51 },
  truckCab:     { kind: 'pickup', hood: 0.24, roofA: 0.33, roofB: 0.55, deck: 0.6, zHood: 0.64, zDeck: 0.66, zBelt: 0.66 },
});
/** The heavy body plans: the fleet's own builds (a straight truck, a tractor with its trailer, a bus). */
const PLAN_KIND = Object.freeze({ straightTruck: 'straight', bus: 'bus', tractorTrailer: 'semi', tractorTrailerLoaded: 'semi' });
const BUS_PROFILE = Object.freeze({ hood: 0, roofA: 0.02, roofB: 1, deck: 1, zHood: 0.31, zDeck: 1, zBelt: 0.39 });
/** A wheel family's hub: its share of the wheel's radius and its fill. */
export const HUBS = Object.freeze({
  steelie:        { ratio: 0.42, hex: '#9ea2a6' },
  fiveSpokeAlloy: { ratio: 0.7, hex: '#c3c7cb', spokes: 5 },
  wireVintage:    { ratio: 0.78, hex: '#d9dcde' },
  heavyDuty:      { ratio: 0.5, hex: '#7d8186' },
});
const LAMPS = Object.freeze({ roundDuo: 'round', rectDuo: 'rect', barSingle: 'bar' });
/** An era's body language (roads/bodywork.js); absent, the fleet's own loft: the three-box of the 70s and 80s. */
export const ERA_LANGUAGE = Object.freeze({ modern: 'current', future: 'future' });
/** Body families that wear lower cladding in the language (the crossover's arches and sills, the pickup's). */
const CLAD = Object.freeze(['crossoverTwo', 'truckCab']);
/** How far a realistic vehicle may leave its class: a lift (or a drop) of the body over its wheels, as a share of its
 *  height, and bigger tyres, as a share of their radius. Every other proportion is the class's. */
export const REALISTIC_BAND = Object.freeze({ rideHeight: 0.06, wheelScale: 0.08 });
/** Open-frame classes: their bodies are the racer's (the technology builder's body plan), not a loft. */
export const OPEN_FRAME = Object.freeze(['kart', 'buggy', 'atv']);

/** The sheet's derives, flat: { family: word } and { 'family.key': '+' | '-' }. */
function readSheet(sheet) {
  const words = {}, dirs = {};
  for (const list of Object.values(sheet.derives)) for (const d of list) {
    const r = readDerive(d);
    if (r.dir) dirs[`${r.family}.${r.key}`] = r.dir;
    else if (!(r.family in words)) words[r.family] = r.word;
  }
  return { words, dirs };
}

/** The loft's spec: the class's numbers, the body family's profile, the lift and tyres the sheet asks, the style. */
export function realisticSpec(sheet) {
  if (sheet.pole !== 'realistic') throw new Error(`car-designer: compileRealistic reads a realistic sheet (this one is a ${sheet.pole}'s)`);
  const cls = sheet.facets.class, row = VEHICLES[cls];
  if (OPEN_FRAME.includes(cls)) throw new Error(`car-designer: a realistic ${cls} is an open frame: its body is the racer's body plan, not built yet`);
  const { words, dirs } = readSheet(sheet);
  // a lift (or a drop) and bigger tyres only when the stance was ASKED: the class's own stance is in its numbers already
  const asked = sheet.given.includes('stance');
  const lift = !asked ? 0 : dirs['proportion.rideHeight'] === '+' ? REALISTIC_BAND.rideHeight : dirs['proportion.rideHeight'] === '-' ? -REALISTIC_BAND.rideHeight / 2 : 0;
  const tyre = asked && dirs['proportion.wheelScale'] === '+' ? 1 + REALISTIC_BAND.wheelScale : 1;
  const style = { ...(words.wheel ? { hub: HUBS[words.wheel] } : {}), ...(words.lights ? { lamps: LAMPS[words.lights] } : {}) };
  const base = { L: row.L, W: row.W, H: row.H, wb: row.wheelbase, track: row.track, r: r3(row.wheelRadius * tyre), ...style };
  const planKind = PLAN_KIND[cls];
  if (planKind === 'bus') return { ...base, kind: 'bus', profile: absProfile(BUS_PROFILE, row.H), tyreW: 0.3, lift: 0 };
  if (planKind === 'straight' || planKind === 'semi') {
    const fleet = FLEET[cls === 'tractorTrailerLoaded' ? 'tractorTrailer' : cls];
    return { ...base, kind: planKind, ...(fleet.cab ? { cab: fleet.cab, cabH: fleet.cabH } : {}), ...(fleet.kingpin ? { kingpin: fleet.kingpin, trailerL: fleet.trailerL, cabH: fleet.cabH } : {}), lift: 0 };
  }
  const P = PROFILES[words.body] ?? PROFILES.sedanThree, language = ERA_LANGUAGE[sheet.facets.era];
  const lang = language ? { language, ...(CLAD.includes(words.body) ? { clad: true } : {}), ...(sheet.facets.motif === 'faceted' ? { crisp: true } : {}) } : {};
  return { ...base, kind: P.kind, profile: absProfile(P, row.H), body: words.body, lift: r3(lift * row.H), ...lang };
}
const absProfile = (P, H) => ({ hood: P.hood, roofA: P.roofA, roofB: P.roofB, deck: P.deck, zHood: r3(P.zHood * H), zDeck: r3(P.zDeck * H), zBelt: r3(P.zBelt * H) });

// the paint: a realistic vehicle's colour from the world's paints, by its seed; a second colour, stripes, a number,
// a patched panel, as its livery and wear facets ask (read off the faces the loft painted)
function paintFaces(paint, sheet, spec) {
  const rnd = mulberry32((sheet.seed * 2654435761 + 7) >>> 0), base = PAINTS[Math.floor(rnd() * PAINTS.length)], second = PAINTS[Math.floor(rnd() * PAINTS.length)];
  const hex = (c, k = 1) => `#${c.map((v) => Math.round(Math.min(1, v * k) * 255).toString(16).padStart(2, '0')).join('')}`;
  const { dirs } = readSheet(sheet), lv = sheet.facets.livery, worn = sheet.facets.wear === 'battered';
  const k = dirs['livery.primary'] === '+' ? 1.06 : dirs['livery.primary'] === '-' ? 0.82 : 1;
  const top = spec.profile ? spec.profile.zBelt + spec.lift : Infinity;
  return paint.map((f, i) => {
    const zc = f.corners.reduce((a, c) => a + c[2], 0) / f.corners.length;
    let c = hex(base, k), part = 'body';
    if (lv === 'two-tone' && zc > top + 0.05) { c = hex(second, k); part = 'roof'; }
    if (worn && i % 23 === 11) { c = hex(base, 0.62); part = 'patch'; }
    return { ...f, fill: shadeLike(f.fill, c), ...(f.cornerFills ? { cornerFills: f.cornerFills.map((x) => shadeLike(x, c)) } : {}), part };
  });
}
// keep the loft's baked light, carried to a new base colour: the face's own shade over the template paint's
function shadeLike(lit, base) {
  const P = 0xe9 / 255, l = parseInt(lit.slice(1, 3), 16) / 255 / P;
  const b = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  return `#${b.map((v) => Math.round(Math.min(255, v * l)).toString(16).padStart(2, '0')).join('')}`;
}

// a stripe down the centre line (the livery's accent) or a number disc on each door
function liveryMarks(sheet, spec) {
  const out = [], lv = sheet.facets.livery, R = (x, y, z) => [-y, x, z];   // the loft's +x forward → vehicle +y, its left → −x
  if (lv === 'striped' && spec.profile && spec.language) {
    // the stripe follows the roof's arc, from the screen's top to the rear glass's
    const B = bodyShape(spec), w = spec.W * 0.09, n = 8, at = (t) => B.A + (B.B - B.A) * t;
    for (const sy of [-1, 1]) for (let i = 0; i < n; i++) {
      const fa = at(i / n), fb = at((i + 1) / n), za = B.topAt(fa) + spec.lift + 0.012, zb = B.topAt(fb) + spec.lift + 0.012;
      out.push({ corners: [R(B.x(fa), sy * w * 0.6, za), R(B.x(fb), sy * w * 0.6, zb), R(B.x(fb), sy * w * 1.6, zb), R(B.x(fa), sy * w * 1.6, za)], fill: '#eceae3', part: 'stripe' });
    }
  } else if (lv === 'striped' && spec.profile) {
    const zt = spec.H + spec.lift + 0.012, w = spec.W * 0.09, x0 = spec.L / 2 - spec.profile.roofA * spec.L, x1 = spec.L / 2 - spec.profile.roofB * spec.L;
    for (const sy of [-1, 1]) out.push({ corners: [R(x0, sy * w * 0.6, zt), R(x1, sy * w * 0.6, zt), R(x1, sy * w * 1.6, zt), R(x0, sy * w * 1.6, zt)], fill: '#eceae3', part: 'stripe' });
  }
  if (lv === 'numbered') {
    const zc = (spec.profile ? spec.profile.zBelt * 0.7 : spec.H * 0.4) + spec.lift;
    for (const sy of [-1, 1]) out.push({ corners: Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * 2 * Math.PI; return R(0.25 * Math.cos(a), sy * (spec.W / 2 + 0.012), zc + 0.25 * Math.sin(a)); }), fill: '#f2f1ec', part: 'number' });
  }
  return out;
}

// a polygon of more than four corners as a fan of quads (and a closing triangle) from its first corner, its corner fills
// carried: the World's mesh draws a face's first four corners only, so a wheel's disc or an end cap would be clipped
function fan(faces) {
  return faces.flatMap((f) => {
    const n = f.corners.length;
    if (n <= 4) return [f];
    const out = [];
    for (let i = 1; i + 1 < n; i += 2) {
      const idx = i + 2 < n ? [0, i, i + 1, i + 2] : [0, i, i + 1];
      out.push({ ...f, corners: idx.map((j) => f.corners[j]), ...(f.cornerFills ? { cornerFills: idx.map((j) => f.cornerFills[j]) } : {}) });
    }
    return out;
  });
}

/** Compile a realistic sheet. */
export function compileRealistic(sheet, { keys = 12 } = {}) {
  const spec = realisticSpec(sheet), cls = sheet.facets.class;
  // the loft in vehicle space: the fleet builds +x forward; a quarter turn puts the nose on +y
  const wheels = [];
  const sink = (_call, side, x) => { const w = { side, x, faces: [] }; wheels.push(w); return w.faces; };
  const built = buildVehicle(cls, Math.PI / 2, { spec, wheels: sink });
  const lift = (f) => (spec.lift ? { ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + spec.lift]) } : f);
  const root = fan([...paintFaces(built.paint.map(lift), sheet, spec), ...built.trim.map(lift), ...built.trailer.map(lift), ...liveryMarks(sheet, spec)]);
  for (const w of wheels) w.faces.splice(0, w.faces.length, ...fan(w.faces));
  // the bones: axles ranked front to back by position (a trailer's are built by a call of their own); the front pair
  // the front wheels, the next pair the rear, any further axle its own pair
  const ranks = [...new Set(wheels.map((w) => r4(w.x)))].sort((a, b) => b - a);
  for (const w of wheels) w.axle = ranks.indexOf(r4(w.x));
  const name = (w) => { const lr = w.side > 0 ? 'L' : 'R'; return w.axle === 0 ? `wheelF${lr}` : w.axle === 1 ? `wheelR${lr}` : `wheel${w.axle + 1}${lr}`; };
  const boneWheels = wheels.map((w) => ({ bone: name(w), faces: w.faces, hub: [r4(-w.side * spec.track / 2), r4(w.x), r4(spec.r)] }));
  // normalised: x/y centred, the contact patches at z = 0 (the loft already stands on them)
  const all = [...root, ...boneWheels.flatMap((w) => w.faces)].flatMap((f) => f.corners);
  const ext = (i) => [Math.min(...all.map((c) => c[i])), Math.max(...all.map((c) => c[i]))];
  const [x0, x1] = ext(0), [y0, y1] = ext(1), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const N = (c) => [c[0] - cx, c[1] - cy, c[2]];
  const move = (fs) => fs.map((f) => ({ ...f, corners: f.corners.map(N) }));
  const bones = [{ id: 'root', head: [0, 0, 0] }, ...boneWheels.map((w) => ({ id: w.bone, head: N(w.hub).map(r4) }))];
  const buckets = new Map([['root', move(root)], ...boneWheels.map((w) => [w.bone, move(w.faces)])]);
  const axles = [...new Set(wheels.map((w) => w.x))].sort((a, b) => b - a);
  const figure = {
    ...packVehicleFigure(bones, buckets, { keys }),
    figH: r4(ext(2)[1]),
    wheelbase: r4(axles[0] - axles[1]),
    wheelRadius: r4(spec.r),
    warnings: [],
  };
  const compiled = { spec, faces: { root: move(root), wheels: boneWheels.map((w) => ({ ...w, faces: move(w.faces), hub: N(w.hub) })) }, figure, rule: vehicleRule(cls), envelope: envelope(cls), class: cls };
  return { ...compiled, census: realisticCensus(compiled) };
}

/** What was drawn, against the class: bounds (length along +y, width across x, height), wheelbase and track from the
 *  wheel bones' hubs, the wheels' drawn radius. */
export function realisticCensus(c) {
  const row = VEHICLES[c.class];
  const pts = [...c.faces.root, ...c.faces.wheels.flatMap((w) => w.faces)].flatMap((f) => f.corners);
  const span = (i) => Math.max(...pts.map((p) => p[i])) - Math.min(...pts.map((p) => p[i]));
  const hubs = c.faces.wheels.map((w) => w.hub), ys = [...new Set(hubs.map((h) => r4(h[1])))].sort((a, b) => b - a);
  // a wheel's radius: its tyre's vertices from its hub, in the wheel's own plane (a 12-gon's circumradius)
  const w0 = c.faces.wheels[0], wheelR = Math.max(...w0.faces.flatMap((f) => f.corners).map((p) => Math.hypot(p[1] - w0.hub[1], p[2] - w0.hub[2])));
  const ratio = (a, b) => r4(a / b);
  return {
    class: c.class,
    L: r3(span(1)), W: r3(span(0)), H: r3(Math.max(...pts.map((p) => p[2]))),
    wheelbase: r3(ys[0] - ys[1]), track: r3(Math.max(...hubs.map((h) => h[0])) - Math.min(...hubs.map((h) => h[0]))),
    wheelRadius: r3(wheelR),
    against: { L: ratio(span(1), row.L), W: ratio(span(0), row.W), H: ratio(Math.max(...pts.map((p) => p[2])), row.H + (c.spec.lift || 0)), wheelbase: ratio(ys[0] - ys[1], row.wheelbase), wheelRadius: ratio(wheelR, c.spec.r) },
    heavy: HEAVY.includes(c.class),
  };
}
