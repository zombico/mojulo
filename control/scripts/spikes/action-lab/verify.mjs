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
function run(card, pads, n, { arena = OPEN, setup = null, spar = false, guard = true, who = body, dummyHeight } = {}) {
  let S = newState(card, who, { arena, spar, guard, dummyHeight }); if (setup) setup(S);
  const events = [], states = []; let breach = null;
  for (let f = 0; f < n; f++) {
    S = step(S, pads(f)); events.push(...S.events); states.push(S);
    for (const w of ['hero', 'dummy']) { const B = S[w];
      if (Math.abs(B.p[0]) > arena.half - util.RADIUS + 1e-9 || Math.abs(B.p[1]) > arena.half - util.RADIUS + 1e-9) breach ??= { f, w, p: B.p };
      for (const k of arena.blocks) if (k.h > B.p[2] + 0.12 && B.p[0] > k.x[0] + 1e-6 && B.p[0] < k.x[1] - 1e-6 && B.p[1] > k.y[0] + 1e-6 && B.p[1] < k.y[1] - 1e-6) breach ??= { f, w, p: B.p, block: k.id }; }
    // the hero never inside the dummy (a frozen tick moves nothing, so it is checked when the hero moved)
    const Hh = S.hero, Dd = S.dummy;
    if (!Hh.stop && Math.hypot(Hh.p[0] - Dd.p[0], Hh.p[1] - Dd.p[1]) < 2 * util.RADIUS - 1e-6 && Hh.p[2] < Dd.p[2] + Dd.h - 1e-6 && Hh.p[2] + Hh.h > Dd.p[2] + 1e-6) breach ??= { f, w: 'hero', inside: 'dummy', p: Hh.p };
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

  // ─── buffer: a press before landing (its window on its own: an air jump would take the press) ───
  const CW = { ...C, air: null, cling: null };
  const L = ld.f, held = ap.f + C.jump.hang + 2;
  for (const k of [C.jump.buffer, C.jump.buffer + 1]) {
    const r = track(run(CW, (f) => (f >= 10 && f < held) || f === L - k ? J : 0, 300));
    const second = ev(r, 'takeoff')[1], acted = ev(r, 'acted').filter((e) => e.button === 'jump')[1];
    if (k <= C.jump.buffer) check(`${id}: a press ${k} f before landing (the buffer) jumps on the landing, + commit`, acted?.f === L && second?.f === L + C.jump.commit, { landing: L, acted: acted?.f, takeoff: second?.f });
    else check(`${id}: a press ${k} f before landing (one past the buffer) is dropped, and says so`, !second && ev(r, 'dropped').some((e) => e.button === 'jump' && /buffer ran out/.test(e.why)), ev(r, 'dropped').map((e) => e.why));
  }

  // ─── coyote: walking off an edge ───
  const LEDGE = { half: 400, blocks: [{ id: 'shelf', x: [-50, 50], y: [-50, 0], h: 1 }], hero: [0, -3], dummy: [300, 300] };
  const up = (S) => { S.hero.p[2] = 1; };
  const walk = (f) => pad(0, 127, 0);
  const off = track(run(CW, walk, 200, { arena: LEDGE, setup: up })); const edge = ev(off, 'edge')[0].f;
  for (const k of [C.jump.coyote, C.jump.coyote + 1]) {
    const r = track(run(CW, (f) => pad(0, 127, f === edge + k ? J : 0), 200, { arena: LEDGE, setup: up }));
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

  // ─── jumping on: dropped onto a critter's head (0.8 m), and the enemy step beside the standing dummy ───
  const PERCH = { half: 400, blocks: [], hero: [0, 0], dummy: [0, 0] };
  const drop = (spun, held) => track(run(C, () => (held ? J : 0), 150, { arena: PERCH, dummyHeight: 0.8, setup: (S) => { S.hero.p = [0.1, 0, 2.5]; S.hero.grounded = false; S.hero.jumped = spun; } }));
  const LD = C.land, onto = drop(true, false), landed = onto.events.find((e) => e.who === 'hero' && ['stomp', 'bounce-off', 'slide'].includes(e.type));
  row['jump on'] = landed ? landed.type : 'none';
  if (LD.model === 'stomp') {
    const high = drop(true, true), apexOf = (r) => r.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > r.events.find((x) => x.type === 'stomp').f)?.height;
    const squashed = onto.states[onto.events.indexOf(landed) >= 0 ? landed.f + 1 : 0].dummy;
    check(`${id}: coming down on a body stomps it (squashed, stunned) and bounces, low (${LD.low} m) or high with the jump held (${LD.high} m)`, landed?.type === 'stomp' && squashed.squash > 0 && squashed.stun > 0 && Math.abs(apexOf(onto) - LD.low) < 1e-3 && Math.abs(apexOf(high) - LD.high) < 1e-3, { low: apexOf(onto), high: apexOf(high), squash: squashed.squash });
  } else if (LD.model === 'bounce') {
    const unspun = drop(false, false), b = landed, vD = onto.states[b.f + Math.max(1, b.hitstop + 1)].dummy;
    check(`${id}: a spinning body bounces off a body (at least as fast as it fell, never under ${LD.min} m) and the body ricochets; falling unspun it slides off`, b?.type === 'bounce-off' && b.vz >= b.fell - 1e-9 && b.vz >= Math.sqrt(2 * C.jump.gRise * LD.min) - 1e-9 && Math.abs(Math.hypot(vD.v[0], vD.v[1]) - LD.floor * LD.restitution) < 0.2 && unspun.events.some((e) => e.type === 'slide'), { vz: b?.vz, fell: b?.fell, ricochet: Math.hypot(vD.v[0], vD.v[1]) });
  } else {
    const end = onto.end, off = Math.hypot(end.hero.p[0] - end.dummy.p[0], end.hero.p[1] - end.dummy.p[1]);
    check(`${id}: coming down on a body slides off its top into open space (no stomp, the body untouched), the feet on the floor beside it`, landed?.type === 'slide' && !onto.events.some((e) => e.type === 'stomp' || e.type === 'bounce-off') && end.hero.grounded && end.hero.p[2] === 0 && off >= 2 * util.RADIUS - 1e-9 && !ev(onto, 'hit', 'dummy').length, { landed: landed?.type, off: +off.toFixed(4) });
  }
  const BESIDE = { half: 400, blocks: [], hero: [0, -0.65], dummy: [0, 0] };
  const st = track(run(C, (f) => (f === 0 || f === 14 ? J : 0), 120, { arena: BESIDE }));
  const stepEv = ev(st, 'step'), offEv = ev(st, 'takeoff');
  if (LD.step) check(`${id}: a jump pressed in the air touching a body is an enemy step: a fresh jump on the press`, stepEv.length === 1 && offEv.length >= 2 && offEv[1].f === 14, { stepEv: stepEv.map((e) => e.f), takeoffs: offEv.map((e) => e.f) });
  else check(`${id}: no enemy step: a jump pressed in the air beside a body is no step there (an air jump, if the card has one)`, !stepEv.length && (C.air ? ev(st, 'air-jump').some((e) => e.f === 14) : !offEv.some((e, i) => i > 0 && e.f === 14)), { takeoffs: offEv.map((e) => e.f) });

  // ─── the air jump and the wall (Mega Man X) ───
  const AJ = C.air, CL = C.cling;
  // a jump held to its apex; at each apex, let go and press again (held): the air jumps, then one press past them
  const twice = { events: [] };
  { let S = newState(C, body, { arena: OPEN }), holding = true, apexes = 0, gap = -1;
    for (let f = 0; f < 260; f++) {
      const b = f < 10 ? 0 : f === gap ? 0 : holding ? J : 0;
      S = step(S, b); twice.events.push(...S.events);
      for (const e of S.events) if (e.type === 'apex' && e.who === 'hero') { apexes++; gap = f + 1; }
      if (S.hero.grounded && apexes) break;
    } }
  const aj = ev(twice, 'air-jump'), offs2 = ev(twice, 'takeoff');
  if (AJ) {
    const ap2 = twice.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > aj[0]?.f);
    check(`${id}: a jump in the air is an air jump (${AJ.jumps}), rising ${AJ.mult}× the jump's height from where it was pressed; the next is spent`, aj.length === AJ.jumps && Math.abs(ap2.height - C.jump.height * AJ.mult) < 1e-3 && offs2.length === 1 + AJ.jumps && ev(twice, 'buffered').some((e) => /spent/.test(e.why)), { airJumps: aj.length, apex: ap2?.height, want: +(C.jump.height * AJ.mult).toFixed(4), takeoffs: offs2.length });
  } else check(`${id}: no air jump: a jump in the air does not jump there`, !aj.length && offs2.length === 1, { takeoffs: offs2.length });
  const CLIFF = { half: 400, blocks: [{ id: 'cliff', x: [1, 3], y: [-50, 50], h: 30 }], hero: [0.69, 0], dummy: [300, 300] };
  const onWall = (z = 4) => (S) => { S.hero.p[2] = z; S.hero.grounded = false; };
  const into = [127, 0, 0];
  const sl = track(run(C, () => into, 60, { arena: CLIFF, setup: onWall() }));
  if (CL) {
    const c0 = ev(sl, 'cling')[0], dz = Array.from({ length: 10 }, (_, k) => sl.states[c0.f + 2 + k].hero.p[2] - sl.states[c0.f + 1 + k].hero.p[2]);
    const free = track(run(C, () => 0, 60, { arena: CLIFF, setup: onWall() })), fz = free.states[20].hero.v[2];
    check(`${id}: falling against a wall with the stick into it slides down it at ${CL.slide} m/s, facing out; let go, it falls free`, c0 && dz.every((d) => Math.abs(d + CL.slide / FPS) < 1e-9) && Math.abs(sl.states[c0.f + 5].hero.yaw + Math.PI / 2) < 1e-9 && fz < -CL.slide - 1, { cling: c0?.f, dz: +dz[0].toFixed(6), freeFall: +fz.toFixed(3) });
    const kick = c0.f + 10, kj = track(run(C, (f) => (f >= kick && f < kick + 40 ? [127, 0, J] : into), 120, { arena: CLIFF, setup: onWall() }));
    const wj = ev(kj, 'wall-jump')[0], lockV = Array.from({ length: CL.lock }, (_, k) => kj.states[kick + k].hero.v[0]);
    const apw = kj.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > wj?.f);
    check(`${id}: a jump on the wall kicks off it: ${CL.away} m/s away (fixed through its ${CL.lock} f, the stick into the wall ignored) and ${CL.up}× the jump's height up`, wj?.f === kick && lockV.every((v) => Math.abs(v + CL.away) < 1e-9) && Math.abs(apw.height - C.jump.height * CL.up) < 1e-3, { kick: wj?.f, lockV: lockV.map((v) => +v.toFixed(3)), apex: apw?.height });
    const lv = track(run(C, (f) => (f < kick ? into : f === kick + CL.coyote ? [-127, 0, J] : [-127, 0, 0]), 120, { arena: CLIFF, setup: onWall() }));
    check(`${id}: off the wall, a jump inside ${CL.coyote} f still kicks off it (the wall's coyote)`, ev(lv, 'wall-jump')[0]?.coyote === true && ev(lv, 'wall-jump')[0].f === kick + CL.coyote, ev(lv, 'wall-jump').map((e) => [e.f, e.coyote]));
    // climbing: hold into the wall, a held jump each time it clings
    let pressAt = -1, heights = [];
    { let S = newState(C, body, { arena: CLIFF }); S.hero.p[2] = 2; S.hero.grounded = false;
      for (let f = 0; f < 600 && heights.length < 4; f++) { S = step(S, [127, 0, pressAt >= 0 && f >= pressAt && f < pressAt + 18 ? J : 0]); for (const e of S.events) { if (e.type === 'cling') pressAt = f + 3; if (e.type === 'wall-jump') heights.push(e.z); } } }
    row['wall climb'] = heights.map((z) => z.toFixed(2)).join(' → ');
    const climbs = heights.length >= 4 && heights.every((z, i) => !i || z > heights[i - 1]);
    if (C.wall.model === 'bounce') check(`${id}: no climbing a single wall: the kick is too fast for its air control to bring it back (momentum is the feel)`, !climbs, heights);
    else check(`${id}: one wall is climbed by repeated wall jumps, holding back toward it (Mega Man X)`, climbs, heights.map((z) => +z.toFixed(3)));
    if (AJ) {
      const re = track(run(C, () => into, 30, { arena: CLIFF, setup: (S) => { onWall(4)(S); S.hero.airLeft = 0; } }));
      check(`${id}: touching a wall gives the air jump back`, ev(re, 'cling').length && re.states[ev(re, 'cling')[0].f].hero.airLeft === AJ.jumps, { left: re.states[(ev(re, 'cling')[0]?.f) ?? 0]?.hero.airLeft });
    }
  } else {
    check(`${id}: no wall slide: against a wall with the stick into it, the body falls free`, !ev(sl, 'cling').length && sl.states[30].hero.v[2] < -3);
  }

  // ─── the dashes (Mega Man X): the air dash, the dash jump, the held dash, the dash wall jump ───
  const DD = C.dodge, fwdP = [0, 127, 0], hspeed = (st) => Math.hypot(st.hero.v[0], st.hero.v[1]);
  const nA = DD.air?.frames ?? 10;   // the air dash held through, let go, pressed again while still in the air
  const ad = track(run(C, (f) => (f >= 1 && f < nA + 1 ? [0, 127, DG] : f === nA + 3 ? [0, 127, DG] : fwdP), 120, { arena: { half: 400, blocks: [], hero: [0, -5], dummy: [0, 300] }, setup: (S) => { S.hero.p[2] = 3; S.hero.grounded = false; } }));
  const adE = ev(ad, 'air-dash');
  if (DD.air) {
    const a0 = adE[0], n = DD.air.frames, flatZ = Array.from({ length: n - 1 }, (_, k) => ad.states[1 + k].hero.p[2]).every((z) => z === ad.states[0].hero.p[2]);
    const sp = hspeed(ad.states[2]), spOk = DD.kind === 'boost' ? sp >= C.ground.run - 1e-9 : Math.abs(sp - DD.air.speed) < 1e-9;
    const spentD = ad.events.some((e) => e.type === 'dropped' && e.button === 'dodge' && /spent/.test(e.why));
    row['air dash'] = `${DD.air.count} × ${DD.air.frames} f`;
    check(`${id}: a dodge in the air is an air dash: no fall for its ${n} f, at ${DD.kind === 'boost' ? 'a boost' : `${DD.air.speed} m/s`}; a second in the same airtime is spent`, a0?.f === 1 && flatZ && spOk && spentD, { at: a0?.f, flat: flatZ, speed: +sp.toFixed(3), spent: spentD });
    check(`${id}: landing gives the air dash back`, ad.end.hero.grounded && ad.end.hero.airDashes === DD.air.count, { left: ad.end.hero.airDashes });
  } else check(`${id}: no air dash: a dodge in the air is dropped, and says why`, !adE.length && ad.events.some((e) => e.type === 'dropped' && e.button === 'dodge'));
  // the dash jump: a dodge on the ground, a jump inside it
  const djPads = (f) => (f >= 10 && f < 18 ? [0, 127, DG | (f >= 14 ? J : 0)] : f >= 18 && f < 60 ? [0, 127, J] : fwdP);
  const dj = track(run(C, djPads, 140, { arena: OPEN })), djE = ev(dj, 'dash-jump')[0];
  const plainJ = track(run(C, (f) => (f >= 14 && f < 60 ? [0, 127, J] : fwdP), 140, { arena: OPEN }));
  if (DD.jump) {
    const off2 = ev(dj, 'takeoff')[0], land2 = dj.events.find((e) => e.type === 'land' && e.who === 'hero' && e.f > off2.f);
    const airSp = dj.states.slice(off2.f + 1, land2.f).map(hspeed), carriedV = airSp.every((v) => v >= djE.speed - 1e-4)   // (the event rounds the speed to 1e-4);
    const off3 = ev(plainJ, 'takeoff')[0], land3 = plainJ.events.find((e) => e.type === 'land' && e.who === 'hero' && e.f > off3.f);
    const plainTop = Math.max(...plainJ.states.slice(off3.f + 1, land3.f).map(hspeed));
    row['dash jump'] = `${djE.speed.toFixed(1)} m/s`;
    check(`${id}: a jump inside a ground dodge is a dash jump: it leaves on the press, and the air keeps the dodge's speed (${djE.speed.toFixed(2)} m/s, a plain jump ${plainTop.toFixed(2)})`, djE.f === 14 && off2.f === 14 && carriedV && djE.speed > plainTop + 0.5, { left: off2.f, carried: carriedV, plainTop: +plainTop.toFixed(3) });
  } else check(`${id}: no dash jump: a jump in a dodge waits for it to end`, !djE && (ev(dj, 'takeoff')[0]?.f ?? 99) > 14);
  if (DD.hold) {
    const relD = track(run(C, (f) => (f >= 10 && f < 14 ? DG : 0), 80, { arena: OPEN })), helD = track(run(C, (f) => (f >= 10 && f < 70 ? DG : 0), 80, { arena: OPEN }));
    const endR = relD.events.find((e) => e.type === 'end' && e.what === 'dodge'), endH = helD.events.find((e) => e.type === 'end' && e.what === 'dodge');
    check(`${id}: the dash lasts while it is held (${DD.frames} f at most, ${DD.hold.min} f at least)`, endR.f - 10 === DD.hold.min - 1 && endR.released && endH.f - 10 === DD.frames - 1, { tapped: endR.f - 10 + 1, held: endH.f - 10 + 1 });
  }
  if (DD.wall && CL) {
    const k0 = ev(sl, 'cling')[0].f + 10, dw = track(run(C, (f) => (f < k0 - 2 ? into : f < k0 ? [127, 0, DG] : f < k0 + 40 ? [-127, 0, DG | J] : [-127, 0, 0]), 140, { arena: CLIFF, setup: onWall() }));
    const wd = ev(dw, 'wall-jump')[0], awayD = DD.kind === 'boost' ? C.ground.run : DD.speed, afterK = hspeed(dw.states[k0 + CL.lock + 4]);
    check(`${id}: a wall jump with the dash held kicks at the dash's speed (${awayD} m/s) and the air keeps it`, wd?.dash && Math.abs(dw.states[k0].hero.v[0] + awayD) < 1e-9 && afterK >= awayD - 1e-9, { dash: wd?.dash, kick: +dw.states[k0].hero.v[0].toFixed(3), after: +afterK.toFixed(3) });
  }

  // ─── the stomp attack: an attack in the air turned downward ───
  const PD = C.pound, SKY = { half: 400, blocks: [], hero: [0, -5], dummy: [0, 300] };
  const aloft = (z = 3) => (S) => { S.hero.p[2] = z; S.hero.grounded = false; };
  const back = [0, -127, 0], at1 = (f) => (f === 1 ? AT : 0);
  if (!PD) {
    const r = track(run(C, at1, 60, { arena: SKY, setup: aloft() }));
    check(`${id}: no stomp attack: an attack in the air does nothing here, and says why`, !ev(r, 'pound').length && ev(r, 'dropped').some((e) => e.button === 'attack'), ev(r, 'dropped').map((e) => e.why));
  } else {
    const padOf = PD.stick === 'back' ? (f) => (f === 1 ? [back[0], back[1], AT] : back) : at1;
    const r = track(run(C, padOf, 240, { arena: SKY, setup: aloft() })), go = ev(r, 'pound')[0], land = ev(r, 'land')[0];
    // (frame 0 falls under gravity before the press on frame 1: the hang holds frame 0's height)
    const z = (f) => r.states[f].hero.p[2], held = Array.from({ length: PD.hang }, (_, k) => z(1 + k)).every((v) => v === z(0));
    const drop = z(1 + PD.hang) - z(PD.hang), straight = Math.abs(drop + PD.speed / FPS) < 1e-9;
    row['stomp attack'] = `${PD.kind}: hang ${PD.hang} f, ${PD.speed} m/s`;
    check(`${id}: an attack in the air is the ${PD.kind}: held still ${PD.hang} f, then straight down at ${PD.speed} m/s`, go?.f === 1 && held && straight, { pressed: go?.f, held, drop: +drop.toFixed(6) });
    if (PD.kind === 'bounce') {
      const ap = r.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > land.f);
      check(`${id}: the bounce attack bounces back up off the floor, ${PD.bounce} m`, ev(r, 'pound-bounce').length >= 1 && Math.abs(ap.height - PD.bounce) < 1e-3, { apex: ap?.height });
    } else {
      const lagEnd = r.events.find((e) => e.type === 'end' && e.what === 'poundLag');
      // (the lag counts the landing frame: it ends on its last frame, and a press the frame after acts)
      check(`${id}: the ${PD.kind} lands into ${PD.lag} f of lag`, lagEnd && lagEnd.f - land.f === PD.lag - 1, { land: land?.f, lagEnd: lagEnd?.f });
      if (PD.jump) {
        const jr = track(run(C, (f) => (f === 1 ? AT : f >= land.f + 3 && f < land.f + 80 ? J : 0), 240, { arena: SKY, setup: aloft() }));
        const pj = ev(jr, 'pound-jump')[0], ap = jr.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > pj?.f);
        check(`${id}: a jump in the pound's lag is the ground-pound jump: ${PD.jump}× the jump's height`, pj && Math.abs(ap.height - C.jump.height * PD.jump) < 1e-3, { apex: ap?.height, want: +(C.jump.height * PD.jump).toFixed(4) });
      }
    }
    // onto a body
    const onto = track(run(C, (f) => (PD.stick === 'back' ? (f === 1 ? [0, -127, AT] : [0, -127, 0]) : at1(f)), 200, { arena: PERCH, dummyHeight: 0.8, setup: (S) => { S.hero.p = [0.1, 0, 3]; S.hero.grounded = false; } }));
    const meet = onto.events.find((e) => e.who === 'hero' && e.pound) ?? onto.events.find((e) => e.who === 'dummy' && e.type === 'hit');
    if (PD.kind === 'pound') {
      const ap = onto.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > meet?.f), D0 = onto.states[meet.f].dummy;
      // (the stun counts the stomp's frame, so the state after it reads one less)
      check(`${id}: the ground pound on a body is a harder stomp (stunned ${PD.stun} f) and always the high bounce (${LD.high} m), the jump not held`, meet?.type === 'stomp' && D0.stun === PD.stun - 1 && Math.abs(ap.height - LD.high) < 1e-3, { stun: D0.stun + 1, apex: ap?.height });
    } else if (PD.kind === 'bounce') {
      const ap = onto.events.find((e) => e.type === 'apex' && e.who === 'hero' && e.f > meet?.f);
      check(`${id}: the bounce attack on a body bounces off (${PD.bounce} m) and the body ricochets`, meet?.type === 'bounce-off' && Math.abs(ap.height - PD.bounce) < 1e-3 && Math.hypot(...onto.states[meet.f + 1].dummy.v.slice(0, 2)) > 5, { apex: ap?.height });
    } else {
      check(`${id}: the plunge on a body is a launching blow (the finisher's force)`, meet?.type === 'hit' && meet.pound === 'plunge' && meet.finisher && onto.states[meet.f + meet.hitstop + 1].dummy.v[2] > 0, meet);
      const near = track(run(C, (f) => (f === 1 ? [0, -127, AT] : [0, -127, 0]), 200, { arena: { half: 400, blocks: [], hero: [0, 0], dummy: [0, 0.9] }, setup: aloft() }));
      const sh = ev(near, 'hit', 'dummy')[0];
      check(`${id}: the plunge beside a body (inside ${PD.radius} m) hits it with its shockwave on landing`, sh?.pound === 'plunge' && sh.f === ev(near, 'land')[0]?.f, { hit: sh?.f, land: ev(near, 'land')[0]?.f });
      const air = track(run(C, at1, 60, { arena: SKY, setup: aloft() }));
      check(`${id}: the attack alone in the air stays the air jab, not the plunge`, ev(air, 'move').length === 1 && !ev(air, 'pound').length);
    }
  }

  // ─── the wall: what it does, at the feel's top speed ───
  const WALL = { half: 6, blocks: [], hero: [0, -4], dummy: [300, 300] };
  const wr = track(run(C, (f) => pad(0, f < 240 ? 127 : 0, BTN.SPRINT), 300, { arena: { ...WALL, dummy: [5, -5] } }));
  const w = ev(wr, 'wall')[0];
  row['wall'] = w ? `${w.response} @${w.into} m/s${w.out != null ? ` → ${w.out}` : ''}` : 'none';
  check(`${id}: running into a wall answers as the card says (${C.wall.model})`, w && (C.wall.model === 'bounce' ? w.response === 'bounce' && Math.abs(w.out - Math.min(C.wall.cap, w.into * C.wall.e)) < 1e-3 : C.wall.model === 'bonk' ? w.response === (w.into > C.wall.above ? 'bonk' : 'stop') : ['stop', 'stagger'].includes(w.response)), w);
}

// ─── the laws over every run ───
check('no body passes a wall or a block, and the hero never enters the dummy, at any speed, in any run', !allBreaches.length, allBreaches.slice(0, 3));
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
  const r = run(FEELS[fx.feel] ? { ...FEELS[fx.feel], ...(fx.card ?? {}) } : FEELS.action, (f) => fx.pads[f] ?? [0, 0, 0], fx.pads.length, { arena: fx.arena ?? ARENA, spar: fx.spar, guard: fx.guard ?? true, dummyHeight: fx.dummyHeight, who: fx.cast && fx.cast !== cast ? T.bodyOf(T.rigOf(fx.cast)) : body });   // a recorded run plays in the page's arena
  const got = r.events.filter((e) => fx.expect?.types?.includes(e.type)).map((e) => `${e.f}:${e.who}:${e.type}`);
  check(`fixture ${file}: ${fx.says ?? ''}`, !fx.expect?.events || JSON.stringify(got) === JSON.stringify(fx.expect.events), got.slice(0, 6));
}

console.log('\nthe feels, measured'); console.table(table);
for (const id of FEEL_IDS) { console.log(`frame data: ${id}`); console.table(frameData(FEELS[id], body)); }
note('the body (the character\'s half)', body);
console.log(fails ? `\n${fails} failed` : '\nall held (machine gate; the eyes gate is open: run lab.mjs and play)');
process.exitCode = fails ? 1 : 0;
