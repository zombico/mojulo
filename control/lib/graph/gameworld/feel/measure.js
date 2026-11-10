/**
 * THE FEEL'S MEASURES — the feel chapter's machine gate: a game's swings and strings played headless on the runtime it
 * ships (worlds/controllable: createWorld / stepWorld, scripted presses at 60 Hz, as reach.js measures a jump), each number
 * beside what was asked of it: carried, partly or lost. Advice, never a refusal; nobody has looked.
 *
 * Two sides are asked:
 *   the KIT (each weapon's lowered moveset, combos.js lowerArsenal: the rule carries it): every ground combo played as
 *          written, each press early (held to the live move's cancel), on a dummy within the weapon's reach; each move's
 *          contact inside its window, the frame the next beat is taken at against its cancel (the last move's length
 *          against its frames), each less the frames its own hitstop froze it (a blow landed holds the swing, as it
 *          should), and the ground its travel covers on a dummy out of the way
 *   the CARD (the feel's, feel/cards.js): the hitstop on the first blow (inside the card's base to max), the foe's stun
 *          (the card's base), the dodge's frames and invincible frames, the guard's parry window
 * Air strings (they start from a jump) and the sidearm's press are named and not measured.
 *
 *   measureRule(rule, feel?, { foe? }) → { weapons: [{ id, combos: [{ id, beats, moves, skipped? }] }], card: [rows],
 *     tally: { carried, partly, lost }, lost: ['<where>: <what>'], partly: [the same] }
 *     rule  a hero's platform rule with its moveset (`weapons`, or one `moveset`) and a melee strike; the page's arming
 *           (world-scene.js armHeld) is the caller's: armedRule
 *     foe   { combo? } the dummy's combo rules (a foe body's: the arsenal's juggle lowered), as the room's foe wears them
 *   armedRule(rule, { cls?, blade? }) → the rule armed as the page arms a held blade of a class (hero-swing.js HELD_STRIKE)
 *   measureRoom(G) → measureRule on the world's practice room hero (practice-room.js), or null where it has none
 *   measuredSummary(M) → { carried, partly, lost, worst?: up to three lost lines, short?: up to three partly } (design_game's
 *     readout)
 *
 * Pure and deterministic.
 */
import { createWorld, stepWorld } from '../../worlds/controllable-world.js';
import { HELD_STRIKE } from '../../polygonizer/hero-swing.js';
import { feelCard } from './lower.js';
import { practiceRoom, roomEligible } from '../practice-room.js';

const FPS = 60, DT = 1 / FPS;
const r3 = (v) => Math.round(v * 1000) / 1000;
// (a held blade's length a class, metres: the reach the page arms is the blade plus 0.65 m, world-kinds.js)
const BLADE = Object.freeze({ light: 0.3, normal: 0.9, heavy: 1.4 });
// the presses a beat is (combat-melee.js stepMoveset): the light on fire, the heavy, back + heavy with the stick pulled
// away, a face with the modifier held
const PRESS = Object.freeze({ L: { fire: 1 }, H: { heavy: 1 }, bH: { heavy: 1, forward: -1 }, mL: { mod: 1, fire: 1 }, mH: { mod: 1, heavy: 1 }, mS: { mod: 1, special: 1 }, S: { special: 1 } });
// (the tolerance a frame count is carried within)
const TOL = 2;

/** The rule armed as the World page arms a hero holding a blade of a class. */
export function armedRule(rule, { cls = 'normal', blade = BLADE[cls] } = {}) {
  const H = HELD_STRIKE[cls];
  return { ...rule, strike: 'melee', strikeReach: r3(blade + 0.65), strikeDur: H.seconds, strikeDamage: H.damage };
}

// every combo a lowered tree ends, as its beats (a pause a '.'), walked from the root
function combosOf(tree) {
  const out = [];
  const walk = (node, beats) => {
    for (const id of node.ends ?? []) out.push({ id, beats });
    for (const [b, n] of Object.entries(node.next ?? {})) walk(n, [...beats, b]);
    for (const [b, n] of Object.entries(node.pause ?? {})) walk(n, [...beats, '.', b]);
  };
  for (const [b, n] of Object.entries(tree ?? {})) walk(n, [b]);
  return out;
}

// a hero and a dummy that never dies, standing `at` metres ahead; the hero's weapon `k`
function room(rule, k, at, foe = {}) {
  const { move: _m, ...R } = rule;   // (the stick read in the hero's frame: back is the stick pulled, no camera)
  const w = createWorld({ entities: [
    { id: 'hero', pilotable: true, team: 'hero', rule: { ...R, eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1e6, poise: 1, ...(foe.combo ? { combo: foe.combo } : {}) }, rule: { type: 'static' }, transform: { pos: [at, 0, 0], heading: Math.PI } },
  ], colliders: [], pilot: 'hero' });
  w.byId.foe.noDestroy = true;
  if (k) w.byId.hero.weaponIdx = k;
  const hooks = { ground: () => 0 };
  for (let i = 0; i < 10; i++) stepWorld(w, {}, DT, hooks);
  return { w, h: w.byId.hero, foe: w.byId.foe, step: (inp) => stepWorld(w, inp || {}, DT, hooks) };
}

// a combo's beats played: each press two frames after the last move began (held to its cancel), a pause's after the last
// move ended and its pause's first frame has passed; what each move did, frame by frame
function play(rule, k, beats, at, M, foe) {
  const R = room(rule, k, at, foe), seq = beats.filter((b) => b !== '.');
  const ran = [];
  let n0 = R.h.swingCount || 0, hits0 = R.foe.hits || 0, i = 0, pressAt = 0, wait = false, stopF = 0, stunF = 0;
  for (let f = 0; f < 60 * 8; f++) {
    const inp = f === pressAt && i < seq.length ? PRESS[seq[i]] : {};
    if (f === pressAt && i < seq.length) i++;
    R.step(inp);
    const n = R.h.swingCount || 0;
    if (n > n0) {
      n0 = n;
      ran.push({ move: R.h.mvMove, start: f, contact: null, end: null, stop: 0, x: R.h.transform.pos[0] });
      if (i < seq.length) { const pause = beats[beats.length - (seq.length - i) - 1] === '.' ; if (pause) wait = true; else pressAt = f + 2; }
    }
    const cur = ran[ran.length - 1];
    if (cur && cur.contact == null && (R.foe.hits || 0) > hits0) cur.contact = f - cur.start;
    hits0 = R.foe.hits || 0;
    if (cur && cur.end == null && R.h.hitstopT > 0) cur.stop++;
    if (ran.length === 1 && R.h.hitstopT > 0) stopF++;
    if (ran.length >= 1 && ran[0].contact != null && R.foe.staggerT != null && ran.length === 1) stunF++;
    if (cur && cur.end == null && R.h.swingT == null) {
      cur.end = f - cur.start - cur.stop; cur.moved = r3(R.h.transform.pos[0] - cur.x);
      if (wait) { wait = false; pressAt = f + Math.round(M.pause[0] * FPS) + 2; }
    }
    if (i >= seq.length && ran.length >= seq.length && cur?.end != null && f > (cur.start + (cur.end ?? 0) + 30)) break;
  }
  // (a move's travel: the ground covered from its start to the next one's, or to its own end)
  for (let j = 0; j < ran.length; j++) if (ran[j + 1]) ran[j].moved = r3(ran[j + 1].x - ran[j].x);
  return { ran, hitstop: stopF, stun: stunF };
}

const verdictOf = (ok, part) => (ok ? 'carried' : part ? 'partly' : 'lost');

/** The measures of a rule (see the header). */
export function measureRule(rule, feel = null, { foe = {} } = {}) {
  const Ws = Array.isArray(rule.weapons) && rule.weapons.length ? rule.weapons : rule.moveset ? [{ id: 'weapon', moveset: rule.moveset }] : [];
  const tally = { carried: 0, partly: 0, lost: 0 }, lost = [], partly = [];
  const mark = (v, where) => { tally[v]++; if (v === 'lost') lost.push(where); if (v === 'partly') partly.push(where); return v; };
  let first = null;
  const weapons = Ws.map((W, k) => {
    const M = W.moveset, reach = W.reach ?? rule.strikeReach ?? 1.5, near = r3(Math.max(0.7, reach - 0.3));
    const combos = combosOf(M.tree).map((C) => {
      if (C.beats.includes('S') && W.sidearm) return { ...C, skipped: 'S is the sidearm\'s press' };
      const seq = C.beats.filter((b) => b !== '.'), want = [];
      // (the moves the combo's path plays, read off the tree)
      let node = { next: M.tree };
      for (let b = 0; b < C.beats.length; b++) {
        if (C.beats[b] === '.') { node = { next: node.pause }; continue; }
        node = node.next?.[C.beats[b]];
        want.push(node.move);
      }
      const hit = play(rule, k, C.beats, near, M, foe), far = play(rule, k, C.beats, 6, M, foe);
      if (!first && hit.ran[0]?.contact != null) first = hit;
      const moves = want.map((id, j) => {
        const mv = M.moves[id], r = hit.ran[j], rf = far.ran[j], frames = Math.round(mv.dur * FPS), where = `${W.id} ${C.id} ${id}`;
        if (!r || r.move !== id) return { move: id, verdicts: { played: mark('lost', `${where}: ${r ? `played ${r.move}` : 'never played'}`) } };
        const win = mv.contact ?? rule.strikeContact ?? [0.3, 0.6], lo = Math.floor(win[0] * frames) - 1, hi = Math.ceil(win[1] * frames) + 1;
        const v = {};
        const asked = { contact: [lo + 1, hi - 1] }, ran = { contact: r.contact };
        v.contact = mark(verdictOf(r.contact != null && r.contact >= lo && r.contact <= hi, r.contact != null), `${where}: contact at ${r.contact ?? 'none'} where [${lo + 1}, ${hi - 1}] was asked`);
        if (j < want.length - 1 && seq[j + 1] && C.beats[C.beats.indexOf(seq[j + 1], j) - 1] !== '.' && hit.ran[j + 1]) {
          const cancel = Math.round(Math.min(1, mv.cancel ?? 1) * frames), took = hit.ran[j + 1].start - r.start - r.stop;
          asked.next = cancel; ran.next = took;
          v.chain = mark(verdictOf(Math.abs(took - cancel) <= TOL, took > cancel), `${where}: the next beat taken at ${took} where its cancel is ${cancel}`);
        } else if (j === want.length - 1) {
          asked.frames = frames; ran.frames = r.end;
          v.length = mark(verdictOf(r.end != null && Math.abs(r.end - frames) <= TOL, r.end != null), `${where}: ${r.end ?? 'never'} frames where ${frames} were asked`);
        }
        if (mv.travel && mv.travel.kind !== 'none' && rf) {
          asked.travel = mv.travel.m; ran.travel = rf.moved ?? 0;
          v.travel = mark(verdictOf(Math.abs((rf.moved ?? 0) - mv.travel.m) <= 0.05, (rf.moved ?? 0) > 0.02), `${where}: travelled ${rf.moved ?? 0} m where ${mv.travel.m} m was asked`);
        }
        return { move: id, asked, ran, verdicts: v };
      });
      return { id: C.id, beats: C.beats.join(' '), moves };
    });
    // (the air strings start from a jump: named, not measured)
    const air = combosOf(M.airTree).map((C) => ({ id: C.id, beats: C.beats.join(' '), skipped: 'an air string (from a jump)' }));
    return { id: W.id, combos: [...combos, ...air] };
  });

  // THE CARD's side: what the feel asks of a blow, a dodge and a guard
  const card = [];
  if (feel != null) {
    const C = feelCard(feel), row = (measure, asked, ran, v) => card.push({ measure, asked, ran, verdict: mark(v, `the card's ${measure}: ${ran} where ${asked} was asked`) });
    const hs = C.hit?.hitstop;
    if (hs && first) row('hitstop', `${hs.base} to ${hs.max} f`, `${first.hitstop} f`, verdictOf(first.hitstop >= hs.base - 1 && first.hitstop <= hs.max + 1, first.hitstop > 0));
    const st = C.hit?.stun;
    // (a card whose stun is the rule's asks a number of frames; one whose stun is the foe body's own, or none, asks none)
    if (st && st.model === 'rule' && Number.isFinite(st.base) && first) { const want = Math.round(st.base * FPS); row('stun', `${want} f`, `${first.stun} f`, verdictOf(Math.abs(first.stun - want) <= 3, first.stun > 0)); }
    if (C.dodge) {
      const D = dodgeOf(rule), inv = C.dodge.iframes ? C.dodge.iframes[1] - C.dodge.iframes[0] : 0;
      row('dodge', `${C.dodge.frames} f, ${inv} invincible`, D ? `${D.frames} f, ${D.invincible} invincible` : 'none', verdictOf(!!D && Math.abs(D.frames - C.dodge.frames) <= TOL && Math.abs(D.invincible - inv) <= TOL, !!D));
    }
    if (C.guard && C.guard.parry != null) {
      const p = rule.guard?.parry != null ? Math.round(rule.guard.parry * FPS) : null;
      row('parry', `${C.guard.parry} f`, p == null ? 'none' : `${p} f`, verdictOf(p != null && Math.abs(p - C.guard.parry) <= 1, !!rule.guard));
    }
  }
  return { weapons, card, tally, lost, partly };
}

// the dodge: the boost tapped twice (F F); its frames and its invincible frames
function dodgeOf(rule) {
  if (!rule.dodge) return null;
  const R = room(rule, 0, 6);
  let frames = 0, inv = 0;
  for (let f = 0; f < 120; f++) {
    R.step(f === 0 || f === 3 ? { boost: 1, forward: 1 } : { forward: f < 6 ? 1 : 0 });
    if (R.h.dodgeT != null) { frames++; if (R.h.invincible) inv++; }
  }
  return frames ? { frames, invincible: inv } : null;
}

/** The world's practice room hero measured (practice-room.js), or null where the world has no room. */
export function measureRoom(G) {
  if (roomEligible(G)) return null;
  const ents = practiceRoom(G, { sound: 'none' }).manifest.entities, hero = ents.find((e) => e.pilotable), foe = ents.find((e) => e.team === 'foes');
  // (the dummy wears what the room's foe does: the arsenal's juggle, its hitstun among it)
  return measureRule(armedRule(hero.rule), G.feel, { foe: { combo: foe?.body?.combo ?? null } });
}

/** The readout's summary of a measure. */
export function measuredSummary(M) {
  return M ? { ...M.tally, ...(M.lost.length ? { worst: M.lost.slice(0, 3) } : {}), ...(M.partly.length ? { short: M.partly.slice(0, 3) } : {}) } : null;
}
