/**
 * brawl core — the brawl as a pure function of its bodies' commands: the fight's sim opened up to many bodies on a belt.
 *
 *   newBrawl(ctx, { bodies, rules?, cam? }) → state
 *   stepBrawl(state, pads, ctx) → state            one frame at 60 Hz
 *   brawlHash(state)                               a short, stable fingerprint (replays, determinism)
 *   ctx = { fighters: [compiled, …], belt? }       (versus-compile.js; brawl-belt.js readBelt; constant through a brawl)
 *   body = { fighter, side: 'player' | 'crowd', x, z, face? }    x mm along the belt, z mm across it (the band), y up
 *   pad  = { x: -1 | 0 | 1, z: -1 | 0 | 1, mv?, jump? }           the stick along and across, and a command: `mv` a move's
 *                                                                 slot to start (or cancel into), `jump` a jump
 *
 * The core runs commands, it reads no buttons: what a button means is the brawler's moves' (brawl-moves.js, a player's
 * buttons to a slot) and the crowd's mind's (brawl-crowd.js, a thug's choice); both hand this the slot.
 *
 * Every body is a compiled fighter, a player's and a thug's alike, so a blow is the fight's frame data: its startup,
 * active frames and recovery, its boxes, damage, hitstop, hitstun, push, knockdown or launch, juggle, priority, counter
 * hits and damage scaling. What changes from the fight:
 *   • MANY BODIES: two sides, players and the crowd; a blow strikes the other side's bodies only, as many as its box meets
 *     on its frame (a sweep through a crowd), each once a hit of the move's.
 *   • THE LINE: a blow lands only on a body within `line` across the belt of its striker (line up to land); a throw, a shot
 *     and a flung body the same.
 *   • NO BLOCK (the genre's): a body is beaten by moving, lining up, throwing and the specials.
 *   • A FLUNG BODY: a thrown body flies as a blow of its own, knocking down the bodies of its side it meets, each once.
 *   • WAKE-UP: a body rising from the floor is untouchable `wake` frames more, so a crowd cannot keep it down.
 *   • THE BELT: with a belt, the camera scrolls on as the players go (beltScroll: never back, held at an uncleared gate),
 *     a player stays in its view and every body on the belt and in its band; without one, a floor `half` each way.
 *   • Each body faces its TARGET (the nearest standing body of the other side) when it is free, unless it walks along
 *     the belt, which faces it the way it walks.
 * The fight's 1v1 core (versus-core.js) is not touched: the brawl is its own sim over the same records.
 *
 * Pure: plain integers and small arrays, no clock, no dice; the same start and the same pads are the same brawl to the
 * byte.
 */
import { METER_MAX } from '../versus/versus-library.js';
import { beltScroll, beltBounds } from './brawl-belt.js';

export const BRAWL_RULES = Object.freeze({
  line: 320,        // mm across the belt a blow reaches: two bodies further apart than this are not lined up
  body: 260,        // mm, a body's half-depth: two closer across than twice this push each other along the belt
  half: 6000,       // mm, the floor each way without a belt
  depth: 2500,      // mm, the band each way without a belt
  walkZ: 60,        // % of the walk along the belt a body walks across it
  down: 36, rise: 10, wake: 40, juggle: 3, cancelLate: 8,
  flung: 60,        // the damage a flung body deals each body it meets
  vanish: 90,       // frames a beaten body of the crowd lies before it is gone
  scaling: [100, 100, 80, 70, 60, 50, 40, 30, 20, 10],
});
const SIDES = ['player', 'crowd'];
const FREE = new Set(['stand', 'walk']);
const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const ZERO = Object.freeze({ x: 0, z: 0 });

function newBody(i, b, ctx) {
  const F = ctx.fighters[b.fighter];
  if (!F) throw new Error(`brawl: bodies[${i}].fighter is an index into ctx.fighters`);
  if (!SIDES.includes(b.side)) throw new Error(`brawl: bodies[${i}].side is ${SIDES.join(' | ')}`);
  for (const k of ['x', 'z']) if (!Number.isInteger(b[k] ?? 0)) throw new Error(`brawl: bodies[${i}].${k} is whole millimetres`);
  return {
    id: i, fi: b.fighter, side: b.side, x: b.x ?? 0, z: b.z ?? 0, y: 0, vx: 0, vz: 0, vy: 0, face: b.face === -1 ? -1 : 1,
    hp: F.hp, meter: 0, st: 'stand', sf: 0, mv: null, mf: 0, hs: 0, stun: 0, wx: 0, wz: 0, jx: 0, jz: 0,
    hl: [], conn: 0, combo: 0, jug: 0, pushv: 0, pushn: 0, air: 0, airMove: 0, landing: 0, inv: 0, ko: 0, gone: 0, tg: -1,
  };
}

/** A brawl's first state. opts: { bodies: [{ fighter, side, x, z, face? }], rules?: {…overrides}, cam?: mm } */
export function newBrawl(ctx, opts = {}) {
  const rules = { ...BRAWL_RULES, ...(opts.rules ?? {}) };
  const bodies = (opts.bodies ?? []).map((b, i) => newBody(i, b, ctx));
  if (!bodies.length) throw new Error('brawl: a brawl has bodies');
  const s = { f: 0, rules, bodies, shots: [], events: [], nextShot: 1, freeze: 0, cleared: [] };
  if (ctx.belt) s.cam = opts.cam ?? Math.round(beltScroll(ctx.belt, 0, 0) * 1000);
  for (const p of s.bodies) faceTarget(s, p);
  return s;
}

function cloneBrawl(s) {
  return { ...s, bodies: s.bodies.map((p) => ({ ...p, hl: p.hl.map((h) => h.slice()), ...(p.fh ? { fh: p.fh.slice() } : {}) })), shots: s.shots.map((t) => ({ ...t })), events: [], cleared: s.cleared.slice() };
}

// ── boxes (the fight's, in the plane along the belt; the line across it is the brawl's) ─────────────────────────

const placed = (b, x, y, face) => (face > 0 ? [x + b[0], y + b[1], x + b[2], y + b[3]] : [x - b[2], y + b[1], x - b[0], y + b[3]]);
const crosses = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const lined = (s, a, b) => Math.abs(a.z - b.z) <= s.rules.line;
function frameOf(p, F) {
  if (!p.mv) return null;
  const m = F.moves[p.mv];
  return m.frames[Math.max(1, Math.min(p.mf, m.total))];
}
function poseOf(p) {
  if (p.st === 'air' || p.st === 'fall' || p.air || p.y > 0) return p.st === 'fall' || p.st === 'ko' ? 'fall' : 'air';
  if (p.mv) return p.mv.startsWith('crouch') ? 'crouch' : 'stand';
  return 'stand';
}
const OUT = new Set(['down', 'rise', 'thrown', 'throwing', 'ko']);
/** A body's hurtboxes this frame, in the plane (none while it lies, rises, is gone or is in a throw). */
export function bodyHurt(p, F) {
  if (p.gone || OUT.has(p.st)) return [];
  const fr = frameOf(p, F);
  return (fr ? fr.hurt : F.idle[poseOf(p)].hurt).map((b) => placed(b, p.x, p.y, p.face));
}
const pushOf = (p, F) => placed(F.idle[poseOf(p)].push, p.x, p.y, p.face);
function strikeOf(p, F) {
  const fr = frameOf(p, F);
  return fr && fr.hit ? placed(fr.hit, p.x, p.y, p.face) : null;
}
const shotRect = (t) => [t.x - t.w / 2, t.y - t.h / 2, t.x + t.w / 2, t.y + t.h / 2];
const mid = (a, b) => [Math.round((Math.max(a[0], b[0]) + Math.min(a[2], b[2])) / 2), Math.round((Math.max(a[1], b[1]) + Math.min(a[3], b[3])) / 2)];
function untouchable(p, F, kind) {
  if (p.gone || p.ko) return true;
  if (p.inv > 0 && kind !== 'throw') return true;
  if (OUT.has(p.st)) return true;
  if (p.mv) for (const [a, b, k] of F.moves[p.mv].invuln) if (p.mf >= a && p.mf <= b && k === kind) return true;
  if (kind === 'throw' && (p.y > 0 || p.air || p.st === 'air' || p.st === 'fall' || p.st === 'hit')) return true;
  return false;
}
const foes = (s, p) => s.bodies.filter((o) => o.side !== p.side && !o.gone);

// ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────

/** One frame. `pads` is one per body (by index; absent is a body let alone). */
export function stepBrawl(prev, pads, ctx) {
  const s = cloneBrawl(prev);
  s.f++;
  if (s.freeze > 0) { s.freeze--; return s; }
  for (const p of s.bodies) think(s, p, pads[p.id] ?? ZERO, ctx);
  for (const p of s.bodies) advance(s, p, ctx);
  for (const t of s.shots) { t.x += t.vx; t.life--; }
  s.shots = s.shots.filter((t) => t.life > 0 && t.hits > 0);
  separate(s, ctx);
  for (const p of s.bodies) faceTarget(s, p);
  resolve(s, ctx);
  return s;
}

// ── decisions ────────────────────────────────────────────────────────────────────────────────────────────────

function think(s, p, pad, ctx) {
  if (p.gone || p.ko || p.hs > 0) return;
  const F = ctx.fighters[p.fi];
  const want = pad.mv && F.moves[pad.mv] ? pad.mv : null;
  // a connected move cancels into what its record allows, while the hit is fresh (the fight's rule)
  if (p.mv && (p.st === 'move' || p.st === 'air')) {
    const m = F.moves[p.mv];
    if (!want || !p.conn || p.mf > m.startup + m.active - 1 + s.rules.cancelLate) return;
    const kind = F.moves[want].kind === 'normal' ? want : F.moves[want].kind;
    if ((m.cancel.includes(kind) || m.chain.includes(want)) && (F.moves[want].stance === 'air') === (p.st === 'air')) start(s, p, F, want);
    return;
  }
  if (p.st === 'air') {
    if (want && !p.airMove && F.moves[want].stance === 'air') start(s, p, F, want);
    return;
  }
  if (!FREE.has(p.st)) return;
  p.combo = 0;
  p.jug = 0;
  if (want && F.moves[want].stance !== 'air') { start(s, p, F, want); return; }
  if (pad.jump) { p.st = 'prejump'; p.sf = 0; p.jx = sgn(pad.x); p.jz = sgn(pad.z); return; }
  const wx = sgn(pad.x), wz = sgn(pad.z);
  const next = wx || wz ? 'walk' : 'stand';
  if (next !== p.st) { p.st = next; p.sf = 0; }
  p.wx = wx; p.wz = wz;
}

function start(s, p, F, slot) {
  const m = F.moves[slot];
  p.mv = slot; p.mf = 0; p.conn = 0; p.hl = []; p.air = 0;
  if (m.stance === 'air') { p.airMove = 1; return; }
  p.st = 'move'; p.sf = 0; p.vx = 0; p.vz = 0; p.wx = 0; p.wz = 0;
  if (m.kind === 'super') {
    p.meter -= m.cost;
    s.freeze = m.freeze;
    s.events.push({ t: 'super', p: p.id, x: p.x, z: p.z });
  }
  if (m.kind === 'special') s.events.push({ t: 'special', p: p.id, slot });
}

// ── motion ───────────────────────────────────────────────────────────────────────────────────────────────────

function fall(p, g) { p.vy -= g; p.x += p.vx; p.z += p.vz; p.y += p.vy; }
function touchDown(p, landing) { p.y = 0; p.vy = 0; p.vx = 0; p.vz = 0; p.st = 'land'; p.sf = 0; p.landing = landing; p.mv = null; p.air = 0; p.airMove = 0; }

function advance(s, p, ctx) {
  if (p.gone) return;
  const F = ctx.fighters[p.fi], J = F.jump, R = s.rules;
  if (p.inv > 0) p.inv--;
  if (p.hs > 0) { p.hs--; return; }
  p.sf++;
  if (p.pushn > 0) { p.x += p.pushv; p.pushn--; }
  switch (p.st) {
    case 'walk': p.x += p.wx * F.walk.f; p.z += Math.round((p.wz * F.walk.f * R.walkZ) / 100); break;
    case 'prejump':
      if (p.sf >= J.prejump) { p.st = 'air'; p.sf = 0; p.vy = J.vy; p.vx = p.jx * J.vx; p.vz = Math.round((p.jz * J.vx) / 2); p.y = 0; p.airMove = 0; }
      break;
    case 'air':
      if (p.mv) { p.mf++; if (p.mf > F.moves[p.mv].total) p.mv = null; }
      fall(p, J.g);
      if (p.y <= 0 && p.vy < 0) touchDown(p, J.landing);
      break;
    case 'land': if (p.sf >= p.landing) { p.st = 'stand'; p.sf = 0; } break;
    case 'move': {
      const m = F.moves[p.mv];
      p.mf++;
      if (m.travel && p.mf >= 2 && p.mf <= m.startup + m.active - 1) p.x += m.travel * p.face;
      if (m.airborne && p.mf === m.airborne[0]) { p.air = 1; p.vx = m.vel[m.airborne[0]][0] * p.face; p.vy = m.vel[m.airborne[0]][1]; }
      if (m.projectile && p.mf === m.startup) shoot(s, p, m);
      if (p.air) {
        fall(p, J.g);
        if (p.mf > m.total) p.mf = m.total;
        if (p.y <= 0 && p.vy < 0) touchDown(p, m.landing);
      } else if (p.mf >= m.total) { p.st = 'stand'; p.sf = 0; p.mv = null; }
      break;
    }
    case 'hit': if (--p.stun <= 0) { p.st = 'stand'; p.sf = 0; } break;
    case 'fall':
      fall(p, J.g);
      if (p.y <= 0 && p.vy < 0) {
        p.y = 0; p.vy = 0; p.vx = 0; p.vz = 0; p.st = p.ko ? 'ko' : 'down'; p.sf = 0;
        delete p.fl; delete p.fh;
        s.events.push({ t: 'land', p: p.id, x: p.x, z: p.z });
      }
      break;
    case 'ko': if (p.side === 'crowd' && p.sf >= R.vanish) { p.gone = 1; s.events.push({ t: 'gone', p: p.id }); } break;
    case 'down': if (p.sf >= R.down) { p.st = 'rise'; p.sf = 0; } break;
    // (risen: untouchable a while more, so a crowd cannot keep a body on the floor)
    case 'rise': if (p.sf >= R.rise) { p.st = 'stand'; p.sf = 0; p.inv = R.wake; } break;
    case 'throwing': {
      const o = s.bodies[p.hold];
      if (p.sf >= p.clinch) fling(s, p, o, ctx);
      break;
    }
    default: break;   // (thrown: the thrower carries it)
  }
}

function shoot(s, p, m) {
  const fr = m.frames[m.startup], [sx, sy] = fr.spawn ?? [400, 1200], P = m.projectile;
  s.shots.push({ id: s.nextShot++, o: p.id, side: p.side, x: p.x + sx * p.face, z: p.z, y: p.y + sy + P.y, vx: P.speed * p.face, w: P.w, h: P.h, life: P.life, hits: P.hits, rehit: P.rehit, hitAt: -999, dmg: P.damage, hitstun: P.hitstun, hitstop: P.hitstop, push: P.push, sup: m.kind === 'super' ? 1 : 0, meter: m.meter ?? 0, hl: [] });
}

// a throw's end: the held body flung away (behind on a back throw), hurt, a blow of its own until it lands
function fling(s, p, o, ctx) {
  const m = ctx.fighters[p.fi].moves[p.mv];
  o.hp -= scaledOn(s, o, p.throwDmg);
  o.st = 'fall'; o.sf = 0; o.vy = 60; o.vz = 0;
  const away = p.tb ? -p.face : p.face;
  if (p.tb) o.x = p.x - p.face * 300;
  o.vx = away * 22;
  o.combo++;
  o.fl = 1; o.fh = [o.id, p.id];
  o.rx = { k: 'throw', h: 1, w: 2, c: 0 };
  if (o.hp <= 0) { o.hp = 0; o.ko = 1; s.events.push({ t: 'ko', p: o.id }); }
  delete o.hold;
  p.st = 'land'; p.sf = 0; p.landing = 12; p.mv = null; delete p.hold;
  p.meter = Math.min(METER_MAX, p.meter + (m.meter ?? 0));
  s.events.push({ t: 'throw', p: p.id, d: o.id, x: o.x, z: o.z, y: 900 });
}

// ── room: pushes along the belt, the view, the band ─────────────────────────────────────────────────────────

function separate(s, ctx) {
  const R = s.rules, B = s.bodies;
  // a thrown body rides the thrower's hands
  for (const p of B) if (p.st === 'throwing') { const o = B[p.hold]; o.x = p.x + p.face * 360; o.z = p.z; o.y = 0; }
  // push boxes, pair by pair (in order: the same bodies, the same pushes), only between bodies lined up across the belt
  const solid = (p) => !p.gone && p.st !== 'thrown' && p.st !== 'throwing' && p.st !== 'ko' && !p.fl;
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
    const a = B[i], b = B[j];
    if (!solid(a) || !solid(b) || Math.abs(a.z - b.z) >= 2 * R.body) continue;
    const pa = pushOf(a, ctx.fighters[a.fi]), pb = pushOf(b, ctx.fighters[b.fi]);
    if (!crosses(pa, pb)) continue;
    const aLeft = a.x < b.x || (a.x === b.x && a.id < b.id);
    const [pl, pr] = aLeft ? [pa, pb] : [pb, pa], [L, Rt] = aLeft ? [a, b] : [b, a];
    const over = pl[2] - pr[0];
    if (over > 0) { const h = Math.ceil(over / 2); L.x -= h; Rt.x += over - h; }
  }
  // the camera goes on with the players; a player stays in its view, every body on the belt and in its band
  const belt = ctx.belt, players = B.filter((p) => p.side === 'player' && !p.ko && !p.gone);
  if (belt && players.length) s.cam = Math.round(beltScroll(belt, s.cam / 1000, players.map((p) => p.x / 1000), s.cleared) * 1000);
  const view = belt ? beltBounds(belt, s.cam / 1000) : null;
  const [n0, n1] = belt ? belt.depth.map((v) => Math.round(v * 1000)) : [-R.depth, R.depth];
  for (const p of B) {
    if (p.gone) continue;
    const [x0, x1] = view ? (p.side === 'player' ? view.s : [0, belt.length]).map((v) => Math.round(v * 1000)) : [-R.half, R.half];
    p.x = Math.max(x0, Math.min(x1, p.x));
    p.z = Math.max(n0, Math.min(n1, p.z));
  }
}

// THE TARGET: the nearest standing body of the other side, across the belt counting double (a body off the line is
// further to reach); a free body faces it, unless it walks along the belt (it faces the way it walks)
function faceTarget(s, p) {
  if (p.gone || p.ko) return;
  let best = -1, bd = Infinity;
  for (const o of foes(s, p)) {
    if (o.ko) continue;
    const d = Math.abs(o.x - p.x) + 2 * Math.abs(o.z - p.z);
    if (d < bd) { bd = d; best = o.id; }
  }
  p.tg = best;
  if (!(FREE.has(p.st) || p.st === 'land' || p.st === 'rise' || p.st === 'down' || p.st === 'prejump')) return;
  if (p.st === 'walk' && p.wx) { p.face = p.wx; return; }
  if (best >= 0) { const f = sgn(s.bodies[best].x - p.x); if (f) p.face = f; }
}

// ── contact ──────────────────────────────────────────────────────────────────────────────────────────────────

/** this move's hits on a body so far: [id, n, at] */
const hitsOn = (p, id) => p.hl.find((h) => h[0] === id);
function struckBy(p, m, id) {
  const h = hitsOn(p, id);
  return !h || (h[1] < m.hits && p.mf - h[2] >= m.rehit && m.rehit > 0);
}
function live(p, F) {
  if (!p.mv) return null;
  const m = F.moves[p.mv];
  if (p.mf < m.startup || p.mf > m.startup + m.active - 1 || m.projectile) return null;
  return m;
}
const scaledOn = (s, d, dmg) => { const T = s.rules.scaling; return Math.max(1, Math.floor((dmg * T[Math.min(d.combo, T.length - 1)]) / 100)); };

function resolve(s, ctx) {
  const F = (p) => ctx.fighters[p.fi], B = s.bodies;
  const contacts = [], grabs = [];
  for (const p of B) {
    const m = live(p, F(p));
    if (!m || p.gone || p.ko) continue;
    // a throw: its active frames, the nearest throwable foe in front of it, lined up and within reach
    if (m.throw) {
      if (p.hl.length) continue;
      let best = null;
      for (const o of foes(s, p)) {
        if (!lined(s, p, o) || untouchable(o, F(o), 'throw')) continue;
        const dx = o.x - p.x;
        if ((sgn(dx) !== p.face && dx !== 0) || Math.abs(dx) > m.throw.range + F(o).idle.stand.push[2]) continue;
        if (!best || Math.abs(dx) < Math.abs(best.x - p.x)) best = o;
      }
      if (best) grabs.push([p, best, m]);
      continue;
    }
    const hb = strikeOf(p, F(p));
    if (!hb) continue;
    for (const o of foes(s, p)) {
      if (o.ko || !lined(s, p, o) || !struckBy(p, m, o.id)) continue;
      if (o.st === 'fall' && (!m.juggle || o.jug >= s.rules.juggle)) continue;
      if (untouchable(o, F(o), 'strike')) continue;
      const hurt = bodyHurt(o, F(o)).find((h) => crosses(hb, h));
      if (hurt) contacts.push({ a: p, d: o, m, at: mid(hb, hurt) });
    }
  }
  for (const t of s.shots) {
    if (s.f - t.hitAt < t.rehit) continue;
    const sb = shotRect(t);
    for (const o of s.bodies) {
      if (o.side === t.side || o.gone || o.ko || t.hits <= 0 || Math.abs(o.z - t.z) > s.rules.line || t.hl.includes(o.id)) continue;
      if (o.st === 'fall' && (!t.sup || o.jug >= s.rules.juggle)) continue;
      if (untouchable(o, F(o), 'projectile')) continue;
      const hurt = bodyHurt(o, F(o)).find((h) => crosses(sb, h));
      if (hurt) contacts.push({ a: B[t.o], d: o, shot: t, at: mid(sb, hurt) });
    }
  }
  // PRIORITY between two bodies striking each other on one frame (the fight's): the higher level's lands alone
  for (const c of contacts) {
    if (!c.m || c.drop) continue;
    const back = contacts.find((k) => k.m && !k.drop && k.a === c.d && k.d === c.a);
    if (back && Number.isInteger(c.m.priority) && Number.isInteger(back.m.priority) && c.m.priority !== back.m.priority) {
      (c.m.priority > back.m.priority ? back : c).drop = true;
      const win = c.m.priority > back.m.priority ? c : back;
      s.events.push({ t: 'priority', p: win.a.id, d: win.d.id, x: (c.a.x + c.d.x) / 2, z: c.a.z, y: 1100 });
    }
  }
  for (const c of contacts) if (!c.drop) blow(s, ctx, c);
  // a flung body is a blow: each body of its own side it meets, knocked down, once
  for (const p of B) {
    if (!p.fl || p.st !== 'fall') continue;
    const box = pushOf(p, F(p));
    for (const o of B) {
      if (o.side !== p.side || p.fh.includes(o.id) || o.gone || o.ko || !lined(s, p, o) || untouchable(o, F(o), 'strike')) continue;
      if (!crosses(box, pushOf(o, F(o)))) continue;
      p.fh.push(o.id);
      o.hp -= scaledOn(s, o, s.rules.flung); o.combo++;
      o.st = 'fall'; o.sf = 0; o.mv = null; o.air = 0; o.vy = 45; o.vx = sgn(p.vx) * 20; o.vz = 0; if (o.y <= 0) o.y = 1; o.jug++;
      o.rx = { k: 'down', h: 1, w: 2, c: 0 };
      s.events.push({ t: 'hit', p: p.id, d: o.id, dmg: s.rules.flung, x: o.x, z: o.z, y: 900, combo: o.combo, w: 2, limb: 'body', kind: 'flung' });
      if (o.hp <= 0) knockOut(s, o, sgn(p.vx) || 1);
    }
  }
  // a grab lands where its thrower still throws and its body is free to be taken
  for (const [p, o, m] of grabs) {
    if (p.st !== 'move' || o.st === 'hit' || o.st === 'fall' || o.st === 'thrown' || o.st === 'throwing' || o.hold !== undefined) continue;
    p.hl = [[o.id, 1, p.mf]];
    p.st = 'throwing'; p.sf = 0; p.clinch = m.throw.clinch; p.throwDmg = m.damage; p.hold = o.id;
    o.st = 'thrown'; o.sf = 0; o.mv = null; o.pushn = 0; o.hold = p.id;
    o.rx = { k: 'grab', h: 1, w: m.damage < 45 ? 0 : m.damage < 85 ? 1 : 2, c: 0 };
    s.events.push({ t: 'grab', p: p.id, d: o.id, x: (p.x + o.x) / 2, z: p.z });
  }
}

const LIMBS = { fist: 'fist', toe: 'foot', ankle: 'foot', knee: 'knee', elbow: 'elbow', head: 'head' };
function blow(s, ctx, { a: p, d, m, shot, at }) {
  const src = shot ?? m, Fd = ctx.fighters[d.fi];
  const face = shot ? sgn(shot.vx) : p.face;
  const hitstop = src.hitstop ?? 10;
  if (shot) { shot.hits--; shot.hitAt = s.f; shot.hl.push(d.id); } else { const h = hitsOn(p, d.id); if (h) { h[1]++; h[2] = p.mf; } else p.hl.push([d.id, 1, p.mf]); }
  const airborne = d.y > 0 || d.air || d.st === 'air' || d.st === 'fall';
  const dm = d.st === 'move' && d.mv ? Fd.moves[d.mv] : null;
  // armor takes the damage, not the stun (the fight's)
  if (dm && dm.armor && d.mf >= dm.armor[0] && d.mf <= dm.armor[1] && (d.armorN ?? 0) < dm.armor[2]) {
    d.armorN = (d.armorN ?? 0) + 1;
    d.hp -= scaledOn(s, d, src.dmg ?? src.damage);
    d.hs = hitstop;
    if (!shot) { p.hs = Math.max(p.hs, hitstop); p.conn = 2; }
    s.events.push({ t: 'armor', p: p.id, d: d.id, x: d.x, z: d.z, y: 1100 });
    if (d.hp <= 0) knockOut(s, d, face);
    return;
  }
  const counter = !!dm && d.mf < dm.startup;
  let dmg = scaledOn(s, d, src.dmg ?? src.damage);
  if (counter) dmg = Math.floor((dmg * 6) / 5);
  d.hp -= dmg; d.combo++; d.mv = null; d.air = 0;
  d.hs = hitstop;
  if (!shot) { p.hs = Math.max(p.hs, d.hs); p.conn = 1; }
  p.meter = Math.min(METER_MAX, p.meter + (src.meter ?? 20));
  d.meter = Math.min(METER_MAX, d.meter + Math.round((src.meter ?? 20) / 2));
  const knock = shot ? (shot.sup ? 'down' : 'none') : m.knock;
  const w = (shot && shot.sup) || (!shot && m.kind === 'super') ? 2 : (src.dmg ?? src.damage ?? 30) < 45 ? 0 : (src.dmg ?? src.damage) < 85 ? 1 : 2;
  const box = shot ? shotRect(shot) : strikeOf(p, ctx.fighters[p.fi]);
  const top = Math.max(...bodyHurt(d, Fd).map((b) => b[3]), d.y + 1);
  const h = !shot && m.guard === 'low' ? 2 : (() => { const rel = ((box[1] + box[3]) / 2 - d.y) / Math.max(1, top - d.y); return rel > 0.7 ? 0 : rel < 0.38 ? 2 : 1; })();
  if (airborne || knock === 'launch' || knock === 'down') {
    d.st = 'fall'; d.sf = 0;
    d.rx = { k: knock === 'launch' ? 'launch' : airborne ? 'air' : !shot && m.guard === 'low' ? 'sweep' : 'down', h, w, c: counter ? 1 : 0 };
    d.vy = knock === 'launch' ? 105 : airborne ? 55 : 45;
    d.vx = face * (knock === 'launch' ? 10 : 20); d.vz = 0;
    if (d.y <= 0) d.y = 1;
    d.jug++;
  } else {
    d.st = 'hit'; d.sf = 0; d.stun = src.hitstun + (counter ? 2 : 0);
    d.rx = { k: 'hit', h, w, c: counter ? 1 : 0 };
    d.pushv = face * Math.round((src.push ?? 150) / 8); d.pushn = 8;
  }
  const limb = shot ? 'shot' : m.armed ? 'blade' : LIMBS[m.limb.replace(/[FB]$/, '')] ?? 'fist';
  s.events.push({ t: counter ? 'counter' : 'hit', p: p.id, d: d.id, dmg, x: at[0], z: d.z, y: at[1], combo: d.combo, w, limb, kind: shot ? 'shot' : m.kind });
  if (d.hp <= 0) knockOut(s, d, face);
}

function knockOut(s, d, face) {
  d.hp = 0; d.ko = 1; d.st = 'fall'; d.sf = 0; d.vy = Math.max(d.vy, 70); d.vx = face * 24; d.vz = 0; d.mv = null;
  if (d.y <= 0) d.y = 1;
  s.events.push({ t: 'ko', p: d.id });
}

/** A short, stable fingerprint of a state: all of it but the rules it was given and the frame's events. */
export function brawlHash(s) {
  const { rules: _r, events: _e, ...rest } = s;
  const str = JSON.stringify(rest);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
