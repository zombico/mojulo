// action-lab verify: the laws every feel keeps, over scripted pads, PASS/FAIL per concept. The machine gate only;
// nobody has played it.
//   node scripts/spikes/action-lab/verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { FEELS, FEEL_IDS, BTN, FPS, ARENA, newState, step, frameData, util } from './feel.mjs';
const T = await import('./takes.mjs');
const A = await import('../animation-games/flavor.mjs');

const cast = process.argv[2] ?? 'male';
const R = T.rigOf(cast), body = T.bodyOf(R);
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const note = (name, measured) => console.log(`note  ${name}  ${JSON.stringify(measured)}`);
const OPEN = { half: 400, blocks: [], hero: [0, 0], dummy: [300, 300] };
const J = BTN.JUMP, AT = BTN.ATTACK, DG = BTN.DODGE;

/**
 * Run a pad script: `pads(f)` → [x, y, buttons] for tick f, `n` ticks. Every tick checks the walls (no body inside a
 * block taller than a step over its feet, none past the arena). Returns the events and the per-tick states.
 */
function run(card, pads, n, { arena = OPEN, setup = null, spar = false, who = body } = {}) {
  let S = newState(card, who, { arena, spar }); if (setup) setup(S);
  const events = [], states = []; let breach = null;
  for (let f = 0; f < n; f++) {
    S = step(S, pads(f)); events.push(...S.events); states.push(S);
    for (const w of ['hero', 'dummy']) { const B = S[w];
      if (Math.abs(B.p[0]) > arena.half - util.RADIUS + 1e-9 || Math.abs(B.p[1]) > arena.half - util.RADIUS + 1e-9) breach ??= { f, w, p: B.p };
      for (const k of arena.blocks) if (k.h > B.p[2] + 0.12 && B.p[0] > k.x[0] + 1e-6 && B.p[0] < k.x[1] - 1e-6 && B.p[1] > k.y[0] + 1e-6 && B.p[1] < k.y[1] - 1e-6) breach ??= { f, w, p: B.p, block: k.id }; }
  }
  return { events, states, breach, end: S };
}
const ev = (r, type, who = 'hero') => r.events.filter((e) => e.type === type && e.who === who);
const hold = (bits, from, to) => (f) => (f >= from && f < to ? bits : 0);
const pad = (x, y, b) => [x, y, b];
const allBreaches = [];
const runs = [];
const track = (r) => { runs.push(r); if (r.breach) allBreaches.push(r.breach); return r; };

const table = {};
for (const id of FEEL_IDS) {
  const C = FEELS[id], row = (table[id] = {});
  // ─── ground ───
  const fwd = track(run(C, () => pad(0, 127, 0), 400));
  const speeds = fwd.states.map((s) => Math.hypot(s.hero.v[0], s.hero.v[1]));
  const t90 = speeds.findIndex((v) => v >= 0.9 * C.ground.run) + 1, want = Math.ceil((0.9 * C.ground.run) / C.ground.accel * FPS);
  row['90% run (f)'] = t90; row['top (m/s)'] = +Math.max(...speeds).toFixed(3);
  check(`${id}: from rest the stick reaches 90 % of the run on the card's acceleration, and never passes the run on the ground`, Math.abs(t90 - want) <= 1 && Math.max(...speeds) <= C.ground.run + 1e-9, { t90, want, top: Math.max(...speeds) });
  const stop = track(run(C, (f) => pad(0, f < 300 ? 127 : 0, 0), 600));
  const after = stop.states.slice(299).map((s) => Math.hypot(s.hero.v[0], s.hero.v[1])); const still = after.findIndex((v) => v < 1e-9);
  row['stop (f)'] = still; row['stop (m)'] = +(stop.states[299 + Math.max(0, still)].hero.p[1] - stop.states[299].hero.p[1]).toFixed(3);
  check(`${id}: letting go stops the body on the card's deceleration`, Math.abs(still - Math.ceil((C.ground.run / C.ground.decel) * FPS)) <= 1, { still, want: Math.ceil((C.ground.run / C.ground.decel) * FPS) });

  // ─── jump: latency, height, variable height ───
  const full = track(run(C, hold(J, 10, 200), 300));
  const tk = ev(full, 'takeoff')[0], ap = ev(full, 'apex')[0], ld = ev(full, 'land')[0];
  row['jump: press→off (f)'] = tk.f - 10; row['apex (m)'] = ap.height; row['air (f)'] = ld.f - tk.f;
  check(`${id}: a ground jump leaves on the press + the card's commit`, tk.f - 10 === C.jump.commit, { latency: tk.f - 10, commit: C.jump.commit });
  check(`${id}: the full hold's apex is the card's height`, Math.abs(ap.height - C.jump.height) < 1e-3, { apex: ap.height, card: C.jump.height });
  const holds = [1, 3, 6, 10, 16, 200].map((h) => ev(track(run(C, hold(J, 10, 10 + C.jump.commit + h), 300)), 'apex')[0].height);
  check(`${id}: a longer hold never rises less, the shortest is ${C.jump.cut < 1 ? 'lower' : 'the same (no cut)'}`, holds.every((h, i) => !i || h >= holds[i - 1] - 1e-9) && (C.jump.cut < 1 ? holds[0] < holds.at(-1) : holds[0] === holds.at(-1)), holds);
  row['tap apex (m)'] = holds[0];

  // ─── buffer: a press before landing ───
  const L = ld.f, held = ap.f + C.jump.hang + 2;
  for (const k of [C.jump.buffer, C.jump.buffer + 1]) {
    const r = track(run(C, (f) => (f >= 10 && f < held) || f === L - k ? J : 0, 300));
    const second = ev(r, 'takeoff')[1], acted = ev(r, 'acted').filter((e) => e.button === 'jump')[1];
    if (k <= C.jump.buffer) check(`${id}: a press ${k} f before landing (the buffer) jumps on the landing, + commit`, acted?.f === L && second?.f === L + C.jump.commit, { landing: L, acted: acted?.f, takeoff: second?.f });
    else check(`${id}: a press ${k} f before landing (one past the buffer) is dropped, and says so`, !second && ev(r, 'dropped').some((e) => e.button === 'jump' && /buffer ran out/.test(e.why)), ev(r, 'dropped').map((e) => e.why));
  }

  // ─── coyote: walking off an edge ───
  const LEDGE = { half: 400, blocks: [{ id: 'shelf', x: [-50, 50], y: [-50, 0], h: 1 }], hero: [0, -3], dummy: [300, 300] };
  const up = (S) => { S.hero.p[2] = 1; };
  const walk = (f) => pad(0, 127, 0);
  const off = track(run(C, walk, 200, { arena: LEDGE, setup: up })); const edge = ev(off, 'edge')[0].f;
  for (const k of [C.jump.coyote, C.jump.coyote + 1]) {
    const r = track(run(C, (f) => pad(0, 127, f === edge + k ? J : 0), 200, { arena: LEDGE, setup: up }));
    const tko = ev(r, 'takeoff')[0], landed = ev(r, 'land')[0];
    if (k <= C.jump.coyote) check(`${id}: a press ${k} f after walking off (the coyote) jumps from the air`, tko?.f === edge + k && ev(r, 'coyote').length === 1, { edge, takeoff: tko?.f });
    else check(`${id}: a press ${k} f after walking off (one past the coyote) does not jump in the air`, !tko || (landed && tko.f >= landed.f), { edge, takeoff: tko?.f, land: landed?.f });
  }

  // ─── the move: contact on startup, the clip's fist on its point ───
  const m0 = C.moves.string[0], range = body.reach[m0.take] + util.RADIUS - 0.05;
  const near = { half: 400, blocks: [], hero: [0, 0], dummy: [0, range] };
  const one = track(run(C, (f) => (f === 5 ? AT : 0), 120, { arena: near }));
  const h1 = ev(one, 'hit', 'dummy')[0];
  check(`${id}: an attack connects on the press + the card's startup`, h1 && h1.f - 5 === m0.startup, { contact: h1 && h1.f - 5, startup: m0.startup });
  const fm = T.fitMove(R, m0, C, { name: id }); const sig = A.signature(R, fm.rendered, { take: fm.take });
  check(`${id}: the fitted clip's contact frame is the startup and its fist lands on the take's contact point`, fm.rendered.beats.find((b) => b.id === 'contact').frame === m0.startup && sig.contactErr < 1e-4, { frame: fm.rendered.beats.find((b) => b.id === 'contact').frame, err: sig.contactErr });
  row['jab startup (f)'] = m0.startup; row['wind depth (m)'] = sig.windDepth;

  // ─── hitstop: both bodies, the card's frames ───
  const hs = h1?.hitstop ?? 0, hi = one.events.indexOf(h1), hf = h1.f;
  const at = (f) => one.states[f]; const same = (a, b) => JSON.stringify([a.hero.p, a.hero.v, a.hero.act, a.dummy.p, a.dummy.v]) === JSON.stringify([b.hero.p, b.hero.v, b.hero.act, b.dummy.p, b.dummy.v]);
  const frozen = Array.from({ length: hs }, (_, i) => same(at(hf), at(hf + 1 + i))).every(Boolean);
  const moved = !same(at(hf + hs), at(hf + hs + 1));
  const wantHs = C.hit.hitstop ? Math.min(C.hit.hitstop.max, Math.round(C.hit.hitstop.base + C.hit.hitstop.perMs * h1.dv)) : 0;
  check(`${id}: a hit freezes both bodies for the card's hitstop (${wantHs} f), then both move on`, hs === wantHs && frozen && moved, { hitstop: hs, frozen, moved });
  row['hitstop (f)'] = hs; row['Δv shown (m/s)'] = h1.dv; row['powerscale'] = h1.powerscale; void hi;

  // ─── the string: the frame data read off the card is what the kernel plays ───
  const mash = track(run(C, (f) => (f % 2 === 0 && f >= 5 ? AT : 0), 200, { arena: near }));
  const hits = ev(mash, 'hit', 'dummy'), fd = frameData(C, body);
  row['string'] = mash.events.filter((e) => e.who === 'dummy' && ['hit', 'blocked', 'immune', 'whiff'].includes(e.type)).slice(0, 4).map((e) => e.type + (e.advantage != null ? `(+${e.advantage})` : '')).join(' ');
  // the first string, on a fresh victim (a second string lands on a stun the combo has already decayed)
  const first = hits.slice(0, C.moves.string.length).filter((h, k) => h.i === k);
  const links = first.slice(1).filter((h) => h.advantage != null);
  const predicted = links.map((h) => fd[h.i - 1].link);
  check(`${id}: a chained hit's advantage is the card's link frames, as frameData prints them`, links.every((h, k) => h.advantage === predicted[k]), { measured: links.map((h) => h.advantage), frameData: predicted });
  if (id === 'action') check('action: a mashed string lands all three, the last a finisher that throws', hits.length >= 3 && hits.slice(0, 3).every((h, i) => h.i === i && (i === 0 || h.advantage >= 0)) && hits[2].finisher, hits.slice(0, 3).map((h) => [h.i, h.advantage, h.finisher]));
  if (C.hit.mercy > 0) check(`${id}: inside mercy no hit lands twice`, hits.every((h, i) => !i || h.f - hits[i - 1].f > C.hit.mercy), hits.map((h) => h.f));

  // ─── the dodge: invincible frames ───
  const SP = { half: 400, blocks: [], hero: [0, -1.0], dummy: [0, 0] };
  const I = C.dodge.iframes;
  const turn = (S) => { S.hero.yaw = 0; };
  if (I) {
    const p = 30 - (I[0] + 1);
    const r = track(run(C, (f) => (f === p ? DG : 0), 90, { arena: SP, spar: true, setup: turn }));
    check(`${id}: a telegraphed hit landing inside the ${C.dodge.kind}'s invincible frames is evaded`, ev(r, 'evaded').length === 1 && !ev(r, 'hit').length, { evaded: ev(r, 'evaded').map((e) => e.f), hit: ev(r, 'hit').map((e) => e.f) });
  } else {
    const r = track(run(C, () => 0, 90, { arena: SP, spar: true, setup: turn }));
    check(`${id}: without invincible frames a dodge is space, not immunity: standing still the telegraph lands`, ev(r, 'hit').length === 1 && !ev(r, 'evaded').length, ev(r, 'hit').map((e) => e.f));
  }

  // ─── the wall: what it does, at the feel's top speed ───
  const WALL = { half: 6, blocks: [], hero: [0, -4], dummy: [300, 300] };
  const wr = track(run(C, (f) => pad(0, f < 240 ? 127 : 0, BTN.SPRINT), 300, { arena: { ...WALL, dummy: [5, -5] } }));
  const w = ev(wr, 'wall')[0];
  row['wall'] = w ? `${w.response} @${w.into} m/s${w.out != null ? ` → ${w.out}` : ''}` : 'none';
  check(`${id}: running into a wall answers as the card says (${C.wall.model})`, w && (C.wall.model === 'bounce' ? w.response === 'bounce' && Math.abs(w.out - Math.min(C.wall.cap, w.into * C.wall.e)) < 1e-3 : C.wall.model === 'bonk' ? w.response === (w.into > C.wall.above ? 'bonk' : 'stop') : ['stop', 'stagger'].includes(w.response)), w);
}

// ─── the laws over every run ───
check('no body passes a wall or a block, at any speed, in any run', !allBreaches.length, allBreaches.slice(0, 3));
const presses = runs.flatMap((r) => r.events.filter((e) => e.type === 'press'));
const ends = runs.flatMap((r) => r.events.filter((e) => e.type === 'acted' || e.type === 'dropped'));
const pending = runs.reduce((a, r) => a + r.end.queue.length, 0);
check('every press is acted on, dropped with its reason, or still waiting in its buffer at the end', presses.length === ends.length + pending && ends.filter((e) => e.type === 'dropped').every((e) => e.why), { presses: presses.length, acted: ends.filter((e) => e.type === 'acted').length, dropped: ends.filter((e) => e.type === 'dropped').length, pending });
for (const id of FEEL_IDS) {
  const idle = run(FEELS[id], () => 0, 240, { arena: undefined ?? { half: 9, blocks: [], hero: [0, -3], dummy: [0, 0] } });
  if (idle.events.length || JSON.stringify(idle.end.hero.p) !== JSON.stringify([0, -3, 0])) { check(`${id}: an idle pad moves nothing`, false, idle.events.slice(0, 3)); }
}
check('an idle pad moves nothing, in every feel', true);
const script = (f) => [Math.round(127 * Math.sin(f / 23)), Math.round(127 * Math.cos(f / 31)), ((f % 37) < 9 ? J : 0) | ((f % 13) === 0 ? AT : 0) | ((f % 71) === 3 ? DG : 0) | ((f % 200) > 120 ? BTN.SPRINT : 0)];
const hashes = FEEL_IDS.map((id) => [0, 1].map(() => createHash('sha256').update(JSON.stringify(run(FEELS[id], script, 900, { arena: { half: 9, blocks: [{ id: 'low', x: [-7, -3], y: [1, 5], h: 0.4 }, { id: 'ledge', x: [3, 7], y: [2, 4.5], h: 1.1 }], hero: [0, -3], dummy: [0, 0] }, spar: true }).states.map((s) => [s.hero.p, s.dummy.p, s.events]))).digest('hex')));
check('the same pad gives the same trace, byte for byte, in every feel', hashes.every(([a, b]) => a === b), hashes.map(([a]) => a.slice(0, 12)));
check('the four feels play the same pad four different ways', new Set(hashes.map(([a]) => a)).size === FEEL_IDS.length);

// ─── realistic is the body's own time ───
const own = A.render(A.strikeTake('jab', R), 'realistic', R), fit = T.fitMove(R, FEELS.realistic.moves.string[0], FEELS.realistic, { name: 'realistic' }).rendered;
const drift = Math.max(...own.frames.map((f, i) => Math.abs(f.src - (fit.frames[i]?.src ?? Infinity))));
check('realistic\'s card is the take\'s own time: its fitted jab is the take frame for frame', own.frames.length === fit.frames.length && drift < 1e-3, { frames: [own.frames.length, fit.frames.length], drift });

// ─── recorded pads (fixtures the page's recorder exports) ───
const FIX = new URL('./fixtures/', import.meta.url);
if (existsSync(FIX)) for (const file of readdirSync(FIX).filter((f) => f.endsWith('.json'))) {
  const fx = JSON.parse(readFileSync(new URL(file, FIX), 'utf8'));
  const r = run(FEELS[fx.feel] ? { ...FEELS[fx.feel], ...(fx.card ?? {}) } : FEELS.action, (f) => fx.pads[f] ?? [0, 0, 0], fx.pads.length, { arena: fx.arena ?? ARENA, spar: fx.spar, who: fx.cast && fx.cast !== cast ? T.bodyOf(T.rigOf(fx.cast)) : body });   // a recorded run plays in the page's arena
  const got = r.events.filter((e) => fx.expect?.types?.includes(e.type)).map((e) => `${e.f}:${e.who}:${e.type}`);
  check(`fixture ${file}: ${fx.says ?? ''}`, !fx.expect?.events || JSON.stringify(got) === JSON.stringify(fx.expect.events), got.slice(0, 6));
}

console.log('\nthe feels, measured'); console.table(table);
for (const id of FEEL_IDS) { console.log(`frame data: ${id}`); console.table(frameData(FEELS[id], body)); }
note('the body (the character\'s half)', body);
console.log(fails ? `\n${fails} failed` : '\nall held (machine gate; the eyes gate is open: run lab.mjs and play)');
process.exitCode = fails ? 1 : 0;
