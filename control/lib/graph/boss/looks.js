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
 *   windClips(patterns)     → { wind_<p>: [rest, wound], strike_<p>: [wound, struck] } for a figure's door spec (`clips`):
 *                           two-key clips the page plays over their first half (boss-view's wind-up: rest to wound
 *                           through the tell, held; wound to struck through the blow)
 *   ATTACK_TELLS, ATTACK_HITS  the kinds
 *   readAttackLook(v)       → a look checked (a pattern's name, or one of the same shape); throws naming the fault
 *   lookOfMove(move)        → the look a boss's move wears (its pattern's), or null
 *
 * Pure data and a reader.
 */
import { PATTERNS } from './patterns.js';

export const ATTACK_TELLS = Object.freeze(['glint', 'cracks', 'shimmer', 'falling']);
export const ATTACK_HITS = Object.freeze(['crescent', 'dust', 'sound', 'impact', 'streak']);
const THINGS = ['weight', 'bell', 'swarm'], AT = ['weapon', 'eyes', 'feet'];
const no = (m) => { throw new Error(`attack look: ${m}`); };

export const ATTACK_LOOKS = Object.freeze({
  cleave: Object.freeze({ tell: Object.freeze({ glint: 'weapon' }), hit: 'crescent', reads: 'a glint on the blade, then a crescent swept down through its reach' }),
  quake: Object.freeze({ tell: Object.freeze({ cracks: true, glint: 'weapon' }), hit: 'dust', reads: 'the floor\'s cracks glowing, then a wall of dust rolling out both ways as high as it reaches' }),
  toll: Object.freeze({ tell: Object.freeze({ shimmer: true }), hit: 'sound', reads: 'the air shimmering round it, then a wall of ripples rolling out as high as it reaches' }),
  toss: Object.freeze({ tell: Object.freeze({ falling: 'weight' }), hit: 'impact', reads: 'the thing thrown coming down on its mark, then a star, a dust ring and chips' }),
  lunge: Object.freeze({ tell: Object.freeze({ glint: 'feet' }), hit: 'streak', reads: 'a glow at its feet as it crouches, then streaks and afterimages along the low stretch' }),
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
  lunge: Object.freeze({ wound: { crouch: 0.45, spine: { lean: ['forward', 0.5] }, armR: A(0.3, -0.7, -0.64), elbowR: 25, armL: A(-0.3, -0.7, -0.64), elbowL: 25, kneeL: 85, kneeR: 85, head: { pitch: -10 } },
    struck: { crouch: 0.18, spine: { lean: ['forward', 0.65] }, armR: A(0.08, 0.99, 0.05), elbowR: 0, armL: A(-0.4, -0.5, -0.75), elbowL: 20, kneeL: 55, kneeR: 15, head: { pitch: -18 } },
    reads: 'sunk low and leaning in, then sprung out flat along the lane' }),
});

/** The wind-up and strike clips of each pattern given that has a pose (see the header). */
export function windClips(patterns) {
  const out = {};
  for (const p of new Set(patterns)) {
    const P = ATTACK_POSES[p];
    if (!P) continue;
    out[`wind_${p}`] = [structuredClone(POSE_REST), structuredClone(P.wound)];
    out[`strike_${p}`] = [structuredClone(P.wound), structuredClone(P.struck)];
  }
  return out;
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
