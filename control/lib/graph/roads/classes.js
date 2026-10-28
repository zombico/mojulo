/**
 * classes — a roadway's DESIGN CLASS: the scale it is designed at. One kernel (alignment.js) lays a freeway and a kart
 * track; the class says what "too tight", "too steep" and "flies over the crest" mean at its speed.
 *
 *   designSpeed  km/h a corner and a crest are sized for (the class's quick driver, not its top speed)
 *   rmin         m, the tightest corner at e_max (freeway: TAC at 120 km/h; the rest: hairpins their cars take)
 *   rmax         m, the widest corner a designer draws for it (a corner, not a sweeper)
 *   emax         superelevation cap (rise over run across the road)
 *   crestK/sagK  m per % of grade change: the vertical curve's length is K·|A|. Freeway: AASHTO sight distance at
 *                120 km/h. The rest: no unintended air at the design speed (a crest of radius 100·K flies when
 *                v² > g·100·K), sags within 0.3 g
 *   gradeMax     steepest grade a hill climbs in the class (ramps are measured on their own)
 *   roadW        m, the road band's width (freeway: a lane; its template sums the rest)
 *   footprint    m, barrier to barrier (road, kerbs, run-off, barriers: track.js TRACK_TEMPLATES sums to it), what two
 *                legs of a lap must keep apart and a crossing's deck must span
 *   clearance    m under a crossing structure (freeway: MTO 5.0 + 0.15 resurfacing)
 *   spiral(R)    a curve's transition length at radius R
 *
 * Sources: freeway as the spike's reference sheet ([S] / [K]); kart, circuit, rally and stadium are [E], game-design
 * floors from what those cars take (rental and sprint karts, a GP hairpin, a gravel special stage, a Race of Champions'
 * lanes between concrete walls), not a standard.
 */

const G = 9.81;
const kmh = (v) => v / 3.6;
// the crest K at which a car at v km/h just stays down (vertical radius v²/g), and a sag's at 0.3 g
const noAirK = (v) => Math.ceil((kmh(v) ** 2 / G) / 100 * 10) / 10;
const sagK = (v) => Math.ceil((kmh(v) ** 2 / (0.3 * G)) / 100 * 10) / 10;
const clampTo = (lo, hi) => (x) => Math.max(lo, Math.min(hi, x));

export const DESIGN_CLASSES = Object.freeze({
  kart: Object.freeze({ designSpeed: 70, rmin: 8, rmax: 40, emax: 0.05, crestK: noAirK(70), sagK: sagK(70), gradeMax: 0.08, roadW: 8, footprint: 19.8, clearance: 3.2, spiral: (R) => clampTo(3, 12)(R / 2) }),
  circuit: Object.freeze({ designSpeed: 160, rmin: 15, rmax: 250, emax: 0.10, crestK: noAirK(160), sagK: sagK(160), gradeMax: 0.12, roadW: 12, footprint: 31, clearance: 4.5, spiral: (R) => clampTo(8, 60)(R / 3) }),
  rally: Object.freeze({ designSpeed: 110, rmin: 10, rmax: 120, emax: 0.04, crestK: noAirK(110), sagK: sagK(110), gradeMax: 0.15, roadW: 7, footprint: 12, clearance: 4.5, spiral: (R) => clampTo(4, 30)(R / 3) }),
  // a stadium's track (a Race of Champions'): two lanes side by side inside a bowl, walls at the road's edge, no run-off,
  // a crossover bridge steeper than a circuit's
  stadium: Object.freeze({ designSpeed: 80, rmin: 8, rmax: 40, emax: 0.03, crestK: noAirK(80), sagK: sagK(80), gradeMax: 0.12, roadW: 8, footprint: 10, clearance: 3.2, spiral: (R) => clampTo(3, 10)(R / 2) }),
  freeway: Object.freeze({ designSpeed: 120, rmin: 750, rmax: 3000, emax: 0.06, crestK: 95, sagK: 63, gradeMax: 0.05, roadW: 3.75, clearance: 5.15, spiral: (R) => Math.max(60, Math.round(R / 6)) }),
});

/** The class by name; an unknown name is refused with the list (a reading error, not a design one). */
export function designClass(name) {
  const c = DESIGN_CLASSES[name];
  if (!c) throw new Error(`roadway: class '${name}' is not one of ${Object.keys(DESIGN_CLASSES).join(', ')}`);
  return c;
}

/** The speed (m/s) over which a crest of vertical curve K lifts a car off (v² > g · 100K). */
export const crestFlightSpeed = (K) => Math.sqrt(G * 100 * K);
