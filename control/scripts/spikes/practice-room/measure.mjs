#!/usr/bin/env node
/**
 * THE PRACTICE ROOM'S MEASURES — an action game's swings, strings and weapons measured on the runtime it ships
 * (worlds/controllable: createWorld / stepWorld on scripted presses at 60 Hz, as gameworld/feel/reach.js measures a
 * jump), each beside what the game's feel card asks for: carried, partly or lost.
 *
 *   cd control
 *   node scripts/spikes/practice-room/measure.mjs                       # the three sword templates, the sword
 *   node scripts/spikes/practice-room/measure.mjs --feel fable-of-artesia --class heavy
 *   node scripts/spikes/practice-room/measure.mjs --page <level.html>   # a built game's own pilot (The Old Keep's)
 *   node scripts/spikes/practice-room/measure.mjs --json                # the numbers alone
 *
 * The rule is the game's: the feel's card lowered over the hero's own platform rule (feel/reach.js shippedRule, what
 * gameworld/levels.js lays), the held weapon's class over it (world-kinds.js: HELD_STRIKE's seconds and damage, the
 * blade's length + 0.65 m its reach); or, with --page, the pilot entity a built level carries, byte for byte.
 * The foe is a dummy that never dies (practice: `noDestroy`), standing, with poise (every hit staggers it).
 * Machine gate only: nobody has looked.
 */
import { register } from 'node:module';
import fs from 'node:fs';
register('../../mcp-stdio-loader.mjs', import.meta.url);

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const { createWorld, stepWorld } = await import('../../../lib/graph/worlds/controllable-world.js');
const { shippedRule } = await import('../../../lib/graph/gameworld/feel/reach.js');
const { feelCard } = await import('../../../lib/graph/gameworld/feel/lower.js');
const { HELD_STRIKE } = await import('../../../lib/graph/polygonizer/hero-swing.js');

const FPS = 60, DT = 1 / FPS;
// a nominal blade a class (metres): the measure's own, said; a built game's --page carries its real reach
const BLADE = { light: 0.3, normal: 0.9, heavy: 1.4 };
export const TEMPLATES = ['ebon-spirits', 'fable-of-artesia', 'fallen-angel'];

/** the rule a game ships for a feel and a held weapon class */
export function heldRule(feel, cls = 'normal') {
  const H = HELD_STRIKE[cls];
  return { ...shippedRule(feel), strike: 'melee', strikeReach: Math.round((BLADE[cls] + 0.65) * 100) / 100, strikeDur: H.seconds, strikeDamage: H.damage };
}
/** a built level page's pilot entity (its rule as the page plays it) */
export function pageRule(html) {
  const at = html.indexOf('createWorld({ entities: ');
  if (at < 0) throw new Error('measure: no controllable world on that page');
  let i = html.indexOf('[', at), depth = 0, j = i, str = false;
  for (; j < html.length; j++) {
    const ch = html[j];
    if (str) { if (ch === '\\') j++; else if (ch === '"') str = false; continue; }
    if (ch === '"') str = true; else if (ch === '[' || ch === '{') depth++; else if (ch === ']' || ch === '}') { depth--; if (!depth) break; }
  }
  const ents = JSON.parse(html.slice(i, j + 1)), p = ents.find((e) => e.pilotable) ?? ents[0];
  return p.rule;
}

// ─── the room ───
const dummyAt = (d) => ({ id: 'foe', team: 'foes', body: { type: 'box', size: [0.6, 0.6, 1.8], hittable: true, hp: 1e6, poise: 1 }, rule: { type: 'static' }, transform: { pos: [d, 0, 0], heading: Math.PI } });
function room(rule, d = 1.2) {
  const w = createWorld({ entities: [{ id: 'hero', pilotable: true, team: 'hero', rule: { ...rule, eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }, dummyAt(d)], colliders: [], pilot: 'hero' });
  w.byId.foe.noDestroy = true;
  const world = { ground: () => 0 };
  for (let i = 0; i < 10; i++) stepWorld(w, {}, DT, world);
  return { w, h: w.byId.hero, foe: w.byId.foe, step: (inp) => stepWorld(w, inp || {}, DT, world) };
}
const press = (frames, extra = {}) => (f) => ({ ...(frames.includes(f) ? { fire: 1 } : {}), ...extra });

/** one swing: press on frame 0, watched to rest */
export function single(rule, d = 1.2) {
  const R = room(rule, d), x0 = R.h.transform.pos[0];
  let contact = null, end = null, began = null, stopH = 0, stun = 0, stunEnd = null, hits0 = R.foe.hits || 0;
  for (let f = 0; f < 240; f++) {
    R.step(press([0])(f));
    if (began == null && R.h.swingT != null) began = f;
    if (contact == null && (R.foe.hits || 0) > hits0) contact = f;
    if (R.h.hitstopT > 0) stopH++;
    if (R.foe.staggerT != null) { stun++; stunEnd = f; }
    if (began != null && end == null && R.h.swingT == null) end = f;
  }
  return { began, contact, end, hitstop: stopH, stun, advantage: stunEnd != null && end != null ? stunEnd - end : null, lunge: Math.round((R.h.transform.pos[0] - x0) * 1000) / 1000 };
}
/** the earliest frame a second press starts a second swing, and whether the runtime calls it a combo step */
export function nextTaken(rule) {
  for (let k = 1; k <= 120; k++) {
    const R = room(rule);
    let second = false, combo = false;
    for (let f = 0; f <= k + 2; f++) { R.step(press([0, k])(f)); if ((R.h.swingCount || 0) >= 2) { second = true; combo = !!R.h.swingCombo; break; } }
    if (second) return { frame: k, combo };
  }
  return { frame: null, combo: false };
}
/** the string: the button pressed on every other frame for four seconds (neutral, or alternating sides) */
export function mash(rule, { alternate = false } = {}) {
  const R = room(rule);
  const hitAt = [];
  let hits0 = R.foe.hits || 0;
  for (let f = 0; f < 240; f++) {
    const side = alternate && (R.h.swingCount || 0) % 2 === 1 ? { strafe: 1 } : {};
    R.step({ ...(f % 2 === 0 ? { fire: 1 } : {}), ...side });
    R.h.transform.pos[1] = 0; R.h.transform.heading = 0;   // (the side's stick turns nobody away from the dummy)
    if ((R.foe.hits || 0) > hits0) { hitAt.push(f); hits0 = R.foe.hits; }
  }
  const gaps = hitAt.slice(1).map((f, i) => f - hitAt[i]);
  return { hits: hitAt.length, first: hitAt[0] ?? null, gaps, longest: gaps.length ? Math.max(...gaps) : null };
}
/** the reach: the farthest the dummy stands where the first swing still lands (0.05 m steps) */
export function reach(rule) {
  let best = null;
  for (let d = 0.5; d <= 4.001; d += 0.05) if (single(rule, d).contact != null) best = Math.round(d * 100) / 100;
  return best;
}
/** the dodge: F tapped twice; its frames and its invincible frames */
export function dodge(rule) {
  const R = room(rule, 6);
  let frames = 0, inv = 0, began = null;
  for (let f = 0; f < 120; f++) {
    R.step(f === 0 || f === 3 ? { boost: 1, forward: 1 } : { forward: f < 6 ? 1 : 0 });
    if (R.h.dodgeT != null) { frames++; began ??= f; if (R.h.invincible) inv++; }
  }
  return { began, frames, invincible: inv };
}

// ─── the card's side (what the feel asks for) ───
export function asked(feel) {
  const C = feelCard(feel), S = C.moves?.string ?? [], m = S[0];
  const cancel = !m || C.moves.cancel === 'none' || S.length < 2 ? null : C.moves.cancel === 'half' ? m.startup + m.active + Math.ceil(m.recovery / 2) : m.startup + m.active + C.moves.cancel;
  return {
    startup: m?.startup ?? null, total: m ? m.startup + m.active + m.recovery : null, cancel, string: S.length, lunge: m?.lunge ?? 0,
    hitstop: C.hit?.hitstop ? `${C.hit.hitstop.base}-${C.hit.hitstop.max}` : 'none', stun: C.hit?.stun?.model ?? 'none',
    dodge: C.dodge ? { frames: C.dodge.frames, invincible: C.dodge.iframes ? C.dodge.iframes[1] - C.dodge.iframes[0] : 0 } : null,
    guard: C.guard ? { parry: C.guard.parry, perfect: C.guard.perfect?.window ?? null } : null,
  };
}

export function measure(rule, feel) {
  const one = single(rule), next = nextTaken(rule);
  return { asked: feel ? asked(feel) : null, rule: { strikeDur: rule.strikeDur, strikeContact: rule.strikeContact, combo: rule.combo ?? 0, comboCooldown: rule.comboCooldown ?? null, hitstop: rule.hitstop ?? null, reach: rule.strikeReach },
    single: one, next, mash: mash(rule), alternate: mash(rule, { alternate: true }), reach: reach(rule), dodge: rule.dodge ? dodge(rule) : null, guard: rule.guard ?? null };
}

// ─── the report ───
const verdict = (ok, part) => (ok ? 'carried' : part ? 'partly' : 'lost');
function report(name, M) {
  const A = M.asked, s = M.single, rows = [];
  const row = (what, card, runtime, v) => rows.push([what, String(card), String(runtime), v]);
  if (A) {
    row('press to contact (f)', A.startup, s.contact, verdict(s.contact != null && Math.abs(s.contact - A.startup) <= 1, s.contact != null));
    row('one swing, to rest (f)', A.total, s.end, verdict(s.end != null && Math.abs(s.end - A.total) <= 1, s.end != null));
    row('next press taken at (f)', A.cancel ?? 'the end', `${M.next.frame}${M.next.combo ? ' (combo)' : ''}`, verdict(A.cancel != null && M.next.frame != null && Math.abs(M.next.frame - A.cancel) <= 1, M.next.frame != null));
    row('string, mashed (hits in 4 s)', `${A.string} a string`, `${M.mash.hits}, gaps ${M.mash.gaps.slice(0, 4).join(' ')}`, '—');
    row('string, sides alternated', `${A.string} a string`, `${M.alternate.hits}, gaps ${M.alternate.gaps.slice(0, 4).join(' ')}`, '—');
    row('hitstop (f)', A.hitstop, s.hitstop, verdict(A.hitstop === 'none' ? s.hitstop === 0 : s.hitstop > 0, false));
    row('the foe\'s stun (f) / advantage', A.stun, `${s.stun} / ${s.advantage}`, A.stun === 'rule' ? 'lost: the card\'s hitstun is the world\'s combo, never set' : '—');
    row('lunge (m)', A.lunge, s.lunge, verdict(Math.abs(s.lunge - A.lunge) < 0.05, s.lunge > 0));
    row('reach (m)', '—', M.reach, '—');
    row('dodge frames / invincible', A.dodge ? `${A.dodge.frames} / ${A.dodge.invincible}` : 'none', M.dodge ? `${M.dodge.frames} / ${M.dodge.invincible}` : 'none', A.dodge ? verdict(M.dodge && Math.abs(M.dodge.frames - A.dodge.frames) <= 1 && Math.abs(M.dodge.invincible - A.dodge.invincible) <= 1, !!M.dodge) : '—');
    row('guard / parry (f)', A.guard ? `parry ${A.guard.parry}${A.guard.perfect ? `, perfect ${A.guard.perfect}` : ''}` : 'none', M.guard ? JSON.stringify(M.guard) : 'none', A.guard ? verdict(!!M.guard, false) : '—');
  }
  const w = [32, 18, 26];
  console.log(`\n${name}  (strikeDur ${M.rule.strikeDur} s, contact ${JSON.stringify(M.rule.strikeContact)}, combo ${M.rule.combo}, hitstop ${JSON.stringify(M.rule.hitstop)})`);
  console.log(`  ${'measure'.padEnd(w[0])}${'card'.padEnd(w[1])}${'runtime'.padEnd(w[2])}`);
  for (const [a, b, c, d] of rows) console.log(`  ${a.padEnd(w[0])}${b.padEnd(w[1])}${c.padEnd(w[2])}${d}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cls = opt('--class', 'normal'), out = {};
  if (opt('--page')) {
    const rule = pageRule(fs.readFileSync(opt('--page'), 'utf8')), feel = opt('--feel') ? JSON.parse(opt('--feel').startsWith('{') ? opt('--feel') : JSON.stringify(opt('--feel'))) : null;
    out.page = measure(rule, feel);
  } else for (const f of opt('--feel') ? [opt('--feel')] : TEMPLATES) out[`${f} (${cls})`] = measure(heldRule(f, cls), f);
  if (argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else for (const [k, M] of Object.entries(out)) report(k, M);
}
