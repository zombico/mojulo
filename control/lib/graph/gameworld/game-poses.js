/**
 * THE POSE RAILS — how a game's people stand when they are shown, by the kind of game it is and where they are shown: a
 * small table beside the body rails (game-bodies.js), a new way of standing a row. The door already has the poses (the
 * stand's presets and pose words, hero-gesture.js; the showcase poses, hero-aura.js); this says which one a context
 * takes, so a character is not always the same tilted rest:
 *
 *   cover   the bible's cover, a select screen: the SHOWCASE pose that says who they are (its hit held), picked for the
 *           rail and the role, the seed choosing among the rail's own
 *   live    a live demo: the STAND the game's idle plays from and the IDLE loop itself (a door clip `idle`, in place of
 *           the form's one breathing loop), squared, weighted and timed for the game: a fighter's guard bouncing, a
 *           hero's chest out, a person's weight shifting, a mascot's bob
 *
 * The turnaround is not a context here: a model sheet stands in the hero's own stand (or the rest) so its silhouette and
 * its proportions read.
 *
 *   gamePose(rail, context, { role?, cast?, core?, seed? })  → { context, rail, gesture, clips?, why }  the hero-door
 *                                     words (`gesture`, and for `live` its `clips.idle`), with the reason; a rail of
 *                                     null takes the plain rows (a cover still strikes a pose; a live demo is left as it is)
 *
 * The creator's own stand wins wherever it is written (the hero's `gesture`); a vibe's stand (hero-vibe.js standFor, a
 * prior of three words read off the feel's axes) gives way to the rail's, which knows what game it is shown in. Pure and deterministic: the seed picks by a fixed hash, no dice, no clock.
 */
import { resolveGesture } from '../polygonizer/hero-gesture.js';

export const POSE_CONTEXTS = Object.freeze(['cover', 'live']);
export const POSE_ROLES = Object.freeze(['hero', 'henchman', 'rival', 'boss']);

/** the showcase poses a cover picks from, per rail and role (hero-aura.js AURAS); the first is the rail's own */
export const COVER_POSES = Object.freeze({
  comic: { hero: ['heroHips', 'fistToSky', 'jotaroPoint'], henchman: ['crossedArms', 'fistCrush'], why: 'a superhero strikes the pose the panel needs; a henchman squares up behind the boss' },
  realistic: { hero: ['pocketsCool', 'crossedArms', 'niceGuy'], henchman: ['crossedArms', 'pocketsCool'], why: 'a person at ease in their own weight, nothing struck for the camera' },
  muscular: { hero: ['fistCrush', 'fistToSky', 'crossedArms'], henchman: ['crossedArms', 'recoome'], why: 'a fighter shows the build: the fist, the arms, the chest' },
  mascot: { hero: ['peaceWink', 'fingerGuns', 'fistToSky'], henchman: ['ginyu', 'fingerGuns'], why: 'a mascot plays to the player: a wink, a grin, a cheer' },
  none: { hero: ['heroHips', 'crossedArms'], henchman: ['crossedArms'], why: 'no rail: a lead stands ready, a henchman squares up' },
});
/** the roles every rail strikes alike, the rail's own list over them where it names one: a rival points the challenge, a
 * boss turns its back on you or looks down its arms */
export const ROLE_POSES = Object.freeze({
  rival: { list: ['jotaroPoint', 'josephPoint', 'giorno'], why: 'a rival points the challenge' },
  boss: { list: ['dioBack', 'crossedArms', 'killerQueen'], why: 'a boss turns its back on you, or looks down its arms' },
});
/** the cast's relations (egocube/cast.js RELATIONS) and a foe's rank (mind.rank) as the role a pose reads */
export const RELATION_ROLE = Object.freeze({ mastermind: 'boss', lieutenant: 'boss', rank: 'henchman', rival: 'rival', shadow: 'rival', foil: 'rival' });
export const RANK_ROLE = Object.freeze({ boss: 'boss', miniboss: 'boss', elite: 'henchman', minion: 'henchman' });
const coverList = (R, role) => COVER_POSES[R]?.[role] ?? ROLE_POSES[role]?.list ?? COVER_POSES[R]?.hero;
const coverWhy = (R, role) => (COVER_POSES[R]?.[role] ? COVER_POSES[R].why : ROLE_POSES[role]?.why ?? COVER_POSES[R]?.why);

/** the live demo's stand and idle per rail: the stand's words (a preset and its pose words over it, hero-gesture.js) and
 * the idle as changes over that stand, one per key, played as a loop. Each a small, readable move. */
export const LIVE_POSES = Object.freeze({
  comic: {
    stand: { support: 'both', stance: 1.7, stagger: 0, crouch: 0.02, pelvis: 0, hinge: 0, spine: { sideBend: ['left', 0], twist: ['right', 0], arch: 0.12 }, neck: { yaw: 0 }, head: { yaw: 0, pitch: 5 } },
    idle: [{}, { spine: { arch: 0.18 }, head: { pitch: 7 } }, {}, { spine: { arch: 0.15 }, crouch: 0.03 }],
    why: 'feet planted wide, chest out, chin up: the hero holds the frame and breathes',
  },
  realistic: {
    stand: { support: 'both', stance: 1.2, stagger: -0.05, crouch: 0.02, pelvis: 2, spine: { sideBend: ['left', 0.08], twist: ['right', 0.05] }, neck: { yaw: 0 }, head: { yaw: 0, pitch: 0 } },
    idle: [{}, { pelvis: 4, spine: { sideBend: ['left', 0.12] } }, {}, { pelvis: -1, spine: { sideBend: ['right', 0.04] }, head: { yaw: 4 } }],
    why: 'a body on earth: the weight settles from one side to the other, the head level, a glance',
  },
  muscular: {
    stand: 'guard',
    idle: [{}, { crouch: 0.26 }, {}, { crouch: 0.26, head: { pitch: -12 } }],
    why: 'the fighter\'s guard, never still: the knees bounce, the chin tucks',
  },
  mascot: {
    stand: { support: 'both', stance: 1.4, stagger: 0, crouch: 0, pelvis: 0, spine: { sideBend: ['left', 0], twist: ['right', 0] }, neck: { yaw: 0 }, head: { yaw: 8, pitch: 6 } },
    idle: [{}, { crouch: 0.09, head: { pitch: 2 } }, {}, { crouch: 0.09, head: { yaw: -8, pitch: 2 } }],
    why: 'a bob from the knees, the head cocked one way then the other: it wants to play',
  },
});

/** a stable pick from a list by seed and a salt (FNV-1a over the words; no dice) */
function pick(list, seed, salt) {
  let h = 0x811c9dc5;
  for (const c of `${seed}|${salt}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return list[h % list.length];
}
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** the stand's words with a key's changes over them (the nested words merged one level deep) */
const over = (base, d) => { const o = { ...base }; for (const [k, v] of Object.entries(d)) o[k] = isObj(v) && isObj(base[k]) ? { ...base[k], ...v } : v; return o; };
/** a guard's crouch is its own: the idle's crouch is read over it */
const relative = (stand, d) => (d.crouch !== undefined && stand.crouch !== undefined ? { ...d, crouch: stand.crouch + (d.crouch - 0.2) } : d);

/** The words a shown character takes in a context: { context, rail, role, gesture, clips?, why }. */
export function gamePose(rail = null, context = 'cover', { role = 'hero', cast = 'male', core, seed = 1 } = {}) {
  if (!POSE_CONTEXTS.includes(context)) throw new Error(`pose: '${context}' is not a context (${POSE_CONTEXTS.join(', ')})`);
  if (!POSE_ROLES.includes(role)) throw new Error(`pose: '${role}' is not a role (${POSE_ROLES.join(', ')})`);
  const R = rail ?? 'none';
  if (context === 'cover') {
    if (!COVER_POSES[R]) throw new Error(`pose: '${rail}' is not a rail (${Object.keys(COVER_POSES).filter((k) => k !== 'none').join(', ')})`);
    const list = coverList(R, role), word = pick(list, seed, `${R}:${role}`);
    return { context, rail, role, gesture: word, why: `${coverWhy(R, role)} (${word}, of ${list.join(', ')})` };
  }
  const L = LIVE_POSES[R];
  if (!L) return { context, rail, role, gesture: null, why: 'no rail: the live demo plays the hero as it stands' };
  // the stand resolved for the cast (a preset word's entry, or the words written), each idle key the stand changed
  const stand = typeof L.stand === 'string' ? resolveGesture(L.stand, cast, { core }) : resolveGesture(['relaxed', L.stand], cast, { core });
  const keys = L.idle.map((d) => over(stand, typeof L.stand === 'string' ? relative(stand, d) : d));
  return { context, rail, role, gesture: typeof L.stand === 'string' ? L.stand : stand, clips: { idle: keys }, why: L.why };
}

/**
 * A LINEUP's poses (a cast standing in a line, the egocube's preview): each member a showcase its role picks on the
 * rail, no two neighbours alike (the next of its role's own, else another role's), and a member right of the line's
 * middle mirrored, so the line frames toward its centre. `members` [{ path, role }] in line order (left to right as
 * seen); → [{ path, role, gesture, why }].
 */
export function lineupPoses(members, { rail = null, seed = 1 } = {}) {
  const R = rail ?? 'none', out = [], mid = (members.length - 1) / 2;
  if (!COVER_POSES[R]) throw new Error(`pose: '${rail}' is not a rail (${Object.keys(COVER_POSES).filter((k) => k !== 'none').join(', ')})`);
  members.forEach((m, i) => {
    const role = POSE_ROLES.includes(m.role) ? m.role : 'hero', list = coverList(R, role);
    const prev = out[i - 1]?.base, first = pick(list, seed, `${R}:${role}:${m.path}`);
    // (a neighbour's pose taken: the next of the role's own, else the first of the whole rail's not taken)
    const others = [...list.slice(list.indexOf(first) + 1), ...list.slice(0, list.indexOf(first)), ...POSE_ROLES.flatMap((r) => coverList(R, r))];
    const base = first !== prev ? first : others.find((w) => w !== prev) ?? first;
    out.push({ path: m.path, role, base, gesture: i > mid ? `${base}Left` : base, why: coverWhy(R, role) });
  });
  return out.map(({ base: _b, ...x }) => x);
}
