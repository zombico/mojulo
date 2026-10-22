// action-lab verify: the laws every feel keeps, over scripted pads, PASS/FAIL per concept. The machine gate only;
// nobody has played it.
//   node scripts/spikes/action-lab/verify.mjs [cast=male]
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { FEELS, FEEL_IDS, BTN, FPS, ARENA, SPAR, MECH, mechKnobs, mechCard, POLES, POLE_IDS, VIEWS, STAGES, poleCard, blendPoles, newState, step, frameData, util } from './feel.mjs';
const T = await import('./takes.mjs');
const A = await import('../animation-games/flavor.mjs');

const cast = process.argv[2] ?? 'male';
const R = T.rigOf(cast), body = T.bodyOf(R);
let fails = 0;
const check = (name, ok, measured) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${measured === undefined ? '' : `  ${JSON.stringify(measured)}`}`); };
const note = (name, measured) => console.log(`note  ${name}  ${JSON.stringify(measured)}`);
const OPEN = { half: 400, blocks: [], hero: [0, 0], dummy: [300, 300] };
const DT_ = 1 / FPS;
const J = BTN.JUMP, AT = BTN.ATTACK, DG = BTN.DODGE, DS = BTN.DASH, LK = BTN.LOCK, GU = BTN.GUARD, SH = BTN.SHOOT, SW = BTN.SWITCH;

/**
 * Run a pad script: `pads(f)` → [x, y, buttons] for tick f, `n` ticks. Every tick checks the walls (no body inside a
 * block taller than a step over its feet, none past the arena). Returns the events and the per-tick states.
 */
function run(card, pads, n, { arena = OPEN, setup = null, spar = false, guard = true, who = body, dummyHeight, sparMoves = null, mid = null, shooter = null, gear = null, mount = null } = {}) {
  let S = newState(card, who, { arena, spar, guard, dummyHeight, sparMoves, shooter, gear, mount }); if (setup) setup(S);
  const events = [], states = []; let breach = null;
  for (let f = 0; f < n; f++) {
    if (mid) mid(S, f);   // a test may move a body mid-run (between ticks), to put it where the law needs it
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
    const r = track(run(C, (f) => (f === p ? [0, 127, DG] : 0), 90, { arena: SP, spar: true, setup: turn }));
    check(`${id}: a telegraphed hit landing inside the ${C.dodge.kind}'s invincible frames is evaded (rolling forward into it)`, ev(r, 'evaded').length === 1 && !ev(r, 'hit').length, { evaded: ev(r, 'evaded').map((e) => e.f), hit: ev(r, 'hit').map((e) => e.f) });
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

  // ─── the directional roll: along the stick, the facing kept; the stick at rest a backstep ───
  const R0 = C.dodge, WAYS = [['fwd', [0, 127]], ['right', [127, 0]], ['back', [0, -127]], ['left', [-127, 0]]];
  const rollOf = (stick) => track(run(C, (f) => (f === 5 ? [stick[0], stick[1], DG] : [0, 0, 0]), 60, { arena: OPEN }));
  const ways = Object.fromEntries(WAYS.map(([w, st]) => { const r = rollOf(st), e = ev(r, 'dodge')[0], p0 = r.states[4].hero.p, p1 = r.end.hero.p, d = [p1[0] - p0[0], p1[1] - p0[1]], len = Math.hypot(...d);
    return [w, { rel: e?.rel, yaw: r.end.hero.yaw, len, along: len ? (d[0] * st[0] + d[1] * st[1]) / (len * 127) : 0 }]; }));
  const stillR = rollOf([0, 0]), st0 = ev(stillR, 'dodge')[0], stLen = Math.hypot(stillR.end.hero.p[0] - stillR.states[4].hero.p[0], stillR.end.hero.p[1] - stillR.states[4].hero.p[1]);
  row['roll'] = WAYS.map(([w]) => `${w} ${ways[w].len.toFixed(2)}`).join(' · ');
  check(`${id}: the ${R0.kind} goes the way the stick points, the body keeping its facing: a ${R0.kind} forward, right, back and left`, WAYS.every(([w]) => ways[w].rel === w && ways[w].yaw === 0 && ways[w].along > 0.999), Object.fromEntries(WAYS.map(([w]) => [w, [ways[w].rel, +ways[w].along.toFixed(4)]])));
  check(`${id}: the stick at rest is a backstep, as short as a ${R0.kind} back (${R0.back.speed}× the speed, ${R0.back.frames}× the frames)`, st0?.rel === 'back' && st0.neutral && Math.abs(stLen - ways.back.len) < 1e-9 && ways.back.len < ways.fwd.len, { backstep: +stLen.toFixed(4), forward: +ways.fwd.len.toFixed(4) });
  { const air = track(run(C, (f) => (f === 1 ? [0, 127, DG] : 0), 30, { arena: OPEN, setup: (S) => { S.hero.p[2] = 3; S.hero.grounded = false; } }));
    check(`${id}: no ${R0.kind} in the air: the press is dropped, and says why`, !ev(air, 'dodge').length && ev(air, 'dropped').some((e) => e.button === 'dodge' && /air/.test(e.why))); }

  // ─── guard and parry: the telegraphed jab blocked, parried, met from behind; stamina; the perfect dodge ───
  const GD = C.guard, SPG = { half: 400, blocks: [], hero: [0, -1.0], dummy: [0, 0] }, face = (yaw) => (S) => { S.hero.yaw = yaw; };
  const spar = (pads, n = 70, yaw = 0, sparMoves = null, mid = null) => track(run(C, pads, n, { arena: SPG, spar: true, setup: face(yaw), sparMoves, mid }));
  if (GD) {
    const hsB = C.hit.hitstop ? Math.min(C.hit.hitstop.max, Math.round(C.hit.hitstop.base + C.hit.hitstop.perMs * body.dv.jab * 0.5)) : 0, atB = 30 + hsB + 2;   // the press after the block's freeze
    const bl = spar((f) => (f >= 1 && f < atB ? GU : f === atB ? GU | AT : f > atB && f < 60 ? GU : 0));
    const be = ev(bl, 'block')[0], hero30 = bl.states[be?.f ?? 0].hero, back = bl.states[be.f].hero.p[1] - bl.states[be.f + be.hitstop + 8].hero.p[1];
    row['guard'] = `parry ${GD.parry} f, blockstun ${GD.block.stun} f`;
    check(`${id}: a held guard blocks a hit from the front: no stun, ${GD.block.stun} f of blockstun, pushed back; an attack in the blockstun waits`, be?.f === 30 && !ev(bl, 'hit', 'hero').length && hero30.stun === 0 && hero30.blockstun === GD.block.stun - 1 && back > 0.05 && ev(bl, 'buffered').some((e) => e.button === 'attack' && /blockstun/.test(e.why)), { block: be?.f, blockstun: hero30.blockstun + 1, back: +back.toFixed(3) });
    const pIn = spar((f) => (f >= 30 - (GD.parry - 1) && f < 60 ? GU : 0)), pOut = spar((f) => (f >= 30 - GD.parry && f < 60 ? GU : 0));
    const pe = ev(pIn, 'parry')[0], D0 = pIn.states[pe?.f ?? 0].dummy;
    check(`${id}: a guard pressed inside ${GD.parry} f of the hit parries it, the attacker staggered ${GD.riposte} f; a frame earlier it only blocks`, pe?.f === 30 && D0.act?.kind === 'stagger' && D0.stun === GD.riposte - 1 && !ev(pOut, 'parry').length && ev(pOut, 'block').length === 1, { parry: pe?.at, stun: D0.stun + 1, early: ev(pOut, 'block').map((e) => e.f) });
    const rip = spar((f) => (f >= 30 - (GD.parry - 1) && f < 41 ? GU : f === 41 + 1 ? AT : 0), 90), rh = ev(rip, 'hit', 'dummy')[0];
    check(`${id}: the riposte: an attack out of a parry lands on the staggered attacker`, rh && rh.advantage != null, { hit: rh?.f, advantage: rh?.advantage });
    const behind = spar((f) => (f >= 1 && f < 60 ? GU : 0), 70, Math.PI);
    check(`${id}: the guard does not cover the back: a hit from behind lands`, ev(behind, 'hit', 'hero').length === 1 && !ev(behind, 'block').length);
    const long = spar((f) => (f >= 1 ? GU : 0), 260, 0, ['jab']), blocks = ev(long, 'block'), brk = ev(long, 'guard-break');
    if (GD.stamina) { const n = Math.floor(GD.stamina.max / GD.stamina.cost);
      check(`${id}: blocking spends stamina (${GD.stamina.cost} of ${GD.stamina.max}): ${n} blocks, then the guard breaks into a stagger`, blocks.length === n && brk.length === 1 && long.states[brk[0].f].hero.act?.kind === 'stagger', { blocks: blocks.length, broke: brk.map((e) => e.f) }); }
    else check(`${id}: no stamina: the guard never breaks and nothing gets through (its push back carries it out of the later jabs' reach)`, blocks.length >= 2 && !brk.length && !ev(long, 'hit', 'hero').length, { blocks: blocks.length, whiffs: ev(long, 'whiff', 'dummy').length });
    if (GD.perfect) {
      const I = C.dodge.iframes, early = spar((f) => (f === 30 - (I[0] + 1) ? [0, 127, DG] : 0), 80), late = spar((f) => (f === 30 - (GD.perfect.window + 1) ? [0, 127, DG] : 0), 80);
      const pf = ev(early, 'perfect')[0], dA = (st) => st.dummy.act?.f ?? 0, slowed = dA(early.states[51]) - dA(early.states[31]);
      check(`${id}: a dodge whose invincible frames meet the hit in its first ${GD.perfect.window} f is a perfect dodge: the attacker at half speed for ${GD.perfect.witch} f; a later one only evades`, pf?.f === 30 && Math.abs(slowed - 10) <= 1 && ev(late, 'evaded').length === 1 && !ev(late, 'perfect').length, { perfect: pf?.at, dummyFrames: slowed, late: ev(late, 'evaded').map((e) => e.f) });
    }
    // the arc's zones: the hook sweeps ±70° over 10 f, orange in its middle 30 %; the perilous blow is red, unblockable
    const HK = SPAR.moves.find((m) => m.name === 'hook'), PR = SPAR.moves.find((m) => m.name === 'perilous');
    const reachAt = (ang) => HK.startup + Math.max(0, Math.ceil(((ang - HK.arc[0]) / (HK.arc[1] - HK.arc[0])) * HK.active - 1e-9) - 1);   // the frame the sweep meets an angle
    const at = (deg) => (S, f) => { if (f !== 10) return; const D = S.dummy, a = D.yaw + (deg * Math.PI) / 180; S.hero.p = [D.p[0] + Math.sin(a), D.p[1] + Math.cos(a), 0]; S.hero.yaw = util.bearing(S); };   // after the telegraph took aim
    const guardAt = (hitF) => (f) => (f >= hitF - (GD.parry ? GD.parry - 1 : 3) && f < hitF + 20 ? GU : 0);
    const oF = reachAt(0), rF = reachAt(-60);
    const orange = spar(guardAt(oF), 80, 0, ['hook'], at(0)), red = spar(guardAt(rF), 80, 0, ['hook'], at(-60)), outside = spar(() => 0, 80, 0, ['hook'], at(90));
    const po = ev(orange, 'parry')[0], br = ev(red, 'block')[0];
    check(`${id}: the hook's arc: met in its orange middle a timed guard parries it; met in its red edge the same guard only blocks; each where the sweep reaches it`, po?.f === oF && po.zone === 'orange' && br?.f === rF && br.zone === 'red' && !ev(red, 'parry').length && !ev(outside, 'hit', 'hero').length, { orange: [po?.f, oF], red: [br?.f, rF], outside: ev(outside, 'whiff', 'dummy').length });
    const per = spar((f) => (f >= 1 ? GU : 0), 80, 0, ['perilous']), ph = ev(per, 'hit', 'hero')[0];
    const I2 = C.dodge.iframes, perD = I2 ? spar((f) => (f === PR.startup - (I2[0] + 1) ? [0, 127, DG] : 0), 90, 0, ['perilous']) : null;
    check(`${id}: the perilous blow is red and unblockable: it goes through a guard${I2 ? `, and a ${C.dodge.kind}'s invincible frames evade it` : ''}`, ph?.f === PR.startup && ph.unblockable && ph.guarding && (!perD || (ev(perD, 'evaded').length === 1 && !ev(perD, 'hit', 'hero').length)), { hit: ph?.f, evaded: perD ? ev(perD, 'evaded').map((e) => e.f) : null });
    const air = track(run(C, (f) => (f === 1 ? GU : 0), 20, { arena: OPEN, setup: (S) => { S.hero.p[2] = 3; S.hero.grounded = false; } }));
    check(`${id}: no guard in the air: the press is dropped, and says why`, ev(air, 'dropped').some((e) => e.button === 'guard' && /air/.test(e.why)));
  } else {
    const ng = track(run(C, (f) => (f === 1 ? GU : 0), 10, { arena: OPEN }));
    check(`${id}: no guard in this feel: the press is dropped, and says why`, ev(ng, 'dropped').some((e) => e.button === 'guard' && /no guard/.test(e.why)));
  }

  // ─── lock-on: the facing on the target, the stick a strafe, the rolls circling it ───
  const LO = C.lock, EAST = { half: 400, blocks: [], hero: [0, 0], dummy: [4, 0] };
  const yawErr = (st) => Math.abs(util.angDiff(st.hero.yaw, util.bearing(st)));
  if (LO) {
    const sf = track(run(C, (f) => (f === 1 ? [0, 127, LK] : [0, 127, 0]), 90, { arena: EAST }));
    const facing = sf.states.slice(30).every((st) => yawErr(st) < 1e-6), top = Math.max(...sf.states.map((st) => Math.hypot(st.hero.v[0], st.hero.v[1])));
    row['lock'] = `${LO.range} m, strafe ${LO.strafe}×`;
    check(`${id}: lock-on takes the target and the body faces it, the stick a strafe at ${LO.strafe}× the run`, ev(sf, 'lock').length === 1 && facing && Math.abs(top - C.ground.run * LO.strafe) < 1e-6, { facing, top: +top.toFixed(4), want: +(C.ground.run * LO.strafe).toFixed(4) });
    // a side roll, locked and not: the stick across the line to the target
    const rollAt = 30, side = (lock) => track(run(C, (f) => (f === 1 && lock ? LK : f === rollAt ? [0, 127, DG] : 0), rollAt + 40, { arena: EAST }));
    const lk = side(true), un = side(false), dist = (st) => Math.hypot(st.hero.p[0] - st.dummy.p[0], st.hero.p[1] - st.dummy.p[1]);
    const n = C.dodge.frames, during = lk.states.slice(rollAt, rollAt + n);
    const kept = during.every((st) => Math.abs(dist(st) - 4) < 1e-6), swept = Math.abs(util.angDiff(Math.atan2(lk.end.hero.p[0] - 4, lk.end.hero.p[1]), Math.atan2(-4, 0)));
    check(`${id}: locked, a side ${C.dodge.kind} circles the target at its distance (4 m), facing it; unlocked the same ${C.dodge.kind} goes straight and drifts away`, kept && swept > 0.1 && yawErr(lk.end) < 1e-6 && dist(un.end) > 4 + 0.05, { kept, swept: +swept.toFixed(4), unlocked: +dist(un.end).toFixed(4) });
    const fwdL = track(run(C, (f) => (f === 1 ? LK : f === rollAt ? [127, 0, DG] : 0), rollAt + 40, { arena: EAST })), backL = track(run(C, (f) => (f === 1 ? LK : f === rollAt ? [-127, 0, DG] : 0), rollAt + 40, { arena: EAST }));
    check(`${id}: locked, a ${C.dodge.kind} forward closes on the target and one back opens, along the line to it`, dist(fwdL.end) < 4 - 0.3 && dist(backL.end) > 4 + 0.3 && Math.abs(fwdL.end.hero.p[1]) < 1e-9 && Math.abs(backL.end.hero.p[1]) < 1e-9, { forward: +dist(fwdL.end).toFixed(4), back: +dist(backL.end).toFixed(4) });
    const far = track(run(C, (f) => (f === 1 ? LK : 0), 10, { arena: { ...EAST, dummy: [LO.range + 1, 0] } }));
    const toggle = track(run(C, (f) => (f === 1 || f === 5 ? LK : 0), 10, { arena: EAST }));
    const lost = track(run(C, (f) => (f === 1 ? [0, 0, LK] : [-127, 0, BTN.SPRINT]), 400, { arena: EAST }));
    check(`${id}: no target past ${LO.range} m (the press says so); a second press lets go; walking out past ${LO.range + 3} m loses it`, ev(far, 'dropped').some((e) => e.button === 'lock' && /no target/.test(e.why)) && ev(toggle, 'unlock').length === 1 && ev(lost, 'lock-lost').length === 1, { far: ev(far, 'dropped').map((e) => e.why), lost: ev(lost, 'lock-lost').map((e) => e.f) });
    const atk = track(run(C, (f) => (f === 1 ? LK : f === 30 ? [-127, 0, AT] : 0), 40, { arena: EAST }));
    check(`${id}: locked, an attack goes at the target whatever the stick says`, Math.abs(util.angDiff(atk.states[30].hero.yaw, Math.PI / 2)) < 1e-6, { yaw: +atk.states[30].hero.yaw.toFixed(6) });
  } else {
    const nl = track(run(C, (f) => (f === 1 ? LK : 0), 10, { arena: EAST }));
    check(`${id}: no lock-on in this feel: the press is dropped, and says why`, !ev(nl, 'lock').length && ev(nl, 'dropped').some((e) => e.button === 'lock' && /no lock-on/.test(e.why)));
  }

  // ─── the dashes (Mega Man X): the air dash, the dash jump, the held dash, the dash wall jump ───
  const DD = C.dash ?? {}, fwdP = [0, 127, 0], hspeed = (st) => Math.hypot(st.hero.v[0], st.hero.v[1]);
  const nA = DD.air?.frames ?? 10;   // the air dash held through, let go, pressed again while still in the air
  const ad = track(run(C, (f) => (f >= 1 && f < nA + 1 ? [0, 127, DS] : f === nA + 3 ? [0, 127, DS] : fwdP), 120, { arena: { half: 400, blocks: [], hero: [0, -5], dummy: [0, 300] }, setup: (S) => { S.hero.p[2] = 3; S.hero.grounded = false; } }));
  const adE = ev(ad, 'air-dash');
  if (DD.air) {
    const a0 = adE[0], n = DD.air.frames, flatZ = Array.from({ length: n - 1 }, (_, k) => ad.states[1 + k].hero.p[2]).every((z) => z === ad.states[0].hero.p[2]);
    const sp = hspeed(ad.states[2]), spOk = DD.kind === 'boost' ? sp >= C.ground.run - 1e-9 : Math.abs(sp - DD.air.speed) < 1e-9;
    const spentD = ad.events.some((e) => e.type === 'dropped' && e.button === 'dash' && /spent/.test(e.why));
    row['air dash'] = `${DD.air.count} × ${DD.air.frames} f`;
    check(`${id}: a dash in the air is an air dash: no fall for its ${n} f, at ${DD.kind === 'boost' ? 'a boost' : `${DD.air.speed} m/s`}; a second in the same airtime is spent`, a0?.f === 1 && flatZ && spOk && spentD, { at: a0?.f, flat: flatZ, speed: +sp.toFixed(3), spent: spentD });
    check(`${id}: landing gives the air dash back`, ad.end.hero.grounded && ad.end.hero.airDashes === DD.air.count, { left: ad.end.hero.airDashes });
  } else check(`${id}: no dash: a dash pressed (on the ground or in the air) is dropped, and says why`, !adE.length && ad.events.some((e) => e.type === 'dropped' && e.button === 'dash'));
  // the dash jump: a dash on the ground, a jump inside it
  const djPads = (f) => (f >= 10 && f < 18 ? [0, 127, DS | (f >= 14 ? J : 0)] : f >= 18 && f < 60 ? [0, 127, J] : fwdP);
  const dj = track(run(C, djPads, 140, { arena: OPEN })), djE = ev(dj, 'dash-jump')[0];
  const plainJ = track(run(C, (f) => (f >= 14 && f < 60 ? [0, 127, J] : fwdP), 140, { arena: OPEN }));
  if (DD.jump) {
    const off2 = ev(dj, 'takeoff')[0], land2 = dj.events.find((e) => e.type === 'land' && e.who === 'hero' && e.f > off2.f);
    const airSp = dj.states.slice(off2.f + 1, land2.f).map(hspeed), carriedV = airSp.every((v) => v >= djE.speed - 1e-4)   // (the event rounds the speed to 1e-4);
    const off3 = ev(plainJ, 'takeoff')[0], land3 = plainJ.events.find((e) => e.type === 'land' && e.who === 'hero' && e.f > off3.f);
    const plainTop = Math.max(...plainJ.states.slice(off3.f + 1, land3.f).map(hspeed));
    row['dash jump'] = `${djE.speed.toFixed(1)} m/s`;
    check(`${id}: a jump inside a ground dash is a dash jump: it leaves on the press, and the air keeps the dash's speed (${djE.speed.toFixed(2)} m/s, a plain jump ${plainTop.toFixed(2)})`, djE.f === 14 && off2.f === 14 && carriedV && djE.speed > plainTop + 0.5, { left: off2.f, carried: carriedV, plainTop: +plainTop.toFixed(3) });
  } else check(`${id}: no dash jump: with no dash, a jump on its frame is the ground's own`, !djE && (ev(dj, 'takeoff')[0]?.f ?? 99) > 14);
  if (DD.hold) {
    const relD = track(run(C, (f) => (f >= 10 && f < 14 ? DS : 0), 80, { arena: OPEN })), helD = track(run(C, (f) => (f >= 10 && f < 70 ? DS : 0), 80, { arena: OPEN }));
    const endR = relD.events.find((e) => e.type === 'end' && e.what === 'dash'), endH = helD.events.find((e) => e.type === 'end' && e.what === 'dash');
    check(`${id}: the dash lasts while it is held (${DD.frames} f at most, ${DD.hold.min} f at least)`, endR.f - 10 === DD.hold.min - 1 && endR.released && endH.f - 10 === DD.frames - 1, { tapped: endR.f - 10 + 1, held: endH.f - 10 + 1 });
  }
  if (DD.wall && CL) {
    const k0 = ev(sl, 'cling')[0].f + 10, dw = track(run(C, (f) => (f < k0 - 2 ? into : f < k0 ? [127, 0, DS] : f < k0 + 40 ? [-127, 0, DS | J] : [-127, 0, 0]), 140, { arena: CLIFF, setup: onWall() }));
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

  // ─── hold and release: the charge (the tap at once, the release the beat, a level by the frames held) ───
  const CH = C.charge;
  if (CH) {
    const L0 = CH.levels[0], last = CH.levels.at(-1), T0 = C.moves.string[0].startup + C.moves.string[0].active + C.moves.string[0].recovery;
    const tap = track(run(C, (f) => (f === 1 ? AT : 0), last + 40)), long = track(run(C, hold(AT, 1, 1 + last + 10), last + 40));
    const path = (r) => JSON.stringify(r.states.slice(0, T0).map((x) => [x.hero.p, x.hero.act?.kind ?? null]));
    row['charge'] = `${CH.kind}, levels ${CH.levels.join('/')} f`;
    check(`${id}: holding the attack never delays the tap: the opener plays the same frames held or tapped, and a tap shows no charge`, ev(tap, 'move')[0]?.f === 1 && ev(long, 'move')[0]?.f === 1 && path(tap) === path(long) && !ev(tap, 'charge').length && !ev(tap, 'charge-fizzle').length, { tap: ev(tap, 'move')[0]?.f, held: ev(long, 'move')[0]?.f });
    const short = track(run(C, hold(AT, 1, L0), L0 + 60)), on = track(run(C, hold(AT, 1, 1 + L0), L0 + 60)), re = ev(on, 'release')[0];
    check(`${id}: the release is the beat: let go ${L0} f after the press it fires level 1 on that frame; a frame sooner it fizzles and fires nothing`, re?.f === 1 + L0 && re.lv === 1 && !ev(short, 'release').length && ev(short, 'charge-fizzle').length === (L0 - 1 >= CH.show ? 1 : 0) && !short.end.shots.length, { release: re && [re.f, re.lv], short: ev(short, 'charge-fizzle').map((e) => e.why) });
    const lvs = CH.levels.map((L) => ev(track(run(C, hold(AT, 1, 1 + L), L + 60)), 'release')[0]?.lv);
    check(`${id}: each level fires at its own hold (${CH.levels.join(', ')} f)`, lvs.every((lv, k) => lv === k + 1), lvs);
    if (CH.kind === 'heavy') {
      const fd = frameData(C, body).filter((r) => r.charge), at = (k) => 1 + CH.levels[k];
      const hits = CH.levels.map((L, k) => ev(track(run(C, hold(AT, 1, at(k)), at(k) + 60, { guard: false, mid: (S, f) => { if (f === at(k) - 1) S.dummy.p = [S.hero.p[0], S.hero.p[1] + 1.0, 0]; } })), 'hit', 'dummy')[0]);
      row['heavy Δv'] = hits.map((h) => h?.dv).join(' / ');
      check(`${id}: the charged blow lands its startup after the release, on frameData's numbers, harder each level than the last and than the tap`, hits.every((h, k) => h?.charged === k + 1 && h.f === at(k) + CH.at[k].startup && h.dv === fd[k].dv) && hits.every((h, k) => h.dv > (k ? hits[k - 1].dv : frameData(C, body)[0].dv)), hits.map((h) => h && [h.f, h.dv, h.charged]));
    }
    if (CH.stance) {
      const st = T0 + 4;
      const jmp = track(run(C, (f) => (f >= 1 && f < st + 30 ? AT : 0) | (f === st ? J : 0), st + 40));
      const walk = track(run(C, (f) => pad(0, f > T0 ? 127 : 0, f >= 1 && f < st + 40 ? AT : 0), st + 41)), wv = Math.max(...walk.states.filter((x) => x.hero.act?.kind === 'charge').map((x) => Math.hypot(x.hero.v[0], x.hero.v[1])));
      const roll = track(run(C, (f) => (f >= 1 && f < last + 20 ? AT : 0) | (f === L0 + 6 ? DG : 0), last + 40));
      check(`${id}: the charging stance: a jump in it is dropped (charging), the stick walks it at ${CH.move} of the run, a roll lets the charge go and the release fires nothing`, walk.states[T0 + 1].hero.act?.kind === 'charge' && ev(jmp, 'dropped').some((e) => e.button === 'jump' && /charging/.test(e.why)) && wv <= C.ground.run * CH.move + 1e-9 && (CH.move === 0 ? wv < 1e-9 : wv > 0.1) && ev(roll, 'charge-lost').length === 1 && !ev(roll, 'release').length, { walk: +wv.toFixed(3), lost: ev(roll, 'charge-lost').map((e) => e.why) });
    }
    if (CH.kind === 'spin') {
      const rel = 1 + last, aim = track(run(C, (f) => pad(f > T0 && f < rel ? 127 : 0, 0, f >= 1 && f < rel ? AT : 0), rel + 10)), v = aim.states[rel].hero.v;
      check(`${id}: the spin dash: rooted in its stance, the stick aims it, and the release launches it along the aim at the level's ${CH.at.at(-1).speed} m/s`, Math.abs(v[0] - CH.at.at(-1).speed) < 1e-6 && Math.abs(v[1]) < 1e-6 && aim.states[rel - 1].hero.p[0] === 0, { v: v.map((x) => +x.toFixed(3)) });
    }
    if (CH.kind === 'shot') {
      const air = track(run(C, (f) => (f >= 1 && f < 50 ? AT : 0) | (f >= 19 && f < 25 ? DS : 0) | (f >= 22 && f < 45 ? J : 0), 60)), ra = ev(air, 'release')[0];
      check(`${id}: X's buster: the charge is kept through a dash and a jump, and the release fires from the air`, ra?.f === 50 && ra.lv === 1 && !air.states[50].hero.grounded && air.states[50].shots.length === 1 && ev(air, 'dash-jump').length === 1, { release: ra && [ra.f, ra.lv], grounded: air.states[50].hero.grounded });
      const LANE = { half: 400, blocks: [], hero: [0, 0], dummy: [0, 4] };
      const shots = CH.levels.map((L, k) => { const rel = 1 + L, r = track(run(C, hold(AT, 1, rel), rel + 60, { arena: LANE, guard: false })), h = ev(r, 'hit', 'dummy')[0], sh = CH.at[k];
        return { h, want: rel + Math.ceil((4 - util.RADIUS - sh.size - (util.RADIUS + 0.15)) / (sh.speed / FPS)) - 1, push: sh.force.push }; });
      check(`${id}: the shot flies at its level's speed and lands as a blow of its level's push (the full charge the finisher)`, shots.every(({ h, want, push }, k) => h?.shot === k + 1 && Math.abs(h.f - want) <= 1 && h.dv === push && h.finisher === (k + 1 === CH.levels.length)), shots.map(({ h, want }) => h && [h.f, want, h.dv]));
      const wall = track(run(C, hold(AT, 1, 1 + L0), L0 + 60, { arena: { ...LANE, blocks: [{ id: 'w', x: [-1, 1], y: [2, 2.5], h: 3 }] }, guard: false }));
      check(`${id}: a wall stops a shot`, ev(wall, 'shot-wall').length === 1 && !ev(wall, 'hit', 'dummy').length);
    }
    // the hero faces away (its tap whiffs) and holds on; the dummy's jab lands from behind mid-charge
    const hurt = track(run(C, (f) => (f >= 1 && f < 80 ? AT : 0), 100, { arena: { half: 400, blocks: [], hero: [0, -0.8], dummy: [0, 0] }, spar: true, sparMoves: ['jab'], setup: (S) => { S.hero.yaw = Math.PI; } })), hh = ev(hurt, 'hit', 'hero')[0];
    const keeps = C.hurt?.charge === 'keep' && !CH.stance;
    if (keeps) check(`${id}: the card keeps the charge through a hit (hurt.charge: keep): the release still fires`, hh && hurt.states[hh.f].hero.charge && ev(hurt, 'release').length === 1, { hit: hh?.f, release: ev(hurt, 'release').map((e) => [e.f, e.lv]) });
    else check(`${id}: a hit taken loses the charge: the release fires nothing`, hh && hurt.states[hh.f - 1].hero.charge && !hurt.states[hh.f].hero.charge && !ev(hurt, 'release').length, { hit: hh?.f, lost: ev(hurt, 'charge-lost').map((e) => [e.f, e.why]) });
  }

  // ─── offense armor: what it takes to interrupt an attack ───
  {
    const FAR = { half: 400, blocks: [], hero: [0, 0], dummy: [300, 300] };
    // the dummy set a metre ahead of the hero, facing it, `f` frames into one of its attacks
    const put = (S, name, f) => { const H = S.hero, D = S.dummy; D.p = [H.p[0] + Math.sin(H.yaw), H.p[1] + Math.cos(H.yaw), 0]; D.v = [0, 0, 0]; D.yaw = Math.atan2(H.p[0] - D.p[0], H.p[1] - D.p[1]); D.act = { kind: 'spar', f, hit: false, name }; };
    const tapOn = (name) => track(run(C, (f) => (f === 1 ? AT : 0), 120, { arena: FAR, guard: false, mid: (S, f) => { if (f === 0) put(S, name, 0); } }));
    const jab = tapOn('jab'), hook = tapOn('hook'), per = tapOn('perilous'), c0 = 1 + C.moves.string[0].startup;
    const dj = ev(jab, 'hit', 'dummy')[0];
    row['armor'] = 'jab none · hook heavy / shot · perilous hyper';
    check(`${id}: the dummy's jab stops at any hit: the tap interrupts its telegraph, and it never lands`, dj?.f === c0 && jab.states[c0].dummy.act?.kind !== 'spar' && !ev(jab, 'hit', 'hero').length && !ev(jab, 'armor', 'dummy').length, { hit: dj?.f, act: jab.states[c0].dummy.act?.kind });
    const ah = ev(hook, 'armor', 'dummy')[0], ap = ev(per, 'armor', 'dummy')[0];
    check(`${id}: the hook's armor and the perilous blow's hyper armor shrug off the tap (a clank: no stun, no push), and each goes on to land`, ah?.f === c0 && ap?.f === c0 && !ev(hook, 'hit', 'dummy').length && !ev(per, 'hit', 'dummy').length && hook.states[c0].dummy.act?.name === 'hook' && Math.hypot(...hook.states[c0].dummy.v) === 0 && ev(hook, 'hit', 'hero').length === 1 && ev(per, 'hit', 'hero').length === 1, { hook: ah?.f, perilous: ap?.f, landed: [ev(hook, 'hit', 'hero').length, ev(per, 'hit', 'hero').length] });
    const CH2 = C.charge;
    if (CH2?.kind === 'heavy') {
      const top = CH2.levels.length - 1, rel = (k) => 1 + CH2.levels[k], con = (k) => rel(k) + CH2.at[k].startup;
      const heavyOn = (name, k) => track(run(C, hold(AT, 1, rel(k)), rel(k) + 90, { arena: FAR, guard: false, mid: (S, f) => { if (f === con(k) - 10) put(S, name, 0); } }));
      const hb = heavyOn('hook', 0), pb = heavyOn('perilous', top), hh = ev(hb, 'hit', 'dummy')[0];
      check(`${id}: a heavy breaks the hook's armor (it interrupts the telegraph, the hook never lands); nothing breaks the perilous blow's, not even the top charge`, hh?.charged === 1 && ev(hb, 'armor-break', 'dummy').length === 1 && !ev(hb, 'hit', 'hero').length && ev(pb, 'armor', 'dummy').some((e) => e.tags.includes('heavy')) && !ev(pb, 'armor-break', 'dummy').length && !ev(pb, 'hit', 'dummy').length, { hook: hh && [hh.f, hh.charged], perilous: ev(pb, 'armor', 'dummy').map((e) => e.tags) });
      // the hero's own armor: the dummy's blows set to land inside the charged move's armor frames
      const into = (k, blows) => track(run(C, hold(AT, 1, rel(k)), rel(k) + 90, { arena: FAR, guard: false, mid: (S, f) => { for (const [at, name] of blows) if (f === rel(k) + at) put(S, name, name === 'hook' ? 41 : 30); } }));
      if (id === 'realistic') {
        const two = into(0, [[1, 'jab'], [6, 'jab']]), a1 = ev(two, 'armor', 'hero')[0], br = ev(two, 'armor-break', 'hero')[0];
        check(`${id}: the haymaker shrugs off the first light hit and breaks at the second (its poise), and never lands`, a1?.f === rel(0) + 1 && br?.f === rel(0) + 6 && ev(two, 'hit', 'hero').length === 1 && !ev(two, 'hit', 'dummy').length, { armor: a1?.f, broke: br?.f });
      } else {
        const lj = into(0, [[2, 'jab']]), lh = into(0, [[2, 'hook']]), hy = into(top, [[2, 'hook']]);
        check(`${id}: the heavy shrugs off a light hit and lands; a heavy hit interrupts it; the launcher's hyper armor shrugs off the heavy hook and lands`, ev(lj, 'armor', 'hero').length === 1 && ev(lj, 'hit', 'dummy').some((h) => h.charged === 1) && ev(lh, 'armor-break', 'hero').length === 1 && ev(lh, 'hit', 'hero').length === 1 && !ev(lh, 'hit', 'dummy').length && ev(hy, 'armor', 'hero').length === 1 && ev(hy, 'hit', 'dummy').some((h) => h.charged === top + 1), { light: ev(lj, 'armor', 'hero').length, heavy: ev(lh, 'armor-break', 'hero').length, hyper: ev(hy, 'armor', 'hero').length });
      }
    }
    if (CH2?.kind === 'shot') {   // a trigger: the hook breaks to a shot, the light one as well
      const rel = 1 + CH2.levels[0], LANE = { half: 400, blocks: [], hero: [0, 0], dummy: [0, 4] };
      const sh = track(run(C, hold(AT, 1, rel), rel + 60, { arena: LANE, guard: false, mid: (S, f) => { if (f === rel - 5) { S.dummy.yaw = Math.PI; S.dummy.act = { kind: 'spar', f: 0, hit: false, name: 'hook' }; } } })), b = ev(sh, 'armor-break', 'dummy')[0];
      check(`${id}: a trigger: the light shot breaks the hook's armor (it names shots), where the light tap only clanks`, b?.tags.includes('shot') && b.tags.includes('light') && ev(sh, 'hit', 'dummy')[0]?.shot === 1, { broke: b && [b.f, b.tags] });
    }
  }

  // ─── ranged attacks: the dummy as a shooter, what a hit does, maneuver armor, life ───
  {
    const SH = { half: 400, blocks: [], hero: [0, -6], dummy: [0, 0] }, names = Object.values(C.ranged.sets).flat(), RP = util.rangedOf, HU = C.hurt;
    const shoot = (name, pads, n, o = {}) => track(run(o.card ?? C, pads, n, { arena: o.arena ?? SH, shooter: [name], guard: false, setup: o.setup, mid: o.mid }));
    const hurts = (r) => ev(r, 'hurt'), deg = (q) => (Math.atan2(q.v[0], q.v[1]) * 180) / Math.PI;
    // an orb set beside the hero, flying into it (a shot on demand, the shooter off)
    const orbAt = (S, ahead = 0.8, side = 0) => { const H = S.hero, fx = Math.sin(H.yaw), fy = Math.cos(H.yaw), p = [H.p[0] + fx * ahead + fy * side, H.p[1] + fy * ahead - fx * side, H.p[2] + 1.1]; S.foes.push({ id: 900 + S.f, name: 'orb', f: 0, life: 60, size: 0.25, g: 0, b: p.slice(), p, v: [-fx * 9, -fy * 9, 0] }); };
    const inject = (pads, n, at, o = {}) => track(run(o.card ?? C, pads, n, { arena: { half: 400, blocks: [], hero: [0, 0], dummy: [300, 300] }, guard: false, setup: o.setup, mid: (S, f) => { for (const [g, ahead] of at) if (f === g) orbAt(S, ahead ?? 0.8); } }));
    row['ranged'] = Object.entries(C.ranged.sets).map(([k, v]) => `${k}: ${v.join(' ')}`).join(' · ');
    for (const name of names.filter((n) => RP(n).speed === Infinity)) {
      const P = RP(name), n = P.telegraph + (P.burst - 1) * P.gap + 20, still = shoot(name, () => 0, n), fires = ev(still, 'fire', 'dummy');
      const across = shoot(name, () => pad(127, 0, 0), n), cover = shoot(name, () => 0, n, { arena: { ...SH, blocks: [{ id: 'c', x: [-1, 1], y: [-3.4, -3], h: 2 }] } });
      check(`${id}: the ${name} is hitscan: a still body is hit on the fire frame${P.burst > 1 ? ', every shot of the burst' : ''}; a body running across is missed (${P.lock ? `the aim locks ${P.lock} f before the shot` : `the aim trails it by ${P.lag} f`}); cover stops it`, fires.length === P.burst && fires.every((e, k) => e.f === P.telegraph + k * P.gap && e.result === 'hit') && hurts(still).length === P.burst && ev(across, 'fire', 'dummy').every((e) => e.result !== 'hit') && !hurts(across).length && ev(cover, 'fire', 'dummy').every((e) => e.result === 'cover') && !hurts(cover).length, { still: fires.map((e) => [e.f, e.result]), across: ev(across, 'fire', 'dummy').map((e) => e.result), cover: ev(cover, 'fire', 'dummy').map((e) => e.result) });
    }
    const one = names.find((n) => { const P = RP(n); return P.speed !== Infinity && !P.count && !P.lob && !P.home && !P.wave; });
    if (one) {
      const P = RP(one), want = P.telegraph + Math.ceil((6 - 0.4 - util.RADIUS - P.size) / (P.speed / FPS)) - 1;
      const still = shoot(one, () => 0, want + 40), h = hurts(still)[0], side = shoot(one, (f) => pad(f > P.telegraph ? 127 : 0, 0, 0), want + 40);
      check(`${id}: the ${one} flies at ${P.speed} m/s: it reaches a still body when its flight says, and a sidestep started as it leaves clears it`, h && Math.abs(h.f - want) <= 1 && !hurts(side).length, { hit: h?.f, want, side: hurts(side).length });
    }
    for (const name of names.filter((n) => (RP(n).count ?? 1) > 1)) {
      const P = RP(name), r = shoot(name, () => 0, P.telegraph + 2), fs = r.states[P.telegraph].foes, rel = fs.map((q) => util.angDiff((deg(q) * Math.PI) / 180, Math.PI) * 180 / Math.PI).sort((a, b) => a - b);
      const step = P.spread >= 360 ? 360 / P.count : P.spread / (P.count - 1), even = rel.slice(1).every((x, k) => Math.abs(x - rel[k] - step) < 1e-6);
      check(`${id}: the ${name} is ${P.count} shots ${P.spread >= 360 ? 'evenly all round' : `fanned evenly across ${P.spread}°`}, one at the hero`, fs.length === P.count && even && rel.some((x) => Math.abs(x) < 1e-6), rel.map((x) => +x.toFixed(1)));
    }
    for (const name of names.filter((n) => RP(n).speed !== Infinity && !RP(n).lob && (RP(n).z ?? 1.1) < 1)) {
      const P = RP(name), still = shoot(name, () => 0, 200), h0 = hurts(still)[0]?.f, at = h0 - 15 - C.jump.commit;
      const hop = shoot(name, (f) => (f >= at && f < at + 30 ? J : 0), h0 + 25);   // one volley: the next would meet the landing
      check(`${id}: the ${name} flies low (${P.z} m): a jump over it clears it`, h0 != null && !hurts(hop).length, { hit: h0, jumped: hurts(hop).map((e) => e.f) });
    }
    for (const name of names.filter((n) => RP(n).home)) {
      const P = RP(name), walk = shoot(name, (f) => pad(f > P.telegraph ? 40 : 0, 0, 0), P.telegraph + 200), h = hurts(walk)[0];
      const q0 = walk.states[P.telegraph].foes[0], heading = (r, f) => (r.states[f].foes[0] ? deg(r.states[f].foes[0]) : null);
      const turned = q0 && h ? (util.angDiff((heading(walk, h.f - 1) * Math.PI) / 180, (deg(q0) * Math.PI) / 180) * 180) / Math.PI : null;
      check(`${id}: the ${name} turns after the hero (${P.home}°/s): a body walking aside is still met`, h && q0 && Math.abs(turned) > 5, { hit: h?.f, turned: turned == null ? null : +turned.toFixed(1) });
    }
    for (const name of names.filter((n) => RP(n).lob && RP(n).blast)) {
      const P = RP(name), land = P.telegraph + Math.round(P.lob.flight * FPS), still = shoot(name, () => 0, land + 20), away = shoot(name, (f) => pad(f > P.telegraph ? 127 : 0, 0, 0), land + 20), h = hurts(still)[0];
      check(`${id}: the ${name} is lobbed at where the hero stood, landing ${P.lob.flight} s on (on the body or bursting at its feet), so standing is hit and moving off is not`, h && h.f >= land - 8 && h.f <= land + 2 && hurts(still).length === 1 && !hurts(away).length, { hit: h?.f, land, away: hurts(away).length });
    }
    for (const name of names.filter((n) => RP(n).lob && RP(n).bounce)) {
      const P = RP(name), r = shoot(name, (f) => pad(f > P.telegraph ? 127 : 0, 0, 0), P.telegraph + 160), z = r.states.slice(P.telegraph).map((x) => x.foes[0]?.p[2]).filter((v) => v != null);
      const bounces = z.filter((v, k) => k > 0 && k < z.length - 1 && v < z[k - 1] && v <= z[k + 1]).length;
      check(`${id}: the ${name} bounces on along the floor (restitution ${P.bounce})`, bounces >= 2, { bounces });
    }
    for (const name of names.filter((n) => RP(n).wave)) {
      const P = RP(name), r = shoot(name, (f) => pad(f > P.telegraph ? 127 : 0, 0, 0), P.telegraph + 200), xs = r.states.slice(P.telegraph).map((x) => x.foes[0]?.p[0]).filter((v) => v != null), amp = Math.max(...xs.map(Math.abs));
      check(`${id}: the ${name} weaves ${P.wave.amp} m either side of its line`, Math.abs(amp - P.wave.amp) < 0.03 && xs.some((x) => x > 0.5) && xs.some((x) => x < -0.5), { amp: +amp.toFixed(3) });
    }
    for (const name of names.filter((n) => RP(n).down)) {
      const P = RP(name), h = hurts(shoot(name, () => 0, P.telegraph + 40))[0];
      check(`${id}: the ${name} knocks down: ${HU.down} f on the floor`, h?.down && h.stun === HU.down, { stun: h?.stun });
    }
    // what a hit does, the card's: a flinch (control kept, the run slowed), or knocked back and stunned
    const first = inject(() => 0, 30, [[5]]), h1 = hurts(first)[0], st = h1 && first.states[h1.f].hero;
    row['hurt'] = HU.stun ? `stun ${HU.stun} f, knock ${HU.knock} m/s, mercy ${HU.mercy} f` : `flinch: run ×${HU.slow.share} for ${HU.slow.frames} f`;
    if (!HU.stun) check(`${id}: a hit is a flinch: control kept, the run slowed ${HU.slow.frames} f to ×${HU.slow.share}`, st && st.act?.kind !== 'hurt' && st.stun === 0 && st.slowed === HU.slow.frames - 1, { slowed: st?.slowed });
    else check(`${id}: a hit stops the body: knocked back at ${HU.knock} m/s${HU.hop ? ` and up` : ''}, stunned ${HU.stun} f`, st && st.act?.kind === 'hurt' && st.stun === HU.stun - 1 && Math.abs(Math.hypot(st.v[0], st.v[1]) - HU.knock) < 1e-6 && (!HU.hop || st.v[2] > 0), { stun: st && st.stun + 1, knock: st && +Math.hypot(st.v[0], st.v[1]).toFixed(3) });
    const g2 = 5 + Math.max(4, Math.floor(HU.mercy / 2)), g3 = 5 + HU.mercy + 30, merc = inject(() => 0, g3 + 20, [[5], [g2], [g3]]);
    check(`${id}: ${HU.mercy ? `mercy: a shot inside the ${HU.mercy} f after a hit passes through, one after them hurts` : 'no mercy: every shot hurts'}`, hurts(merc).length === (HU.mercy ? 2 : 3), { hurts: hurts(merc).map((e) => e.f) });
    // maneuver armor: moving in one of the card's ways, a hit's stun and knock cut to its shares
    const MA = C.maneuver;
    if (MA) for (const w of MA.on) {
      const setup = { dash: [(f) => (f >= 5 && f < 30 ? DS : 0), 8, 1.5], sprint: [(f) => pad(0, 127, f > 0 ? BTN.SPRINT : 0), 60, 1.5], run: [(f) => pad(0, 127, 0), 120, 2.5] }[w];
      if (!setup) continue;
      const [pads, at, ahead] = setup, r = inject(pads, at + 30, [[at, ahead]]), h = hurts(r)[0], before = r.states[at - 1]?.hero, after = h && r.states[h.f].hero;
      const want = Math.round(HU.stun * MA.stun), keepsGoing = MA.stun === 0 ? (w === 'dash' ? after?.act?.kind === 'dash' : Math.hypot(after.v[0], after.v[1]) >= Math.hypot(before.v[0], before.v[1]) - HU.knock * MA.knock - 1e-6) : true;   // only the knock's share comes off the speed
      check(`${id}: maneuver armor ${w === 'run' ? `running past ${MA.speed} m/s` : `in a ${w}`}: the hit's stun is ${MA.stun ? `cut to ×${MA.stun}` : 'gone (hyper armor while moving), the body goes on'}, its life still taken`, h?.maneuver && h.stun === want && keepsGoing && (C.life.kind === 'rings' ? ev(r, 'rings').length === 1 : after.hp < C.life.hp), { stun: h?.stun, want, act: after?.act?.kind ?? null });
    }
    // life: down at its end, up again full; one-hit; rings
    const L = C.life;
    if (L.kind === 'rings') {
      const r = inject(() => 0, 5 + HU.mercy + 40, [[5], [5 + HU.mercy + 10]]);
      check(`${id}: rings: a hit scatters every ring (${L.hp}) and is survived; a hit with none is the end`, ev(r, 'rings')[0]?.lost === L.hp && ev(r, 'ko').length === 1 && ev(r, 'ko')[0].f > ev(r, 'rings')[0].f, { rings: ev(r, 'rings').map((e) => [e.f, e.lost]), ko: ev(r, 'ko').map((e) => e.f) });
    } else {
      const low = inject(() => 0, 5 + L.ko + 20, [[5]], { setup: (S) => { S.hero.hp = 1; } }), ko = ev(low, 'ko')[0], up = ev(low, 'up')[0];
      const oh = inject(() => 0, 20, [[5]], { card: { ...C, life: { ...L, oneHit: true } } });
      check(`${id}: out of life the body is down ${L.ko} f, then up again full (${L.hp}); with oneHit any hit is the end`, ko && up && Math.abs(up.f - ko.f - L.ko) <= 1 && up.hp === L.hp && low.states[ko.f].hero.act?.kind === 'ko' && ev(oh, 'ko').length === 1, { ko: ko?.f, up: up?.f, oneHit: ev(oh, 'ko').map((e) => e.f) });
    }
  }

  // ─── the glider and the jetpack ───
  {
    const GL = C.glide, JT = C.jet, gearRun = (gear, pads, n, o = {}) => track(run(o.card ?? C, pads, n, { arena: o.arena ?? OPEN, gear, setup: o.setup, mid: o.mid }));
    const high = (z) => (S) => { S.hero.p[2] = z; S.hero.grounded = false; S.hero.from = z; };
    const plain = gearRun(null, hold(J, 1, 200), 300);
    check(`${id}: with no gear a held jump does nothing in the air`, !ev(plain, 'glide').length && !ev(plain, 'jet').length && !ev(plain, 'flap').length);
    if (GL.kind === 'paraglider') {
      const n = GL.time + 40, r = gearRun('glide', (f) => pad(0, 127, f === 2 ? J : 0), n, { setup: high(30) }), g = ev(r, 'glide')[0], e = ev(r, 'glide-end')[0];
      const mid = r.states[g.f + 120].hero, low = gearRun('glide', (f) => (f === 2 ? J : 0), 30, { setup: high(GL.min - 0.3) });
      row['glider'] = `paraglider ${GL.fall} m/s down, ${GL.speed} m/s on, ${GL.time} f`;
      check(`${id}: the paraglider opens on a press from a height (${GL.min} m), sinks at ${GL.fall} m/s and flies on at ${GL.speed} m/s; its stamina folds it after ${GL.time} f and the body falls; too low, the press is the air's`, g?.f === 2 && Math.abs(mid.v[2] + GL.fall) < 1e-9 && Math.abs(Math.hypot(mid.v[0], mid.v[1]) - GL.speed) < 1e-6 && e?.why === 'out of stamina' && e.f === g.f + GL.time && r.states[e.f + 10].hero.v[2] < -GL.fall && !ev(low, 'glide').length, { open: g?.f, fold: e && [e.f, e.why], speed: +Math.hypot(mid.v[0], mid.v[1]).toFixed(3), low: ev(low, 'glide').length });
      const fold = gearRun('glide', (f) => (f === 2 || f === 60 ? J : 0), 80, { setup: high(30) });
      check(`${id}: a second press folds the paraglider`, ev(fold, 'glide-end')[0]?.why === 'folded' && ev(fold, 'glide-end')[0].f === 60);
    } else if (GL.kind === 'float') {
      const r = gearRun('glide', hold(J, 1, 200), 300), g = ev(r, 'glide')[0], e = ev(r, 'glide-end')[0], zs = g && r.states.slice(g.f, g.f + GL.time).map((x) => x.hero.p[2]);
      row['glider'] = `float ${GL.time} f`;
      check(`${id}: the float: held past the apex the height is kept ${GL.time} f, then the body falls, and no second float before landing`, g && e?.why === 'the float is spent' && e.f === g.f + GL.time && zs.every((z) => Math.abs(z - zs[0]) < 1e-9) && r.states[e.f + 10].hero.p[2] < zs[0] && ev(r, 'glide').length === 1, { start: g?.f, end: e?.f, z: zs && +zs[0].toFixed(3) });
    } else {
      const r = gearRun('glide', (f) => pad(0, 127, J), 400, { setup: high(40) }), g = ev(r, 'glide')[0], late = r.states[g.f + 300].hero;
      const turn = gearRun('glide', (f) => pad(f > 60 ? 127 : 0, f > 60 ? 0 : 127, J), 120, { setup: high(40) }), yaws = turn.states.slice(61, 100).map((x) => x.hero.yaw), most = Math.max(...yaws.slice(1).map((y, k) => Math.abs(util.angDiff(y, yaws[k]))));
      const let_ = gearRun('glide', (f) => (f < 60 ? J : 0), 90, { setup: high(40) }), le = ev(let_, 'glide-end')[0];
      row['glider'] = `glide ${GL.fall} m/s down, ${GL.from ? `${GL.from} → ` : ''}${GL.speed} m/s, ${GL.turn}°/s${GL.grab ? ', grabs walls' : ''}`;
      check(`${id}: the glide: held past the apex it sinks at ${GL.fall} m/s and settles on ${GL.speed} m/s${GL.from ? ` from ${GL.from}` : ''}, turning at most ${GL.turn}°/s; let go, it falls`, g && Math.abs(late.v[2] + GL.fall) < 1e-9 && Math.abs(Math.hypot(late.v[0], late.v[1]) - GL.speed) < 1e-6 && most <= (GL.turn * Math.PI) / 180 / FPS + 1e-9 && most > 0 && le?.why === 'let go' && let_.states[le.f + 10].hero.v[2] < -GL.fall, { start: g?.f, speed: +Math.hypot(late.v[0], late.v[1]).toFixed(3), turn: +(most * FPS * 180 / Math.PI).toFixed(1), let: le?.f });
      if (GL.grab) {
        const wall = gearRun('glide', () => pad(0, 127, J), 200, { setup: high(40), arena: { ...OPEN, blocks: [{ id: 'w', x: [-5, 5], y: [8, 9], h: 60 }] } }), c = ev(wall, 'cling').find((e) => e.grab);
        check(`${id}: a glide into a wall grabs it (Knuckles)`, c && wall.states[c.f].hero.cling && !wall.states[c.f].hero.glide, { grab: c?.f });
      }
      const hit = gearRun('glide', () => J, 60, { setup: high(40), mid: (S, f) => { if (f === 30) { const H = S.hero, p = [H.p[0], H.p[1] + 0.8, H.p[2] + 1.1]; S.foes.push({ id: 1, name: 'orb', f: 0, life: 60, size: 0.25, g: 0, b: p.slice(), p, v: [0, -9, 0] }); } } });
      check(`${id}: a hit takes the body out of its glide`, ev(hit, 'glide-end').some((e) => e.why === 'hit'), ev(hit, 'glide-end').map((e) => [e.f, e.why]));
    }
    if (JT.kind === 'flap') {
      const presses = (f) => (f === 1 || (f >= 20 && f % 12 === 8) ? J : 0), r = gearRun('jet', presses, JT.fuel + 120), flaps = ev(r, 'flap'), tired = ev(r, 'tired')[0];
      const sinks = r.states.filter((x) => x.hero.flying && !x.hero.grounded).every((x) => x.hero.v[2] >= -JT.sink - 1e-9);
      const after = tired && ev(r, 'dropped').concat(ev(r, 'buffered')).filter((e) => e.button === 'jump' && e.f > tired.f && /tired/.test(e.why));
      row['jetpack'] = `flight: flap ${JT.flap} m/s, ${JT.fuel} f`;
      check(`${id}: flight (Tails): once the air jump is spent each press flaps up at ${JT.flap} m/s, the fall slowed to ${JT.sink} m/s between; after ${JT.fuel} f it tires and the presses do nothing`, flaps.length > 10 && flaps.every((e) => r.states[e.f].hero.v[2] >= JT.flap - C.jump.gFall / FPS - 1e-9) && sinks && tired && after.length > 0 && !flaps.some((e) => e.f > tired.f), { flaps: flaps.length, tired: tired?.f, after: after?.length });
    } else {
      const r = gearRun('jet', hold(J, 1, 400), 600), on = ev(r, 'jet')[0], off = ev(r, 'jet-end')[0], top = Math.max(...r.states.map((x) => x.hero.p[2])), land = ev(r, 'land').find((e) => e.f > (off?.f ?? 0));
      const refill = land && r.states.findIndex((x, k) => k > land.f && x.hero.fuel >= JT.fuel), want = land && land.f + JT.delay + Math.ceil(JT.fuel / JT.regen);
      const climbs = on && r.states.slice(on.f + 30, off.f).every((x) => x.hero.v[2] <= JT.rise + 1e-9) && (JT.kind === 'hover' ? Math.abs(r.states[off.f - 1].hero.v[2] - JT.rise) < 1e-6 : true);
      row['jetpack'] = `${JT.kind}: ${JT.fuel} f of fuel, refilled ${JT.delay} f after landing`;
      check(`${id}: the jetpack (${JT.kind}): held past the apex it lifts, climbing no faster than ${JT.rise} m/s, above the jump's height; it burns out after ${JT.fuel} f and the tank refills ${JT.delay} f after landing`, on && off?.why === 'out of fuel' && off.f - on.f === JT.fuel && climbs && top > C.jump.height + 0.1 && Math.abs(refill - want) <= 2, { on: on?.f, out: off && [off.f, off.why], top: +top.toFixed(3), refill: [refill, want] });
      const tap = gearRun('jet', (f) => (f === 1 || f === 40 ? J : 0), 120, { setup: high(10) });
      check(`${id}: a press in the air lights it too, and letting go puts it out`, ev(tap, 'jet').some((e) => e.f === 40) && ev(tap, 'jet-end').some((e) => e.why === 'let go'), ev(tap, 'jet').map((e) => e.f));
    }
  }

  // ─── the loadout: mobile-suit-arena's weapons (ready time, cooldown, ammo or charge, reload) ───
  if (C.loadout) {
    const L = C.loadout, slots = L.slots, WO = (i) => util.weaponOf(slots[i].weapon), find = (fn) => slots.findIndex((sl, i) => fn(WO(i), sl));
    const armRun = (i, pads, n, o = {}) => track(run(o.card ?? C, pads, n, { arena: o.arena ?? OPEN, gear: o.gear ?? null, guard: false, setup: (S) => { if (i != null) S.hero.arms.slot = i; o.setup?.(S); }, mid: o.mid }));
    const rounds = (r) => ev(r, 'round'), dropped = (r, re) => ev(r, 'dropped').filter((e) => e.button === 'shoot' && re.test(e.why));
    const tap = (fs) => (f) => (fs.includes(f) ? SH : 0);
    row['loadout'] = slots.map((sl) => sl.name).join(' · ');
    if (slots.length > 1) {
      const ready = Math.round((Number.isFinite(slots[1].switchReady) ? slots[1].switchReady : L.switchReady ?? 1) * FPS);
      // (two runs: a press on the frame after another is the same held press)
      const at = 5 + Math.max(ready, 1), r = armRun(null, (f) => (f === 5 ? SW : f === at ? SH : 0), ready + 60), sw = ev(r, 'switch')[0];
      const soon = ready > 0 ? armRun(null, (f) => (f === 5 ? SW : f === 5 + ready - 1 ? SH : 0), ready + 10) : null;
      const early = soon ? dropped(soon, /readying/).filter((e) => e.f === 5 + ready - 1) : [];
      const acted = ev(r, 'acted').filter((e) => e.button === 'shoot' && e.f === at);
      const twice = armRun(null, (f) => (f === 5 || f === 15 ? SW : 0), 20), s2 = ev(twice, 'switch')[1];
      row['ready'] = `${L.switchReady ?? 1} s` + (slots.some((sl) => Number.isFinite(sl.switchReady)) ? ` (${slots.filter((sl) => Number.isFinite(sl.switchReady)).map((sl) => `${sl.name} ${sl.switchReady} s`).join(', ')})` : '');
      check(`${id}: ready time: a switch arms the next weapon's ${ready} f (${(ready / FPS).toFixed(2)} s); ${ready ? 'the trigger a frame sooner is dropped (readying), on the frame it acts' : 'none here: the trigger acts at once'}; a second switch re-arms it in full`, sw?.slot === 1 && sw.ready === ready && (ready === 0 || early.length === 1) && acted.length === 1 && s2 && Math.round(twice.states[15].hero.arms.readyT) === Math.max(0, s2.ready - 1), { ready: sw?.ready, early: early.length, acted: acted.length, rearmed: s2?.ready });
      const own = find((W, sl) => Number.isFinite(sl.switchReady));
      if (own > 0) {
        const pads = (f) => (f >= 1 && f <= own * 2 && f % 2 === 1 ? SW : 0), r3 = armRun(null, pads, own * 2 + 4), last = ev(r3, 'switch').at(-1);
        check(`${id}: a slot's own switchReady wins over the loadout's (${slots[own].name}: ${slots[own].switchReady} s)`, last?.to === slots[own].name && last.ready === Math.round(slots[own].switchReady * FPS), { to: last?.to, ready: last?.ready });
      }
    }
    const semi = find((W) => !W.auto && W.burst === 1 && !(W.chargeTime > 0) && W.cooldown * FPS < 400);
    if (semi >= 0) {
      const W = WO(semi), cd = Math.ceil(W.cooldown * FPS - 1e-9), r = armRun(semi, tap([1, 1 + cd]), cd + 10), soon = armRun(semi, tap([1, cd]), cd + 10);
      check(`${id}: cooldown: the ${slots[semi].name} fires once a pull and waits ${W.cooldown} s (${cd} f); a pull a frame before it is dropped (cooling down), on it the next round leaves`, rounds(r).map((e) => e.f).join() === `1,${1 + cd}` && dropped(soon, /cooling/).some((e) => e.f === cd) && rounds(soon).length === 1, { rounds: rounds(r).map((e) => e.f), cd });
    }
    const auto = find((W) => W.auto);
    if (auto >= 0) {
      const W = WO(auto), per = Math.ceil(FPS / W.rof - 1e-9), r = armRun(auto, (f) => (f >= 1 && f <= 60 ? SH : 0), 61), fs = rounds(r).map((e) => e.f);
      check(`${id}: an auto weapon streams while held: the ${slots[auto].name} at ${W.rof} rounds a second (a round every ${per} f)`, fs.length > 3 && fs.slice(1).every((x, k) => x - fs[k] === per), { rounds: fs.length, per });
      // the magazine and the reload: empty, it reloads over its time (stowed too), refusing the trigger meanwhile
      const need = W.magazine * per + 5, R = Math.round(W.reload * FPS), e1 = armRun(auto, (f) => (f >= 1 && f <= need ? SH : 0) | (f === need + 10 ? SH : 0), need + R + 20);
      const rl = ev(e1, 'reload')[0], rd = ev(e1, 'reloaded')[0], during = dropped(e1, /reloading/);
      const stow = slots.length > 1 ? armRun(auto, (f) => (f >= 1 && f <= need ? SH : 0) | (f === need + 2 ? SW : 0), need + R + 20) : null, srd = stow && ev(stow, 'reloaded')[0];
      check(`${id}: the magazine (${W.magazine}) empties and auto-reloads over ${W.reload} s, the trigger refused meanwhile${stow ? ', and it reloads stowed (switched away)' : ''}`, rounds(e1).length === W.magazine && rl && rd && rd.f - rl.f === R - 1 && during.length >= 1 && e1.states[rd.f].hero.arms.w[auto].ammo === W.magazine && (!stow || (srd && stow.states[srd.f].hero.arms.slot !== auto)), { rounds: rounds(e1).length, reload: rl?.f, reloaded: rd?.f, stowed: srd?.f });
    }
    const burst = find((W) => !W.auto && W.burst > 1);
    if (burst >= 0) {
      const W = WO(burst), per = Math.ceil(FPS / W.burstRof - 1e-9), cd = Math.ceil(W.cooldown * FPS - 1e-9), rel = W.chargeTime > 0 ? 2 : 1;
      const r = armRun(burst, (f) => (f === 1 ? SH : 0), 30 + cd), fs = rounds(r).map((e) => e.f), last = fs.at(-1);
      const again = armRun(burst, tap([1, last + cd]), 60 + cd), af = rounds(again).map((e) => e.f), soon = armRun(burst, tap([1, last + cd - 1]), 60 + cd);
      check(`${id}: a burst: one pull of the ${slots[burst].name} fires ${W.burst} rounds ${per} f apart${W.chargeTime ? ' (on the release: it charges while held)' : ''}, committed, then waits ${W.cooldown} s (a pull a frame sooner is dropped)`, fs.length === W.burst && fs[0] === rel && fs.slice(1).every((x, k) => x - fs[k] === per) && af.length === 2 * W.burst && af[W.burst] === last + cd + rel - 1 && dropped(soon, /cooling/).length === 1, { rounds: fs, next: af[W.burst], want: last + cd + rel - 1 });
    }
    const chg = find((W) => W.chargeTime > 0);
    if (chg >= 0) {
      const W = WO(chg), full = Math.round(W.chargeTime * FPS), r = armRun(chg, (f) => (f >= 1 && f <= full + 5 ? SH : 0), full + 20), c = ev(r, 'w-charged')[0], rd = rounds(r);
      const cost = W.chargedAmmoCost ?? 1, ammo = r.states.at(-1).hero.arms.w[chg].ammo;
      check(`${id}: charge: held ${W.chargeTime} s the ${slots[chg].name} charges (${full} f) and the release fires one charged bolt${W.chargedAmmoCost ? ` for ${cost} rounds` : ''}`, c?.f === 1 + full && rd.length === 1 && rd[0].charged && rd[0].f === full + 6 && ammo === W.magazine - Math.min(cost, W.magazine), { charged: c?.f, round: rd[0] && [rd[0].f, rd[0].charged], ammo });
    }
    const en = find((W) => W.energyMax > 0);
    if (en >= 0) {
      const W = WO(en), cd = Math.ceil(W.cooldown * FPS - 1e-9), every = cd + 2, presses = Array.from({ length: 40 }, (_, k) => 1 + k * every);
      const pad_ = (f) => (W.chargeTime > 0 ? (presses.includes(f) ? SH : 0) : (presses.includes(f) ? SH : 0));
      const n = presses.at(-1) + 700, r = armRun(en, pad_, n), oh = ev(r, 'overheat')[0], un = ev(r, 'unlock')[0], refused = oh && dropped(r, /overheated|out of weapon energy|out of energy/).filter((e) => e.f > oh.f);
      const regen = W.energyOverheatRegen ?? W.energyRegen;
      check(`${id}: energy: the ${slots[en].name}'s pool (${W.energyMax}, ${W.energyCost} a round${W.energyRegen ? `, ${W.energyRegen}/s back` : ', none back'}) empties and overheat-locks, the trigger refused; ${regen > 0 ? `it unlocks when the pool is full again (${regen}/s)` : 'it never comes back'}`, oh && refused.length > 0 && (regen > 0 ? un && Math.abs(un.f - oh.f - Math.ceil((W.energyMax * W.energyUnlockFrac) / regen * FPS)) <= 1 : !un), { overheat: oh?.f, unlock: un?.f, refused: refused?.length });
    }
    const lob = find((W) => W.fireClass === 'lob');
    if (lob >= 0) {
      const W = WO(lob), far = armRun(lob, tap([1]), Math.round(W.fuse * FPS) + 10), b = ev(far, 'blast')[0] ?? null;
      if (W.splashRadius > 0 && b) {
        const at = b.at, near = armRun(lob, tap([1]), Math.round(W.fuse * FPS) + 10, { arena: { half: 400, blocks: [], hero: [0, 0], dummy: [at[0] + Math.min(1, W.splashRadius * 0.5), at[1], 0] } }), nb = ev(near, 'blast')[0];
        check(`${id}: the ${slots[lob].name} is a travelling round (${W.projectileSpeed} m/s, gravity ${W.projectileGravity}): it bursts where it lands and its splash (${W.splashRadius} m) takes a body beside the burst`, nb?.hit && ev(near, 'hit', 'dummy').length === 1, { burst: at, hit: nb?.hit });
      } else if (!W.splashRadius) {
        const lane = { half: 400, blocks: [], hero: [0, 0], dummy: [0, 4] }, r = armRun(lob, tap([1]), 80, { arena: lane }), h = ev(r, 'hit', 'dummy')[0], want = 1 + Math.ceil((4 - util.RADIUS - 0.1 - W.projRadius - util.RADIUS) / (W.projectileSpeed / FPS)) - 1;
        check(`${id}: the ${slots[lob].name} is a straight travelling round (${W.projectileSpeed} m/s): it meets a body when its speed says`, h && Math.abs(h.f - want) <= 1 && h.shot === slots[lob].name, { hit: h?.f, want });
      }
      if (W.proximityRadius > 0) {
        const side = util.RADIUS + W.proximityRadius - 0.1, arena = { half: 400, blocks: [], hero: [0, 0], dummy: [side, 10] }, r = armRun(lob, tap([1]), 60, { arena }), bb = ev(r, 'blast')[0];
        const noFuze = armRun(lob, tap([1]), 60, { arena, card: { ...C, loadout: { ...L, slots: slots.map((sl, i) => (i === lob ? { ...sl, weapon: { ...sl.weapon, proximityRadius: 0 } } : sl)) } } });
        check(`${id}: the ${slots[lob].name}'s proximity fuze: a near miss (${side.toFixed(2)} m off) bursts beside the body and the splash catches it; without the fuze it sails past`, bb?.hit && ev(r, 'hit', 'dummy').length === 1 && !ev(noFuze, 'hit', 'dummy').length, { burst: bb && bb.f, noFuze: ev(noFuze, 'hit', 'dummy').length });
      }
    }
    const sight = find((W) => W.fireClass === 'sight'), area = find((W) => W.fireClass === 'area');
    if (sight >= 0 && area >= 0) {
      const off = { half: 400, blocks: [], hero: [0, 0], dummy: [0.5, 10] }, ahead = { half: 400, blocks: [], hero: [0, 0], dummy: [0, 10] }, wall = { ...ahead, blocks: [{ id: 'c', x: [-2, 2], y: [5, 5.5], h: 3 }] };
      const mode = (i, arena) => rounds(armRun(i, tap([1]), 4, { arena }))[0]?.mode;
      const m = { sightOff: mode(sight, off), areaOff: mode(area, off), sightOn: mode(sight, ahead), cover: mode(area, wall) };
      check(`${id}: hitscan on the fire frame: the ${slots[sight].name} (sight) lands only through the body, the ${slots[area].name} (area) also inside its ${WO(area).assistAngle}° assist ring (a body 0.5 m off at 10 m); cover stops both`, m.sightOff === 'miss' && m.areaOff === 'assist' && m.sightOn === 'core' && m.cover === 'cover', m);
    }
    if (C.jet && C.jet.kind !== 'flap') {
      const i = auto >= 0 ? auto : 0, r = armRun(i, (f) => (f >= 1 && f < 300 ? J : 0) | (f >= 40 && f < 60 ? SH : 0), 120, { gear: 'jet' }), lit = rounds(r).filter((e) => r.states[e.f].hero.jet);
      check(`${id}: shooting while jetpacking: rounds leave and the jetpack stays lit`, lit.length >= 1 && !ev(r, 'jet-end').some((e) => e.why !== 'out of fuel' && e.why !== 'let go'), { rounds: rounds(r).length, whileLit: lit.length, ends: ev(r, 'jet-end').map((e) => e.why) });
    }
    if (C.dodge.kind === 'roll') {
      const r = armRun(auto >= 0 ? auto : 0, (f) => (f === 5 ? DG : 0) | (f === 8 ? SH : 0), 20);
      check(`${id}: the trigger is refused while the body is busy (a roll)`, dropped(r, /in dodge/).length === 1);
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
// ─── the mech: mobile-suit-arena's movement as a mount, heavy (1) to swift (0) ───
{
  const A0 = FEELS.action, mrow = (table.mech = {});
  const mid = mechKnobs(0.5), between = (h, w, m) => m >= Math.min(h, w) - 1e-9 && m <= Math.max(h, w) + 1e-9;
  check('mech: the weight knob blends the presets: at 0.5 each number is halfway (the walk, the boost, the gauge, the gravity)', [['ground', 'walk'], ['boost', 'speed'], ['boost', 'gauge'], ['jump', 'gRise'], ['gait', 'lurch']].every((k) => { const get = (o) => k.reduce((x, y) => x[y], o); return Math.abs(get(mid) - (get(MECH.heavy) + get(MECH.swift)) / 2) < 1e-3 && between(get(MECH.heavy), get(MECH.swift), get(mid)); }), { walk: mid.ground.walk, boost: mid.boost.speed });
  const ride = mechCard(FEELS.platformer, 1), keeps = ['moves', 'hit', 'land', 'loadout', 'hurt', 'life', 'dodge', 'charge', 'guard'].every((k) => JSON.stringify(ride[k]) === JSON.stringify(FEELS.platformer[k]));
  const rideRun = track(run(FEELS.platformer, () => pad(0, 127, 0), 200, { mount: 1 })), top = Math.max(...rideRun.states.map((x) => Math.hypot(x.hero.v[0], x.hero.v[1])));
  check('mech: ridden in another game (the platformer) the card keeps its combat (moves, hits, the stomp, the loadout, what a hit does) and walks as the mech', keeps && Math.abs(top - MECH.heavy.ground.walk) < 1e-9, { keeps, top });
  // the rules overlap rather than make one character: each works alone on an ordinary card
  const R0 = FEELS.realistic, P0 = FEELS.platformer;
  const gaitOnly = track(run({ ...R0, gait: MECH.heavy.gait }, () => pad(0, 127, 0), 300)), ffs = ev(gaitOnly, 'footfall');
  const chargeOnly = track(run({ ...P0, chargeJump: MECH.heavy.chargeJump }, (f) => (f >= 5 && f < 200 ? J : 0), 300)), launched = ev(chargeOnly, 'launch')[0];
  const boostOnly = track(run({ ...A0, boost: MECH.swift.boost, dash: null }, (f) => pad(0, 127, f >= 10 && f < 40 ? DS : 0), 60)), bOnly = boostOnly.states[20].hero;
  const landOnly = track(run({ ...R0, landing: MECH.heavy.landing }, () => 0, 80, { setup: (S) => { S.hero.p[2] = 2; S.hero.grounded = false; S.hero.from = 2; } }));
  check('mech: the rules overlap, each alone on an ordinary card: realistic with only the heavy gait steps in footfalls; the platformer with only the charge jump squats and launches; action with only the boost thrusts on the ground (no hover); realistic with only the heavy landing lags', ffs.length > 5 && gaitOnly.states[0].card.ground.run === R0.ground.run && launched?.frac === 1 && Math.abs(Math.hypot(bOnly.v[0], bOnly.v[1]) - MECH.swift.boost.speed) < 1e-9 && bOnly.p[2] === 0 && ev(landOnly, 'land')[0] && landOnly.states[ev(landOnly, 'land')[0].f].hero.lag > 0, { footfalls: ffs.length, launch: launched?.frac, boost: +Math.hypot(bOnly.v[0], bOnly.v[1]).toFixed(2), lag: landOnly.states[ev(landOnly, 'land')[0]?.f]?.hero.lag });
  for (const [label, w] of [['heavy', 1], ['swift', 0]]) {
    const K = mechKnobs(w), BO = K.boost, KG = K.ground, GT = K.gait, HV = K.hover, max = BO.gauge * FPS, mrun = (pads, n, o = {}) => track(run(A0, pads, n, { arena: o.arena ?? OPEN, mount: w, gear: o.gear ?? null, setup: o.setup, mid: o.mid, guard: false }));
    const speed = (x) => Math.hypot(x.hero.v[0], x.hero.v[1]);
    mrow[label] = `walk ${KG.walk} · boost ${BO.speed} m/s · gauge ${BO.gauge} s · hover ${HV.height} m${K.chargeJump ? ` · charge ${K.chargeJump.max} s` : ''}${K.quickBoost ? ` · quick boost ${K.quickBoost.speed} m/s` : ''}`;
    // the walk: its acceleration, the heavy gait's dip at each footfall, a footfall each step
    const walk = mrun(() => pad(0, 127, 0), 400), t90 = walk.states.findIndex((x) => speed(x) >= 0.9 * KG.walk) + 1, want90 = Math.ceil((0.9 * KG.walk) / KG.accel * FPS);
    const late = walk.states.slice(200), ratio = late.slice(1).map((x, k) => (x.hero.p[1] - late[k].hero.p[1]) / (KG.walk * DT_)), ff = ev(walk, 'footfall').filter((e) => e.f > 200).map((e) => e.f), gap = ff.slice(1).map((x, k) => x - ff[k]), stepF = (GT.stride / KG.walk) * FPS;
    check(`mech ${label}: the walk builds to ${KG.walk} m/s on its acceleration (${KG.accel} m/s²); the gait dips to ${(1 - GT.lurch).toFixed(2)}/${(1 - GT.lurch / 2).toFixed(2)} of the walk at each footfall, a footfall every ${(GT.stride / KG.walk).toFixed(2)} s`, Math.abs(t90 - want90) <= 1 && Math.abs(Math.min(...ratio) - (1 - GT.lurch) / (1 - GT.lurch / 2)) < 0.02 && gap.every((g) => Math.abs(g - stepF) <= 1), { t90, want90, dip: +Math.min(...ratio).toFixed(3), gap: [Math.min(...gap), Math.max(...gap)], stepF: +stepF.toFixed(2) });
    // the boost: instant, on the hover cushion, draining a frame a frame; released, the skid
    // (a frame with a quick boost bursts first: the press is the quick boost, the hold the boost after it)
    const B0 = 10, B1 = 50, qf = K.quickBoost ? K.quickBoost.frames : 0, b0 = B0 + qf, bo = mrun((f) => pad(0, 127, f >= B0 && f < B1 ? DS : 0), 120), bs = bo.states, n = Math.round(BO.inertia * FPS);
    const skidOk = [3, 6].every((j) => Math.abs(speed(bs[B1 + j]) - BO.speed * (n - 1 - j) / n) < 1e-6), spent = (K.quickBoost ? K.quickBoost.cost * FPS : 0) + (B1 - b0);
    check(`mech ${label}: the boost is instant (${BO.speed} m/s ${K.quickBoost ? 'once the quick boost\'s burst is out' : 'on the press'}), held on a ${HV.height} m hover cushion (never landing), draining its gauge a frame a frame; let go, it skids out over ${BO.inertia} s`, Math.abs(speed(bs[b0]) - BO.speed) < 1e-9 && bs.slice(b0 + 4, B1).every((x) => Math.abs(x.hero.p[2] - HV.height) < 1e-9 && !x.hero.grounded) && !ev(bo, 'land').some((e) => e.f > B0 && e.f < B1) && Math.abs(bs[B1 - 1].hero.boostG - (max - spent)) < 1e-6 && skidOk, { first: speed(bs[b0]), z: bs[B1 - 1].hero.p[2], gauge: [bs[B1 - 1].hero.boostG, max - spent], skid: [3, 6].map((j) => +speed(bs[B1 + j]).toFixed(3)) });
    // run dry: the overheat lock, refused, unlocking when full after overheatRegen
    const dry = mrun((f) => pad(0, 127, (f >= 5 && f < 5 + max + 5 ? DS : 0) | (f === 5 + max + 20 ? DS : 0)), max + BO.overheatRegen * FPS + 60), oh = ev(dry, 'boost-overheat')[0], un = ev(dry, 'boost-unlock')[0];
    check(`mech ${label}: thrust dry (${BO.gauge} s) the gauge overheat-locks; a press then is refused; it unlocks when full again, ${BO.overheatRegen} s on`, oh && un && Math.abs(un.f - oh.f - BO.overheatRegen * FPS) <= 1 && ev(dry, 'dropped').some((e) => e.button === 'dash' && /overheated/.test(e.why)), { overheat: oh?.f, unlock: un?.f, want: oh && oh.f + BO.overheatRegen * FPS });
    const vec = mrun((f) => pad(f >= 30 ? 127 : 0, f >= 30 ? 0 : 127, f >= 10 && f < 50 ? DS : 0), 60), turn = ev(vec, 'boost-turn')[0];
    check(`mech ${label}: turning the thrust past 45° bites ${BO.turnCost} s of gauge (MSA's vectoring); the thrusters cold, it refills (${BO.regen} s to full)`, turn?.f === 30 && Math.abs(vec.states[29].hero.boostG - vec.states[30].hero.boostG - (1 + BO.turnCost * FPS)) < 1e-6 && Math.abs(vec.states[55].hero.boostG - vec.states[54].hero.boostG - max / (BO.regen * FPS)) < 1e-6, { turn: turn?.f });
    const catchR = mrun((f) => (f >= 1 && f < 200 ? DS : 0), 260, { setup: (S) => { S.hero.p[2] = 3; S.hero.grounded = false; } }), lands = ev(catchR, 'land');
    check(`mech ${label}: falling while boosting it is caught on the cushion and held (no landing); let go, it lands`, catchR.states[150].hero.hovering && Math.abs(catchR.states[150].hero.p[2] - HV.height) < 1e-9 && lands.length >= 1 && lands.every((e) => e.f >= 200), { z: catchR.states[150].hero.p[2], lands: lands.map((e) => e.f) });
    // the landing: lag by the fall, a jump in it waits
    const H0 = 2, drop = mrun(() => 0, 120, { setup: (S) => { S.hero.p[2] = H0; S.hero.grounded = false; S.hero.from = H0; } }), ld = ev(drop, 'land')[0], lagWant = Math.min(K.landing.max, Math.round(K.landing.per * ld.fall));
    const dropJ = mrun((f) => (f === ld.f + 1 ? J : 0), 120, { setup: (S) => { S.hero.p[2] = H0; S.hero.grounded = false; S.hero.from = H0; } });
    check(`mech ${label}: a landing lags by its fall (${K.landing.per} f a m/s, ${K.landing.max} f at most): from ${H0} m ${lagWant} f, a jump pressed in it waits`, drop.states[ld.f].hero.lag === Math.max(0, lagWant - 1) && (lagWant === 0 || ev(dropJ, 'buffered').concat(ev(dropJ, 'dropped')).some((e) => e.button === 'jump' && /landing lag/.test(e.why))), { fall: ld.fall, lag: drop.states[ld.f].hero.lag + 1, want: lagWant });
    // boost armor: a hit while boosting keeps a share of its stun
    const HU = A0.hurt, arm = mrun((f) => pad(0, 127, f >= 10 ? DS : 0), 40, { mid: (S, f) => { if (f === 20) { const H = S.hero, p = [H.p[0], H.p[1] + 1.2, H.p[2] + 1.1]; S.foes.push({ id: 1, name: 'orb', f: 0, life: 60, size: 0.25, g: 0, b: p.slice(), p, v: [0, -9, 0] }); } } }), hh = ev(arm, 'hurt')[0];
    check(`mech ${label}: boost armor: a hit while boosting keeps ×${K.armor} of its stun`, hh?.maneuver && hh.stun === Math.round(HU.stun * K.armor), { stun: hh?.stun, want: Math.round(HU.stun * K.armor) });
    const dg = mrun((f) => (f === 5 ? DG : 0), 20);
    check(`mech ${label}: the dodge ${BO.dodgeOverheat ? 'dumps the gauge and overheats it (MSA\'s acrobatic dodge)' : 'leaves the gauge alone'}`, BO.dodgeOverheat ? dg.states[5].hero.boostLock && ev(dg, 'boost-overheat').some((e) => e.by === 'dodge') : !ev(dg, 'boost-overheat').length && dg.states[5].hero.boostG === max, { lock: dg.states[5].hero.boostLock });
    if (K.chargeJump) {
      const CH = K.chargeJump, full = Math.round(CH.max * FPS), apexOf = (r) => ev(r, 'apex')[0]?.height, Hj = (K.jump.speed ** 2) / (2 * K.jump.gRise);
      const tapJ = mrun((f) => (f === 5 ? J : 0), 200), fullJ = mrun((f) => pad(0, f > 5 ? 127 : 0, f >= 5 && f < 5 + full + 30 ? J : 0), 300), lt = ev(tapJ, 'launch')[0], lf = ev(fullJ, 'launch')[0];
      const rooted = fullJ.states.slice(10, 5 + full).every((x) => speed(x) < 1e-9), vT = 0.6 + (CH.mult - 0.6) * lt.frac;
      check(`mech ${label}: the stop-and-charge jump: held it roots in a squat; a tap launches at 0.6 (×0.36 the height), the full ${CH.max} s charge auto-launches at ${CH.mult} (×${(CH.mult ** 2).toFixed(2)}) and leaps along the stick at ${CH.dash} m/s`, rooted && lf.f === 5 + full && lf.frac === 1 && Math.abs(apexOf(tapJ) - Hj * vT * vT) < 2e-3 && Math.abs(apexOf(fullJ) - Hj * CH.mult * CH.mult) < 2e-3 && Math.abs(speed(fullJ.states[lf.f + 2]) - CH.dash) < 1e-6, { tap: [apexOf(tapJ), +(Hj * vT * vT).toFixed(4)], full: [apexOf(fullJ), +(Hj * CH.mult ** 2).toFixed(4)], leap: +speed(fullJ.states[lf.f + 2]).toFixed(3) });
    }
    if (K.quickBoost) {
      const Q = K.quickBoost, q = mrun((f) => pad(127, 0, f === 10 || f === 14 ? DS : 0), 60), qb = ev(q, 'quick-boost');
      check(`mech ${label}: the quick boost: a press bursts ${Q.frames} f at ${Q.speed} m/s for ${Q.cost} s of gauge; another press while it cools is refused`, qb.length === 1 && q.states.slice(10, 10 + Q.frames).every((x) => Math.abs(speed(x) - Q.speed) < 1e-9) && Math.abs(q.states[10].hero.boostG - (max - Q.cost * FPS)) < 1e-6 && ev(q, 'dropped').some((e) => e.button === 'dash' && /cooling/.test(e.why)), { bursts: qb.length, gauge: q.states[10].hero.boostG });
    }
        const jet = mrun((f) => (f >= 1 && f < 400 ? J : 0), 420, { gear: 'jet' }), glide = mrun(() => J, 120, { gear: 'glide', setup: (S) => { S.hero.p[2] = 20; S.hero.grounded = false; S.hero.from = 20; } });
    check(`mech ${label}: the gear rides along: the jetpack lights and the glider opens`, ev(jet, 'jet').length >= 1 && ev(glide, 'glide').length >= 1, { jet: ev(jet, 'jet').length, glide: ev(glide, 'glide').length });
  }
}

// ─── the poles: game templates, each a base feel, its fields, a viewer and a stage ───
{
  const prow = (table.poles = {});
  const bad = POLE_IDS.filter((id) => { const P = POLES[id], c = poleCard(id);
    const setOk = Object.entries(P.set ?? {}).every(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v).every(([k2, v2]) => typeof v2 === 'object' || JSON.stringify(c[k]?.[k2]) === JSON.stringify(v2)) : JSON.stringify(c[k]) === JSON.stringify(v)));
    const kept = P.set?.moves ? true : JSON.stringify(c.moves) === JSON.stringify(FEELS[P.base].moves);
    return !(FEELS[P.base] && VIEWS.includes(P.view.camera) && STAGES[P.stage] && Array.isArray(P.needs) && setOk && kept && (P.mount == null || c.boost));
  });
  POLE_IDS.forEach((id) => { prow[id] = `${POLES[id].base} · ${POLES[id].view.camera} · ${POLES[id].stage}${POLES[id].mount != null ? ' · mech' : ''}${POLES[id].gear ? ` · ${POLES[id].gear}` : ''}`; });
  check('poles: every pole names a base feel, a viewer and a stage that exist and what it still needs; its card is the base with its fields merged over (the rest kept: its moves), a mech mounted where it says', !bad.length, { bad });
  // played on its stage: one pole a procedure (plain fields merged over, a mech mounted, the 2D rail)
  const plain = POLE_IDS.find((id) => POLES[id].mount == null && !POLES[id].set?.lane), mounted = POLE_IDS.find((id) => POLES[id].mount != null), railed = POLE_IDS.find((id) => POLES[id].set?.lane?.face);   // (the fighter's rail faces the foe; a platformer's only holds the line)
  const script = (f) => [Math.round(127 * Math.sin(f / 29)), Math.round(127 * Math.cos(f / 37)), ((f % 41) < 6 ? J : 0) | ((f % 17) === 0 ? AT : 0) | ((f % 73) === 9 ? DG : 0) | ((f % 97) > 60 ? DS : 0)];
  const playPole = (id) => track(run(poleCard(id), script, 500, { arena: STAGES[POLES[id].stage], gear: POLES[id].gear ?? null }));
  const hash = (r) => createHash('sha256').update(JSON.stringify(r.states.map((x) => [x.hero.p, x.dummy.p, x.events]))).digest('hex');
  const plays = [plain, mounted, railed].map((id) => { const a = playPole(id), b = playPole(id); return { id, same: hash(a) === hash(b), breach: a.breach, moved: Math.hypot(a.end.hero.p[0] - STAGES[POLES[id].stage].hero[0], a.end.hero.p[1] - STAGES[POLES[id].stage].hero[1]) > 0.5, r: a }; });
  check(`poles: ${plays.map((p) => POLES[p.id].name).join(', ')} play a scripted pad on their own stages, the same twice, no body through a wall`, plays.every((p) => p.same && !p.breach && p.moved), plays.map((p) => [p.id, p.same, !!p.breach, p.moved]));
  const rail = plays[2].r, onLine = rail.states.every((x) => x.hero.p[0] === POLES[railed].set.lane.x && x.dummy.p[0] === POLES[railed].set.lane.x), facing = rail.states.filter((x) => !x.hero.act).every((x) => Math.abs(util.angDiff(x.hero.yaw, util.bearing(x))) < 1e-9);
  check(`poles: ${POLES[railed].name}'s rail holds both bodies on its line, the hero facing its foe`, onLine && facing, { onLine, facing });
  // between two poles: the numbers blended, the rest from the nearer
  const [pa, pb] = [plain, POLE_IDS.find((id) => id !== plain && POLES[id].base !== POLES[plain].base && POLES[id].mount == null)], A = poleCard(pa), B = poleCard(pb);
  const b0 = blendPoles(pa, pb, 0), b1 = blendPoles(pa, pb, 1), bh = blendPoles(pa, pb, 0.5), b4 = blendPoles(pa, pb, 0.4);
  check(`poles: between ${POLES[pa].name} and ${POLES[pb].name} every number blends (the run, the jump's height, its gravity), the rest from the nearer pole (the hit's stun model)`, b0.ground.run === A.ground.run && b1.ground.run === B.ground.run && Math.abs(bh.ground.run - (A.ground.run + B.ground.run) / 2) < 1e-3 && Math.abs(bh.jump.height - (A.jump.height + B.jump.height) / 2) < 1e-3 && b4.hit.stun.model === A.hit.stun.model && bh.hit.stun.model === B.hit.stun.model, { run: [A.ground.run, bh.ground.run, B.ground.run], stun: [b4.hit.stun.model, bh.hit.stun.model] });
}

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
  const r = run(FEELS[fx.feel] ? { ...FEELS[fx.feel], ...(fx.card ?? {}) } : FEELS.action, (f) => fx.pads[f] ?? [0, 0, 0], fx.pads.length, { arena: fx.arena ?? ARENA, spar: fx.spar, guard: fx.guard ?? true, dummyHeight: fx.dummyHeight, shooter: fx.shooter ?? null, gear: fx.gear ?? null, mount: fx.mount ?? null, who: fx.cast && fx.cast !== cast ? T.bodyOf(T.rigOf(fx.cast)) : body });   // a recorded run plays in the page's arena
  const got = r.events.filter((e) => fx.expect?.types?.includes(e.type)).map((e) => `${e.f}:${e.who}:${e.type}`);
  check(`fixture ${file}: ${fx.says ?? ''}`, !fx.expect?.events || JSON.stringify(got) === JSON.stringify(fx.expect.events), got.slice(0, 6));
}

console.log('\nthe feels, measured'); console.table(table);
for (const id of FEEL_IDS) { console.log(`frame data: ${id}`); console.table(frameData(FEELS[id], body)); }
note('the body (the character\'s half)', body);
console.log(fails ? `\n${fails} failed` : '\nall held (machine gate; the eyes gate is open: run lab.mjs and play)');
process.exitCode = fails ? 1 : 0;
