/**
 * THE BOSS DIRECTOR — a boss fight played (lib/graph/boss/: its patterns, its gimmick's moves and phases, a vehicle's
 * parts and states). A body whose rule carries `boss` is directed here, the pilot its target:
 *
 *   a boss kept to its ROOM (rule.boss.room, [y0, y1, z0, z1]: a castle's boss on its lane) takes no move while the pilot
 *                 is out of it, its first `first` seconds after the pilot comes in, and stands on its room's floor (the
 *                 height it stood at, `bossS.floor`) unless a flight takes it up
 *   a human boss  (rule.boss.kind 'human', its mind a boss's: rank and phases, mind.js) fights as its mind fights between
 *                 its moves; every `tempo` seconds of its phase it takes one of the phase's moves by weight, and while the
 *                 move's tell and hazards run it is planted, facing the aim (its rule held for the step), a charge carried
 *                 down its lane, a FLIGHT (a pattern's `flies`) flown along its path off the floor and down again, under
 *                 its room's ceiling and its `sky` (metres of air over its floor: a side view's frame) (e.aloft its height
 *                 over its floor while it flies); in the move's OPENING it stands winded and takes half again what lands on it. Crossing a
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
 *                 A BEAST OF HEADS (the hydra, boss/vehicles.js): a state that is a part's TURN (`head`) is passed over
 *                 once that part is broken; a part `open` is struck only in its move's opening; a part in an ORDER struck
 *                 ahead of its place counts nothing and the boss RETORTS (its `retort` laid at once); a blade's BLOW (a
 *                 striker whose swing landed on it this step) is judged by part where it reaches, as a round is;
 *                 state.bosses[id].next the part to strike next
 *
 *   a mecha     a vehicle of the mecha shelf (`frame`: boss/vehicles.js) has its figure played by its state: its form
 *               (`form`: 'tank' its wheels), a state's own `clip` through the state (its reload `loops` times, its fold
 *               once), its walk and its drive by the ground they cover (`stride`). A part reached only `from` where it
 *               faces (`behind`, or its own `side`) counts what lands from there; a round on it is judged along the shot's
 *               line through its boxes. A state's seconds `slower` for each of its `slower.parts` broken (its reload)
 *   a carrier   (rule.boss.carrier, boss/vehicles.js) fights through what it carries: its GUNNERS (bodies of their own,
 *               `rule.bossCrew`, carried at their places) each lay a burst on the pilot in its arc and in sight (cover
 *               as a burst's: the line from the gun to the chest and the head), or on a hacked drone near it; a gunner is
 *               a person, down for good once killed or knocked out. Its DRONES (`rule.bossDrone`) are endless, launched
 *               from its bays, shot down and reprinted: a hunter patrols round it and drops a grenade on a pilot it sees
 *               (a disc marked from above: a roof is cover); a courier laps round it and goes home. The RF gun (a slot
 *               whose weapon says `jam`) held on a courier hacks it: it fetches the nearest of the carrier's `packages`,
 *               carries it home to a door whose gunner is down (else the nearer) and goes off inside: an explosive hit on
 *               the part there (its hangar). From the delivery after `chase.after`, its hunters chase a hacked courier
 *               and shoot it; shot down, its package is lost and comes back after `restock` s. state.bossFx { tracers }
 *               and state.bosses[id].carrier (its gunners, its drones, its deliveries, the hack) are the page's
 *
 * HAZARDS: each move laid (boss/patterns.js, through E.layPattern) into state.bossHazards; every step each live hazard
 * lands on the bodies of another team inside it, once each, unless the body is invincible (a dive through it), crouched
 * or lying under a `low` one, over one that says how high it reaches (`rise`: its feet higher, a jump clearing it), or
 * behind cover from its origin (a `cover` one: sightBlocked). A hazard that `track`s is
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
    // (one that says how high it reaches rises from the boss's own floor: a body already in the air is no ground for it)
    const zb = p[2] - ((e.rule && e.rule.eye) || 0);
    H.forEach((h, k) => state.bossHazards.push({ ...h, z: h.rise != null ? zb : z, id: `${e.id}:${S.count}:${k}`, by: e.id, move: id, k, ...(look.hazard ? { colour: look.hazard } : {}), ...(look.tell ? { tellColour: look.tell } : {}) }));
    const end = Math.max(...H.map((h) => h.t1)) - t;
    // (when it lands, its first hazard's landing, and its pattern: the page's wind-up and strike, boss-view)
    S.cur = { id, t0: t, land: Math.min(...H.map((h) => h.t0)), pattern: P.pattern || null, frame, aim: Math.atan2(target[1] - p[1], target[0] - p[0]), start: [p[0], p[1]], openAt: t + Math.max(P.open.at, end), openEnd: t + Math.max(P.open.at, end) + P.open.for, charge: !P.flies && (P.pattern === 'charge' || P.carries) ? H[0] : null, vent: !!P.vent, scope: !!P.scope, fly: P.flies ? flight(e, P.flies, target) : null };
  }

  // A FLIGHT (a pattern's `flies`: [[s, x, z], …], boss/patterns.js): its path laid in the move's frame, from where the boss
  // stands down the aim, over its floor; held under its room's ceiling (`room`'s top, the boss's height under it) and in
  // its SKY (`sky`: the metres of air over its floor it may fly in, a side view's frame) by lowering the whole path, never
  // cutting it
  function flight(e, keys, target) {
    const p = e.transform.pos, B = e.rule.boss, dx = target[0] - p[0], dy = target[1] - p[1], d = Math.hypot(dx, dy) || 1;
    const z0 = p[2] - ((e.rule && e.rule.eye) || 0), H = (e.rule && e.rule.collideHeight) || 2, top = Math.max(...keys.map((q) => q[2]));
    const room = Math.min(B.room ? Math.max(0, B.room[3] - z0 - H - 0.2) : Infinity, Number.isFinite(B.sky) ? Math.max(0, B.sky) : Infinity), k = top > room ? room / top : 1;
    return { o: [p[0], p[1]], f: [dx / d, dy / d], z0, eye: p[2] - z0, top: top * k, keys: keys.map((q) => [q[0], q[1], q[2] * k]) };
  }
  // where a flight has the boss at u seconds into its move: a Catmull-Rom through its keys, never under its floor nor over
  // its path's top (the curve's overshoot)
  function flownAt(F, u) {
    const K = F.keys; if (u >= K[K.length - 1][0]) return [K[K.length - 1][1], K[K.length - 1][2]];
    let i = 0; while (i < K.length - 2 && u > K[i + 1][0]) i++;
    const P0 = K[Math.max(0, i - 1)], P1 = K[i], P2 = K[i + 1], P3 = K[Math.min(K.length - 1, i + 2)], s = Math.max(0, Math.min(1, (u - P1[0]) / (P2[0] - P1[0] || 1)));
    const cr = (j) => 0.5 * (2 * P1[j] + (-P0[j] + P2[j]) * s + (2 * P0[j] - 5 * P1[j] + 4 * P2[j] - P3[j]) * s * s + (-P0[j] + 3 * P1[j] - 3 * P2[j] + P3[j]) * s * s * s);
    return [cr(1), Math.max(0, Math.min(F.top, cr(2)))];
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
  // (a part `from` where it faces: behind the vehicle, or off its own side, within its arc)
  function faces(e, p, src) {
    if (!p.from || !src) return true;
    const L = local(e, src), arc = ((p.arc ?? 70) * Math.PI) / 180;
    if (p.from === 'behind') return Math.abs(Math.atan2(L[1], -L[0])) <= arc;
    const sg = p.side === 'right' ? -1 : 1;
    return Math.abs(Math.atan2(L[0], sg * L[1])) <= arc;
  }
  function partHitV(B, S, part, kind) {
    const p = B.parts[part];
    if (!p || S.broken[part] || !p.takes.includes(kind)) return null;
    if (p.behind && !S.broken[p.behind]) return null;
    if (p.shown && ![].concat(p.shown).includes(S.state)) return null;
    // (a part struck only in its OPENING, `open`: the state's move laid and opened; a part in an ORDER struck before the
    // parts ahead of it are broken is WRONG: it counts nothing, and the boss retorts)
    if (p.open && !(S.cur && S.now >= S.cur.openAt && S.now <= S.cur.openEnd)) return null;
    if (p.order != null && Object.keys(B.parts).some((q) => B.parts[q].order != null && B.parts[q].order < p.order && !S.broken[q])) return { ...p, wrong: true };
    return p;
  }
  // the next part of its ORDER to break, or null (the HUD's: a hydra's head to strike next)
  const nextInOrder = (B, S) => { let best = null; for (const q of Object.keys(B.parts)) { const o = B.parts[q].order; if (o != null && !S.broken[q] && (best == null || o < B.parts[best].order)) best = q; } return best; };
  // a TURN skipped once its part is broken (a state's `head`): on by its own way after seconds, past each such
  function turnPast(B, S, to) {
    let s = to;
    for (let k = 0; k < Object.keys(B.states).length && B.states[s] && B.states[s].head && S.broken[B.states[s].head]; k++) {
      const nx = Object.keys(B.states[s].to || {}).find((x) => B.states[s].to[x].after);
      if (!nx) break; s = nx;
    }
    return s;
  }
  // (where a shot's line enters a part's box, as a share of its length, in the vehicle's frame; null where it misses)
  function rayBox(a, b, box) {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const d = b[k] - a[k];
      if (Math.abs(d) < 1e-9) { if (a[k] < box[0][k] || a[k] > box[1][k]) return null; continue; }
      let u = (box[0][k] - a[k]) / d, v = (box[1][k] - a[k]) / d;
      if (u > v) { const w = u; u = v; v = w; }
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
      if (t0 > t1) return null;
    }
    return t0;
  }
  function judge(state, e, S, kind, q, dmg, src) {
    const B = e.rule.boss, L = local(e, q);
    // (a mecha's round: judged along the shot's line through its parts' boxes, the first it enters that takes it from
    // where it was fired: a tall machine's parts lie inside the shape a round first meets)
    if (kind === 'round' && B.frame && src) {
      const a = local(e, src), far = [q[0] + (q[0] - src[0]) * 2, q[1] + (q[1] - src[1]) * 2, q[2] + (q[2] - src[2]) * 2], b = local(e, far);
      const hit = Object.keys(B.parts).map((id) => ({ id, p: partHitV(B, S, id, kind), t: rayBox(a, b, B.parts[id].box) })).filter((x) => x.p && x.t != null && faces(e, x.p, src)).sort((x, y) => x.t - y.t)[0];
      if (hit) { count(state, e, S, hit.id, hit.p, q, dmg); return; }
    }
    // (the part it lands on that takes it: of the parts it could take it, the nearest to where it landed, within reach)
    // (on a tie, the smaller part: a grille in the hull's face takes the hit, not the hull)
    const vol = (b) => (b[1][0] - b[0][0]) * (b[1][1] - b[0][1]) * (b[1][2] - b[0][2]);
    const cand = Object.keys(B.parts).map((id) => ({ id, p: partHitV(B, S, id, kind), d: boxGap(B.parts[id].box, L), v: vol(B.parts[id].box) })).filter((x) => x.p && x.d <= (kind === 'round' ? 0.6 : 2.2) && faces(e, x.p, src || q)).sort((a, b) => a.d - b.d || a.v - b.v);
    const c = cand[0];
    if (!c) return;
    count(state, e, S, c.id, c.p, q, dmg);
  }
  function count(state, e, S, id, p, q, dmg) {
    // (struck out of its order: nothing counts, and it RETORTS, once an opening: its retort laid at once over its move)
    if (p.wrong) {
      const B = e.rule.boss, pl = state.pilotId ? state.byId[state.pilotId] : null;
      if (B.retort && B.moves[B.retort] && pl && (S.retortT == null || state.time - S.retortT > 1.5)) { S.retortT = state.time; S.wrong = { id, t: state.time }; lay(state, e, S, B.retort, pl.transform.pos, state.time); }
      return;
    }
    if (p.hits > 0) { S.hits[id] = (S.hits[id] || 0) + 1; if (S.hits[id] >= p.hits) { S.broken[id] = true; if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: q.slice(), t: state.time, radius: 2.2 }); } }
    if (p.weak) e.body.hp = Math.max(0, e.body.hp - dmg * (p.mult ?? 1));
    S.lastPart = { id, t: state.time };
  }

  // a hit of `kind` (round | explosive | mine) landing at a point on a vehicle boss, judged by part (as the step judges
  // what hit it): for a module that lands one of its own, and for a test
  // (`from`: where it was fired from, for a part reached only from where it faces)
  E.bossHit = (state, e, kind, at, dmg, from) => { if (e && e.bossS && e.rule && e.rule.boss && e.rule.boss.kind === 'vehicle') judge(state, e, e.bossS, kind, at, dmg || 0, from); };

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
      // (one that holds its ground and its heading, `turn: false`: a carrier whose sides are what a fight goes round)
      const pl = state.pilotId ? state.byId[state.pilotId] : null;
      if (pl && st.turn !== false) { const want = Math.atan2(pl.transform.pos[1] - p[1], pl.transform.pos[0] - p[0]), h0 = e.transform.heading || 0, dh = Math.atan2(Math.sin(want - h0), Math.cos(want - h0)); e.transform.heading = h0 + Math.sign(dh) * Math.min(Math.abs(dh), 0.6 * dt); }
    }
  }

  // a state's seconds: its own, slower for each of its `slower.parts` broken
  function afterOf(S, c) { const W = c.slower; if (!W) return c.after; let n = 0; for (const q of W.parts || []) if (S.broken[q]) n++; return c.after * (1 + n * (W.by ?? 1)); }

  // A MECHA'S BODY: its form, its walk or its drive by the ground covered, a state's own clip through it
  function playFrame(e, S, B, moved) {
    const st = B.states[S.state] || {}, St = B.stride || {};
    const nxt = Object.values(st.to || {}).find((c) => c.after); S.stateFor = nxt ? afterOf(S, nxt) : null;
    e.form = st.form || 'walker';
    if (st.clip) {
      const u = S.stateFor ? S.stateT / S.stateFor : 0;
      e.moving = true; e.locomotion = st.clip; e.gaitPhase = Math.min(0.999, st.loops ? (u * st.loops) % 1 : u);
      if (st.clip.indexOf('transform:') === 0) e.transformT = e.gaitPhase;
      return;
    }
    e.transformT = null;
    e.moving = moved > 1e-4; e.locomotion = 'forward';
    if (e.moving) e.gaitPhase = (e.gaitPhase || 0) + moved / Math.max(0.5, (e.form === 'tank' ? St.tank : St.walker) || 4);
  }

  // ── A CARRIER ─────────────────────────────────────────────────────────────────────────────────────────────────
  const onBody = (e, a) => { const p = e.transform.pos, h = e.transform.heading || 0, c = Math.cos(h), s = Math.sin(h); return [p[0] + c * a[0] - s * a[1], p[1] + s * a[0] + c * a[1], p[2] + a[2]]; };
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const heightOf = (p) => (p.rule && Number.isFinite(p.rule.collideHeight) ? p.rule.collideHeight : 1.7);
  const hashU = (id, n) => { const str = String(id) + ':' + n; let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const groundAt = (hooks, x, y, z) => { const g = hooks && hooks.ground ? hooks.ground([x, y, z + 3]) : null; return Number.isFinite(g) ? g : z; };
  // (the share of a body a gun sees: its chest and its head, each a clear line)
  function openTo(state, from, p) { const q = p.transform.pos, h = heightOf(p); let n = 0; for (const z of [0.55, 0.9]) if (!E.sightBlocked(from, [q[0], q[1], q[2] + h * z], state.colliders)) n++; return n / 2; }
  function fly(d, to, speed, dt) {
    const q = d.transform.pos, v = [to[0] - q[0], to[1] - q[1], to[2] - q[2]], L = Math.hypot(v[0], v[1], v[2]), st = Math.min(L, speed * dt);
    if (L > 1e-6) { for (let k = 0; k < 3; k++) q[k] += (v[k] / L) * st; if (Math.hypot(v[0], v[1]) > 0.05) d.transform.heading = Math.atan2(v[1], v[0]); }
    return L - st;
  }
  const tracer = (state, from, to) => { const F = state.bossFx || (state.bossFx = { tracers: [] }); F.tracers.push({ from: from.slice(), to: to.slice(), t: state.time }); if (F.tracers.length > 40) F.tracers.splice(0, F.tracers.length - 40); };
  const sayC = (C, state, text, on) => { C.said = { text, t: state.time, on }; };
  function carrierInit(state, e, S, B) {
    const K = B.carrier, C = S.carrier = { deliveries: 0, courierT: 0, jam: { id: null, u: 0 }, aim: {}, fire: {}, said: null };
    C.crew = state.entities.filter((x) => x.rule && x.rule.bossCrew && x.rule.bossCrew.boss === e.id).map((x) => ({ ent: x, cfg: K.crew.find((c) => c.id === x.rule.bossCrew.crew), down: false }));
    C.drones = state.entities.filter((x) => x.rule && x.rule.bossDrone && x.rule.bossDrone.boss === e.id);
    C.drones.forEach((d, i) => { d.drone = { role: d.rule.bossDrone.role, bay: K.bays[d.rule.bossDrone.bay % K.bays.length], phase: i * 1.7, st: 'dock', t: 0, reprint: i * 0.6, team0: d.team }; d.gone = true; d.body.hittable = false; d.alarmFound = true; d.hpMax = d.hpMax || d.body.hp; });
    C.pkgs = Object.fromEntries((K.packages || []).map((k) => [k.id, { id: k.id, at: k.at.slice(), pos: k.at.slice(), carried: null, back: 0 }]));
  }
  function carrierFacts(S) {
    const C = S.carrier;
    return { deliveries: C.deliveries, jam: { id: C.jam.id, u: Math.round(C.jam.u * 100) / 100, on: !!C.jam.on }, said: C.said,
      crew: Object.fromEntries(C.crew.map((c) => [c.cfg.id, { up: !c.down, name: c.cfg.name, ent: c.ent.id, aim: C.aim[c.cfg.id] || 0 }])),
      drones: Object.fromEntries(C.drones.map((d) => [d.id, { role: d.drone.role, st: d.drone.st, hacked: !!d.drone.hacked, chase: !!d.drone.chase, pkg: d.drone.pkg }])),
      packages: Object.fromEntries(Object.values(C.pkgs).map((k) => [k.id, { at: k.pos, carried: k.carried, ready: !k.carried && state0T(k) }])) };
  }
  let nowT = 0;
  const state0T = (k) => nowT >= k.back;
  // its gunners carried and firing
  function placeCrew(e, C) {
    for (const c of C.crew) {
      const B = c.ent, at = onBody(e, c.cfg.at);
      B.transform.pos[0] = at[0]; B.transform.pos[1] = at[1]; B.transform.pos[2] = at[2]; B.vel = [0, 0, 0];
      if (!B.ko && !c.down) B.transform.heading = wrapA((e.transform.heading || 0) + ((c.cfg.face || 0) * Math.PI) / 180 + (C.aim[c.cfg.id] || 0));
    }
  }
  function stepCrew(state, e, S, K, C, p, dt) {
    const F = K.fire || {}, t = state.time, hacked = C.drones.find((d) => d.drone.hacked && !d.gone);
    for (const c of C.crew) {
      const B = c.ent;
      if (!c.down && (B.ko || B.downed || (Number.isFinite(B.body.hp) && B.body.hp <= 0))) { c.down = true; sayC(C, state, `${c.cfg.name} is down: that side is open`, 'boss:crew'); }
      if (c.down) { B.aiFire = 0; continue; }
      const gun = [B.transform.pos[0], B.transform.pos[1], B.transform.pos[2] + 1.4], face = (e.transform.heading || 0) + ((c.cfg.face || 0) * Math.PI) / 180, arc = ((c.cfg.arc ?? 70) * Math.PI) / 180, range = F.range ?? 45;
      const sees = (q) => Math.abs(wrapA(Math.atan2(q[1] - gun[1], q[0] - gun[0]) - face)) <= arc && dist3(gun, q) <= range && !E.sightBlocked(gun, q, state.colliders);
      const tgtD = hacked && dist3(gun, hacked.transform.pos) < range * 0.6 && sees(hacked.transform.pos) ? hacked : null;
      const chest = p ? [p.transform.pos[0], p.transform.pos[1], p.transform.pos[2] + heightOf(p) * 0.6] : null;
      const tgt = tgtD ? tgtD.transform.pos : chest && sees(chest) ? chest : null;
      const R = C.fire[c.cfg.id] || (C.fire[c.cfg.id] = { lay: 0, cool: 0 });
      R.cool = Math.max(0, R.cool - dt);
      if (!tgt) { R.lay = Math.max(0, R.lay - dt); B.aiFire = 0; continue; }
      C.aim[c.cfg.id] = wrapA(Math.atan2(tgt[1] - gun[1], tgt[0] - gun[0]) - face);
      R.lay += dt; B.aiFire = 1;
      if (R.lay < (F.lay ?? 1.2) || R.cool > 0) continue;
      R.cool = F.every ?? 3; R.lay = 0;
      for (let k = 0; k < (F.burst ?? 4); k++) { const j = (hashU(c.cfg.id, Math.floor(t * 10) + k) - 0.5) * 1.6; tracer(state, gun, [tgt[0] + j, tgt[1] - j, tgt[2] + j * 0.4]); }
      B.lastShot = { mode: 'core', t, from: gun, to: tgt.slice() };
      if (tgtD) { tgtD.body.hp = Math.max(0, tgtD.body.hp - (F.harm ?? 0.1) * 150); tgtD.hitFlash = t; }
      else if (p && alive(p)) {
        const dmg = (F.harm ?? 0.1) * (p.hpMax || 100) * openTo(state, gun, p);
        if (dmg > 0.5) { p.body.hp = Math.max(0, p.body.hp - dmg); p.hitFlash = t; p.lastHitBy = B.id; p.lastHitDmg = dmg; C.pilotHurtT = t; }
      }
    }
  }
  // its drones
  function dock(e, C, d, down) {
    const D = d.drone;
    D.st = 'dock'; D.t = 0; D.hacked = false; D.pkg = null; D.chase = false; D.out = false; D.inbound = false;
    d.gone = true; d.body.hittable = false; d.team = D.team0; d.downed = false; d.ko = null; d.held = false;
    if (down) D.reprint = C.K.drones.reprint ?? 20;
    d.transform.pos = onBody(e, D.bay);
  }
  function launchDrone(e, d) {
    const D = d.drone;
    D.st = 'launch'; D.t = 0; D.out = true; D.reprint = 0;
    d.gone = false; d.downed = false; d.body.hp = d.hpMax; d.body.hittable = true;
    d.transform.pos = onBody(e, D.bay);
  }
  function shotDown(state, e, S, d) {
    const C = S.carrier, D = d.drone;
    if (D.pkg) { const K = C.pkgs[D.pkg]; if (K) { K.carried = null; K.back = state.time + (C.K.restock ?? 8); } }
    if (D.hacked) sayC(C, state, 'the hacked drone is down: its package is lost. Wait for another courier', 'boss:hack-lost');
    D.st = 'fall'; D.t = 0; D.vz = 0; d.body.hittable = false; D.hacked = false; D.chase = false; D.pkg = null;
    if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: d.transform.pos.slice(), t: state.time, radius: 1.2 });
  }
  function stepHack(state, e, S, K, C, p, input, dt) {
    const H = K.hack || {}, t = state.time;
    const lo = p && Array.isArray(p.rule.loadout) ? p.rule.loadout[p.loadoutIdx || 0] : null, rf = !!(lo && lo.weapon && lo.weapon.jam) && !!p.weapon;
    const L = p && p.lastShot, onIt = rf && input && input.fire && L && t - L.t < (H.slip ?? 0.3) ? state.byId[L.targetId] : null;
    const tg = onIt && onIt.drone && onIt.drone.out && !onIt.drone.hacked && onIt.drone.st !== 'fall' ? onIt : null;
    if (tg && tg.drone.role === 'courier') {
      if (C.jam.id !== tg.id) C.jam = { id: tg.id, u: 0 };
      const shaken = C.pilotHurtT != null && t - C.pilotHurtT < 0.5;
      C.jam.u = Math.min(1, C.jam.u + (shaken ? -dt * 0.5 : dt / (H.secs ?? 2))); C.jam.on = true;
      if (C.jam.u >= 1) {
        const D = tg.drone; D.hacked = true; D.st = 'fetch'; D.t = 0; D.pkg = null; D.inbound = false; tg.team = p.team || 'hero'; tg.body.hittable = false;
        C.jam = { id: null, u: 0 }; C.chaseSaid = false;
        sayC(C, state, C.deliveries >= ((K.drones.chase || {}).after ?? 1) ? 'hacked: it goes for a package. Keep its chasers off it' : 'hacked: it goes for a package, then home "for repair"', 'boss:hack');
      }
      return;
    }
    C.jam.on = false; C.jam.u = Math.max(0, C.jam.u - dt * (H.decay ?? 0.3));
    if (tg && (!C.said || C.said.on !== 'boss:hardened' || t - C.said.t > 4)) sayC(C, state, 'its link is hardened: only a courier (green light) can be jammed', 'boss:hardened');
  }
  function stepHacked(state, e, S, K, C, d, dt) {
    const D = d.drone, t = state.time, speed = (K.drones.courier.speed ?? 6) * 1.2, alt = e.transform.pos[2] + (K.drones.alt ?? 7);
    if (D.st === 'fetch') {
      let P = D.pkg ? C.pkgs[D.pkg] : null;
      if (!P) { let best = Infinity; for (const k in C.pkgs) { const x = C.pkgs[k]; if (x.carried || t < x.back) continue; const dd = dist3(x.at, d.transform.pos); if (dd < best) { best = dd; P = x; } } if (P) D.pkg = P.id; }
      if (!P) { fly(d, [d.transform.pos[0], d.transform.pos[1], alt], speed, dt); return; }
      if (Math.hypot(P.at[0] - d.transform.pos[0], P.at[1] - d.transform.pos[1]) > 1) fly(d, [P.at[0], P.at[1], alt], speed, dt);
      else if (fly(d, [P.at[0], P.at[1], P.at[2] + 1.3], speed * 0.4, dt) < 0.2) { D.st = 'pick'; D.t = 0; }
      return;
    }
    if (D.st === 'pick') {
      if (D.t >= 1.4) {
        C.pkgs[D.pkg].carried = d.id; D.st = 'carry'; D.t = 0; sayC(C, state, 'it has the package: it goes home for repair', 'boss:carry');
        const open = Object.keys(K.doors).filter((sd) => !C.crew.some((c) => c.cfg.door === sd && !c.down)), doors = open.length ? open : Object.keys(K.doors);
        D.door = doors.reduce((a, b) => (dist3(onBody(e, K.doors[a]), d.transform.pos) <= dist3(onBody(e, K.doors[b]), d.transform.pos) ? a : b));
      }
      return;
    }
    if (D.st === 'carry') {
      const dr = K.doors[D.door], at = onBody(e, dr), out = onBody(e, [dr[0], dr[1] + Math.sign(dr[1] || 1) * 7, dr[2]]);
      if (!D.inbound) { if (fly(d, [out[0], out[1], Math.max(at[2], alt - 1)], speed, dt) < 0.8) D.inbound = true; }
      else if (fly(d, at, speed * 0.7, dt) < 0.4) {
        // IN THE DOOR: it goes off, an explosive hit on what is there
        const P = C.pkgs[D.pkg]; if (P) { P.carried = null; P.back = t + (K.restock ?? 8); }
        C.deliveries++;
        if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: at.slice(), t, radius: (K.delivery || {}).r ?? 4 });
        judge(state, e, S, 'explosive', at, (K.delivery || {}).harm ?? 110, at);
        sayC(C, state, `delivered: it went off in its hangar (${C.deliveries})`, 'boss:delivery');
        dock(e, C, d, true);
        for (const x of C.drones) x.drone.chase = false;
      }
    }
  }
  function carrier(state, e, S, B, dt, input, hooks) {
    const K = B.carrier;
    if (!S.carrier) carrierInit(state, e, S, B);
    const C = S.carrier; C.K = K; nowT = state.time;
    const t = state.time, pilot = state.pilotId ? state.byId[state.pilotId] : null, p = pilot && alive(pilot) ? pilot : null, home = e.transform.pos;
    placeCrew(e, C);
    if (!S.down) { stepCrew(state, e, S, K, C, p, dt); stepHack(state, e, S, K, C, p, input, dt); }
    const D0 = K.drones, Hn = D0.hunter || {}, Q = D0.courier || {}, Ch = D0.chase || {}, alt = home[2] + (D0.alt ?? 7), live = (d) => d.drone.out && d.drone.st !== 'fall';
    for (const d of C.drones) {
      // (a dart in a drone does nothing; out of health it falls)
      if (d.ko || d.koDrowse) { d.ko = null; d.koDrowse = null; d.koStun = 0; d.held = false; if (d.downed && d.body.hp > 0) d.downed = false; }
      if (live(d) && (d.downed || d.body.hp <= 0)) shotDown(state, e, S, d);
    }
    const couriers = C.drones.filter((d) => d.drone.role === 'courier'), hunters = C.drones.filter((d) => d.drone.role === 'hunter');
    if (!S.down) {
      C.courierT += dt;
      if (!couriers.some(live) && C.courierT >= (Q.every ?? 12)) { const d = couriers.find((x) => x.drone.st === 'dock' && x.drone.reprint <= 0); if (d) { launchDrone(e, d); C.courierT = 0; sayC(C, state, 'a courier is out: its link is weak. Hold the RF gun on it', 'boss:courier'); } }
      for (const d of hunters) if (d.drone.st === 'dock' && d.drone.reprint <= 0 && hunters.filter(live).length < (Hn.most ?? 2)) launchDrone(e, d);
    }
    const hacked = couriers.find((d) => d.drone.hacked && live(d));
    if (hacked && C.deliveries >= (Ch.after ?? 1)) {
      let n = hunters.filter((d) => live(d) && d.drone.chase).length;
      for (const d of hunters) if (n < (Ch.most ?? 2) && live(d) && !d.drone.chase) { d.drone.chase = true; n++; if (!C.chaseSaid) { C.chaseSaid = true; sayC(C, state, 'its drones are after the hacked one: shoot them off it', 'boss:chase'); } }
      if (n < (Ch.most ?? 2)) { const d = hunters.find((x) => x.drone.st === 'dock' && x.drone.reprint <= 0); if (d) { launchDrone(e, d); d.drone.chase = true; } }
    }
    const speed = D0.speed ?? 8;
    for (const d of C.drones) {
      const D = d.drone; D.t += dt;
      if (D.st === 'dock') { D.reprint = Math.max(0, (D.reprint || 0) - dt); d.transform.pos = onBody(e, D.bay); continue; }
      if (D.st === 'fall') {
        D.vz = (D.vz || 0) - 9.81 * dt; d.transform.pos[2] += D.vz * dt;
        const g = groundAt(hooks, d.transform.pos[0], d.transform.pos[1], 0);
        if (d.transform.pos[2] <= g + 0.1) { d.transform.pos[2] = g + 0.1; if (D.t > 1.5) dock(e, C, d, true); }
        continue;
      }
      if (S.down) continue;
      if (D.st === 'launch') {
        const b = onBody(e, D.bay), out = [b[0] + (b[0] - home[0]) * 0.6, b[1] + (b[1] - home[1]) * 0.6, alt];
        if (fly(d, out, speed * 0.7, dt) < 0.5) { D.st = D.role === 'courier' ? 'lap' : 'patrol'; D.t = 0; }
        continue;
      }
      if (D.role === 'courier' && D.hacked) { stepHacked(state, e, S, K, C, d, dt); continue; }
      if (D.role === 'courier') {
        if (D.st === 'lap') {
          const r = Q.orbit ?? 15, a = D.phase + t * (Q.speed ?? 6) / r;
          fly(d, [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r, alt - 1], (Q.speed ?? 6) * 1.4, dt);
          if (D.t >= (Q.stay ?? 40)) { D.st = 'home'; D.t = 0; }
        } else if (D.st === 'home' && fly(d, onBody(e, D.bay), Q.speed ?? 6, dt) < 0.4) dock(e, C, d, false);
        continue;
      }
      // A HUNTER: its chase, its drop, its patrol
      if (D.chase && hacked) {
        const q = hacked.transform.pos, h = hacked.transform.heading;
        fly(d, [q[0] - Math.cos(h + D.phase * 0.3) * 6, q[1] - Math.sin(h + D.phase * 0.3) * 6, q[2] + 1], speed * 1.1, dt);
        D.cool = Math.max(0, (D.cool || 0) - dt);
        if (D.cool <= 0 && dist3(d.transform.pos, q) < (Ch.range ?? 16) && !E.sightBlocked(d.transform.pos, q, state.colliders)) { D.cool = Ch.every ?? 1.8; hacked.body.hp = Math.max(0, hacked.body.hp - (Ch.hurt ?? 12)); hacked.hitFlash = t; tracer(state, d.transform.pos, q); }
        continue;
      }
      if (D.chase) D.chase = false;
      const Dr = Hn.drop || {};
      D.dropCool = Math.max(0, (D.dropCool == null ? (Dr.every ?? 9) * 0.5 : D.dropCool) - dt);
      const q = p ? p.transform.pos : null, chest = q ? [q[0], q[1], q[2] + heightOf(p) * 0.7] : null;
      const sees = chest && Math.hypot(chest[0] - d.transform.pos[0], chest[1] - d.transform.pos[1]) < (Hn.see ?? 24) && !E.sightBlocked(d.transform.pos, chest, state.colliders);
      if (sees && D.dropCool <= 0) {
        if (fly(d, [q[0], q[1], q[2] + (D0.alt ?? 7)], speed, dt) < 1.5) {
          // (a grenade let go over the pilot: its disc marked from the drone's drop, a roof between them cover)
          D.dropCool = Dr.every ?? 9;
          const mark = Dr.mark ?? 1.3;
          state.bossHazards.push({ shape: 'disc', c: [q[0], q[1]], r: Dr.r ?? 3, z: q[2], t0: t + mark, t1: t + mark + 0.35, tm: t, harm: Dr.harm ?? 0.14, cover: true, o: [d.transform.pos[0], d.transform.pos[1]], id: `${d.id}:drop:${Math.round(t * 100)}`, by: d.id, move: 'drop', colour: (B.look || {}).hazard, tellColour: (B.look || {}).tell });
          if (!C.dropSaid) { C.dropSaid = true; sayC(C, state, 'a drone over you drops a grenade: out of its mark, or under a roof', 'boss:drop'); }
        }
        continue;
      }
      const r = D0.orbit ?? 20, a = D.phase - t * speed / r * 0.5;
      fly(d, [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r, alt + (D.phase % 2)], speed * 0.6, dt);
    }
    for (const k in C.pkgs) { const P = C.pkgs[k]; if (P.carried) { const d = state.byId[P.carried]; if (d) P.pos = [d.transform.pos[0], d.transform.pos[1], d.transform.pos[2] - 0.6]; } else P.pos = P.at.slice(); }
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
    for (const e of state.entities) if (e.bossS && e.bossS.carrier) placeCrew(e, e.bossS.carrier);
    let out;
    try { out = step(state, input, dt, hooks); } finally { for (const [e, ty] of held) e.rule.type = ty; }
    const t = state.time, pilot = state.pilotId ? state.byId[state.pilotId] : null, quiet = E.ghostOn ? E.ghostOn(pilot) : false;
    for (const e of state.entities) {
      const B = e.rule && e.rule.boss, S = e.bossS;
      if (!B || !S) continue;
      if (!alive(e)) {
        if (!S.down) { S.down = true; e.downed = true; if (state.bursts && B.kind === 'vehicle') state.bursts.push({ seq: state.burstSeq++, pos: e.transform.pos.slice(), t, radius: 6 }); if (S.carrier) for (const d of S.carrier.drones) if (d.drone.out && d.drone.st !== 'fall') shotDown(state, e, S, d); }
        if (S.carrier) carrier(state, e, S, B, dt, input, hooks);
        state.bosses[e.id] = { name: B.name, down: true, ...(S.carrier ? { carrier: carrierFacts(S) } : {}) }; continue;
      }
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
        if (S.cur && S.cur.fly) {
          // (a flight flies it along its path through the move, its fall held off while it is aloft; `aloft` its height over its floor)
          const F = S.cur.fly, [x, z] = flownAt(F, t - S.cur.t0);
          e.transform.pos[0] = F.o[0] + F.f[0] * x; e.transform.pos[1] = F.o[1] + F.f[1] * x; e.transform.pos[2] = F.z0 + F.eye + z;
          if (e.vel) e.vel[2] = 0;
          e.aloft = z > 0.05 ? Math.round(z * 1000) / 1000 : 0;
        } else if (e.aloft) e.aloft = 0;
        // (a boss kept to its ROOM stands on its room's floor, the height it stood at: never settled up onto a ledge or a
        // climb's ledges over it, which a body as tall as their spacing reaches from its head down; a flight's air its own)
        if (B.room && !(S.cur && S.cur.fly)) {
          if (S.floor == null) S.floor = e.transform.pos[2];
          else if (e.transform.pos[2] > S.floor + 0.25) { e.transform.pos[2] = S.floor; if (e.vel) e.vel[2] = 0; }
        }
      } else {
        // VEHICLE: what hit it, judged by part (its health given back first); the mines under it
        S.now = t;
        if (e.body.hp < H0) {
          const lost = H0 - e.body.hp; e.body.hp = H0;
          const causes = [];
          for (const s of state.entities) if (s.lastShot && s.lastShot.targetId === e.id && s.lastShot.t === t0 && s.lastShot.to) causes.push(['round', s.lastShot.to, s.lastShot.from || s.transform.pos]);
          for (const b of state.bursts || []) if (b.t === t0 && !b.effect && Math.hypot(b.pos[0] - e.transform.pos[0], b.pos[1] - e.transform.pos[1]) < Math.max(...B.size) + (b.radius || 0)) causes.push(['explosive', b.pos, b.pos]);
          // (a BLOW, a blade's: a striker whose swing landed on it this step, judged where its blow reaches, toward the
          // boss from where it stands, at its chest)
          for (const s of state.entities) if (s.lastStrike && s.lastStrike.targetId === e.id && s.lastStrike.t === t0) {
            const sp = s.transform.pos, dx = e.transform.pos[0] - sp[0], dy = e.transform.pos[1] - sp[1], d = Math.hypot(dx, dy) || 1, r = Math.min(d, ((s.strikeParams && s.strikeParams.reach) || 1.4));
            causes.push(['blow', [sp[0] + (dx / d) * r, sp[1] + (dy / d) * r, sp[2] + ((s.rule && s.rule.eye) || 1.2) * 0.6], sp]);
          }
          for (const [kind, q, src] of causes) judge(state, e, S, kind, q, lost / causes.length, src);
        }
        for (const m of state.mineBlasts || []) if (m.by === e.id && m.t === t0) judge(state, e, S, 'mine', m.at, 0);
        // its state moves on: parts broken, a run flown, seconds out
        const st = B.states[S.state] || {};
        S.stateT += dt;
        // (a way on by parts broken before one by seconds: the last head severed ends the turns, never passes them on)
        for (const [to, c] of Object.entries(st.to || {}).sort((a, b) => (b[1].broken ? 1 : 0) - (a[1].broken ? 1 : 0))) {
          // (a turn whose part is broken is over at once: on by its way after seconds)
          const go = c.broken ? (c.any ? c.broken.some((q) => S.broken[q]) : c.broken.every((q) => S.broken[q])) : c.flown ? !!S.flown : c.after ? S.stateT >= afterOf(S, c) || !!(st.head && S.broken[st.head]) : false;
          if (go) { S.state = turnPast(B, S, to); S.stateT = 0; S.flown = false; S.cur = null; S.next = t + 1; break; }
        }
        const p0 = [e.transform.pos[0], e.transform.pos[1]];
        driveVehicle(state, e, S, dt);
        if (B.frame || B.figure) playFrame(e, S, B, Math.hypot(e.transform.pos[0] - p0[0], e.transform.pos[1] - p0[1]));
        if (B.carrier) carrier(state, e, S, B, dt, input, hooks);
      }
      // ITS MOVES: the phase's (or the state's) by weight, at its tempo; none while unseen, none mid-shift
      const table = B.kind === 'human' ? (B.phases[S.phase] || B.phases[0]) : (B.states[S.state] || {});
      if (S.cur && t >= S.cur.openEnd) { S.cur = null; S.next = t + (table.tempo || 2); }
      const onRun = B.kind === 'vehicle' && S.run;
      // (a boss kept to its ROOM, `room` [y0, y1, z0, z1] on its lane: no move while the pilot is out of it, its first
      // `first` seconds after the pilot comes in)
      const pp = pilot && pilot.transform.pos, pz = pp && pp[2] - ((pilot.rule && pilot.rule.eye) || 0);
      const inRoom = !B.room || !!(pp && pp[1] >= B.room[0] && pp[1] <= B.room[1] && pz >= B.room[2] - 0.1 && pz <= B.room[3]);
      if (!inRoom && !S.cur) S.next = Math.max(S.next, t + (B.first ?? 2));
      if (inRoom && !S.cur && !quiet && pilot && alive(pilot) && t >= S.next && !(e.phaseShiftT > 0) && (!onRun || !S.run.strafed)) {
        const id = pick(table.moves, dice(B.seed || 1, S.count + 1));
        if (id) { lay(state, e, S, id, pilot.transform.pos, t); if (onRun) S.run.strafed = true; }
      }
      // (a live floor fires its grid on its own between the moves)
      if (inRoom && S.live && B.moves['live-floor'] && pilot && !quiet && !S.cur && (S.liveNext == null || t >= S.liveNext)) { S.liveNext = t + 5; const keep = S.cur; lay(state, e, S, 'live-floor', pilot.transform.pos, t); S.cur = keep; }
      // tracking hazards follow the pilot until they hold
      if (S.cur && pilot) for (const h of state.bossHazards) if (h.by === e.id && h.track != null && t < h.track && h.t0 > t) {
        const P = B.moves[h.move], R = E.layPattern(P, ...S.cur.frame(pilot.transform.pos), S.cur.t0)[h.k];
        Object.assign(h, { a: R.a, b: R.b, ...(R.o ? { o: R.o } : {}) });
      }
      // (a boss of an ORDER says the part to strike next, and the last one struck out of it: the HUD's)
      const ordered = B.kind === 'vehicle' && B.parts && Object.keys(B.parts).some((q) => B.parts[q].order != null);
      state.bosses[e.id] = { name: B.name, title: B.title || '', ...(ordered ? { next: nextInOrder(B, S), ...(S.wrong ? { wrong: S.wrong } : {}) } : {}), ...(B.counters ? { counters: Object.fromEntries(B.counters.map((c) => [c.id, { hits: (S.parts || {})[c.id] || 0, of: c.hits, bare: !!(S.bare || {})[c.id], broken: !!S.broken[c.id], ...(c.kind === 'flash' ? { blind: S.blind != null && t < S.blind } : {}) }])), ...(S.said ? { said: S.said } : {}) } : {}), phase: S.phase, phases: (B.phases || []).length, state: S.state, broken: Object.keys(S.broken), open: !!(S.cur && t >= S.cur.openAt && t < S.cur.openEnd), hp: e.body.hp, hpMax: e.hpMax, ...(S.carrier ? { carrier: carrierFacts(S) } : {}), ...(B.states && B.states[S.state] && B.states[S.state].reads ? { reads: B.states[S.state].reads } : {}), ...(S.stateFor ? { left: Math.max(0, S.stateFor - S.stateT) } : {}) };
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
        // (over it: a hazard that reaches `rise` over its ground misses a body whose feet are higher, a jump clearing it)
        if (h.rise != null && q[2] - ((b.rule && b.rule.eye) || 0) > (h.z || 0) + h.rise) continue;
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
