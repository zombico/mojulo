#!/usr/bin/env node
// fighter weapons — does a weapon work in the fight, and is it part of the hurtbox? For every weapon on the shelf
// (versus-library.js WEAPONS), one all-rounder armed with it, read in the sim (versus-core.js), no page:
//
//   usable     the armed jab lands from a distance the bare jab whiffs at (the blade, not the fist, made contact); in a
//              CPU match the armed fighter's armed moves land, and two blades that meet clash
//   hurtbox    where the blade is a hurtbox: frame by frame, every armed move against the same fighter compiled with
//              `hurt: 'none'` (a box the blade adds is the blade's), split by phase (startup, active, recovery), and the
//              idle stances against the bare fighter's (a weapon held at rest adds nothing); then the sim's own answer,
//              a jab into a whiffed armed swing as it recovers, at each distance, against the same swing with `hurt:
//              'none'`: where only the first is hit, the jab landed on the blade alone
//   drawn      whether the 3D arena draws the blade: on the stick figure, and on a character's own body (read off the
//              arena client's source: the body makers that draw a blade)
//
//   node control/scripts/spikes/fighter/weapons.mjs [--out dir]
//
// Pure: no store, no browser. The report is report.json in --out; a line per weapon on stdout.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'fighter-weapons') } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
const V = (f) => import(path.join(CONTROL, 'lib/graph/versus', f));
const [{ compileFighter }, { newVersus, stepVersus }, { solveFighter }, { WEAPONS }, { runVersus }, { BTN }] = await Promise.all(
  ['versus-compile.js', 'versus-core.js', 'versus-solver.js', 'versus-library.js', 'versus-match.js', 'versus-input.js'].map(V));

const base = solveFighter({ id: 'kata', archetype: 'all-rounder' }).recipe;
const BARE = compileFighter(base);
const Z = { x: 0, y: 0, b: 0 };
const key = (b) => b.join(',');

/** two fighters `d` mm apart (centre to centre), the intro over */
function fight(d, fighters) {
  const ctx = { fighters };
  // (walls and the camera's span out of the way: the distances are the probe's)
  let s = newVersus(ctx, { rules: { intro: 1, half: 9000, span: 9000 } });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2); s.p[1].x = Math.round(d / 2);
  return { ctx, s };
}
/** n frames, pads from fn(k, s); the events with the move the attacker was in when it landed */
function run(s, ctx, n, fn) {
  const ev = [];
  for (let k = 0; k < n; k++) {
    s = stepVersus(s, fn(k, s), ctx);
    for (const e of s.events) ev.push({ k, ...e, mv: e.p !== undefined ? s.p[e.p].mv : null });
  }
  return { s, ev };
}
const tap = (k, at, b) => (k === at ? b : 0);

const report = { weapons: {}, drawn: null };
for (const [kind, W] of Object.entries(WEAPONS)) {
  const F = compileFighter({ ...base, weapon: kind });
  const N = compileFighter({ ...base, weapon: { kind, hurt: 'none' } });
  const armed = Object.entries(F.moves).filter(([, m]) => m.armed).map(([slot]) => slot);

  // ── hurtbox: the boxes the blade adds, by phase, and at rest ──
  const phase = { startup: 0, active: 0, recovery: 0 }, frames = { startup: 0, active: 0, recovery: 0 };
  for (const slot of armed) {
    const m = F.moves[slot], n = N.moves[slot];
    for (let f = 1; f <= m.total; f++) {
      const ph = f < m.startup ? 'startup' : f < m.startup + m.active ? 'active' : 'recovery';
      frames[ph]++;
      const own = new Set(n.frames[f].hurt.map(key));
      if (m.frames[f].hurt.some((b) => !own.has(key(b)))) phase[ph]++;
    }
  }
  const idleSame = Object.keys(BARE.idle).every((st) => JSON.stringify(F.idle[st].hurt) === JSON.stringify(BARE.idle[st].hurt));

  // ── usable: the armed standing normal (the grip hand's) lands further than the same normal bare ──
  const slot = ['stand.L', 'stand.M', 'stand.H'].find((k) => F.moves[k]?.armed), btn = BTN[slot.slice(-1)];
  const furthest = (A) => {
    let far = 0;
    for (let d = 600; d <= 3200; d += 25) {
      const { ctx, s } = fight(d, [A, BARE]);
      if (run(s, ctx, 40, (k) => [{ ...Z, b: tap(k, 0, btn) }, Z]).ev.some((e) => e.t === 'hit' || e.t === 'counter')) far = d;
    }
    return far;
  };
  const usable = { slot, landsTo: furthest(F), bareLandsTo: furthest(BARE), damage: F.moves[slot].damage, bareDamage: BARE.moves[slot].damage };
  // ── the sim's answer: B jabs into A's whiffed armed swing as it recovers, A armed with the shelf's blade and with
  // `hurt: 'none'`; a distance where only the first is hit is one where B's jab landed on the blade alone ──
  const punished = (A, d) => {
    const m = A.moves[slot], { ctx, s } = fight(d, [A, BARE]);
    // (B stands off while A swings, so A whiffs, and is set at d once A's active frames are over)
    s.p[1].x = s.p[0].x + 2 * d + 1500;
    return run(s, ctx, m.total + 20, (k, st) => {
      if (k === m.startup + m.active) st.p[1].x = st.p[0].x + d;
      return [{ ...Z, b: tap(k, 0, btn) }, { ...Z, b: tap(k, m.startup + m.active + 1, BTN.L) }];
    }).ev.some((e) => (e.t === 'hit' || e.t === 'counter') && e.p === 1);
  };
  const bladeOnly = [];
  for (let d = 600; d <= 3200; d += 25) if (punished(F, d) && !punished(N, d)) bladeOnly.push(d);
  const whiff = { bladeOnlyFrom: bladeOnly[0] ?? null, bladeOnlyTo: bladeOnly.at(-1) ?? null };
  // ── a CPU match: the armed moves land ──
  const match = runVersus({ fighters: [F, BARE], seed: 3, maxFrames: 60 * 60 * 2, log: false });
  let armedHits = 0;
  {
    const ctx = { fighters: [F, BARE] };
    // (replayed to read which move each of A's hits came from)
    const replay = runVersus({ fighters: [F, BARE], seed: 3, maxFrames: 60 * 60 * 2, log: true });
    let s = newVersus(ctx, {});
    for (const pad of replay.pads) { s = stepVersus(s, pad, ctx); for (const e of s.events) if ((e.t === 'hit' || e.t === 'counter') && e.p === 0 && s.p[0].mv && F.moves[s.p[0].mv]?.armed) armedHits++; }
  }
  // ── two blades that meet clash ──
  let clash = false;
  for (let d = 1200; d <= F.moves[slot].reach * 2 + 200 && !clash; d += 50) {
    const { ctx, s } = fight(d, [F, F]);
    clash = run(s, ctx, 20, (k) => [{ ...Z, b: tap(k, 0, btn) }, { ...Z, b: tap(k, 0, btn) }]).ev.some((e) => e.t === 'clash');
  }
  report.weapons[kind] = {
    hurt: W.hurt, armed,
    blade_hurtbox_frames: phase, armed_frames: frames, idle_adds_nothing: idleSame,
    usable, whiff_hit_on_the_blade_alone: whiff, match: { hits: match.stats.hits, armedHits, winner: match.winner }, clash,
  };
  const R = report.weapons[kind];
  console.log(`${kind.padEnd(7)} hurt:${W.hurt.padEnd(9)} blade hurtbox frames  startup ${phase.startup}/${frames.startup}  active ${phase.active}/${frames.active}  recovery ${phase.recovery}/${frames.recovery}  idle +0:${idleSame}  ` +
    `| ${slot} lands to ${usable.landsTo} mm (bare ${usable.bareLandsTo})  armed hits in a match ${armedHits}/${match.stats.hits[0]}  clash ${clash}  | a whiff hit on the blade alone: ${whiff.bladeOnlyFrom ? `${whiff.bladeOnlyFrom}–${whiff.bladeOnlyTo} mm` : 'never'}`);
}

// ── drawn: which of the arena's body makers draw a blade ──
const client = readFileSync(path.join(CONTROL, 'lib/graph/versus/versus-arena.client.js'), 'utf8');
const body = (name) => { const i = client.indexOf(`function ${name}(`); const j = client.indexOf('\nfunction ', i + 1); return client.slice(i, j < 0 ? undefined : j); };
report.drawn = Object.fromEntries([['stick figure', 'makeBody'], ['character, posed', 'makeCharacter'], ['character, played', 'makePlayed']].map(([who, fn]) => [who, /weapon/.test(body(fn))]));
console.log('blade drawn in the 3D arena:', JSON.stringify(report.drawn));
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
console.log(path.join(out, 'report.json'));
