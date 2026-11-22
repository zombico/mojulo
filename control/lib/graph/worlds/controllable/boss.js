/**
 * THE BOSS DIRECTOR — a boss fight played (lib/graph/boss/: its patterns, its gimmick's moves and phases, a vehicle's
 * parts and states). A body whose rule carries `boss` is directed here, the pilot its target:
 *
 *   a human boss  (rule.boss.kind 'human', its mind a boss's: rank and phases, mind.js) fights as its mind fights between
 *                 its moves; every `tempo` seconds of its phase it takes one of the phase's moves by weight, and while the
 *                 move's tell and hazards run it is planted, facing the aim (its rule held for the step), a charge carried
 *                 down its lane; in the move's OPENING it stands winded and takes half again what lands on it. Crossing a
 *                 phase (the mind's own crossing, `mindPhase`) runs the phase's arena EVENT: `burn` (fires along the
 *                 arena's rim), `relocate` (to the next of its `perches`), `tear` (a piece of cover gone: of its `cover`
 *                 ([{ id, min, max }]) the one nearest the pilot, its collider and its body), `live` (the floor's grid fired on its own between its moves), `adds`
 *                 (its dormant crew woken); a phase's `figure` (a look's) swapped onto its body. A move that VENTS holds it
 *                 on through its opening turned away from the aim. Its COUNTERS (`counters`, a `part`): rounds or bursts
 *                 landing on it from where the part shows while it is bare, counted to the part's hits; at its hits it
 *                 breaks (a reel, a share of its health, its own fire, its moves shortened); a `flash`, a stun bursting
 *                 in front of its eyes while a move holds its eye to a scope, blinds it where it stands, taking `mult` times
 *   a vehicle     (rule.boss.kind 'vehicle'; its rule's type its own, so nothing else drives it) is driven by its STATE:
 *                 along its `route` (a loop of points), on its `runs` (flown end to end at its state's altitude, then a
 *                 hover at the end), stranded where it stands; its moves by its state's weights and tempo, a run's strafe
 *                 laid down the run through the pilot. What hits it is judged by PART after the step: its health given
 *                 back and taken again as each hit counts (a round or a burst, where it landed in the vehicle's own frame;
 *                 a mine under it, mines.js): a plate counts its hits and breaks, a part behind it is then there to hit,
 *                 a weak spot takes the hit `mult` times, a part `shown` only in its state. Its state moves on when its
 *                 parts are broken (`broken`, all or `any`), its run is flown (`flown`), or after its seconds (`after`)
 *
 * HAZARDS: each move laid (boss/patterns.js, through E.layPattern) into state.bossHazards; every step each live hazard
 * lands on the bodies of another team inside it, once each, unless the body is invincible (a dive through it), crouched
 * or lying under a `low` one, or behind cover from its origin (a `cover` one: sightBlocked). A hazard that `track`s is
 * laid again through the pilot until its time, then held. What it takes is its `harm` of the body's health.
 *
 * E.bossHit(state, vehicle, kind, at, dmg) judges a hit a module lands itself. state.bossHazards (the page draws them: their marks from `tm`, their landings), state.bosses ({ <id>: { name, phase,
 * phases, state, broken, open } } the HUD's bar). Invisible mode (ghost.js) starts no move. Import-free; the pattern
 * functions come from bossLib (compose.js lists it before this). Emitted only into a page whose world has a boss.
 */
export function buildBoss(E) {
  const step = E.stepWorld;
  const HELD = 'boss-held';
  // a small seeded dice a boss's own: the seed, then each move it took
  const dice = (seed, n) => { let a = (seed * 2654435761 + n * 40503) | 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (w, u) => { const ks = Object.keys(w || {}); let sum = 0; for (const k of ks) sum += w[k]; let x = u * sum; for (const k of ks) { x -= w[k]; if (x <= 0) return k; } return ks[ks.length - 1] || null; };
  const alive = (e) => e && !e.gone && !e.downed && e.body && !(Number.isFinite(e.body.hp) && e.body.hp <= 0);
  const hostile = (a, b) => a !== b && !(a.team && b.team && a.team === b.team);

  function lay(state, e, S, id, target, t) {
    const B = e.rule.boss, P = B.moves[id];
    if (!P) return;
    const p = e.transform.pos;
    // (the frame it is laid in, kept to lay it again through the pilot while it tracks: a run's strafe walks down the
    // run, through the pilot, laid from a step behind it along the run's way; every other move from the boss)
    const d = B.kind === 'vehicle' && S.run && P.hazards.some((h) => h.shape === 'strafe') ? S.run.dir.slice() : null;
    const frame = (tg) => (d ? [[tg[0] - d[0], tg[1] - d[1]], [tg[0], tg[1]]] : [[e.transform.pos[0], e.transform.pos[1]], [tg[0], tg[1]]]);
    const H = E.layPattern(P, ...frame(target), t);
    const look = B.look || {};
    S.count = (S.count || 0) + 1;
    const z = (target[2] != null ? target[2] : p[2]) - ((state.pilotId && state.byId[state.pilotId] && state.byId[state.pilotId].rule && state.byId[state.pilotId].rule.eye) || 0);
    H.forEach((h, k) => state.bossHazards.push({ ...h, z, id: `${e.id}:${S.count}:${k}`, by: e.id, move: id, k, ...(look.hazard ? { colour: look.hazard } : {}), ...(look.tell ? { tellColour: look.tell } : {}) }));
    const end = Math.max(...H.map((h) => h.t1)) - t;
    S.cur = { id, t0: t, frame, aim: Math.atan2(target[1] - p[1], target[0] - p[0]), start: [p[0], p[1]], openAt: t + Math.max(P.open.at, end), openEnd: t + Math.max(P.open.at, end) + P.open.for, charge: P.pattern === 'charge' ? H[0] : null, vent: !!P.vent, scope: !!P.scope };
  }

  // a phase's arena event, as the crossing runs it
  function event(state, e, kind) {
    const A = (e.rule.boss && e.rule.boss.arena) || {}, t = state.time, pilot = state.pilotId ? state.byId[state.pilotId] : null;
    if (kind === 'burn' && A.center && A.r) {
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; state.bossHazards.push({ shape: 'disc', c: [A.center[0] + Math.cos(a) * A.r * 0.82, A.center[1] + Math.sin(a) * A.r * 0.82], r: 2.4, z: A.z || 0, t0: t + 1.2, t1: t + 40, tm: t, harm: 0.08, id: `${e.id}:burn:${k}`, by: e.id, move: 'burn', colour: (e.rule.boss.look || {}).hazard, lasting: true }); }
    } else if (kind === 'relocate' && Array.isArray(A.perches) && A.perches.length) {
      // (on from the perch it stands at: the nearest, the first time)
      const S = e.bossS, p0 = e.transform.pos;
      if (S.perch == null) S.perch = A.perches.map((q, k) => [k, Math.hypot(q[0] - p0[0], q[1] - p0[1])]).sort((x, y) => x[1] - y[1])[0][0];
      const q = A.perches[(S.perch = (S.perch + 1) % A.perches.length)];
      e.transform.pos[0] = q[0]; e.transform.pos[1] = q[1]; if (q[2] != null) e.transform.pos[2] = q[2];
      if (e.rule.guardAt) e.rule.guardAt = [q[0], q[1]];
    } else if (kind === 'tear' && Array.isArray(A.cover) && state.colliders && pilot) {
      // (the piece of its cover nearest the pilot (`cover`: [{ id, min, max }], its box and the body it is): torn away,
      // its collider and its body gone)
      const same = (c, q) => [0, 1, 2].every((k) => Math.abs(c.min[k] - q.min[k]) < 1e-6 && Math.abs(c.max[k] - q.max[k]) < 1e-6);
      const left = A.cover.filter((q) => !(e.bossS.torn || []).includes(q.id) && state.colliders.some((c) => same(c, q)));
      const mid = (q) => Math.hypot((q.min[0] + q.max[0]) / 2 - pilot.transform.pos[0], (q.min[1] + q.max[1]) / 2 - pilot.transform.pos[1]);
      const pick = left.sort((a, b) => mid(a) - mid(b))[0], near = pick ? { id: pick.id, c: pick } : null;
      if (near) {
        state.colliders = state.colliders.filter((c) => !same(c, near.c));
        (e.bossS.torn = e.bossS.torn || []).push(near.id);
        const body = state.byId[near.id]; if (body) body.gone = true;
        if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: [(near.c.min[0] + near.c.max[0]) / 2, (near.c.min[1] + near.c.max[1]) / 2, near.c.max[2] / 2], t, radius: 2.5 });
      }
    } else if (kind === 'live') e.bossS.live = true;
    else if (kind === 'adds' && Array.isArray(A.adds)) for (const id of A.adds) { const a = state.byId[id]; if (a) a.dormant = false; }
  }

  // COUNTERS (a human boss's `counters`, boss/bosses.js): a PART of its own, bare only `when` (`vent`: the opening of a
  // move that turns it away; `open`: any opening; `always`) and only `from` where it shows (`behind`), counts the rounds
  // (or the bursts) that land on the boss so; at its `hits` it breaks: the boss reels `stagger` seconds where it stands,
  // loses `harm` of its health, its pending landings are called off, it goes up in its own fire (a disc round it), and each
  // move in `shorten` reaches a share as far from then on. state.bosses[id].counters says each: { hits, of, bare, broken }
  function counters(state, e, S, t0, t) {
    const B = e.rule.boss, p = e.transform.pos, h = e.transform.heading || 0, C = S.cur;
    S.parts = S.parts || {};
    for (const c of B.counters) {
      if (c.kind === 'flash') { flash(state, e, S, c, t0, t); continue; }
      if (c.kind !== 'part' || S.broken[c.id]) continue;
      const bare = c.when === 'always' || (C && t0 >= C.openAt && t0 < C.openEnd && (c.when === 'open' || C.vent));
      S.bare = S.bare || {}; S.bare[c.id] = !!bare;
      if (!bare) continue;
      const behind = (q) => c.from !== 'behind' || (q[0] - p[0]) * Math.cos(h) + (q[1] - p[1]) * Math.sin(h) < 0;
      let n = 0;
      if (c.takes.includes('round')) for (const s of state.entities) if (s !== e && s.lastShot && s.lastShot.targetId === e.id && s.lastShot.t === t0 && behind(s.transform.pos)) n++;
      if (c.takes.includes('explosive')) for (const b of state.bursts || []) if (b.t === t0 && !b.effect && b.by !== e.id && Math.hypot(b.pos[0] - p[0], b.pos[1] - p[1]) < 1.6 && behind(b.pos)) n++;
      if (!n) continue;
      S.parts[c.id] = (S.parts[c.id] || 0) + n;
      if (S.parts[c.id] < c.hits) continue;
      // IT BREAKS
      const K = c.breaks || {}, max = e.hpMax || e.body.hp;
      S.broken[c.id] = true;
      if (K.harm) e.body.hp = Math.max(0, e.body.hp - K.harm * max);
      if (K.stagger) { S.reel = t + K.stagger; e.reactClip = 'stagger'; e.staggerT = 0; e.reactDur = K.stagger; }
      state.bossHazards = state.bossHazards.filter((x) => !(x.by === e.id && x.t0 > t));
      S.cur = null; S.next = t + (K.stagger || 0) + 0.6;
      if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: [p[0] - Math.cos(h) * 0.3, p[1] - Math.sin(h) * 0.3, p[2] + 1.3], t, radius: 2.6 });
      state.bossHazards.push({ shape: 'disc', c: [p[0], p[1]], r: 2.2, z: p[2], t0: t + 0.15, t1: t + Math.max(1, K.stagger || 1), tm: t, harm: 0.1, id: `${e.id}:${c.id}:rupture`, by: e.id, move: c.id, colour: (B.look || {}).hazard });
      for (const [m, f] of Object.entries(K.shorten || {})) { const M = B.moves[m]; if (M) M.hazards = M.hazards.map((x) => ({ ...x, ...(x.reach ? { reach: x.reach * f } : {}), ...(x.shape === 'ring' ? { to: x.to * f } : {}) })); }
      S.said = { text: K.says || '', t };
    }
  }

  // A FLASH (Glint's glint): a stun bursting within its `within` of the boss's eyes, in front of it, with a clear line to
  // them, while its eye is at a scope (a move that holds one, through its tell and its shot): blinded `blind` seconds where
  // it stands, its landings called off, taking `mult` times what lands on it till it sees again
  function flash(state, e, S, c, t0, t) {
    const p = e.transform.pos, h = e.transform.heading || 0, C = S.cur, K = c.breaks || {};
    const locked = !!(C && C.scope && t0 < C.openAt);
    S.bare = S.bare || {}; S.bare[c.id] = locked;
    if (!locked) return;
    const eye = [p[0], p[1], p[2] + 1.6];
    for (const b of state.bursts || []) {
      if (b.t !== t0 || b.effect !== 'stun') continue;
      const q = [b.pos[0], b.pos[1], b.pos[2] + 0.3];
      if (c.from === 'front' && (q[0] - p[0]) * Math.cos(h) + (q[1] - p[1]) * Math.sin(h) <= 0) continue;
      if (Math.hypot(q[0] - eye[0], q[1] - eye[1], q[2] - eye[2]) > (c.within || b.radius || 4)) continue;
      if (state.colliders && E.sightBlocked && E.sightBlocked(q, eye, state.colliders)) continue;
      S.parts = S.parts || {}; S.parts[c.id] = (S.parts[c.id] || 0) + 1;
      S.blind = t + (K.blind || 3); S.blindMult = K.mult || 1; S.reel = S.blind;
      e.reactClip = 'stagger'; e.staggerT = 0; e.reactDur = K.blind || 3;
      state.bossHazards = state.bossHazards.filter((x) => !(x.by === e.id && x.t0 > t));
      S.cur = null; S.next = S.blind + 0.6; S.said = { text: K.says || '', t };
      return;
    }
  }

  // VEHICLES: where a hit landed, in the vehicle's own frame, and the part it lands on (the box it is in, else the nearest)
  const local = (e, q) => { const p = e.transform.pos, h = e.transform.heading || 0, dx = q[0] - p[0], dy = q[1] - p[1]; return [dx * Math.cos(h) + dy * Math.sin(h), -dx * Math.sin(h) + dy * Math.cos(h), q[2] - p[2]]; };
  const boxGap = (b, q) => Math.hypot(Math.max(b[0][0] - q[0], 0, q[0] - b[1][0]), Math.max(b[0][1] - q[1], 0, q[1] - b[1][1]), Math.max(b[0][2] - q[2], 0, q[2] - b[1][2]));
  function partHitV(B, S, part, kind) {
    const p = B.parts[part];
    if (!p || S.broken[part] || !p.takes.includes(kind)) return null;
    if (p.behind && !S.broken[p.behind]) return null;
    if (p.shown && p.shown !== S.state) return null;
    return p;
  }
  function judge(state, e, S, kind, q, dmg) {
    const B = e.rule.boss, L = local(e, q);
    // (the part it lands on that takes it: of the parts it could take it, the nearest to where it landed, within reach)
    // (on a tie, the smaller part: a grille in the hull's face takes the hit, not the hull)
    const vol = (b) => (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]) * (b[1][2] - b[0][2]);
    const cand = Object.keys(B.parts).map((id) => ({ id, p: partHitV(B, S, id, kind), d: boxGap(B.parts[id].box, L), v: vol(B.parts[id].box) })).filter((x) => x.p && x.d <= (kind === 'round' ? 0.6 : 2.2)).sort((a, b) => a.d - b.d || a.v - b.v);
    const c = cand[0];
    if (!c) return;
    if (c.p.hits > 0) { S.hits[c.id] = (S.hits[c.id] || 0) + 1; if (S.hits[c.id] >= c.p.hits) { S.broken[c.id] = true; if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: q.slice(), t: state.time, radius: 2.2 }); } }
    if (c.p.weak) e.body.hp = Math.max(0, e.body.hp - dmg * (c.p.mult ?? 1));
  }

  // a hit of `kind` (round | explosive | mine) landing at a point on a vehicle boss, judged by part (as the step judges
  // what hit it): for a module that lands one of its own, and for a test
  E.bossHit = (state, e, kind, at, dmg) => { if (e && e.bossS && e.rule && e.rule.boss && e.rule.boss.kind === 'vehicle') judge(state, e, e.bossS, kind, at, dmg || 0); };

  function driveVehicle(state, e, S, dt) {
    const B = e.rule.boss, st = B.states[S.state] || {}, p = e.transform.pos, t = state.time;
    const toward = (q, speed) => { const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy); if (d < 1e-6) return 0; const s = Math.min(d, speed * dt); p[0] += (dx / d) * s; p[1] += (dy / d) * s; e.transform.heading = Math.atan2(dy, dx); return d - s; };
    if (Array.isArray(B.runs) && B.runs.length === 2) {
      const z = st.altitude != null ? st.altitude : p[2];
      p[2] += (z - p[2]) * Math.min(1, dt * 1.5);
      if (S.state === (B.runState || 'run')) {
        if (!S.run) { const from = S.end ?? 0, to = 1 - from, a = B.runs[from], b = B.runs[to], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; S.run = { to, dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], strafed: false }; }
        if (toward(B.runs[S.run.to], B.speed) <= 0.5) { S.end = S.run.to; S.run = null; S.flown = true; }
      } else {
        // (hovering at its end: turned onto the pilot)
        const pl = state.pilotId ? state.byId[state.pilotId] : null;
        if (pl) e.transform.heading = Math.atan2(pl.transform.pos[1] - p[1], pl.transform.pos[0] - p[0]);
      }
      return;
    }
    if (st.route && Array.isArray(B.route) && B.route.length > 1) {
      S.leg = S.leg ?? 0;
      const q = B.route[(S.leg + 1) % B.route.length], speed = B.speed * (st.slow || 1);
      const dx = q[0] - p[0], dy = q[1] - p[1], want = Math.atan2(dy, dx), h0 = e.transform.heading || 0, dh = Math.atan2(Math.sin(want - h0), Math.cos(want - h0));
      // (a heavy thing turns before it goes: its heading toward the leg, then forward)
      e.transform.heading = h0 + Math.sign(dh) * Math.min(Math.abs(dh), (B.turn || 0.8) * dt);
      if (Math.abs(dh) < 0.35) { const d = Math.hypot(dx, dy), s = Math.min(d, speed * dt); p[0] += Math.cos(e.transform.heading) * s; p[1] += Math.sin(e.transform.heading) * s; if (d < 1.2) S.leg = (S.leg + 1) % B.route.length; }
    } else {
      const pl = state.pilotId ? state.byId[state.pilotId] : null;
      if (pl) { const want = Math.atan2(pl.transform.pos[1] - p[1], pl.transform.pos[0] - p[0]), h0 = e.transform.heading || 0, dh = Math.atan2(Math.sin(want - h0), Math.cos(want - h0)); e.transform.heading = h0 + Math.sign(dh) * Math.min(Math.abs(dh), 0.6 * dt); }
    }
  }

  E.createWorld = (function (make) {
    return function createWithBoss(spec) {
      const s = make(spec);
      if (s.entities.some((e) => e.rule && e.rule.boss)) { s.bossHazards = []; s.bosses = {}; s.mineBlasts = s.mineBlasts || []; }
      return s;
    };
  })(E.createWorld);

  E.stepWorld = function stepWithBoss(state, input, dt, hooks) {
    if (!state.bossHazards) return step(state, input, dt, hooks);
    const t0 = state.time, held = [], hp0 = new Map();
    for (const e of state.entities) {
      const B = e.rule && e.rule.boss;
      if (!B) continue;
      if (!e.bossS) { e.bossS = { phase: 0, state: B.start || (B.states ? Object.keys(B.states)[0] : null), stateT: 0, next: t0 + (B.first ?? 2), cur: null, broken: {}, hits: {}, count: 0 }; e.hpMax = e.hpMax || e.body.hp; }
      hp0.set(e, e.body.hp);
      // (a human boss in its move's tell and hazards: planted, facing the aim, its rule held for the step; a move that
      // VENTS holds it on through its opening, turned away, its back to the aim; reeling from a broken counter, planted)
      const C = e.bossS.cur, vents = C && C.vent && t0 >= C.openAt && t0 < C.openEnd;
      if (B.kind === 'human' && ((C && (t0 < C.openAt || vents)) || (e.bossS.reel != null && t0 < e.bossS.reel))) {
        held.push([e, e.rule.type]); e.rule.type = HELD; e.aiFire = false;
        if (C && !(e.bossS.reel != null && t0 < e.bossS.reel)) e.transform.heading = vents ? C.aim + Math.PI : C.aim;
      }
    }
    let out;
    try { out = step(state, input, dt, hooks); } finally { for (const [e, ty] of held) e.rule.type = ty; }
    const t = state.time, pilot = state.pilotId ? state.byId[state.pilotId] : null, quiet = E.ghostOn ? E.ghostOn(pilot) : false;
    for (const e of state.entities) {
      const B = e.rule && e.rule.boss, S = e.bossS;
      if (!B || !S) continue;
      if (!alive(e)) { if (!S.down) { S.down = true; e.downed = true; if (state.bursts && B.kind === 'vehicle') state.bursts.push({ seq: state.burstSeq++, pos: e.transform.pos.slice(), t, radius: 6 }); } state.bosses[e.id] = { name: B.name, down: true }; continue; }
      const H0 = hp0.get(e);
      if (B.kind === 'human') {
        // the phase its mind is in (mind.js crosses them); a crossing runs the phase's event
        const ph = Math.min((B.phases || []).length - 1, e.mindPhase == null ? 0 : e.mindPhase + 1);
        if (ph !== S.phase) { S.phase = ph; const P2 = B.phases[ph] || {}; if (P2.event) event(state, e, P2.event); if (P2.figure) e.body.figure = P2.figure; }
        if (B.counters) counters(state, e, S, t0, t);
        // (blinded, it takes `mult` times what lands on it)
        if (S.blind != null && t0 < S.blind && e.body.hp < H0 && S.blindMult > 1) e.body.hp = Math.max(0, e.body.hp - (H0 - e.body.hp) * (S.blindMult - 1));
        // (in its opening it stands winded and takes half again)
        if (S.cur && t0 >= S.cur.openAt && t0 < S.cur.openEnd && e.body.hp < H0) e.body.hp = Math.max(0, e.body.hp - (H0 - e.body.hp) * 0.5);
        if (S.cur && S.cur.charge) {
          // (a charge carries it down its lane through its time)
          const h = S.cur.charge, u = Math.max(0, Math.min(1, (t - h.t0) / (h.t1 - h.t0)));
          if (t >= h.t0) { e.transform.pos[0] = h.a[0] + (h.b[0] - h.a[0]) * u; e.transform.pos[1] = h.a[1] + (h.b[1] - h.a[1]) * u; }
        }
      } else {
        // VEHICLE: what hit it, judged by part (its health given back first); the mines under it
        if (e.body.hp < H0) {
          const lost = H0 - e.body.hp; e.body.hp = H0;
          const causes = [];
          for (const s of state.entities) if (s.lastShot && s.lastShot.targetId === e.id && s.lastShot.t === t0 && s.lastShot.to) causes.push(['round', s.lastShot.to]);
          for (const b of state.bursts || []) if (b.t === t0 && !b.effect && Math.hypot(b.pos[0] - e.transform.pos[0], b.pos[1] - e.transform.pos[1]) < Math.max(...B.size) + (b.radius || 0)) causes.push(['explosive', b.pos]);
          for (const [kind, q] of causes) judge(state, e, S, kind, q, lost / causes.length);
        }
        for (const m of state.mineBlasts || []) if (m.by === e.id && m.t === t0) judge(state, e, S, 'mine', m.at, 0);
        // its state moves on: parts broken, a run flown, seconds out
        const st = B.states[S.state] || {};
        S.stateT += dt;
        for (const [to, c] of Object.entries(st.to || {})) {
          const go = c.broken ? (c.any ? c.broken.some((q) => S.broken[q]) : c.broken.every((q) => S.broken[q])) : c.flown ? !!S.flown : c.after ? S.stateT >= c.after : false;
          if (go) { S.state = to; S.stateT = 0; S.flown = false; S.cur = null; S.next = t + 1; break; }
        }
        driveVehicle(state, e, S, dt);
      }
      // ITS MOVES: the phase's (or the state's) by weight, at its tempo; none while unseen, none mid-shift
      const table = B.kind === 'human' ? (B.phases[S.phase] || B.phases[0]) : (B.states[S.state] || {});
      if (S.cur && t >= S.cur.openEnd) { S.cur = null; S.next = t + (table.tempo || 2); }
      const onRun = B.kind === 'vehicle' && S.run;
      if (!S.cur && !quiet && pilot && alive(pilot) && t >= S.next && !(e.phaseShiftT > 0) && (!onRun || !S.run.strafed)) {
        const id = pick(table.moves, dice(B.seed || 1, S.count + 1));
        if (id) { lay(state, e, S, id, pilot.transform.pos, t); if (onRun) S.run.strafed = true; }
      }
      // (a live floor fires its grid on its own between the moves)
      if (S.live && B.moves['live-floor'] && pilot && !quiet && !S.cur && (S.liveNext == null || t >= S.liveNext)) { S.liveNext = t + 5; const keep = S.cur; lay(state, e, S, 'live-floor', pilot.transform.pos, t); S.cur = keep; }
      // tracking hazards follow the pilot until they hold
      if (S.cur && pilot) for (const h of state.bossHazards) if (h.by === e.id && h.track != null && t < h.track && h.t0 > t) {
        const P = B.moves[h.move], R = E.layPattern(P, ...S.cur.frame(pilot.transform.pos), S.cur.t0)[h.k];
        Object.assign(h, { a: R.a, b: R.b, ...(R.o ? { o: R.o } : {}) });
      }
      state.bosses[e.id] = { name: B.name, title: B.title || '', ...(B.counters ? { counters: Object.fromEntries(B.counters.map((c) => [c.id, { hits: (S.parts || {})[c.id] || 0, of: c.hits, bare: !!(S.bare || {})[c.id], broken: !!S.broken[c.id], ...(c.kind === 'flash' ? { blind: S.blind != null && t < S.blind } : {}) }])), ...(S.said ? { said: S.said } : {}) } : {}), phase: S.phase, phases: (B.phases || []).length, state: S.state, broken: Object.keys(S.broken), open: !!(S.cur && t >= S.cur.openAt && t < S.cur.openEnd), hp: e.body.hp, hpMax: e.hpMax };
    }
    // THE HAZARDS LAND: on each body of another team inside one, once a hazard, unless it is through, under or behind cover
    for (const h of state.bossHazards) {
      if (t < h.t0 || t > h.t1) continue;
      const by = state.byId[h.by];
      for (const b of state.entities) {
        if (!b.body || !b.body.hittable || b.isCamera || !alive(b) || b === by || (by && !hostile(by, b)) || (b.rule && b.rule.boss)) continue;
        const q = b.transform.pos;
        if ((h.hit || (h.hit = {}))[b.id] || !E.hazardHit(h, q[0], q[1], t)) continue;
        if (b.invincible) continue;
        if (h.low && (b.crouched || b.prone)) continue;
        if (h.cover && h.o && state.colliders && E.sightBlocked([h.o[0], h.o[1], (by ? by.transform.pos[2] : q[2]) + 1.3], [q[0], q[1], q[2] + 1], state.colliders)) continue;
        h.hit[b.id] = true;
        const max = b.hpMax || b.body.hpMax || 100;
        b.body.hp = Math.max(0, b.body.hp - h.harm * max);
        b.hitFlash = t; b.lastHitBy = h.by; b.lastHitDmg = h.harm * max;
      }
    }
    state.bossHazards = state.bossHazards.filter((h) => t <= h.t1 + 0.4);
    return out;
  };
}

/** The pattern functions the director lays and tests hazards with (boss/patterns.js), their own source the page runs. */
export function buildBossLibFrom(layPattern, hazardHit) {
  return Function(`return function buildBossLib(E) { E.layPattern = ${layPattern.toString()}; E.hazardHit = ${hazardHit.toString()}; }`)();
}
