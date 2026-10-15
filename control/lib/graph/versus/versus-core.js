/**
 * versus core — the fight as a pure function of two players' buttons.
 *
 *   stepVersus(state, [pad1, pad2], ctx) → state      one frame at 60 Hz
 *   ctx = { fighters: [compiled, compiled] }            (versus-compile.js; constant through a match)
 *
 * No clock, no Math.random, no DOM: the state is plain integers and small arrays, so the same start and the same
 * pads are the same fight to the byte (a replay is the pad log), a snapshot is a clone (rollback stays possible),
 * and two CPUs can fight a thousand matches headless.
 *
 * The plane is x (mm, 0 mid-stage) and y (mm, 0 the floor). What it holds: walking, crouching, jumping with
 * prejump, dashing, auto-facing, push boxes, walls and the camera's span; strikes resolved hitbox against hurtbox
 * for both players at once (trades), blocking by holding back (low must be crouched, overhead stood), chip,
 * pushback (the attacker takes it at a wall), hitstop, hitstun and blockstun, counter hits, damage scaling,
 * knockdowns, launches and juggles, wake-up, throws with a tech window, command throws, projectiles that trade
 * with each other, invincibility, meter, supers with a freeze, and rounds: an intro, a timer, KO, time over,
 * best of three.
 */

import { recordInput, readCommand, autoNext, consume, pressed, traced, currentDir, downish, BTN, SCHEMES, ZERO_PAD } from './versus-input.js';
import { METER_MAX, SYSTEMS } from './versus-library.js';

export const VERSUS_RULES = Object.freeze({
  half: 3800,       // the walls, from mid-stage
  span: 3300,       // the furthest two fighters can be apart (the screen)
  start: 900,       // each fighter's start, from mid-stage
  timer: 99,        // seconds
  rounds: 2,        // rounds to win
  intro: 90,        // frames of ROUND n / FIGHT
  koHold: 150,      // frames between KO and the round's end
  roundGap: 60,     // frames of the round-end card before the next intro
  down: 36, rise: 10, juggle: 3, cancelLate: 8, throwInvulnAfter: 5,
  scaling: [100, 100, 80, 70, 60, 50, 40, 30, 20, 10],
  // the systems' dials (read only when the system is on)
  parryWindow: 6,   // frames a forward (or down) tap parries for
  parryFreeze: 16,  // frames the parried attacker is held
  burstReach: 1600, // mm the burst knocks an attacker away from
  guardMax: 1000, guardRegen: 3, guardRest: 60, crushStun: 40,
});

// the rules a game may set (the rest are the sim's own): whole numbers from a floor, the scaling row, the systems
const RULE_FLOORS = { half: 1500, span: 1500, start: 300, timer: 10, rounds: 1, down: 1, rise: 1, juggle: 0, cancelLate: 0, parryWindow: 1, parryFreeze: 0, burstReach: 0, guardMax: 100, guardRegen: 0, guardRest: 0, crushStun: 1 };

/** A game's rules as written → the overrides newVersus takes; throws on a key or value it cannot read. */
export function readRules(r) {
  if (r === undefined || r === null) return {};
  if (typeof r !== 'object' || Array.isArray(r)) throw new Error('versus: rules is an object');
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (k in RULE_FLOORS) {
      if (!Number.isInteger(v) || v < RULE_FLOORS[k] || v > 99999) throw new Error(`versus: rules.${k} is a whole number from ${RULE_FLOORS[k]}`);
      out[k] = v;
    } else if (k === 'scaling') {
      if (!Array.isArray(v) || !v.length || v.length > 20 || !v.every((n) => Number.isInteger(n) && n >= 0 && n <= 200)) throw new Error('versus: rules.scaling is a list of percentages, one per hit of a combo');
      out[k] = v.slice();
    } else if (k === 'systems') {
      if (!Array.isArray(v) || !v.every((w) => SYSTEMS[w])) throw new Error(`versus: rules.systems is a list of ${Object.keys(SYSTEMS).join(', ')}`);
      if (v.length) out[k] = [...new Set(v)];
    } else throw new Error(`versus: rules has no '${k}' (one of ${[...Object.keys(RULE_FLOORS), 'scaling', 'systems'].join(', ')})`);
  }
  return out;
}

const sys = (s, w) => !!s.rules.systems && s.rules.systems.includes(w);

const NEUTRAL = new Set(['stand', 'walkF', 'walkB', 'crouch']);
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

function newPlayer(i, fighter, rules, meter = 0, scheme = 'modern') {
  return {
    x: i === 0 ? -rules.start : rules.start, y: 0, vx: 0, vy: 0, face: i === 0 ? 1 : -1,
    hp: fighter.hp, meter, st: 'stand', sf: 0, mv: null, mf: 0, hs: 0, stun: 0, low: 0,
    hitN: 0, hitAt: 0, conn: 0, combo: 0, jug: 0, pushv: 0, pushn: 0, jx: 0, airMove: 0, air: 0,
    landing: 0, inv: 0, tinv: 0, tb: 0, clinch: 0, techable: 0, throwDmg: 0, ko: 0, counter: 0,
    hist: [], held: 0, scheme,
    ...(rules.systems && rules.systems.includes('guard') ? { gd: rules.guardMax, gdT: 0 } : {}),
    ...(rules.systems && rules.systems.includes('burst') ? { burst: 0 } : {}),
  };
}

/** A match's first state. opts: { schemes: ['modern', 'classic'], rules: {…overrides} } */
export function newVersus(ctx, opts = {}) {
  const rules = { ...VERSUS_RULES, ...(opts.rules ?? {}) };
  const schemes = opts.schemes ?? ['modern', 'modern'];
  for (const s of schemes) if (!SCHEMES.includes(s)) throw new Error(`versus: scheme '${s}' is one of ${SCHEMES.join(', ')}`);
  return {
    f: 0, phase: 'intro', pf: 0, round: 1, wins: [0, 0], timer: rules.timer * 60, freeze: 0, freezeBy: -1,
    winner: null, roundWinner: null, rules,
    p: [newPlayer(0, ctx.fighters[0], rules, 0, schemes[0]), newPlayer(1, ctx.fighters[1], rules, 0, schemes[1])],
    shots: [], events: [], nextShot: 1,
  };
}

/** A deep copy (state is plain data). */
export function cloneVersus(s) {
  return {
    ...s, wins: s.wins.slice(), rules: s.rules,
    p: s.p.map((p) => ({ ...p, hist: p.hist.slice() })),
    shots: s.shots.map((t) => ({ ...t })), events: [],
  };
}

// ── boxes ────────────────────────────────────────────────────────────────────────────────────────────────────

const worldBox = (b, x, y, face) => (face > 0 ? [x + b[0], y + b[1], x + b[2], y + b[3]] : [x - b[2], y + b[1], x - b[0], y + b[3]]);
const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

function moveFrame(p, F) {
  if (!p.mv) return null;
  const m = F.moves[p.mv];
  return m.frames[Math.max(1, Math.min(p.mf, m.total))];
}

function stanceOf(p) {
  if (p.st === 'air' || p.st === 'fall' || p.air || p.y > 0) return p.st === 'fall' || p.st === 'ko' ? 'fall' : 'air';
  if (p.st === 'crouch' || ((p.st === 'block' || p.st === 'hit') && p.low)) return 'crouch';
  if (p.mv) return p.mv.startsWith('crouch') ? 'crouch' : 'stand';
  return 'stand';
}

/** The player's hurtboxes this frame, in the world (none while lying down, rising, or in a throw). */
export function hurtBoxes(p, F) {
  if (p.st === 'down' || p.st === 'rise' || p.st === 'thrown' || p.st === 'throwing' || (p.st === 'ko' && p.y <= 0)) return [];
  const fr = moveFrame(p, F);
  const boxes = fr ? fr.hurt : F.idle[stanceOf(p)].hurt;
  return boxes.map((b) => worldBox(b, p.x, p.y, p.face));
}

/** The player's push box in the world. */
export function pushBox(p, F) {
  return worldBox(F.idle[stanceOf(p)].push, p.x, p.y, p.face);
}

/** The active hitbox this frame, or null. */
export function hitBox(p, F) {
  const fr = moveFrame(p, F);
  return fr && fr.hit ? worldBox(fr.hit, p.x, p.y, p.face) : null;
}

const shotBox = (t) => [t.x - t.w / 2, t.y - t.h / 2, t.x + t.w / 2, t.y + t.h / 2];

function invulnTo(p, F, kind) {
  if (p.inv > 0 && kind !== 'throw') return true;
  if (p.st === 'down' || p.st === 'rise' || p.st === 'thrown' || p.st === 'throwing' || p.st === 'tech' || p.st === 'ko' || p.st === 'burst') return true;
  if (p.mv) {
    const m = F.moves[p.mv];
    for (const [a, b, k] of m.invuln) if (p.mf >= a && p.mf <= b && k === kind) return true;
  }
  if (kind === 'throw') {
    if (p.y > 0 || p.air || p.st === 'air' || p.st === 'fall' || p.st === 'hit' || p.st === 'block' || p.tinv > 0) return true;
  }
  return false;
}

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────

/** One frame. `pads` is [pad1, pad2], each { x, y, b }. */
export function stepVersus(prev, pads, ctx) {
  const s = cloneVersus(prev);
  const R = s.rules;
  s.f++;
  // the buffer holds still while a player is frozen (hitstop, super freeze): presses made then are kept
  for (let i = 0; i < 2; i++) {
    const p = s.p[i];
    const pad = pads[i] ?? ZERO_PAD;
    const frozen = p.hs > 0 || s.freeze > 0;
    const rec = recordInput(p, pad, p.face);
    if (frozen && p.hist.length) {
      const last = rec.hist.pop();
      const prevLast = p.hist[p.hist.length - 1];
      rec.hist = p.hist.slice(0, -1);
      rec.hist.push((last & 15) | ((((prevLast >> 4) | (last >> 4))) << 4));
    }
    p.hist = rec.hist;
    p.held = rec.held;
  }

  if (s.phase === 'intro') {
    if (s.pf === 0) s.events.push({ t: 'round', n: s.round });
    s.pf++;
    if (s.pf === R.intro - 30) s.events.push({ t: 'fight' });
    if (s.pf >= R.intro) { s.phase = 'fight'; s.pf = 0; }
    for (const p of s.p) p.sf++;
    return s;
  }
  if (s.freeze > 0) { s.freeze--; return s; }

  const before = s.p.map((p) => p.x);
  for (let i = 0; i < 2; i++) think(s, i, ctx);
  for (let i = 0; i < 2; i++) advance(s, i, ctx);
  advanceShots(s);
  separate(s, ctx, before);
  for (let i = 0; i < 2; i++) autoFace(s, i);
  resolve(s, ctx);
  rounds(s, ctx);
  return s;
}

// ── decisions ────────────────────────────────────────────────────────────────────────────────────────────────

function think(s, i, ctx) {
  if (s.phase !== 'fight') return;
  const p = s.p[i];
  const F = ctx.fighters[i];
  if (p.burst === 0 && (p.st === 'hit' || p.st === 'fall') && !p.ko && pressed(p.hist, BTN.S, 4) && pressed(p.hist, BTN.T, 4)) { burst(s, i); return; }
  if (p.hs > 0) return;
  const dir = currentDir(p.hist);
  const hasShot = s.shots.some((t) => t.o === i);
  const opts = { hasShot, meter: p.meter };

  // a connected move cancels into what its record allows, while the hit is fresh
  if (p.mv && (p.st === 'move' || p.st === 'air')) {
    const m = F.moves[p.mv];
    if (!p.conn || p.mf > m.startup + m.active - 1 + R_CANCEL(s)) return;
    const auto = p.scheme === 'simple' ? autoNext(F, p.mv) : null;
    const cmd = readCommand(p.hist, p.scheme, F, { ...opts, stance: p.st === 'air' ? 'air' : (downish(dir) ? 'crouch' : 'stand'), auto });
    if (!cmd) return;
    const kind = cmd.type === 'normal' ? cmd.slot : cmd.type;
    if (m.cancel.includes(kind) || m.chain.includes(cmd.slot) || (auto && cmd === auto)) start(s, i, ctx, cmd);
    return;
  }
  if (p.st === 'air') {
    if (p.airMove || p.mv) return;
    const cmd = readCommand(p.hist, p.scheme, F, { ...opts, stance: 'air' });
    if (cmd && cmd.type === 'normal') start(s, i, ctx, cmd);
    return;
  }
  if (!NEUTRAL.has(p.st)) return;
  p.combo = 0;
  p.jug = 0;
  const cmd = readCommand(p.hist, p.scheme, F, { ...opts, stance: downish(dir) ? 'crouch' : 'stand' });
  if (cmd) { start(s, i, ctx, cmd); return; }
  if (dir >= 7) {
    p.st = 'prejump'; p.sf = 0; p.jx = dir === 9 ? 1 : dir === 7 ? -1 : 0; p.airMove = 0;
    return;
  }
  if (traced(p.hist, '66')) { p.st = 'dashF'; p.sf = 0; p.hist = p.hist.map(() => 5); return; }
  if (traced(p.hist, '44')) { p.st = 'dashB'; p.sf = 0; p.hist = p.hist.map(() => 5); return; }
  const next = downish(dir) ? 'crouch' : dir === 6 ? 'walkF' : dir === 4 ? 'walkB' : 'stand';
  if (next !== p.st) { p.st = next; p.sf = 0; }
}
const R_CANCEL = (s) => s.rules.cancelLate;

function start(s, i, ctx, cmd) {
  const p = s.p[i];
  const F = ctx.fighters[i];
  const m = F.moves[cmd.slot];
  p.hist = consume(p.hist);
  p.mv = cmd.slot;
  p.mf = 0;
  p.conn = 0;
  p.hitN = 0;
  p.hitAt = 0;
  p.air = 0;
  if (m.armor) p.armorN = 0;
  if (m.stance === 'air') { p.airMove = 1; return; }
  p.st = 'move';
  p.sf = 0;
  p.vx = 0;
  p.tb = cmd.back ? 1 : 0;
  if (cmd.type === 'super') {
    p.meter -= m.cost;
    s.freeze = m.freeze;
    s.freezeBy = i;
    s.events.push({ t: 'super', p: i, x: p.x });
  }
  if (cmd.type === 'special') s.events.push({ t: 'special', p: i, slot: cmd.slot });
}

// ── motion ───────────────────────────────────────────────────────────────────────────────────────────────────

function advance(s, i, ctx) {
  const p = s.p[i];
  const F = ctx.fighters[i];
  if (p.inv > 0) p.inv--;
  if (p.tinv > 0) p.tinv--;
  if (p.gd !== undefined && p.st !== 'block') {
    p.gdT++;
    if (p.gdT > s.rules.guardRest) p.gd = Math.min(s.rules.guardMax, p.gd + s.rules.guardRegen);
  }
  if (p.hs > 0) { p.hs--; return; }
  p.sf++;
  if (p.pushn > 0) { p.x += p.pushv; p.pushn--; }
  const J = F.jump;
  switch (p.st) {
    case 'walkF': p.x += F.walk.f * p.face; break;
    case 'walkB': p.x -= F.walk.b * p.face; break;
    case 'prejump':
      if (p.sf >= J.prejump) { p.st = 'air'; p.sf = 0; p.vy = J.vy; p.vx = p.jx * J.vx * p.face; p.y = 0; }
      break;
    case 'air':
      if (p.mv) { p.mf++; if (p.mf > F.moves[p.mv].total) p.mv = null; }
      fly(p, J.g);
      if (p.y <= 0 && p.vy < 0) land(p, J.landing);
      break;
    case 'land': if (p.sf >= p.landing) { p.st = 'stand'; p.sf = 0; } break;
    case 'dashF': {
      const d = F.dash.f;
      p.x += Math.round(d.dist / d.frames) * p.face;
      if (p.sf >= d.frames) { p.st = 'stand'; p.sf = 0; }
      break;
    }
    case 'dashB': {
      const d = F.dash.b;
      if (p.sf === 1) p.inv = d.invuln;
      p.x -= Math.round(d.dist / d.frames) * p.face;
      if (p.sf >= d.frames) { p.st = 'stand'; p.sf = 0; }
      break;
    }
    case 'move': {
      const m = F.moves[p.mv];
      p.mf++;
      if (m.travel && p.mf >= 2 && p.mf <= m.startup + m.active - 1) p.x += m.travel * p.face;
      if (m.airborne && p.mf === m.airborne[0]) { p.air = 1; p.vx = m.vel[m.airborne[0]][0] * p.face; p.vy = m.vel[m.airborne[0]][1]; }
      if (m.projectile && p.mf === m.startup) spawnShot(s, i, m);
      if (p.air) {
        fly(p, J.g);
        if (p.mf > m.total) p.mf = m.total;
        if (p.y <= 0 && p.vy < 0) { land(p, m.landing); p.mv = null; p.air = 0; }
      } else if (p.mf >= m.total) {
        if (m.throw) { /* a whiffed throw ends like any move */ }
        p.st = m.stance === 'crouch' ? 'crouch' : 'stand'; p.sf = 0; p.mv = null;
      }
      break;
    }
    case 'hit':
    case 'block':
      if (--p.stun <= 0) { p.st = p.low ? 'crouch' : 'stand'; p.sf = 0; p.tinv = s.rules.throwInvulnAfter; }
      break;
    case 'fall':
      fly(p, J.g);
      if (p.y <= 0 && p.vy < 0) { p.y = 0; p.vy = 0; p.vx = 0; p.st = p.ko ? 'ko' : 'down'; p.sf = 0; s.events.push({ t: 'land', p: i, x: p.x }); }
      break;
    case 'ko':
      if (p.y > 0) fly(p, J.g);
      if (p.y < 0) { p.y = 0; p.vy = 0; p.vx = 0; }
      break;
    case 'down': if (p.sf >= s.rules.down) { p.st = 'rise'; p.sf = 0; } break;
    case 'rise': if (p.sf >= s.rules.rise) { p.st = 'stand'; p.sf = 0; } break;
    case 'throwing': {
      const o = s.p[1 - i];
      if (o.st === 'thrown' && o.techable && p.sf <= o.techable && pressedThrow(o)) {
        tech(s, i);
        break;
      }
      if (p.sf >= p.clinch) {
        o.hp -= scaled(s, o, p.throwDmg);
        o.st = 'fall'; o.sf = 0; o.vy = 60;
        const away = p.tb ? -p.face : p.face;
        if (p.tb) o.x = p.x - p.face * 300;
        o.vx = away * 22;
        o.combo++;
        if (o.hp <= 0) { o.hp = 0; o.ko = 1; }
        p.st = 'land'; p.sf = 0; p.landing = 12; p.mv = null;
        p.meter = Math.min(METER_MAX, p.meter + 80);
        s.events.push({ t: 'throw', p: i, x: o.x, y: 900 });
      }
      break;
    }
    case 'thrown': break; // the thrower moves this body
    case 'tech': if (p.sf >= 14) { p.st = 'stand'; p.sf = 0; } break;
    case 'burst':
      if (p.y > 0 || p.vy > 0) fly(p, J.g);
      if (p.y <= 0) { p.y = 0; p.vy = 0; p.vx = 0; if (p.sf >= 24) { p.st = 'stand'; p.sf = 0; } }
      break;
    case 'win': case 'lose': break;
    default: break;
  }
}

const pressedThrow = (p) => pressed(p.hist, BTN.T, 4) || ((pressed(p.hist, BTN.L, 4) && pressed(p.hist, BTN.M, 4)) ? 1 : 0);

function fly(p, g) {
  p.vy -= g;
  p.x += p.vx;
  p.y += p.vy;
}

function land(p, landing) {
  p.y = 0; p.vy = 0; p.vx = 0; p.st = 'land'; p.sf = 0; p.landing = landing; p.mv = null; p.air = 0; p.airMove = 0;
}

function tech(s, i) {
  const p = s.p[i], o = s.p[1 - i];
  for (const [q, dir] of [[p, -p.face], [o, -o.face]]) {
    q.st = 'tech'; q.sf = 0; q.mv = null; q.pushv = dir * 25; q.pushn = 10;
  }
  s.events.push({ t: 'tech', x: (p.x + o.x) / 2 });
}

// the burst (system 'burst'): once a round, the one being hit breaks free and knocks a close attacker away
function burst(s, i) {
  const p = s.p[i], o = s.p[1 - i];
  p.burst = 1;
  p.hist = consume(p.hist);
  p.st = 'burst'; p.sf = 0; p.mv = null; p.air = 0; p.hs = 0; p.stun = 0; p.combo = 0; p.jug = 0; p.inv = 30; p.pushn = 0;
  p.vx = 0; if (p.y > 0) p.vy = Math.max(p.vy, 20);
  if (Math.abs(o.x - p.x) <= s.rules.burstReach && !o.ko && o.st !== 'down') {
    const away = sign(o.x - p.x) || -p.face;
    o.st = 'fall'; o.sf = 0; o.mv = null; o.air = 0; o.hs = 0; o.vy = 60; o.vx = away * 34; if (o.y <= 0) o.y = 1;
  }
  s.events.push({ t: 'burst', p: i, x: p.x, y: p.y + 1000 });
}

function spawnShot(s, i, m) {
  const p = s.p[i];
  const fr = m.frames[m.startup];
  const [sx, sy] = fr.spawn ?? [400, 1200];
  const P = m.projectile;
  s.shots.push({
    id: s.nextShot++, o: i, x: p.x + sx * p.face, y: p.y + sy + P.y, vx: P.speed * p.face, w: P.w, h: P.h,
    life: P.life, hits: P.hits, rehit: P.rehit, hitAt: -999, dmg: P.damage, chip: P.chip, hitstun: P.hitstun,
    blockstun: P.blockstun, hitstop: P.hitstop, push: P.push, sup: m.kind === 'super' ? 1 : 0, meter: m.meter ?? 0,
  });
}

function advanceShots(s) {
  const R = s.rules;
  for (const t of s.shots) { t.x += t.vx; t.life--; }
  s.shots = s.shots.filter((t) => t.life > 0 && t.hits > 0 && Math.abs(t.x) < R.half + 800);
}

function separate(s, ctx, before) {
  const R = s.rules;
  const [a, b] = s.p;
  // the screen: whoever moved away is held
  const dist = Math.abs(a.x - b.x);
  if (dist > R.span) {
    const excess = dist - R.span;
    const away = s.p.map((p, i) => sign(p.x - before[i]) === sign(p.x - s.p[1 - i].x) && p.x !== before[i]);
    const share = away[0] && away[1] ? [excess / 2, excess / 2] : away[0] ? [excess, 0] : away[1] ? [0, excess] : [excess / 2, excess / 2];
    for (let i = 0; i < 2; i++) {
      const p = s.p[i];
      p.x -= sign(p.x - s.p[1 - i].x) * Math.round(share[i]);
    }
  }
  // push boxes
  const pa = pushBox(a, ctx.fighters[0]), pb = pushBox(b, ctx.fighters[1]);
  if (overlap(pa, pb) && a.st !== 'thrown' && b.st !== 'thrown') {
    const left = a.x < b.x || (a.x === b.x && a.face > 0) ? 0 : 1;
    const L = s.p[left], Rr = s.p[1 - left];
    const pl = left === 0 ? pa : pb, pr = left === 0 ? pb : pa;
    const over = pl[2] - pr[0];
    if (over > 0) {
      const lw = L.x - (pl[2] - pl[0]) / 2 <= -R.half + 1, rw = Rr.x + (pr[2] - pr[0]) / 2 >= R.half - 1;
      const sl = lw ? 0 : rw ? over : Math.ceil(over / 2);
      L.x -= sl;
      Rr.x += over - sl;
    }
  }
  // walls
  for (let i = 0; i < 2; i++) {
    const p = s.p[i];
    const half = Math.round(ctx.fighters[i].idle.stand.push[2]);
    if (p.x < -R.half + half) p.x = -R.half + half;
    if (p.x > R.half - half) p.x = R.half - half;
  }
  // a thrown body rides the thrower's hands
  for (let i = 0; i < 2; i++) {
    const p = s.p[i], o = s.p[1 - i];
    if (p.st === 'throwing' && o.st === 'thrown') { o.x = p.x + p.face * 360; o.y = 0; }
  }
}

function autoFace(s, i) {
  const p = s.p[i], o = s.p[1 - i];
  if (!(NEUTRAL.has(p.st) || p.st === 'land' || p.st === 'rise' || p.st === 'down' || p.st === 'prejump' || p.st === 'burst')) return;
  const f = sign(o.x - p.x);
  if (f) p.face = f;
}

// ── contact ──────────────────────────────────────────────────────────────────────────────────────────────────

function activeMove(p, F) {
  if (!p.mv) return null;
  const m = F.moves[p.mv];
  if (p.mf < m.startup || p.mf > m.startup + m.active - 1) return null;
  if (m.projectile) return null;
  if (p.hitN >= m.hits) return null;
  if (p.hitN > 0 && p.mf - p.hitAt < m.rehit) return null;
  return m;
}

function canBlock(d, guard) {
  if (!(NEUTRAL.has(d.st) || d.st === 'block')) return false;
  const dir = currentDir(d.hist);
  if (dir !== 4 && dir !== 1) return false;
  if (guard === 'low') return dir === 1;
  if (guard === 'overhead') return dir === 4;
  return true;
}

// a fresh tap of `dir` within the last `within` frames: the direction arrives (it was not held the frame before)
function tapped(hist, dir, within) {
  for (let i = hist.length - 1; i >= 1 && i >= hist.length - within; i--) {
    if ((hist[i] & 15) === dir && (hist[i - 1] & 15) !== dir) return true;
  }
  return false;
}

function scaled(s, d, dmg) {
  const T = s.rules.scaling;
  return Math.max(1, Math.floor((dmg * T[Math.min(d.combo, T.length - 1)]) / 100));
}

function resolve(s, ctx) {
  if (s.phase !== 'fight' && s.phase !== 'ko') return;
  const F = ctx.fighters;
  const contacts = [];
  // throws: a throw's active frame against a throwable body within reach
  const throws = [0, 1].map((i) => {
    const p = s.p[i], o = s.p[1 - i];
    if (!p.mv || p.st !== 'move') return false;
    const m = F[i].moves[p.mv];
    if (!m.throw || p.mf < m.startup || p.mf > m.startup + m.active - 1 || p.hitN) return false;
    if (Math.abs(o.x - p.x) > m.throw.range + F[1 - i].idle.stand.push[2]) return false;
    if (sign(o.x - p.x) !== p.face && o.x !== p.x) return false;
    return !invulnTo(o, F[1 - i], 'throw');
  });
  // blades that meet on the same frame clash: neither lands, both recoil
  const clashed = [false, false];
  const blades = [0, 1].map((i) => {
    const m = activeMove(s.p[i], F[i]);
    const fr = m && m.armed ? moveFrame(s.p[i], F[i]) : null;
    return fr && fr.blade ? worldBox(fr.blade, s.p[i].x, s.p[i].y, s.p[i].face) : null;
  });
  if (blades[0] && blades[1] && overlap(blades[0], blades[1])) {
    for (let i = 0; i < 2; i++) {
      const p = s.p[i];
      p.hitN = F[i].moves[p.mv].hits; p.hs = 12; p.pushv = -p.face * 30; p.pushn = 8;
      clashed[i] = true;
    }
    s.events.push({ t: 'clash', x: (blades[0][2] + blades[0][0] + blades[1][0] + blades[1][2]) / 4, y: (blades[0][1] + blades[0][3]) / 2 });
  }
  // strikes
  for (let i = 0; i < 2; i++) {
    const p = s.p[i], o = s.p[1 - i];
    const m = activeMove(p, F[i]);
    if (!m || m.throw || o.ko || clashed[i]) continue;
    const hb = hitBox(p, F[i]);
    if (!hb) continue;
    if (o.st === 'fall' && (!m.juggle || o.jug >= s.rules.juggle)) continue;
    if (invulnTo(o, F[1 - i], 'strike')) continue;
    if (hurtBoxes(o, F[1 - i]).some((h) => overlap(hb, h))) contacts.push({ a: i, m });
  }
  // shots against bodies, and against each other
  for (const t of s.shots) {
    const o = s.p[1 - t.o];
    if (s.f - t.hitAt < t.rehit || t.hits <= 0) continue;
    const sb = shotBox(t);
    for (const u of s.shots) {
      if (u.o !== t.o && u.hits > 0 && t.hits > 0 && overlap(sb, shotBox(u))) {
        t.hits--; u.hits--; s.events.push({ t: 'clash', x: (t.x + u.x) / 2, y: (t.y + u.y) / 2 });
      }
    }
    if (t.hits <= 0 || o.ko) continue;
    if (o.st === 'fall' && (!t.sup || o.jug >= s.rules.juggle)) continue;
    if (invulnTo(o, F[1 - t.o], 'projectile')) continue;
    if (hurtBoxes(o, F[1 - t.o]).some((h) => overlap(sb, h))) contacts.push({ a: t.o, shot: t });
  }
  // a strike that lands on a throw's startup stops it; two throws on the same frame tech
  if (throws[0] && throws[1]) { tech(s, 0); return; }
  for (const c of contacts) applyHit(s, ctx, c);
  for (let i = 0; i < 2; i++) {
    const p = s.p[i], o = s.p[1 - i];
    if (throws[i] && p.st === 'move' && o.st !== 'hit' && o.st !== 'fall') applyThrow(s, ctx, i);
  }
}

function applyThrow(s, ctx, i) {
  const p = s.p[i], o = s.p[1 - i];
  const m = ctx.fighters[i].moves[p.mv];
  p.hitN = 1;
  p.st = 'throwing'; p.sf = 0; p.clinch = m.throw.clinch; p.throwDmg = m.damage;
  o.st = 'thrown'; o.sf = 0; o.mv = null; o.techable = m.throw.tech; o.pushn = 0;
  s.events.push({ t: 'grab', p: i, x: (p.x + o.x) / 2 });
}

function applyHit(s, ctx, { a, m, shot }) {
  const p = s.p[a], d = s.p[1 - a];
  const src = shot ?? m;
  const guard = shot ? 'mid' : m.guard;
  const face = shot ? sign(shot.vx) : p.face;
  const hitstop = src.hitstop ?? 10;
  const push = src.push ?? 150;
  if (shot) { shot.hits--; shot.hitAt = s.f; } else { p.hitN++; p.hitAt = p.mf; }
  const airborne = d.y > 0 || d.air || d.st === 'air' || d.st === 'fall';
  const dm = d.st === 'move' && d.mv ? ctx.fighters[1 - a].moves[d.mv] : null;

  // a riposte catches a strike in its window and answers it
  if (!shot && dm && dm.riposte && d.mf >= dm.riposte[0] && d.mf <= dm.riposte[1] && d.hs === 0) {
    const [, , rdmg, knock] = dm.riposte;
    d.mf = dm.riposte[1]; d.hs = 0;
    p.hp -= scaled(s, p, rdmg); p.combo++; p.mv = null; p.air = 0; p.hs = hitstop;
    if (knock === 'none') { p.st = 'hit'; p.sf = 0; p.stun = 20; p.low = 0; }
    else { p.st = 'fall'; p.sf = 0; p.vy = knock === 'launch' ? 105 : 50; p.vx = -face * 20; if (p.y <= 0) p.y = 1; p.jug++; }
    s.events.push({ t: 'riposte', p: 1 - a, x: d.x + d.face * 300, y: 1100 });
    if (p.hp <= 0) ko(s, a, -face);
    return;
  }
  // a parry (system 'parry'): a fresh tap toward the attacker (down for a low) as it lands
  if (sys(s, 'parry') && !airborne && NEUTRAL.has(d.st) && tapped(d.hist, guard === 'low' ? 2 : 6, s.rules.parryWindow)) {
    if (!shot) { p.hs = s.rules.parryFreeze; p.conn = 0; }
    d.hs = 0;
    d.hist = consume(d.hist);
    d.meter = Math.min(METER_MAX, d.meter + 30);
    s.events.push({ t: 'parry', p: 1 - a, x: shot ? shot.x : d.x - face * 200, y: shot ? shot.y : 1100 });
    return;
  }
  // armor absorbs a strike or a shot in its window: the damage lands, the stun does not
  if (dm && dm.armor && d.mf >= dm.armor[0] && d.mf <= dm.armor[1] && (d.armorN ?? 0) < dm.armor[2]) {
    d.armorN = (d.armorN ?? 0) + 1;
    d.hp -= scaled(s, d, src.dmg ?? src.damage);
    d.hs = hitstop;
    if (!shot) { p.hs = hitstop; p.conn = 2; }
    s.events.push({ t: 'armor', p: a, x: shot ? shot.x : d.x - face * 200, y: shot ? shot.y : 1100 });
    if (d.hp <= 0) ko(s, 1 - a, face);
    return;
  }
  const atWall = (dx) => Math.abs(d.x + dx) >= s.rules.half - ctx.fighters[1 - a].idle.stand.push[2] - 30;
  const pushOut = (amount) => {
    const per = Math.round(amount / 8);
    if (atWall(face * 40) && !shot) { p.pushv = -face * per; p.pushn = 8; }
    else { d.pushv = face * per; d.pushn = 8; }
  };

  if (!airborne && canBlock(d, guard)) {
    // the guard bar (system 'guard'): a block wears it, an empty one is crushed open
    if (d.gd !== undefined) {
      d.gd -= Math.round((src.dmg ?? src.damage ?? 30) * 1.5) + 20;
      d.gdT = 0;
      if (d.gd <= 0) {
        d.gd = s.rules.guardMax;
        d.st = 'hit'; d.sf = 0; d.stun = s.rules.crushStun; d.low = 0; d.mv = null; d.hs = hitstop;
        if (!shot) { p.hs = hitstop; p.conn = 1; }
        s.events.push({ t: 'crush', p: a, x: d.x, y: 1300 });
        return;
      }
    }
    const chip = src.chip ?? 0;
    const lethal = shot ? shot.sup : m.kind === 'super';
    d.hp = Math.max(lethal ? 0 : Math.min(d.hp, 1), d.hp - chip);
    d.st = 'block'; d.sf = 0; d.stun = src.blockstun; d.low = currentDir(d.hist) === 1 ? 1 : 0; d.mv = null;
    d.hs = shot ? hitstop - 2 : hitstop - 2;
    if (!shot) { p.hs = hitstop - 2; p.conn = p.conn || 2; }
    pushOut(push);
    d.meter = Math.min(METER_MAX, d.meter + 10);
    p.meter = Math.min(METER_MAX, p.meter + Math.round((src.meter ?? 20) / 2));
    s.events.push({ t: 'block', p: a, x: (shot ? shot.x : d.x - face * 200), y: shot ? shot.y : 1100 });
    if (d.hp <= 0) ko(s, 1 - a, face);
    return;
  }

  const counter = d.st === 'move' && d.mv && d.mf < ctx.fighters[1 - a].moves[d.mv].startup;
  let dmg = scaled(s, d, src.dmg ?? src.damage);
  if (counter) dmg = Math.floor((dmg * 6) / 5);
  d.hp -= dmg;
  d.combo++;
  d.mv = null;
  d.air = 0;
  d.hs = hitstop;
  if (!shot) { p.hs = hitstop; p.conn = 1; }
  p.meter = Math.min(METER_MAX, p.meter + (src.meter ?? 20));
  d.meter = Math.min(METER_MAX, d.meter + Math.round((src.meter ?? 20) / 2));
  const knock = shot ? (shot.sup ? 'down' : 'none') : m.knock;
  if (airborne || knock === 'launch' || knock === 'down') {
    d.st = 'fall'; d.sf = 0;
    d.vy = knock === 'launch' ? 105 : airborne ? 55 : 45;
    d.vx = face * (knock === 'launch' ? 10 : 20);
    if (d.y <= 0) d.y = 1;
    d.jug++;
  } else {
    d.low = stanceOf(d) === 'crouch' ? 1 : 0;
    d.st = 'hit'; d.sf = 0; d.stun = src.hitstun + (counter ? 2 : 0);
    pushOut(push);
  }
  s.events.push({ t: counter ? 'counter' : 'hit', p: a, dmg, x: shot ? shot.x : d.x - face * 150, y: shot ? shot.y : 1100, combo: d.combo });
  if (d.hp <= 0) ko(s, 1 - a, face);
}

function ko(s, i, face) {
  const d = s.p[i];
  d.hp = 0; d.ko = 1; d.st = 'fall'; d.sf = 0; d.vy = Math.max(d.vy, 70); d.vx = face * 24; d.mv = null;
  if (d.y <= 0) d.y = 1;
  if (s.phase === 'fight') { s.phase = 'ko'; s.pf = 0; s.events.push({ t: 'ko', p: i }); }
}

// ── rounds ───────────────────────────────────────────────────────────────────────────────────────────────────

function rounds(s, ctx) {
  const R = s.rules;
  if (s.phase === 'fight') {
    s.timer--;
    if (s.timer <= 0) {
      s.timer = 0;
      const r = s.p.map((p, i) => (p.hp * 1000) / ctx.fighters[i].hp);
      s.roundWinner = r[0] > r[1] ? 0 : r[1] > r[0] ? 1 : -1;
      s.phase = 'ko'; s.pf = 0;
      s.events.push({ t: 'time' });
    }
    return;
  }
  if (s.phase === 'ko') {
    s.pf++;
    if (s.pf === 1 && s.roundWinner === null) {
      const k = s.p.map((p) => p.ko);
      s.roundWinner = k[0] && k[1] ? -1 : k[0] ? 1 : 0;
    }
    if (s.pf >= R.koHold) {
      const w = s.roundWinner;
      if (w >= 0) s.wins[w]++;
      for (let i = 0; i < 2; i++) {
        const p = s.p[i];
        if (NEUTRAL.has(p.st) || p.st === 'land') { p.st = i === w ? 'win' : (w === -1 ? 'stand' : 'lose'); p.sf = 0; }
      }
      const done = s.wins.some((n) => n >= R.rounds) || s.round >= R.rounds * 2 + 1;
      s.phase = done ? 'matchEnd' : 'roundEnd';
      s.pf = 0;
      if (done) s.winner = s.wins[0] > s.wins[1] ? 0 : s.wins[1] > s.wins[0] ? 1 : -1;
      s.events.push({ t: done ? 'match' : 'roundEnd', w });
    }
    return;
  }
  if (s.phase === 'roundEnd') {
    s.pf++;
    if (s.pf >= R.roundGap) nextRound(s, ctx);
    return;
  }
  if (s.phase === 'matchEnd') s.pf++;
}

function nextRound(s, ctx) {
  const meters = s.p.map((p) => p.meter);
  const schemes = s.p.map((p) => p.scheme);
  const hist = s.p.map((p) => p.hist);
  s.p = [0, 1].map((i) => ({ ...newPlayer(i, ctx.fighters[i], s.rules, meters[i], schemes[i]), hist: hist[i] }));
  s.shots = [];
  s.round++;
  s.timer = s.rules.timer * 60;
  s.phase = 'intro';
  s.pf = 0;
  s.roundWinner = null;
}

/** A short, stable fingerprint of a state (replay checks). */
export function versusHash(s) {
  const str = JSON.stringify([s.f, s.phase, s.pf, s.round, s.wins, s.timer, s.p.map((p) => [p.x, p.y, p.vx, p.vy, p.face, p.hp, p.meter, p.st, p.sf, p.mv, p.mf, p.hs, p.stun, p.combo]), s.shots.map((t) => [t.x, t.y, t.hits]), ...(s.rules.systems && s.rules.systems.length ? [s.p.map((p) => [p.gd ?? null, p.burst ?? null])] : [])]);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
