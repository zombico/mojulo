/**
 * boss.js — A BOSS FOUGHT IN PHASES: one big body (a siege walker, a tank) that is not shot down but taken apart. Each
 * phase is a way of fighting it, and a way of beating it: a part of it that only some things hurt, from some sides.
 * Opt-in on the boss's own rule (a body no mind steps: this moves it):
 *
 *   rule.boss: {
 *     name?, hp: 300,                 its core: what the last phase's weak spots wear down; none left, it is destroyed
 *     start?: 'stand',                the phase it starts in
 *     fold?: 2,                       seconds its fold from a walker phase to a tank phase takes (its `transform:tank`)
 *     phases: { <name>: STAND | TANK } the ways it fights (below), each `then` the phase it is forced into
 *     spots: [SPOT],                  its weak spots
 *     mine?: { item?: 'mine', arm?: 1, trip?: 2.4, hurt?: 55, lane?: 2.5, tankLane?: 3 }
 *                                     THE PILOT'S MINES: an item of its carry (carry.js `rule.carry.items`, id `item`)
 *                                     used from the item menu is laid at its feet, armed `arm` s later; the boss walking
 *                                     or driving over one (its tread: within `lane` m of its centreline walking, `tankLane`
 *                                     driving, and within `trip` m along it) sets it off under it; `crates`
 *                                     ([{ id, at, count }]) are more of them, taken by walking onto one
 *     down?: { item?: '<mission item id>' }   destroyed, the mission (mission.js) holds that item: an objective done
 *     bounds?: [[x0, y0], [x1, y1]]   where it may walk and drive
 *   }
 *
 *   STAND { kind: 'walker', speed, turn, stride, then?,
 *           barrage: { aim?: 1.6, shells?: 3, gap?: 0.8, missiles?: 6, mgap?: 0.25, flight?: 2.6, mflight?: 1.8,
 *                      scatter?: 3.5, r?: 5, hurt?: 45, mr?: 3, mhurt?: 22 },
 *           reload: { secs?: 7, strokes?: 2, slow?: [1, 1.8, 3] },    the tails' reload, standing; slower by `slow[n]` with
 *                                                                     n of its tails shot down
 *           advance: { max?: 9, stop?: 3 }, legs?: { break } }
 *     It stands and fires a BARRAGE at the pilot (aimed `aim` s, its guns raised, then `shells` from its howitzer and
 *     `missiles` from its launcher, each landing on a ring drawn on the ground where it will fall: near the pilot, a
 *     seeded scatter round it). A burst hurts a pilot within its `r`, less toward its edge, and nothing through cover:
 *     the line from the burst to the pilot's chest and to its head, each one blocked by a collider, halves it. Then it
 *     RELOADS standing, its tails at work (the `tails:reload` clip, frames.js), and then ADVANCES on where its first
 *     shell fell (where the pilot was), `max` s at most; its feet set off a mine in their tread. A leg spot worn to
 *     nothing forces it into `then`, and so do its legs worn together to `legs.break` (a leg's mine is the one on its
 *     side: a walker turning onto its goal splits them).
 *   TANK  { kind: 'tank', speed, turn, stride, standoff?: [12, 22], then?,
 *           gun: { lay?: 1.4, traverse?: 20, hurt?: 40, r?: 4, range?: 140 },
 *           salvo?: { every?: 3 } (a barrage of missiles in place of the gun's round, every n-th time),
 *           reload: { secs?: 4, slow? }, ram?: { hurt?: 30, every?: 1.5 }, mine?: { stun?: 6, core?: 30 } }
 *     It drives to a ring round the pilot (`standoff`), turns its gun on it (a sight line drawn from the muzzle: it
 *     traverses at `traverse` °/s, so a pilot that moves round it outruns it), locks and fires along the line: the round
 *     bursts on the first thing it meets. A mine under its wheels breaks its drive: it stops for `stun` s, its core
 *     takes `core`. Driven onto, the pilot is run down (`ram`).
 *   CARRIER { kind: 'carrier', crew?: { lay?: 1, every?: 3, burst?: 4, hurt?: 12, range?: 45 },
 *             drones: { reprint?: 20, alt?: 7, speed?: 9, orbit?: 20,
 *                       hunter: { hp?, see?: 26, drop: { every?: 8, flight?: 1.2, r?: 3, hurt?: 16 } },
 *                       courier: { hp?, every?: 15, stay?: 35, speed?: 7, orbit?: 16 },
 *                       chase: { after?: 1, most?: 2, every?: 1.6, hurt?: 15, range?: 16 } },
 *             hack: { secs?: 2, decay?: 0.35, slip?: 0.25 }, packages: [{ id, at }], restock?: 10,
 *             delivery: { core?: 110, r?: 4 }, doors: { r: [f, r, u], l: [f, r, u] } }
 *     A carrier that fights through what it carries and is beaten through it too. Its CREW (spots `part: 'crew'`: a
 *     gunner on a mount, a body of its own, `face` ° off the body's heading, `arc` ° either side, at a hangar door, `door`)
 *     lay a burst on the pilot in their arc and in sight (cover from them as from a burst), or on a hacked drone near
 *     them; a gunner is a person, put down by the pilot's rounds or knocked out by its dart (knockout.js), and stays down.
 *     Its DRONES (bodies of their own, `rule.bossDrone: { boss, role: 'hunter' | 'courier', bay: [f, r, u] }`) are
 *     endless: launched from their bays, shot down and reprinted `reprint` s later. A HUNTER patrols round it, and one that
 *     sees the pilot flies over it and drops a grenade (its ring on the ground first). A COURIER (its link weak: the page
 *     shows its light) laps round it and goes home. The pilot's RF gun (a loadout slot whose weapon says `jam: true`) held
 *     on a courier for `secs` HACKS it (off it, the hack drains at `decay` a second); hacked, it flies to the nearest
 *     package (`packages`), picks it up and carries it home to the door whose gunner is down (else the nearer), "for
 *     repair": in the door it goes off, and the core takes `delivery.core`. From the delivery after `chase.after`, the
 *     carrier's hunters chase a hacked courier and shoot at it: kept alive (its chasers shot down), it delivers; shot
 *     down, its package is lost and comes back to its pallet `restock` s later. The core worn to nothing destroys it.
 *   (A transforming body passes from a walker phase to a tank phase through its fold: `transform:tank`, `transformDur` s,
 *   after a beat of staggering, `fall` s.)
 *
 *   SPOT { id, name?, part: 'tail' | 'leg' | 'hip' | 'radar' | 'engine' | <any>, side?: 'r' | 'l',
 *          at: { walker?: [f, r, u], tank?: [f, r, u] },  where it is on the body (metres: forward, right, up)
 *          phases?: [names] (absent: all), hp?: 100 (absent: endless, `core` only), r?: 0.8,
 *          by?: 'round' | 'mine',   what hurts it: the pilot's rounds (the default) or its mines (a leg)
 *          from?: 'any' | 'behind' | 'side', arc?: 70,   where the pilot must stand for a round to reach it: behind the
 *                                                        body, or off the spot's own side, within `arc` °
 *          core?: 0,      the share of what it takes that the core takes too
 *          bonus?: 0,     what the core takes when it is destroyed
 *          effect?: { turn?, spread?, lay? }   on the body once destroyed: its turn and its gun's traverse times `turn`,
 *                                              its aim's scatter times `spread`, its lay's seconds times `lay`
 *        }
 *     A tail destroyed slows the reload (its phase's `reload.slow`); a leg is worn by the mines its feet set off.
 *     A round reaches a spot through ITS ENTITY: a body of its own the world carries (`rule.bossSpot: { boss, spot }`,
 *     a body with an egg and no hp of its own, laid by gameworld/combat/boss-fight.js), set where the spot is each step
 *     and hittable only while the pilot stands where it may be hit from; what each hit dealt (its `lastHitDmg`, its
 *     `hits`) is the spot's. A sleep dart's round hurts no machine.
 *
 * State: on the boss e.boss { phase, step, t, cycle, n, spots: { id: { hp, max, gone } }, tailsLost, hp, hpMax, aim, lay,
 * goal, stunT, said: { text, t }, k: { turn, spread, lay } } and its body's form, locomotion, gaitPhase and moving (the
 * page plays its clips: forward, tails:reload, transform:tank, tank:idle, tank:forward); in the world state.bossFx
 * { shells: [{ id, kind, from, to, t0, T, apex }], bursts: [{ id, at, r, t, kind }], mines: [{ id, at, t0 }], seq } (the
 * page draws them: scene/channels/controllable/boss-view.js). The bus hears boss:barrage, boss:burst, boss:reload,
 * boss:mine, boss:spot, boss:phase and boss:down through its said.
 *
 * Wraps stepWorld (outermost of the opt-ins it reads: carry's item, the rounds' hits); its own dice are seeded (an id
 * and a count). Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose world
 * has a body with `rule.boss`, so every other page keeps every byte.
 */
export function buildBoss(E) {
  const step = E.stepWorld;
  const { sightBlocked, nearestWallT } = E;
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ease = (u) => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  // a seeded uniform in [0, 1) from an id and a count (FNV-style, as the rounds' cone)
  function hash01(id, n) {
    const str = String(id) + ':' + n;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // a point on the body: [f, r, u] off its place, by its heading
  function onBody(e, at) {
    const t = e.transform, c = Math.cos(t.heading), s = Math.sin(t.heading), a = at || [0, 0, 0];
    return [t.pos[0] + c * a[0] + s * a[1], t.pos[1] + s * a[0] - c * a[1], t.pos[2] + a[2]];
  }
  // a world point in the body's frame: [forward, right]
  function local(e, p) {
    const t = e.transform, dx = p[0] - t.pos[0], dy = p[1] - t.pos[1], c = Math.cos(t.heading), s = Math.sin(t.heading);
    return [c * dx + s * dy, s * dx - c * dy];
  }
  const pilotOf = (state) => (state.pilotId ? state.byId[state.pilotId] : null);
  const fx = (state) => state.bossFx || (state.bossFx = { shells: [], bursts: [], mines: [], seq: 0 });
  const say = (S, state, text, on) => { S.said = { text, t: state.time || 0, on: on || null }; };
  const heightOf = (p) => (p.rule && Number.isFinite(p.rule.collideHeight) ? p.rule.collideHeight : 1.7);

  // THE SPOT'S PLACE in the form the body is in (between its two through a fold)
  function spotAt(e, S, sp) {
    const A = sp.at || {}, w = A.walker || A.tank || [0, 0, 0], k = A.tank || w;
    if (S.phase === 'transform') { const u = ease(S.t / Math.max(0.1, S.fold)); return onBody(e, [0, 1, 2].map((i) => w[i] + (k[i] - w[i]) * u)); }
    return onBody(e, S.form === 'tank' ? k : w);
  }
  // where the pilot stands for a round to reach a spot
  function reachable(e, sp, p) {
    const from = sp.from || 'any';
    if (from === 'any') return true;
    const [lf, lr] = local(e, p.transform.pos), arc = num(sp.arc, 70) * D2R;
    if (from === 'behind') return Math.abs(Math.atan2(lr, -lf)) <= arc;
    if (from === 'side') { const sg = sp.side === 'l' ? -1 : 1; return Math.abs(Math.atan2(lf, sg * lr)) <= arc; }
    return true;
  }
  const inPhase = (sp, S) => !sp.phases || sp.phases.includes(S.phase === 'transform' || S.phase === 'fall' ? S.from : S.phase);

  // A BURST: what it does to the pilot (its reach, less toward its edge; through cover less, or nothing)
  function cover(state, at, p) {
    const q = p.transform.pos, h = heightOf(p), from = [at[0], at[1], at[2] + 0.5];
    let open = 0;
    for (const z of [0.55, 0.9]) if (!sightBlocked(from, [q[0], q[1], q[2] + h * z], state.colliders)) open++;
    return open / 2;
  }
  function burst(state, e, S, at, r, hurt, kind) {
    const F = fx(state), now = state.time || 0;
    F.bursts.push({ id: ++F.seq, at: at.slice(), r, t: now, kind: kind || 'shell' });
    const p = pilotOf(state);
    if (p && !p.downed && !p.gone && p.body && Number.isFinite(p.body.hp)) {
      const q = p.transform.pos, d = Math.hypot(q[0] - at[0], q[1] - at[1], (q[2] + 0.9) - at[2]);
      if (d < r) {
        const k = cover(state, at, p), dmg = hurt * (1 - 0.6 * (d / r)) * k;
        if (dmg > 0.5) {
          p.body.hp = Math.max(0, p.body.hp - dmg); p.hitFlash = now; p.hits = (p.hits || 0) + 1; p.lastHitBy = e.id; p.lastHitDmg = dmg;
          p.lastHitFrom = at.slice();
          if (p.body.hp <= 0) p.downed = true;
        }
        S.lastBurst = { d: Math.round(d * 10) / 10, cover: k, dmg: Math.round(dmg) };
      }
    }
  }

  // A SHELL IN FLIGHT: launched from a muzzle onto a point, landing `T` s later (the page draws its arc)
  function launch(state, e, from, to, T, kind, apex, r, hurt, delay) {
    const F = fx(state);
    F.shells.push({ id: ++F.seq, kind, from: from.slice(), to: to.slice(), t0: (state.time || 0) + (delay || 0), T, apex, by: e.id, r, hurt });
  }
  function landShells(state) {
    const F = state.bossFx; if (!F) return;
    const now = state.time || 0;
    for (const s of F.shells) {
      if (s.done || now < s.t0 + s.T) continue;
      s.done = true;
      const e = state.byId[s.by], S = e && e.boss; if (!S || S.phase === 'down' || s.kind === 'tracer') continue;
      burst(state, e, S, s.to, s.r, s.hurt, s.kind);
    }
    F.shells = F.shells.filter((s) => !s.done);
    F.bursts = F.bursts.filter((b) => now - b.t < 3);
  }

  // where the pilot is, a little ahead of where it is going
  function aimPoint(state, e, p, lead) {
    const q = p.transform.pos, v = p.formVel || p.vel || [0, 0, 0];
    return [q[0] + (v[0] || 0) * lead, q[1] + (v[1] || 0) * lead, q[2]];
  }
  const groundAt = (hooks, x, y, z) => { const g = hooks && hooks.ground ? hooks.ground([x, y, z + 3]) : null; return Number.isFinite(g) ? g : z; };
  // a muzzle on its mount: the round's place in the body's form, its barrel along the aim
  function muzzle(e, S, side) {
    const W = S.cfg.weapons && S.cfg.weapons[side];
    if (!W) return onBody(e, [0, 0, 5]);
    const at = (S.form === 'tank' && W.atTank) || W.at || [0, 0, 5], A = S.aim[side] || { yaw: 0, pitch: 0 };
    const yaw = e.transform.heading - A.yaw * D2R, pit = A.pitch * D2R, L = num(W.barrel, 3), b = onBody(e, at);
    return [b[0] + Math.cos(yaw) * Math.cos(pit) * L, b[1] + Math.sin(yaw) * Math.cos(pit) * L, b[2] + Math.sin(pit) * L];
  }
  // the guns turned toward their asks (their mounts' rates: the gun's traverse, its elevation)
  function slewAim(S, side, yaw, pitch, rate, dt) {
    const A = S.aim[side] || (S.aim[side] = { yaw: 0, pitch: 0 }), r = rate * dt;
    A.yaw += clamp(wrap((yaw - A.yaw) * D2R) / D2R, -r, r);
    A.pitch += clamp(pitch - A.pitch, -r, r);
    A.yaw = clamp(A.yaw, -150, 150); A.pitch = clamp(A.pitch, -8, 70);
  }
  // the body turned toward a heading at its rate
  function turnTo(e, want, rate, dt) {
    const d = wrap(want - e.transform.heading), r = rate * dt;
    e.transform.heading = wrap(e.transform.heading + clamp(d, -r, r));
    return Math.abs(d);
  }
  function inBounds(S, x, y) {
    const B = S.cfg.bounds; if (!B) return [x, y];
    return [clamp(x, B[0][0], B[1][0]), clamp(y, B[0][1], B[1][1])];
  }
  // moving on: forward along its heading at its pace, its clip's phase by the ground it covers
  function move(e, S, P, speed, dt, hooks) {
    const t = e.transform, d = speed * dt, [x, y] = inBounds(S, t.pos[0] + Math.cos(t.heading) * d, t.pos[1] + Math.sin(t.heading) * d);
    const moved = Math.hypot(x - t.pos[0], y - t.pos[1]);
    t.pos[0] = x; t.pos[1] = y; t.pos[2] = groundAt(hooks, x, y, t.pos[2]);
    e.gaitPhase = (e.gaitPhase || 0) + moved / Math.max(0.5, num(P.stride, 4));
    e.moving = moved > 1e-4; e.locomotion = 'forward';
    return moved;
  }
  const stand = (e) => { e.moving = false; e.locomotion = 'forward'; };

  // THE MINES: laid by the pilot (an item used from its carry), set off by the boss's tread
  function layMines(state, p, S) {
    const M = S.cfg.mine; if (!M || !p) return;
    const used = p.carryUsed;
    if (used && used.id === (M.item || 'mine') && used.t !== S.mineSeen) {
      S.mineSeen = used.t;
      const F = fx(state), q = p.transform.pos;
      F.mines.push({ id: ++F.seq, at: [q[0], q[1], q[2]], t0: state.time || 0 });
      say(S, state, 'mine laid: it goes off under its tread', 'boss:mine-laid');
    }
  }
  // (a crate of mines, walked onto: its count into the pilot's carry)
  function crates(state, p, S) {
    const M = S.cfg.mine, C = M && M.crates; if (!C || !p || !p.carry) return;
    const F = fx(state), taken = F.taken || (F.taken = {}), items = (p.rule.carry && p.rule.carry.items) || [], i = items.findIndex((it) => it.id === (M.item || 'mine'));
    if (i < 0) return;
    for (const c of C) {
      if (taken[c.id]) continue;
      const q = p.transform.pos;
      if (Math.hypot(q[0] - c.at[0], q[1] - c.at[1]) > 1.4 || Math.abs(q[2] - (c.at[2] || 0)) > 2) continue;
      taken[c.id] = true; p.carry.counts[i] = (p.carry.counts[i] || 0) + num(c.count, 3);
      say(S, state, `${num(c.count, 3)} mines taken`, 'boss:crate');
    }
  }
  function tread(state, e, S, P) {
    const F = state.bossFx; if (!F || !e.moving) return;
    const M = S.cfg.mine || {}, now = state.time || 0, tank = S.form === 'tank';
    const lane = tank ? num(M.tankLane, 3) : num(M.lane, 2.5), trip = num(M.trip, 2.4);
    for (const m of F.mines) {
      if (m.gone || now - m.t0 < num(M.arm, 1)) continue;
      const [lf, lr] = local(e, m.at);
      if (Math.abs(lr) > lane || Math.abs(lf) > trip) continue;
      m.gone = true;
      burst(state, e, S, [m.at[0], m.at[1], m.at[2] + 0.3], 3, 30, 'mine');
      if (tank) {
        const T = P.mine || {};
        S.stunT = num(T.stun, 6); hurtCore(state, e, S, num(T.core, 30));
        say(S, state, 'a mine under its wheels: its drive is broken, get behind it', 'boss:mine');
      } else {
        // (the leg on the mine's side takes it)
        const side = lr >= 0 ? 'r' : 'l', leg = S.cfg.spots.find((sp) => sp.part === 'leg' && (sp.side || 'r') === side && inPhase(sp, S)) || S.cfg.spots.find((sp) => sp.part === 'leg' && inPhase(sp, S));
        say(S, state, `a mine under its ${side === 'r' ? 'right' : 'left'} foot`, 'boss:mine');
        if (leg) hurtSpot(state, e, S, leg, num(M.hurt, 55));
        // (its legs worn together past what holds it up: it cannot stand, whichever leg took what)
        const legs = S.cfg.spots.filter((sp) => sp.part === 'leg' && inPhase(sp, S)), worn = legs.reduce((a, sp) => a + (S.spots[sp.id].max - S.spots[sp.id].hp), 0);
        if (P.legs && Number.isFinite(P.legs.break) && worn >= P.legs.break && P.then && S.phase !== 'fall') {
          say(S, state, 'its legs give under it: it cannot stand', 'boss:spot'); begin(state, e, S, 'fall');
        }
      }
    }
    F.mines = F.mines.filter((m) => !m.gone || false);
  }

  // A SPOT HURT: its hp, the core's share, and what its loss does
  function hurtCore(state, e, S, dmg) {
    if (S.phase === 'down') return;
    S.hp = Math.max(0, S.hp - dmg);
    if (S.hp <= 0) destroy(state, e, S);
  }
  function hurtSpot(state, e, S, sp, dmg) {
    const R = S.spots[sp.id]; if (!R || R.gone) return;
    if (Number.isFinite(R.max)) R.hp = Math.max(0, R.hp - dmg);
    if (sp.core) hurtCore(state, e, S, dmg * sp.core);
    if (Number.isFinite(R.max) && R.hp <= 0) {
      R.gone = true; R.t = state.time || 0;
      if (sp.bonus) hurtCore(state, e, S, sp.bonus);
      const X = sp.effect || {};
      if (X.turn) S.k.turn *= X.turn;
      if (X.spread) S.k.spread *= X.spread;
      if (X.lay) S.k.lay *= X.lay;
      if (sp.part === 'tail') { S.tailsLost++; say(S, state, `${sp.name || 'a reloader'} shot down: it reloads slower`, 'boss:spot'); }
      else if (sp.part === 'leg') {
        say(S, state, `${sp.name || 'a leg'} is broken: it cannot stand`, 'boss:spot');
        const P = S.cfg.phases[S.phase];
        if (P && P.then && S.phase !== 'fall' && S.phase !== 'transform') begin(state, e, S, 'fall');
      } else say(S, state, `${sp.name || sp.id} destroyed`, 'boss:spot');
    }
  }
  function destroy(state, e, S) {
    if (S.phase === 'down') return;
    S.phase = 'down'; S.step = 'down'; S.t = 0; stand(e);
    const F = fx(state), now = state.time || 0;
    F.shells = F.shells.filter((s) => s.by !== e.id);
    for (let k = 0; k < 5; k++) F.bursts.push({ id: ++F.seq, at: onBody(e, [(hash01(e.id, 900 + k) - 0.5) * 5, (hash01(e.id, 950 + k) - 0.5) * 3, 1 + 3 * hash01(e.id, 980 + k)]), r: 4, t: now + k * 0.35, kind: 'wreck' });
    const down = S.cfg.down || {};
    if (down.item && state.ms) { state.ms.held = state.ms.held || {}; state.ms.held[down.item] = true; }
    e.bossDown = true;
    for (const d of S.drones || []) if (d.drone.out && d.drone.st !== 'fall') shotDown(state, e, S, d);
    say(S, state, `${(S.cfg.name || 'the boss').toUpperCase()} DESTROYED`, 'boss:down');
  }

  function begin(state, e, S, phase) {
    const P = S.cfg.phases[phase];
    if (phase === 'fall') { S.from = S.phase; S.phase = 'fall'; S.step = 'fall'; S.t = 0; stand(e); S.toPhase = (S.cfg.phases[S.from] || {}).then; return; }
    if (phase === 'transform') { S.phase = 'transform'; S.step = 'transform'; S.t = 0; S.fold = num(S.cfg.fold, num(e.transformDur, 2)); return; }
    S.phase = phase; S.from = null; S.t = 0; S.cycle = 0; S.n = 0;
    S.form = P && P.kind === 'tank' ? 'tank' : 'walker';
    if (P && P.kind === 'carrier') { S.phase = phase; S.step = 'brood'; e.form = 'walker'; return; }
    e.form = S.form;
    S.step = S.form === 'tank' ? 'drive' : 'aim';
    if (S.form === 'tank') say(S, state, `${S.cfg.name || 'it'} goes down on its wheels: hit it where it is open`, 'boss:phase');
  }

  // THE WALKER, STANDING: aim, a barrage, the reload, the advance
  function stepStand(state, e, S, P, p, dt, hooks) {
    const B = P.barrage || {}, R = P.reload || {}, A = P.advance || {};
    const want = p ? Math.atan2(p.transform.pos[1] - e.transform.pos[1], p.transform.pos[0] - e.transform.pos[0]) : e.transform.heading;
    if (S.step === 'aim') {
      stand(e);
      turnTo(e, want, num(P.turn, 0.6) * S.k.turn, dt);
      slewAim(S, 'r', 0, 55, 40, dt); slewAim(S, 'l', 0, 35, 40, dt);
      if (S.t === 0) say(S, state, 'INCOMING: get behind something', 'boss:barrage');
      if (S.t >= num(B.aim, 1.6)) { S.step = 'fire'; S.t = 0; S.n = 0; S.target = p ? aimPoint(state, e, p, 0.6) : onBody(e, [20, 0, 0]); }
      return;
    }
    if (S.step === 'fire') {
      stand(e);
      const shells = num(B.shells, 3), gap = num(B.gap, 0.8), missiles = num(B.missiles, 6), mgap = num(B.mgap, 0.25);
      const scat = num(B.scatter, 3.5) * S.k.spread;
      while (S.n < shells + missiles) {
        const k = S.n, tk = k < shells ? k * gap : shells * gap + (k - shells) * mgap;
        if (S.t < tk) break;
        // (one fire solution for the whole barrage, laid as it opens: the first shell on the pilot, the rest scattered
        // round where it was; a pilot that moves once the rings are down is out from under them)
        const tgt = S.target, seed = S.cycle * 64 + k;
        const rad = k === 0 ? 0.6 * scat * hash01(e.id, seed) : scat * Math.sqrt(hash01(e.id, seed)), ang = 2 * Math.PI * hash01(e.id, seed + 31);
        const [x, y] = inBounds(S, tgt[0] + Math.cos(ang) * rad, tgt[1] + Math.sin(ang) * rad), to = [x, y, groundAt(hooks, x, y, tgt[2])];
        if (k === 0) S.impact = to.slice();
        const missile = k >= shells, from = muzzle(e, S, missile ? 'l' : 'r'), dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
        launch(state, e, from, to, missile ? num(B.mflight, 1.8) : num(B.flight, 2.6), missile ? 'missile' : 'shell', missile ? 4 + dist * 0.25 : 10 + dist * 0.5, missile ? num(B.mr, 3) : num(B.r, 5), missile ? num(B.mhurt, 22) : num(B.hurt, 45));
        S.n++;
      }
      if (S.n >= shells + missiles && S.t >= shells * gap + missiles * mgap) { S.step = 'reload'; S.t = 0; S.cycle++; say(S, state, 'reloading: its tails are working, behind it', 'boss:reload'); }
      return;
    }
    if (S.step === 'reload') {
      // (the tails at work: the clip played once a stroke, slower by the tails it has lost)
      const slow = (R.slow || [1, 1.8, 3])[Math.min(S.tailsLost, (R.slow || [1, 1.8, 3]).length - 1)], secs = num(R.secs, 7) * slow, strokes = Math.max(1, num(R.strokes, 2));
      S.reloadFor = secs;
      slewAim(S, 'r', 0, 5, 20, dt); slewAim(S, 'l', 0, 5, 20, dt);
      const tails = S.tailsLost < (S.cfg.spots.filter((sp) => sp.part === 'tail').length || 2);
      e.moving = tails; e.locomotion = tails ? 'tails:reload' : 'forward';
      e.gaitPhase = tails ? Math.min(0.999, ((S.t / secs) * strokes) % 1) : 0;
      if (S.t >= secs) { S.step = 'advance'; S.t = 0; stand(e); S.goal = S.impact ? S.impact.slice() : null; say(S, state, 'it walks on to where its shells fell', 'boss:advance'); }
      return;
    }
    if (S.step === 'advance') {
      const G = S.goal, stop = num(A.stop, 3);
      const d = G ? Math.hypot(G[0] - e.transform.pos[0], G[1] - e.transform.pos[1]) : 0;
      if (!G || d <= stop || S.t >= num(A.max, 9)) { S.step = 'aim'; S.t = 0; stand(e); return; }
      const off = turnTo(e, Math.atan2(G[1] - e.transform.pos[1], G[0] - e.transform.pos[0]), num(P.turn, 0.6) * S.k.turn, dt);
      // (it turns on the spot before it walks a heading far off its own)
      if (off < 0.6) { move(e, S, P, num(P.speed, 3.4) * (1 - off / 0.9), dt, hooks); tread(state, e, S, P); }
      else { e.moving = true; e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + dt * 0.25; }
    }
  }

  // THE TANK: drive to a ring round the pilot, lay the gun on it, fire along the line; reload; a salvo now and then
  function stepTank(state, e, S, P, p, dt, hooks) {
    const G = P.gun || {}, R = P.reload || {}, W = P.ram || {};
    const now = state.time || 0, q = p ? p.transform.pos : null;
    S.stunT = Math.max(0, (S.stunT || 0) - dt);
    const toP = q ? Math.atan2(q[1] - e.transform.pos[1], q[0] - e.transform.pos[0]) : e.transform.heading, dist = q ? Math.hypot(q[0] - e.transform.pos[0], q[1] - e.transform.pos[1]) : 0;
    const traverse = num(G.traverse, 20) * S.k.turn, turn = num(P.turn, 0.5) * S.k.turn;
    // (the gun on the pilot: the mount's yaw off the body's heading and its elevation, slewed at its rates)
    const lay = () => {
      if (!q) return;
      // (from its own mount, not the body's middle: a gun off the centreline lays its own line)
      const W = S.cfg.weapons && S.cfg.weapons.r, base = onBody(e, (S.form === 'tank' && W && W.atTank) || (W && W.at) || [0, 0, 3]);
      const m = muzzle(e, S, 'r'), yaw = wrap(e.transform.heading - Math.atan2(q[1] - base[1], q[0] - base[0])) / D2R, h = Math.hypot(q[0] - m[0], q[1] - m[1]), pit = Math.atan2(q[2] + 1.1 - m[2], h) / D2R;
      slewAim(S, 'r', yaw, pit, traverse, dt);
      slewAim(S, 'l', yaw, 10, traverse, dt);
      // (beyond its mount's arc, the hull turns: never broken down)
      if (Math.abs(yaw) > 60 && S.stunT <= 0) turnTo(e, toP, turn, dt);
    };
    // (driven onto, the pilot is run down)
    if (p && e.moving && !p.downed && now - (S.ramT || -9) > num(W.every, 1.5)) {
      const [lf, lr] = local(e, q);
      if (Math.abs(lr) < 2.8 && lf > -3.5 && lf < 4.8) {
        S.ramT = now; p.body.hp = Math.max(0, p.body.hp - num(W.hurt, 30)); p.hitFlash = now; p.lastHitBy = e.id; p.lastHitFrom = e.transform.pos.slice(); if (p.body.hp <= 0) p.downed = true;
        const sg = lr >= 0 ? 1 : -1, c = Math.cos(e.transform.heading), s = Math.sin(e.transform.heading);
        q[0] += s * sg * 2.5; q[1] += -c * sg * 2.5;
        say(S, state, 'run down: keep off its line', 'boss:ram');
      }
    }
    if (S.step === 'drive') {
      const lo = (P.standoff || [12, 22])[0], hi = (P.standoff || [12, 22])[1];
      lay();
      if (S.stunT > 0 || !q) { stand(e); if (S.t > 1 && S.loaded !== false) { S.step = 'lay'; S.t = 0; } return; }
      // (a ring round the pilot: closer when far, back off when near, round it a little each time)
      const mid = (lo + hi) / 2, side = (S.cycle % 2 ? 1 : -1) * 0.5;
      const ga = toP + Math.PI + side, gx = q[0] + Math.cos(ga) * mid, gy = q[1] + Math.sin(ga) * mid, [x, y] = inBounds(S, gx, gy);
      const gd = Math.hypot(x - e.transform.pos[0], y - e.transform.pos[1]);
      if ((dist >= lo && dist <= hi && S.t > 1.5) || gd < 2 || S.t > 7) { S.step = 'lay'; S.t = 0; stand(e); return; }
      const off = turnTo(e, Math.atan2(y - e.transform.pos[1], x - e.transform.pos[0]), turn, dt);
      move(e, S, P, num(P.speed, 5) * Math.max(0.25, 1 - off / 1.2), dt, hooks);
      tread(state, e, S, P);
      return;
    }
    if (S.step === 'lay') {
      stand(e); lay();
      const salvo = P.salvo && (S.cycle + 1) % num(P.salvo.every, 3) === 0;
      const secs = num(G.lay, 1.4) * S.k.lay;
      if (salvo) {
        if (S.t === 0) say(S, state, 'INCOMING: missiles', 'boss:barrage');
        if (S.t >= 1.2) {
          const B = P.salvo, n = num(B.missiles, 6), scat = num(B.scatter, 4) * S.k.spread;
          for (let k = 0; k < n; k++) {
            const seed = 5000 + S.cycle * 64 + k, rad = scat * Math.sqrt(hash01(e.id, seed)), ang = 2 * Math.PI * hash01(e.id, seed + 31);
            const [x, y] = inBounds(S, q[0] + Math.cos(ang) * rad, q[1] + Math.sin(ang) * rad), to = [x, y, groundAt(hooks, x, y, q[2])], from = muzzle(e, S, 'l');
            launch(state, e, from, to, num(B.mflight, 1.8), 'missile', 5 + Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.3, num(B.mr, 3), num(B.mhurt, 22), k * num(B.mgap, 0.2));
          }
          S.step = 'reload'; S.t = 0; S.cycle++;
        }
        return;
      }
      // (the sight line: from the muzzle along the barrel, to the first thing it meets)
      const m = muzzle(e, S, 'r'), A = S.aim.r, yaw = e.transform.heading - A.yaw * D2R, pit = A.pitch * D2R, L = num(G.range, 140);
      const far = [m[0] + Math.cos(yaw) * Math.cos(pit) * L, m[1] + Math.sin(yaw) * Math.cos(pit) * L, m[2] + Math.sin(pit) * L];
      let t = nearestWallT ? nearestWallT(m, far, state.colliders) : null;
      // (the ground under the line: it bursts where the line meets it)
      const gz = q ? q[2] : 0;
      if (far[2] < gz && m[2] > gz) { const tg = (m[2] - gz) / (m[2] - far[2]); if (t == null || tg < t) t = tg; }
      // (the pilot on the line: the round is on it)
      if (q) {
        const v = [far[0] - m[0], far[1] - m[1], far[2] - m[2]], w = [q[0] - m[0], q[1] - m[1], q[2] + 1 - m[2]], vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
        const tp = clamp((v[0] * w[0] + v[1] * w[1] + v[2] * w[2]) / vv, 0, 1), cp = [m[0] + v[0] * tp, m[1] + v[1] * tp, m[2] + v[2] * tp];
        // (its fuze: a round passing within 2 m of the pilot bursts there)
        if (Math.hypot(cp[0] - q[0], cp[1] - q[1], cp[2] - q[2] - 1) < 2 && (t == null || tp < t)) t = tp;
      }
      const hit = t == null ? far : [m[0] + (far[0] - m[0]) * t, m[1] + (far[1] - m[1]) * t, m[2] + (far[2] - m[2]) * t];
      S.lay = { from: m, to: hit, u: Math.min(1, S.t / secs), locked: S.t >= secs * 0.75 };
      if (S.t >= secs) {
        launch(state, e, m, hit, 0.08, 'round', 0, num(G.r, 4), num(G.hurt, 40));
        S.lay = null; S.step = 'reload'; S.t = 0; S.cycle++;
        S.fired = { at: hit, t: now };
      }
      return;
    }
    if (S.step === 'reload') {
      lay();
      const slow = (R.slow || [1, 1.5, 2.2])[Math.min(S.tailsLost, (R.slow || [1, 1.5, 2.2]).length - 1)], secs = num(R.secs, 4) * slow;
      S.reloadFor = secs;
      // (it may still move off while it loads: back on the drive once half loaded)
      if (S.t >= secs) { S.step = 'drive'; S.t = 0; }
      else stand(e);
    }
  }

  // THE SPOTS' BODIES: put where their spots are, hittable from where the pilot stands; what hit them since is theirs
  function placeSpots(state, e, S, p) {
    for (const sp of S.cfg.spots) {
      const B = S.ents[sp.id]; if (!B) continue;
      const R = S.spots[sp.id], live = S.phase !== 'down' && !R.gone && inPhase(sp, S) && (sp.by || 'round') === 'round';
      const at = spotAt(e, S, sp), rr = num(sp.r, 0.8);
      if (sp.part === 'crew') {
        B.transform.pos[0] = at[0]; B.transform.pos[1] = at[1]; B.transform.pos[2] = at[2];
        if (!B.ko) B.transform.heading = wrap(e.transform.heading - num(sp.face, 0) * D2R + ((S.crewAim && S.crewAim[sp.id]) || 0));
        B.vel = [0, 0, 0]; B.bossLive = !S.spots[sp.id].gone; continue;
      }
      B.transform.pos[0] = at[0]; B.transform.pos[1] = at[1]; B.transform.pos[2] = at[2] - rr;
      B.body.hittable = !!(live && p && reachable(e, sp, p));
      B.bossLive = live;
    }
  }
  function readHits(state, e, S, p) {
    const lo = p && Array.isArray(p.rule.loadout) ? p.rule.loadout[p.loadoutIdx || 0] : null, dart = !!(lo && lo.weapon && lo.weapon.stun);
    for (const sp of S.cfg.spots) {
      const B = S.ents[sp.id]; if (!B) continue;
      // (a gunner is a person: what a round or a dart does to it is the combat's and the knockout's; down, it stays down)
      if (sp.part === 'crew') { const R = S.spots[sp.id]; if (!R.gone && (B.ko || B.downed || (B.body && Number.isFinite(B.body.hp) && B.body.hp <= 0))) { R.gone = true; R.t = state.time || 0; say(S, state, `${sp.name || 'a gunner'} is down: that side is open`, 'boss:crew'); } continue; }
      const n = B.hits || 0, was = S.hitN[sp.id] || 0;
      if (n > was) {
        S.hitN[sp.id] = n;
        if (!dart && B.bossLive) { hurtSpot(state, e, S, sp, num(B.lastHitDmg, 10) * (n - was)); S.lastSpotHit = { id: sp.id, t: state.time || 0 }; }
        else if (dart && (!S.said || S.said.on !== 'boss:dart' || (state.time || 0) - S.said.t > 4)) say(S, state, 'a sleep dart does nothing to a machine: take the handgun (hold G)', 'boss:dart');
      }
      // (a machine is never asleep: what a dart or a blow left on its body is taken off)
      if (B.ko || B.koDrowse || B.downed) { B.ko = null; B.koDrowse = null; B.koStun = 0; B.downed = false; B.held = false; }
    }
  }

  // ── THE CARRIER ────────────────────────────────────────────────────────────────────────────────────────────────
  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // a flier moved toward a point at its pace, turned to where it goes
  function fly(d, to, speed, dt) {
    const q = d.transform.pos, v = [to[0] - q[0], to[1] - q[1], to[2] - q[2]], L = Math.hypot(v[0], v[1], v[2]), step = Math.min(L, speed * dt);
    if (L > 1e-6) { for (let k = 0; k < 3; k++) q[k] += (v[k] / L) * step; if (Math.hypot(v[0], v[1]) > 0.05) d.transform.heading = Math.atan2(v[1], v[0]); }
    return L - step;
  }
  // the crew: each live gunner lays a burst on the pilot in its arc and in sight, or on a hacked drone near it
  function stepCrew(state, e, S, P, p, dt) {
    const G = P.crew || {}, now = state.time || 0, A = S.crewAim || (S.crewAim = {}), T = S.crewT || (S.crewT = {});
    const hacked = S.drones.find((d) => d.drone.hacked && !d.gone);
    for (const sp of S.cfg.spots) {
      if (sp.part !== 'crew' || S.spots[sp.id].gone) continue;
      const B = S.ents[sp.id]; if (!B) continue;
      const gun = [B.transform.pos[0], B.transform.pos[1], B.transform.pos[2] + 1.4], face = e.transform.heading - num(sp.face, 0) * D2R, arc = num(sp.arc, 70) * D2R, range = num(G.range, 45);
      const sees = (q) => { const a = Math.atan2(q[1] - gun[1], q[0] - gun[0]); return Math.abs(wrap(a - face)) <= arc && dist3(gun, q) <= range && !sightBlocked(gun, q, state.colliders); };
      // (what it fires on: a hacked drone near it first, the pilot else)
      const tgtD = hacked && dist3(gun, hacked.transform.pos) < range * 0.6 && sees(hacked.transform.pos) ? hacked : null;
      const chest = p ? [p.transform.pos[0], p.transform.pos[1], p.transform.pos[2] + heightOf(p) * 0.6] : null;
      const tgt = tgtD ? tgtD.transform.pos : chest && sees(chest) ? chest : null;
      const R = T[sp.id] || (T[sp.id] = { lay: 0, cool: 0 });
      R.cool = Math.max(0, R.cool - dt);
      if (!tgt) { R.lay = Math.max(0, R.lay - dt); continue; }
      A[sp.id] = wrap(Math.atan2(tgt[1] - gun[1], tgt[0] - gun[0]) - face);
      R.lay += dt; B.aiFire = 1;
      if (R.lay < num(G.lay, 1) || R.cool > 0) continue;
      R.cool = num(G.every, 3); R.lay = 0;
      const n = num(G.burst, 4), F = fx(state);
      for (let k = 0; k < n; k++) {
        const j = (hash01(sp.id, S.cycle * 97 + k + Math.floor(now * 10)) - 0.5) * 1.6;
        F.shells.push({ id: ++F.seq, kind: 'tracer', from: gun, to: [tgt[0] + j, tgt[1] - j, tgt[2] + j * 0.4], t0: now + k * 0.09, T: 0.12, apex: 0, by: e.id });
      }
      B.lastShot = { mode: 'core', t: now, from: gun, to: tgt.slice() };
      if (tgtD) { tgtD.body.hp = Math.max(0, tgtD.body.hp - num(G.hurt, 12) * 1.5); tgtD.hitFlash = now; }
      else if (p && !p.downed) {
        const k = cover(state, gun, p) , dmg = num(G.hurt, 12) * k;
        if (dmg > 0.5) { p.body.hp = Math.max(0, p.body.hp - dmg); p.hitFlash = now; p.hits = (p.hits || 0) + 1; p.lastHitBy = e.id; p.lastHitFrom = gun.slice(); S.pilotHurtT = now; if (p.body.hp <= 0) p.downed = true; }
      }
    }
  }
  // the drones: launched, flown at their jobs, shot down, reprinted
  function dock(state, e, S, d, why) {
    const D = d.drone;
    D.st = 'dock'; D.t = 0; D.hacked = false; D.pkg = null; D.chase = false; D.out = false;
    d.gone = true; d.body.hittable = false; d.team = D.team0; d.downed = false; d.ko = null; d.held = false;
    if (why === 'down') D.reprint = num(S.carrier.drones.reprint, 20);
    d.transform.pos = onBody(e, D.bay);
  }
  function launchDrone(state, e, S, d) {
    const D = d.drone;
    D.st = 'launch'; D.t = 0; D.out = true; D.reprint = 0;
    d.gone = false; d.downed = false; d.body.hp = d.hpMax || d.body.hp; d.body.hittable = true;
    d.transform.pos = onBody(e, D.bay);
  }
  function shotDown(state, e, S, d, why) {
    const D = d.drone, F = fx(state);
    if (D.pkg) { const K = S.pkgs[D.pkg]; if (K) { K.carried = null; K.back = (state.time || 0) + num(S.carrier.restock, 10); } }
    if (D.hacked) say(S, state, 'the hacked drone is down: its package is lost. Wait for another courier', 'boss:hack-lost');
    D.st = 'fall'; D.t = 0; D.vz = 0; d.body.hittable = false; D.hacked = false; D.chase = false; D.pkg = null;
    F.bursts.push({ id: ++F.seq, at: d.transform.pos.slice(), r: 1.2, t: state.time || 0, kind: 'drone' });
  }
  function stepDrones(state, e, S, P, p, dt, hooks) {
    const C = S.carrier.drones || {}, H = C.hunter || {}, Q = C.courier || {}, K = C.chase || {}, now = state.time || 0, home = e.transform.pos;
    const alt = home[2] + num(C.alt, 7), live = (d) => d.drone.out && d.drone.st !== 'fall';
    // (a dart in a drone does nothing; its hp is the combat's, and none left it falls)
    for (const d of S.drones) {
      if (d.ko || d.koDrowse) { d.ko = null; d.koDrowse = null; d.koStun = 0; d.held = false; if (d.downed && d.body.hp > 0) d.downed = false; }
      if (live(d) && (d.downed || d.body.hp <= 0)) shotDown(state, e, S, d);
    }
    // (launches: a courier when none is out, every so often; hunters kept out, the two its chase may take besides)
    const couriers = S.drones.filter((d) => d.drone.role === 'courier'), hunters = S.drones.filter((d) => d.drone.role === 'hunter');
    S.courierT = (S.courierT || 0) + dt;
    if (!couriers.some(live) && S.courierT >= num(Q.every, 15)) { const d = couriers.find((x) => x.drone.st === 'dock' && x.drone.reprint <= 0); if (d) { launchDrone(state, e, S, d); S.courierT = 0; say(S, state, 'a courier is out: its link is weak. Hold the RF gun on it', 'boss:courier'); } }
    for (const d of hunters) if (d.drone.st === 'dock' && d.drone.reprint <= 0 && hunters.filter(live).length < num(H.most, 2)) launchDrone(state, e, S, d);
    const hacked = couriers.find((d) => d.drone.hacked && live(d));
    // (the chase: from the delivery after `after`, its hunters go after a hacked courier)
    if (hacked && S.deliveries >= num(K.after, 1)) {
      let n = hunters.filter((d) => live(d) && d.drone.chase).length;
      for (const d of hunters) if (n < num(K.most, 2) && live(d) && !d.drone.chase) { d.drone.chase = true; n++; if (!S.chaseSaid) { S.chaseSaid = true; say(S, state, 'its drones are after the hacked one: shoot them off it', 'boss:chase'); } }
      // (more launched to chase, its bays permitting)
      if (n < num(K.most, 2)) { const d = hunters.find((x) => x.drone.st === 'dock' && x.drone.reprint <= 0); if (d) { launchDrone(state, e, S, d); d.drone.chase = true; } }
    }
    for (const d of S.drones) {
      const D = d.drone; D.t += dt;
      if (D.st === 'dock') { D.reprint = Math.max(0, (D.reprint || 0) - dt); d.transform.pos = onBody(e, D.bay); continue; }
      if (D.st === 'fall') {
        D.vz = (D.vz || 0) - 9.81 * dt; d.transform.pos[2] += D.vz * dt;
        const g = groundAt(hooks, d.transform.pos[0], d.transform.pos[1], 0);
        if (d.transform.pos[2] <= g + 0.1) { d.transform.pos[2] = g + 0.1; if (D.t > 1.5) dock(state, e, S, d, 'down'); }
        continue;
      }
      if (D.st === 'launch') {
        // (out of its bay's open end, down and away, then up to its height)
        const b = onBody(e, D.bay), out = [b[0] + (b[0] - home[0]) * 0.6, b[1] + (b[1] - home[1]) * 0.6, alt];
        if (fly(d, out, num(C.speed, 9) * 0.7, dt) < 0.5) { D.st = D.role === 'courier' ? 'lap' : 'patrol'; D.t = 0; }
        continue;
      }
      const speed = num(C.speed, 9);
      if (D.role === 'courier' && !D.hacked) {
        if (D.st === 'lap') {
          // (a lap round it, out a while, then home)
          const r = num(Q.orbit, 16), a = num(D.phase, 0) + now * num(Q.speed, 7) / r;
          fly(d, [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r, alt - 1], num(Q.speed, 7) * 1.4, dt);
          if (D.t >= num(Q.stay, 35)) { D.st = 'home'; D.t = 0; }
        } else if (D.st === 'home') { if (fly(d, onBody(e, D.bay), num(Q.speed, 7), dt) < 0.4) dock(state, e, S, d, 'home'); }
        continue;
      }
      if (D.role === 'courier' && D.hacked) { stepHacked(state, e, S, P, d, dt); continue; }
      // A HUNTER: its chase, its attack, its patrol
      if (D.chase && hacked) {
        const q = hacked.transform.pos, h = hacked.transform.heading, back = [q[0] - Math.cos(h + num(D.phase, 0) * 0.3) * 6, q[1] - Math.sin(h + num(D.phase, 0) * 0.3) * 6, q[2] + 1];
        fly(d, back, speed * 1.1, dt);
        D.cool = Math.max(0, (D.cool || 0) - dt);
        if (D.cool <= 0 && dist3(d.transform.pos, q) < num(K.range, 16) && !sightBlocked(d.transform.pos, q, state.colliders)) {
          D.cool = num(K.every, 1.6); hacked.body.hp = Math.max(0, hacked.body.hp - num(K.hurt, 15)); hacked.hitFlash = now;
          const F = fx(state); F.shells.push({ id: ++F.seq, kind: 'tracer', from: d.transform.pos.slice(), to: q.slice(), t0: now, T: 0.1, apex: 0, by: e.id });
        }
        continue;
      }
      if (D.chase && !hacked) D.chase = false;
      const q = p ? p.transform.pos : null, see = num(H.see, 26);
      const chest = q ? [q[0], q[1], q[2] + heightOf(p) * 0.7] : null;
      const sees = chest && Math.hypot(chest[0] - d.transform.pos[0], chest[1] - d.transform.pos[1]) < see && !sightBlocked(d.transform.pos, chest, state.colliders);
      const Dr = H.drop || {};
      D.dropCool = Math.max(0, (D.dropCool == null ? num(Dr.every, 8) * 0.5 : D.dropCool) - dt);
      if (sees && D.dropCool <= 0) {
        // (over the pilot, and a grenade let go: its ring where it will land)
        const over = [q[0], q[1], q[2] + num(C.alt, 7)];
        if (fly(d, over, speed, dt) < 1.5) {
          D.dropCool = num(Dr.every, 8);
          launch(state, e, d.transform.pos, [q[0], q[1], q[2]], num(Dr.flight, 1.2), 'grenade', 0, num(Dr.r, 3), num(Dr.hurt, 16));
          if (!S.dropSaid) { S.dropSaid = true; say(S, state, 'a drone over you: it drops grenades. Get under something or move', 'boss:drop'); }
        }
        continue;
      }
      const r = num(C.orbit, 20), a = num(D.phase, 0) - now * speed / r * 0.5;
      fly(d, [home[0] + Math.cos(a) * r, home[1] + Math.sin(a) * r, alt + (D.phase || 0) % 2], speed * 0.6, dt);
    }
  }
  // a hacked courier: to the nearest package, down onto it, up with it, home to a door, and in
  function stepHacked(state, e, S, P, d, dt) {
    const D = d.drone, speed = num((S.carrier.drones.courier || {}).speed, 7) * 1.2, now = state.time || 0, alt = e.transform.pos[2] + num(S.carrier.drones.alt, 7);
    if (D.st === 'fetch') {
      let K = D.pkg ? S.pkgs[D.pkg] : null;
      if (!K) { let best = Infinity; for (const k in S.pkgs) { const x = S.pkgs[k]; if (x.carried || now < x.back) continue; const dd = dist3(x.at, d.transform.pos); if (dd < best) { best = dd; K = x; } } if (K) D.pkg = K.id; }
      if (!K) { fly(d, [d.transform.pos[0], d.transform.pos[1], alt], speed, dt); return; }
      const over = [K.at[0], K.at[1], K.at[2] + 1.3], above = [K.at[0], K.at[1], alt];
      const far = Math.hypot(K.at[0] - d.transform.pos[0], K.at[1] - d.transform.pos[1]);
      if (far > 1) fly(d, above, speed, dt);
      else if (fly(d, over, speed * 0.4, dt) < 0.2) { D.st = 'pick'; D.t = 0; }
      return;
    }
    if (D.st === 'pick') {
      if (D.t >= 1.4) { const K = S.pkgs[D.pkg]; K.carried = d.id; D.st = 'carry'; D.t = 0; say(S, state, 'it has the package: it goes home for repair', 'boss:carry');
        // (the door it goes in by: one whose gunner is down, else the nearer)
        const open = Object.keys(S.carrier.doors || {}).filter((sd) => !S.cfg.spots.some((sp) => sp.part === 'crew' && sp.door === sd && !S.spots[sp.id].gone));
        const doors = open.length ? open : Object.keys(S.carrier.doors || { r: [0, 1.5, 7] });
        D.door = doors.reduce((a, b) => (dist3(onBody(e, S.carrier.doors[a]), d.transform.pos) <= dist3(onBody(e, S.carrier.doors[b]), d.transform.pos) ? a : b));
      }
      return;
    }
    if (D.st === 'carry') {
      const dr = S.carrier.doors[D.door], at = onBody(e, dr), out = onBody(e, [dr[0], dr[1] + Math.sign(dr[1] || 1) * 7, dr[2]]);
      if (!D.inbound) { const left = fly(d, [out[0], out[1], Math.max(at[2], alt - 1)], speed, dt); if (left < 0.8) D.inbound = true; }
      else if (fly(d, at, speed * 0.7, dt) < 0.4) {
        // IN THE DOOR: it goes off
        const Dl = S.carrier.delivery || {}, K = S.pkgs[D.pkg];
        if (K) { K.carried = null; K.back = now + num(S.carrier.restock, 10); }
        D.pkg = null; D.hacked = false; D.inbound = false;
        S.deliveries++;
        const F = fx(state); F.bursts.push({ id: ++F.seq, at: at.slice(), r: num(Dl.r, 4) * 1.4, t: now, kind: 'wreck' });
        burst(state, e, S, at, num(Dl.r, 4), 0, 'delivery');
        say(S, state, `delivered: it went off in its hangar (${S.deliveries})`, 'boss:delivery');
        hurtCore(state, e, S, num(Dl.core, 110));
        if (S.phase !== 'down') dock(state, e, S, d, 'down');
        for (const x of S.drones) x.drone.chase = false;
      }
    }
  }
  // THE RF GUN: held on a courier, it hacks it; off it, the hack drains
  function stepHack(state, e, S, P, p, input, dt) {
    const Hk = S.carrier.hack || {}, now = state.time || 0;
    const lo = p && Array.isArray(p.rule.loadout) ? p.rule.loadout[p.loadoutIdx || 0] : null, rf = !!(lo && lo.weapon && lo.weapon.jam) && !!(p.weapon);
    const L = p && p.lastShot, onIt = rf && input && input.fire && L && now - L.t < num(Hk.slip, 0.25) ? state.byId[L.targetId] : null;
    const tgt = onIt && onIt.drone && onIt.drone.out && !onIt.drone.hacked && onIt.drone.st !== 'fall' ? onIt : null;
    S.jam = S.jam || { id: null, u: 0 };
    if (tgt && tgt.drone.role === 'courier') {
      if (S.jam.id !== tgt.id) S.jam = { id: tgt.id, u: 0 };
      // (a gunner's burst on the pilot shakes the beam off)
      const shaken = S.pilotHurtT != null && now - S.pilotHurtT < 0.5;
      S.jam.u = Math.min(1, S.jam.u + (shaken ? -dt * 0.5 : dt / num(Hk.secs, 2)));
      S.jam.on = true;
      if (S.jam.u >= 1) {
        const D = tgt.drone; D.hacked = true; D.st = 'fetch'; D.t = 0; D.pkg = null; D.inbound = false; tgt.team = p.team || 'pilot';
        tgt.body.hittable = false;
        S.jam = { id: null, u: 0 }; S.chaseSaid = false;
        say(S, state, S.deliveries >= num((S.carrier.drones.chase || {}).after, 1) ? 'hacked: it goes for a package. Keep its chasers off it' : 'hacked: it goes for a package, then home "for repair"', 'boss:hack');
      }
      return;
    }
    S.jam.on = false;
    S.jam.u = Math.max(0, S.jam.u - dt * num(Hk.decay, 0.35));
    if (tgt && tgt.drone.role !== 'courier' && (!S.said || S.said.on !== 'boss:hardened' || now - S.said.t > 4)) say(S, state, 'its link is hardened: only a courier (green light) can be jammed', 'boss:hardened');
    if (!rf && onIt && onIt.drone && onIt.drone.role === 'courier' && !onIt.drone.hacked && (!S.said || now - S.said.t > 5)) say(S, state, 'shot down, a courier is wasted: take the RF gun (hold G) and hold it on one', 'boss:waste');
  }
  function stepCarrier(state, e, S, P, p, input, dt, hooks) {
    stand(e);
    if (P.turn && p) turnTo(e, Math.atan2(p.transform.pos[1] - e.transform.pos[1], p.transform.pos[0] - e.transform.pos[0]), P.turn, dt);
    if (S.t === 0) say(S, state, 'the brood walker: its gunners first, then turn its own drones on it', 'boss:phase');
    stepCrew(state, e, S, P, p, dt);
    stepHack(state, e, S, P, p, input, dt);
    stepDrones(state, e, S, P, p, dt, hooks);
    for (const k in S.pkgs) { const K = S.pkgs[k]; if (K.carried) { const d = state.byId[K.carried]; if (d) K.pos = [d.transform.pos[0], d.transform.pos[1], d.transform.pos[2] - 0.6]; } else K.pos = K.at.slice(); }
  }
  // its carrier's things: its drones' bodies, its packages
  function initCarrier(state, e, S) {
    const P = Object.values(S.cfg.phases).find((x) => x.kind === 'carrier');
    if (!P) return;
    S.carrier = P; S.deliveries = 0;
    S.drones = state.entities.filter((x) => x.rule && x.rule.bossDrone && x.rule.bossDrone.boss === e.id);
    S.drones.forEach((d, i) => { const B = d.rule.bossDrone; d.drone = { role: B.role, bay: B.bay, phase: i * 1.7, st: 'dock', t: 0, reprint: i * 0.6, team0: d.team }; d.gone = true; d.body.hittable = false; d.alarmFound = true; });
    S.pkgs = Object.fromEntries((P.packages || []).map((k) => [k.id, { id: k.id, at: k.at.slice(), pos: k.at.slice(), carried: null, back: 0 }]));
  }

  function init(state, e) {
    const C = e.rule.boss, spots = Array.isArray(C.spots) ? C.spots : [];
    const S = {
      cfg: { ...C, spots }, phase: null, step: null, t: 0, cycle: 0, n: 0, form: 'walker', aim: { r: { yaw: 0, pitch: 0 }, l: { yaw: 0, pitch: 0 } },
      spots: Object.fromEntries(spots.map((sp) => [sp.id, { hp: Number.isFinite(sp.hp) ? sp.hp : Infinity, max: Number.isFinite(sp.hp) ? sp.hp : Infinity, gone: false }])),
      ents: {}, hitN: {}, tailsLost: 0, hp: num(C.hp, 300), hpMax: num(C.hp, 300), k: { turn: 1, spread: 1, lay: 1 }, stunT: 0, said: null, mineSeen: null,
    };
    for (const x of state.entities) if (x.rule && x.rule.bossSpot && x.rule.bossSpot.boss === e.id) { S.ents[x.rule.bossSpot.spot] = x; x.alarmFound = true; S.hitN[x.rule.bossSpot.spot] = x.hits || 0; }
    e.boss = S;
    initCarrier(state, e, S);
    begin(state, e, S, C.start && C.phases[C.start] ? C.start : Object.keys(C.phases)[0]);
    return S;
  }

  E.stepWorld = function stepWithBoss(state, input, dt, hooks) {
    const bosses = state.entities.filter((e) => e.rule && e.rule.boss && e.rule.boss.phases);
    if (!bosses.length) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    const p = pilotOf(state);
    for (const e of bosses) { const S = e.boss || init(state, e); placeSpots(state, e, S, p); }
    const out = step(state, input, dt, hooks);
    for (const e of bosses) {
      const S = e.boss;
      readHits(state, e, S, p);
      layMines(state, p, S); crates(state, p, S);
      const P = S.cfg.phases[S.phase], live = p && !p.downed && !p.gone ? p : null;
      if (S.phase === 'down') { S.t += dt; stand(e); continue; }
      // (the pilot down: it stands over it, its guns lowered)
      if (!live) { stand(e); S.t += dt; continue; }
      if (S.phase === 'fall') {
        // (a beat of staggering: the body rocks on what is left of its legs; then its fold)
        e.bossTilt = Math.sin(S.t * 9) * 0.04 * (1 - S.t / 1.6);
        S.t += dt;
        if (S.t >= num((S.cfg.phases[S.from] || {}).fall, 1.6)) { e.bossTilt = 0; S.fromPhase = S.from; begin(state, e, S, 'transform'); }
        continue;
      }
      if (S.phase === 'transform') {
        e.moving = true; e.locomotion = 'transform:tank'; e.gaitPhase = Math.min(0.999, S.t / S.fold); e.transformT = e.gaitPhase;
        S.t += dt;
        if (S.t >= S.fold) { e.transformT = null; begin(state, e, S, S.toPhase); }
        continue;
      }
      if (!P) continue;
      if (P.kind === 'carrier') stepCarrier(state, e, S, P, live, input, dt, hooks);
      else if (P.kind === 'tank') stepTank(state, e, S, P, live, dt, hooks);
      else stepStand(state, e, S, P, live, dt, hooks);
      S.t += dt;
    }
    landShells(state);
    for (const e of bosses) placeSpots(state, e, e.boss, p);
    return out;
  };

  // what the page and a check read: the boss's phase, step, parts and what it last said
  E.bossFacts = function bossFacts(state, id) {
    const e = id ? state.byId[id] : state.entities.find((x) => x.boss);
    const S = e && e.boss; if (!S) return null;
    return { id: e.id, phase: S.phase, step: S.step, t: S.t, cycle: S.cycle, form: S.form, hp: S.hp, hpMax: S.hpMax, tailsLost: S.tailsLost, stun: S.stunT, reloadFor: S.reloadFor || null,
      spots: Object.fromEntries(Object.entries(S.spots).map(([k, v]) => [k, { hp: Number.isFinite(v.hp) ? Math.round(v.hp) : null, max: Number.isFinite(v.max) ? v.max : null, gone: v.gone }])), said: S.said,
      ...(S.carrier ? { deliveries: S.deliveries, jam: S.jam ? { id: S.jam.id, u: Math.round(S.jam.u * 100) / 100 } : null, drones: Object.fromEntries(S.drones.map((d) => [d.id, { role: d.drone.role, st: d.drone.st, hacked: !!d.drone.hacked, chase: !!d.drone.chase, hp: d.body.hp }])), crew: Object.fromEntries(S.cfg.spots.filter((sp) => sp.part === 'crew').map((sp) => [sp.id, !S.spots[sp.id].gone])) } : {}) };
  };
}
