/**
 * car-odm — the design grammar of the cars behind the cab, on the vehicle ODM's pattern: a brief solved into one frame
 * held to laws. A passenger car takes its body's section from its family's cab car (cab-odm.js, the same seed), so a
 * train's cars are one section from end to end; a locomotive's coach and its freight wagons carry their own.
 * car-surface.js compiles it; consist.js couples cars into a train. Pure, deterministic, generic.
 *
 *   archetype       family      what it is
 *   metroCar        metro       a metro car: four double doors a side, a window band, a gangway at each end
 *   tramModule      tram        a streetcar's short module hung between its neighbours: no bogie of its own, its ends
 *                               articulated (a bellows ring to the next)
 *   tramCentre      tram        a streetcar's centre module on its own bogie under its middle
 *   regionalCar     regional    a regional unit's car: a door near each end, window bays, a gangway at each end
 *   highSpeedCoach  highSpeed   a high-speed train's coach: one door a side near its end, window bays
 *   coach           coach       a locomotive-hauled passenger coach: a vestibule door at each end, bays, buffers and
 *                               a screw coupler at each end, a gangway between
 *   boxcar          freight     a box wagon: its sliding doors, its ribbed sides, its roof
 *   hopper          freight     a covered hopper: its sides falling in to its discharge bays under it
 *   tank            freight     a tank wagon: its barrel on its cradles, its dome and its walkway
 *   flat            freight     a flat wagon: its deck, its stanchions, a container on it
 *
 *   solveCarDesign(brief) → { version, archetype, family, seed, kind ('passenger' | 'freight'), body, frame, section,
 *                             doors, windows, ends, bogieKinds, laws, valid }
 *
 * Coordinates: +y forward, x right, z up from the rail; the car's middle at y = 0, its ends at ±L/2.
 */
import { solveCabDesign, halfWidthAt, CAB_GAUGE } from './cab-odm.js';
import { solveBogieDesign } from './bogie-odm.js';

const frozen = (x) => Object.freeze(x);
export const CAR_GRAMMAR_VERSION = 'rail-car-v0.1';
const r4 = (x) => Math.round(x * 10000) / 10000 + 0;

// a locomotive's coach's section and the freight wagons' (their own: no cab draws them)
const COACH = frozen({ width: 2.86, height: 4.03, floor: 1.25, skirt: 0.78, section: { undercut: 0.08, waist: 0.95, tumblehome: 0.1, cant: 0.52, radius: 0.42 } });
const WAGON = frozen({ width: 2.9, height: 4.0, floor: 1.22, skirt: 0.95, section: { undercut: 0.02, waist: 0.4, tumblehome: 0.02, cant: 0.3, radius: 0.16 } });

export const CAR_ARCHETYPES = frozen({
  metroCar: frozen({ family: 'metro', kind: 'passenger', length: 18.2, overhang: 2.6, doors: { count: 4, width: 1.4, at: 'spread' }, windows: 'band', bogies: ['metroMotor', 'metroTrailer'], ends: 'gangway', roofUnit: true }),
  tramModule: frozen({ family: 'tram', kind: 'passenger', length: 4.6, overhang: 0, doors: { count: 1, width: 1.3, at: 'middle' }, windows: 'band', bogies: [], ends: 'articulated', roofUnit: true }),
  tramCentre: frozen({ family: 'tram', kind: 'passenger', length: 6.2, overhang: 3.1, doors: { count: 1, width: 1.3, at: 'middle' }, windows: 'band', bogies: ['tram'], ends: 'articulated', roofUnit: true }),
  regionalCar: frozen({ family: 'regional', kind: 'passenger', length: 24.5, overhang: 3.6, doors: { count: 2, width: 1.3, at: 'ends' }, windows: 'bays', bogies: ['regionalMotor', 'regionalMotor'], ends: 'gangway', roofUnit: true }),
  highSpeedCoach: frozen({ family: 'highSpeed', kind: 'passenger', length: 25, overhang: 3.2, doors: { count: 1, width: 0.9, at: 'end' }, windows: 'bays', bogies: ['highSpeed', 'highSpeed'], ends: 'gangway', roofUnit: false }),
  coach: frozen({ family: 'coach', kind: 'passenger', length: 24.2, overhang: 2.6, doors: { count: 2, width: 0.8, at: 'ends' }, windows: 'bays', bogies: ['highSpeed', 'highSpeed'], ends: 'buffers', roofUnit: false }),
  boxcar: frozen({ family: 'freight', kind: 'freight', body: 'box', length: 16.5, overhang: 2.3, doors: { count: 1, width: 3.0, at: 'middle' }, bogies: ['freight', 'freight'], ends: 'buffers' }),
  hopper: frozen({ family: 'freight', kind: 'freight', body: 'hopper', length: 14.5, overhang: 2.2, height: 3.75, bays: 3, bogies: ['freight', 'freight'], ends: 'buffers' }),
  tank: frozen({ family: 'freight', kind: 'freight', body: 'tank', length: 15.5, overhang: 2.4, barrel: 2.6, bogies: ['freight', 'freight'], ends: 'buffers' }),
  flat: frozen({ family: 'freight', kind: 'freight', body: 'flat', length: 18.4, overhang: 2.5, deck: 1.22, load: 'container', bogies: ['freight', 'freight'], ends: 'buffers' }),
});
export const CAR_KINDS = Object.freeze(Object.keys(CAR_ARCHETYPES));
export const CAR_LIMITS = frozen({ length: [3.5, 28] });

export function solveCarDesign({ seed = 1, archetype = 'metroCar', dimensions = {} } = {}) {
  const A = CAR_ARCHETYPES[archetype];
  if (!A) throw new Error(`rail-car: unknown archetype ${archetype} (known: ${CAR_KINDS.join(', ')})`);
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions)) throw new Error('rail-car: dimensions must be an object');
  for (const k of Object.keys(dimensions)) if (!Object.hasOwn(CAR_LIMITS, k)) throw new Error(`rail-car: unknown dimension ${k}`);
  const L = dimensions.length === undefined ? A.length : dimensions.length;
  if (typeof L !== 'number' || !(L >= CAR_LIMITS.length[0] && L <= CAR_LIMITS.length[1])) throw new Error(`rail-car: length must be in [${CAR_LIMITS.length.join(', ')}]`);
  // the section: the family's cab car's (its seed's), or a coach's or a wagon's own
  let frame0, section, cab = null;
  if (A.family === 'coach' || A.family === 'freight') {
    const B = A.family === 'coach' ? COACH : WAGON, Sx = B.section, H = A.height ?? B.height;
    frame0 = { width: B.width, height: H, floor: B.floor };
    section = frozen({ z0: B.skirt, zw: r4(B.floor + Sx.waist), zc: r4(H - Sx.cant), undercut: Sx.undercut, tumblehome: Sx.tumblehome, radius: Sx.radius });
  } else {
    cab = solveCabDesign({ seed, archetype: A.family });
    frame0 = { width: cab.frame.width, height: cab.frame.height, floor: cab.frame.floor };
    section = cab.section;
  }
  const B = A.bogies.map((k) => solveBogieDesign({ seed, archetype: k }));
  // its bogies at their places: two at its overhangs from its ends, or one under its middle, or none (hung between)
  const at = B.length === 2 ? [r4(L / 2 - A.overhang), r4(-L / 2 + A.overhang)] : B.length === 1 ? [0] : [];
  const frame = frozen({ length: r4(L), ...frame0, gauge: 1.435, bogies: frozen(at), bogieKinds: frozen([...A.bogies]), pivot: B.length ? r4(Math.max(...B.map((b) => b.pivot.z))) : null });
  // its doors: spread along it, one at each end, one near its end, or one in its middle
  const D = A.doors, dw = D ? D.width : 0, doors = [];
  if (D) {
    if (D.at === 'spread') for (let k = 0; k < D.count; k += 1) doors.push(r4(-L / 2 + (L * (k + 0.5)) / D.count));
    else if (D.at === 'ends') doors.push(r4(L / 2 - 1.2 - dw / 2), r4(-L / 2 + 1.2 + dw / 2));
    else if (D.at === 'end') doors.push(r4(-L / 2 + 1.2 + dw / 2));
    else doors.push(0);
  }
  const design = { version: CAR_GRAMMAR_VERSION, archetype, family: A.family, seed, kind: A.kind, body: A.body ?? 'passenger', frame, section,
    doors: frozen({ at: frozen(doors), width: dw, height: A.kind === 'freight' ? r4(frame0.height - frame0.floor - 0.35) : 1.95 }),
    windows: A.windows ?? null, ends: A.ends, roofUnit: !!A.roofUnit, bays: A.bays ?? 0, barrel: A.barrel ?? 0, deck: A.deck ?? 0, load: A.load ?? null,
    cabArchetype: cab ? cab.archetype : null };
  const d = { frame, section };
  const zs = Array.from({ length: 50 }, (_, k) => section.z0 + ((frame.height - section.z0) * k) / 49);
  const gaugeAt = (z) => { for (let i = 1; i < CAB_GAUGE.length; i += 1) { const [z0, w0] = CAB_GAUGE[i - 1], [z1, w1] = CAB_GAUGE[i]; if (z <= z1) return w0 + ((w1 - w0) * (z - z0)) / (z1 - z0); } return 0; };
  const laws = [
    { id: 'within-gauge', pass: zs.every((z) => halfWidthAt(d, z) <= gaugeAt(z) + 1e-9) && frame.height <= CAB_GAUGE.at(-1)[0] },
    { id: 'doors-on-body', pass: doors.every((y) => Math.abs(y) + dw / 2 < L / 2 - 0.3) },
    { id: 'bogies-under-body', pass: B.every((b, k) => Math.abs(at[k]) + b.base / 2 + b.wheel / 2 < L / 2) && B.every((b) => b.valid) },
    { id: 'bogies-under-floor', pass: !B.length || frame.pivot < frame0.floor - 0.05 || frame0.floor < Math.max(...B.map((b) => b.wheel)) },
  ];
  return frozen({ ...design, laws: frozen(laws.map(frozen)), valid: laws.every((l) => l.pass) });
}
