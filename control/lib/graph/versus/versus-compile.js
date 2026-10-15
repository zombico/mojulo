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
 *     specials?: { neutral | forward | back | down: { id, motion? } },
 *     super?: { id },
 *   }
 *
 * Boxes are [x0, y0, x1, y1] in integer mm, facing +x, relative to the fighter's origin on the ground. The output is
 * plain data (no functions), so a page can compile in the browser from the stored recipe.
 */

import { versusBody, rigJoints, lerpPose, segmentBox, pointsBox, roundBox, STRIKE_SEGMENTS } from './versus-rig.js';
import { POSES, STRENGTHS, NORMAL_FAMILIES, NORMAL_SLOTS, THROW, SPECIALS, SPECIAL_SLOTS, SUPERS, SUPER_COST } from './versus-library.js';

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
// a push box's half-width in trunk radii: two bodies stop a little wider than their trunks, as they read on screen
const PUSH_HALF = 1.45;

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

function pushOf(body, J, air) {
  const half = Math.round(body.bodyR * PUSH_HALF);
  const y0 = air ? Math.round(Math.min(J.ankleF[1], J.ankleB[1], J.pelvis[1] - body.thigh * 0.5)) : 0;
  return [-half, y0, half, Math.round(J.neck[1])];
}

/** A stance's idle boxes (stand, crouch, air, fall). */
function idleOf(body) {
  const out = {};
  for (const [k, pose] of [['stand', POSES.guard], ['crouch', POSES.crouch], ['air', POSES.jump], ['fall', POSES.fall]]) {
    const J = rigJoints(body, pose);
    out[k] = { hurt: hurtOf(body, J), push: pushOf(body, J, !!pose.air) };
  }
  return out;
}

const stanceRest = (stance) => (stance === 'crouch' ? POSES.crouch : stance === 'air' ? POSES.jump : POSES.guard);

/**
 * Lay a move's frames: the pose eases guard → load → strike over startup, holds through the active frames, and
 * eases back over recovery; the limb's hurtbox is out from the load to the end of the active frames plus a third of
 * recovery (the whiff window a poke is punished in).
 */
function layFrames(body, m, shape) {
  const rest = shape.rest ?? stanceRest(m.stance);
  const lastActive = m.startup + m.active - 1;
  const n = m.total;
  const frames = [null];
  const loadAt = Math.max(1, Math.round((m.startup - 1) * 0.6));
  const limbOut = lastActive + Math.ceil(m.recovery / 3);
  for (let f = 1; f <= n; f++) {
    let pose;
    if (f < m.startup) pose = f <= loadAt ? lerpPose(rest, shape.load, ease(f / loadAt)) : lerpPose(shape.load, shape.strike, ease((f - loadAt) / (m.startup - loadAt)));
    else if (f <= lastActive) pose = shape.strike;
    else pose = lerpPose(shape.strike, shape.after ?? rest, ease((f - lastActive) / Math.max(1, n - lastActive)));
    const J = rigJoints(body, pose);
    const fr = { pose, hurt: hurtOf(body, J, f >= loadAt && f <= limbOut ? m.limb : null) };
    if (f >= m.startup && f <= lastActive && !m.throw && !m.projectile) {
      const [a, b] = STRIKE_SEGMENTS[m.limb];
      fr.hit = roundBox(segmentBox(J[a], J[b], body.limbR * 1.5));
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

/** A normal slot (`stand.M`) with its family and strength → a compiled move. */
export function compileNormal(body, slot, { family, strength } = {}) {
  const fam = NORMAL_FAMILIES[family];
  if (!fam) throw new Error(`versus: ${slot} family '${family}' is not one of ${Object.keys(NORMAL_FAMILIES).join(', ')}`);
  const [stance, letter] = slot.split('.');
  if (fam.stance !== stance) throw new Error(`versus: ${slot} wants a ${stance} family; '${family}' is a ${fam.stance} move`);
  const st = STRENGTHS[strength ?? letter];
  const m = baseMove(slot, 'normal', stance, fam.limb);
  m.id = family;
  m.strength = strength ?? letter;
  const tax = reachTax(body, fam);
  m.startup = Math.max(3, Math.round(st.startup * fam.tempo) + tax);
  m.active = st.active;
  m.recovery = Math.max(4, Math.round(st.recovery * fam.tempo) + tax);
  m.total = m.startup + m.active - 1 + m.recovery;
  m.damage = st.damage;
  m.hitstop = st.hitstop;
  m.push = st.push;
  m.meter = st.meter;
  m.guard = fam.guard ?? (stance === 'air' ? 'overhead' : 'mid');
  m.knock = fam.knock ?? 'none';
  m.antiAir = !!fam.antiAir;
  const adv = { ...st.adv, ...(fam.adv ?? {}) };
  if (stance === 'air') {
    [m.hitstun, m.blockstun] = AIR_STUN[m.strength];
  } else {
    m.hitstun = stunFor(m, adv.hit);
    m.blockstun = stunFor(m, adv.block);
    m.cancel = ['special', 'super'];
    if (m.strength === 'L') m.chain = ['stand.L', 'crouch.L'];
  }
  m.frames = layFrames(body, m, fam);
  m.reach = reachOf(m.frames);
  return m;
}

/** The throw: its reach a short arm's length from the body, shorter than any normal. */
export function compileThrow(body, slot = 'throw', over = {}) {
  const m = baseMove(slot, 'throw', 'stand', THROW.limb);
  Object.assign(m, { id: 'throw', startup: THROW.startup, active: THROW.active, recovery: THROW.recovery, damage: THROW.damage, hitstop: 0, push: 0 });
  m.total = m.startup + m.active - 1 + m.recovery;
  m.throw = { range: Math.round(body.bodyR * PUSH_HALF + body.upper * 0.9 * (over.reach ?? 1)), tech: over.techable === false ? 0 : THROW.tech, clinch: over.clinch ?? THROW.clinch };
  if (over.damage) m.damage = over.damage;
  m.frames = layFrames(body, m, THROW);
  m.reach = m.throw.range;
  return m;
}

/** A special at a strength (L / M / H) → a compiled move. */
export function compileSpecial(body, slot, id, strength = 'M') {
  const sp = SPECIALS[id];
  if (!sp) throw new Error(`versus: special '${id}' is not one of ${Object.keys(SPECIALS).join(', ')}`);
  const at = sp.at[strength];
  if (sp.throw) {
    const m = compileThrow(body, slot, { reach: at.reach, techable: false, clinch: sp.clinch, damage: at.damage });
    Object.assign(m, { id, kind: 'special', strength, rps: sp.rps, startup: at.startup, active: at.active, recovery: at.recovery, meter: sp.meter });
    m.total = m.startup + m.active - 1 + m.recovery;
    m.frames = layFrames(body, m, sp);
    return m;
  }
  const m = baseMove(slot, 'special', 'stand', sp.limb);
  Object.assign(m, { id, strength, rps: sp.rps, guard: sp.guard, knock: at.knock ?? sp.knock ?? 'none', chip: sp.chip ?? 0, hitstop: sp.hitstop, push: sp.push, meter: sp.meter });
  m.damage = at.damage ?? sp.damage;
  m.startup = at.startup;
  m.active = at.active ?? 1;
  m.hits = sp.hits ?? 1;
  m.rehit = m.hits > 1 ? Math.max(1, Math.floor(m.active / m.hits)) : 0;
  m.damage = Math.round(m.damage / m.hits); // a multi-hit's damage is its total, shared
  m.juggle = !!sp.juggle;
  m.cancel = ['super'];
  if (at.invuln) m.invuln.push([1, at.invuln, 'strike'], [1, at.invuln, 'projectile']);
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
    const adv = at.adv ?? sp.adv ?? { hit: 0, block: -4 };
    m.hitstun = stunFor(m, adv.hit);
    m.blockstun = stunFor(m, adv.block);
  }
  m.frames = layFrames(body, m, { ...sp, after: m.airborne ? POSES.fall : undefined });
  m.reach = reachOf(m.frames);
  return m;
}

/** The super: its special's shape at full meter, invincible to start, with a freeze. */
export function compileSuper(body, id) {
  const su = SUPERS[id];
  if (!su) throw new Error(`versus: super '${id}' is not one of ${Object.keys(SUPERS).join(', ')}`);
  const sp = SPECIALS[su.from];
  let m;
  if (sp.throw) {
    m = compileThrow(body, 'super', { reach: su.reach, techable: false, clinch: su.clinch, damage: su.damage });
    Object.assign(m, { startup: su.startup, active: su.active, recovery: su.recovery });
  } else {
    m = baseMove('super', 'super', 'stand', sp.limb);
    Object.assign(m, { guard: sp.guard, knock: 'down', chip: su.chip ?? 30, hitstop: 6, push: 120, damage: su.damage, startup: su.startup, active: su.active ?? 1 });
    m.hits = su.hits ?? 1;
    m.rehit = su.rehit ?? 0;
    m.juggle = true;
    if (sp.airborne) {
      m.airborne = [sp.airborne, 999];
      m.vel = { [sp.airborne]: su.vel };
      m.landing = su.landing;
      m.recovery = 24;
    } else m.recovery = su.recovery;
    if (su.travel) m.travel = su.travel;
  }
  Object.assign(m, { id, kind: 'super', cost: SUPER_COST, freeze: su.freeze, rps: sp.rps });
  m.invuln = [...m.invuln, [1, su.invuln, 'strike'], [1, su.invuln, 'projectile'], [1, su.invuln, 'throw']];
  m.total = m.startup + m.active - 1 + m.recovery;
  if (su.projectile) {
    m.projectile = { ...su.projectile, speed: su.speed, damage: Math.round(su.damage / su.hits), chip: Math.round((su.chip ?? 30) / su.hits), hitstun: 30, blockstun: 20, hits: su.hits, rehit: su.rehit, hitstop: 4, push: 60 };
    m.active = 1;
    m.total = m.startup + m.recovery;
  }
  if (!m.throw) {
    if (m.hits > 1 && !m.projectile) m.damage = Math.round(su.damage / m.hits);
    m.hitstun = m.airborne ? 60 : stunFor(m, 20);
    m.blockstun = stunFor(m, -16);
  }
  m.frames = layFrames(body, m, { ...sp, after: m.airborne ? POSES.fall : undefined });
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

/** A recipe → the compiled fighter (plain data). */
export function compileFighter(recipe) {
  if (!recipe || typeof recipe !== 'object') throw new Error('versus: a fighter recipe is an object');
  const body = versusBody(recipe.cast ?? 'heroic', recipe.body ?? {});
  const moves = {};
  for (const slot of NORMAL_SLOTS) {
    const n = recipe.normals?.[slot];
    if (!n) throw new Error(`versus: ${recipe.id ?? 'fighter'} has no ${slot} (normals: ${NORMAL_SLOTS.join(', ')})`);
    moves[slot] = compileNormal(body, slot, n);
  }
  moves.throw = compileThrow(body);
  for (const dir of SPECIAL_SLOTS) {
    const s = recipe.specials?.[dir];
    if (!s) continue;
    for (const st of ['L', 'M', 'H']) {
      const m = compileSpecial(body, `special.${dir}`, s.id, st);
      m.motion = s.motion ?? SPECIALS[s.id].motion;
      moves[`special.${dir}.${st}`] = m;
    }
  }
  if (recipe.super) moves.super = compileSuper(body, recipe.super.id);
  for (const m of Object.values(moves)) m.adv = frameAdvantage(m);
  const jump = { ...MOVEMENT.jump, ...(recipe.jump ?? {}) };
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
    idle: idleOf(body),
    moves,
  };
}
