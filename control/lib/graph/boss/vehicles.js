/**
 * VEHICLE ENCOUNTERS — a vehicle boss is EVENT driven: what it does is its STATE's (a tank driving its route or
 * stranded; a gunship on a run or hovering to turn; a walker walking, limping or down on its knees), and it is won by
 * MECHANICS, never by pouring rounds into it: a mine under a track, a launcher round into a hover, plates stripped off a
 * leg until the joint behind shows. Its body is PARTS, each a box on it in its own frame (x ahead, y left, z up from its
 * belly), each saying what hits it takes (`takes`: a `round`, an `explosive` (a launcher's round, a grenade), a `mine`),
 * how many break it (`hits`), what it hides until then (a part `behind` another is not there to hit until that one is
 * broken), and whether it is a WEAK spot (`weak`: its hits come off the vehicle's health, `mult` times). A part `shown`
 * only in a state (a gunship's rotor hub while it hovers) is hit then alone. Its `dress` is how it looks, boxes in the
 * same frame (`{ box, fill, alpha? }`), apart from the parts a hit is judged on. A state moves on (`to`) when its parts are
 * broken (`broken: [parts]`, all of them or `any`), when its run is flown (`flown`), or after seconds (`after`).
 *
 *   VEHICLES                   the shelf (a new vehicle boss is a row)
 *   readVehicle(v)             → the vehicle checked (throws naming the fault)
 *   partHit(v, part, kind)     → what a hit of that kind on that part does: { part, counts, weak, mult } or null
 *   vehicleLaws(v, { arms, mines }?) → [{ law, holds, says }]   winnable (a weak spot reached by the arms in hand) ·
 *                                moves-hold · every-state-moves (a state that attacks has moves, each holding) ·
 *                                mines-enough (a vehicle won by mines is given them)
 *
 * Pure data and readers; the runtime is worlds/controllable/boss.js.
 */
import { PATTERNS } from './patterns.js';
import { patternLaws, BODY } from './laws.js';

const no = (msg) => { throw new Error(`vehicle boss: ${msg}`); };
const HIT_KINDS = ['round', 'explosive', 'mine'];

export const VEHICLES = Object.freeze({
  // A TANK: it drives its route and its gun follows you. Its tracks break on mines laid in its path; stranded, its
  // engine grille faces where it cannot turn to cover, and launcher rounds through it end it
  tank: { name: 'The tank', title: 'mines under its tracks, then its grille', reads: 'a main battle tank driving a loop of the yard, its gun turning after you',
    size: [7.2, 3.6, 2.4], speed: 3, look: { tell: '#ffcf4a', hazard: '#ff8a3a' },
    dress: [{ box: [[-3.6, -1.25, 0.45], [3.6, 1.25, 1.55]], fill: '#4d5841' }, { box: [[-1.7, -1.3, 1.55], [1.3, 1.3, 2.35]], fill: '#56624a' }, { box: [[1.3, -0.14, 1.82], [5.4, 0.14, 2.1]], fill: '#3a4235' }, { box: [[-0.6, 0.3, 2.35], [0.2, 0.9, 2.6]], fill: '#454e3e' }],
    parts: {
      hull: { box: [[-3.6, -1.8, 0.4], [3.6, 1.8, 2.4]], takes: ['explosive'], hits: 0, weak: true, mult: 0.08, reads: 'armour: a launcher round scratches it' },
      'track-left': { box: [[-3.6, 1.2, 0], [3.6, 1.8, 1.1]], takes: ['mine'], hits: 1, reads: 'the left track: a mine under it breaks it' },
      'track-right': { box: [[-3.6, -1.8, 0], [3.6, -1.2, 1.1]], takes: ['mine'], hits: 1, reads: 'the right track' },
      grille: { box: [[-3.8, -1, 1.2], [-3.4, 1, 2.1]], takes: ['explosive', 'round'], hits: 0, weak: true, mult: 1, shown: 'stranded', reads: 'the engine grille, open to the rear once it cannot turn' },
    },
    states: {
      driving: { moves: { 'main-gun': 2, 'coax': 2 }, tempo: 2.4, route: true, to: { stranded: { broken: ['track-left', 'track-right'], says: 'both tracks broken' } }, reads: 'drives its loop, its gun after you' },
      stranded: { moves: { 'main-gun': 3, 'coax': 1 }, tempo: 2, route: false, reads: 'tracks gone: it turns its turret only, its rear open' },
    },
    moves: {
      'main-gun': { pattern: 'lock', says: 'the turret swings onto you and settles; the barrel fires down the line', tune: { harm: 0.35 } },
      'coax': { pattern: 'fan', says: 'the coaxial gun rakes the fan in front of the turret' },
    },
    wins: [{ by: 'mines', says: 'lay mines on its route: a mine under a track breaks it, and with both broken it is stranded' }, { by: 'weak', part: 'grille', says: 'stranded, its engine grille faces away from the gun: launcher rounds through it' }] },
  // A GUNSHIP: it flies attack runs down the arena and hovers at each end to turn; it is armoured on a run, and its
  // rotor hub is open while it hovers
  gunship: { name: 'The gunship', title: 'cover from its runs, its hub as it hovers', reads: 'an attack helicopter flying runs over the arena, hovering to turn at each end',
    size: [13, 2.6, 3.8], speed: 28, look: { tell: '#ffe066', hazard: '#ff6b3a' },
    dress: [{ box: [[-3.8, -1.1, 0.6], [3.2, 1.1, 2.9]], fill: '#4b5649' }, { box: [[3.2, -0.7, 0.9], [5.2, 0.7, 2.2]], fill: '#3d4a52' }, { box: [[-6.5, -0.28, 1.8], [-3.8, 0.28, 2.4]], fill: '#475245' }, { box: [[-6.6, -0.05, 2.2], [-5.8, 0.05, 3.6]], fill: '#3c463a' },
      { box: [[-6.5, -6.5, 4.15], [6.5, 6.5, 4.22]], fill: '#1f2326', alpha: 0.35 }, { box: [[-2.6, -1.3, 0], [2.6, -1.15, 0.25]], fill: '#2d3230' }, { box: [[-2.6, 1.15, 0], [2.6, 1.3, 0.25]], fill: '#2d3230' }, { box: [[-0.8, -2.2, 1.3], [0.8, -1.1, 1.7]], fill: '#3c463a' }, { box: [[-0.8, 1.1, 1.3], [0.8, 2.2, 1.7]], fill: '#3c463a' }],
    parts: {
      hull: { box: [[-6.5, -1.3, 0], [6.5, 1.3, 3.8]], takes: ['explosive'], hits: 0, weak: true, mult: 0.1, reads: 'armoured against rounds; a launcher round on a run barely tells' },
      'rotor-hub': { box: [[-0.9, -0.9, 3.2], [0.9, 0.9, 4.2]], takes: ['explosive'], hits: 0, weak: true, mult: 1, shown: 'hover', reads: 'the rotor hub, open while it hovers low to turn' },
    },
    states: {
      run: { moves: { 'rocket-run': 1 }, tempo: 1, altitude: 16, to: { hover: { flown: true, says: 'the run is flown' } }, reads: 'a run down the arena: rockets walked down a line, the cover on it is yours' },
      hover: { moves: { 'door-gun': 2 }, tempo: 2.2, altitude: 7, to: { run: { after: 6, says: 'six seconds hovering' } }, reads: 'hovering low at the end to turn: its door gun sweeps, its hub is open' },
    },
    moves: {
      'rocket-run': { pattern: 'strafe', says: 'it noses down onto its run; the rockets\' line is marked on the floor', tune: { harm: 0.3 } },
      'door-gun': { pattern: 'sweep', says: 'the door gunner swings onto you; the arc is marked', tune: { reach: 14 } },
    },
    wins: [{ by: 'cover', says: 'its runs walk rockets down a line: hard cover on the line, or off it' }, { by: 'weak', part: 'rotor-hub', says: 'launcher rounds into its rotor hub while it hovers' }] },
  // A WALKER: armour plates on its legs; launcher rounds strip a plate and bare the knee behind it; both knees broken,
  // it comes down on them and its cockpit is open
  walker: { name: 'The walker', title: 'strip its legs, break its knees', reads: 'a two-legged walker, plated legs, a cannon on its back', size: [4.2, 4.6, 7.5], speed: 1.6, look: { tell: '#9fe3a0', hazard: '#ffb347' },
    dress: [{ box: [[-1.4, -1.5, 4.0], [1.8, 1.5, 6.6]], fill: '#5a6152' }, { box: [[-2.6, -0.4, 6.4], [0.8, 0.4, 7.3]], fill: '#454b40' }, { box: [[1.8, -0.5, 4.6], [2.5, 0.5, 5.4]], fill: '#3a3f36' },
      { box: [[-0.35, 1.55, 3.5], [0.35, 2.15, 5.0]], fill: '#4c5246' }, { box: [[-0.35, -2.15, 3.5], [0.35, -1.55, 5.0]], fill: '#4c5246' }, { box: [[-0.45, 1.45, 0], [0.45, 2.25, 1.6]], fill: '#4c5246' }, { box: [[-0.45, -2.25, 0], [0.45, -1.45, 1.6]], fill: '#4c5246' },
      { box: [[-1, 1.3, 0], [1.4, 2.4, 0.3]], fill: '#3f443a' }, { box: [[-1, -2.4, 0], [1.4, -1.3, 0.3]], fill: '#3f443a' }],
    parts: {
      'plate-left': { box: [[-0.7, 1.4, 1.2], [0.7, 2.3, 3.6]], takes: ['explosive'], hits: 3, reads: 'the left leg\'s plating: three launcher rounds strip it' },
      'plate-right': { box: [[-0.7, -2.3, 1.2], [0.7, -1.4, 3.6]], takes: ['explosive'], hits: 3, reads: 'the right leg\'s plating' },
      'knee-left': { box: [[-0.5, 1.5, 1.6], [0.5, 2.2, 3.2]], takes: ['explosive', 'round'], hits: 6, behind: 'plate-left', reads: 'the left knee, bare once its plate is off' },
      'knee-right': { box: [[-0.5, -2.2, 1.6], [0.5, -1.5, 3.2]], takes: ['explosive', 'round'], hits: 6, behind: 'plate-right', reads: 'the right knee' },
      cockpit: { box: [[-1.2, -1.1, 4.4], [1.6, 1.1, 6.2]], takes: ['explosive', 'round'], hits: 0, weak: true, mult: 1, shown: 'kneeling', reads: 'the cockpit, in reach once it is down on its knees' },
    },
    states: {
      walking: { moves: { stomp: 2, cannon: 2 }, tempo: 2.4, route: true, to: { limping: { broken: ['knee-left', 'knee-right'], any: true, says: 'a knee broken' } }, reads: 'walks after you, stamping and shelling' },
      limping: { moves: { stomp: 1, cannon: 2, 'chin-gun': 2 }, tempo: 2, route: true, to: { kneeling: { broken: ['knee-left', 'knee-right'], says: 'both knees broken' } }, reads: 'a knee gone: slower, its chin gun out' },
      kneeling: { moves: { 'chin-gun': 2 }, tempo: 2.6, route: false, reads: 'down on its knees: its cockpit in reach' },
    },
    moves: {
      stomp: { pattern: 'ring', says: 'a leg lifts high; the floor round its foot cracks', tune: { harm: 0.25 } },
      cannon: { pattern: 'rain', says: 'the back cannon rises; each shell\'s landing is marked' },
      'chin-gun': { pattern: 'sweep', says: 'the chin gun swings across; the arc is marked', tune: { reach: 12 } },
    },
    wins: [{ by: 'plates', says: 'launcher rounds strip a leg\'s plating, three to a leg' }, { by: 'weak', part: 'knee-left', says: 'then the bare knee breaks under rounds; both broken, it kneels' }, { by: 'weak', part: 'cockpit', says: 'kneeling, its cockpit is in reach' }] },
});
export const VEHICLE_IDS = Object.keys(VEHICLES);

/** Read a vehicle boss (a row, or one of the same shape); → the vehicle (throws naming the fault). */
export function readVehicle(v, where = 'vehicle') {
  if (typeof v === 'string') { if (!VEHICLES[v]) no(`${where}: '${v}' is one of ${VEHICLE_IDS.join(', ')}`); v = VEHICLES[v]; }
  if (!v || typeof v !== 'object' || !v.parts || !v.states || !v.moves) no(`${where}: { name, size, speed, parts, states, moves, wins }`);
  const S = Object.keys(v.states);
  for (const [id, p] of Object.entries(v.parts)) {
    if (!Array.isArray(p.box) || p.box.length !== 2) no(`${where}.parts.${id}: box is [[x0, y0, z0], [x1, y1, z1]] in its own frame`);
    if (!Array.isArray(p.takes) || !p.takes.every((k) => HIT_KINDS.includes(k))) no(`${where}.parts.${id}: takes is a list of ${HIT_KINDS.join(', ')}`);
    if (p.behind !== undefined && !v.parts[p.behind]) no(`${where}.parts.${id}: behind names another part`);
    if (p.shown !== undefined && !S.includes(p.shown)) no(`${where}.parts.${id}: shown is one of its states (${S.join(', ')})`);
  }
  for (const [id, s] of Object.entries(v.states)) {
    for (const m of Object.keys(s.moves || {})) if (!v.moves[m]) no(`${where}.states.${id}: '${m}' is not one of its moves`);
    for (const [t, c] of Object.entries(s.to || {})) {
      if (!S.includes(t)) no(`${where}.states.${id}.to: '${t}' is not a state`);
      if (!c || (c.broken === undefined && c.flown !== true && !(c.after > 0))) no(`${where}.states.${id}.to.${t}: { broken: [parts], any? } | { flown: true } | { after: seconds }`);
      for (const q of c.broken || []) if (!v.parts[q]) no(`${where}.states.${id}.to.${t}: '${q}' is not a part`);
    }
  }
  for (const [id, m] of Object.entries(v.moves)) if (!PATTERNS[m.pattern]) no(`${where}.moves.${id}: pattern is one of ${Object.keys(PATTERNS).join(', ')}`);
  return v;
}

/** What a hit of `kind` on `part` does in the vehicle's state (see the header), or null where it does nothing. */
export function partHit(v, part, kind, state, broken = {}) {
  const p = v.parts[part];
  if (!p || broken[part] || !p.takes.includes(kind)) return null;
  if (p.behind && !broken[p.behind]) return null;
  if (p.shown && p.shown !== state) return null;
  return { part, counts: p.hits > 0, weak: !!p.weak, mult: p.mult ?? 1 };
}

/** A vehicle boss's laws (see the header). `arms`: the hit kinds the level gives the body (round, explosive, mine). */
export function vehicleLaws(vehicle, { arms = ['round', 'explosive', 'mine'], mines = 4, body = BODY } = {}) {
  const v = readVehicle(vehicle), out = [];
  // WINNABLE: a weak spot that takes what is in hand, everything in front of it breakable by what is in hand
  const reach = (id, seen = new Set()) => { const p = v.parts[id]; if (!p || seen.has(id)) return false; seen.add(id); if (!p.takes.some((k) => arms.includes(k))) return false; return !p.behind || reach(p.behind, seen); };
  const weak = Object.entries(v.parts).filter(([, p]) => p.weak && (p.mult ?? 1) >= 0.5).map(([id]) => id), winners = weak.filter((id) => reach(id));
  // (and the state a shown weak spot waits for is reached: from the first state, by each way on whose parts are broken by
  // what is in hand, or by a run flown or seconds waited)
  const reached = new Set([Object.keys(v.states)[0]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const s of [...reached]) for (const [t, c] of Object.entries(v.states[s].to || {})) {
      if (reached.has(t)) continue;
      const ok = !c.broken || (c.any ? c.broken.some((q) => reach(q)) : c.broken.every((q) => reach(q)));
      if (ok) { reached.add(t); grew = true; }
    }
  }
  const stateReached = (s) => reached.has(s);
  const won = winners.filter((id) => !v.parts[id].shown || stateReached(v.parts[id].shown));
  out.push({ law: 'winnable', holds: won.length > 0, says: won.length ? `won through ${won.join(', ')} with ${arms.join(', ')}` : `no weak spot is reached with ${arms.join(', ')}` });
  const bad = [];
  for (const [id, m] of Object.entries(v.moves)) {
    const P = PATTERNS[m.pattern], T = m.tune || {}, tuned = { ...P, ...(T.reach ? { reach: T.reach } : {}), hazards: P.hazards.map((h) => ({ ...h, ...(T.harm ? { harm: T.harm } : {}) })) };
    for (const l of patternLaws(tuned, body)) if (!l.holds) bad.push(`${id}: ${l.law}`);
  }
  out.push({ law: 'moves-hold', holds: !bad.length, says: bad.length ? bad.join('; ') : 'every move told, escapable, survivable and opened after' });
  const idle = Object.entries(v.states).filter(([, s]) => !Object.keys(s.moves || {}).length).map(([id]) => id);
  out.push({ law: 'every-state-moves', holds: !idle.length, says: idle.length ? `states with no move: ${idle.join(', ')}` : 'every state attacks' });
  const tracks = Object.values(v.parts).filter((p) => p.takes.includes('mine')).length;
  out.push({ law: 'mines-enough', holds: !tracks || mines >= tracks, says: tracks ? `${mines} mines for ${tracks} parts a mine breaks` : 'won without mines' });
  return out;
}
