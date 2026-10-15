/**
 * versus compile — a character recipe → the fighter the sim reads.
 *
 * The recipe is words a designer (or the moveset solver) writes: a cast, a few movement dials, a family per normal
 * slot, a special per direction, a super. The compiler turns it into frames: per move, per frame, the pose, the
 * hurtboxes (the trunk, each leg, the striking limb while it is out) and, on active frames, the hitbox, all solved
 * from the rig, so reach, height and whiff windows follow the body. Frame data is derived from the strength row
 * and the designer's intended advantage; nothing in the output is hand-placed.
 *
 *   recipe = {
 *     id, name, cast?: 'heroic' | 'brute' | 'lithe' | 'stout', body?: { …dials },
 *     hp?, walk?: { f, b }, dash?: { f, b }, jump?: { vy, g, vx },
 *     normals: { 'stand.L': { family, strength? }, … },     // the nine slots (versus-library NORMAL_SLOTS)
 *     specials?: { neutral | forward | back | down: { id, motion?, tune? } },
 *     super?: { id, tune? },
 *     throw?: { tune? },
 *     weapon?: 'sword' | … | { kind?, grip?, length?, width?, butt?, angle?, tempo?, damage?, hurt? },
 *     library?: { specials?: { <id>: record }, supers?: { <id>: record } },
 *   }
 *
 * Extending a fighter is editing its recipe, never code:
 *   tune      on any normal, special (flat, or per strength `{ L, M, H }`), the super or the throw: startup, active,
 *             recovery, damage, adv { hit, block }, guard, knock, hitstop, push, chip, meter, travel, and the
 *             primitives below. The stun is still solved from the advantage, the frames re-laid from the poses.
 *   library   the recipe's own specials and supers, the shipped record's shape (versus-library.js SPECIALS, SUPERS),
 *             optionally `from` a shipped one; poses by name ('crouch'), by name and overrides ({ from, armF }), or
 *             written out. Its id goes in a special slot like any other.
 *   primitives (a special's record or row, or a tune): projectile, travel, airborne + vel, invuln [[from, to, kind]],
 *             armor [from, to, hits] (absorbs strikes), profile { low | high: mm, from?, to? } (the hurtboxes
 *             clipped: under a fireball, over a low), riposte [from, to, damage, knock?] (a catch: struck in its
 *             window, it answers), hits, knock, juggle, a command throw (throw: true, reach).
 *   weapon    a blade on the grip hand; its strikes hit with it. The blade is disjointed (no hurtbox while it
 *             swings) and pays for that: its length is taxed in frames, mostly recovery, and its `hurt` leaves it
 *             hurtable through a whiff's recovery unless it says 'none'. Blades that meet clash (versus-core.js).
 *
 * Boxes are [x0, y0, x1, y1] in integer mm, facing +x, relative to the fighter's origin on the ground. The output is
 * plain data (no functions), so a page can compile in the browser from the stored recipe.
 */

import { VERSUS_CASTS, versusBody, rigJoints, lerpPose, segmentBox, pointsBox, roundBox, weaponLine, STRIKE_SEGMENTS } from './versus-rig.js';
import { POSES, STRENGTHS, NORMAL_FAMILIES, NORMAL_SLOTS, THROW, SPECIALS, SPECIAL_SLOTS, SUPERS, SUPER_COST, WEAPONS, WEAPON_HURT } from './versus-library.js';

// movement defaults (mm per frame, frames)
export const MOVEMENT = Object.freeze({
  hp: 1000,
  walk: { f: 52, b: 40 },
  dash: { f: { frames: 18, dist: 1100 }, b: { frames: 22, dist: 850, invuln: 8 } },
  jump: { prejump: 4, vy: 124, g: 6, vx: 38, landing: 3 },
});

// air normals' stun (hitstun, blockstun) by strength: a jump-in lands before the target recovers
const AIR_STUN = { L: [14, 10], M: [17, 13], H: [20, 16] };
const PROJECTILE_STUN = [22, 18];

const ease = (t) => t * t * (3 - 2 * t);
// a push box's half-width in trunk radii in the air (a body in flight is pushed as a column about its pelvis)
const PUSH_HALF = 1.45;
// on the ground two bodies stop where their trunks would touch, as the round body stands them, and this much apart (mm)
const PUSH_GAP = 40;

/** The trunk and leg boxes of a pose, plus the box of a limb when it is out. */
function hurtOf(body, J, limb) {
  const trunk = pointsBox([J.pelvis, J.neck, J.head], body.bodyR);
  trunk[3] = Math.max(trunk[3], J.head[1] + body.head);
  const boxes = [trunk, pointsBox([J.pelvis, J.kneeF, J.ankleF], body.limbR), pointsBox([J.pelvis, J.kneeB, J.ankleB], body.limbR)];
  if (limb) {
    const [a, b] = STRIKE_SEGMENTS[limb];
    boxes.push(segmentBox(J[a], J[b], body.limbR));
  }
  return boxes.map(roundBox);
}

/**
 * A pose's push box. On the ground it is the TRUNK AS THE ROUND BODY STANDS IT (versus-figure.js): the line from the
 * pelvis through the shoulders to the head, fattened by the trunk's half-thickness along the plane, which the stance
 * widens (the chest opened `open` degrees to the camera puts the lead shoulder forward and the rear one back, the
 * shoulder's own thickness, a limb and a half, beyond them); a body leaning into its guard pushes from where its chest
 * is, not from its feet, so two trunks stop short of each other. In the air it is a column about the pelvis, so a jump
 * still crosses over.
 */
function pushOf(body, J, air, open) {
  const top = Math.round(J.neck[1]);
  if (air) {
    const half = Math.round(body.bodyR * PUSH_HALF);
    return [-half, Math.round(Math.min(J.ankleF[1], J.ankleB[1], J.pelvis[1] - body.thigh * 0.5)), half, top];
  }
  const t = Math.max(body.bodyR, body.bodyR * 1.2 * Math.sin(open * Math.PI / 180) + body.limbR * 1.5);
  const xs = [J.pelvis, J.shoulder, J.neck, J.head].map((q) => q[0]);
  return [Math.round(Math.min(...xs) - t), 0, Math.round(Math.max(...xs) + t + PUSH_GAP / 2), top];
}

/** A stance's idle boxes (stand, crouch, air, fall), the push boxes as its stance stands it. */
function idleOf(body, stance) {
  const out = {};
  for (const [k, pose] of [['stand', POSES.guard], ['crouch', POSES.crouch], ['air', POSES.jump], ['fall', POSES.fall]]) {
    const J = rigJoints(body, pose);
    out[k] = { hurt: hurtOf(body, J), push: pushOf(body, J, !!pose.air, stance.open) };
  }
  return out;
}

const stanceRest = (stance) => (stance === 'crouch' ? POSES.crouch : stance === 'air' ? POSES.jump : POSES.guard);

/** Clip boxes to a profile: `low` keeps what is under it (a slide), `high` what is over it (a hop). */
function clipProfile(boxes, pr) {
  const out = [];
  for (const b of boxes) {
    if (pr.low !== undefined) { if (b[1] < pr.low) out.push([b[0], b[1], b[2], Math.min(b[3], pr.low)]); }
    else if (pr.high !== undefined) { if (b[3] > pr.high) out.push([b[0], Math.max(b[1], pr.high), b[2], b[3]]); }
    else out.push(b);
  }
  return out;
}

/**
 * Lay a move's frames: the pose eases guard → load → strike over startup, holds through the active frames, and
 * eases back over recovery; the limb's hurtbox is out from the load to the end of the active frames plus a third of
 * recovery (the whiff window a poke is punished in); an armed move's, through all of it. An armed move hits with
 * its blade too (and marks it, for clashes); the blade is a hurtbox only where the weapon's `hurt` says. A profile clips the hurtboxes in its window.
 */
function layFrames(body, m, shape, weapon = null) {
  const rest = shape.rest ?? stanceRest(m.stance);
  const lastActive = m.startup + m.active - 1;
  const n = m.total;
  const frames = [null];
  const loadAt = Math.max(1, Math.round((m.startup - 1) * 0.6));
  const blade = m.armed ? weapon : null;
  // an armed swing's arm and blade stay out through the whole recovery: the blade's reach is punished at its tip
  const limbOut = blade ? n : lastActive + Math.ceil(m.recovery / 3);
  const pr = m.profile;
  for (let f = 1; f <= n; f++) {
    let pose;
    if (f < m.startup) pose = f <= loadAt ? lerpPose(rest, shape.load, ease(f / loadAt)) : lerpPose(shape.load, shape.strike, ease((f - loadAt) / (m.startup - loadAt)));
    else if (f <= lastActive) pose = shape.strike;
    else pose = lerpPose(shape.strike, shape.after ?? rest, ease((f - lastActive) / Math.max(1, n - lastActive)));
    const J = rigJoints(body, pose);
    const out = f >= loadAt && f <= limbOut;
    let hurt = hurtOf(body, J, out ? m.limb : null);
    const W = blade ? weaponLine(J, blade) : null;
    if (W && out && (blade.hurt === 'always' || (blade.hurt === 'recovery' && f > lastActive))) hurt.push(roundBox(segmentBox(W.grip, W.tip, blade.width)));
    if (pr && f >= (pr.from ?? 1) && f <= (pr.to ?? lastActive)) hurt = clipProfile(hurt, pr);
    const fr = { pose, hurt };
    if (f >= m.startup && f <= lastActive && !m.throw && !m.projectile) {
      const [a, b] = STRIKE_SEGMENTS[m.limb];
      const limb = segmentBox(J[a], J[b], body.limbR * 1.5);
      if (W) {
        const edge = segmentBox(W.grip, W.tip, blade.width);
        fr.blade = roundBox(edge);
        fr.hit = roundBox([Math.min(limb[0], edge[0]), Math.min(limb[1], edge[1]), Math.max(limb[2], edge[2]), Math.max(limb[3], edge[3])]);
      } else fr.hit = roundBox(limb);
    }
    if (m.projectile && f === m.startup) fr.spawn = [Math.round(J.fistF[0]), Math.round(J.fistF[1])];
    frames.push(fr);
  }
  return frames;
}

const reachOf = (frames) => frames.reduce((r, fr) => (fr && fr.hit ? Math.max(r, fr.hit[2]) : r), 0);

/** The stun that makes a move's advantage what the designer meant, measured from its last hit. */
function stunFor(m, adv) {
  const lastHit = m.startup + (m.hits - 1) * m.rehit;
  return adv + (m.total - lastHit);
}

function baseMove(slot, kind, stance, limb) {
  return {
    slot, kind, stance, limb, hits: 1, rehit: 0, juggle: false, knock: 'none', guard: 'mid', chip: 0,
    invuln: [], airborne: null, vel: null, travel: 0, landing: 0, cancel: [], chain: [], meter: 0, cost: 0,
  };
}

// ── tune and primitives ──────────────────────────────────────────────────────────────────────────────────────

const GUARDS = ['mid', 'low', 'overhead'];
const KNOCKS = ['none', 'down', 'launch'];
const INVULN_KINDS = ['strike', 'projectile', 'throw'];
// a tune's integer keys and their floors
const TUNE_INTS = { startup: 1, active: 1, recovery: 1, damage: 0, hitstop: 0, push: 0, chip: 0, meter: 0, travel: -200, landing: 0, speed: 1, hits: 1 };
const TUNE_KEYS = new Set([...Object.keys(TUNE_INTS), 'adv', 'guard', 'knock', 'invuln', 'armor', 'profile', 'riposte', 'juggle', 'vel', 'reach', 'L', 'M', 'H']);

const isInt = (v) => Number.isInteger(v);

/** Check a tune (or a record's primitives); throws on a key or value the compiler cannot read. */
export function readTune(T, where) {
  if (T === undefined || T === null) return {};
  if (typeof T !== 'object' || Array.isArray(T)) throw new Error(`versus: ${where} tune is an object`);
  for (const [k, v] of Object.entries(T)) {
    if (!TUNE_KEYS.has(k)) throw new Error(`versus: ${where} tune has no '${k}' (one of ${[...TUNE_KEYS].join(', ')})`);
    if (k in TUNE_INTS && !(isInt(v) && v >= TUNE_INTS[k] && v <= 999)) throw new Error(`versus: ${where} tune.${k} is a whole number from ${TUNE_INTS[k]} to 999`);
    if (k === 'L' || k === 'M' || k === 'H') readTune(v, `${where}.${k}`);
  }
  if (T.adv !== undefined) {
    if (typeof T.adv !== 'object') throw new Error(`versus: ${where} tune.adv is { hit?, block? }`);
    for (const k of Object.keys(T.adv)) if (!['hit', 'block'].includes(k) || !isInt(T.adv[k]) || Math.abs(T.adv[k]) > 99) throw new Error(`versus: ${where} tune.adv.${k} is a whole number of frames (hit, block)`);
  }
  if (T.guard !== undefined && !GUARDS.includes(T.guard)) throw new Error(`versus: ${where} tune.guard is one of ${GUARDS.join(', ')}`);
  if (T.knock !== undefined && !KNOCKS.includes(T.knock)) throw new Error(`versus: ${where} tune.knock is one of ${KNOCKS.join(', ')}`);
  return T;
}

/** A tune key that this move would carry and never read is refused, so a recipe never says what the fight ignores. */
function refuse(T, keys, where, what) {
  for (const k of keys) if (T[k] !== undefined) throw new Error(`versus: ${where} tune.${k} does nothing on ${what}`);
}
// what only some moves read: a projectile its speed, an airborne move its vel and landing, a throw its reach
const SHAPE_KEYS = ['speed', 'vel', 'landing', 'reach'];
const STRENGTH_ROWS = ['L', 'M', 'H'];
// what a throw never reads: it is unblockable and lands when the clinch ends
const THROW_IGNORES = ['hitstop', 'push', 'chip', 'guard', 'knock', 'juggle', 'adv', 'hits', 'speed', 'vel', 'landing'];

/** A tune row for one strength: the flat keys, then the strength's own. */
const tuneAt = (T, st) => {
  const { L, M, H, ...flat } = T;
  return { ...flat, ...(({ L, M, H })[st] ?? {}) };
};

/** invuln as written ([[from, to, kind | 'all']]) → the record's triples. */
function readInvuln(v, where) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`versus: ${where} invuln is [[from, to, kind], …]`);
  const out = [];
  for (const w of v) {
    const [a, b, k = 'all'] = w ?? [];
    if (!isInt(a) || !isInt(b) || a < 1 || b < a) throw new Error(`versus: ${where} invuln window [${a}, ${b}] is frames from 1`);
    if (k !== 'all' && !INVULN_KINDS.includes(k)) throw new Error(`versus: ${where} invuln kind '${k}' is one of ${INVULN_KINDS.join(', ')}, all`);
    for (const kind of k === 'all' ? INVULN_KINDS : [k]) out.push([a, b, kind]);
  }
  return out;
}

/** The primitives a record or a tune carries, onto a compiled move (invuln adds; the rest replace). */
function primitives(m, R, where) {
  if (!R) return;
  m.invuln.push(...readInvuln(R.invuln, where));
  if (R.armor !== undefined) {
    const [a, b, n = 1] = R.armor;
    if (!isInt(a) || !isInt(b) || a < 1 || b < a || !isInt(n) || n < 1) throw new Error(`versus: ${where} armor is [from, to, hits]`);
    m.armor = [a, b, n];
  }
  if (R.profile !== undefined) {
    const pr = R.profile;
    if (!pr || (pr.low === undefined) === (pr.high === undefined)) throw new Error(`versus: ${where} profile is { low: mm } or { high: mm } (and from?, to?)`);
    m.profile = { ...pr };
  }
  if (R.riposte !== undefined) {
    const [a, b, dmg = 100, knock = 'down'] = R.riposte;
    if (!isInt(a) || !isInt(b) || a < 1 || b < a || !isInt(dmg) || !KNOCKS.includes(knock)) throw new Error(`versus: ${where} riposte is [from, to, damage?, knock?]`);
    m.riposte = [a, b, dmg, knock];
  }
}

/** A tune's frame and hit keys onto a compiled move; → the advantage it asks for (merged over `adv`). */
function applyTune(m, T, adv) {
  for (const k of ['startup', 'active', 'recovery', 'damage', 'hitstop', 'push', 'chip', 'meter', 'travel']) if (T[k] !== undefined) m[k] = T[k];
  if (T.guard) m.guard = T.guard;
  if (T.knock) m.knock = T.knock;
  if (T.juggle !== undefined) m.juggle = !!T.juggle;
  const keys = Object.keys(T).filter((k) => k !== 'L' && k !== 'M' && k !== 'H');
  if (keys.length) m.tuned = keys;
  return { ...adv, ...(T.adv ?? {}) };
}

// ── weapons ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A recipe's weapon (a word or dials) → the compiled weapon, lengths in mm on this body; null if none. */
export function readWeapon(w, body) {
  if (w === undefined || w === null || w === false) return null;
  const spec = typeof w === 'string' ? { kind: w } : w;
  if (typeof spec !== 'object') throw new Error('versus: weapon is a word or { kind?, … }');
  const base = spec.kind ? WEAPONS[spec.kind] : WEAPONS.sword;
  if (!base) throw new Error(`versus: weapon '${spec.kind}' is one of ${Object.keys(WEAPONS).join(', ')}`);
  const W = { ...base, ...spec };
  if (W.grip !== 'F' && W.grip !== 'B') throw new Error("versus: weapon grip is 'F' (lead hand) or 'B' (rear)");
  if (!WEAPON_HURT.includes(W.hurt)) throw new Error(`versus: weapon hurt is one of ${WEAPON_HURT.join(', ')}`);
  for (const k of ['length', 'tempo', 'damage']) if (!(typeof W[k] === 'number' && W[k] > 0 && W[k] <= 3)) throw new Error(`versus: weapon ${k} is a number above 0 (up to 3)`);
  const k = body.height / 1800;
  return {
    kind: spec.kind ?? 'sword', grip: W.grip, limb: `fist${W.grip}`,
    length: Math.round(W.length * body.height), butt: Math.round((W.butt ?? 0) * body.height), width: Math.round((W.width ?? 45) * k),
    angle: W.angle ?? 0, tempo: W.tempo, damage: W.damage, hurt: W.hurt, color: W.color ?? '#dde2ea',
  };
}

/** Does this move swing the weapon? A strike with the grip hand, unless its shape says `armed: false`. */
const armedFor = (m, shape, weapon) => !!weapon && m.limb === weapon.limb && shape.armed !== false && !m.throw && !m.projectile;

/** The blade's frames: a frame of startup per 0.36 of the height it reaches past the fist, one of recovery per 0.12. */
export const bladeTax = (body, weapon) => ({
  startup: Math.round(weapon.length / (body.height * 0.36)),
  recovery: Math.round(weapon.length / (body.height * 0.12)),
});

// ── library ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A pose as written: a name, { from: name, …overrides }, or angles. */
export function readPose(v, where) {
  if (typeof v === 'string') {
    if (!POSES[v]) throw new Error(`versus: ${where} pose '${v}' is one of ${Object.keys(POSES).join(', ')}`);
    return POSES[v];
  }
  if (!v || typeof v !== 'object') throw new Error(`versus: ${where} is a pose (a name, { from, … }, or angles)`);
  const { from, ...rest } = v;
  if (from !== undefined && !POSES[from]) throw new Error(`versus: ${where} pose from '${from}' is one of ${Object.keys(POSES).join(', ')}`);
  return from ? { ...POSES[from], ...rest } : rest;
}

const STRENGTH_KEYS = ['L', 'M', 'H'];
const perStrength = (at) => (at && STRENGTH_KEYS.some((k) => at[k]) ? at : { L: at ?? {}, M: at ?? {}, H: at ?? {} });

/** A classic motion as written: numpad digits, 2 to 8 of them ('236', '623', '41236'). */
export function readMotion(v, where) {
  if (typeof v !== 'string' || !/^[1-9]{2,8}$/.test(v)) throw new Error(`versus: ${where} motion is 2 to 8 numpad digits (6 toward the opponent: '236', '623', '214')`);
  return v;
}

/** A recipe's own special (maybe `from` a shipped one) → a record compileSpecial reads. */
function readSpecial(id, rec, specials) {
  const where = `special '${id}'`;
  const base = rec.from ? specials[rec.from] : {};
  if (rec.from && !base) throw new Error(`versus: ${where} from '${rec.from}' is not a special`);
  const at = perStrength(rec.at);
  const baseAt = base.at ?? {};
  const out = {
    rps: 'rush', motion: '236', guard: 'mid', hitstop: 10, push: 180, meter: 40,
    ...base, ...rec,
    at: Object.fromEntries(STRENGTH_KEYS.map((k) => [k, { ...(baseAt[k] ?? {}), ...(at[k] ?? {}) }])),
    custom: true,
  };
  delete out.from;
  for (const k of ['load', 'strike', 'after', 'rest']) if (rec[k] !== undefined) out[k] = readPose(rec[k], `${where} ${k}`);
  if (!out.load || !out.strike) throw new Error(`versus: ${where} needs a load and a strike pose`);
  readMotion(out.motion, where);
  if (!STRIKE_SEGMENTS[out.limb]) throw new Error(`versus: ${where} limb is one of ${Object.keys(STRIKE_SEGMENTS).join(', ')}`);
  if (out.projectile && !(out.projectile.w > 0 && out.projectile.h > 0)) throw new Error(`versus: ${where} projectile is { w, h, y?, life? }`);
  if (out.projectile) out.projectile = { y: 0, life: 150, ...out.projectile };
  for (const k of STRENGTH_KEYS) {
    const row = out.at[k];
    readTune(row, `${where} at.${k}`);
    if (!isInt(row.startup)) throw new Error(`versus: ${where} at.${k} needs a startup`);
    if (!out.airborne && !isInt(row.recovery)) throw new Error(`versus: ${where} at.${k} needs a recovery (or the move is airborne)`);
    if (out.airborne && !(Array.isArray(row.vel) && isInt(row.landing))) throw new Error(`versus: ${where} at.${k} is airborne: it needs vel [x, y] and landing`);
    if (out.projectile && !isInt(row.speed)) throw new Error(`versus: ${where} at.${k} throws a projectile: it needs a speed`);
    if (row.damage === undefined && out.damage === undefined && !out.throw) throw new Error(`versus: ${where} at.${k} needs damage`);
  }
  return out;
}

/** A recipe's own super (from a shipped super, or the shape of a special) → a record compileSuper reads. */
function readSuper(id, rec, specials) {
  const where = `super '${id}'`;
  const like = SUPERS[rec.from];
  const out = { freeze: 40, invuln: 8, ...(like ?? {}), ...rec, from: like ? like.from : rec.from, custom: true };
  if (!specials[out.from]) throw new Error(`versus: ${where} from '${rec.from}' is a super or a special`);
  for (const k of ['startup', 'damage']) if (!isInt(out[k])) throw new Error(`versus: ${where} needs ${k}`);
  return out;
}

/** The shelves a recipe compiles against: the shipped ones plus its own. */
export function libraryOf(recipe = {}) {
  const lib = recipe.library ?? {};
  const specials = { ...SPECIALS };
  for (const [id, rec] of Object.entries(lib.specials ?? {})) specials[id] = readSpecial(id, rec, specials);
  const supers = { ...SUPERS };
  for (const [id, rec] of Object.entries(lib.supers ?? {})) supers[id] = readSuper(id, rec, specials);
  return { specials, supers };
}

/**
 * Reach costs frames: a strike that lands beyond an arm's length (relative to the body's height) pays a frame of
 * startup and of recovery per step of extra reach, so a long kick is slower than a jab on every body.
 */
export function reachTax(body, fam) {
  if (fam.stance === 'air') return 0;
  const J = rigJoints(body, fam.strike);
  const [a, b] = STRIKE_SEGMENTS[fam.limb];
  const reach = segmentBox(J[a], J[b], body.limbR * 1.5)[2];
  return Math.max(0, Math.round((reach - body.height * 0.48) / (body.height * 0.09)));
}

/** A normal slot (`stand.M`) with its family, strength and tune → a compiled move. */
export function compileNormal(body, slot, { family, strength, tune } = {}, weapon = null) {
  const fam = NORMAL_FAMILIES[family];
  if (!fam) throw new Error(`versus: ${slot} family '${family}' is not one of ${Object.keys(NORMAL_FAMILIES).join(', ')}`);
  const [stance, letter] = slot.split('.');
  if (fam.stance !== stance) throw new Error(`versus: ${slot} wants a ${stance} family; '${family}' is a ${fam.stance} move`);
  const T = readTune(tune, slot);
  refuse(T, [...SHAPE_KEYS, ...STRENGTH_ROWS], slot, 'a normal');
  if (stance === 'air') refuse(T, ['adv', 'travel', 'armor', 'riposte'], slot, 'an air normal (a jump-in flies its arc; its stun is its strength\'s)');
  const st = STRENGTHS[strength ?? letter];
  const m = baseMove(slot, 'normal', stance, fam.limb);
  m.id = family;
  m.strength = strength ?? letter;
  const armed = armedFor(m, fam, weapon);
  if (armed) m.armed = true;
  const tax = reachTax(body, fam);
  const tempo = fam.tempo * (armed ? weapon.tempo : 1);
  const blade = armed && stance !== 'air' ? bladeTax(body, weapon) : { startup: 0, recovery: 0 };
  m.startup = Math.max(3, Math.round(st.startup * tempo) + tax + blade.startup);
  m.active = st.active;
  m.recovery = Math.max(4, Math.round(st.recovery * tempo) + tax + blade.recovery);
  m.damage = armed ? Math.round(st.damage * weapon.damage) : st.damage;
  m.hitstop = st.hitstop;
  m.push = st.push;
  m.meter = st.meter;
  m.guard = fam.guard ?? (stance === 'air' ? 'overhead' : 'mid');
  m.knock = fam.knock ?? 'none';
  m.antiAir = !!fam.antiAir;
  if (armed) m.disjoint = weapon.length;
  const adv = applyTune(m, T, { ...st.adv, ...(fam.adv ?? {}) });
  primitives(m, T, slot);
  if (T.hits !== undefined) {
    // a multi-hit normal: its damage is the total, shared, one hit every active / hits frames
    if (T.hits > m.active) throw new Error(`versus: ${slot} tune.hits ${T.hits} needs at least as many active frames (${m.active})`);
    m.hits = T.hits;
    m.rehit = m.hits > 1 ? Math.floor(m.active / m.hits) : 0;
    m.damage = Math.round(m.damage / m.hits);
  }
  m.total = m.startup + m.active - 1 + m.recovery;
  if (stance === 'air') {
    [m.hitstun, m.blockstun] = AIR_STUN[m.strength];
  } else {
    m.hitstun = stunFor(m, adv.hit);
    m.blockstun = stunFor(m, adv.block);
    m.cancel = ['special', 'super'];
    if (m.strength === 'L') m.chain = ['stand.L', 'crouch.L'];
  }
  m.frames = layFrames(body, m, fam, weapon);
  m.reach = reachOf(m.frames);
  return m;
}

/** The throw: its reach a short arm's length from the body, shorter than any normal. */
export function compileThrow(body, slot = 'throw', over = {}) {
  const m = baseMove(slot, 'throw', 'stand', THROW.limb);
  Object.assign(m, { id: 'throw', startup: THROW.startup, active: THROW.active, recovery: THROW.recovery, damage: THROW.damage, hitstop: 0, push: 0, meter: THROW.meter });
  const T = readTune(over.tune, slot);
  refuse(T, [...THROW_IGNORES, ...STRENGTH_ROWS], slot, 'a throw');
  m.throw = { range: Math.round(body.bodyR * PUSH_HALF + body.upper * 0.9 * (T.reach ?? over.reach ?? 1)), tech: over.techable === false ? 0 : THROW.tech, clinch: over.clinch ?? THROW.clinch };
  if (over.damage) m.damage = over.damage;
  applyTune(m, T, {});
  primitives(m, T, slot);
  m.total = m.startup + m.active - 1 + m.recovery;
  m.frames = layFrames(body, m, THROW);
  m.reach = m.throw.range;
  return m;
}

/**
 * A special at a strength (L / M / H) → a compiled move. o: { lib (the specials shelf, libraryOf), tune, weapon }.
 */
export function compileSpecial(body, slot, id, strength = 'M', o = {}) {
  const lib = o.lib ?? SPECIALS;
  const base = lib[id];
  if (!base) throw new Error(`versus: special '${id}' is not one of ${Object.keys(lib).join(', ')}`);
  const T = tuneAt(readTune(o.tune, slot), strength);
  if (base.throw) refuse(T, [...THROW_IGNORES, 'speed'], slot, `${id} (a command throw)`);
  else {
    if (!base.projectile) refuse(T, ['speed'], slot, `${id} (it throws no projectile)`);
    else refuse(T, ['adv', 'hits', 'active', 'guard', 'knock', 'juggle'], slot, `${id} (a projectile is blocked mid, hits once and its stun is its own)`);
    if (!base.airborne) refuse(T, ['vel', 'landing'], slot, `${id} (it does not leave the ground)`);
    else refuse(T, ['recovery', 'adv'], slot, `${id} (airborne: it ends on landing, a tune sets landing)`);
    refuse(T, ['reach'], slot, `${id} (only a throw reaches)`);
  }
  // a tune rides the strength's row (frames, damage, travel, …) and the record (guard, chip, hitstop, …)
  const at = { ...base.at[strength], ...T, adv: { ...(base.adv ?? {}), ...(base.at[strength].adv ?? {}), ...(T.adv ?? {}) } };
  const sp = { ...base, ...T, knock: base.knock };
  if (sp.throw) {
    const m = compileThrow(body, slot, { reach: at.reach, techable: false, clinch: sp.clinch, damage: at.damage });
    Object.assign(m, { id, kind: 'special', strength, rps: sp.rps, startup: at.startup, active: at.active ?? 3, recovery: at.recovery, meter: sp.meter ?? m.meter });
    if (at.travel) m.travel = at.travel;
    primitives(m, at, `${slot}.${strength}`);
    if (T.invuln === undefined && base.invuln) primitives(m, { invuln: base.invuln }, slot);
    m.total = m.startup + m.active - 1 + m.recovery;
    m.frames = layFrames(body, m, sp);
    if (m.tuned === undefined && Object.keys(T).length) m.tuned = Object.keys(T);
    return m;
  }
  const m = baseMove(slot, 'special', 'stand', sp.limb);
  Object.assign(m, { id, strength, rps: sp.rps, guard: sp.guard ?? 'mid', knock: at.knock ?? sp.knock ?? 'none', chip: sp.chip ?? 0, hitstop: sp.hitstop ?? 10, push: sp.push ?? 180, meter: sp.meter ?? 40 });
  m.damage = at.damage ?? sp.damage;
  m.startup = at.startup;
  m.active = at.active ?? 1;
  m.hits = sp.hits ?? 1;
  m.rehit = m.hits > 1 ? Math.max(1, Math.floor(m.active / m.hits)) : 0;
  m.damage = Math.round(m.damage / m.hits); // a multi-hit's damage is its total, shared
  m.juggle = !!sp.juggle;
  m.cancel = ['super'];
  if (isInt(at.invuln)) m.invuln.push([1, at.invuln, 'strike'], [1, at.invuln, 'projectile']);
  else primitives(m, { invuln: at.invuln }, `${slot}.${strength}`);
  primitives(m, { armor: at.armor ?? sp.armor, profile: at.profile ?? sp.profile, riposte: at.riposte ?? sp.riposte }, `${slot}.${strength}`);
  if (sp.airborne) {
    m.airborne = [sp.airborne, 999];
    m.vel = { [sp.airborne]: at.vel };
    m.landing = at.landing;
    m.recovery = 20; // the fall after the active frames; the move ends on landing
    m.invuln.push([sp.airborne, 999, 'throw']);
  } else {
    m.recovery = at.recovery;
  }
  if (at.travel) m.travel = at.travel;
  if (armedFor(m, sp, o.weapon)) m.armed = true;
  if (m.armed) { m.damage = Math.round(m.damage * o.weapon.damage); m.disjoint = o.weapon.length; }
  m.total = m.startup + m.active - 1 + m.recovery;
  if (sp.projectile) {
    m.projectile = { ...sp.projectile, speed: at.speed, damage: m.damage, chip: m.chip, hitstun: PROJECTILE_STUN[0], blockstun: PROJECTILE_STUN[1], hits: 1, rehit: 0, hitstop: m.hitstop, push: m.push };
    m.active = 1;
    m.hitstun = PROJECTILE_STUN[0];
    m.blockstun = PROJECTILE_STUN[1];
  } else if (m.airborne) {
    m.hitstun = 60; // launched: the fall and the knockdown take over
    m.blockstun = 20;
  } else {
    const adv = { hit: 0, block: -4, ...at.adv };
    m.hitstun = stunFor(m, adv.hit);
    m.blockstun = stunFor(m, adv.block);
  }
  if (Object.keys(T).length) m.tuned = Object.keys(T);
  m.frames = layFrames(body, m, { ...sp, after: sp.after ?? (m.airborne ? POSES.fall : undefined) }, o.weapon);
  m.reach = reachOf(m.frames);
  return m;
}

/** The super: its special's shape at full meter, invincible to start, with a freeze. o: { lib, supers, tune, weapon }. */
export function compileSuper(body, id, o = {}) {
  const supers = o.supers ?? SUPERS;
  const lib = o.lib ?? SPECIALS;
  const base = supers[id];
  if (!base) throw new Error(`versus: super '${id}' is not one of ${Object.keys(supers).join(', ')}`);
  const T = readTune(o.tune, 'super');
  const su = { ...base, ...T };
  const sp = lib[su.from];
  refuse(T, STRENGTH_ROWS, 'super', 'a super (it has one strength)');
  const shot = !!(su.projectile ?? (sp.projectile && su.speed));
  if (sp.throw) refuse(T, [...THROW_IGNORES, 'speed'], 'super', `${id} (a throw)`);
  else {
    if (!shot) refuse(T, ['speed'], 'super', `${id} (it throws no projectile)`);
    else refuse(T, ['adv', 'active', 'guard', 'knock', 'juggle'], 'super', `${id} (a projectile is blocked mid, knocks down and its stun is its own)`);
    if (!sp.airborne) refuse(T, ['vel', 'landing'], 'super', `${id} (it does not leave the ground)`);
    else refuse(T, ['recovery', 'adv'], 'super', `${id} (airborne: it ends on landing, a tune sets landing)`);
    refuse(T, ['reach'], 'super', `${id} (only a throw reaches)`);
  }
  let m;
  if (sp.throw) {
    m = compileThrow(body, 'super', { reach: su.reach, techable: false, clinch: su.clinch, damage: su.damage });
    Object.assign(m, { startup: su.startup, active: su.active ?? 4, recovery: su.recovery });
    if (su.travel) m.travel = su.travel;
  } else {
    m = baseMove('super', 'super', 'stand', sp.limb);
    Object.assign(m, { guard: su.guard ?? sp.guard ?? 'mid', knock: su.knock ?? 'down', chip: su.chip ?? 30, hitstop: su.hitstop ?? 6, push: su.push ?? 120, damage: su.damage, startup: su.startup, active: su.active ?? 1 });
    m.hits = su.hits ?? 1;
    m.rehit = su.rehit ?? 0;
    m.juggle = su.juggle ?? true;
    if (sp.airborne) {
      m.airborne = [sp.airborne, 999];
      m.vel = { [sp.airborne]: su.vel };
      m.landing = su.landing;
      m.recovery = 24;
    } else m.recovery = su.recovery;
    if (su.travel) m.travel = su.travel;
  }
  Object.assign(m, { id, kind: 'super', cost: SUPER_COST, freeze: su.freeze, rps: sp.rps });
  if (su.meter !== undefined) m.meter = su.meter;
  if (isInt(su.invuln)) m.invuln = [...m.invuln, [1, su.invuln, 'strike'], [1, su.invuln, 'projectile'], [1, su.invuln, 'throw']];
  else primitives(m, { invuln: su.invuln }, 'super');
  primitives(m, { armor: su.armor, profile: su.profile, riposte: su.riposte }, 'super');
  if (armedFor(m, sp, o.weapon)) m.armed = true;
  if (m.armed) { m.damage = Math.round(m.damage * o.weapon.damage); m.disjoint = o.weapon.length; }
  m.total = m.startup + m.active - 1 + m.recovery;
  const projectile = su.projectile ?? (sp.projectile && su.speed ? { ...sp.projectile } : null);
  if (projectile) {
    const hits = su.hits ?? 1;
    m.projectile = { y: 0, life: 90, ...projectile, speed: su.speed, damage: Math.round(su.damage / hits), chip: Math.round((su.chip ?? 30) / hits), hitstun: 30, blockstun: 20, hits, rehit: su.rehit ?? 0, hitstop: su.hitstop ?? 4, push: su.push ?? 60 };
    m.active = 1;
    m.total = m.startup + m.recovery;
  }
  if (!m.throw) {
    if (m.hits > 1 && !m.projectile) m.damage = Math.round(m.damage / m.hits);
    const adv = { hit: 20, block: -16, ...(T.adv ?? {}) };
    m.hitstun = m.airborne ? 60 : stunFor(m, adv.hit);
    m.blockstun = stunFor(m, adv.block);
  }
  if (Object.keys(T).length) m.tuned = Object.keys(T);
  m.frames = layFrames(body, m, { ...sp, after: sp.after ?? (m.airborne ? POSES.fall : undefined) }, o.weapon);
  m.reach = m.throw ? m.throw.range : reachOf(m.frames);
  return m;
}

/** Derived advantage on hit and on block, from the first active frame (what a frame-data table prints). */
export function frameAdvantage(m) {
  if (m.stance === 'air') return { hit: null, block: null }; // a jump-in's advantage is the height it hits at
  if (m.throw || m.projectile || m.knock !== 'none' || m.airborne) return { hit: null, block: m.airborne ? -(m.landing + 20) : (m.throw ? null : m.blockstun - (m.total - m.startup)) };
  const after = m.total - (m.startup + (m.hits - 1) * m.rehit);
  return { hit: m.hitstun - after, block: m.blockstun - after };
}

// the movement a recipe may set: whole numbers from a floor to a ceiling (the sim's state stays integers)
const MOVEMENT_DIALS = {
  walk: { f: [0, 400], b: [0, 400] },
  jump: { prejump: [1, 30], vy: [1, 400], g: [1, 100], vx: [0, 400], landing: [0, 60] },
  dashF: { frames: [1, 99], dist: [0, 9999] },
  dashB: { frames: [1, 99], dist: [0, 9999], invuln: [0, 99] },
};
// the STANCE a fighter stands in (degrees; versus-figure.js reads it, the sim never does): how far the chest opens to
// the camera, how far the hips follow, and the SIDE TILT, the trunk bent toward the camera so the shoulder line runs on
// a diagonal and the torso reads in the silhouette
export const STANCE_DIALS = { open: [0, 70], hips: [0, 60], tilt: [-20, 25] };
export const DEFAULT_STANCE = Object.freeze({ open: 45, hips: 28, tilt: 8 });
export const BODY_DIALS = { height: [1000, 2600], arm: [0.5, 2], leg: [0.5, 2], torso: [0.5, 2], girth: [0.5, 2] };

function readDials(v, dials, where) {
  if (v === undefined) return;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`versus: ${where} is { ${Object.keys(dials).join(', ')} }`);
  for (const [k, n] of Object.entries(v)) {
    if (!dials[k]) throw new Error(`versus: ${where} has no '${k}' (one of ${Object.keys(dials).join(', ')})`);
    const [lo, hi] = dials[k];
    if (!(isInt(n) && n >= lo && n <= hi)) throw new Error(`versus: ${where}.${k} is a whole number from ${lo} to ${hi}`);
  }
}

/** A recipe's cast, body and movement; throws naming what it cannot read. */
export function readMovement(recipe) {
  const id = recipe.id ?? 'fighter';
  if (recipe.cast !== undefined && !VERSUS_CASTS[recipe.cast]) throw new Error(`versus: ${id} cast '${recipe.cast}' is one of ${Object.keys(VERSUS_CASTS).join(', ')}`);
  if (recipe.body !== undefined) {
    if (!recipe.body || typeof recipe.body !== 'object' || Array.isArray(recipe.body)) throw new Error(`versus: ${id} body is { ${Object.keys(BODY_DIALS).join(', ')} }`);
    for (const [k, n] of Object.entries(recipe.body)) {
      if (!BODY_DIALS[k]) throw new Error(`versus: ${id} body has no '${k}' (one of ${Object.keys(BODY_DIALS).join(', ')})`);
      const [lo, hi] = BODY_DIALS[k];
      if (!(typeof n === 'number' && n >= lo && n <= hi)) throw new Error(`versus: ${id} body.${k} is a number from ${lo} to ${hi}`);
    }
  }
  if (recipe.stance !== undefined) {
    if (!recipe.stance || typeof recipe.stance !== 'object' || Array.isArray(recipe.stance)) throw new Error(`versus: ${id} stance is { ${Object.keys(STANCE_DIALS).join(', ')} } (degrees)`);
    for (const [k, n] of Object.entries(recipe.stance)) {
      if (!STANCE_DIALS[k]) throw new Error(`versus: ${id} stance has no '${k}' (one of ${Object.keys(STANCE_DIALS).join(', ')})`);
      const [lo, hi] = STANCE_DIALS[k];
      if (!(typeof n === 'number' && n >= lo && n <= hi)) throw new Error(`versus: ${id} stance.${k} is degrees from ${lo} to ${hi}`);
    }
  }
  if (recipe.hp !== undefined && !(isInt(recipe.hp) && recipe.hp >= 1 && recipe.hp <= 99999)) throw new Error(`versus: ${id} hp is a whole number from 1 to 99999`);
  readDials(recipe.walk, MOVEMENT_DIALS.walk, `${id} walk`);
  readDials(recipe.jump, MOVEMENT_DIALS.jump, `${id} jump`);
  if (recipe.dash !== undefined) {
    if (!recipe.dash || typeof recipe.dash !== 'object' || Array.isArray(recipe.dash)) throw new Error(`versus: ${id} dash is { f?, b? }`);
    for (const k of Object.keys(recipe.dash)) if (k !== 'f' && k !== 'b') throw new Error(`versus: ${id} dash has no '${k}' (f, b)`);
    readDials(recipe.dash.f, MOVEMENT_DIALS.dashF, `${id} dash.f`);
    readDials(recipe.dash.b, MOVEMENT_DIALS.dashB, `${id} dash.b`);
  }
}

/** A recipe → the compiled fighter (plain data). */
export function compileFighter(recipe) {
  if (!recipe || typeof recipe !== 'object') throw new Error('versus: a fighter recipe is an object');
  readMovement(recipe);
  const body = versusBody(recipe.cast ?? 'heroic', recipe.body ?? {});
  const weapon = readWeapon(recipe.weapon, body);
  const { specials, supers } = libraryOf(recipe);
  const moves = {};
  for (const slot of NORMAL_SLOTS) {
    const n = recipe.normals?.[slot];
    if (!n) throw new Error(`versus: ${recipe.id ?? 'fighter'} has no ${slot} (normals: ${NORMAL_SLOTS.join(', ')})`);
    moves[slot] = compileNormal(body, slot, n, weapon);
  }
  moves.throw = compileThrow(body, 'throw', { tune: recipe.throw?.tune });
  for (const dir of SPECIAL_SLOTS) {
    const s = recipe.specials?.[dir];
    if (!s) continue;
    for (const st of ['L', 'M', 'H']) {
      const m = compileSpecial(body, `special.${dir}`, s.id, st, { lib: specials, tune: s.tune, weapon });
      m.motion = readMotion(s.motion ?? specials[s.id].motion, `special.${dir}`);
      moves[`special.${dir}.${st}`] = m;
    }
  }
  if (recipe.super) moves.super = compileSuper(body, recipe.super.id, { lib: specials, supers, tune: recipe.super.tune, weapon });
  for (const m of Object.values(moves)) m.adv = frameAdvantage(m);
  const jump = { ...MOVEMENT.jump, ...(recipe.jump ?? {}) };
  const stance = { ...DEFAULT_STANCE, ...(recipe.stance ?? {}) };
  const idle = idleOf(body, stance);
  // a grab reaches an arm's length past the chest: from the push box's front as the stance stands it
  const chest = idle.stand.push[2] - Math.round(body.bodyR * PUSH_HALF);
  for (const m of Object.values(moves)) if (m.throw) { m.throw.range += chest; m.reach = m.throw.range; }
  return {
    id: recipe.id ?? 'fighter',
    name: recipe.name ?? recipe.id ?? 'Fighter',
    archetype: recipe.archetype ?? null,
    cast: recipe.cast ?? 'heroic',
    body: Object.fromEntries(Object.entries(body).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
    hp: recipe.hp ?? MOVEMENT.hp,
    walk: { ...MOVEMENT.walk, ...(recipe.walk ?? {}) },
    dash: { f: { ...MOVEMENT.dash.f, ...(recipe.dash?.f ?? {}) }, b: { ...MOVEMENT.dash.b, ...(recipe.dash?.b ?? {}) } },
    jump,
    idle,
    stance,
    ...(weapon ? { weapon } : {}),
    moves,
  };
}
