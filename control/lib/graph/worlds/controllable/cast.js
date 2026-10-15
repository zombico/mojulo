/**
 * cast.js — the CAST: what the event bus may do to a character, and what a character tells the bus back.
 *
 *   castOps(state, ops)   apply the bus's queued character intents (event-bus `ctrl` verb, handed over by syncToCtrl),
 *                         in order. Each op is { op, who, … }; an unknown who is a no-op:
 *     spawn { at?, face? }    wake one minted asleep (`dormant`) or sent away: shown, revived, placed where it's told; a
 *                         mind starts its life clean (no sighting, search, cover, path, grudge or health phase)
 *     vanish                  send one away (asleep again: hidden, unhittable, its rule held)
 *     kill                    it falls (`downed`; hp to 0 when it has hp); its rule is held while it lies
 *     hurt { by } / heal { by? }   its body.hp, floored at 0 (a fall) and capped at its hpMax (heal with no by: full)
 *     rearm { by? }           rounds for the weapon in its hand: `by` more in its reserve (a reload draws them), or with
 *                         no reserve (an endless reload) or no by, the magazine full
 *     arm { slot, draw? }     a weapon picked up: its loadout slot (an index or its `name`) carried from now (a slot
 *                         `held: false` waits for it) and in hand unless draw is false; one carried already: its rounds
 *                         full again
 *     spawn { fresh }         (fresh) the life starts with the loadout it was minted with: the slots it holds at the
 *                         start, the first in hand, every round back
 *     spawn { among, guard }  (among: [[x, y, z?], …]) at the one farthest from the living (the nearest other standing
 *                         body; a tie to the first): nobody stands up in front of the gun that felled them. (guard)
 *                         that many seconds no round or blade hurts it, or until it fires (the spawn guard)
 *     walk { points, names?, speed?, then?, face?, pose?, reach? }   a DUMB PATH: straight lines from point to point
 *                         (turn toward it, step, ground snap, collider push-out); `then` at the last point: 'stay' (hold
 *                         there, take `face` / `pose`), 'loop', 'back' (walk the points back, then stay)
 *     stop                    end a walk or a hold
 *     status { is, for?, color? }   (color: [r, g, b], or a burning element's colorant) it carries an element (playscape/elements) from now, for `for` seconds or until
 *                         lifted: e.statuses[is] = { t0, until, color? } on the world clock (the page draws it)
 *     lift { is? }            take one status off, or all of them
 *     spawn / vanish { with? }   a TRANSIT the page plays as it comes or goes (smoke, hologram, scan, transporter):
 *                         e.transit = { is, dir: 'in' | 'out', t0 }
 *     transfigure { into, with? }   who becomes into (minted asleep): into wakes where who stands, facing as it faces,
 *                         who goes; both carry the transit (default galvatron), linked by `to` / `from`
 *     puff { at?, is?, color?, shake?, spec?, scale? }   a moment at a place or at who's feet (state.moments: { is, at,
 *                         t0, color? }, kept 3 s); shake: the camera shakes too; spec: an explosion (its parts, kept
 *                         its dur; a chain is several, scattered and staggered), scale sizing it
 *     shot { shot }           (no who) the camera's rule is set aside for a directing `shot` rule (rules-basic): shot is
 *                         { frame, on, move?, … }; a second shot replaces the first and keeps the player's rule aside
 *     unshot                  (no who) the camera's own rule back: it eases from where the shot left it
 *     finish                  (no who) every walk lands where it was going (a skipped scene): its last point, its face and
 *                         pose, and the arrive fact; a looping walk keeps walking
 *     shake { k, for? }       (no who) the camera shakes k (0..1) over for seconds: a moment { is: 'shake', k, for, t0 }
 *     beam { to, spec, land, name?, color? }   who fires an attack (playscape/elements/beams.js) from its hand (or over
 *                         its head, a charge `at: above`) at a character (its middle, where it stands now) or a point: a
 *                         moment { is: 'beam', from, to, target?, spec, hit, until }; it lands at hit (the least a + b ×
 *                         distance of `land`), its impact and shake are moments then, and `struck` fires on a target
 *   castFacts(state, prev) → { events, prev }   edge-detected happenings, as bus events with `entity`:
 *     down · gone · spawned · arrive { at: the point's name, last: 1 | 0, pose? } · stuck · faded { is } (a status ran
 *     out, here, or was lifted) · struck { by, beam } (a beam reached it) · hit:<id> { by, dmg?, harm?, head? } once per
 *     hit it took (a blade, a round, a splash, a tackle: its `hits` count; `by` the last hitter; a round's damage, its
 *     negative and 1 for the head), what hp-pool reads
 *     (the first read seeds; nothing a world was minted with fires)
 *
 * A walk is a BODY OWNER (the rule waits while it walks or holds); so is a cast fall. A second of walking that closes
 * less than a sixth of its pace is stuck: the walk drops and `stuck` fires (a solid body in the way, a wall).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core precedes it in EMISSION. Field ownership:
 * e.route, e.held, e.pose, e.castDown, e.arrivals, e.arrivedAt, e.arrivedLast, e.stucks, e.statuses, e.faded, e.transit; state.moments.
 */

export function buildCast(E) {
  const { TAU, clamp, resolveBlocking, registerBodyOwner, initWeapon } = E;
  const DEG = Math.PI / 180;

  function stepRoute(e, dt, world) {
    const R = e.route, t = e.transform, r = e.rule || {};
    const p = R.points[R.i];
    const dx = p[0] - t.pos[0], dy = p[1] - t.pos[1], d = Math.hypot(dx, dy);
    if (d <= R.reach) {
      const last = R.i === R.points.length - 1;
      e.arrivals = (e.arrivals || 0) + 1; e.arrivedAt = R.names[R.i]; e.arrivedLast = last && R.then !== 'loop' && !(R.then === 'back' && !R.back);
      if (!last) R.i++;
      else if (R.then === 'loop') R.i = 0;
      else if (R.then === 'back' && !R.back) { R.points = R.points.slice().reverse(); R.names = R.names.slice().reverse(); R.back = true; R.i = R.points.length > 1 ? 1 : 0; }
      else {
        e.route = null; e.held = true;
        if (R.face != null) t.heading = R.face;
        e.pose = R.pose || null;
      }
      R.best = Infinity; R.watch = 0;
      e.moving = false;
      return;
    }
    // stuck: a second that closes less than a sixth of the pace (the post-step pushes have already landed)
    R.watch += dt;
    if (d < R.best) { if (R.best - d >= R.speed / 6 || R.best === Infinity) { R.best = d; R.watch = 0; } }
    if (R.watch >= 1) { e.route = null; e.stucks = (e.stucks || 0) + 1; e.moving = false; return; }
    const want = Math.atan2(dy, dx);
    const dh = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    t.heading = (t.heading + clamp(dh, -R.turn * dt, R.turn * dt)) % TAU;
    const stp = Math.min(R.speed * dt, d);
    t.pos[0] += dx / d * stp; t.pos[1] += dy / d * stp;
    const eye = r.eye ?? 0;
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 1.8, r.collideRadius ?? 0.3, world.colliders, r.step ?? 0.35);
    if (world && world.ground) { const g = world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 1.8)]); if (g != null) t.pos[2] = g + eye; }
    e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + stp / (r.stride ?? 2.4); e.moving = true;
  }

  // the cast holds the body while it walks a path, holds a spot, or lies where it was felled
  registerBodyOwner('cast', (e, input, dt, state, world) => {
    if (e.castDown) { e.moving = false; return true; }
    if (e.route) {
      if (e.downed || e.gone) { e.route = null; return false; }
      if (e.staggerT == null && !e.dropping && !e.climbing) stepRoute(e, dt, world);   // a reel, a drop-in or a climb has the body this frame
      return true;
    }
    return !!e.held;
  }, 200);

  const pt3 = (p, z) => [p[0], p[1], Number.isFinite(p[2]) ? p[2] : z];
  // where a character stands: its eye above its feet, or half its height
  const feet = (e) => { const p = e.transform.pos, r = e.rule || {}, b = e.body || {}; return [p[0], p[1], p[2] - (Number.isFinite(r.eye) ? r.eye : Array.isArray(b.size) ? b.size[2] / 2 : Number.isFinite(b.radius) ? b.radius : 0)]; };
  // a moment: kept 3 s on the world clock
  function moment(state, m) { const t = state.time || 0; state.moments = (state.moments || []).filter((x) => t < (x.until != null ? x.until : x.t0 + 3)).concat([{ t0: t, ...m }]); }
  // a puff, or an explosion (o.spec, playscape/elements/explosions.js): a chain is count blasts scattered round the
  // spot by seeded dice, one after another; a scale sizes it (and its spread)
  function puff(state, o, at, t0 = state.time || 0) {
    const X = o.spec || null, sc = Number.isFinite(o.scale) ? o.scale : 1, C = X && X.chain, n = C ? C.count : 1;
    for (let j = 0; j < n; j++) {
      const d = (k) => { const x = Math.sin(j * 12.9898 + k * 78.233 + 5.1) * 43758.5453; return x - Math.floor(x); };
      const a = d(1) * TAU, r = j && C ? C.spread * sc * Math.sqrt(d(2)) : 0, tj = t0 + (C ? j * C.stagger : 0);
      moment(state, { is: typeof o.is === 'string' ? o.is : 'smoke', at: [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, at[2]], t0: tj, ...(X ? { spec: X, until: tj + X.dur + 0.2 } : {}), ...(sc !== 1 ? { scale: sc } : {}), ...(o.color !== undefined ? { color: o.color } : {}) });
    }
    const k = Number.isFinite(o.shake) && o.shake > 0 ? o.shake : X && X.shake ? X.shake : 0;
    if (k) moment(state, { is: 'shake', at: at.slice(), k: Math.min(1, k * Math.sqrt(sc)), for: C ? 0.4 + C.stagger * (n - 1) : 0.4, t0 });
  }
  // a body's loadout (a seat's pilot rule carries it, else its own rule), and its weapons as minted: rounds full
  const loadoutOf = (e) => (e.pilotRule && Array.isArray(e.pilotRule.loadout) ? e.pilotRule.loadout : e.rule && Array.isArray(e.rule.loadout) ? e.rule.loadout : null);
  function refill(w, cfg) { const f = initWeapon(cfg || null); if (w && f) { w.ammo = f.ammo; w.reserve = f.reserve; w.reloading = false; w.reloadT = 0; w.burstLeft = 0; } }
  function castOps(state, ops) {
    for (const o of ops || []) {
      // a SHOT (the scene layer): the player's camera rule held aside while a directing shot plays; unshot gives it back
      if (o && o.op === 'shot' && o.shot && state.camera) {
        const C = state.camera;
        if (!C.heldRule) C.heldRule = C.rule;
        C.rule = { ...o.shot, type: 'shot' }; C._shotT = 0; C._shotAt = null; C._shotSide = null; C._shotTry = null; C._shotCut = o.shot.cut !== false;
        continue;
      }
      if (o && o.op === 'finish') {
        for (const w of state.entities) {
          const R = w.route;
          if (!R || R.then === 'loop') continue;
          if (R.then === 'back' && !R.back) { R.points = R.points.slice().reverse(); R.names = R.names.slice().reverse(); R.back = true; }
          R.i = R.points.length - 1;
          const p = R.points[R.i];
          w.transform.pos[0] = p[0]; w.transform.pos[1] = p[1];
          stepRoute(w, 0, state);
        }
        continue;
      }
      if (o && o.op === 'unshot') { const C = state.camera; if (C && C.heldRule) { C.rule = C.heldRule; C.heldRule = null; } continue; }
      if (o && o.op === 'shake') { moment(state, { is: 'shake', at: [0, 0, 0], k: Number.isFinite(o.k) ? o.k : 0.5, for: Number.isFinite(o.for) ? o.for : 0.4 }); continue; }
      if (o && o.op === 'puff' && !o.who && Array.isArray(o.at)) { puff(state, o, pt3(o.at, 0)); continue; }   // a puff at a place, no one there
      const e = o && state.byId[o.who];
      if (!e || e.isCamera) continue;
      const t = state.time || 0;
      if (o.op === 'transfigure') {
        const B = state.byId[o.into];
        if (!B || B === e || B.isCamera || e.gone) continue;
        const is = typeof o.with === 'string' ? o.with : 'galvatron';
        castOps(state, [{ op: 'spawn', who: B.id, at: e.transform.pos.slice(), face: (e.transform.heading || 0) / DEG }, { op: 'vanish', who: e.id }]);
        e.transit = { is, dir: 'out', t0: t, to: B.id }; B.transit = { is, dir: 'in', t0: t, from: e.id };
        continue;
      }
      if (o.op === 'puff') { puff(state, o, Array.isArray(o.at) ? pt3(o.at, 0) : feet(e)); continue; }
      if (o.op === 'beam') {
        if (e.gone || !o.spec) continue;
        // from the hand (forward of it, at chest height), or over the head; at a character's middle, or a point
        const f = feet(e), h = e.transform.heading || 0, above = o.spec.charge && o.spec.charge.at === 'above';
        const from = above ? [f[0], f[1], f[2] + 2.7] : [f[0] + Math.cos(h) * 0.45, f[1] + Math.sin(h) * 0.45, f[2] + 1.15];
        const T = typeof o.to === 'string' ? state.byId[o.to] : null;
        if (typeof o.to === 'string' && (!T || T.gone)) continue;
        const to = T ? T.transform.pos.slice() : pt3(o.to, 0), D = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
        const hit = t + Math.min(...(o.land || [[0, 0]]).map(([a, b]) => a + b * D));
        moment(state, { is: 'beam', at: from, from, to, ...(T ? { target: T.id } : {}), by: e.id, name: o.name || null, spec: o.spec, ...(o.color !== undefined ? { color: o.color } : {}), hit, until: hit + 8 });
        const land = T ? feet(T) : to;
        if (o.spec.impact) puff(state, { is: o.spec.impact, ...(o.spec.impactSpec ? { spec: o.spec.impactSpec } : {}), ...(o.color !== undefined ? { color: o.color } : {}) }, land, hit);
        if (o.spec.shake) moment(state, { is: 'shake', at: land, k: o.spec.shake, for: 0.4, t0: hit });
        continue;
      }
      if (o.op === 'spawn') {
        if (typeof o.with === 'string') e.transit = { is: o.with, dir: 'in', t0: t };
        e.dormant = false; e.gone = false; e.downed = false; e.castDown = false; e.route = null; e.held = false; e.pose = null;
        // a fresh life: what its mind knew and was doing goes (a sighting, a search, a cover spot, a path, a match's
        // grudges and leads, a crossed health phase); the hits it took before are not a new hit
        if (e.rule && e.rule.type === 'ai') {
          e.lastSeen = null; e.searchT = null; e.coverAt = null; e.coverUntil = null; e.navPath = null; e.mindPhase = null;
          e.fragTarget = null; e.fragLead = null; e.fragGrudge = null; e.fragHunch = null; e.peek = null;
          e.coverHits = e.fragHits = e.hits || 0;
        }
        if (Number.isFinite(e.hpMax) && e.body) { e.body.hp = e.hpMax; e.body.hittable = true; }
        if (Array.isArray(o.among) && o.among.length) {
          let best = null, bd = -1;
          for (const s of o.among) {
            if (!Array.isArray(s)) continue;
            let dmin = Infinity;
            for (const x of state.entities) {
              if (x === e || x.isCamera || x.downed || x.gone || x.dormant || !(x.body && x.body.hittable)) continue;
              dmin = Math.min(dmin, Math.hypot(x.transform.pos[0] - s[0], x.transform.pos[1] - s[1]));
            }
            if (dmin > bd) { bd = dmin; best = s; }
          }
          if (best) e.transform.pos = pt3(best, e.transform.pos[2]);
        } else if (Array.isArray(o.at)) e.transform.pos = pt3(o.at, e.transform.pos[2]);
        if (Number.isFinite(o.guard) && o.guard > 0) { e.spawnGuard = true; e.spawnGuardT = o.guard; e.invincible = true; }   // combat-match's spawn-guard ticks it; a shot breaks it
        if (Number.isFinite(o.face)) e.transform.heading = o.face * DEG;
        if (Array.isArray(e.vel)) e.vel = [0, 0, 0];
        const lo = o.fresh ? loadoutOf(e) : null;
        if (lo && e.loadoutWeapons) {
          lo.forEach((c, i) => refill(e.loadoutWeapons[i], c && c.weapon));
          if (e.loadoutHeld) e.loadoutHeld = lo.map((c) => !(c && c.held === false));
          const i0 = e.loadoutHeld ? Math.max(0, e.loadoutHeld.indexOf(true)) : 0;
          e.loadoutIdx = i0; e.weapon = e.loadoutWeapons[i0]; e.aiRangedPick = null;
          if (e.body && lo[i0] && lo[i0].figure) e.body.figure = lo[i0].figure;
        } else if (o.fresh && e.weapon) refill(e.weapon, (e.pilotRule && e.pilotRule.weapon) || (e.rule && e.rule.weapon));
      } else if (o.op === 'arm') {
        const lo = loadoutOf(e);
        if (e.downed || e.gone || !lo || !e.loadoutWeapons) continue;
        const i = Number.isInteger(o.slot) ? o.slot : lo.findIndex((c) => c && c.name === o.slot);
        if (i < 0 || i >= lo.length || !e.loadoutWeapons[i]) continue;
        const had = !e.loadoutHeld || e.loadoutHeld[i];
        refill(e.loadoutWeapons[i], lo[i].weapon);
        if (had) continue;
        e.loadoutHeld[i] = true;
        if (o.draw !== false && (e.loadoutIdx || 0) !== i) {
          e.loadoutIdx = i; e.weapon = e.loadoutWeapons[i];
          if (e.body && lo[i].figure) e.body.figure = lo[i].figure;
          if (E.armSwitchReady) E.armSwitchReady(e, e.pilotRule || e.rule, lo[i]);   // the maneuvers' (later in EMISSION): a drawn gun is not ready at once
        }
      } else if (o.op === 'vanish') {
        if (typeof o.with === 'string' && !e.gone) e.transit = { is: o.with, dir: 'out', t0: t };
        e.gone = true; e.dormant = true; e.route = null; e.held = false; e.moving = false;
        if (e.body) e.body.hittable = false;
      } else if (o.op === 'kill' || o.op === 'hurt') {
        if (e.downed || e.gone) continue;
        const hp = e.body && Number.isFinite(e.body.hp);
        if (o.op === 'hurt') { if (!hp) continue; e.body.hp = Math.max(0, e.body.hp - (Number.isFinite(o.by) ? o.by : 1)); if (e.body.hp > 0) continue; }
        if (hp) e.body.hp = 0;
        e.downed = true; e.castDown = true; e.route = null; e.held = false; e.moving = false;
      } else if (o.op === 'heal') {
        if (e.downed || !e.body || !Number.isFinite(e.body.hp)) continue;
        const max = Number.isFinite(e.hpMax) ? e.hpMax : e.body.hp;
        e.body.hp = Math.min(max, Number.isFinite(o.by) ? e.body.hp + o.by : max);
      } else if (o.op === 'rearm') {
        const w = e.weapon;
        if (e.downed || !w) continue;
        if (w.reserve != null && Number.isFinite(o.by)) w.reserve += Math.max(0, o.by);
        else { w.ammo = w.magazine; w.reloading = false; w.reloadT = 0; }
      } else if (o.op === 'walk') {
        if (e.downed || e.gone || !Array.isArray(o.points) || !o.points.length) continue;
        const points = o.points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1]]);
        if (!points.length) continue;
        const names = points.map((_, i) => (Array.isArray(o.names) && typeof o.names[i] === 'string' ? o.names[i] : String(i)));
        e.held = false; e.pose = null;
        e.route = {
          points, names, i: 0, back: false, best: Infinity, watch: 0,
          speed: Number.isFinite(o.speed) && o.speed > 0 ? o.speed : (e.rule && e.rule.speed) || 2.5,
          turn: Number.isFinite(o.turn) && o.turn > 0 ? o.turn : 8,
          reach: Number.isFinite(o.reach) && o.reach > 0 ? o.reach : 0.3,
          then: o.then === 'loop' || o.then === 'back' ? o.then : 'stay',
          face: Number.isFinite(o.face) ? o.face * DEG : null, pose: typeof o.pose === 'string' ? o.pose : null,
        };
      } else if (o.op === 'stop') { e.route = null; e.held = false; e.moving = false; }
      else if (o.op === 'status') {
        if (typeof o.is !== 'string' || e.gone) continue;
        const t = state.time || 0;
        (e.statuses || (e.statuses = {}))[o.is] = { t0: t, until: Number.isFinite(o.for) && o.for > 0 ? t + o.for : null, ...(Array.isArray(o.color) ? { color: o.color.slice(0, 3) } : typeof o.color === 'string' ? { color: o.color } : {}) };
      } else if (o.op === 'lift') {
        if (!e.statuses) continue;
        for (const k of Object.keys(e.statuses)) if (o.is == null || o.is === k) { delete e.statuses[k]; (e.faded || (e.faded = [])).push(k); }
      }
    }
  }

  function castFacts(state, prev) {
    const seed = !prev, next = {}, events = [];
    for (const e of state.entities) {
      if (e.isCamera) continue;
      const cur = { d: !!e.downed, g: !!e.gone, a: e.arrivals || 0, s: e.stucks || 0, h: e.hits || 0, n: e.sightings || 0 };
      next[e.id] = cur;
      const p = !seed && prev[e.id];
      if (!p) continue;
      if (cur.d && !p.d) events.push({ type: 'down', entity: e.id });
      if (cur.g && !p.g) events.push({ type: 'gone', entity: e.id });
      if (!cur.g && p.g) events.push({ type: 'spawned', entity: e.id });
      if (cur.a > p.a) events.push({ type: 'arrive', entity: e.id, at: e.arrivedAt, last: e.arrivedLast ? 1 : 0, ...(e.arrivedLast && e.pose ? { pose: e.pose } : {}) });
      if (cur.s > p.s) events.push({ type: 'stuck', entity: e.id });
      if (cur.n > (p.n || 0)) events.push({ type: 'seen', entity: e.id, target: e.seenId || null });
      // a hit's damage (and whether it was to the head) when a round said it (combat-ranged.js): a bus hp takes it
      for (let k = p.h || 0; k < cur.h; k++) events.push({ type: `hit:${e.id}`, entity: e.id, by: e.lastHitBy || null, ...(Number.isFinite(e.lastHitDmg) && e.lastHitDmgN === cur.h ? { dmg: e.lastHitDmg, harm: -e.lastHitDmg, head: e.lastHitHead ? 1 : 0 } : {}) });
      // statuses run out on the world clock; a lifted one was queued by the op
      if (e.statuses) for (const k of Object.keys(e.statuses)) { const u = e.statuses[k].until; if (u != null && (state.time || 0) >= u) { delete e.statuses[k]; (e.faded || (e.faded = [])).push(k); } }
      if (e.faded && e.faded.length) { for (const k of e.faded) events.push({ type: 'faded', entity: e.id, is: k }); e.faded.length = 0; }
    }
    // a block that broke (worlds/controllable rules-basic.js breakables): broke, and broke:<id> for a game to keep it
    if (state.breakables) for (const b of state.breakables) {
      const k = 'blk:' + b.id, was = !seed && prev[k];
      next[k] = !!b.broken;
      if (!seed && b.broken && !was && prev[k] !== undefined && b.broken.how !== 'restore') events.push({ type: 'broke', entity: b.id, how: b.broken.how }, { type: 'broke:' + b.id, entity: b.id });
    }
    // a beam that has reached its character
    for (const M of state.moments || []) if (M.is === 'beam' && M.target && !M.struck && (state.time || 0) >= M.hit) { M.struck = true; if (!seed) events.push({ type: 'struck', entity: M.target, by: M.by, ...(M.name ? { beam: M.name } : {}) }); }
    return { events, prev: next };
  }

  Object.assign(E, { castOps, castFacts });
}
