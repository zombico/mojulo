/**
 * core.js — shared engine substrate (controllable-split.plan.md, S1): the vec/heading math, the
 * frame-rate-independent smoothing, analytic collision (2D footprint + 3D sphere vs AABB), shot
 * occlusion over the same collider boxes, and the RULE registry every rule builder registers into
 * (stepWorld — still in all.js until S3 — looks rules up here at runtime).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; FIRST in EMISSION, so every
 * later builder may destructure these helpers at build time. Attaches pure helpers only — no
 * entity/world state lives here.
 */

export function buildCore(E) {
  // ── vec helpers (inlined so the closure is self-contained for browser emission) ──
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const vcopy = (a) => [a[0], a[1], a[2]];

  // headed basis on the XY plane (z-up). forward = facing; right = forward × up.
  const fwdXY = (h) => [Math.cos(h), Math.sin(h), 0];
  const rightXY = (h) => [Math.sin(h), -Math.cos(h), 0];
  // full forward including pitch (for free-flight / look-driven rules).
  const fwd3 = (h, p) => [Math.cos(p) * Math.cos(h), Math.cos(p) * Math.sin(h), Math.sin(p)];

  // frame-rate-independent smoothing factor for a given rate (1/sec): approaches target without
  // depending on dt size. factor → 1 as dt grows, → rate·dt for small dt.
  const smooth = (rate, dt) => 1 - Math.exp(-Math.max(0, rate) * dt);

  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI / 2;

  // ── LATERAL BLOCKING (the "blocker under the skin") ──
  // A world may carry `colliders` — analytic AABB boxes `{min:[x,y,z], max:[x,y,z]}` that ride
  // UNDER the visual `faces` skin. Vertical footing stays on the ground-raycast hook
  // (rooftops / walk-under); this pushes a moving entity's FOOTPRINT CIRCLE (radius `cr`, a
  // suit's shoulder half-width — NOT the fat hittable `radius`) out of any box whose z-span the
  // body overlaps. Pure + analytic, so headless capture blocks identically. Called after ALL
  // horizontal position writes, before the vertical integrate. No colliders / cr<=0 → no-op, so
  // every pre-collider world moves byte-identically.
  //
  // The z-band gate is what lets blocking coexist with walk-under and stand-on-top:
  //   • skip if footZ >= box.top - step        → on top / above (the ground hook owns standing)
  //   • skip if footZ + height <= box.bottom    → the whole body clears under a raised slab
  // so a hangar ROOF (high box) is walked under while its PILLARS (ground boxes) stay solid.
  function resolveBlocking(pos, footZ, height, cr, colliders, step) {
    if (!colliders || !colliders.length || !(cr > 0)) return;
    for (let k = 0; k < colliders.length; k++) {
      const c = colliders[k];
      const mn = c.min, mx = c.max;
      if (!mn || !mx) continue;
      if (footZ >= mx[2] - step) continue;        // standing on / above the box top
      if (footZ + height <= mn[2]) continue;      // body clears under the box (walk-under)
      const px = pos[0], py = pos[1];
      const insideX = px > mn[0] && px < mx[0];
      const insideY = py > mn[1] && py < mx[1];
      if (insideX && insideY) {
        // center inside the footprint → eject through the nearest wall (least penetration)
        const dL = px - mn[0], dR = mx[0] - px, dD = py - mn[1], dU = mx[1] - py;
        const m = Math.min(dL, dR, dD, dU);
        if (m === dL) pos[0] = mn[0] - cr;
        else if (m === dR) pos[0] = mx[0] + cr;
        else if (m === dD) pos[1] = mn[1] - cr;
        else pos[1] = mx[1] + cr;
      } else {
        // outside → clamp to the nearest edge point; if the circle overlaps it, slide out along
        // the contact normal (proper wall-slide: only the penetrating axis is corrected).
        const nx = px < mn[0] ? mn[0] : px > mx[0] ? mx[0] : px;
        const ny = py < mn[1] ? mn[1] : py > mx[1] ? mx[1] : py;
        const dx = px - nx, dy = py - ny, d2 = dx * dx + dy * dy;
        if (d2 < cr * cr && d2 > 1e-9) {
          const d = Math.sqrt(d2);
          pos[0] = nx + (dx / d) * cr;
          pos[1] = ny + (dy / d) * cr;
        }
      }
    }
  }

  // ── 3D SOLID COLLISION (space) — the SPHERE-vs-AABB eject a floating suit needs ──
  // The ground `resolveBlocking` is an XY footprint with a z-band gate (walk-under / stand-on) — wrong
  // for a suit that floats in 3D. In SPACE the suit is a SPHERE (radius cr); this ejects it out of any
  // solid AABB in FULL 3D and kills the velocity component pointing INTO the box, so it rests against
  // the wall and slides along it instead of tunnelling or jittering. Opt-in via `world.colliders` +
  // `r.collideRadius`; no colliders / cr<=0 → no-op. Pure — headless capture blocks identically.
  function resolveBlocking3D(pos, vel, cr, colliders) {
    if (!colliders || !colliders.length || !(cr > 0)) return;
    for (let k = 0; k < colliders.length; k++) {
      const c = colliders[k];
      const mn = c.min, mx = c.max;
      if (!mn || !mx) continue;
      const px = pos[0], py = pos[1], pz = pos[2];
      const inX = px > mn[0] && px < mx[0], inY = py > mn[1] && py < mx[1], inZ = pz > mn[2] && pz < mx[2];
      if (inX && inY && inZ) {
        // center inside the box → eject along the least-penetration face (6 candidates), zero the
        // velocity into that face.
        const dL = px - mn[0], dR = mx[0] - px, dD = py - mn[1], dU = mx[1] - py, dB = pz - mn[2], dT = mx[2] - pz;
        const m = Math.min(dL, dR, dD, dU, dB, dT);
        if (m === dL) { pos[0] = mn[0] - cr; if (vel[0] > 0) vel[0] = 0; }
        else if (m === dR) { pos[0] = mx[0] + cr; if (vel[0] < 0) vel[0] = 0; }
        else if (m === dD) { pos[1] = mn[1] - cr; if (vel[1] > 0) vel[1] = 0; }
        else if (m === dU) { pos[1] = mx[1] + cr; if (vel[1] < 0) vel[1] = 0; }
        else if (m === dB) { pos[2] = mn[2] - cr; if (vel[2] > 0) vel[2] = 0; }
        else { pos[2] = mx[2] + cr; if (vel[2] < 0) vel[2] = 0; }
      } else {
        // outside → nearest point on the box; if the sphere overlaps it, push out along the contact
        // normal and project the inward velocity component out (slide along the surface).
        const nx = px < mn[0] ? mn[0] : px > mx[0] ? mx[0] : px;
        const ny = py < mn[1] ? mn[1] : py > mx[1] ? mx[1] : py;
        const nz = pz < mn[2] ? mn[2] : pz > mx[2] ? mx[2] : pz;
        const dx = px - nx, dy = py - ny, dz = pz - nz, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < cr * cr && d2 > 1e-9) {
          const d = Math.sqrt(d2), inv = cr / d;
          pos[0] = nx + dx * inv; pos[1] = ny + dy * inv; pos[2] = nz + dz * inv;
          const nX = dx / d, nY = dy / d, nZ = dz / d;
          const vn = vel[0] * nX + vel[1] * nY + vel[2] * nZ;
          if (vn < 0) { vel[0] -= vn * nX; vel[1] -= vn * nY; vel[2] -= vn * nZ; }
        }
      }
    }
  }

  // the radius of an axis-aligned ellipsoid (`a` lateral / `c` vertical — the hitbox-EGG shape) in a
  // unit direction: how far the egg's surface reaches toward a contact. The a=c case is a sphere.
  function eggRadius(vol, ux, uy, uz) {
    const horiz = ux * ux + uy * uy;
    return 1 / Math.sqrt(horiz / (vol.a * vol.a) + (uz * uz) / (vol.c * vol.c));
  }

  // ── SHOT OCCLUSION (cover) — the same collider boxes that block MOVEMENT also block SHOTS ──
  // segAabbT: the entry parameter t∈[0,1] where segment a→b first crosses box [mn,mx], else null.
  function segAabbT(a, b, mn, mx) {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const d = b[k] - a[k];
      if (Math.abs(d) < 1e-9) { if (a[k] < mn[k] || a[k] > mx[k]) return null; }   // parallel & outside the slab
      else {
        let tn = (mn[k] - a[k]) / d, tf = (mx[k] - a[k]) / d;
        if (tn > tf) { const s = tn; tn = tf; tf = s; }
        if (tn > t0) t0 = tn;
        if (tf < t1) t1 = tf;
        if (t0 > t1) return null;
      }
    }
    return t0;
  }
  // is the a→b sightline blocked by a solid box STRICTLY between the endpoints? (cover eats the shot)
  function sightBlocked(a, b, colliders) {
    if (!colliders) return false;
    for (let k = 0; k < colliders.length; k++) {
      const t = segAabbT(a, b, colliders[k].min, colliders[k].max);
      if (t != null && t > 1e-3 && t < 1 - 1e-3) return true;
    }
    return false;
  }
  // nearest box entry t along a→b (stop a tracer / burst a round AT the wall), or null.
  function nearestWallT(a, b, colliders) {
    if (!colliders) return null;
    let best = null;
    for (let k = 0; k < colliders.length; k++) {
      const t = segAabbT(a, b, colliders[k].min, colliders[k].max);
      if (t != null && t > 1e-3 && (best == null || t < best)) best = t;
    }
    return best;
  }
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // normalize a world's collider list to plain AABB records (drop malformed entries).
  function normalizeColliders(list) {
    if (!Array.isArray(list) || !list.length) return null;
    const out = [];
    for (const c of list) {
      if (c && Array.isArray(c.min) && Array.isArray(c.max) && c.min.length === 3 && c.max.length === 3) {
        out.push({ min: [c.min[0], c.min[1], c.min[2]], max: [c.max[0], c.max[1], c.max[2]] });
      }
    }
    return out.length ? out : null;
  }

  // stepBodyCollisions(state) — SUIT-vs-SUIT solidity: after every entity moves, separate any pair of
  // bodies whose collision EGGS overlap, so suits can't fly through each other (the hitbox-egg
  // principle reused for MOVEMENT). Each egg is feet-anchored (center = pos + cz·up). A body running a
  // live `platform` rule ABSORBS the push (piloted / moving); a stationary one (ambient clock) holds
  // and shoves the mover out — so ramming the enemy stops YOU, not it — and two movers split the
  // penetration. Approaching velocity along the contact normal is killed (rest against the hull, no
  // jitter). Opt-in per body (`collideVol`, from `body.collide`); worlds without it are a no-op.
  function stepBodyCollisions(state) {
    const solids = [];
    for (const e of state.entities) if (e.collideVol && !e.isCamera && !e.gone && e.cineT == null) solids.push(e);   // cinematic suits stand close — skip solidity
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) {
        const A = solids[i], B = solids[j];
        const pa = A.transform.pos, pb = B.transform.pos;
        let dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = (pb[2] + B.collideVol.cz) - (pa[2] + A.collideVol.cz);
        let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1e-6) { dx = 0; dy = 0; dz = 1; dist = 1e-6; }   // coincident → separate straight up
        const ux = dx / dist, uy = dy / dist, uz = dz / dist;
        const pen = eggRadius(A.collideVol, ux, uy, uz) + eggRadius(B.collideVol, ux, uy, uz) - dist;
        if (pen <= 0) continue;
        const mA = A.rule && A.rule.type === 'platform';
        const mB = B.rule && B.rule.type === 'platform';
        if (!mA && !mB) continue;   // two stationary bodies — nothing to push
        const wA = mA ? (mB ? 0.5 : 1) : 0;
        const wB = mB ? (mA ? 0.5 : 1) : 0;
        pa[0] -= ux * pen * wA; pa[1] -= uy * pen * wA; pa[2] -= uz * pen * wA;
        pb[0] += ux * pen * wB; pb[1] += uy * pen * wB; pb[2] += uz * pen * wB;
        if (mA && A.vel) { const vn = A.vel[0] * ux + A.vel[1] * uy + A.vel[2] * uz; if (vn > 0) { A.vel[0] -= vn * ux; A.vel[1] -= vn * uy; A.vel[2] -= vn * uz; } }
        if (mB && B.vel) { const vn = B.vel[0] * ux + B.vel[1] * uy + B.vel[2] * uz; if (vn < 0) { B.vel[0] -= vn * ux; B.vel[1] -= vn * uy; B.vel[2] -= vn * uz; } }
      }
    }
  }

  // MOVING-PLATFORM CARRY (apply): a grounded platform/walk rider resting on a carrier's top inherits
  // that carrier's per-tick HORIZONTAL delta, so you ride a moving platform instead of sliding off.
  // Walk-under-safe: only riders whose feet are AT the carrier's top (within snap) AND inside its
  // footprint are carried — a rider passing beneath is untouched. Vertical carry is free (the rider
  // re-grounds on the moving top each frame via the world ground probe). Pure + deterministic. The
  // carrier is any entity with `body.carrier:true`; its ride surface is `pos.z + (body.deck||0)` and
  // its footprint is `body.carryHalf:[hx,hy]` (AABB) or `body.carryRadius` (default 1.5).
  function stepCarry(state) {
    const carriers = state.entities.filter((e) => e.body && e.body.carrier && !e.isCamera);
    if (!carriers.length) return;
    for (const c of carriers) {
      const p0 = c._carryFrom;
      if (!p0) continue;
      const dx = c.transform.pos[0] - p0[0], dy = c.transform.pos[1] - p0[1];
      if (dx === 0 && dy === 0) continue;
      const half = Array.isArray(c.body.carryHalf) ? c.body.carryHalf : null;
      const rad = Number.isFinite(c.body.carryRadius) ? c.body.carryRadius : (half ? 0 : 1.5);
      const top = c.transform.pos[2] + (c.body.deck || 0);
      for (const e of state.entities) {
        if (e === c || e.isCamera || e.downed || e.gone || !e.grounded) continue;
        if (!e.rule || (e.rule.type !== 'platform' && e.rule.type !== 'walk') || e.rule.space) continue;
        if (e.body && e.body.carrier) continue;   // carriers don't ride carriers
        const eye = e.rule.eye ?? 0;
        const footZ = e.transform.pos[2] - eye;
        if (Math.abs(footZ - top) > (e.rule.snap ?? 0.15) + 0.05) continue;   // must be resting ON this top
        const riderR = e.rule.collideRadius ?? 0;
        const inXY = half
          ? (Math.abs(e.transform.pos[0] - c.transform.pos[0]) <= half[0] + riderR && Math.abs(e.transform.pos[1] - c.transform.pos[1]) <= half[1] + riderR)
          : (Math.hypot(e.transform.pos[0] - c.transform.pos[0], e.transform.pos[1] - c.transform.pos[1]) <= rad + riderR);
        if (!inXY) { if (e.carriedBy === c.id) e.carriedBy = null; continue; }
        e.transform.pos[0] += dx; e.transform.pos[1] += dy;
        e.carriedBy = c.id;
      }
    }
  }

  // ── extension hooks (S2) — how later builders extend the scaffold without core knowing their
  // fields: normalize extensions run inside normalizeEntity (per entity, after the base scaffold),
  // state-init extensions run at the end of createWorld (opt-in state layers like the match).
  // Registration order = EMISSION order — deterministic.
  const NORMALIZERS = [];
  const STATE_INITS = [];
  const registerNormalize = (fn) => { NORMALIZERS.push(fn); };
  const registerStateInit = (fn) => { STATE_INITS.push(fn); };
  const runNormalizers = (ent, raw) => { for (const f of NORMALIZERS) f(ent, raw); };
  const runStateInits = (state, spec) => { for (const f of STATE_INITS) f(state, spec); };

  // A normalized input snapshot the renderer fills each frame. Pure rules read ONLY this.
  // `cycle` (R press edge) and `slot` (1–N digit press edge, 0 = none) drive weapon cycling
  // on entities whose rule carries a `loadout` (mobile-suit weapon switching); `swap` (T press
  // edge) transfers the pilot between `pilotable` entities (the suit switcher); `aiToggle`
  // (G press edge) flips the world-level AI-attack switch (the ai ambients stand down / wake up).
  const ZERO_INPUT = { forward: 0, strafe: 0, turn: 0, lift: 0, lookDX: 0, lookDY: 0, buttons: 0, jump: 0, jumpHeld: 0, fire: 0, cycle: 0, slot: 0, swap: 0, aiToggle: 0, tackle: 0 };
  const readInput = (i) => ({ ...ZERO_INPUT, ...(i || {}) });

  // ── world construction ──
  function normalizeEntity(raw, i) {
    raw = raw || {};
    const tr = raw.transform || {};
    const ent = {
      id: typeof raw.id === 'string' && raw.id ? raw.id : 'ent-' + i,
      transform: {
        pos: Array.isArray(tr.pos) ? vcopy(tr.pos) : [0, 0, 0],
        heading: Number.isFinite(tr.heading) ? tr.heading : 0,
        pitch: Number.isFinite(tr.pitch) ? tr.pitch : 0,
      },
      rule: raw.rule && raw.rule.type ? { ...raw.rule } : { type: 'static' },
      body: raw.body && raw.body.type ? { ...raw.body } : { type: 'none' },
      isCamera: !!raw.isCamera,
      vel: Array.isArray(raw.vel) ? vcopy(raw.vel) : [0, 0, 0],
      gaitPhase: 0,
      moving: false,
      locomotion: 'forward',   // which walk clip a figure-frames body plays (set by walk/platform rules)
      lookAt: null,
      weapon: E.initWeapon ? E.initWeapon(raw.weapon) : null,   // firing/ammo state (combat-ranged; null unless armed)
      lastShot: null,                    // { mode:'core'|'assist'|'miss', targetId?, t } — HUD hitmarker
      hitFlash: -1, hits: 0,             // last-hit time (-1 = never; the HUD flashes while now−hitFlash is small) + tally
      // HIT reaction (opt-in via body.poise): a suit with poise reacts when a hit breaks it — a
      // rooted clip advanced by stepReaction. poise regenerates so it is a break threshold, not a
      // health bar. staggerT is the clip TIMER (null except while reacting, 0->1 over reactDur);
      // downPauseT is the vulnerable toppled hold before the invincible getup begins.
      // reactClip/reactDur are set per-reaction by armReaction (stagger lurch vs the topple knockdown);
      // downed is the terminal state after a killing blow — unless the world runs a MATCH (below),
      // where stepMatch respawns the fallen and death is a scored round, not the end.
      staggerT: null, staggerReturn: 'forward', reactClip: 'stagger', reactDur: null, downPauseT: null, downed: false, deathBurstDone: false,
      lastHitBy: null, deadAt: null,   // match-layer: kill attribution + time-of-death (null while alive)
      dropping: false, dropTargetZ: 0, spawnGuard: false, spawnGuardT: 0,   // R24 spawn drop-in + fire-gated spawn protection (R26 cap)
    };
    // remember the authored start pose — the respawn point when a match world declares no spawns.
    ent.spawn = { pos: vcopy(ent.transform.pos), heading: ent.transform.heading };
    // TEAM (faction) tag — opt-in `raw.team` (any stable id, e.g. 'a'/'b'). Absent → null, and every
    // team-aware seam below (target:'enemy', friendly-fire off + stagger, team-win) is a no-op, so a world with
    // no teams steps byte-identically. A tagged suit never hunts or damages a same-team suit, and the
    // match is won by the first team to killTarget rather than the first individual.
    ent.team = (typeof raw.team === 'string' && raw.team) ? raw.team : null;
    // registered field hoists (S2/S4): combat-hit's poise/collide/hpMax/shield, then the ms
    // pack's seat/liveries/loadout — extension order = EMISSION order.
    runNormalizers(ent, raw);
    // PILOTABLE (the suit switcher): the entity carries TWO rules — its authored `rule` is the
    // PILOT rule (what it runs under player control), `ambient` is what it runs when nobody is
    // aboard (typically the clock march; defaults to static). createWorld seats the initial pilot
    // and stepWorld's `input.swap` (T) transfers between pilotable entities.
    ent.pilotable = !!raw.pilotable;
    if (ent.pilotable) {
      ent.pilotRule = ent.rule;
      ent.ambientRule = raw.ambient && raw.ambient.type ? { ...raw.ambient } : { type: 'static' };
    }
    return ent;
  }

  // createWorld(spec) — normalize { entities, camera } into runtime state. The `camera` sugar
  // (`{ rule, target, ... }`) becomes an isCamera entity appended to the list.
  function createWorld(spec) {
    spec = spec || {};
    const entities = (Array.isArray(spec.entities) ? spec.entities : []).map(normalizeEntity);
    if (spec.camera && spec.camera.rule) {
      entities.push(normalizeEntity({ id: '__camera', isCamera: true, transform: spec.camera.transform, rule: { type: spec.camera.rule, ...spec.camera }, body: { type: 'none' } }, entities.length));
    }
    const byId = {};
    for (const e of entities) byId[e.id] = e;
    const camera = entities.find((e) => e.isCamera) || null;
    // seat the initial pilot: `spec.pilot` (an entity id) wins if it names a pilotable entity,
    // else the first pilotable one. Every other pilotable entity runs its ambient rule.
    // SPECTATE (ai-battle-spectator.plan.md, opt-in `spec.spectate`): NOBODY pilots — pilotId stays
    // null and every pilotable suit runs its ambient (ai) brain, so the whole cast is a live AI
    // battle the operator watches from a spectator camera. (Zero-pilotable worlds already yield null;
    // the flag makes it explicit and is the signal the emitted spectator UI + HUD guards read.)
    const pilotables = entities.filter((e) => e.pilotable);
    const spectate = spec.spectate === true;
    const named = typeof spec.pilot === 'string' ? pilotables.find((e) => e.id === spec.pilot) : null;
    const pilotId = spectate ? null : (named ? named.id : (pilotables.length ? pilotables[0].id : null));
    for (const e of pilotables) e.rule = e.id === pilotId ? e.pilotRule : e.ambientRule;
    // R14 projectile pools: in-flight rounds + recent burst fx records (both empty on pre-R14 worlds,
    // so they render identically). projSeq/burstSeq give each a stable id the renderer keys on.
    // clashes/clashSeq are the melee analog (melee-clash-fx): stepMelee stamps a contact-point
    // record per connect and the renderer's spark channel edge-detects the seq like bursts.
    // `colliders`: analytic AABB blockers (the invisible collision hull under the visual faces);
    // null on pre-collider worlds → lateral blocking is a no-op.
    // AI-attack switch: `spec.ai:'off'` seats the world PASSIVE (ai-ambient suits stand down
    // until input.aiToggle wakes them); anything else — including absent — leaves authored ai live.
    const state = { entities, byId, camera, pilotId, spectate, aiEnabled: spec.ai !== 'off', aiTuning: null, colliders: normalizeColliders(spec.colliders), match: null, wreckExplodes: null, time: 0, projectiles: [], bursts: [], projSeq: 0, burstSeq: 0, clashes: [], clashSeq: 0, shieldBreaks: 0, cinematic: null };
    runStateInits(state, spec);   // opt-in state layers (the match bout + wreck finisher — combat-match.js, S2)
    return state;
  }

  // ── the step PIPELINE (S3) — stepWorld as a slot runner ─────────────────────────────────────────
  // The per-frame order is REGISTERED, not hardcoded: systems put their passes into named slots and
  // the runner executes slots in a fixed sequence, each slot's entries sorted by explicit `order`
  // (ties: registration order = EMISSION order). The resolved order is pinned by a snapshot test —
  // replay determinism depends on it. Slots, in run sequence:
  //   preSteps        (state, input, dt, hooks) → optional replacement input — world-level, before
  //                   the entity loop (match-over zeroing, ai toggle, pilot swap, carry snapshot)
  //   entityTimers    (e, dt, state) — always tick (the autoloader doctrine: machinery, not attention)
  //   bodyOwners      (e, input, dt, state, world) → truthy while OWNING the body; any owner
  //                   suppresses the entity's rule + weapon this frame (reaction / clash / cine / drop)
  //   entityAsserts   (e, dt, owns, state) — per-frame asserts after ownership settles (charge
  //                   cancel, spawn guard)
  //   rule            RULES[e.rule.type] — unless owned; owned/no-rule entities run suppressedTicks
  //                   instead (boost recovery)
  //   entityActions   (e, input, dt, state, world, owns) — after the rule (weapon / melee / tackle)
  //   worldPasses     (state, input, dt, world, hooks) — after the entity loop (body collisions,
  //                   carry, projectiles, death burst, match)
  // then the camera rule and time += dt, inline.
  const PRE_STEPS = [], ENTITY_TIMERS = [], BODY_OWNERS = [], ENTITY_ASSERTS = [];
  const SUPPRESSED_TICKS = [], ENTITY_ACTIONS = [], WORLD_PASSES = [];
  const reg = (list) => (key, fn, order) => { list.push({ key, fn, order: order ?? 100 }); list.sort((a, b) => a.order - b.order); };
  const registerPreStep = reg(PRE_STEPS);
  const registerEntityTimer = reg(ENTITY_TIMERS);
  const registerBodyOwner = reg(BODY_OWNERS);
  const registerEntityAssert = reg(ENTITY_ASSERTS);
  const registerSuppressedTick = reg(SUPPRESSED_TICKS);
  const registerEntityAction = reg(ENTITY_ACTIONS);
  const registerWorldPass = reg(WORLD_PASSES);
  // the resolved slot order, for the pin test + debugging — keys only, in execution order.
  const pipelineOrder = () => ({
    preSteps: PRE_STEPS.map((p) => p.key),
    entityTimers: ENTITY_TIMERS.map((p) => p.key),
    bodyOwners: BODY_OWNERS.map((p) => p.key),
    entityAsserts: ENTITY_ASSERTS.map((p) => p.key),
    suppressedTicks: SUPPRESSED_TICKS.map((p) => p.key),
    entityActions: ENTITY_ACTIONS.map((p) => p.key),
    worldPasses: WORLD_PASSES.map((p) => p.key),
  });

  // stepWorld(state, input, dt, hooks) — advance every entity one frame: the slot runner. Non-camera
  // entities first (so a follow camera reads updated targets), then the camera. `hooks` supplies
  // renderer seams: `hooks.physics(dt)` steps the shared integrator, `hooks.ground(pos)` returns
  // terrain height. Mutates and returns `state`.
  function stepWorld(state, input, dt, hooks) {
    dt = dt || 1 / 60;
    input = readInput(input);
    hooks = hooks || {};
    if (hooks.physics) hooks.physics(dt);
    for (const p of PRE_STEPS) { const ov = p.fn(state, input, dt, hooks); if (ov) input = ov; }
    const world = { byId: state.byId, ground: hooks.ground || null, colliders: state.colliders || null, pilotId: state.pilotId || null, aiEnabled: state.aiEnabled !== false && !(state.match && state.match.over), aiTuning: state.aiTuning || null, get cinematic() { return state.cinematic; } };
    for (const e of state.entities) {
      if (e.isCamera) continue;
      for (const t of ENTITY_TIMERS) t.fn(e, dt, state);
      const owns = {};
      let owned = false;
      for (const o of BODY_OWNERS) { const v = !!o.fn(e, input, dt, state, world); owns[o.key] = v; owned = owned || v; }
      for (const a of ENTITY_ASSERTS) a.fn(e, dt, owns, state);
      const fn = RULES[e.rule.type];
      if (fn && !owned) fn(e, input, dt, world);
      else for (const s of SUPPRESSED_TICKS) s.fn(e, dt);
      for (const a of ENTITY_ACTIONS) a.fn(e, input, dt, state, world, owns);
    }
    for (const w of WORLD_PASSES) w.fn(state, input, dt, world, hooks);
    if (state.camera) {
      const fn = RULES[state.camera.rule.type];
      if (fn) fn(state.camera, input, dt, world);
    }
    state.time += dt;
    return state;
  }

  // SUIT SWITCHER: `input.swap` (T press edge) transfers the pilot to the next pilotable
  // entity. The vacated suit drops to its ambient rule where it stands (volatile pilot state
  // cleared so it stands clean); the possessed one takes its pilot rule — loadout, tuning and
  // all. A follow camera tracking the old pilot retargets and eases over. Gated while the
  // current pilot is mid-swing / mid-dodge / charging / airborne — those own the body.
  registerPreStep('pilot-swap', (state, input) => {
    if (input.swap && state.pilotId) {
      const pilotables = state.entities.filter((e) => e.pilotable);
      const cur = state.byId[state.pilotId];
      // busy = the body is committed to a maneuver that owns it. The airborne gate is GROUND-only:
      // in SPACE the pilot is never grounded (it floats), so gating on it would refuse EVERY switch —
      // a space suit switches freely (still blocked mid-swing / mid-dodge / mid-charge). A boost
      // HOVER is stable footing, not a maneuver — boost allowed the swap before the hover lift
      // existed, so a hovering pilot still switches.
      const busy = cur && (cur.swingT != null || cur.dodgeT != null || cur.tackleT != null || cur.clashT != null || cur.jumpCharge >= 0 || (!(cur.rule && cur.rule.space) && cur.grounded === false && cur.hovering !== true));
      if (pilotables.length > 1 && !busy) {
        const i = pilotables.findIndex((e) => e.id === state.pilotId);
        const next = pilotables[(i + 1) % pilotables.length];
        if (cur) {
          cur.rule = cur.ambientRule;
          cur.swingT = null; cur.dodgeT = null; cur.tumble = null; cur.invincible = false;
          cur.tackleT = null; cur.tackleDir = null;   // a tackle doesn't survive a pilot transfer
          cur.dashVel = null; cur.jumpCharge = -1; cur.jumpWind = 0; cur.moving = false;
          cur.boostCut = false; cur.boosting = false;   // a melee boost-cancel + boost-armor state don't survive a pilot transfer
          cur.reactionEnded = false;   // a recovery that happened while piloted isn't the ai brain's cue
          cur.comboT = 0; cur.swingCombo = false;   // the combo window doesn't survive a pilot transfer
        }
        next.rule = next.pilotRule;
        next.reactionEnded = false;
        state.pilotId = next.id;
        if (state.camera && state.camera.rule && cur && state.camera.rule.target === cur.id) {
          state.camera.rule.target = next.id;
        }
      }
    }
  }, 30);

  // core's own passes: the carry snapshot (pre-loop) and the post-move separation + carry apply.
  // MOVING-PLATFORM CARRY (setup): snapshot each carrier's pre-step position so the post-pass can
  // inherit its per-tick horizontal delta to grounded riders. No carriers → a no-op.
  registerPreStep('carry-snapshot', (state) => {
    for (const e of state.entities) { if (e.body && e.body.carrier) e._carryFrom = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]]; }
  }, 40);
  // SUIT-vs-SUIT solidity (opt-in body.collide): separate overlapping bodies so suits can't fly
  // through each other. After the rules move everyone, before projectiles/cameras read positions.
  registerWorldPass('body-collisions', (state) => stepBodyCollisions(state), 10);
  registerWorldPass('carry', (state) => stepCarry(state), 20);   // riders inherit their carrier's horizontal motion

  // the RULE registry: rule builders (rules-basic.js, all.js, later packs) register into this
  // shared object via Object.assign(RULES, {...}); the step loop resolves e.rule.type against it.
  const RULES = {};

  Object.assign(E, {
    RULES,
    add, sub, scl, clamp, vcopy, smooth, lerp3, fwdXY, rightXY, fwd3, TAU, HALF_PI,
    resolveBlocking, resolveBlocking3D, segAabbT, sightBlocked, nearestWallT, normalizeColliders, eggRadius,
    stepBodyCollisions, stepCarry,
    registerNormalize, registerStateInit, runNormalizers, runStateInits,
    ZERO_INPUT, readInput, stepWorld, pipelineOrder, normalizeEntity, createWorld,
    registerPreStep, registerEntityTimer, registerBodyOwner, registerEntityAssert,
    registerSuppressedTick, registerEntityAction, registerWorldPass,
  });
}
