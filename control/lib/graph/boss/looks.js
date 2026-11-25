/**
 * ATTACK LOOKS — what a boss's attack looks like, in the gothic anime register (scene/juice-style.js `anime`: a white-hot
 * core into saturated colour, hard bands, glints, dust tinted by the floor), drawn over the read every attack already has
 * (its mark, boss-view.js: where it lands and how high). A look is told and then lands:
 *
 *   TELL   what the boss shows as it winds up, from the hazard's mark to its landing, brightening as the landing nears:
 *            glint   a star of light where it strikes from (`at`: 'weapon' its striking side at shoulder height, 'eyes'
 *                    its head, 'feet' the floor under it), turning and swelling
 *            cracks  the floor's cracks glowing along the stretch it will cross
 *            shimmer rings of air round the boss, gathering in
 *            falling the thrown thing in the air over its mark, coming down on it (`thing`: 'weight' | 'bell' | 'swarm')
 *   HIT    what lands, drawn from the hazard's own numbers as it lands:
 *            crescent  a crescent swept down through its reach, its edge white-hot, sparks thrown off it
 *            dust      a wall of dust at the front, as high as it reaches, stone chips thrown up ahead of it
 *            sound     ripple lines standing at the front, as high as it reaches, rolling out
 *            impact    a star where it lands, a dust ring and chips
 *            streak    speed lines along the stretch at its height, afterimages of the boss as it is carried
 *            rolling   the thing itself rolling down its line (a boulder: a stone turning as it goes), dust thrown up
 *                      behind it
 *
 * Its colours are the boss's (`rule.boss.look`: `tell` the wind-up's, `hazard` the blow's) and the floor's dust; a look
 * names none of its own but `core` (the white-hot centre) and `dust`.
 *
 *   ATTACK_LOOKS            { <pattern>: { tell, hit, reads } }   the shelf, by the pattern it draws (a new look is a row)
 *   ATTACK_POSES            { <pattern>: { wound, struck, reads } }   what a person's BODY does through it, in the rig's pose
 *                           words (figure-posing.js: a crouch, the spine's curl, arch, lean and twist, each arm a direction
 *                           in its own frame (+y ahead, +x its right, +z up) and its elbow, each knee), its weapon in its
 *                           right hand: WOUND at the end of the tell (the look's glint where its weapon is), STRUCK as
 *                           the blow lands
 *   POSE_REST               the stand it winds up from
 *   WING_BEATS              { <pattern>: { wound, struck, reads } }   what a WINGED body's wings do through it, in degrees
 *                           on their channels (outfit-plan.js `wings`: `wingR`, `wingL`, 0 their rest swept back, − raised
 *                           high and forward, + beaten down and back); WING_FLAP the beat's raised and beaten angles
 *   windClips(patterns, { wings? })
 *                           → { wind_<p>: [rest, wound], strike_<p>: [wound, struck] } for a figure's door spec (`clips`):
 *                           two-key clips the page plays over their first half (boss-view's wind-up: rest to wound
 *                           through the tell, held; wound to struck through the blow). With `wings` (its channels'
 *                           names) the wind-up FLAPS: rest, then the wound body as the wings beat up, down, up, down and
 *                           settle at the pattern's wound, six keys on the bake's twelve samples, and the strike beats
 *                           them to its struck
 *   flapWind(patterns)      → { <p>: { wind: [clip, 0, 5/6], strike: [clip, 0, 0.5] } } the stretch of those clips the
 *                           page plays (a boss's `rule.boss.wind`)
 *   ATTACK_TELLS, ATTACK_HITS  the kinds
 *   readAttackLook(v)       → a look checked (a pattern's name, or one of the same shape); throws naming the fault
 *   lookOfMove(move)        → the look a boss's move wears (its pattern's), or null
 *
 * Pure data and a reader.
 */
import { PATTERNS } from './patterns.js';

export const ATTACK_TELLS = Object.freeze(['glint', 'cracks', 'shimmer', 'falling']);
export const ATTACK_HITS = Object.freeze(['crescent', 'dust', 'sound', 'impact', 'streak', 'rolling']);
const THINGS = ['weight', 'bell', 'swarm'], AT = ['weapon', 'eyes', 'feet'];
const no = (m) => { throw new Error(`attack look: ${m}`); };

export const ATTACK_LOOKS = Object.freeze({
  cleave: Object.freeze({ tell: Object.freeze({ glint: 'weapon' }), hit: 'crescent', reads: 'a glint on the blade, then a crescent swept down through its reach' }),
  quake: Object.freeze({ tell: Object.freeze({ cracks: true, glint: 'weapon' }), hit: 'dust', reads: 'the floor\'s cracks glowing, then a wall of dust rolling out both ways as high as it reaches' }),
  toll: Object.freeze({ tell: Object.freeze({ shimmer: true }), hit: 'sound', reads: 'the air shimmering round it, then a wall of ripples rolling out as high as it reaches' }),
  toss: Object.freeze({ tell: Object.freeze({ falling: 'weight' }), hit: 'impact', reads: 'the thing thrown coming down on its mark, then a star, a dust ring and chips' }),
  lunge: Object.freeze({ tell: Object.freeze({ glint: 'feet' }), hit: 'streak', reads: 'a glow at its feet as it crouches, then streaks and afterimages along the low stretch' }),
  // (the air's: its eyes catching the light as it hangs over the room, then what comes down)
  swoop: Object.freeze({ tell: Object.freeze({ glint: 'eyes' }), hit: 'streak', reads: 'its eyes glinting as it hangs over the room, then streaks and afterimages as it rakes along the floor' }),
  dive: Object.freeze({ tell: Object.freeze({ glint: 'eyes', cracks: true }), hit: 'impact', reads: 'its eyes glinting over its shadow, the floor\'s cracks lit under it, then a star, a dust ring and chips where it lands' }),
  // (the new rooms' bosses: blades thrown from the air, lances out of the floor, a tail along it, venom, a boulder)
  volley: Object.freeze({ tell: Object.freeze({ glint: 'weapon' }), hit: 'streak', reads: 'a glint in its raised hand, then streaks along the floor as the blades stick one after another' }),
  lances: Object.freeze({ tell: Object.freeze({ cracks: true }), hit: 'impact', reads: 'the floor\'s cracks glowing under each mark, then a star, a dust ring and chips as each lance bursts' }),
  coil: Object.freeze({ tell: Object.freeze({ glint: 'feet' }), hit: 'dust', reads: 'a glow at its coils as they draw in, then a wall of dust swept out both ways along the floor' }),
  venom: Object.freeze({ tell: Object.freeze({ glint: 'eyes' }), hit: 'impact', reads: 'its eyes glinting as its throat swells, then a splash where the venom lands' }),
  boulder: Object.freeze({ tell: Object.freeze({ glint: 'weapon', cracks: true }), hit: 'rolling', reads: 'the boulder raised and the floor cracking under the weight, then the boulder itself rolling the length of the room' }),
});
// THE BODY'S: arms as directions (+y ahead, +x its right, +z up), elbows and knees in degrees
const up = (x, y = 0) => ({ x, y, z: 0.95 }), A = (x, y, z) => ({ x, y, z });
export const POSE_REST = Object.freeze({ crouch: 0.06, armL: A(-0.2, 0.15, -0.97), elbowL: 25, armR: A(0.2, 0.2, -0.96), elbowR: 30 });
export const ATTACK_POSES = Object.freeze({
  // the weapon drawn back over the right shoulder, the body turned and leaning off the blow; then swept down through it
  cleave: Object.freeze({ wound: { crouch: 0.12, spine: { arch: 0.15, twist: ['right', 0.4] }, armR: A(0.35, -0.45, 0.82), elbowR: 70, armL: A(-0.3, 0.75, 0.1), elbowL: 30, head: { pitch: -6 } },
    struck: { crouch: 0.25, spine: { lean: ['forward', 0.4], twist: ['left', 0.35] }, armR: A(0.05, 0.85, -0.5), elbowR: 10, armL: A(-0.45, -0.35, -0.6), elbowL: 20, kneeL: 35, head: { pitch: 10 } },
    reads: 'the blade drawn back over its shoulder, then swept down through the reach' }),
  // both hands raised overhead, the back arched; then driven down into the floor, the body folded over them
  quake: Object.freeze({ wound: { crouch: 0.04, spine: { arch: 0.28 }, armR: up(0.18, -0.1), elbowR: 35, armL: up(-0.18, -0.1), elbowL: 35, head: { pitch: -14 } },
    struck: { crouch: 0.4, spine: { lean: ['forward', 0.55] }, armR: A(0.12, 0.6, -0.79), elbowR: 8, armL: A(-0.12, 0.6, -0.79), elbowL: 8, kneeL: 65, kneeR: 65, head: { pitch: 18 } },
    reads: 'both hands raised high, then driven down into the floor' }),
  // the throwing arm drawn back low, the other reaching ahead to aim; then flung up and out, the weight thrown over
  toss: Object.freeze({ wound: { crouch: 0.14, spine: { arch: 0.1, twist: ['right', 0.5] }, armR: A(0.35, -0.8, -0.4), elbowR: 45, armL: A(-0.2, 0.9, 0.35), elbowL: 15 },
    struck: { crouch: 0.08, spine: { lean: ['forward', 0.3], twist: ['left', 0.4] }, armR: A(0.2, 0.75, 0.62), elbowR: 5, armL: A(-0.35, -0.4, -0.85), elbowL: 25 },
    reads: 'the arm drawn back low, then flung up and out' }),
  // the arms spread wide, the chest opened and the head thrown back; then thrust out ahead, the whole body behind them
  toll: Object.freeze({ wound: { crouch: 0.05, spine: { arch: 0.32 }, armR: A(0.94, 0.05, 0.33), elbowR: 15, armL: A(-0.94, 0.05, 0.33), elbowL: 15, head: { pitch: -22 } },
    struck: { crouch: 0.14, spine: { lean: ['forward', 0.3] }, armR: A(0.22, 0.96, 0.1), elbowR: 5, armL: A(-0.22, 0.96, 0.1), elbowL: 5, head: { pitch: 4 } },
    reads: 'arms spread wide and the head thrown back, then thrust out ahead' }),
  // sunk low on bent knees, leaning in, the arms swept back; then sprung out flat along the lane, the weapon ahead
  // (the air's: aloft its legs tucked under it; hanging back on its wings with its arms flung back, then thrown forward
  // into the dive, its claws reaching ahead along the floor)
  swoop: Object.freeze({ wound: { crouch: 0.05, spine: { arch: 0.22 }, armR: A(0.7, -0.55, 0.45), elbowR: 30, armL: A(-0.7, -0.55, 0.45), elbowL: 30, kneeL: 75, kneeR: 75, head: { pitch: -8 } },
    struck: { crouch: 0.12, spine: { lean: ['forward', 0.6] }, armR: A(0.25, 0.9, -0.36), elbowR: 15, armL: A(-0.25, 0.9, -0.36), elbowL: 15, kneeL: 45, kneeR: 45, head: { pitch: -18 } },
    reads: 'hanging back on its wings, arms flung back, then thrown forward into the dive, claws reaching along the floor' }),
  // (hanging over the body with its arms spread and its head down at it; then landing in a crouch, both hands driven down)
  dive: Object.freeze({ wound: { crouch: 0.05, spine: { arch: 0.1 }, armR: A(0.85, 0.1, 0.5), elbowR: 25, armL: A(-0.85, 0.1, 0.5), elbowL: 25, kneeL: 60, kneeR: 60, head: { pitch: 24 } },
    struck: { crouch: 0.42, spine: { lean: ['forward', 0.35] }, armR: A(0.15, 0.5, -0.85), elbowR: 10, armL: A(-0.15, 0.5, -0.85), elbowL: 10, kneeL: 70, kneeR: 70, head: { pitch: 12 } },
    reads: 'hanging over the body, arms spread and head down at it, then landing in a crouch, both hands driven down' }),
  // (the arm drawn back high over the shoulder, the blades in its hand; then flung down and across, the body following)
  volley: Object.freeze({ wound: { crouch: 0.05, spine: { arch: 0.2, twist: ['right', 0.35] }, armR: A(0.3, -0.5, 0.81), elbowR: 60, armL: A(-0.5, 0.7, 0.5), elbowL: 20, kneeL: 50, kneeR: 50, head: { pitch: 12 } },
    struck: { crouch: 0.05, spine: { lean: ['forward', 0.4], twist: ['left', 0.35] }, armR: A(0.2, 0.85, -0.49), elbowR: 5, armL: A(-0.5, -0.4, -0.77), elbowL: 20, kneeL: 40, kneeR: 40, head: { pitch: 16 } },
    reads: 'its arm drawn back high with the blades, then flung down and across' }),
  // (bent over with one hand to the floor, the other raised; then both thrown up, the lances following them)
  lances: Object.freeze({ wound: { crouch: 0.35, spine: { lean: ['forward', 0.55] }, armR: A(0.15, 0.4, -0.9), elbowR: 5, armL: A(-0.5, 0.2, 0.84), elbowL: 20, kneeL: 60, kneeR: 40, head: { pitch: 14 } },
    struck: { crouch: 0.05, spine: { arch: 0.25 }, armR: A(0.35, 0.3, 0.89), elbowR: 10, armL: A(-0.35, 0.3, 0.89), elbowL: 10, head: { pitch: -16 } },
    reads: 'bent with a hand to the floor, then both arms thrown up as the lances burst' }),
  // (drawn in and turned away, the arms wrapped about it; then whipped round the other way, the arms flung out)
  coil: Object.freeze({ wound: { crouch: 0.3, spine: { twist: ['right', 0.6], lean: ['forward', 0.2] }, armR: A(-0.2, 0.6, -0.4), elbowR: 80, armL: A(0.2, 0.6, -0.4), elbowL: 80, head: { pitch: 6 } },
    struck: { crouch: 0.15, spine: { twist: ['left', 0.6] }, armR: A(0.95, 0.2, 0.1), elbowR: 10, armL: A(-0.95, 0.2, 0.1), elbowL: 10, head: { pitch: -4 } },
    reads: 'drawn in and turned away, then whipped round, the arms flung out' }),
  // (reared back, the chin up and the hands at the throat; then thrust forward, the head snapping out)
  venom: Object.freeze({ wound: { crouch: 0.05, spine: { arch: 0.3 }, armR: A(0.3, 0.6, 0.2), elbowR: 110, armL: A(-0.3, 0.6, 0.2), elbowL: 110, head: { pitch: -24 } },
    struck: { crouch: 0.12, spine: { lean: ['forward', 0.45] }, armR: A(0.5, 0.3, -0.81), elbowR: 30, armL: A(-0.5, 0.3, -0.81), elbowL: 30, head: { pitch: 10 } },
    reads: 'reared back with its chin up, then thrust forward as it spits' }),
  // (the boulder heaved up over the head in both hands; then thrown down and forward, the body bent behind it)
  boulder: Object.freeze({ wound: { crouch: 0.1, spine: { arch: 0.3 }, armR: up(0.2, -0.2), elbowR: 70, armL: up(-0.2, -0.2), elbowL: 70, kneeL: 25, kneeR: 25, head: { pitch: -12 } },
    struck: { crouch: 0.35, spine: { lean: ['forward', 0.6] }, armR: A(0.18, 0.75, -0.64), elbowR: 10, armL: A(-0.18, 0.75, -0.64), elbowL: 10, kneeL: 50, kneeR: 30, head: { pitch: 12 } },
    reads: 'a boulder heaved up over its head, then thrown down and forward' }),
  lunge: Object.freeze({ wound: { crouch: 0.45, spine: { lean: ['forward', 0.5] }, armR: A(0.3, -0.7, -0.64), elbowR: 25, armL: A(-0.3, -0.7, -0.64), elbowL: 25, kneeL: 85, kneeR: 85, head: { pitch: -10 } },
    struck: { crouch: 0.18, spine: { lean: ['forward', 0.65] }, armR: A(0.08, 0.99, 0.05), elbowR: 0, armL: A(-0.4, -0.5, -0.75), elbowL: 20, kneeL: 55, kneeR: 15, head: { pitch: -18 } },
    reads: 'sunk low and leaning in, then sprung out flat along the lane' }),
});

// THE WINGS' (degrees on their channels: − raised high and forward, + beaten down and back)
export const WING_FLAP = Object.freeze({ up: -42, down: 48 });
export const WING_BEATS = Object.freeze({
  cleave: Object.freeze({ wound: -45, struck: 55, reads: 'flung up high behind the blade, then beaten down with it' }),
  quake: Object.freeze({ wound: -40, struck: 50, reads: 'raised with the hands, then beaten down as they drive into the floor' }),
  toss: Object.freeze({ wound: -35, struck: 50, reads: 'raised as the arm draws back, then beaten down as it throws' }),
  toll: Object.freeze({ wound: -30, struck: -12, reads: 'spread wide and high, held open through the cry' }),
  lunge: Object.freeze({ wound: 30, struck: 40, reads: 'folded back along it, flattened as it springs' }),
  swoop: Object.freeze({ wound: -40, struck: 45, reads: 'beating it up off the floor and holding it there, then folded back into the dive' }),
  dive: Object.freeze({ wound: -38, struck: 55, reads: 'beating it up over the body and holding it there, then beaten down as it drops' }),
  volley: Object.freeze({ wound: -35, struck: 40, reads: 'holding it up in the air, then beaten down with the throw' }),
  lances: Object.freeze({ wound: 25, struck: -40, reads: 'folded down as it bends, then flung up with the lances' }),
  coil: Object.freeze({ wound: 30, struck: 35, reads: 'folded close as it draws in, held close through the sweep' }),
  venom: Object.freeze({ wound: -30, struck: 20, reads: 'raised as it rears, then dropped as it spits' }),
  boulder: Object.freeze({ wound: -25, struck: 45, reads: 'raised with the boulder, then beaten down with the throw' }),
});

/** The wind-up and strike clips of each pattern given that has a pose; a winged body's wings beating through them (see
 * the header). */
export function windClips(patterns, { wings = null } = {}) {
  const out = {}, W = (v) => (wings ? Object.fromEntries(wings.map((c) => [c, v])) : {});
  for (const p of new Set(patterns)) {
    const P = ATTACK_POSES[p];
    if (!P) continue;
    const B = WING_BEATS[p] ?? { wound: 0, struck: 0 }, wound = () => structuredClone(P.wound);
    out[`wind_${p}`] = wings ? [structuredClone(POSE_REST), { ...wound(), ...W(WING_FLAP.up) }, { ...wound(), ...W(WING_FLAP.down) }, { ...wound(), ...W(WING_FLAP.up) }, { ...wound(), ...W(WING_FLAP.down) }, { ...wound(), ...W(B.wound) }]
      : [structuredClone(POSE_REST), wound()];
    out[`strike_${p}`] = [{ ...wound(), ...W(B.wound) }, { ...structuredClone(P.struck), ...W(B.struck) }];
  }
  return out;
}
/** The stretch of a flapping body's clips the page plays: the wind-up's six keys through the tell, the strike's two through
 * the blow (see the header). */
export function flapWind(patterns) {
  return Object.fromEntries([...new Set(patterns)].filter((p) => ATTACK_POSES[p]).map((p) => [p, { wind: [`wind_${p}`, 0, 5 / 6], strike: [`strike_${p}`, 0, 0.5] }]));
}

/** the white-hot core every hit burns to, and the dust a floor throws up */
export const LOOK_CORE = '#fff4e0', LOOK_DUST = '#8a7a66';

/** Read a look (see the header). */
export function readAttackLook(v, where = 'look') {
  if (typeof v === 'string') { if (!ATTACK_LOOKS[v]) no(`${where}: '${v}' is one of ${Object.keys(ATTACK_LOOKS).join(', ')}`); return ATTACK_LOOKS[v]; }
  if (!v || typeof v !== 'object' || !v.tell || typeof v.tell !== 'object') no(`${where}: { tell: { glint? | cracks? | shimmer? | falling? }, hit }`);
  for (const k of Object.keys(v.tell)) if (!ATTACK_TELLS.includes(k)) no(`${where}.tell: ${k} is one of ${ATTACK_TELLS.join(', ')}`);
  if (v.tell.glint !== undefined && !AT.includes(v.tell.glint)) no(`${where}.tell.glint is one of ${AT.join(', ')}`);
  if (v.tell.falling !== undefined && !THINGS.includes(v.tell.falling)) no(`${where}.tell.falling is one of ${THINGS.join(', ')}`);
  if (!ATTACK_HITS.includes(v.hit)) no(`${where}.hit is one of ${ATTACK_HITS.join(', ')}`);
  return v;
}

/** The look a boss's move wears: its own `look` (a move's words may name a thing thrown), else its pattern's. */
export function lookOfMove(move) {
  const base = move?.pattern && ATTACK_LOOKS[move.pattern];
  if (!base) return null;
  const L = move.look ? { ...base, ...move.look, tell: { ...base.tell, ...(move.look.tell ?? {}) } } : base;
  readAttackLook(L, `move ${move.id ?? move.pattern}`);
  if (!PATTERNS[move.pattern]) no(`move ${move.id}: no pattern '${move.pattern}'`);
  return { tell: { ...L.tell }, hit: L.hit };
}
