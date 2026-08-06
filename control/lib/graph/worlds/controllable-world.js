/**
 * controllable-world — ONE primitive for "control a thing in a world" (see
 * controllable-world.plan.md). An entity is a transform (position + heading/pitch) plus a RULE that
 * updates it each frame. The figure, the ball, the drone — and the CAMERA — are all entities; only
 * the rule (what drives the transform) and the body (what it looks like) differ.
 *
 * SINGLE SOURCE OF TRUTH, like physics-sim.js: the whole model lives inside `buildControllable()`,
 * a self-contained closure. Node imports the live instance below (tested in
 * controllable-world.test.js); the browser `/world` runs the SAME code via `buildControllable.toString()`
 * (the renderer wiring lands in Phase 3). No second, drifting copy.
 *
 * Purity: rules consume a NORMALIZED input snapshot (axes already mapped from keys/mouse by the
 * renderer) and a fixed dt, so the same inputs → byte-identical outputs. Ground-snap / wall-slide
 * (raycasts against world geometry) and the physics integrator are passed in as `hooks` by the
 * renderer; the model itself stays geometry-free and deterministic.
 *
 * World convention: z-up, heading = yaw about +Z. Rules: glide, walk, platform (gravity+jump),
 * follow, clock, ai (the fire-back hunter — a vacated suit's ambient brain). orbit / physics /
 * path are renderer seams / later (see plan).
 */

export function buildControllable() {
  // ── vec helpers (inlined so the closure is self-contained for browser emission) ──
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const vcopy = (a) => [a[0], a[1], a[2]];

  // headed basis on the XY plane (z-up). forward = facing; right = forward × up.
  const fwdXY = (h) => [Math.cos(h), Math.sin(h), 0];
  const rightXY = (h) => [Math.sin(h), -Math.cos(h), 0];
  const SIDE_STRIKE_YAW = 50 * Math.PI / 180;   // a left/right melee cut yaws its hitbox this far to its side
  // full forward including pitch (for free-flight / look-driven rules).
  const fwd3 = (h, p) => [Math.cos(p) * Math.cos(h), Math.cos(p) * Math.sin(h), Math.sin(p)];

  // ── R19: the EGG hitbox — a tall narrow spheroid (lateral radius `a`, semi-length `c`)
  // about a long axis that TILTS with the boost lean. Replaces the old fat isotropic
  // sphere: a shot lands only when the aim ray actually passes THROUGH the silhouette,
  // so you must aim at the body (no distance-growing generosity cone). Pure geometry.
  const isFlatToppled = (tg) => tg && tg.reactClip === 'topple' && tg.staggerT >= 1;
  // `latR(tg)` is the target's lateral reach. Upright eggs use width `a`; a flat toppled suit
  // presents its body length along the floor, so melee/tackle reach against the heap uses `c`.
  const latR = (tg) => (tg.body && tg.body.egg ? (isFlatToppled(tg) ? tg.body.egg.c : tg.body.egg.a) : (tg.body && tg.body.radius) || 0.5);
  // The signed boost lean (radians) for a locomotion state; 0 (upright) for walk/idle. A
  // negative lean tips the top AWAY from the base direction (boost_back arches back).
  function eggLean(tg) {
    const lm = tg.locomotion || '';
    const base = (tg.body.egg && Number.isFinite(tg.body.egg.lean)) ? tg.body.egg.lean : 0.6;
    if (lm === 'boost') return base;
    if (lm === 'boost_back') return -base * 0.7;
    if (lm === 'boost_left' || lm === 'boost_right') return base * 0.8;
    return 0;   // boost_side (symmetric), leap, gait, idle → upright
  }
  // The egg's world-space long-axis unit vector: world +z tilted toward the lean direction.
  function eggAxis(tg) {
    if (isFlatToppled(tg)) {
      const h = tg.transform.heading || 0;
      return [Math.cos(h), Math.sin(h), 0];   // the toppled body lies along the floor
    }
    const th = eggLean(tg);
    if (!th) return [0, 0, 1];
    const h = tg.transform.heading, lm = tg.locomotion || '';
    const dir = lm === 'boost_left' ? scl(rightXY(h), -1) : lm === 'boost_right' ? rightXY(h) : fwdXY(h);
    const s = Math.sin(th), c = Math.cos(th);   // signed th tips toward -dir when negative
    return [s * dir[0], s * dir[1], c];          // unit: (s·dir)²+c² = s²+c² = 1
  }
  // Ray-vs-egg: scale the ray into the spheroid's unit-sphere frame (perp part /a, along-axis
  // part /c) and solve the quadratic. Returns the nearest positive entry distance along the
  // UNIT dir (parameter preserved by the linear scale) or null. Center rides `tg.pos` + the
  // egg's `cz` height (feet-anchored default: cz = c, so the egg spans foot→head).
  function hitEgg(origin, dir, tg) {
    const egg = tg.body.egg, a = egg.a, cc = egg.c;
    const flat = isFlatToppled(tg);
    const cz = flat ? a : (Number.isFinite(egg.cz) ? egg.cz : cc);
    const C = [tg.transform.pos[0], tg.transform.pos[1], tg.transform.pos[2] + cz];
    const ez = eggAxis(tg);
    const S = (u) => {
      const par = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2];
      const f = (1 / cc - 1 / a) * par;
      return [u[0] / a + f * ez[0], u[1] / a + f * ez[1], u[2] / a + f * ez[2]];
    };
    const O = S(sub(origin, C)), D = S(dir);
    const A = D[0] * D[0] + D[1] * D[1] + D[2] * D[2];
    if (A <= 1e-12) return null;
    const B = 2 * (O[0] * D[0] + O[1] * D[1] + O[2] * D[2]);
    const K = O[0] * O[0] + O[1] * O[1] + O[2] * O[2] - 1;
    const disc = B * B - 4 * A * K;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc), t0 = (-B - sq) / (2 * A), t1 = (-B + sq) / (2 * A);
    return t0 > 1e-4 ? t0 : (t1 > 1e-4 ? t1 : null);   // nearest entry ahead (or exit if fired from inside)
  }
  // Is a POINT inside the target's (tilted) egg, inflated by `pad`? The membership test behind projectile
  // CONTACT (a lob shell must burst on the tall BODY column, not sail over the feet-point) and SPLASH
  // inclusion (a burst within `pad` of the egg catches it). Inflating the semi-axes by pad is the
  // conservative ellipsoid⊕sphere approximation — exact enough for gameplay, and a direct hit (point
  // inside the egg) is trivially inside the pad-inflated egg, so a shell that lands on a suit always
  // catches that suit in its own splash.
  function pointInEgg(pt, tg, pad) {
    const egg = tg.body.egg, a = egg.a + pad, cc = egg.c + pad;
    const cz = isFlatToppled(tg) ? a : (Number.isFinite(egg.cz) ? egg.cz : egg.c);
    const ez = eggAxis(tg);
    const u = [pt[0] - tg.transform.pos[0], pt[1] - tg.transform.pos[1], pt[2] - (tg.transform.pos[2] + cz)];
    const par = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2];
    const perp2 = Math.max(0, (u[0] * u[0] + u[1] * u[1] + u[2] * u[2]) - par * par);
    return perp2 / (a * a) + (par * par) / (cc * cc) <= 1;
  }
  const hullZ = (u) => u.transform.pos[2] + (u.body && u.body.egg ? (isFlatToppled(u) ? u.body.egg.a : u.body.egg.c) : (u.body && u.body.radius) || 0.5);

  // ── R19: destructible shields. A frontal, FLANKABLE damage buffer. A ranged/splash hit
  // whose SOURCE lies within the shield's front arc is EATEN (drains shieldHp, no hp/poise);
  // a flank/rear shot bypasses it. Breaking it (hp≤0) shatters the shield and STAGGERS the
  // suit (the punish window). Melee bypasses the shield entirely (handled in stepMelee).
  function shieldCovers(tg, src) {
    if (!tg.shieldHp || tg.shieldBroken) return false;
    const front = fwdXY(tg.transform.heading);
    const ix = src[0] - tg.transform.pos[0], iy = src[1] - tg.transform.pos[1];
    const m = Math.hypot(ix, iy) || 1e-6;
    return (ix * front[0] + iy * front[1]) / m >= Math.cos((tg.shieldArc || Math.PI * 0.6) / 2);
  }
  // Try to absorb `drain` off tg's shield from a shot originating at `src`. Returns true when
  // the shield ate the hit (so the caller skips hp/poise). Arms the break-stagger on depletion.
  function absorbShield(tg, src, drain, state) {
    if (!shieldCovers(tg, src)) return false;
    tg.shieldHp -= drain;
    if (tg.shieldHp <= 0) {
      tg.shieldHp = 0; tg.shieldBroken = true; tg.shieldBreakAt = state.time;
      state.shieldBreaks = (state.shieldBreaks || 0) + 1;
      armReaction(tg, 'stagger');   // the shatter IS the opening — reuse the R8 reaction
    }
    return true;
  }

  // frame-rate-independent smoothing factor for a given rate (1/sec): approaches target without
  // depending on dt size. factor → 1 as dt grows, → rate·dt for small dt.
  const smooth = (rate, dt) => 1 - Math.exp(-Math.max(0, rate) * dt);

  // A normalized input snapshot the renderer fills each frame. Pure rules read ONLY this.
  // `cycle` (R press edge) and `slot` (1–N digit press edge, 0 = none) drive weapon cycling
  // on entities whose rule carries a `loadout` (mobile-suit weapon switching); `swap` (T press
  // edge) transfers the pilot between `pilotable` entities (the suit switcher); `aiToggle`
  // (G press edge) flips the world-level AI-attack switch (the ai ambients stand down / wake up).
  const ZERO_INPUT = { forward: 0, strafe: 0, turn: 0, lift: 0, lookDX: 0, lookDY: 0, buttons: 0, jump: 0, jumpHeld: 0, fire: 0, cycle: 0, slot: 0, swap: 0, aiToggle: 0, tackle: 0 };
  const readInput = (i) => ({ ...ZERO_INPUT, ...(i || {}) });

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

  // meleeSwingSpec(sc, r, swingDir, comboEquipped) — the swing CLIP name + the `strikeParams` block that
  // stepMelee reads to adjudicate a connect (reach / cone / contact window / damage / topple). Extracted
  // so the PLATFORM strike (player) and the AI melee-seek stamp IDENTICAL numbers from a melee config
  // (`sc` = the active loadout slot or the rule). Pure — same inputs, same block.
  function meleeSwingSpec(sc, r, swingDir, comboEquipped) {
    const sv = (sc.strikeVerbs && sc.strikeVerbs[swingDir]) || {};
    const contact = sv.strikeContact || sc.strikeContact || r.strikeContact;
    return {
      clip: `${sc.swingSet || 'swing'}_${swingDir}`,
      params: {
        reach: sv.strikeReach ?? sc.strikeReach ?? r.strikeReach ?? (r.speed ?? 6),
        damage: sv.strikeDamage ?? sc.strikeDamage ?? r.strikeDamage ?? 0,
        impact: sv.strikeImpact ?? sc.strikeImpact ?? r.strikeImpact ?? 0,
        eye: sc.strikeEye ?? r.eye ?? 0,
        cosCone: Math.cos((sv.strikeCone ?? sc.strikeCone ?? r.strikeCone ?? 70) * Math.PI / 180),
        combo: comboEquipped,
        from: contact && contact[0] != null ? contact[0] : 0.28,
        to: contact && contact[1] != null ? contact[1] : 0.62,
        topple: sv.topple === true || (sv.topple !== false && swingDir === 'back'),
        aimYaw: sv.strikeYaw != null ? sv.strikeYaw * Math.PI / 180
          : swingDir === 'left' ? SIDE_STRIKE_YAW : swingDir === 'right' ? -SIDE_STRIKE_YAW : 0,
        // spark tint/size for the renderer's clash channel — the melee analog of a ranged
        // weapon's fxColor/fxScale ({ color, scale }); null → the renderer's default clash read.
        fx: sv.strikeFx ?? sc.strikeFx ?? r.strikeFx ?? null,
      },
    };
  }
  // breakGuards(e) — acting a weapon SPENDS any protection (2026-07-27): the spawn shield always
  // dropped on the first act (R24/R26); now the post-knockdown wake guard and a mid-dodge
  // tumble's i-frames drop the same way — firing (or swinging/throwing) while untouchable is
  // over. The dodge's per-frame i-frame assert respects `dodgeSpent`, so the tumble finishes
  // its arc hittable. The getup rise keeps its i-frames only because a reacting unit cannot
  // act at all (stepReaction suppresses its rule + weapon).
  function breakGuards(e) {
    if (e.spawnGuard) e.spawnGuard = false;
    if (e.wakeGuardT > 0) e.wakeGuardT = 0;
    if (e.dodgeT != null) e.dodgeSpent = true;
    e.downPauseT = null;
    e.invincible = false;
  }

  // armSwitchReady(e, r, sc) — SWITCH READY-TIME (2026-07-28): every weapon SWITCH (loadout cycle /
  // slot-select, ranged AND melee, player AND ai) makes the newly-drawn weapon un-act-able for
  // `switchReady` sec (default 1) — you can't rapid-fire by flicking between slots whose own
  // cooldowns have refreshed. Distinct from reload (which is per-magazine and gates on its own)
  // and from the per-slot fire cooldown: it is a floor imposed by the ACT of switching. Re-armed
  // in full on every switch (A→B→A costs a second each way). Ticks world-side in stepWorld.
  // A slot-level `switchReady` on the INCOMING config wins over the rule's (a grenade takes
  // longer to ready than a rifle) — absent, the rule default holds.
  function armSwitchReady(e, r, sc) {
    e.readyMax = (sc && Number.isFinite(sc.switchReady)) ? sc.switchReady : (r.switchReady ?? 1);
    e.readyT = e.readyMax;
  }

  // beginAiSwingDir(e, sc, r, dir, isCombo, noTopple) — throw ONE melee swing in a given direction.
  // Stashes the swing's duration + cooldown on the entity so the ai rule's swing-playback advances it
  // without the config in hand. stepMelee (stepWorld) adjudicates the hit during the contact window.
  // A combo FINISHER (`isCombo`) forces the TOPPLE (the downswing floors on connect — the string's
  // payoff); `noTopple` (the easy difficulty tier) strips the knockdown off whatever verb was thrown.
  function beginAiSwingDir(e, sc, r, dir, isCombo, noTopple) {
    const spec = meleeSwingSpec(sc, r, dir, isCombo);
    if (isCombo) spec.params.topple = true;   // the downswing finisher knocks down
    if (noTopple) spec.params.topple = false;   // easy tier: the cut lands (damage + stagger), never floors
    e.swingT = 0; e.swingClip = spec.clip; e.strikeParams = spec.params;
    e.struckThisSwing = {}; e.swingCount = (e.swingCount || 0) + 1; e.swingCombo = isCombo;
    e.lastSwingDir = dir;       // combo-string memory stays coherent if the pilot takes this suit over
    e.swingDur = sc.strikeDur ?? r.strikeDur ?? 0.9;
    e.swingCd = sc.strikeCooldown ?? r.strikeCooldown ?? 0;
    breakGuards(e);   // attacking spends any protection (spawn shield / wake guard / dodge i-frames)
  }
  // beginAiSwing(e, sc, r, dif) — the AI opens a melee attack. On a COMBO slot (`combo:1`) it throws a
  // TWO-HIT string: an OPENER (a neutral or alternating side cut — a setup hit) then, chained on
  // completion in the swing playback, a DOWNSWING finisher that topples. A single-hit slot (no combo)
  // keeps the classic `back` great-cleave → a topple on connect. `aiComboWant` flags the pending chain.
  // A `noTopple` difficulty tier (easy) still MELEES but never throws the knockdown: the combo chain
  // is skipped (its finisher IS the topple) and the single-hit path swaps the toppling back-cleave
  // for the opener cuts — damage and stagger land, the suit stays on its feet.
  function beginAiSwing(e, sc, r, dif) {
    const noTopple = !!(dif && dif.noTopple);
    // the 2-hit string is DEFAULT-ON for the ai melee-seek (opt out with `r.meleeCombo:false` → the
    // single classic great-cleave). It needs the neutral/left/right + back swing clips, which the suit
    // roster all bake; a suit missing them degrades to swing_neutral in the renderer (still lands).
    if (r.meleeCombo !== false || noTopple) {
      e.aiSwingAlt = (e.aiSwingAlt || 0) + 1;
      const opener = (e.aiSwingAlt % 3 === 0) ? 'neutral' : (e.aiSwingAlt % 3 === 1 ? 'left' : 'right');   // neutral / side, varied
      beginAiSwingDir(e, sc, r, opener, false, noTopple);
      if (noTopple) {
        // the lone opener still PAYS the combo-string pacing: without this, a slot that skips
        // `strikeCooldown` would let the easy tier chain cuts back-to-back and out-swing max.
        e.swingCd = Math.max(e.swingCd || 0, (sc && sc.comboCooldown) ?? r.comboCooldown ?? 2.5);
        e.aiComboWant = false;
        return;
      }
      e.aiComboWant = true; e.aiComboCfg = sc; e.aiComboRule = r;   // chain the downswing when the opener completes
      e.aiComboCooldown = (sc && sc.comboCooldown) ?? r.comboCooldown ?? 2.5;
    } else {
      beginAiSwingDir(e, sc, r, 'back', false);   // single hit: the classic toppling great-cleave
      e.aiComboWant = false;
    }
  }

  // ── the RULE shelf: each mutates entity.transform from (entity, input, dt, world) ──

  // glide — free flight with momentum, NO gravity. Look (mouse) steers heading+pitch; W/S/strafe/lift
  // accelerate along the look basis; velocity damps toward rest. The spectator/drone rule.
  function glide(e, input, dt) {
    const r = e.rule;
    const lookSens = r.lookSens ?? 0.0025, accel = r.accel ?? 24, damping = r.damping ?? 4, maxSpeed = r.maxSpeed ?? 18;
    const t = e.transform;
    t.heading = (t.heading + input.lookDX * lookSens) % TAU;
    t.pitch = clamp((t.pitch || 0) + input.lookDY * lookSens, -HALF_PI + 0.05, HALF_PI - 0.05);
    const f = fwd3(t.heading, t.pitch), rt = rightXY(t.heading);
    let a = [0, 0, 0];
    a = add(a, scl(f, input.forward * accel));
    // strafe = E/Q (strafe axis) OR A/D (turn axis): the drone is MOUSE-steered, so the tank-turn axis
    // has no other job here — folding it in makes the spectator camera fly on true WASD (A/D strafe).
    a = add(a, scl(rt, (input.strafe + input.turn) * accel));
    a = add(a, scl([0, 0, 1], input.lift * accel));
    let v = add(scl(e.vel, 1 - smooth(damping, dt)), scl(a, dt));   // momentum + damping
    const sp = Math.hypot(v[0], v[1], v[2]);
    if (sp > maxSpeed) v = scl(v, maxSpeed / sp);
    e.vel = v;
    t.pos = add(t.pos, scl(v, dt));
  }

  // walk — ground-locked. `turn:'tank'` (default): A/D rotate heading, W/S move along facing. The
  // figure / FPS rule. Advances a gait phase by signed ground distance so a figure-frames body picks
  // its frame; z is left to the ground hook (flat otherwise). Strafe optional.
  function walk(e, input, dt, world) {
    const r = e.rule;
    const speed = r.speed ?? 6, turn = r.turn ?? 2.2, stride = r.stride ?? 2.4, strafe = r.strafe ?? 0;
    const t = e.transform;
    if ((r.turnMode ?? 'tank') === 'tank') t.heading = (t.heading + input.turn * turn * dt) % TAU;
    else t.heading = (t.heading + input.lookDX * (r.lookSens ?? 0.0025)) % TAU;
    const f = fwdXY(t.heading), rt = rightXY(t.heading);
    const moveF = input.forward * speed * dt;
    const moveS = input.strafe * strafe * speed * dt;
    t.pos = add(t.pos, add(scl(f, moveF), scl(rt, moveS)));
    const ground = world && world.ground ? world.ground(t.pos) : null;   // renderer hook (raycast)
    if (ground != null) t.pos[2] = ground + (r.eye ?? 0);
    const dist = Math.hypot(moveF, moveS);
    e.gaitPhase = ((e.gaitPhase || 0) + (moveF < 0 ? -dist : dist) / stride);
    e.moving = Math.abs(input.forward) + Math.abs(input.strafe) > 1e-3;
  }

  // platform — 3D character controller WITH gravity + jump (the platformer rule). Horizontal control
  // is direct + tight like `walk`; the z axis is now DYNAMIC — a vertical velocity (e.vel[2]) that
  // gravity pulls down, a jump launches, and the ground hook lands. The platformer-FEEL knobs live
  // here on purpose: a good platformer is a TUNED controller, not a rigid body — variable jump height
  // (release-to-shorten), coyote time (grace after a ledge), jump buffering (press just before
  // landing), asymmetric gravity (snappier fall), reduced air control. 3D-NATIVE: heading is free, so
  // a 2.5D side-scroller is just this rule with `strafe:0` and a fixed heading — no separate path.
  // Surfaces `grounded` + `jumped`/`landed` edges on the entity (for facts / animation).
  // BOOST (input.boost, the F key): thrusters override leg speed at
  // `boostSpeed` (default 3.5× walk) along the HELD DIRECTION — F+W/S/A/D
  // boosts forward/back/sideways (diagonals normalized so the dash speed is
  // constant), plain F defaults forward. Steering stays live. `locomotion`
  // picks the matching flight clip — 'boost' (forward), 'boost_back',
  // 'boost_side' — bodies without them fall back to 'forward' in the
  // renderer. Entering/leaving rides the same gait-mix crossfade as every
  // mode switch. Opt-in `boostHover` lifts the boosting suit to a ground
  // CLEARANCE so low obstacles pass underneath (the vertical block below).
  function platform(e, input, dt, world) {
    const r = e.rule;
    const speed = r.speed ?? 6, turnRate = r.turn ?? 2.4, strafe = r.strafe ?? 1, eye = r.eye ?? 0;
    const boostSpeed = r.boostSpeed ?? speed * 3.5;
    const riseG = r.gravity ?? 20, fallG = r.fallGravity ?? riseG * 1.7;         // asymmetric: snappier fall
    const jumpV = r.jumpSpeed ?? 8.5, maxFall = r.maxFall ?? 26, snap = r.snap ?? 0.15, step = r.step ?? 0.35;
    const coyoteT = r.coyote ?? 0.1, bufferT = r.buffer ?? 0.1, cutV = r.jumpCut ?? 0, air = r.airControl ?? 0.7;
    const t = e.transform;

    // SPACE MODE (opt-in `space:true`, R18) — the second play mode: no gravity, no ground, everyone
    // FLOATS in a true 3-axis void. The vertical + horizontal integrate becomes 6DoF NEWTONIAN drift
    // (momentum + damping along the full look basis, like the `glide` rule), and the locomotion→clip
    // ladder becomes THRUST poses instead of walk strides. Everything else — fire, loadout, the suit
    // switcher, the boost gauge, melee/throw, stagger, the aim lock — is the SHARED ground code,
    // untouched. There is no jump and no kneel in space: Space (`jumpHeld`) = ASCEND, X (`kneel`) =
    // DESCEND, F = boost (same keys, reinterpreted by mode). Absent `space` → the entire ground path
    // below runs behavior-identical.
    const space = r.space === true;
    const ascend = space && !!input.jumpHeld;    // Space held → thrust up (no jump in space)
    const descend = space && !!input.kneel;      // X held → thrust down (no kneel in space)

    // probe the surface under the FEET (from feet + a small step tolerance, looking down): the nearest
    // solid below, IGNORING any platform whose top sits higher than a step above the feet — so you JUMP
    // onto a ledge, you don't warp up by walking into its base. (The renderer's __ground probes from the
    // passed origin; passing feet+step here is what makes that true.)
    const probe = (fz) => (world && world.ground ? world.ground([t.pos[0], t.pos[1], fz + step]) : null);

    // BOOST GAUGE (opt-in `boostMax`, in SECONDS of continuous thrust): boosting drains it in
    // real time, jumps bite `jumpBoostCost` (default 0.8 — legs still jump at empty, the
    // thruster assist just isn't there to pay for), an acrobatic dodge OVERHEATS it outright
    // (dumps the gauge + locks it) unless a modifier exempts it (`dodgeOverheat:false` heat sink →
    // cost-only + chainable; `dodgeBoostCost:0` → free rolls), and changing the dash direction
    // mid-boost bites `boostTurnCost` (default 0.75 — the vectoring modifier). It refills to full
    // in ~5s (`boostRegen`, default boostMax/5 per sec) whenever the thrusters are cold; hitting
    // empty (or overheating) LOCKS them — the OVERHEAT state, thrust dead — until 15% recovers so
    // the cutoff doesn't flutter. No `boostMax` → no gauge: infinite boost,
    // every pre-gauge world behavior-identical.
    const boostMax = r.boostMax > 0 ? r.boostMax : 0;
    const hasGauge = boostMax > 0;
    if (hasGauge && e.boost == null) e.boost = boostMax;
    const payBoost = (cost) => { if (hasGauge && cost > 0) e.boost = Math.max(0, e.boost - cost); };
    const jumpCost = r.jumpBoostCost ?? 0.8;

    // look: A/D tank-turn (default) or full mouse-look (yaw + pitch). In mouselook the MOUSE steers, so
    // A/D (the turn axis) is freed up to STRAFE instead — standard FPS WASD. Pitch is clamped to just
    // shy of straight up/down and drives ONLY the camera, never the (horizontal-plane) movement.
    const lookMode = space || (r.turnMode ?? 'tank') !== 'tank', lookSens = r.lookSens ?? 0.0025;   // space is always 6DoF mouse-look
    let turnAmt;   // heading delta THIS frame — drives the turn-in-place step below
    if (lookMode) {
      turnAmt = input.lookDX * lookSens;
      t.heading = (t.heading + turnAmt) % TAU;
      t.pitch = clamp((t.pitch || 0) + input.lookDY * lookSens, -HALF_PI + 0.05, HALF_PI - 0.05);
    } else { turnAmt = -input.turn * turnRate * dt; t.heading = (t.heading + turnAmt) % TAU; }   // tank: A=left, D=right (heading+ is a LEFT turn)

    // grounded = resting on the surface under the feet, not rising. In SPACE there is no surface —
    // the unit is never grounded, so the airborne/thrust locomotion path is always live.
    const footZ = t.pos[2] - eye;
    let landedEdge = false;
    if (space) {
      e.grounded = false;
    } else {
      const gz0 = probe(footZ);
      const wasGrounded = e.grounded === true;
      // impact speed carried into this frame (before gravity), captured on the LANDING edge below.
      const fallSpeed = wasGrounded ? 0 : Math.max(0, -e.vel[2]);
      e.grounded = gz0 != null && e.vel[2] <= 1e-4 && Math.abs(footZ - gz0) <= snap;
      // LANDING edge = the grounded rising transition. Derived here (not from the hard-touchdown snap
      // at the bottom) because `snap` grounds the unit a few frames before it actually touches, which
      // would otherwise swallow the edge on any fall faster than `snap` per frame. Fires once; the
      // renderer's landing CLANG reads it + the captured fall speed (e.landVel) for loudness.
      landedEdge = e.grounded && !wasGrounded;
      if (landedEdge) e.landVel = fallSpeed;

      // coyote (grace after walking off a ledge) + jump-buffer (press just before touchdown) timers.
      e.coyote = e.grounded ? 0 : Math.min((e.coyote ?? coyoteT) + dt, 1);
      e.jumpBuf = input.jump ? bufferT : Math.max(0, (e.jumpBuf ?? 0) - dt);
    }

    // movement basis (needed by the jump block below for directed charge leaps)
    const sideIn = clamp(input.strafe + (lookMode ? input.turn : 0), -1, 1);
    const f = fwdXY(t.heading), rt = rightXY(t.heading), ctl = e.grounded ? 1 : air;

    // jump — two opt-in shapes on top of the default snappy launch:
    // `jumpWindup` (seconds) inserts a brief SQUAT between press and launch;
    // `chargeMax` (seconds) replaces the whole press model with STOP-AND-CHARGE:
    // holding Space roots the entity and coils the squat (locomotion 'squat',
    // gaitPhase = charge fraction → the clip's depth ramp); releasing launches
    // with jump velocity scaled by the charge (0.6× at a tap → `chargeMult`×
    // at full); reaching full charge AUTO-LAUNCHES toward the held WASD
    // direction — a directed leap carried by a horizontal dash velocity
    // (`chargeDash`, world-space, cleared on landing). Neither param set →
    // byte-identical legacy timing (buffer/coyote/jump-cut intact).
    const windup = r.jumpWindup ?? 0;
    const chargeMax = r.chargeMax ?? 0;
    let jumped = false;
    let charging = false;
    let chargeFrac = 0;   // 0..1 while gathering — the renderer reads it for the charge-up sound
    if (space) {
      // no jump / charge / jump-cut in space — Space is ASCEND, handled by the 6DoF integrate below.
    } else if (chargeMax > 0) {
      const active = e.jumpCharge >= 0;
      if (!active && input.jumpHeld && e.grounded && !input.boost) e.jumpCharge = 0;
      if (e.jumpCharge >= 0) {
        if (!e.grounded || input.boost) e.jumpCharge = -1;   // lost footing / boost cancels
        else {
          e.jumpCharge += dt;
          const frac = Math.min(1, e.jumpCharge / chargeMax);
          chargeFrac = frac;
          if (!input.jumpHeld || frac >= 1) {
            const vmul = 0.6 + ((r.chargeMult ?? 2.2) - 0.6) * frac;
            e.vel[2] = jumpV * vmul;
            e.jumpPower = frac;   // the launch power (0..1) — the release SOUND scales on it
            e.grounded = false; e.coyote = coyoteT; jumped = true;
            if (frac >= 1) {
              // full charge: leap toward the held direction (normalized, world-space)
              const dn = Math.hypot(input.forward, sideIn);
              if (dn > 1e-3) {
                const dashSpd = r.chargeDash ?? speed * 1.6;
                e.dashVel = [
                  (f[0] * input.forward + rt[0] * sideIn) / dn * dashSpd,
                  (f[1] * input.forward + rt[1] * sideIn) / dn * dashSpd,
                ];
              }
            }
            e.jumpCharge = -1;
          } else {
            charging = true;
            e.gaitPhase = frac * 0.9;   // drive the squat clip's depth ramp (below the wrap point)
          }
        }
      }
    } else {
      if ((input.jump || e.jumpBuf > 0) && (e.grounded || e.coyote < coyoteT) && !(e.jumpWind > 0)) {
        if (windup > 0) { e.jumpWind = windup; e.jumpBuf = 0; }
        else { e.vel[2] = jumpV; e.grounded = false; e.coyote = coyoteT; e.jumpBuf = 0; jumped = true; }
      }
      if (e.jumpWind > 0) {
        e.jumpWind -= dt;
        e.gaitPhase = (1 - Math.max(0, e.jumpWind) / windup) * 0.9;   // quick dip down the same squat ramp
        if (e.jumpWind <= 0) { e.jumpWind = 0; e.vel[2] = jumpV; e.grounded = false; e.coyote = coyoteT; jumped = true; }
      }
      // variable height: releasing jump while still rising caps the climb (short hop vs full jump).
      if (e.vel[2] > 0 && !input.jumpHeld) e.vel[2] = Math.min(e.vel[2], cutV);
    }
    // surface the charge state for the renderer's jump audio: `charging`/`chargeFrac` drive the
    // rising GATHER whine, `jumpPower` (0..1) scales the RELEASE on launch. A non-charge (tap/windup)
    // jump has no ramp, so it launches at a fixed light power.
    e.charging = charging;
    e.chargeFrac = charging ? chargeFrac : 0;
    if (jumped && chargeMax <= 0) e.jumpPower = 0.2;

    // ACROBATIC DODGE (opt-in `dodge:true` on the rule): a DOUBLE-TAP of F while
    // grounded, pushed toward a held WASD direction, fires an invincible tumble.
    // F is boost when HELD; a second press EDGE within `doubleTapWindow` after a
    // first is the dodge — so hold-F still boosts, tap-tap-F dodges. The held
    // direction at fire picks the shape + the tumble axis (W roll / S backflip /
    // A·D barrel-roll / none spin), matching the DODGE_POSES shelf. Time-driven
    // one-shot (phase 0→1 over `dodgeDur`): steering is committed (no re-aim),
    // the body dashes along the fired direction on a 0→1→0 speed envelope, and
    // the renderer reads `e.tumble` to spin the whole body a full turn about the
    // maneuver axis. i-frames = the whole duration (`e.invincible`). Losing
    // footing does NOT cancel — an air dodge finishes its arc.
    // `dodge:true` = the acrobatic set (roll/backflip/sideroll/spin by direction);
    // `dodge:'twirl'` = the BULKY read — every direction is a grounded vertical
    // TWIRL (both feet stay down, nothing tumbles), the dash still carried by the
    // held stick. Suits too heavy to leave the ground opt into twirl.
    const dodgeOn = r.dodge === true || r.dodge === 'twirl';
    let dodging = false;
    if (dodgeOn) {
      const dodgeDur = r.dodgeDur ?? 0.55;
      const boostEdge = !!input.boost && !e.boostPrev;
      e.boostPrev = !!input.boost;
      // an acrobatic dodge OVERHEATS the thruster (the gauge mechanic): a roll is a hard vector
      // burn, so committing one DUMPS the whole gauge and latches the empty-lock — the overheat
      // cooldown, during which thrust is dead until it cools past `boostUnlockFrac`. Two modifiers
      // exempt the overheat: `dodgeOverheat:false` (a heat sink — the roll just spends
      // `dodgeBoostCost` and can chain) and `dodgeBoostCost:0` (free rolls, no gauge at all). A
      // dodge is REFUSED unless the thruster is LIVE — not already overheated, and holding at least
      // `dodgeBoostCost` charge (you cannot vector-roll on a dead thruster).
      const dodgeCost = r.dodgeBoostCost ?? 2;
      const dodgeOverheats = hasGauge && dodgeCost > 0 && (r.dodgeOverheat ?? true);
      // ALIGNED RECOVERY (rev3): on an overheat rule the roll is gated by the OVERHEAT itself —
      // `canDodge` below (cost + not locked) — so dodging stays USABLE through ordinary
      // partial-bar recovery. Only a drained, overheat-locked bar (a dodge dump, or thrusting
      // the gauge dry) kills boost AND dodge together, and that outage holds until the bar
      // recovers FULL (~7.5s — the overheat regen regime + full-bar unlock, below). The
      // wall-clock `dodgeCdT` gates only the gaugeless / heat-sink / free-roll shapes
      // (dodgeCooldown ?? 8; a world that wants the old free chaining sets dodgeCooldown: 0).
      const dodgeReady = dodgeOverheats || (e.dodgeCdT || 0) <= 0;
      const canDodge = !hasGauge || dodgeCost <= 0 || (e.boost >= dodgeCost && !e.boostLock);
      if (e.dodgeT == null) {
        // space: the dash starts in mid-float (no ground needed); hoverGrace: a boost-hovering
        // suit (or one whose cushion just vanished with the F release) keeps its ground read.
        if (boostEdge && (e.fTapWin ?? 0) > 0 && (e.grounded || space || (e.hoverGrace || 0) > 0) && canDodge && dodgeReady && e.tackleT == null) {
          beginDodge(e, input, r);   // second tap inside the window → commit the roll (clip + dir + gauge cost)
        } else if (boostEdge) {
          e.fTapWin = r.doubleTapWindow ?? 0.28;   // first tap — open the window
        }
        if ((e.fTapWin ?? 0) > 0) e.fTapWin = Math.max(0, e.fTapWin - dt);
      }
      if (e.dodgeT != null) {
        e.dodgeT += dt / dodgeDur;
        if (e.dodgeT >= 1) { e.dodgeT = null; e.tumble = null; e.invincible = false; e.dodgeDir = null; }
      }
      dodging = e.dodgeT != null;
    }

    // TACKLE (opt-in `r.tackle:true` on the rule; the SHIFT key → `input.tackle`): an INVINCIBLE
    // offensive DASH — a committed straight-ahead shoulder-charge (default 2s) that STAGGERS and
    // chips anything it rams (hit adjudication is stepTackle, run in stepWorld beside stepMelee).
    // It is a body-check, not a shot: it stays invincible for the whole dash and OWNS the body
    // (fire / weapon-switch / dodge / another tackle all refused mid-tackle). THRUSTER COST: it is
    // usable as long as the boost gauge holds ANY charge (a sliver, `e.boost > 0` — no full bar
    // needed, even a locked/recovering bar with a sliver qualifies); committing INSTANTLY DUMPS the
    // whole gauge and latches the overheat lock (like an acrobatic dodge), then the dash runs its
    // full fixed clock regardless. On a gaugeless suit (no `boostMax`) there is no cost and no gate.
    // Absent `r.tackle` → the whole block is skipped, byte-identical.
    const tackleOn = r.tackle === true;
    let tackling = false;
    if (tackleOn) {
      const tackleDur = r.tackleDur ?? 2;
      const tackleEdge = !!input.tackle && !e.tacklePrev;
      e.tacklePrev = !!input.tackle;
      // START GATE: a sliver of thruster (any charge > 0 — the literal "usable as long as there's a
      // sliver"; gaugeless suits are always free), grounded (or floating in space), and not already
      // committed to a tackle / swing / dodge / reaction / charge.
      const hasSliver = !hasGauge || e.boost > 1e-6;
      const tackleBusy = e.tackleT != null || e.swingT != null || e.dodgeT != null || e.staggerT != null || e.jumpCharge >= 0;
      if (e.tackleT == null && tackleEdge && hasSliver && !tackleBusy && (e.grounded || space)) {
        e.tackleT = 0; e.tackleHits = {};
        e.tackleCount = (e.tackleCount || 0) + 1;   // edge for the audio channel (the charge WHOOMPH), like e.dodgeCount
        if (hasGauge) { e.boost = 0; e.boostLock = true; }   // instant full dump + overheat (the thruster cost)
        e.tackleDir = [f[0], f[1]];   // commit straight ahead — steering is locked for the maneuver, like the dodge
      }
      if (e.tackleT != null) {
        e.tackleT += dt / tackleDur;
        if (e.tackleT >= 1) { e.tackleT = null; e.tackleDir = null; e.invincible = false; }
      }
      tackling = e.tackleT != null;
    }

    // WEAPON CYCLING (opt-in `loadout` on the rule — mobile-suit weapon switching): the rule
    // carries an ordered list of weapon configs `{ figure, name?, weapon?, strike?, strikeDur? }`,
    // one ACTIVE at a time (the R5.6 doctrine made runtime: a config is ranged `weapon` OR melee
    // `strike`, never both). R (`input.cycle`) steps the list, 1–N (`input.slot`) direct-selects.
    // Switching swaps the rendered body (`e.body.figure` — each config points at its own baked
    // figure, active weapon in the fist + the other racked) and the fire route (`e.weapon` from
    // the per-slot pool, so ammo/reload state survives a switch; melee slots carry no weapon and
    // left mouse falls through to the strike below). Blocked ONLY mid-swing / mid-dodge — those
    // own the body; boost/air/kneel/charge all allow the swap (the arms are aim-locked anyway).
    const lo = Array.isArray(r.loadout) && r.loadout.length ? r.loadout : null;
    if (lo) {
      let want = null;
      if (input.cycle) want = ((e.loadoutIdx || 0) + 1) % lo.length;
      else if (input.slot >= 1 && input.slot <= lo.length) want = input.slot - 1;
      e.switched = false;
      if (want != null && want !== (e.loadoutIdx || 0) && e.swingT == null && e.dodgeT == null && e.tackleT == null) {
        e.loadoutIdx = want;
        if (lo[want].figure) e.body.figure = lo[want].figure;
        e.weapon = e.loadoutWeapons ? e.loadoutWeapons[want] : null;
        e.switched = true;
        armSwitchReady(e, r, lo[want]);   // SWITCH READY-TIME (2026-07-28): a fresh weapon is not act-ready for ~1s (slot switchReady wins)
      }
    }
    const activeCfg = lo ? lo[e.loadoutIdx || 0] : null;

    // horizontal move — full authority grounded, reduced in the air. Strafe = Q/E always, plus A/D
    // when mouselook frees them (so A/D actually does something in FPS mode).
    // The BOOST GAUGE gates thrust: an empty (or locked-recovering) gauge means F does nothing
    // until 15% refills. No gauge (hasGauge false) → always available (infinite boost).
    // BOOST-CANCEL MELEE (R22): a melee opener may CUT the thrust (`e.boostCut`, set in the
    // strike block below) — the cancel is a cancel, not a pause: F stays dead until the key is
    // RELEASED, then a fresh press dashes again.
    const boostAvailable = !hasGauge || (e.boost > 1e-6 && !e.boostLock);
    if (!input.boost) e.boostCut = false;
    let boosting = !!input.boost && !dodging && !tackling && boostAvailable && !e.boostCut;
    // KNEEL (opt-in `kneel:true` on the rule; held X): a grounded one-knee
    // hold — roots the entity and plays the 'kneel' clip. Boost and the
    // charge jump both take precedence (either input stands the unit up).
    const kneeling = r.kneel === true && !!input.kneel && e.grounded && !boosting && !charging && !dodging && !tackling;
    // MELEE STRIKE (opt-in `strike:'melee'` on the rule; fire = left mouse —
    // the SAME input the ranged weapon subsystem reads, so "click acts the
    // active weapon" holds across every armed unit: a unit carries either a
    // ranged `weapon` or melee swing clips, never both). The fire press EDGE
    // roots the entity and plays the swing clip ONCE — phase driven by TIME
    // (0→1 over `strikeDur` sec), not distance — then control returns to the
    // gait through the normal mix crossfade. Boost or losing footing cancels
    // mid-swing. Direction variants (forward/left/right from held WASD at
    // press time) arrive with their clips; until then every press swings
    // 'neutral' — the overhead cross.
    // With a loadout, the strike mode comes from the ACTIVE config (a melee slot carries
    // `strike:'melee'`), so the click routes to whatever is currently in the fist.
    const strikeOn = activeCfg ? activeCfg.strike === 'melee' || activeCfg.strike === true
      : r.strike === 'melee' || r.strike === true;
    let swinging = false;
    if (strikeOn && !tackling) {
      const fireEdge = !!input.fire && !e.strikePrev;
      e.strikePrev = !!input.fire;
      // COMBO 1 + MELEE ENFORCEMENT (2026-07-28, supersedes the unbounded 2026-07-27 strings;
      // opt-in `combo:1` on the slot): a combo-1 slot allows a TWO-HIT string — the opener plus
      // exactly ONE follow-up. The opener (whiff or hit) opens the follow-up window
      // (`comboWindow` sec); a timed click inside it is a COMBO step only if it swings a
      // DIFFERENT direction than the opener (a repeat-direction click stays governed by the
      // cooldown). The follow-up aims by the LIVE heading at click time (the camera-honored
      // cut), and a back-cleave step still KNOCKS DOWN on connect. The follow-up does NOT open
      // another window — the string is CAPPED at 2 — and after it the fist is spent for the
      // longer `comboCooldown` (below) before the same weapon can melee again.
      const comboDepth = (activeCfg && activeCfg.combo) || (!activeCfg && r.combo) || 0;
      // MELEE COOLDOWN (R20.5, opt-in `strikeCooldown` sec on the slot/rule): after a swing ends
      // the fist is SPENT for that long — a fresh opener is refused. The one exception is a
      // COMBO click (inside the window): the follow-up bypasses the cooldown by design, or the
      // 0.8s window could never beat a 2s lockout. The timer ticks world-side (stepWorld), so it
      // keeps draining through staggers and pilot transfers like every other weapon timer.
      const strikeCd = (activeCfg && activeCfg.strikeCooldown) ?? r.strikeCooldown ?? 0;
      // COMBO COOLDOWN (2026-07-28): the ENFORCED lockout after a combo FOLLOW-UP lands — 2.5s
      // by default, longer than the base per-swing `strikeCooldown`, so the 2-hit burst is paid
      // for. Only a completed follow-up arms it; a lone opener keeps the base cooldown.
      const comboCooldown = (activeCfg && activeCfg.comboCooldown) ?? r.comboCooldown ?? 2.5;
      // DIRECTIONAL pick, resolved BEFORE the combo gate (the string rule reads it): the held
      // WASD at press time picks which strike plays (dominant planar axis, same read as the
      // boost/dodge direction pick). sideIn > 0 = right; forward > 0 = W (thrust) / < 0 = S
      // (the great cleave → the topple swing). No direction held = the standing overhead cross.
      // Missing clips degrade to swing_neutral in the renderer (__clipLookup).
      const swingDir = Math.abs(sideIn) > Math.abs(input.forward)
        ? (sideIn > 0 ? 'right' : 'left')
        : (input.forward < -1e-3 ? 'back' : input.forward > 1e-3 ? 'forward' : 'neutral');
      const comboClick = comboDepth > 0 && (e.comboT || 0) > 0 && swingDir !== e.lastSwingDir;
      if (e.swingT == null && fireEdge && (((e.strikeCdT || 0) > 0 && !comboClick) || (e.readyT || 0) > 0)) {
        // spent — the click is eaten: the melee cooldown (combo click excepted), OR the
        // post-switch READY-TIME (which nothing bypasses — a fresh saber can't insta-swing).
      } else if (e.swingT == null && fireEdge && !charging && !kneeling && !dodging
          // BOOST-CANCEL MELEE (R22): activating melee mid-boost CUTS the thrust and swings
          // like you are standing — allowed only on a cooldown-paced slot (strikeCooldown > 0;
          // a free-swing slot would make the cancel a spammable brake) and only with footing
          // under the jets (a grounded dash or the hover cushion — an airborne boost-jump arc
          // still refuses). Not boosting → the classic grounded/space gate, unchanged.
          && (boosting ? strikeCd > 0 && (e.grounded || e.hovering || space) : (e.grounded || space))) {
        if (boosting) {
          e.boostCut = true; boosting = false;   // cut the thrust; `halt` roots the swing below
          // the hover cushion COLLAPSES under the strike — plant the feet and swing standing
          // (waiting out a tall clearance's fall would eat the swing; over a probe-null void
          // there is nothing to plant on and the ordinary fall + grace rules apply)
          if (e.hovering) {
            const gz = probe(t.pos[2] - eye);
            if (gz != null) { t.pos[2] = gz + eye; e.vel[2] = 0; e.grounded = true; e.hovering = false; }
          }
        }
        const sc = activeCfg || r;
        // NAMED SWING SET (geof heat rod): a melee slot may name its own clip set
        // (`swingSet:'whip'` → whip_<dir> clips), so two melee slots on ONE figure
        // don't collide on the shared swing_<dir> clip names. Default 'swing' —
        // every existing melee slot picks the same clips as before.
        // the swing CLIP + `strikeParams` (reach/cone/contact-window/damage/topple) — the shared
        // meleeSwingSpec, so the ai melee-seek lands the exact same numbers. `strikeVerbs` per-direction
        // overrides + the back-cleave topple default all live inside it.
        const spec = meleeSwingSpec(sc, r, swingDir, comboDepth > 0);
        e.swingT = 0; e.swingClip = spec.clip;
        // COMMITTED STEP (opt-in `r.cleaveStep`, world units): the great-cleave (back) LUNGES the
        // whole body a real step forward in world space so the sword-side leg's plant lands ground,
        // not air. Direction commits to the current facing at the swing start (like tackle/dodge).
        // Absent `r.cleaveStep` → null, byte-identical.
        e.cleaveStepDir = (swingDir === 'back' && (r.cleaveStep || 0) > 0) ? [f[0], f[1]] : null;
        e.cleaveStepProg = 0;
        breakGuards(e);   // attacking spends any protection (spawn shield / wake guard / dodge i-frames)
        e.swingCombo = comboClick;   // clicked inside the window → this is the knockdown-capable swing
        e.comboT = 0;                // one chance — the window is spent
        // a fresh swing: bump the count (the audio channel plays the crackling-ozone whoosh
        // on this edge), reset the once-per-target melee gate, and stamp the strike numbers.
        // `lastSwingDir` is the combo-string memory — the NEXT window's different-direction gate.
        e.swingCount = (e.swingCount || 0) + 1;
        e.struckThisSwing = {};
        e.strikeParams = spec.params;
        e.lastSwingDir = swingDir;
      } else if (e.swingT != null) {
        const wasCombo = !!e.swingCombo;   // was THIS swing the combo follow-up? (captured before the reset)
        e.swingT += dt / ((activeCfg && activeCfg.strikeDur) ?? r.strikeDur ?? 0.9);
        // boost or losing footing cancels mid-swing — but the hover-coyote grace covers the
        // short cushion drop after a BOOST-CANCEL opener (the ≤ankle-height fall to standing
        // must not kill the swing it paid for; a genuine ledge fall outlives the grace and
        // still cancels).
        if (e.swingT >= 1 || boosting || (!space && !e.grounded && (e.hoverGrace || 0) <= 0)) {
          // COMBO CAP (2026-07-28): the OPENER (not itself a combo step) opens the one follow-up
          // window; the combo FOLLOW-UP opens NOTHING — the string is capped at 2 hits (combo 1).
          if (e.swingT >= 1 && comboDepth > 0 && !wasCombo) {
            e.comboT = (activeCfg && activeCfg.comboWindow) ?? r.comboWindow ?? 0.8;
          }
          // every swing's end (completed or cancelled — the arm was spent either way) arms the
          // melee cooldown; the combo click bypasses it to land inside the window. A naturally-
          // completed FOLLOW-UP arms the longer enforced `comboCooldown`; everything else the base.
          const cd = (e.swingT >= 1 && wasCombo) ? comboCooldown : strikeCd;
          if (cd > 0) { e.strikeCdT = cd; e.strikeCdMax = cd; }   // strikeCdMax → the HUD ring drains over the right span
          e.swingT = null; e.swingCombo = false; e.cleaveStepDir = null;
        }
      }
      swinging = e.swingT != null;
    }
    // the combo follow-up window decays in real time while no swing runs (miss it and the next
    // swing is an ordinary opener again)
    if (e.swingT == null && e.comboT > 0) e.comboT = Math.max(0, e.comboT - dt);
    // THROW (a `throw` slot — the hand-tossed grenade): the SAME fire edge that launches the lob
    // projectile (stepWeapon, after this rule) also plays a quick `swing_throw` arm clip. It rides the
    // swing playback (e.swingT/e.swingClip) but carries NO strikeParams, so stepMelee no-ops — it is a
    // pure animation. A slot is strike OR throw OR plain-ranged, so it shares the fire-edge tracker.
    const throwOn = !strikeOn && activeCfg && activeCfg.throw && e.weapon;
    if (throwOn) {
      const w = e.weapon;
      const fireEdge = !!input.fire && !e.strikePrev;
      e.strikePrev = !!input.fire;
      if (e.swingT == null && fireEdge && (e.grounded || space) && !boosting && !charging && !kneeling && !dodging
          && w.ammo > 0 && w.cooldownT <= 0 && !w.reloading) {
        e.swingT = 0; e.swingClip = 'swing_throw'; e.strikeParams = null;   // visual only — the round is stepWeapon's job
        breakGuards(e);   // throwing spends any protection (spawn shield / wake guard / dodge i-frames)
        e.swingCount = (e.swingCount || 0) + 1;
      } else if (e.swingT != null) {
        e.swingT += dt / (activeCfg.throwDur ?? 0.5);
        if (e.swingT >= 1 || boosting || (!space && !e.grounded)) e.swingT = null;
      }
      swinging = e.swingT != null;
    }
    // BOOST ARMOR (R23): surface the live boost state so the hit adjudicators (stepWeapon /
    // burstProjectile, run later in stepWorld) can read whether THIS suit is thrusting when a
    // stun lands — a boosting suit with `body.boostArmor` halves incoming stun (below). Final here:
    // `boosting` is settled (a melee boost-cancel already flipped it false, so a cancelled dash
    // is unarmored — you're planted and swinging, not thrusting).
    e.boosting = boosting;
    // boost thrust vector from the held direction keys (normalized; plain F = forward)
    let bf = boosting ? input.forward : 0, bs = boosting ? sideIn : 0;
    if (boosting && Math.abs(bf) + Math.abs(bs) < 1e-3) bf = 1;
    const bn = Math.hypot(bf, bs) || 1;
    // STOP-AND-CHARGE (and the kneel, the melee strike, the dodge) root the
    // entity's normal drive — the dodge substitutes its own committed dash.
    const halt = charging || kneeling || swinging || dodging || tackling ? 0 : 1;
    let fwdMove = 0, sideMove = 0;   // the ground planar step this frame (drives the ground locomotion phase)
    if (space) {
      // 6DoF NEWTONIAN drift: accelerate along the full look basis (fwd3 = heading + pitch) + a
      // vertical Space/X trim, damp toward rest, clamp to a mode speed cap (boost raises accel AND
      // cap). No gravity, no ground. A swing halts NEW thrust but momentum coasts — you drift on.
      // Plain F with no stick (like the ground bf=1 default) thrusts along the look forward.
      const boostK = boosting ? (r.spaceBoostAccel ?? 2) : 1;
      const sAccel = (r.spaceAccel ?? speed * 4) * boostK;
      const sMax = boosting ? (r.spaceBoostMax ?? boostSpeed) : (r.spaceMaxSpeed ?? speed * 2);
      const f3 = fwd3(t.heading, t.pitch || 0), rt3 = rightXY(t.heading);
      let inF = input.forward, inS = sideIn, inV = (ascend ? 1 : 0) - (descend ? 1 : 0);
      if (boosting && Math.abs(inF) + Math.abs(inS) + Math.abs(inV) < 1e-3) inF = 1;
      let a = [0, 0, 0];
      a = add(a, scl(f3, inF * sAccel * halt));
      a = add(a, scl(rt3, inS * strafe * sAccel * halt));
      a = add(a, scl([0, 0, 1], inV * (r.liftAccel ?? (speed * 4)) * boostK));   // vertical trim is not halted by a swing
      let v = add(scl(e.vel, 1 - smooth(r.spaceDamping ?? 3.5, dt)), scl(a, dt));   // momentum + damping
      const sp = Math.hypot(v[0], v[1], v[2]);
      if (sp > sMax) v = scl(v, sMax / sp);
      e.vel = v;
      t.pos = add(t.pos, scl(v, dt));
    } else {
      fwdMove = (boosting ? (bf / bn) * boostSpeed * ctl * dt : input.forward * speed * ctl * dt) * halt;
      sideMove = (boosting ? (bs / bn) * boostSpeed * ctl * dt : sideIn * strafe * speed * ctl * dt) * halt;
      t.pos = add(t.pos, add(scl(f, fwdMove), scl(rt, sideMove)));
    }
    // dodge dash: a committed burst along the fired direction (0→1→0 envelope,
    // world-space — steering is locked for the maneuver). Planar in both modes.
    if (dodging && e.dodgeDir) {
      const env = Math.sin(Math.min(1, e.dodgeT) * Math.PI);
      const dsp = (r.dodgeSpeed ?? speed * 2.6) * env * dt;
      t.pos[0] += e.dodgeDir[0] * dsp; t.pos[1] += e.dodgeDir[1] * dsp;
    }
    // tackle dash: a committed CONSTANT-speed charge straight ahead (planar in both modes, like the
    // dodge dash) for the whole tackle clock — the offensive gap-closer. `tackleSpeed` defaults to
    // the boost speed (a fast lunge, not the slower dodge envelope).
    if (tackling && e.tackleDir) {
      const tsp = (r.tackleSpeed ?? boostSpeed) * dt;
      t.pos[0] += e.tackleDir[0] * tsp; t.pos[1] += e.tackleDir[1] * tsp;
    }
    // charged directed leap: the launch's horizontal dash carries through the air (ground only)
    if (!space && e.dashVel) { t.pos[0] += e.dashVel[0] * dt; t.pos[1] += e.dashVel[1] * dt; }
    // committed cleave step: advance the body forward by the step envelope — ramps in over the
    // step/downswing (commits by ~38% phase) then HOLDS (dprog 0), so the suit ENDS the swing
    // advanced (not a lunge-and-return). Incremental delta so world.colliders eject it like any
    // other horizontal write (the block below), and the ground snap keeps the plant on the floor.
    if (swinging && e.cleaveStepDir) {
      const prog = (r.cleaveStep || 0) * Math.min(1, (e.swingT || 0) / 0.38);
      const dprog = prog - (e.cleaveStepProg || 0);
      if (dprog > 0) { t.pos[0] += e.cleaveStepDir[0] * dprog; t.pos[1] += e.cleaveStepDir[1] * dprog; }
      e.cleaveStepProg = prog;
    }

    // LATERAL BLOCKING (opt-in `world.colliders`): after every horizontal write (walk / boost /
    // dodge-dash / charge-leap), eject the footprint out of any solid box whose z-band the body
    // overlaps. `collideRadius` is the suit's footprint (shoulder half-width); `collideHeight` its
    // standing height (gates walk-under). Pure — no colliders → untouched (the open void has none).
    if (world && world.colliders) {
      if (space) resolveBlocking3D(t.pos, e.vel, r.collideRadius ?? 0, world.colliders);   // 3D solid — the station + rocks stop the suit
      else resolveBlocking(t.pos, footZ, r.collideHeight ?? (eye || 24), r.collideRadius ?? 0, world.colliders, step);
    }

    // vertical — gravity (asymmetric), terminal clamp, integrate, then LAND on the surface below.
    // SPACE integrated its own z above (Newtonian, no gravity), so this whole block is ground-only.
    // BOOST HOVER (opt-in `boostHover`, ground mode): live thrust carries the suit at that ground
    // CLEARANCE above the surface below — the movement assist: an obstacle lower than the lifted
    // feet never meets the body's z-band (resolveBlocking) and its top reads as passing terrain
    // to the down-probe, so the suit SKIMS OVER it instead of stopping. Below the clearance the
    // thrusters LIFT toward it (`hoverRise` per sec, gravity suspended); above it (a boost-jump's
    // arc, a cliff edge) gravity drops the suit onto the thrust CUSHION — caught and held at the
    // clearance, a float, never a touchdown (no landing edge/clang while the jets are live), and
    // the skim follows terrain up and down. Releasing F (or an empty/locked gauge killing
    // `boosting`) removes the cushion and the ordinary fall + touchdown take over. Over a void
    // (probe null) thrust saves nothing — you fall like always. Absent `boostHover` → hover 0 →
    // this whole block is byte-identical legacy gravity.
    if (!space) {
      const hover = boosting && r.boostHover > 0 ? r.boostHover : 0;
      const gzH = hover > 0 && e.vel[2] <= 1e-6 ? probe(t.pos[2] - eye) : null;
      e.hovering = false;
      if (gzH != null && t.pos[2] - eye < gzH + hover - 1e-9) {
        // below the clearance, not rising → thrust lift: a rate-limited climb toward it
        t.pos[2] = Math.min(gzH + hover + eye, t.pos[2] + (r.hoverRise ?? jumpV) * dt);
        e.vel[2] = 0; e.grounded = false; e.hovering = true;
      } else {
        const footZ0 = t.pos[2] - eye;   // pre-fall foot height (the swept-probe origin)
        e.vel[2] = Math.max(-maxFall, e.vel[2] - (e.vel[2] > 0 ? riseG : fallG) * dt);
        t.pos[2] += e.vel[2] * dt;
        // SWEEP the touchdown probe from the HIGHER of the pre/post foot, not the post-fall foot. A fast
        // fall (low framerate / big dt, a knockback launch, the drop-in settle over the wavy drape) moves
        // more than `step` in one frame, so probing from the NEW foot starts the down-ray BELOW the
        // surface just crossed → the raycast finds nothing → no touchdown → the unit sinks further next
        // frame and TUNNELS THROUGH THE GROUND, falling forever. From the pre-fall foot the ray always
        // starts above that surface and catches it. Byte-identical when not crossing a surface this frame
        // (same nearest-surface-below), and rising frames (vel>0) fail the `vel<=0` gate below regardless.
        const gz1 = probe(Math.max(footZ0, t.pos[2] - eye));
        if (gz1 != null && e.vel[2] <= 0 && t.pos[2] - eye <= gz1 + hover + 1e-4) {
          if (hover > 0) {
            // caught on the thrust cushion at the clearance — held afloat, not landed
            t.pos[2] = gz1 + hover + eye; e.vel[2] = 0; e.hovering = true;
            e.dashVel = null;   // a charged leap's carry ends where the fall is caught
          } else {
            t.pos[2] = gz1 + eye; e.vel[2] = 0; e.coyote = 0; e.grounded = true;   // hard touchdown: lock to the surface
            e.dashVel = null;   // the charged leap's carry ends at touchdown
            if (chargeMax <= 0 && e.jumpBuf > 0) { e.vel[2] = jumpV; e.grounded = false; e.jumpBuf = 0; }   // buffered jump fires on touchdown (legacy mode)
          }
        } else if (e.vel[2] <= 0 && !e.grounded && world && world.ground) {
          // EMBED RECOVERY: boosting/walking into terrain that rises faster than the per-frame step-up
          // (a ramp, a steep slope), or a drop-in seated a hair under the wavy surface, leaves the FOOT
          // below the floor at this (x,y). The touchdown probe above only looks DOWN, so it sails under
          // that floor and the suit sinks and falls through the map (the sky dome used to "catch" it at
          // z≈-3460). Cast from HEAD height: a surface ABOVE the foot but within the body means the suit
          // is embedded → climb onto it. A real roof (clearance > body) stays above the head, never
          // grabbed, so walk-under is intact.
          const footNow = t.pos[2] - eye;
          const climbUp = r.collideHeight ?? (eye || 24);
          const head = world.ground([t.pos[0], t.pos[1], footNow + climbUp]);
          if (head != null && head > footNow + 1e-4 && head <= footNow + climbUp + 1e-4) {
            t.pos[2] = head + eye; e.vel[2] = 0; e.grounded = true; e.dashVel = null;
          }
        }
      }
      // hover GRACE: tap-tap-F (the dodge) after a hover boost happens mid-drop — the cushion
      // vanished with the F release, but the maneuver deserves its ground read. Keep the
      // grounded-only gates open for a beat after hovering ends, like coyote time.
      e.hoverGrace = e.hovering ? (r.hoverCoyote ?? 0.45) : Math.max(0, (e.hoverGrace || 0) - dt);
    }

    // edges + gait (surfaced to the bus later; drive land-dust / jump-sound / a figure's frame).
    // `landed` is the grounded rising edge computed up top (snap-inclusive), not this touchdown block.
    e.jumped = jumped; e.landed = landedEdge;
    // locomotion clip + gait: the DOMINANT planar axis picks which walk cycle plays (a figure-frames
    // body side-STEPS when strafing, walks when going fore/aft — same `speed`, so the cadence matches)
    // and its signed distance drives the phase (back-walk + left/right side-steps play it opposite ways).
    const strideLen = r.stride ?? 2.4;
    // the directional flight clip: dominant axis picks side vs fore/aft
    // side dashes are DIRECTIONAL (bs > 0 = right): the flying-kick clips. Bodies baked before
    // the split fall back boost_right/left → boost_side → forward in the renderer.
    const boostClip = () => (Math.abs(bs) > Math.abs(bf) ? (bs > 0 ? 'boost_right' : 'boost_left') : (bf < 0 ? 'boost_back' : 'boost'));
    const boostPhase = () => { e.gaitPhase = (e.gaitPhase || 0) + (Math.abs(sideMove) > Math.abs(fwdMove) ? sideMove : fwdMove) / strideLen; };
    if (tackling) {
      // the tackle OWNS the body: it reads as a forward thrust CHARGE — reuse the 'boost' pose (the
      // suit leans into the dash with its thrusters lit) so no new clip needs baking, and it stays
      // INVINCIBLE for the whole dash (a body-check, not a spent-on-fire dodge). No tumble.
      e.locomotion = 'boost'; e.moving = true; e.invincible = true; e.tumble = null;
      e.gaitPhase = (e.gaitPhase || 0) + (r.tackleSpeed ?? boostSpeed) * dt / strideLen;
    } else if (dodging) {
      // the dodge OWNS the body: hold the static tuck/pike/spin shape while the
      // renderer tumbles the whole rig a full turn about the maneuver axis.
      e.locomotion = e.dodgeClip; e.moving = true; e.invincible = !e.dodgeSpent; e.gaitPhase = 0;
      const ang = Math.min(1, e.dodgeT) * (r.dodgeTurns ?? 1) * TAU;
      let ax;
      if (e.dodgeKind === 'fwd') ax = [-rt[0], -rt[1], 0];          // roll FORWARD (pitch over the front) about the lateral axis
      else if (e.dodgeKind === 'back') ax = [rt[0], rt[1], 0];      // flip BACKWARD (pitch over the back)
      else if (e.dodgeKind === 'side') ax = [f[0] * e.dodgeSign, f[1] * e.dodgeSign, 0];  // barrel-roll about forward
      else ax = [0, 0, 1];                                          // spin about vertical
      e.tumble = { axis: ax, angle: ang };
    } else if (space) {
      // SPACE THRUST LADDER — no walk strides: the body ALWAYS thrusts, on a 3-rung intensity ladder
      // (idle float → soft forward/strafe thrust → full boost), plus dedicated ascend/descend poses.
      // A mid-air swing still shows its swing clip. The gait phase advances by the SPEED travelled, so
      // the thrust tremor always lives and speeds UP when you go faster (boost / ascend / descend).
      // The clips themselves are swapped in at bake time (bakeUnitRig({ space:true })).
      if (swinging) { e.locomotion = e.swingClip || 'swing_neutral'; e.gaitPhase = Math.min(e.swingT, 0.999); e.moving = true; }
      else {
        e.gaitPhase = (e.gaitPhase || 0) + Math.hypot(e.vel[0], e.vel[1], e.vel[2]) * dt / strideLen;
        const movingXY = Math.abs(input.forward) + Math.abs(sideIn) > 1e-3;
        if (boosting) e.locomotion = boostClip();
        else if (ascend && !descend) e.locomotion = 'ascend';
        else if (descend && !ascend) e.locomotion = 'descend';
        else if (movingXY) e.locomotion = Math.abs(sideIn) > Math.abs(input.forward) ? 'strafe' : 'forward';
        else e.locomotion = 'idle';
        e.moving = boosting || ascend || descend || movingXY;   // idle float plays via the baked idle when false
      }
    } else if (!e.grounded) {
      // AIRBORNE: the legs stop cycling — the pose HOLDS for the whole flight.
      // Boost (any direction) or forward drive plays the matching thruster
      // pose (its phase keeps advancing so the tremor lives); a plain
      // vertical jump holds 'leap' with the phase frozen. Bodies without
      // those clips fall back to 'forward' in the renderer.
      if (boosting) { e.locomotion = boostClip(); boostPhase(); }
      else if (input.forward > 0) { e.locomotion = 'boost'; e.gaitPhase = (e.gaitPhase || 0) + fwdMove / strideLen; }
      else e.locomotion = 'leap';
      e.moving = true;
    } else if (e.jumpWind > 0 || charging) {
      // wind-up / charge: hold the anticipation crouch (gaitPhase carries the
      // squat clip's depth ramp — set by the jump block, not by distance)
      e.locomotion = 'squat';
      e.moving = true;
    } else if (boosting) { e.locomotion = boostClip(); boostPhase(); e.moving = true; }
    else if (kneeling) { e.locomotion = 'kneel'; e.moving = true; }
    else if (swinging) {
      // one-shot strike: the gait phase IS the swing progress (clamped under
      // the wrap point so the pose never interpolates finish→windup)
      e.locomotion = e.swingClip || 'swing_neutral';
      e.gaitPhase = Math.min(e.swingT, 0.999);
      e.moving = true;
    }
    else if (Math.abs(fwdMove) + Math.abs(sideMove) < 1e-6 && Math.abs(turnAmt) > (r.turnStepMin ?? 0.0025)) {
      // TURN IN PLACE: the heading is changing (mouse-look / tank turn) but the body
      // is NOT translating — step the feet AROUND the turn (the 'turn' clip crosses
      // one foot over the other) instead of skating the planted pose. gaitPhase
      // advances by the SIGNED turn angle (turning the two ways plays the step
      // opposite ways), scaled by `turnStride` (radians per step cycle) so a pivot
      // reads as a few steps. Bodies without a 'turn' clip fall back to forward.
      e.locomotion = 'turn';
      e.gaitPhase = (e.gaitPhase || 0) + turnAmt / (r.turnStride ?? 0.6);
      e.moving = true;
    }
    else if (Math.abs(sideMove) > Math.abs(fwdMove)) { e.locomotion = 'strafe'; e.gaitPhase = (e.gaitPhase || 0) + sideMove / strideLen; e.moving = (Math.abs(fwdMove) + Math.abs(sideMove)) > 1e-6; }
    else { e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + fwdMove / strideLen; e.moving = (Math.abs(fwdMove) + Math.abs(sideMove)) > 1e-6; }

    // thruster flame intensity (renderer lights the unit's backpack + foot jets,
    // channels.js __updateThrusters): FULL on any boost, a lighter plume on an
    // airborne forward-drive glide (the boost-jet arc), 0 otherwise. The renderer
    // eases it, so a bare 0/1 here reads as a flare-up / fade-out.
    // SPACE floors the plume nonzero — there is ALWAYS thrust: idle float ~0.25 → walk ~0.5 →
    // ascend/descend ~0.6 → full boost 1. Ground keeps the old 0-floor (boost / airborne-glide only).
    e.thrust = space
      ? (boosting || tackling ? 1 : (ascend || descend ? 0.6 : (Math.abs(input.forward) + Math.abs(sideIn) > 1e-3 ? 0.5 : 0.25)))
      : (boosting || tackling ? 1 : (!e.grounded && input.forward > 0 ? 0.6 : 0));
    // thrust DIRECTION as a body-frame yaw (0 = forward, + = toward the right,
    // ±π = back): the renderer VECTORS the backpack jets to exhaust opposite
    // the dash, so a left dash blows the flames out to the right.
    e.thrustYaw = boosting ? Math.atan2(bs / bn, bf / bn) : 0;

    // BOOST GAUGE bookkeeping (opt-in): charge this frame's costs, regen when the thrusters are
    // cold, and latch/clear the empty-lock. `e.boost` is the live seconds-of-thrust remaining;
    // the renderer reads it for the HUD gauge. Deterministic (pure functions of input + dt).
    if (hasGauge) {
      if (jumped) payBoost(jumpCost);   // every launch bites the jump cost (legs still jump at empty)
      if (boosting) {
        payBoost(dt);   // continuous thrust drains 1 unit / sec — boostMax seconds of boost
        // direction-change bite: a set cost each time the DOMINANT dash direction flips mid-boost
        // (`boostTurnCost`, default 0.75 — the vectoring modifier; 0 disables it).
        const dir = boostClip();
        const turnCost = r.boostTurnCost ?? 0.75;
        if (turnCost > 0 && e.boostDir && e.boostDir !== dir) payBoost(turnCost);
        e.boostDir = dir;
      } else {
        e.boostDir = null;
        // recharge whenever the thrusters are cold. HOLDING F during an OVERHEAT does NOTHING — the
        // bar recharges regardless of whether the button is held (operator: the old "release to
        // recharge" penalty is gone; a spent booster no longer sits empty while you mash it).
        // Ordinary partial-bar recovery is quick (`boostRegen`, default boostMax/5 — full in ~5s); an
        // OVERHEAT recovery (the bar was drained and locked — a dodge dump, or thrusting it dry)
        // climbs at `overheatRegen` (default boostMax/7.5 — the ~7.5s outage, rev3).
        const rr = e.boostLock ? (r.overheatRegen ?? boostMax / 7.5) : (r.boostRegen ?? boostMax / 5);
        e.boost = Math.min(boostMax, e.boost + rr * dt);
      }
      // empty-lock: latch spent when drained; the OVERHEAT holds until the bar recovers FULL
      // (rev3 — `boostUnlockFrac` default 1; a world may pin the old 0.15 hysteresis).
      if (e.boost <= 1e-6) e.boostLock = true;
      else if (e.boostLock && e.boost >= boostMax * (r.boostUnlockFrac ?? 1)) e.boostLock = false;
    }
  }

  // follow — a chase/over-the-shoulder camera. Eases toward a pose behind+above its target and looks
  // slightly ahead of it. offset 0 + height 0 → rides inside the target (FPV). Not input-driven; it
  // is slaved to the entity you control (control flows input → target → camera).
  // `reverse:true` mirrors the chase pose to the FRONT of the target (looking slightly behind it) —
  // the detail view: WASD keeps driving the target exactly as before, you just watch it face-on.
  // The flag is live-flippable (the world HUD toggles it); the flip eases as an ORBIT about the
  // target (flipMix 0→1 rotates the whole chase basis by π at `flipRate`/sec) so the camera swings
  // around the unit instead of lerping straight through it.
  // VERTICAL AIM: the camera pitches WITH the target's look pitch (set by mouse Y in the platform
  // rule), so looking up/down frames higher/lower things and screen-center tracks the shot line.
  // `pitchFollow` (0..1, default 1) scales it; 0 keeps the old flat chase. At pitch 0 the framing is
  // byte-identical to before — the offset just rotates in the heading-vertical plane about the target.
  function follow(e, input, dt, world) {
    const r = e.rule;
    // CINEMATIC (tackle-cinematic.plan.md): while a shove-down set piece runs, frame the PAIR from the
    // side (ease in on the same lerp); clearing world.cinematic eases the chase back.
    const cine = world.cinematic;
    if (cine) {
      const A = world.byId[cine.a], B = world.byId[cine.b];
      if (A && B) {
        const pa = A.transform.pos, pb = B.transform.pos;
        const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, mz = (pa[2] + pb[2]) / 2;
        let ux = pb[0] - pa[0], uy = pb[1] - pa[1]; const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
        const sx = -uy * cine.side, sy = ux * cine.side;   // the chosen perpendicular (side)
        // FRAME THE FULL BODIES: pulled back + raised (was 16 / 7, too close — heads clipped) and the
        // look point lifted to BODY CENTER (was mz+1.5, near the feet) so the whole head-to-toe shove
        // reads. Tunable per camera (cineDist / cineHeight / cineLookH) for a tighter or wider set piece.
        const cd = r.cineDist ?? 42, chh = r.cineHeight ?? 15;
        const want = [mx + sx * cd, my + sy * cd, mz + chh];
        e.transform.pos = add(e.transform.pos, scl(sub(want, e.transform.pos), smooth(r.lerp ?? 8, dt)));
        e.lookAt = [mx, my, mz + (r.cineLookH ?? 12)];
        return;
      }
    }
    const tgt = world.byId[r.target];
    if (!tgt) return;
    const dist = r.dist ?? 6, height = r.height ?? 3, shoulder = r.shoulder ?? 0, lead = r.lead ?? 4, lookH = r.lookH ?? 1.5, lerp = r.lerp ?? 8;
    const wantFlip = r.reverse ? 1 : 0;
    if (e.flipMix == null) e.flipMix = wantFlip;   // start settled (no swing on load)
    e.flipMix += (wantFlip - e.flipMix) * smooth(r.flipRate ?? 3, dt);
    const h = tgt.transform.heading + Math.PI * e.flipMix, f = fwdXY(h), rt = rightXY(h);
    // pitch: flip negates it so the reverse (face-on) cam tilts to keep the unit framed the same way.
    const pf = r.pitchFollow == null ? 1 : r.pitchFollow;
    const p = (tgt.transform.pitch || 0) * pf * (e.flipMix > 0.5 ? -1 : 1);
    const cp = Math.cos(p), sp = Math.sin(p);
    // chase offset behind the target, rotated by pitch: pull in by cos(p) horizontally, drop the camera
    // by dist·sin(p) and raise the look point by lead·sin(p) — the view tilts up when you look up.
    const want = [
      tgt.transform.pos[0] - f[0] * dist * cp + rt[0] * shoulder,
      tgt.transform.pos[1] - f[1] * dist * cp + rt[1] * shoulder,
      tgt.transform.pos[2] + height - dist * sp,
    ];
    const k = smooth(lerp, dt);
    e.transform.pos = add(e.transform.pos, scl(sub(want, e.transform.pos), k));
    e.lookAt = [
      tgt.transform.pos[0] + f[0] * lead * cp,
      tgt.transform.pos[1] + f[1] * lead * cp,
      tgt.transform.pos[2] + lookH + lead * sp,
    ];
  }

  // clock — autonomous frame playback: advance the gait/anim phase by time, no input. Turns a
  // figure-frames body into a self-playing loop (a turntable / ambient walker). `rate` = cycles/sec.
  function clock(e, input, dt) {
    e.gaitPhase = (e.gaitPhase || 0) + dt * (e.rule.rate ?? 1);
    e.moving = true;
  }

  // mover — a scripted moving PLATFORM / lift: the carrier a platform-rule rider rides. No input; the
  // entity ping-pongs between `from` and `to` over `period` seconds on a smoothstepped triangle wave,
  // fully deterministic + dt-driven (replay-safe — no wall clock, no dice). `from`/`to` default to the
  // authored start pose (→ a static platform). A grounded platform/walk rider resting on this entity's
  // top inherits its per-tick HORIZONTAL motion via the carry post-pass in stepWorld; vertical carry
  // comes free from re-grounding on the moving top. Mark the entity `body.carrier:true` (+ a footprint:
  // `body.carryHalf:[hx,hy]` AABB or `body.carryRadius`; `body.deck` offsets the ride surface off pos-z).
  function mover(e, input, dt) {
    const r = e.rule;
    const from = Array.isArray(r.from) ? r.from : (e.spawn ? e.spawn.pos : e.transform.pos);
    const to = Array.isArray(r.to) ? r.to : from;
    const period = r.period > 0 ? r.period : 4;
    e._mt = (e._mt || 0) + dt;
    const s = ((e._mt / period + (r.phase || 0)) % 1 + 1) % 1;   // 0..1 saw (phase-shiftable, always ≥0)
    const tri = 1 - Math.abs(s * 2 - 1);                         // triangle: 0→1→0 ping-pong
    const u = tri * tri * (3 - 2 * tri);                         // smoothstep → soft turnaround at the ends
    e.transform.pos[0] = from[0] + (to[0] - from[0]) * u;
    e.transform.pos[1] = from[1] + (to[1] - from[1]) * u;
    e.transform.pos[2] = from[2] + (to[2] - from[2]) * u;
    e.moving = true;
  }

  // ai — the fire-back hunter (mobile-suit R20; R25 6DoF space seek): the AMBIENT brain of a vacated
  // pilotable suit. On the ground it TURNS toward the current pilot, CLOSES to a standoff range on the
  // XY plane; in SPACE (`rule.space`) it SEEKS IN 3D — flying the full vector to the target (closing
  // altitude too) and juking in 3D — and gates its trigger on the full 3D aim. Each frame it
  // AIMS (heading + pitch at the target's egg center — the shot ray follows both), and works its
  // own trigger on a burst/pause cadence. `e.aiFire` is this entity's PRIVATE fire input: stepWorld
  // routes it (never the global input) into stepWeapon for an ai-ruled entity, so the pilot's
  // trigger can't fire an AI suit and an AI suit can't drain the pilot's magazine — the R9
  // no-ghost-fire invariant, kept both ways. On recovering from a stagger it DODGE-ROLLS out of
  // the line of fire, sides alternating (deterministic, no dice). Vacated on a weaponless (melee)
  // slot it self-switches to its first trigger slot — the ai is ranged-only v1. Pure: same
  // state + dt → same decisions.
  function ai(e, input, dt, world) {
    const r = e.rule;
    const t = e.transform;
    const speed = r.speed ?? 6, strideLen = r.stride ?? 2.4, eye = r.eye ?? 0;
    // difficulty tier (world.aiTuning, see AI_DIFFICULTY below ai()) — null is the max brain.
    const dif = (world && world.aiTuning) || null;
    e.aiFire = 0;
    e.thrust = 0; e.thrustYaw = 0; e.boosting = false;   // reset per frame; a boost burst (R23, opt-in r.boost) re-arms them
    const f = fwdXY(t.heading), rt = rightXY(t.heading);
    // an in-flight dodge OWNS the body (same commitment as the platform dodge: no re-aim, i-frames,
    // the renderer tumbles the rig about the maneuver axis).
    if (e.dodgeT != null) {
      e.dodgeT += dt / (r.dodgeDur ?? 0.55);
      if (e.dodgeT >= 1) { e.dodgeT = null; e.tumble = null; e.invincible = false; e.dodgeDir = null; }
      else {
        const env = Math.sin(Math.min(1, e.dodgeT) * Math.PI);
        const dsp = (r.dodgeSpeed ?? speed * 2.6) * env * dt;
        if (e.dodgeDir) { t.pos[0] += e.dodgeDir[0] * dsp; t.pos[1] += e.dodgeDir[1] * dsp; }
        // ground roll hugs the terrain; a SPACE roll holds its altitude — the probe would
        // otherwise glue the suit onto whatever hull happens to lie below the maneuver.
        const gd = !r.space && world && world.ground ? world.ground(t.pos) : null;
        if (gd != null) t.pos[2] = gd + eye;
        e.locomotion = e.dodgeClip || 'dodge_sideroll'; e.moving = true; e.invincible = !e.dodgeSpent; e.gaitPhase = 0;
        const ang = Math.min(1, e.dodgeT) * (r.dodgeTurns ?? 1) * TAU;
        e.tumble = { axis: [f[0] * (e.dodgeSign || 1), f[1] * (e.dodgeSign || 1), 0], angle: ang };   // barrel-roll about forward (the side roll)
        return;
      }
    }
    // MELEE SWING PLAYBACK (melee-seek): a swing OWNS the body — advance its phase, hold the swing clip,
    // stay rooted (stepMelee in stepWorld reads swingT + strikeParams and lands the connect during the
    // contact window). On completion, arm the cooldown. Runs BEFORE the stand-down gate so an in-flight
    // swing always finishes. Keeps footing via the same head-height cast the seek uses.
    if (e.swingT != null) {
      e.swingT += dt / (e.swingDur || 0.9);
      e.locomotion = e.swingClip || 'swing_neutral'; e.moving = true; e.gaitPhase = Math.min(1, e.swingT); e.aiFire = 0;
      if (!r.space && world && world.ground) { const g = world.ground([t.pos[0], t.pos[1], (t.pos[2] - (r.eye ?? 0)) + (r.collideHeight ?? 24)]); if (g != null) t.pos[2] = g + (r.eye ?? 0); }
      if (e.swingT >= 1) {
        // 2-HIT COMBO: the OPENER (neutral/side) chains straight into the DOWNSWING finisher instead of
        // returning to idle; the finisher then arms the longer combo cooldown. A non-combo swing (or the
        // finisher itself) ends the string and arms the base cooldown.
        if (e.aiComboWant && !e.swingCombo && e.aiComboCfg) {
          e.aiComboWant = false;
          beginAiSwingDir(e, e.aiComboCfg, e.aiComboRule || r, 'back', true);   // `back` = the committed overhead straight-DOWN cleave (the downswing), topples
        } else {
          const wasCombo = e.swingCombo;
          e.swingT = null; e.locomotion = 'forward'; e.moving = false; e.aiComboWant = false;
          e.strikeCdT = wasCombo ? (e.aiComboCooldown ?? e.swingCd ?? 0) : (e.swingCd > 0 ? e.swingCd : (e.strikeCdT || 0));
        }
      }
      return;
    }
    // AI ATTACK TOGGLE (world-level `aiEnabled`, flipped by input.aiToggle / seeded by manifest
    // `ai:'off'`): switched off, the brain STANDS DOWN — holds the armed idle where it is, trigger
    // cold. An in-flight dodge (above) still completes; the recovery edge is dropped so a stagger
    // taken while passive doesn't fire a stale dodge when the switch comes back on.
    if (world && world.aiEnabled === false) { e.moving = false; e.reactionEnded = false; return; }
    // TARGET SELECTION (arena M2): the default hunts the PILOT (the R20 behavior, byte-identical).
    // `target:'all'` on the rule makes this a FREE-FOR-ALL brain: it hunts the nearest live
    // hittable body that isn't itself — AI suits fight each other, and the pilot is just one more
    // contender (an AI can win the match). `target:'enemy'` is the same nearest-hunt but TEAM-AWARE:
    // a suit with a `team` skips same-team bodies, so allies never become the target (the team-battle
    // brain). Deterministic: nearest by flat distance, ties broken by entity order. Downed wrecks and
    // i-frame bodies are skipped, so a fresh respawn keeps its protection window while the brain swings
    // to the next threat.
    let target = null;
    if (world && world.byId) {
      if (r.target === 'all' || r.target === 'enemy') {
        const teamAware = r.target === 'enemy' && e.team;
        let bd = Infinity;
        for (const id in world.byId) {
          const o = world.byId[id];
          if (o === e || o.isCamera || o.downed || o.invincible || !(o.body && o.body.hittable)) continue;
          if (teamAware && o.team && o.team === e.team) continue;   // TEAM: never hunt an ally
          const ddx = o.transform.pos[0] - t.pos[0], ddy = o.transform.pos[1] - t.pos[1];
          const dd = ddx * ddx + ddy * ddy;
          if (dd < bd) { bd = dd; target = o; }
        }
      } else if (world.pilotId) target = world.byId[world.pilotId];
    }
    if (!target || target === e) { e.moving = false; e.reactionEnded = false; return; }
    const dx = target.transform.pos[0] - t.pos[0], dy = target.transform.pos[1] - t.pos[1];
    const dist2d = Math.hypot(dx, dy) || 1e-6;
    // DODGE-OUT on stagger recovery: stepReaction stamps `reactionEnded` when a reaction completes;
    // the ai consumes the edge as "I just got tagged — get off the firing line": a committed side
    // roll PERPENDICULAR to the threat direction, alternating sides each time.
    if (e.reactionEnded) {
      e.reactionEnded = false;
      // the ai roll pays the same dodge cooldown as the pilot (2026-07-27) — a freshly-spent
      // dodge means the recovery edge passes and the hunt resumes without the escape roll.
      if (r.dodge !== false && (e.dodgeCdT || 0) <= 0) {
        e.aiDodgeSide = e.aiDodgeSide === 1 ? -1 : 1;
        const ux = dx / dist2d, uy = dy / dist2d;
        e.dodgeDir = [-uy * e.aiDodgeSide, ux * e.aiDodgeSide];
        const sd = e.dodgeDir[0] * rt[0] + e.dodgeDir[1] * rt[1];   // body-frame side (the tumble sign)
        e.dodgeT = 0; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sd < 0 ? -1 : 1;
        e.dodgeSpent = false; e.dodgeCdT = (r.dodgeCooldown ?? 8) * (dif ? dif.dodgeCdMul : 1);
        e.dodgeCount = (e.dodgeCount || 0) + 1;
        // committed from THIS frame (i-frames + the roll clip), like the platform dodge
        e.locomotion = 'dodge_sideroll'; e.invincible = true; e.gaitPhase = 0; e.moving = true;
        return;
      }
    }
    // POST-CLASH DASH-AWAY (stepClash armed `clashRetreat` on a ground clash break): throw a committed
    // roll BACK off the clash line and hand the fight to shooting (meleeGiveUp is already armed) — the
    // "cross blades, break, reposition" beat, so duels don't relock into an endless clash.
    if (e.clashRetreat) {
      e.clashRetreat = false;
      if (r.dodge !== false && (e.dodgeCdT || 0) <= 0) {
        e.aiDodgeSide = e.aiDodgeSide === 1 ? -1 : 1;
        const ux = dx / dist2d, uy = dy / dist2d;
        // backward off the line, blended with a perpendicular sidestep (each orthogonal, ~unit length)
        e.dodgeDir = [(-ux - uy * e.aiDodgeSide) * 0.7071, (-uy + ux * e.aiDodgeSide) * 0.7071];
        const sd = e.dodgeDir[0] * rt[0] + e.dodgeDir[1] * rt[1];
        e.dodgeT = 0; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sd < 0 ? -1 : 1;
        e.dodgeSpent = false; e.dodgeCdT = (r.dodgeCooldown ?? 8) * (dif ? dif.dodgeCdMul : 1);
        e.dodgeCount = (e.dodgeCount || 0) + 1;
        e.locomotion = 'dodge_sideroll'; e.invincible = true; e.gaitPhase = 0; e.moving = true;
        return;
      }
    }
    // vacated on a weaponless (melee) slot → self-switch to the first TRIGGER slot (`throw` slots
    // skipped: the toss rides a swing clip the ai doesn't play). Same fields the platform switch
    // writes. A non-pilotable ai seat (arena opponents) has no pilotRule — its own rule carries the
    // loadout, so fall through to it.
    const lo = e.pilotRule && Array.isArray(e.pilotRule.loadout) ? e.pilotRule.loadout
      : (e.rule && Array.isArray(e.rule.loadout) ? e.rule.loadout : null);
    // MELEE-SEEK (opt-in `r.meleeSeek`, ground AND space since 2026-08-04 — the operator asked for
    // space blades; the 3D charge below + stepMelee's 3D contact were already built): a suit that
    // carries a melee slot commits to a
    // CLOSE-AND-TOPPLE when the target is in reach — and SPRINTS in (boost) on a target that's already
    // reeling (staggered/knocked), the free opening. Purely additive: a rule without `meleeSeek`, or a
    // suit with no `strike:'melee'` slot (a pure shooter), never enters this and stays byte-identical.
    // The commit is re-evaluated each frame; while committed it holds the melee slot instead of the
    // auto-switch back to a trigger weapon below.
    // MELEE GIVE-UP (opt-in `r.meleeTimeout` / `r.meleeGiveUp`, default 5s / 4s): a hunter that
    // commits to melee but can't LAND it within meleeTimeout seconds abandons the blade and goes
    // back to SHOOTING for meleeGiveUp seconds — so it never loops chasing an evasive or UNREACHABLE
    // (e.g. perched/elevated) target forever. The give-up window decays each frame; while it runs the
    // melee slot is off the table (meleeCfg null → the ranged auto-switch + trigger below take over).
    if (e.meleeGiveUpT > 0) e.meleeGiveUpT = Math.max(0, e.meleeGiveUpT - dt);
    const meleeCfg = (r.meleeSeek && lo && (e.strikeCdT || 0) <= 0 && !(e.meleeGiveUpT > 0))
      ? lo.find((c) => c && c.strike === 'melee') : null;
    const meleeReach = meleeCfg ? (meleeCfg.strikeReach ?? r.strikeReach ?? speed) : 0;
    const targetReeling = !!target.staggerT && !target.downed;   // mid-stagger / toppling, still a live body
    // ELEVATION GATE (GROUND ONLY): a blade can't reach a target perched well ABOVE the hunter — beyond
    // `meleeVReach` vertically it stays a SHOOTER (it aims its pitch up and fires uphill via the trigger)
    // instead of chasing a melee it can never complete. In SPACE there is no unreachable perch — the
    // hunter flies to the target's altitude — so the gate is off and melee RANGE is measured in 3D (the
    // close-in below flies the full vector, closing altitude too).
    const meleeVReach = r.meleeVReach ?? (r.collideHeight ?? 24) * 1.5;
    const mdz = target.transform.pos[2] - t.pos[2];
    const targetHigh = !r.space && Math.abs(mdz) > meleeVReach;
    const meleeDist = r.space ? Math.hypot(dx, dy, mdz) : dist2d;
    // commit when within melee range, or sprint in on a reeling target inside a wider punish band.
    const meleeCommit = !!meleeCfg && !target.downed && !targetHigh
      && (meleeDist < meleeReach * 3 || (targetReeling && meleeDist < meleeReach * 9));
    // MELEE COMMIT CLOCK: tick while committed; past meleeTimeout without a swing landing (a swing
    // resets it, at beginAiSwing) → arm the give-up window so the following frames revert to shooting.
    if (meleeCommit) {
      e.meleeCommitT = (e.meleeCommitT || 0) + dt;
      if (e.meleeCommitT >= (r.meleeTimeout ?? 5)) { e.meleeGiveUpT = r.meleeGiveUp ?? 4; e.meleeCommitT = 0; }
    } else e.meleeCommitT = 0;
    if (meleeCommit) {
      const idx = lo.indexOf(meleeCfg);   // switch to the melee slot (weaponless → fire route falls to the strike)
      if ((e.loadoutIdx || 0) !== idx) {
        e.loadoutIdx = idx; e.weapon = e.loadoutWeapons ? e.loadoutWeapons[idx] : null;
        if (e.body && meleeCfg.figure) e.body.figure = meleeCfg.figure;
        armSwitchReady(e, r, meleeCfg);   // the ai pays the switch ready-time too (it draws the blade, then swings)
      }
    } else if (e.loadoutWeapons && lo) {
      // RANGED WEAPON ROTATION: instead of camping slot 0, the ai CYCLES its trigger guns (rifle →
      // bazooka → beam …) so it varies fire. The ranged slots are the ones carrying a weapon that
      // isn't a THROW (grenade lobs ride a swing clip the ai can't play) — melee is handled above.
      // With ≥2 ranged slots it advances the pick every `weaponRotate` sec (default 6, comfortably
      // longer than the switch ready-time so it isn't perpetually holding fire); a single-gun loadout
      // just selects its one slot when unarmed, byte-identical to the old behavior.
      const ranged = [];
      for (let i = 0; i < e.loadoutWeapons.length; i++) if (e.loadoutWeapons[i] && !lo[i].throw) ranged.push(i);
      if (ranged.length) {
        if (e.aiRangedPick == null) { const cur = ranged.indexOf(e.loadoutIdx || 0); e.aiRangedPick = cur >= 0 ? cur : 0; }
        if (ranged.length > 1) {
          e.aiWeaponT = (e.aiWeaponT || 0) + dt;
          if (e.aiWeaponT >= (r.weaponRotate ?? 6)) { e.aiWeaponT = 0; e.aiRangedPick = (e.aiRangedPick + 1) % ranged.length; }
        }
        const want = ranged[e.aiRangedPick % ranged.length];
        if (!e.weapon || (e.loadoutIdx || 0) !== want) {
          e.loadoutIdx = want; e.weapon = e.loadoutWeapons[want];
          if (e.body && lo[want].figure) e.body.figure = lo[want].figure;
          armSwitchReady(e, r, lo[want]);   // switching to a ranged slot: hold fire for the ready-time (slot switchReady wins)
        }
      }
    }
    // turn toward the target (shortest way), capped at `turn` rad/s; pitch the aim at the egg center.
    const want = Math.atan2(dy, dx);
    let dh = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const maxTurn = (r.turn ?? 1.8) * dt;
    t.heading += clamp(dh, -maxTurn, maxTurn);
    const rem = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;   // residual off-aim after the turn
    const w = e.weapon;
    const tb = target.body || {};
    const tcz = tb.egg ? (Number.isFinite(tb.egg.cz) ? tb.egg.cz : tb.egg.c) : (tb.radius || 0);
    t.pitch = clamp(Math.atan2((target.transform.pos[2] + tcz) - (t.pos[2] + (w ? w.eye || 0 : 0)), dist2d), -1.2, 1.2);
    // MOVE TO ATTACK. Baseline: close to `standoff` while facing, then HOLD (the armed ready idle
    // plays when moving is false). With opt-in BOOST (`r.boost`, R23) the hunter instead JUKE-BOOSTS
    // in bursts — `boostBurst` sec of evasive lateral boosting (it weaves side to side AND, because
    // it is thrusting, its `body.boostArmor` is LIVE, so a single beam bolt / bazooka shell no longer
    // stuns it) then `boostRest` sec grounded and stunnable. So the same enemy shows BOTH reads: shoot
    // it mid-boost and the stun is shrugged; catch it on the rest beat and it staggers. `e.boosting`
    // drives the boost-armor mitigation + the backpack flame; the walk fallback is byte-identical.
    // R25: in SPACE the hunter seeks in 3D — the FULL vector to the target (climb/dive to its
    // altitude), gated on the 3D distance. On the ground it's the XY-plane read, byte-identical.
    const isSpace = !!r.space;
    const dz = target.transform.pos[2] - t.pos[2];
    const dist3d = Math.hypot(dx, dy, dz) || 1e-6;
    const rangeD = isSpace ? dist3d : dist2d;
    // CLOSING-IN STRATEGY (per active weapon): tie the hunter's SPACING to the gun it holds so
    // weapon rotation makes it press in and fall back in turns — a spray gun RUSHES to short range,
    // a rifle/beam SKIRMISHES at mid, a bazooka/lob SIEGES from afar. That shifting spacing is what
    // turns two circling suits into a real engagement (emergent duels in AI battle). Style comes from
    // the weapon's fireClass; a per-slot `approach:{style,standoff,close,weave}` override wins; an
    // explicitly tuned `r.standoff` still pins the distance. `close` = inward bias when out of
    // position (higher → charges harder), `weave` = how much lateral strafe rides the boost juke
    // (rush weaves little and drives in; siege weaves wide and holds). Skirmish ≈ the old behavior.
    // The profile is [standoffMul, close, weave] applied over a BASE standoff (the world's tuned
    // `r.standoff`, else 0.42·weapon-range) so an explicitly-tuned arena still gets per-weapon
    // variety AROUND its distance: rush pulls the hold in to ~half, siege pushes it out ~1.5×,
    // skirmish ≈ the base (old behavior). A per-slot `approach.standoff` pins an absolute distance.
    const aSlot = lo ? lo[e.loadoutIdx || 0] : null;
    const aOv = (aSlot && aSlot.approach) || null;
    const aStyle = (aOv && aOv.style) || (!w ? 'skirmish' : w.fireClass === 'lob' ? 'siege' : w.fireClass === 'area' ? 'rush' : 'skirmish');
    const aProf = ({ rush: [0.48, 1.0, 0.45], skirmish: [1.0, 0.7, 1.0], siege: [1.55, 0.6, 1.15] })[aStyle] || [1.0, 0.7, 1.0];
    const baseStandoff = r.standoff != null ? r.standoff : (w ? (w.range || 400) * 0.42 : speed * 8);
    // difficulty AGGRESSION detune: a lower tier holds farther out and presses in less.
    const standoff = (w ? (Number.isFinite(aOv && aOv.standoff) ? aOv.standoff : baseStandoff * aProf[0]) : baseStandoff) * (dif ? dif.standoffMul : 1);
    const closeBias = (Number.isFinite(aOv && aOv.close) ? aOv.close : aProf[1]) * (dif ? dif.closeMul : 1);
    const weaveMul = Number.isFinite(aOv && aOv.weave) ? aOv.weave : aProf[2];
    const f2 = fwdXY(t.heading), rt2 = rightXY(t.heading), facing = Math.abs(rem) < 1.1;
    let boostBurst = false;
    if (r.boost) {
      // difficulty AGGRESSION detune: less boost-juke uptime, longer stunnable rest beats.
      const bb = (r.boostBurst ?? 2.5) * (dif ? dif.boostBurstMul : 1), brest = (r.boostRest ?? 1.6) * (dif ? dif.boostRestMul : 1), cyc = Math.max(0.1, bb + brest);
      e.aiBoostClock = (e.aiBoostClock || 0) + dt;
      boostBurst = (e.aiBoostClock % cyc) < bb;
    }
    let moveMag = 0, clip = 'forward';
    if (meleeCommit) {
      // CLOSE THE GAP, then STRIKE. Beyond reach: charge in — BOOST if the target is reeling (punish the
      // opening) or still a way off, otherwise march (walk-seek). Within reach + on-aim: throw the
      // back-cleave → a TOPPLE on connect. Firing is naturally off here (the melee slot carries no weapon).
      if (meleeDist > meleeReach * 0.85) {
        const canBoost = !!(r.boost || r.boostSpeed);   // AGGRESSIVE: boost the WHOLE close (was: only a reeling/far target)
        const spd = (canBoost ? (r.boostSpeed ?? speed * 3.5) : speed) * dt;
        if (facing) {
          if (r.space) {
            // 3D CHARGE: fly the full vector to the target (close the altitude gap too), no ground snap.
            const ux = dx / meleeDist, uy = dy / meleeDist, uz = mdz / meleeDist;
            t.pos[0] += ux * spd; t.pos[1] += uy * spd; t.pos[2] += uz * spd; moveMag = spd;
            clip = 'boost'; if (canBoost) { e.boosting = true; e.thrust = 1; } else e.thrust = Math.max(e.thrust, 0.5);
          } else {
            t.pos[0] += f2[0] * spd; t.pos[1] += f2[1] * spd; moveMag = spd;
            if (canBoost) { clip = 'boost'; e.boosting = true; e.thrust = 1; } else clip = 'forward';
          }
        }
      } else if (facing && (e.readyT || 0) <= 0) {
        beginAiSwing(e, meleeCfg, r, dif);   // in reach + on line + past the switch ready-time → the toppling great-cleave (or a noTopple cut on easy)
        e.meleeCommitT = 0;             // a swing landed the commit — restart the give-up clock for the next approach
      }
    } else if (isSpace) {
      // R25 — 6DoF SEEK: fly along the full 3D vector to the target (closing altitude AND plane). During
      // a boost burst juke in 3D (horizontal strafe + a vertical weave); otherwise thrust toward standoff.
      // No gait/ground — the flight clips carry it. Station colliders aren't blocked for the ai v1 (open
      // void; the seek keeps it near the fight — stated in the plan).
      const ux = dx / dist3d, uy = dy / dist3d, uz = dz / dist3d;
      if (boostBurst) {
        const jp = r.jukePeriod ?? 0.9;
        e.aiJukeClock = (e.aiJukeClock || 0) + dt;
        if (e.aiJukeClock >= jp) { e.aiJukeClock = 0; e.aiJukeSide = e.aiJukeSide === 1 ? -1 : 1; }
        const side = e.aiJukeSide || 1;
        const bias = dist3d > standoff ? closeBias : dist3d < standoff * 0.55 ? -closeBias : 0;   // per-weapon: rush drives in, siege holds
        const vWeave = Math.sin((e.aiBoostClock || 0) * 2.4) * 0.5;                    // gentle up/down evasion
        let mvx = rt2[0] * side * weaveMul + ux * bias, mvy = rt2[1] * side * weaveMul + uy * bias, mvz = vWeave + uz * bias;
        const mn = Math.hypot(mvx, mvy, mvz) || 1; mvx /= mn; mvy /= mn; mvz /= mn;
        const bstep = (r.boostSpeed ?? speed * 3.5) * dt;
        t.pos[0] += mvx * bstep; t.pos[1] += mvy * bstep; t.pos[2] += mvz * bstep;
        moveMag = bstep;
        clip = Math.abs(mvx * rt2[0] + mvy * rt2[1]) > 0.4 ? (side > 0 ? 'boost_right' : 'boost_left') : 'boost';
        e.boosting = true; e.thrust = 1;
      } else if (dist3d > standoff && facing) {
        const step = speed * dt;
        t.pos[0] += ux * step; t.pos[1] += uy * step; t.pos[2] += uz * step;
        moveMag = step; clip = 'boost'; e.thrust = Math.max(e.thrust, 0.5);
      }
    } else if (boostBurst) {
      // weave: flip the strafe side every `jukePeriod`, biased in/out to hold the standoff band
      const jp = r.jukePeriod ?? 0.9;
      e.aiJukeClock = (e.aiJukeClock || 0) + dt;
      if (e.aiJukeClock >= jp) { e.aiJukeClock = 0; e.aiJukeSide = e.aiJukeSide === 1 ? -1 : 1; }
      const side = e.aiJukeSide || 1;
      const bias = dist2d > standoff ? closeBias : dist2d < standoff * 0.55 ? -closeBias : 0;   // per-weapon: rush drives in, siege holds
      let mvx = rt2[0] * side * weaveMul + f2[0] * bias, mvy = rt2[1] * side * weaveMul + f2[1] * bias;
      const mn = Math.hypot(mvx, mvy) || 1; mvx /= mn; mvy /= mn;
      const bstep = (r.boostSpeed ?? speed * 3.5) * dt;
      t.pos[0] += mvx * bstep; t.pos[1] += mvy * bstep;
      moveMag = bstep;
      clip = Math.abs(mvx * rt2[0] + mvy * rt2[1]) > 0.5 ? (side > 0 ? 'boost_right' : 'boost_left') : 'boost';
      e.boosting = true; e.thrust = 1;
    } else {
      let moveF = 0;
      if (dist2d > standoff && facing) moveF = speed * dt;
      if (moveF) { t.pos[0] += f2[0] * moveF; t.pos[1] += f2[1] * moveF; }
      moveMag = moveF;
    }
    if (!isSpace && world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 24, r.collideRadius ?? 0, world.colliders, r.step ?? 0.35);
    if (!isSpace) {
      // GROUND SNAP — cast from HEAD height (foot + body height), not from the current z, so the hunter
      // finds the surface UNDER ITS BODY. The ai has no gravity: a plain down-cast from the current z
      // can only find surfaces BELOW it, so the instant it walks/boosts onto RISING terrain (a slope,
      // a ramp) — or a drop-in seats it a hair under the wavy surface — the real floor is now ABOVE its
      // feet, the down-ray sails past it, and the suit reads the sky/void far below and sinks through the
      // map. From head height the ray always catches the floor it's standing on and climbs onto risen
      // ground. A roof higher than the body (walk-under clearance) still sits above the head → not grabbed.
      const climbUp = r.collideHeight ?? 24;
      const g2 = world && world.ground ? world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + climbUp]) : null;
      if (g2 != null) t.pos[2] = g2 + eye;
    }
    if (moveMag > 0) { e.locomotion = clip; e.gaitPhase = (e.gaitPhase || 0) + moveMag / strideLen; e.moving = true; }
    else e.moving = false;
    // TRIGGER: engaged = on-aim within `fireArc`°, in weapon range, sightline clear of cover. The
    // cadence is burst/pause (`burst` sec held, `pause` sec released): an auto weapon streams the
    // burst; a semi/lob weapon fires its rising edge each cycle and its own cooldown gates the rest.
    // The clock resets when disengaged, so a fresh sighting opens with fire.
    const fireArc = (r.fireArc ?? 6) * Math.PI / 180;
    const origin = [t.pos[0], t.pos[1], t.pos[2] + (w ? w.eye || 0 : 0)];
    // R25: space gates the trigger on the FULL 3D aim error (heading+pitch vs the target vector), so a
    // suit above/below still fires when its nose is on line; the ground path keeps the yaw-only check.
    let onAim;
    if (isSpace) {
      const a = fwd3(t.heading, t.pitch || 0);
      onAim = (a[0] * (dx / dist3d) + a[1] * (dy / dist3d) + a[2] * (dz / dist3d)) >= Math.cos(fireArc);
    } else onAim = Math.abs(rem) <= fireArc;
    const engaged = !!w && onAim && rangeD <= (w.range || 400)
      && !sightBlocked(origin, target.transform.pos, world && world.colliders);
    if (engaged) {
      // difficulty LATENCY detune: shorter bursts, longer gaps between them; a clock still
      // climbing out of the reactDelay hold (armed negative on disengage below) keeps the
      // trigger cold — a fresh sighting no longer opens with instant fire on a lower tier.
      const burstOn = (r.burst ?? 1.1) * (dif ? dif.burstMul : 1);
      const cycle = burstOn + (r.pause ?? 0.9) * (dif ? dif.pauseMul : 1);
      e.aiClock = (e.aiClock || 0) + dt;
      e.aiFire = e.aiClock >= 0 && (e.aiClock % cycle) <= burstOn ? 1 : 0;
    } else e.aiClock = dif && dif.reactDelay ? -dif.reactDelay : 0;
    // difficulty ACCURACY detune: a deterministic sinusoidal aim wobble applied AFTER every
    // intent read above (rem / onAim / engaged all saw the true aim), so the brain fires
    // believing it is locked while the shot ray built later this frame (stepWeapon →
    // fwd3(t.heading, t.pitch)) inherits the error and MISSES real geometry. Heading is
    // integrated (the turn-toward is capped), so the previous frame's offset is swapped out
    // for this frame's; pitch is recomputed absolutely each frame, so a plain add decays.
    if (dif && dif.aimWobble) {
      e.aiWobT = (e.aiWobT || 0) + dt;
      const wobY = Math.sin(e.aiWobT * dif.wobbleHz * TAU) * dif.aimWobble;
      t.heading += wobY - (e.aiWobPrev || 0);
      e.aiWobPrev = wobY;
      t.pitch = clamp((t.pitch || 0) + Math.sin(e.aiWobT * dif.wobbleHz * 0.77 * TAU + 1.3) * dif.aimWobble * 0.6, -1.2, 1.2);
    }
  }

  // ── AI DIFFICULTY (arena difficulty select) ─────────────────────────────────────────────
  // Named tuning tiers the ai brain reads via `world.aiTuning` — seeded from `spec.aiDifficulty`
  // at createWorld, or set at runtime (the game-params seam assigns state.aiTuning). Absent /
  // 'max' is the untuned MAX brain — byte-identical to the pre-difficulty behavior. Lower tiers
  // detune three axes (each applied at its site in ai(), tagged "difficulty ... detune"):
  //   ACCURACY   — aimWobble (rad) / wobbleHz: the post-gate aim error → real misses.
  //   LATENCY    — reactDelay (sec) before the first burst; burstMul / pauseMul cadence.
  //   AGGRESSION — standoffMul / closeMul spacing; boostBurstMul / boostRestMul juke uptime;
  //                dodgeCdMul lazier escape rolls; noTopple: still melees, never knocks down
  //                (beginAiSwing throws opener cuts only — no combo finisher, no back-cleave).
  const AI_DIFFICULTY = {
    easy:   { aimWobble: 0.09, wobbleHz: 1.7, reactDelay: 1.2,  burstMul: 0.5,  pauseMul: 2.2, dodgeCdMul: 3,   standoffMul: 1.3,  closeMul: 0.55, boostBurstMul: 0.5,  boostRestMul: 1.8, noTopple: true },
    medium: { aimWobble: 0.04, wobbleHz: 1.4, reactDelay: 0.55, burstMul: 0.75, pauseMul: 1.5, dodgeCdMul: 1.6, standoffMul: 1.12, closeMul: 0.8,  boostBurstMul: 0.75, boostRestMul: 1.3 },
    max: null,
  };

  const RULES = { glide, walk, platform, follow, clock, ai, mover };

  // ── the WEAPON subsystem: fire, ammo, cooldown/ROF, auto-reload, hit resolution ──
  // A controlled entity can carry a `weapon`; each frame stepWeapon reads input.fire
  // and adjudicates a shot against the world's HITTABLE entities (a target is just an
  // entity with body.hittable). This is the targeting computer (mobile-suit R6-C): a
  // two-ring reticle (coreAngle / assistAngle, degrees) about the aim axis, gated by
  // the weapon's fireClass — 'sight' weapons land only in the core, 'area' weapons
  // (machine guns) also land the outer assist ring (area auto-aim). Pure + deterministic
  // (fixed input+dt → identical shots), so it tests in Node and replays byte-identical.
  //
  // Ammo model: a magazine of `magazine` rounds; auto weapons fire at `rof` rounds/sec,
  // semi weapons every `cooldown` sec; hitting 0 AUTO-RELOADS over `reload` sec (the HUD
  // shows the circular wait). All numbers are weapon-tunable.
  function initWeapon(w) {
    if (!w || typeof w !== 'object') return null;
    const area = w.fireClass === 'area';
    const lob = w.fireClass === 'lob';   // R14: a TRAVELLING round (grenade/bazooka) that bursts later — not a hitscan cone
    const magazine = w.magazine ?? w.clip ?? w.pack ?? 30;
    return {
      fireClass: lob ? 'lob' : area ? 'area' : 'sight',
      auto: w.auto ?? (area && !lob),     // machine guns hold-to-fire; beams + launchers are per-click
      rof: w.rof ?? 10,                   // rounds/sec when auto
      cooldown: w.cooldown ?? 0.5,        // sec between shots when semi
      // BURST (semi only): one trigger pull fires `burst` rounds at `burstRof` rounds/sec,
      // then the full `cooldown` gates the next pull. burst 1 (the default) is the plain
      // semi shot — byte-identical behavior for every existing weapon. The burst COMMITS:
      // releasing the trigger mid-burst does not stop it (that is what a burst is), and a
      // reload cancels whatever remained.
      burst: Math.max(1, Math.round(w.burst ?? 1)),
      burstRof: w.burstRof ?? 8,          // in-burst rounds/sec (burst > 1 only)
      magazine,
      reload: w.reload ?? 2,              // sec to refill on empty
      coreAngle: w.coreAngle ?? 1.5,      // precise center half-angle (deg) — every weapon lands here
      assistAngle: w.assistAngle ?? (area ? 7 : (w.coreAngle ?? 1.5)),   // outer ring (deg) — area only
      range: w.range ?? 400,
      damage: w.damage ?? 0,              // hp subtracted from a hittable per landed shot / burst (the "numbers")
      impact: w.impact ?? 0,             // poise chipped per landed shot; a hittable's poise breaks -> it STAGGERS
      chargedImpact: Number.isFinite(w.chargedImpact) ? w.chargedImpact : null,
      // charged-shot AMMO COST (taisa charge): a charged bolt spends this many rounds, CLAMPED to
      // what's left — one bullet in the magazine still fires the charge (it just empties it).
      chargedAmmoCost: Number.isFinite(w.chargedAmmoCost) && w.chargedAmmoCost > 0 ? Math.round(w.chargedAmmoCost) : null,
      eye: w.eye ?? 0,                    // fire-origin height above the entity's pos
      muzzleOffset: w.muzzleOffset || null,   // { f, r, u } body-frame gun tip (tracer/flash/launch origin; renderer)
      muzzleAlt: w.muzzleAlt || false,        // DUAL WIELD (alternate): flip the lateral muzzle each shot (two guns take turns)
      muzzleDual: w.muzzleDual || false,      // DUAL WIELD (simultaneous): fire BOTH guns each shot — the renderer mirrors the muzzle flash
      // NO-FIRE-WHILE-BOOSTING (operator): heavy launchers (lob) + precise semi beams (the beam-rifle
      // class) can't be fired mid-thrust; auto suppression weapons (MG/vulcan) still stream. null →
      // the class default (w.auto — true for area autos, false for lob + semi beams); set explicitly
      // to override a single weapon either way.
      boostFire: w.boostFire ?? null,
      fxColor: w.fxColor ?? null,         // tracer/flash tint (renderer)
      fxScale: w.fxScale ?? null,         // effect base size (renderer)
      smokeTrail: w.smokeTrail ?? true,    // lob projectile smoke trail toggle (grenades opt out; bazookas keep it)
      reticleDist: w.reticleDist ?? null, // how far ahead the crosshair marks the aim point (renderer)
      sfx: w.sfx && typeof w.sfx === 'object' ? w.sfx : null,   // per-weapon SFX cues { shot?, hit?, reload? } — the audio channel prefers these over the world-level ones (a beam rifle and a machine gun sound different)
      // ENERGY weapons (V78 beam-rifle spike): an ammo-like heat budget that passively recovers. A
      // shot spends energyCost; if that spend empties the pool the weapon overheat-locks until the
      // pool refills to energyUnlockFrac (default full). This rides tickWeapon so it cools while stowed.
      energyMax: Number.isFinite(w.energyMax ?? w.energy) && (w.energyMax ?? w.energy) > 0 ? (w.energyMax ?? w.energy) : 0,
      energyCost: Number.isFinite(w.energyCost) ? w.energyCost : 0,
      energyRegen: Number.isFinite(w.energyRegen) ? w.energyRegen : 0,
      energyOverheatRegen: Number.isFinite(w.energyOverheatRegen) ? w.energyOverheatRegen : null,
      energyUnlockFrac: Number.isFinite(w.energyUnlockFrac) ? w.energyUnlockFrac : 1,
      chargeTime: Number.isFinite(w.chargeTime) && w.chargeTime > 0 ? w.chargeTime : 0,
      chargedEnergyCost: Number.isFinite(w.chargedEnergyCost) ? w.chargedEnergyCost : null,
      // R14 projectile params (lob only): a round spawned into state.projectiles, integrated + burst
      // by stepProjectiles. A grenade is a high lobAngle + high gravity arc; a bazooka is lobAngle 0 +
      // low gravity + high speed (fast, nearly flat). splashRadius drives the burst's poise-break reach.
      projectileSpeed: w.projectileSpeed ?? 60,   // launch speed along the (lob-tilted) aim, world u/s
      projectileGravity: w.projectileGravity ?? 30,   // downward accel, u/s^2 (high = arcs; low = flat)
      lobAngle: w.lobAngle ?? 0,          // deg the launch aim tilts UP from the look direction (the lob)
      splashRadius: w.splashRadius ?? 0,  // burst poise-break/damage reach; the direct hit is the d~0 case
      projRadius: w.projRadius ?? 0.5,    // the round's own collision radius (added to a target's radius)
      armTime: w.armTime ?? 0.06,         // sec before the round can burst (so it clears the muzzle/owner)
      fuse: w.fuse ?? 4,                  // sec max flight before it bursts wherever it is
      // PROXIMITY FUZE (bazooka QoL, 2026-08-06): the round DETONATES when it passes within this
      // distance of a hittable body — a near-miss bursts beside the target and the splash catches
      // it, instead of sailing past. 0 (default) = contact-only, byte-identical.
      proximity: Number.isFinite(w.proximityRadius) && w.proximityRadius > 0 ? w.proximityRadius : 0,
      ammo: magazine, cooldownT: 0, reloading: false, reloadT: 0, prevFire: false, shots: 0,
      burstLeft: 0,                       // rounds still owed to the current trigger pull
      energy: Number.isFinite(w.energyMax ?? w.energy) && (w.energyMax ?? w.energy) > 0 ? (w.energyMax ?? w.energy) : 0,
      energyLock: false,
      charging: false, chargeT: 0, chargeFrac: 0, chargeReady: false, chargeCount: 0, chargedShots: 0,
    };
  }

  function cancelWeaponCharge(w) {
    if (!w || !w.charging) return;
    w.charging = false; w.chargeT = 0; w.chargeFrac = 0; w.chargeReady = false;
  }

  // tickWeapon(w, dt) — advance a weapon's PASSIVE timers: the shot cooldown and the reload.
  // R20.3 (operator: "reloading is ongoing even if the weapon is not being used"): stepWorld runs
  // this for EVERY weapon an entity carries — all loadout slots, not just the active fist — every
  // frame, staggered or not. The autoloader is machinery, not attention: a magazine keeps
  // refilling and a bazooka's 5s cooldown keeps draining while the weapon is stowed on a switch,
  // while a melee slot has the fist, and while the suit is reeling. (Supersedes the R7 "mid-reload
  // state freezes while switched away" behavior.) Also arms the auto-reload on an empty stowed
  // magazine, so a weapon emptied and immediately switched away still refills.
  function tickWeapon(w, dt) {
    if (!w) return;
    if (w.cooldownT > 0) w.cooldownT = Math.max(0, w.cooldownT - dt);
    if (w.energyMax > 0) {
      const rr = w.energyLock ? (w.energyOverheatRegen ?? w.energyRegen) : w.energyRegen;
      if (rr > 0) w.energy = Math.min(w.energyMax, (w.energy ?? w.energyMax) + rr * dt);
      if (w.energyLock && w.energy >= w.energyMax * Math.max(0, Math.min(1, w.energyUnlockFrac))) {
        w.energy = Math.min(w.energyMax, w.energy);
        w.energyLock = false;
      }
    }
    if (w.ammo <= 0 && !w.reloading) { w.reloading = true; w.reloadT = w.reload; w.burstLeft = 0; }
    if (w.reloading) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) { w.ammo = w.magazine; w.reloading = false; w.reloadT = 0; }
    }
  }

  // tickBoostRecovery(e, dt) — the PASSIVE thruster recharge (+ overheat unlock), the boost-gauge
  // analog of tickWeapon's autoloader. The recharge normally lives INSIDE the platform rule, but the
  // rule is SUPPRESSED while a suit is reeling / dropping / clashing — so without this the gauge (and
  // the OVERHEAT lock) FREEZE for the whole knockdown (operator, 2026-07-30: "during topple the
  // overheat is stopped"). Run world-side whenever the rule DIDN'T run this frame, so the thruster
  // keeps recovering like the reload does. Mutually exclusive with the in-rule recharge (only the
  // else-branch calls this), so no double-charge. No gauge (boostMax<=0) → no-op.
  function tickBoostRecovery(e, dt) {
    const r = e.rule; if (!r) return;
    const boostMax = r.boostMax;
    if (!(boostMax > 0)) return;
    const rr = e.boostLock ? (r.overheatRegen ?? boostMax / 7.5) : (r.boostRegen ?? boostMax / 5);
    e.boost = Math.min(boostMax, (e.boost ?? boostMax) + rr * dt);
    if (e.boost <= 1e-6) e.boostLock = true;
    else if (e.boostLock && e.boost >= boostMax * (r.boostUnlockFrac ?? 1)) e.boostLock = false;
  }

  // Resolve one shot: ray from the eye along heading/pitch, cone test against every
  // hittable target (nearest wins). A target's own angular radius widens the ring, so
  // "the reticle sits on the target" reads as a hit. Returns 'core' | 'assist' | 'miss'.
  // Passive timers (cooldownT / reload) tick in tickWeapon, world-side — this only READS them.
  function stepWeapon(e, input, dt, state) {
    const w = e.weapon;
    if (!w) return;
    if (w.reloading) {
      cancelWeaponCharge(w);
      w.prevFire = !!input.fire;
      return;                              // no firing mid-reload
    }
    if (w.energyMax > 0 && w.energyLock) {
      cancelWeaponCharge(w);
      w.prevFire = !!input.fire;
      return;                              // overheat lock: no firing until the energy pool refills
    }
    // SWITCH READY-TIME (2026-07-28): a freshly-switched weapon holds fire for ~1s (armSwitchReady).
    // Checked AFTER the reload guard, so it "doesn't count when reloading" — a reload already blocks,
    // and the two windows just overlap; it's the ACT of switching, not the reload, that arms this.
    if ((e.readyT || 0) > 0) {
      cancelWeaponCharge(w);
      w.prevFire = !!input.fire;
      return;
    }
    // NO-FIRE-WHILE-BOOSTING (operator): a thrusting suit can't line up a bazooka or beam-rifle shot.
    // `e.boosting` is settled by the movement rule earlier this frame (pilot + ai). Auto suppression
    // weapons (MG / vulcan, fireClass 'area') keep streaming; lob + semi beams hold fire until the
    // thrust ends. A committed burst simply pauses and resumes off-boost (cooldownT still ticks).
    const fireHeld = !!input.fire;
    const edge = fireHeld && !w.prevFire;
    const release = !fireHeld && !!w.prevFire;
    const energyReady = !(w.energyMax > 0) || w.energy > 0;
    const canBoostFire = w.boostFire != null ? w.boostFire : w.auto;
    if (e.boosting && !canBoostFire) {
      // CHARGE-THROUGH-BOOST (operator 2026-08-06, taisa + mk2 rifles): thrust no longer wipes a
      // charge. While boosting, a held charge keeps ACCUMULATING and a fresh press still STARTS
      // one — both flows fall to the charge block below, whose hold/start branches return before
      // any round leaves. A COMPLETED charge released mid-boost fires its stun bolt — that one
      // deliberate shot is exempt from the doctrine. Anything else (an uncharged release, a
      // plain semi/lob pull, a paused burst) still can't fire while thrusting; the uncharged
      // mid-boost release drops its partial charge like any interrupted tap.
      const chargeFlow = w.chargeTime > 0 && !w.auto
        && ((w.charging && fireHeld)
          || (edge && w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0 && energyReady)
          || (w.charging && release && w.chargeReady));
      if (!chargeFlow) {
        cancelWeaponCharge(w);
        w.prevFire = fireHeld;
        return;
      }
    }
    let forcedShot = false, chargedShot = false;
    if (w.chargeTime > 0 && !w.auto) {
      if (w.charging && fireHeld) {
        w.chargeT = Math.min(w.chargeTime, (w.chargeT || 0) + dt);
        w.chargeFrac = Math.max(0, Math.min(1, w.chargeT / w.chargeTime));
        w.chargeReady = w.chargeFrac >= 1;
        w.prevFire = true;
        return;
      }
      if (w.charging && release) {
        chargedShot = !!w.chargeReady;
        cancelWeaponCharge(w);
        // A COMPLETED charge fires the single charged bolt (forced). An UNCHARGED release is an
        // ordinary trigger pull: open the volley below, so a tap on a BURST rifle (taisa 3-burst)
        // still rips its full string — charge only rides a full hold. Burst-1 weapons behave
        // exactly as the old forced single (same gates, one round, same cooldown arm).
        if (chargedShot) forcedShot = true;
        else if (w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0 && energyReady) w.burstLeft = w.burst;
      } else if (edge && w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0 && energyReady) {
        w.charging = true; w.chargeT = 0; w.chargeFrac = 0; w.chargeReady = false; w.chargeCount = (w.chargeCount || 0) + 1;
        w.prevFire = true;
        return;
      } else if (w.burstLeft <= 0) {
        // idle (not charging, no pending rounds) → nothing to do. A LIVE volley falls through
        // instead: the burst a tap opened keeps self-firing on the frames after the release.
        w.prevFire = fireHeld;
        return;
      }
    }
    w.prevFire = fireHeld;
    const shotImpact = chargedShot ? (w.chargedImpact ?? w.impact ?? 0) : (w.impact || 0);
    // a semi trigger pull OPENS a burst of `burst` rounds; the pending rounds then fire
    // themselves at burstRof regardless of the trigger (a burst commits — see initWeapon).
    if (!w.auto && !forcedShot && edge && w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0) w.burstLeft = w.burst;
    const want = energyReady && w.ammo > 0 && w.cooldownT <= 0 && (forcedShot || (w.auto ? !!input.fire : w.burstLeft > 0));
    if (want) {
      w.ammo -= (chargedShot && w.chargedAmmoCost) ? Math.min(w.chargedAmmoCost, w.ammo) : 1;
      w.shots += 1;
      if (w.energyMax > 0) {
        const ec = chargedShot ? (w.chargedEnergyCost ?? w.energyCost ?? 0) : (w.energyCost || 0);
        w.energy = Math.max(0, (w.energy ?? w.energyMax) - ec);
        if (w.energy <= 0) { w.energy = 0; w.energyLock = true; w.burstLeft = 0; }
      }
      if (chargedShot) w.chargedShots = (w.chargedShots || 0) + 1;
      const mst = matchStat(state, e.id);
      if (mst) mst.shots += 1;   // score screen: every ranged round fired (accuracy denominator)
      breakGuards(e);   // a round leaving spends any protection (spawn shield / wake guard / dodge i-frames)
      if (!w.auto && !forcedShot) w.burstLeft -= 1;
      w.cooldownT = w.auto ? 1 / (w.rof || 10)
        : (w.burstLeft > 0 ? 1 / (w.burstRof || 8) : (w.cooldown || 0.5));
      const t = e.transform;
      const origin = [t.pos[0], t.pos[1], t.pos[2] + w.eye];
      const aim = fwd3(t.heading, t.pitch || 0);
      // muzzle world point: the gun tip (body-frame offset), else the eye — the launch/tracer origin.
      // DUAL WIELD (muzzleAlt): a two-pistol slot shares one magazine but the two guns TAKE TURNS —
      // the lateral (right) offset flips sign each shot, so the tracer/flash alternates left↔right hand.
      const mo = w.muzzleOffset, hf = fwdXY(t.heading), hr = rightXY(t.heading);
      const rMul = (mo && w.muzzleAlt && (w.shots % 2 === 0)) ? -1 : 1;
      const from = mo
        ? [t.pos[0] + hf[0] * (mo.f || 0) + hr[0] * (mo.r || 0) * rMul, t.pos[1] + hf[1] * (mo.f || 0) + hr[1] * (mo.r || 0) * rMul, t.pos[2] + (mo.u != null ? mo.u : w.eye)]
        : origin.slice();
      if (w.fireClass === 'lob') {
        // LAUNCH a travelling round (R14) instead of resolving a hitscan cone. The launch aim tilts
        // UP by lobAngle° (the arc); velocity = that direction · projectileSpeed. stepProjectiles
        // integrates it under gravity and adjudicates the burst. lastShot carries to:null so the
        // hitscan fx channel draws nothing — the projectile channel owns lob visuals.
        const la = (w.lobAngle || 0) * Math.PI / 180;
        const dir = fwd3(t.heading, (t.pitch || 0) + la);
        const sp = w.projectileSpeed || 60;
        state.projectiles.push({
          id: 'proj-' + (state.projSeq++), owner: e.id,
          pos: from.slice(), vel: [dir[0] * sp, dir[1] * sp, dir[2] * sp],
          gravity: w.projectileGravity || 0, splashRadius: w.splashRadius || 0, projRadius: w.projRadius || 0.5, prox: w.proximity || 0,
          damage: w.damage || 0, impact: shotImpact, born: state.time, age: 0, armTime: w.armTime || 0, fuse: w.fuse || 4,
          fxColor: w.fxColor ?? null, fxScale: w.fxScale ?? null, smokeTrail: w.smokeTrail !== false,
        });
        e.lastShot = { mode: 'launch', t: state.time, from, to: null, charged: chargedShot };
      } else {
        const coreR = w.coreAngle * Math.PI / 180, assistR = w.assistAngle * Math.PI / 180;
        let best = null, friendHit = null;   // friendHit = nearest ALLY the ray passes through (staggered, never a damage target)
        for (const tg of state.entities) {
          if (tg === e || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames (dodge / getup) take no hits
          const friendly = e.team && tg.team && tg.team === e.team;   // TEAM: friendly fire off — allies pass through, but stagger
          const v = sub(tg.transform.pos, origin);
          const d = Math.hypot(v[0], v[1], v[2]);
          if (d < 1e-3 || d > w.range) continue;
          let mode = null, hd = d;
          if (tg.body.egg) {
            // R19 CORE = the aim ray actually passing THROUGH the tilted egg (fair — aim at the body).
            const te = hitEgg(origin, aim, tg);
            if (te != null && te <= w.range) { mode = 'core'; hd = te; }
            else if (w.fireClass === 'area') {
              // the MG assist ring stays ITS OWN thing: the outer angular ring, sized off the egg's width.
              const ang = Math.acos(clamp((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1, 1));
              if (ang <= assistR + Math.atan(tg.body.egg.a / d)) mode = 'assist';
            }
          } else {
            // legacy isotropic sphere (unchanged for any body without an egg → byte-identical).
            const ang = Math.acos(clamp((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1, 1));
            const subtend = Math.atan((tg.body.radius || 0.5) / d);   // the target's angular size widens the ring
            if (ang <= coreR + subtend) mode = 'core';
            else if (w.fireClass === 'area' && ang <= assistR + subtend) mode = 'assist';
          }
          if (friendly) {
            // an ally is never a damage candidate, but the beam PASSES THROUGH it — record the nearest
            // ally on the ray (clear of cover) so it can be STAGGERED after the scan (no block, no hurt).
            if (mode && !sightBlocked(from, tg.transform.pos, state.colliders) && (!friendHit || hd < friendHit.d)) friendHit = { d: hd, tg };
            continue;
          }
          // COVER: a solid box on the muzzle→target sightline eats the shot (the same colliders that
          // block movement). Checked only for a would-be hit, so it costs nothing on a clean lane.
          if (mode && sightBlocked(from, tg.transform.pos, state.colliders)) mode = null;
          if (mode && (!best || hd < best.d)) best = { mode, d: hd, id: tg.id, tg };
        }
        // TEAM friendly stagger: rock the nearest ally the beam passed through (no damage), provided the
        // beam reached them before whatever it actually hit — a strong round staggers, a light one chips.
        if (friendHit && (!best || friendHit.d <= best.d) && shotImpact > 0 && Number.isFinite(friendHit.tg.poise) && friendHit.tg.staggerT == null) {
          friendHit.tg.poise -= shotImpact * boostStunFactor(friendHit.tg);
          if (friendHit.tg.poise <= 0) armReaction(friendHit.tg, 'stagger');
        }
        if (best) {
          const tg = best.tg;
          e.lastShot = { mode: best.mode, targetId: best.id, t: state.time, from, to: tg.transform.pos.slice(), charged: chargedShot };
          tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1;
          tg.lastHitBy = e.id;   // match-layer attribution: the most recent hitter takes the kill credit
          if (mst) mst.hits += 1;   // score screen: the round connected (a shield catch still counts on-target)
          // R19: a frontal shield EATS the shot (drains its HP by the shot's damage, no hp/poise; a
          // break staggers). Shield HP is in hp points, so a 100-hp shield takes ~5 damage-20 rifle hits.
          if (absorbShield(tg, origin, w.damage || 0, state)) {
            /* absorbed by the shield */
          } else {
          // damage is just numbers: chip hp (floored at 0; the target survives at 0 for this spike).
          if (tg.body && Number.isFinite(tg.body.hp)) {
            const hp0 = tg.body.hp;
            tg.body.hp = Math.max(0, tg.body.hp - w.damage);
            if (mst) mst.dmg += hp0 - tg.body.hp;   // hull damage actually dealt (overkill clamped away)
          }
          // poise is the mechanic: chip it, and when it BREAKS (<=0) the target STAGGERS — a rooted
          // lurch (stepReaction plays the `stagger` clip and blocks its verbs until it recovers). Poise
          // refills to max on the break so it is a threshold, not a drain; hits mid-stagger don't re-trigger.
          // A killing shot (hp floored) floors it regardless (armReaction's kill override → downed)
          // — checked SEPARATELY from the poise chip (arena M1 fix): a low-impact round can kill
          // without breaking poise, and the old else-if left such a target standing at 0 hp.
          if (Number.isFinite(tg.poise) && tg.staggerT == null && shotImpact > 0) {
            tg.poise -= shotImpact * boostStunFactor(tg);   // R23 boost armor halves the chip while boosting
            if (tg.poise <= 0) armReaction(tg, 'stagger');
          }
          if (tg.body && Number.isFinite(tg.body.hp) && tg.body.hp <= 0) {
            armReaction(tg, 'stagger');   // kill → downed even without a poise break
          }
          }
        } else {
          // miss (or blocked by cover): stop the tracer AT the wall if the aim ray hits one, else fly to range.
          const far = [origin[0] + aim[0] * w.range, origin[1] + aim[1] * w.range, origin[2] + aim[2] * w.range];
          const wt = nearestWallT(from, far, state.colliders);
          e.lastShot = { mode: 'miss', t: state.time, from, to: wt != null ? lerp3(from, far, wt) : far, charged: chargedShot };
        }
      }
    }
    if (w.ammo <= 0 && !w.reloading) { w.reloading = true; w.reloadT = w.reload; }   // auto-reload on empty
  }

  // stepProjectiles(state, dt) — advance every in-flight round (R14) and adjudicate its BURST. A round
  // is a plain record in state.projectiles (spawned by stepWeapon's lob branch); this integrates it
  // under gravity and bursts it on the FIRST of: a hittable contact (after armTime, so it clears the
  // owner's own muzzle), the ground plane (z<=0), or its fuse. A burst is an UNCONDITIONAL poise-break
  // on every hittable within splashRadius (owner excluded) — the direct hit is just the d~0 splash case,
  // so "staggers on hit AND on splash" is one path. Pure + deterministic (fixed dt Euler → identical
  // arcs/bursts), so it replays byte-identical and tests headless. Bursts push an fx record the renderer
  // reads; the list is trimmed to the last ~1s so it never grows unbounded.
  function stepProjectiles(state, dt) {
    const ps = state.projectiles;
    if (ps && ps.length) {
      for (let i = ps.length - 1; i >= 0; i -= 1) {
        const p = ps[i];
        p.age += dt;
        const prev = [p.pos[0], p.pos[1], p.pos[2]];   // travel segment start (for the wall-hit test)
        p.vel[2] -= (p.gravity || 0) * dt;
        p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt; p.pos[2] += p.vel[2] * dt;
        let hitId = null;
        if (p.age >= (p.armTime || 0)) {
          // CONTACT vs the tall EGG column (not a feet-point ball — a flat shell flies at body
          // height), SWEPT along this tick's whole travel segment: a fast bazooka round crosses a
          // suit's egg width in ONE fixed step, so a single end-point sample can tunnel straight
          // through a target that walked onto the line (real since the R20 ai hunters move).
          // Deterministic sub-sampling at half the target's lateral radius, capped; the burst
          // centers on the CONTACT sample, not the overshot step end.
          // PROXIMITY FUZE (p.prox > 0): the detection radius is padded by the fuze distance, so
          // the round bursts as it PASSES a body — the burst point is the near-miss sample and
          // the (larger) splash reaches the target. Contact rounds keep the bare radius.
          const segLen = Math.hypot(p.pos[0] - prev[0], p.pos[1] - prev[1], p.pos[2] - prev[2]);
          const detR = (p.projRadius || 0) + (p.prox || 0);
          for (const tg of state.entities) {
            if (tg.id === p.owner || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames take no hits
            const stepLen = Math.max(latR(tg) * 0.5, 1e-3);
            const n = Math.min(24, Math.max(1, Math.ceil(segLen / stepLen)));
            let hitPt = null;
            for (let k2 = 1; k2 <= n && !hitPt; k2++) {
              const pt = lerp3(prev, p.pos, k2 / n);
              let hit;
              if (tg.body.egg) hit = pointInEgg(pt, tg, detR);
              else { const v = sub(tg.transform.pos, pt); hit = Math.hypot(v[0], v[1], v[2]) <= (tg.body.radius || 0.5) + detR; }
              if (hit) hitPt = pt;
            }
            if (hitPt) { hitId = tg.id; p.pos[0] = hitPt[0]; p.pos[1] = hitPt[1]; p.pos[2] = hitPt[2]; break; }
          }
        }
        // COVER: the round bursts where its travel segment first crosses a solid box (a shell into a
        // wall detonates on the wall — its splash still catches anything hugging the far side within range).
        let wall = false;
        if (p.age >= (p.armTime || 0) && state.colliders) {
          const wt = nearestWallT(prev, p.pos, state.colliders);
          if (wt != null) { const hp = lerp3(prev, p.pos, wt); p.pos[0] = hp[0]; p.pos[1] = hp[1]; p.pos[2] = hp[2]; wall = true; }
        }
        const ground = p.pos[2] <= 0;
        if (hitId != null || ground || wall || p.age >= (p.fuse || 4)) {
          if (ground) p.pos[2] = 0;
          burstProjectile(state, p);
          ps.splice(i, 1);
        }
      }
    }
    // trim spent burst fx records (renderer reads new ones each frame; they live ~1s)
    const bs = state.bursts;
    if (bs && bs.length) {
      for (let i = bs.length - 1; i >= 0; i -= 1) if (state.time - bs[i].t > 1) bs.splice(i, 1);
    }
    // melee clash records (the spark seam) trim on the same clock
    const cl = state.clashes;
    if (cl && cl.length) {
      for (let i = cl.length - 1; i >= 0; i -= 1) if (state.time - cl[i].t > 1) cl.splice(i, 1);
    }
  }

  // burstProjectile(state, p) — the AoE poise-break. Every hittable within splashRadius (owner excluded)
  // takes an unconditional stagger (refill poise + arm the lurch, like a melee connect) and `damage` off
  // hp. Emits a burst fx record for the renderer.
  function burstProjectile(state, p) {
    const R = Math.max(p.splashRadius || 0, p.projRadius || 0);
    const ownerTeam = state.byId && p.owner ? (state.byId[p.owner] && state.byId[p.owner].team) : null;   // TEAM: friendly-fire read
    for (const tg of state.entities) {
      if (tg.id === p.owner || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames take no hits
      // SPLASH catches a target whose EGG is within R of the burst (a direct hit is trivially inside).
      if (tg.body.egg) { if (!pointInEgg(p.pos, tg, R)) continue; }
      else { const v = sub(tg.transform.pos, p.pos); if (Math.hypot(v[0], v[1], v[2]) > R + (tg.body.radius || 0.5)) continue; }
      // TEAM friendly stagger: an ally caught in the blast is ROCKED, not hurt — no hp/shield/attribution,
      // just the poise break (if not already reacting). Careless explosives cost tempo, never a team-kill.
      if (ownerTeam && tg.team && tg.team === ownerTeam) {
        if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
        continue;
      }
      tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1;
      tg.lastHitBy = p.owner;   // match-layer attribution (the round remembers its shooter)
      const mst = matchStat(state, p.owner);
      if (mst && !p.statHit) { p.statHit = true; mst.hits += 1; }   // one on-target credit per round, however wide the splash (accuracy stays ≤ 100%)
      // R19: a frontal shield eats the burst too (drains + a break staggers); a flank/rear burst bypasses.
      if (absorbShield(tg, p.pos, p.damage || 0, state)) continue;
      if (tg.body && Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp;
        tg.body.hp = Math.max(0, tg.body.hp - (p.damage || 0));
        if (mst) mst.dmg += hp0 - tg.body.hp;   // splash hull damage per caught target
      }
      // R23 BOOST ARMOR: a splash is a 100%-stun (worth a full poise bar) — normally an
      // UNCONDITIONAL stagger. Against a boosting suit with boost armor it becomes a scaled poise
      // CHIP instead (poiseMax × factor), so one bazooka shell no longer floors a boosting suit in
      // a single hit; a killing burst still floors (armReaction's kill override), and a suit with
      // no armor / not boosting keeps the classic unconditional break.
      // IMPACT-BURST (opt-in `weapon.impact` on a lob — the grenade): the burst is a poise CHIP of
      // `impact` (still scaled by boost armor), NOT a guaranteed break — so a lone grenade no longer
      // staggers; it softens poise and only floors an already-hit target. Bazookas carry no impact →
      // the classic unconditional break. A killing burst floors either way.
      const f = boostStunFactor(tg);
      const killed = tg.body && Number.isFinite(tg.body.hp) && tg.body.hp <= 0;
      if (killed) {
        armReaction(tg, 'stagger');
      } else if (p.impact > 0) {
        if (Number.isFinite(tg.poise) && tg.staggerT == null) {
          tg.poise -= p.impact * f;
          if (tg.poise <= 0) armReaction(tg, 'stagger');
        }
      } else if (f >= 1 || !(Number.isFinite(tg.poise) && tg.staggerT == null)) {
        armReaction(tg, 'stagger');   // ranged/splash always STAGGERS; only the back cleave topples
      } else {
        tg.poise -= tg.poiseMax * f;
        if (tg.poise <= 0) armReaction(tg, 'stagger');
      }
    }
    state.bursts.push({ seq: state.burstSeq++, pos: p.pos.slice(), t: state.time, radius: R, fxColor: p.fxColor, fxScale: p.fxScale });
  }

  // DEATH BURST (R34): the frame a unit goes DOWN it EXPLODES. NO damage — the wreck is the loss
  // already, and a damaging blast would chain kills — but an UNCONDITIONAL bazooka-class splash
  // STAGGER (radius 0.54 x the dying unit's own height, +15% over the old 0.47: a bigger suit
  // makes a bigger blast, all of them bazooka-family). Same semantics as a shell splash: the egg
  // inclusion test, a frontal shield eats the concussion (R19), boost armor halves it (R23).
  // Deliberately NO attribution (no hitFlash / lastHitBy / match stats — nobody fired it), the
  // WRECKS are excluded (no re-toppling a downed frame), and the killer eats it too if they were
  // standing over the kill — the point-blank melee execution has a cost. The bursts record rides
  // the same channel as a shell burst, so the renderer's fireball (and the R31 smoke cloud, where
  // the world opts in) come for free.
  function explodeUnit(state, e) {
    const egg = e.body && e.body.egg;
    const hgt = egg ? (Number.isFinite(egg.cz) ? egg.cz : egg.c) + egg.c : 24;
    const R = Math.round(hgt * 0.54 * 10) / 10;   // +15% suit-explosion splash (was 0.47)
    const cz = egg ? (Number.isFinite(egg.cz) ? egg.cz : egg.c) : hgt * 0.5;
    const pos = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + cz];
    for (const tg of state.entities) {
      if (tg === e || tg.downed || tg.invincible || !(tg.body && tg.body.hittable)) continue;
      if (tg.body.egg) { if (!pointInEgg(pos, tg, R)) continue; }
      else { const v = sub(tg.transform.pos, pos); if (Math.hypot(v[0], v[1], v[2]) > R + (tg.body.radius || 0.5)) continue; }
      if (absorbShield(tg, pos, 0, state)) continue;   // a frontal shield eats the concussion (no damage to drain)
      const f = boostStunFactor(tg);
      if (f >= 1 || !(Number.isFinite(tg.poise) && tg.staggerT == null)) {
        armReaction(tg, 'stagger');
      } else {
        tg.poise -= tg.poiseMax * f;
        if (tg.poise <= 0) armReaction(tg, 'stagger');
      }
    }
    // the SPECTACLE outsizes the shove (operator): fxRadius drives the fireball + smoke at 2x the
    // stagger radius — the blast is adjudicated the same frame it spawns, so the bigger shell is
    // pure theater and never overstates a dodgeable circle. `radius` stays the honest mechanic.
    state.bursts.push({ seq: state.burstSeq++, pos, t: state.time, radius: R, fxRadius: Math.round(R * 2 * 10) / 10, fxColor: 0xffa03c, fxScale: Math.round(hgt * 0.85 * 10) / 10 });
  }

  // boostStunFactor(tg) — BOOST ARMOR (R23): the multiplier applied to any STUN a target takes
  // while it is BOOSTING. Opt-in `body.boostArmor` (a level ≥ 1) hoisted to `tg.boostArmor`;
  // active only while `tg.boosting` (the platform rule surfaces it — so an idle/walking suit is
  // unarmored, and a boost that was melee-cancelled is too). Each level HALVES the stun: lv1 → 0.5
  // (a 100%-stun hit — a beam bolt or a bazooka splash, both worth a full poise bar — no longer
  // breaks in one; it takes two), lv2 → 0.25, etc. No armor / not boosting → 1 (unchanged). The
  // factor scales the poise CHIP a stun deals; an unconditional stagger (splash/melee) is treated
  // as a full-bar (poiseMax) stun so the same factor turns it into a survivable chip.
  function boostStunFactor(tg) {
    if (!(tg.boostArmor > 0) || !tg.boosting) return 1;
    return Math.pow(0.5, tg.boostArmor);
  }

  // matchStat(state, id) — the contender's score-screen accumulator row ({ deaths, dmg, shots,
  // hits }), or null when the world runs no match layer / the id is not enrolled. Guarded at
  // every adjudication site so a matchless world stays byte-identical in behavior.
  function matchStat(state, id) {
    const m = state.match;
    return m && !m.dead && m.stats && m.stats[id] ? m.stats[id] : null;
  }

  // armReaction(tg, kind, force) — arm a hit-reaction on a poise-bearing target. Refill
  // poise (the break is a THRESHOLD, not a drain) and start the reaction timer
  // with the clip + duration for this KIND: 'stagger' is the light lurch every
  // connect gives; 'topple' is the heavy KNOCKDOWN (the `back` great-cleave, or a
  // landed MELEE COMBO follow-up) — a longer clip that FLOORS the unit.
  // The KILLING BLOW overrides: a hit that leaves hp at 0 always topples AND
  // marks the unit downed (stepReaction then holds the collapse — it never rises).
  // A target already mid-reaction is left alone unless this is the kill — or `force`
  // (R20.4): a toppling melee connect UPGRADES a mid-STAGGER target into the knockdown
  // (the combo's whole point — hit 2 lands while hit 1's lurch still runs). A force
  // never interrupts an in-progress fall/getup (you can't re-floor the floored).
  function armReaction(tg, kind, force) {
    if (!Number.isFinite(tg.poise)) return;
    const dead = tg.body && Number.isFinite(tg.body.hp) && tg.body.hp <= 0;
    if (dead) kind = 'topple';
    const inKnockdown = tg.staggerT != null && (tg.reactClip === 'topple' || tg.reactClip === 'downpause' || tg.reactClip === 'getup');
    if (tg.staggerT != null && !dead && !(force && !inKnockdown)) return;   // mid-reaction: kill or a forced knockdown overrides a stagger
    if (tg.staggerT == null) tg.staggerReturn = tg.locomotion;   // an upgrade keeps the ORIGINAL return locomotion (never 'stagger')
    tg.poise = tg.poiseMax; tg.staggerT = 0; tg.downPauseT = null;
    tg.reactClip = kind === 'topple' ? 'topple' : 'stagger';
    // topple's reactDur is the FALL only (stepReaction then chains getupDur for the rise);
    // stagger is a single segment.
    tg.reactDur = kind === 'topple' ? (tg.toppleDur || (tg.staggerDur || 1.3) * 1.3) : (tg.staggerDur || 1.3);
    // PRACTICE (match.practice → e.noDestroy): the killing blow still plays its knockdown, but
    // the suit rises with a FULL bar instead of dying — destruction is off, the drill continues.
    if (dead) { if (tg.noDestroy && Number.isFinite(tg.hpMax)) tg.body.hp = tg.hpMax; else tg.downed = true; }
  }

  // stepMelee — the melee analog of stepWeapon (the swing analog the ranged targeting computer
  // never had). While a swing is inside its CONTACT window (a fraction of the clip — the
  // downstroke, not the wind-up or recovery), the blade adjudicates against every hittable target
  // that is IN FRONT and within reach, ONCE per target per swing. A connect flashes the target,
  // chips hp/poise exactly like a shot (so a saber can stagger the same enemy a rifle can), and
  // increments meleeHitCount — the audio channel reads that edge and plays the impact clash. Reach
  // and the numbers ride e.strikeParams, stamped from the active strike config at swing start.
  // Pure + deterministic like stepWeapon (fixed input+dt → identical connects).
  // beginClash(a, b, state) — the CLASH EVENT (2026-07-28): two units melee'd into each other
  // at the same time and the blades MET. The exchange trades damage for THEATER: the pair is
  // repositioned face-to-face at a blade-lock gap (proportional to their combined reach), both
  // hold the forward-thrust swing INVINCIBLE for ~0.9s while sparks pulse off the cross, then
  // stepClash SHOVES them apart and hands both bodies back to their rules — no damage, no
  // stagger, no cooldown ("separated and free to move again"; an immediate re-engage can clash
  // again, which is the fantasy). Deterministic — pure geometry of the pair; the initiator
  // carries `clashLead` so the spark pulses emit exactly once per pair.
  function beginClash(a, b, state) {
    const Pa = a.strikeParams, Pb = b.strikeParams;
    const gap = (((Pa && Pa.reach) || 6) + ((Pb && Pb.reach) || 6)) * 0.45;
    const pa = a.transform.pos, pb = b.transform.pos;
    const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
    let ux = pb[0] - pa[0], uy = pb[1] - pa[1];
    const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
    pa[0] = mx - ux * gap / 2; pa[1] = my - uy * gap / 2;
    pb[0] = mx + ux * gap / 2; pb[1] = my + uy * gap / 2;
    a.transform.heading = Math.atan2(uy, ux);   // square up: each faces the other across the lock
    b.transform.heading = Math.atan2(-uy, -ux);
    const cz = (hullZ(a) + hullZ(b)) / 2;
    for (const u of [a, b]) {
      u.clashT = 0; u.clashDur = 0.9; u.clashGap = gap;
      u.clashSpark = [mx, my, cz];
      u.swingT = null; u.swingCombo = false; u.comboT = 0;   // the lock consumes both swings
      u.vel[0] = 0; u.vel[1] = 0;
    }
    a.clashLead = true; b.clashLead = false;
    // the opening burst: a BIG shower at the blade cross (`n` = renderer spark count)
    state.clashes.push({ seq: state.clashSeq++, pos: [mx, my, cz], dir: null, t: state.time, fxColor: null, fxScale: 4, n: 40 });
  }

  // stepClash(e, dt, state) — advance a clash lock (run beside stepReaction in the entity loop;
  // returns true while it OWNS the body — rule + weapon suppressed, like a stagger). The suit
  // thrusts into the cross and HOLDS it (swing_forward, phase frozen at the lunge peak),
  // invincible; the lead side pulses a fresh spark record every ~0.22s at the fixed lock point
  // (both suits are rooted, so it stays true). At the end each is shoved HALF A GAP straight
  // back — the separation — and freed.
  function stepClash(e, dt, state) {
    if (e.clashT == null) return false;
    const dur = e.clashDur || 0.9;
    const t0 = e.clashT * dur;
    e.clashT += dt / dur;
    e.invincible = true;
    e.locomotion = 'swing_forward'; e.moving = true;
    e.gaitPhase = Math.min(0.45, e.clashT * 1.6);   // thrust IN, then hold the crossed-blades frame
    if (e.clashLead && e.clashSpark && Math.floor((e.clashT * dur) / 0.22) > Math.floor(t0 / 0.22)) {
      state.clashes.push({ seq: state.clashSeq++, pos: e.clashSpark.slice(), dir: null, t: state.time, fxColor: null, fxScale: 3, n: 18 });
    }
    if (e.clashT >= 1) {
      const back = (e.clashGap || 6) * 0.5;
      e.transform.pos[0] -= Math.cos(e.transform.heading) * back;
      e.transform.pos[1] -= Math.sin(e.transform.heading) * back;
      e.clashT = null; e.clashLead = false; e.invincible = false;
      e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;
      // POST-CLASH BREAK (ai, opt-out `r.clashRetreat === false`): crossing blades ENDS the
      // melee exchange — instead of instantly re-clashing, the suit DISENGAGES: it reverts to shooting
      // (reuses the melee give-up window → ranged rotation) and flags a dash-away the brain fires next
      // frame. Turns a clash into a reset-and-reposition beat rather than a lock. Space too
      // (2026-08-04): without it, space melee-seek re-clashed forever — the roll-out-and-reengage
      // beat is exactly the anti-loop.
      const er = e.rule;
      if (er && er.type === 'ai' && er.clashRetreat !== false) {
        e.meleeGiveUpT = er.meleeGiveUp ?? 4;
        e.clashRetreat = true;
      }
    }
    return true;
  }

  function stepMelee(e, dt, state) {
    const P = e.strikeParams;
    if (e.swingT == null || !P) return;
    if (e.swingT < P.from || e.swingT > P.to) return;
    // aim = forward, YAWED toward the swing side for left/right cuts (P.aimYaw) so
    // the hitbox lands where the blade travels, not straight ahead.
    const t = e.transform, aim = fwdXY(t.heading + (P.aimYaw || 0));
    const origin = [t.pos[0], t.pos[1], t.pos[2] + P.eye];
    for (const tg of state.entities) {
      if (tg === e || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames (dodge / getup) take no hits
      if (e.struckThisSwing[tg.id]) continue;
      const v = sub(tg.transform.pos, origin);
      const d = Math.hypot(v[0], v[1], v[2]);
      if (d < 1e-3 || d > P.reach + latR(tg)) continue;   // R19: egg width (melee BYPASSES the shield)
      const flat = Math.hypot(v[0], v[1]) || 1e-6;
      if ((v[0] * aim[0] + v[1] * aim[1]) / flat < P.cosCone) continue;   // the swing lands in FRONT of the suit
      // TEAM friendly stagger: a swing that catches an ally rocks them (no damage, no clash, no
      // attribution) — friendly fire is off, but a wild blade still staggers a teammate in the arc.
      if (e.team && tg.team && tg.team === e.team) {
        e.struckThisSwing[tg.id] = true;
        if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
        continue;
      }
      // CLASH EVENT (2026-07-28): the struck target is ITSELF mid-melee — a live swing carrying
      // strike params (a throw's swing carries none) and not already reeling. The blades MEET
      // instead of landing: no damage either way — beginClash locks the pair, and the lock
      // consumes THIS swing outright (no further targets this swing).
      if (tg.swingT != null && tg.strikeParams && tg.staggerT == null) {
        e.struckThisSwing[tg.id] = true;
        beginClash(e, tg, state);
        break;
      }
      e.struckThisSwing[tg.id] = true;
      e.meleeHitCount = (e.meleeHitCount || 0) + 1;
      e.lastStrike = { targetId: tg.id, t: state.time };
      tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1;
      tg.lastHitBy = e.id;   // match-layer attribution
      // CLASH fx record (melee-clash-fx) — the spark seam: seq-keyed like state.bursts so the
      // renderer edge-detects it. The contact point sits on the target's hull FACING the attacker
      // (its egg's lateral radius back along the strike line), at the strike plane's height when
      // the config declares one (strikeEye > 0) — else at the target's hull CENTER (egg c, or the
      // legacy sphere radius): the suits adjudicate melee from a feet-height plane (P.eye 0), and
      // sparks at the feet would lie about where the blade meets the armor. `dir` is the hull
      // facing (unit XY, target → attacker) so the spray can shear back toward the swing;
      // tint/size ride the strike config's strikeFx (P.fx).
      const lr = Math.min(latR(tg), flat);
      const clashZ = P.eye > 0 ? origin[2] : hullZ(tg);
      state.clashes.push({
        seq: state.clashSeq++,
        pos: [tg.transform.pos[0] - (v[0] / flat) * lr, tg.transform.pos[1] - (v[1] / flat) * lr, clashZ],
        dir: [-v[0] / flat, -v[1] / flat],
        t: state.time,
        fxColor: P.fx && P.fx.color != null ? P.fx.color : null,
        fxScale: P.fx && P.fx.scale != null ? P.fx.scale : null,
      });
      const mst = matchStat(state, e.id);
      if (tg.body && Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp;
        tg.body.hp = Math.max(0, tg.body.hp - P.damage);
        if (mst) mst.dmg += hp0 - tg.body.hp;   // melee hull damage counts toward the score; accuracy stays ranged-only
      }
      // melee ALWAYS breaks poise on connect (operator: a melee hit is a
      // guaranteed poise-break, not a threshold chip like ranged fire). WHICH
      // reaction it arms: only a TOPPLE-flagged verb knocks down (P.topple,
      // stamped at swing start — defaults to the `back` great-cleave, and a
      // strikeVerbs table can claim it for other verbs, e.g. the whip's
      // downswing). On a COMBO-equipped slot (R20.4 refined) only as the TIMED
      // FOLLOW-UP (e.swingCombo): land a hit, then S+click inside the window.
      // A plain back cleave on a combo slot staggers like any other swing; a
      // combo-less slot (the z heat axe) keeps the R15 always-topple cleave.
      // Topples pass force so they UPGRADE a target still reeling from the
      // opener — the combo's payoff. A killing blow floors it either way
      // (armReaction's kill override).
      const topples = (P.topple != null ? !!P.topple : e.swingClip === 'swing_back') && (P.combo ? !!e.swingCombo : true);
      armReaction(tg, topples ? 'topple' : 'stagger', topples);
    }
  }

  // stepTackle — the hit adjudicator for the TACKLE dash (the platform rule's `r.tackle` maneuver;
  // run in stepWorld beside stepMelee while `e.tackleT != null`). A moving CONTACT box carried by
  // the charging suit: any hittable IN FRONT and within `tackleReach` (egg-inclusive) that is not
  // invincible / not an ally takes a SMALL chip (`tackleDamage`, default 15) and an UNCONDITIONAL
  // stagger (armReaction 'stagger' — never a topple; the operator's "staggers on hit"), ONCE per
  // target per tackle (`e.tackleHits`), and the tackle PLOWS ON (it does not stop on a connect, so
  // a charge through a knot of suits staggers each). An impact spark rides the shared clash channel
  // (the renderer + audio edge-detect it). Pure + deterministic like stepMelee. The tackler is NOT
  // spent on the hit — it stays invincible for the whole dash (that stays owned by the rule).
  function stepTackle(e, dt, state) {
    if (e.tackleT == null) return;
    const r = e.rule;
    const reach = r.tackleReach ?? 8;
    const dmg = r.tackleDamage ?? 15;
    const cosCone = Math.cos((r.tackleCone ?? 70) * Math.PI / 180);
    const t = e.transform, aim = fwdXY(t.heading);
    const origin = [t.pos[0], t.pos[1], t.pos[2] + (r.eye ?? 0)];
    if (!e.tackleHits) e.tackleHits = {};
    // STOP-ON-CONTACT: the charge HALTS on the first suit it rams — the dash ends, control returns to
    // the pilot, and the tackle i-frames drop (invincibility ends when the user gets control again).
    // The one exception is the counter CINEMATIC: if beginTackleCounter kicked off the shove-down set
    // piece (e.cineT set), that owns the body and manages its OWN invincibility, so we leave it be.
    const endTackle = () => { e.tackleT = null; e.tackleDir = null; if (e.cineT == null) e.invincible = false; };
    for (const tg of state.entities) {
      if (tg === e || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames / non-hittable skip
      if (e.tackleHits[tg.id]) continue;                                            // once per target per tackle
      const v = sub(tg.transform.pos, origin);
      const d = Math.hypot(v[0], v[1], v[2]);
      if (d < 1e-3 || d > reach + latR(tg)) continue;                               // egg-inclusive contact range
      const flat = Math.hypot(v[0], v[1]) || 1e-6;
      if ((v[0] * aim[0] + v[1] * aim[1]) / flat < cosCone) continue;               // in FRONT of the charge
      // TEAM friendly fire (matches melee / ranged / splash): ramming a teammate ROCKS them — a plain
      // STAGGER, never damage, never the COUNTER (topple + boost reset) and never attribution. Gated
      // BEFORE the counter + the damage path, so allies only ever get the harmless rock ("no friendly
      // fire, but stagger applies"). Non-team modes (solo / FFA — no `team` tags) have no allies to skip.
      if (e.team && tg.team && tg.team === e.team) {
        e.tackleHits[tg.id] = true;
        if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
        endTackle(); return;   // STOP on the ally it bumped (rocked, unhurt)
      }
      // TACKLE COUNTER: the rammed target is MID-MELEE — a live swing carrying strike params (a
      // throw carries none), not already reeling. The CHARGE BEATS the swing: beginTackleCounter
      // TOPPLES the caught melee suit (→ the usual getup) and REWARDS the tackler with a boost reset
      // (and, for the pilot, kicks off the shove-down cinematic). The tackle STOPS on this contact.
      if (tg.swingT != null && tg.strikeParams && tg.staggerT == null) {
        e.tackleHits[tg.id] = true;
        beginTackleCounter(e, tg, state);
        endTackle(); return;   // STOP on the countered suit (a cinematic, if it began, keeps its own i-frames)
      }
      e.tackleHits[tg.id] = true;
      e.tackleHitCount = (e.tackleHitCount || 0) + 1;   // audio/impact edge (the body-check thud)
      tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1; tg.lastHitBy = e.id;
      // impact spark on the target's hull facing the charge (reuse the melee-clash-fx seam)
      const lr = Math.min(latR(tg), flat);
      const cz = hullZ(tg);
      state.clashes.push({
        seq: state.clashSeq++,
        pos: [tg.transform.pos[0] - (v[0] / flat) * lr, tg.transform.pos[1] - (v[1] / flat) * lr, cz],
        dir: [-v[0] / flat, -v[1] / flat], t: state.time, fxColor: null, fxScale: null,
      });
      const mst = matchStat(state, e.id);
      if (Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp;
        tg.body.hp = Math.max(0, tg.body.hp - dmg);
        if (mst) mst.dmg += hp0 - tg.body.hp;
      }
      armReaction(tg, 'stagger');   // staggers on hit (a kill still floors it — armReaction's kill override)
      endTackle(); return;   // STOP on the suit it rammed — the charge doesn't plow on
    }
  }

  // beginTackleCounter(tackler, victim, state) — the TACKLE COUNTER (the special event when a tackle
  // rams a suit MID-MELEE). Rock-paper-scissors: a CHARGE BEATS a swing. The tackle catches the melee
  // suit committed to its wind-up and STUFFS it — asymmetric, the TACKLER wins outright:
  //   • the VICTIM (the one swinging) is TOPPLED (armReaction 'topple', forced) — its swing cancelled,
  //     knocked flat, then the shared getup primitive stands it back up (the usual knockdown → get-up
  //     chain, run invincible by stepReaction). "the attacker gets stuffed by the tackle."
  //   • the TACKLER is REWARDED with a BOOST RESET — the gauge refilled to full and the overheat lock
  //     cleared, refunding the whole tackle cost — but ONLY on a landed counter ("only if tackle counter
  //     connects"). Its dash CONTINUES (it plowed through and won). A normal tackle (into a non-melee
  //     target) still just staggers and keeps the gauge dumped — the refund is the read's payoff.
  // No damage by default (so the topple → getup plays out); opt-in `counterDamage` on the TACKLER's rule
  // chips the victim if a world wants the stuff to bite. A big spark pours off the contact (the shared
  // clash-fx seam). Deterministic — pure geometry + the reaction primitives.
  function beginTackleCounter(tackler, victim, state) {
    armReaction(victim, 'topple', true);   // the swinging suit is STUFFED → topple → the usual getup logic
    victim.swingT = null; victim.swingCombo = false; victim.comboT = 0; victim.struckThisSwing = {};   // consume its swing
    victim.lastHitBy = tackler.id;
    victim.hitFlash = state.time; victim.hits = (victim.hits || 0) + 1;
    const dmg = (tackler.rule && tackler.rule.counterDamage) || 0;
    if (dmg > 0 && victim.body && Number.isFinite(victim.body.hp)) {
      const hp0 = victim.body.hp;
      victim.body.hp = Math.max(0, victim.body.hp - dmg);
      const mst = matchStat(state, tackler.id); if (mst) mst.dmg += hp0 - victim.body.hp;
      if (victim.body.hp <= 0) { if (victim.noDestroy && Number.isFinite(victim.hpMax)) victim.body.hp = victim.hpMax; else victim.downed = true; }   // a lethal stuff still floors it (getup skipped by stepReaction); practice refills instead
    }
    // the TACKLER wins: BOOST RESET — refill the gauge + clear the overheat, refunding the tackle cost.
    const boostMax = (tackler.rule && tackler.rule.boostMax > 0) ? tackler.rule.boostMax : 0;
    if (boostMax > 0) { tackler.boost = boostMax; tackler.boostLock = false; }
    tackler.tackleCounterHit = (tackler.tackleCounterHit || 0) + 1;   // audio/fx edge (the stuffing + gauge chime)
    // CINEMATIC (tackle-cinematic.plan.md): when the PLAYER is in the counter and a camera exists, the
    // shove-down set piece takes over the positioning + animation — skip the classic fling. Otherwise fling.
    if (state.pilotId && (tackler.id === state.pilotId || victim.id === state.pilotId) && state.camera && state.cinematic == null) {
      beginTackleCinematic(tackler, victim, state);
      return;
    }
    const pv = victim.transform.pos, pt = tackler.transform.pos;
    let ux = pv[0] - pt[0], uy = pv[1] - pt[1]; const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
    victim.transform.heading = Math.atan2(-uy, -ux);   // the stuffed suit is flung facing back up the charge line
    const cz = hullZ(victim);
    state.clashes.push({ seq: state.clashSeq++, pos: [pv[0], pv[1], cz], dir: [ux, uy], t: state.time, fxColor: null, fxScale: 4, n: 40 });
  }

  // ── TACKLE-COUNTER CINEMATIC (tackle-cinematic.plan.md) — the shove-down set piece ─────────────
  // Modeled on beginClash/stepClash: a two-suit, timed, INVINCIBLE, rooted-pose lock. stepTackleCine
  // OWNS the body (rule/weapon/ai suppressed) while it runs; the follow rule reads world.cinematic to
  // swing to a SIDE view of the pair. Engine-only — poses are locomotion/gaitPhase, the camera is
  // engine-driven. The rest of the battle keeps stepping.
  const CINE_DUR = 4.5;
  function beginTackleCinematic(tackler, victim, state) {
    for (const u of [tackler, victim]) {   // the cinematic owns both suits — clear every transient combat state
      u.tackleT = null; u.tackleDir = null; u.tackleHits = {};
      u.swingT = null; u.swingCombo = false; u.comboT = 0; u.struckThisSwing = {};
      u.dodgeT = null; u.tumble = null; u.dodgeDir = null;
      u.staggerT = null; u.downPauseT = null; u.downed = false;   // the shove drives the descent, not a reaction
      u.vel[0] = 0; u.vel[1] = 0; if (u.vel.length > 2) u.vel[2] = 0;
    }
    // square up: the tackler grabs from the FRONT — pull it to grab distance facing the victim, which holds ground.
    const pv = victim.transform.pos, pt = tackler.transform.pos;
    let ux = pv[0] - pt[0], uy = pv[1] - pt[1]; const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
    const gap = (((tackler.collideVol && tackler.collideVol.a) || 2) + ((victim.collideVol && victim.collideVol.a) || 2)) * 1.05;
    pt[0] = pv[0] - ux * gap; pt[1] = pv[1] - uy * gap;
    tackler.transform.heading = Math.atan2(uy, ux);        // tackler faces the victim
    victim.transform.heading = Math.atan2(-uy, -ux);       // victim faces the tackler
    tackler.cineT = 0; tackler.cineDur = CINE_DUR; tackler.cineRole = 'shover'; tackler.cineLead = true; tackler.invincible = true;
    victim.cineT = 0; victim.cineDur = CINE_DUR; victim.cineRole = 'shoved'; victim.cineLead = false; victim.invincible = true;
    // pick the camera side so the view never swings across the axis (perp = (-uy, ux))
    let side = 1;
    if (state.camera) {
      const cp = state.camera.transform.pos, mx = (pt[0] + pv[0]) / 2, my = (pt[1] + pv[1]) / 2;
      side = ((cp[0] - mx) * (-uy) + (cp[1] - my) * ux) >= 0 ? 1 : -1;
    }
    state.cinematic = { a: tackler.id, b: victim.id, side };
    const cz = hullZ(victim);
    state.clashes.push({ seq: state.clashSeq++, pos: [pv[0], pv[1], cz], dir: [ux, uy], t: state.time, fxColor: null, fxScale: 3, n: 24 });
  }

  function stepTackleCine(e, dt, state) {
    if (e.cineT == null) return false;
    e.cineT += dt / (e.cineDur || CINE_DUR);
    e.invincible = true;
    const t = Math.min(1, e.cineT);
    if (e.cineRole === 'shover') {
      // hold the two-handed rifle-hold arms forward (the grab) — a static clip, no walk cycle — and
      // CREEP forward to stay at grab distance as the victim sinks (reads as leaning into the shove).
      e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;
      const B = state.cinematic && state.byId[state.cinematic.b];
      if (B) {
        const dx = B.transform.pos[0] - e.transform.pos[0], dy = B.transform.pos[1] - e.transform.pos[1], dl = Math.hypot(dx, dy) || 1e-6;
        const gap = (((e.collideVol && e.collideVol.a) || 2) + ((B.collideVol && B.collideVol.a) || 2)) * 1.05;
        const over = dl - gap; if (over > 0.15) { e.transform.pos[0] += (dx / dl) * over * 0.12; e.transform.pos[1] += (dy / dl) * over * 0.12; }
      }
    } else {
      // the shoved suit stands idle for the first ~20% (the grab), then is SHOVED DOWN — the topple
      // clip driven 0→1 over the rest, held flat at the bottom.
      if (t < 0.2) { e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0; }
      else { e.locomotion = 'topple'; e.moving = true; e.gaitPhase = Math.min(1, (t - 0.2) / 0.7); }
    }
    if (e.cineT >= 1) {
      const wasShoved = e.cineRole === 'shoved';
      e.cineT = null; e.cineRole = null;
      if (e.cineLead) { e.cineLead = false; state.cinematic = null; }   // the lead clears the shared flag (camera eases back)
      if (wasShoved && Number.isFinite(e.poise)) {
        // RISE: hand the shoved suit to the shared getup primitive (invincible rise → back on its feet, rule resumes).
        e.staggerReturn = 'forward'; e.reactClip = 'getup'; e.reactDur = e.getupDur || (e.staggerDur || 1.3) * 1.4;
        e.staggerT = 0; e.downPauseT = null; e.locomotion = 'getup'; e.moving = true; e.gaitPhase = 0; e.invincible = true;
      } else {
        e.invincible = false; e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;   // the tackler returns to control
      }
    }
    return true;
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
      weapon: initWeapon(raw.weapon),   // firing/ammo state (null unless the entity is armed)
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
    // arena M3: an optional SEAT tag ('player' | 'opponent') the game-params seam reads — a level
    // world authors its FULL roster and the launcher's picks despawn the unpicked opponent seats.
    ent.seat = typeof raw.seat === 'string' ? raw.seat : null;
    // TEAM (faction) tag — opt-in `raw.team` (any stable id, e.g. 'a'/'b'). Absent → null, and every
    // team-aware seam below (target:'enemy', friendly-fire off + stagger, team-win) is a no-op, so a world with
    // no teams steps byte-identically. A tagged suit never hunts or damages a same-team suit, and the
    // match is won by the first team to killTarget rather than the first individual.
    ent.team = (typeof raw.team === 'string' && raw.team) ? raw.team : null;
    // paint-in-match LIVERIES (livery-ingame.plan.md): the setup pick swaps the piloted suit to the
    // chosen livery's baked figure. Preserve the authored list [{id,name,color,figure}] — __makeBody
    // pre-builds each figure as a hidden variant, __applyMatchParams swaps on the launcher pick.
    ent.liveries = Array.isArray(raw.liveries) ? raw.liveries.map((l) => ({ ...l })) : null;
    // hoist poise config off the body onto entity runtime (mirrors hitFlash/hits living on the ent).
    if (ent.body && Number.isFinite(ent.body.poise)) {
      ent.poiseMax = ent.body.poise;
      ent.poise = ent.body.poise;
      ent.poiseRegen = Number.isFinite(ent.body.poiseRegen) ? ent.body.poiseRegen : ent.body.poise * 0.35;   // poise/sec recovered when not reacting
      ent.staggerDur = Number.isFinite(ent.body.staggerDur) ? ent.body.staggerDur : 1.3;                     // sec: hit->buckle->slow-standup (the stagger lurch)
      ent.toppleDur = Number.isFinite(ent.body.toppleDur) ? ent.body.toppleDur : ent.staggerDur * 1.3;       // sec: the topple FALL (hit -> the heap)
      ent.getupDur = Number.isFinite(ent.body.getupDur) ? ent.body.getupDur : ent.staggerDur * 1.4;          // sec: the getup RISE (heap -> back on its feet)
      ent.wakeGuard = Number.isFinite(ent.body.wakeGuard) ? ent.body.wakeGuard : 0;                          // sec of post-knockdown invincibility (R20.4; 0 = none)
      ent.downPause = Number.isFinite(ent.body.downPause) ? ent.body.downPause : 2;                           // sec lying TOPPLED + vulnerable before the getup (i-frames start on the RISE)
      // R23 BOOST ARMOR: stun-resist LEVEL while boosting (each level halves incoming stun; lv1 →
      // a full-stun hit no longer breaks poise in one). Read by boostStunFactor at hit time, gated
      // on the live `e.boosting` the platform rule surfaces. Absent / 0 → no armor (unchanged).
      ent.boostArmor = Number.isFinite(ent.body.boostArmor) && ent.body.boostArmor > 0 ? ent.body.boostArmor : 0;
    }
    // SUIT-vs-SUIT collision volume (opt-in `body.collide`) — the hitbox-EGG principle reused for
    // MOVEMENT: an axis-aligned ellipsoid `{ a (lateral), c (vertical), cz? }`, feet-anchored (center =
    // pos + cz·up, cz default c) so a tall suit collides like a suit, not a fat sphere. A plain number
    // is an isotropic sphere (cz 0, centered at pos). Absent → the body is non-solid to other bodies
    // (byte-identical to pre-collision worlds). Consumed by stepBodyCollisions.
    const cv = ent.body && ent.body.collide;
    if (cv && typeof cv === 'object' && Number.isFinite(cv.a) && cv.a > 0 && Number.isFinite(cv.c) && cv.c > 0) {
      ent.collideVol = { a: cv.a, c: cv.c, cz: Number.isFinite(cv.cz) ? cv.cz : cv.c };
    } else if (Number.isFinite(cv) && cv > 0) {
      ent.collideVol = { a: cv, c: cv, cz: 0 };
    }
    // HP MAX: capture the body's starting hp once (weapons/melee/projectiles chip `body.hp` in place,
    // floored at 0, never healed), so the health-bar HUD has a denominator. Current hp stays on
    // `body.hp`; this is the max. Absent hp → no bar (byte-identical).
    if (ent.body && Number.isFinite(ent.body.hp) && ent.body.hp > 0) ent.hpMax = ent.body.hp;
    // R19 SHIELD: a frontal, flankable, DESTRUCTIBLE damage buffer (body.shield = { hp, arc? }).
    // Runtime state rides the entity (like poise); no regen — once broken it stays destroyed.
    const sh = ent.body && ent.body.shield;
    if (sh && Number.isFinite(sh.hp)) {
      ent.shieldMax = sh.hp; ent.shieldHp = sh.hp;
      ent.shieldArc = Number.isFinite(sh.arc) ? sh.arc * Math.PI / 180 : Math.PI * 0.6;   // covered arc (deg→rad; default 108°)
      ent.shieldBroken = false; ent.shieldBreakAt = -1;
    }
    // LOADOUT init (weapon cycling): one weapon-state slot per config, pre-built so ammo/reload
    // persist across switches; slot 0 starts active (its figure wins over any body.figure typo).
    const lo = ent.rule && Array.isArray(ent.rule.loadout) && ent.rule.loadout.length ? ent.rule.loadout : null;
    if (lo) {
      ent.loadoutIdx = 0;
      ent.loadoutWeapons = lo.map((c) => initWeapon(c && c.weapon ? c.weapon : null));
      ent.weapon = ent.loadoutWeapons[0];
      if (ent.body && lo[0].figure) ent.body.figure = lo[0].figure;
    }
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
    // MATCH (opt-in `spec.match`, mobile-suit-arena.plan.md M1): the world becomes a scored bout —
    // kills are credited (lastHitBy attribution), the fallen RESPAWN, and the first CONTENDER to
    // `killTarget` ends it. A contender is any hittable entity with hp + poise (it can die AND be
    // credited); worlds without `match` keep death-is-final, byte-identical.
    let match = null;
    if (spec.match && typeof spec.match === 'object') {
      match = {
        // PRACTICE (opt-in): a bout that never ends and never destroys — every contender gets
        // `noDestroy` below, so a killing blow topples the suit and refills its bar instead of
        // downing it (armReaction / beginTackleCounter). Kills never credit, m.over never sets.
        practice: !!spec.match.practice,
        killTarget: Math.max(1, Math.round(spec.match.killTarget ?? 5)),
        respawnDelay: Number.isFinite(spec.match.respawnDelay) ? spec.match.respawnDelay : 3,
        iFrames: Number.isFinite(spec.match.iFrames) ? spec.match.iFrames : 2,   // spawn protection (sec) — time-based, superseded by fireGuard
        // SPAWN DROP-IN (R24, opt-in): units fall from the sky onto their spawn instead of popping in.
        // `dropHeight` = units above the spawn point to lift them; `dropSpeed` = descent u/s. Ground
        // only (a space spawn has no ground to hit → instant). Control is suppressed until the suit
        // lands; the drop pose is `leap` with the thrusters lit.
        dropHeight: Number.isFinite(spec.match.dropHeight) ? Math.max(0, spec.match.dropHeight) : 0,
        dropSpeed: Number.isFinite(spec.match.dropSpeed) && spec.match.dropSpeed > 0 ? spec.match.dropSpeed : 0,
        // FIRE-GATED SPAWN GUARD (R24, opt-in): the fresh suit is INVINCIBLE from spawn (through the
        // drop and after landing) until it FIRES its weapon — then protection drops. Replaces the
        // time-based `iFrames` when set. Works in space too (no drop, but the fire-gated shield holds).
        fireGuard: !!spec.match.fireGuard,
        // R26: the fire-guard is also CAPPED (anti-camp) — if the fresh suit never shoots, the shield
        // still expires after `fireGuardMax` sec (default 5). The cap counts down only once the suit can
        // ACT (not while it's still dropping in), so the drop never eats the usable protection window.
        fireGuardMax: Number.isFinite(spec.match.fireGuardMax) && spec.match.fireGuardMax > 0 ? spec.match.fireGuardMax : 5,
        spawns: Array.isArray(spec.match.spawns) && spec.match.spawns.length ? spec.match.spawns.map((s) => vcopy(s)) : null,
        names: spec.match.names && typeof spec.match.names === 'object' ? { ...spec.match.names } : null,   // id → display name (HUD)
        teamNames: spec.match.teamNames && typeof spec.match.teamNames === 'object' ? { ...spec.match.teamNames } : null,   // team id → display name (HUD banner)
        kills: {}, stats: {}, feed: [], over: false, winner: null, endedAt: 0,
        // TEAM MODE (derived below, never counted): set when the contenders span ≥2 teams.
        teamMode: false, teamOf: null, teamKills: null, winnerTeam: null,
      };
      for (const e of entities) {
        if (!e.isCamera && e.body && e.body.hittable && Number.isFinite(e.hpMax) && Number.isFinite(e.poiseMax)) {
          match.kills[e.id] = 0;
          // the SCORE-SCREEN row (deaths / hull damage dealt / ranged rounds fired / rounds on
          // target) — accumulated at the adjudication sites, reported once in the outcome envelope.
          match.stats[e.id] = { deaths: 0, dmg: 0, shots: 0, hits: 0 };
        }
      }
      // TEAM MODE: if the contenders span two-or-more `team` tags, the bout is won by TEAM — a kill
      // credits the killer's team and the first TEAM to killTarget ends it (stepMatchInner). One team
      // (or none) keeps the per-individual win, byte-identical. Derived from the tags, never counted.
      // PRACTICE: mark every contender indestructible — the flag rides the entity because the
      // adjudication sites (armReaction, beginTackleCounter) don't receive world state.
      if (match.practice) { for (const e of entities) if (!e.isCamera && match.kills[e.id] != null) e.noDestroy = true; }
      const teamSet = new Set();
      for (const e of entities) { if (!e.isCamera && match.kills[e.id] != null && e.team) teamSet.add(e.team); }
      if (teamSet.size >= 2) {
        match.teamMode = true;
        match.teamOf = {};
        match.teamKills = {};
        for (const tm of teamSet) match.teamKills[tm] = 0;
        for (const e of entities) { if (!e.isCamera && match.kills[e.id] != null && e.team) match.teamOf[e.id] = e.team; }
      }
    }
    // SPAWN DROP-IN / FIRE-GUARD at match start: lift every contender into the sky (ground) and arm
    // the fire-gated invincibility, so the bout OPENS with everyone dropping in (respawns reuse the
    // same helper). Applied here so createWorld's returned state is already mid-drop on frame 0.
    if (match && (match.dropHeight > 0 || match.fireGuard)) {
      for (const e of entities) if (!e.isCamera && match.kills[e.id] != null) applySpawnProtect(e, match);
    }
    // WRECK FINISHER (opt-in `spec.wreckExplodes`): the death burst is DEFERRED until the topple
    // FALL settles (+ a `delay` linger), then the wreck DETONATES and VANISHES — the finisher reads
    // fall → boom → gone, instead of the default instant blast that leaves the wreck lying where it
    // fell. In a NON-MATCH world the vanish is terminal (death is final). In a MATCH world it rides
    // ALONGSIDE the corpse-window → respawn lifecycle: the kill still credits at the downed edge
    // (stepMatch, unchanged), the fall + linger + blast play out during the corpse window, the wreck
    // vanishes, and respawnEntity then clears `gone` and returns the suit — so an arena death reads
    // topple → detonate → gone → respawn (tune `delay` under the match's respawnDelay).
    const wreckExplodes = spec.wreckExplodes
      ? { delay: Number.isFinite(spec.wreckExplodes.delay) ? Math.max(0, spec.wreckExplodes.delay) : 0.5 }
      : null;
    return { entities, byId, camera, pilotId, spectate, aiEnabled: spec.ai !== 'off', aiTuning: AI_DIFFICULTY[spec.aiDifficulty] || null, colliders: normalizeColliders(spec.colliders), match, wreckExplodes, time: 0, projectiles: [], bursts: [], projSeq: 0, burstSeq: 0, clashes: [], clashSeq: 0, shieldBreaks: 0, cinematic: null };
  }

  // stepReaction(e, input, dt) — the hit-reaction pass, run for EVERY entity before its rule so it
  // gates any rule uniformly (the ambient clock enemy AND a piloted platform unit react the same
  // way). Jobs: regenerate poise while upright, advance the active reaction, and hold the terminal
  // DOWNED state. A reaction is a SEQUENCE of clips advanced by staggerT (0→1 per segment): stagger
  // is one segment (the lurch); a TOPPLE is three beats — the `topple` FALL, a flat vulnerable
  // toppled hold, then the `getup` RISE every suit stands back up with. While reacting it OVERRIDES locomotion
  // to the current clip and returns true to SUPPRESS the entity's rule + weapon — "they can't act
  // while reeling." The stagger-cancel seam (e.staggerCancel — heavy-armor poise-through / boost
  // break-out) ends a stagger early; it does NOT interrupt a topple fall/getup (you're committed to
  // going down and getting up) or a downed unit (death is final).
  // beginDodge(e, input, r) — commit an acrobatic dodge NOW: the same roll the platform rule fires on
  // a double-tap of F (identical clip selection + gauge cost / overheat). Extracted so a STAGGER can be
  // dodge-cancelled (stepReaction) with the exact same maneuver. Direction reads the held WASD at the
  // commit frame; `dodge:'twirl'` bodies roll the single grounded twirl.
  function beginDodge(e, input, r) {
    const hasGauge = r.boostMax > 0;
    const dodgeCost = r.dodgeBoostCost ?? 2;
    const dodgeOverheats = hasGauge && dodgeCost > 0 && (r.dodgeOverheat ?? true);
    const t = e.transform, f = fwdXY(t.heading), rt = rightXY(t.heading);
    const lookMode = r.space === true || (r.turnMode ?? 'tank') !== 'tank';
    const sideIn = clamp(input.strafe + (lookMode ? input.turn : 0), -1, 1);
    const fwdH = input.forward, sdH = sideIn;
    e.dodgeT = 0; e.fTapWin = 0; e.dodgeSpent = false;
    if (!dodgeOverheats) e.dodgeCdT = r.dodgeCooldown ?? 8;
    e.dodgeCount = (e.dodgeCount || 0) + 1;
    if (dodgeOverheats) { e.boost = 0; e.boostLock = true; }
    else if (hasGauge && dodgeCost > 0) e.boost = Math.max(0, e.boost - dodgeCost);
    if (r.dodge === 'twirl') { e.dodgeClip = 'dodge_twirl'; e.dodgeKind = 'spin'; e.dodgeSign = 1; }   // bulky/hover suits: one grounded twirl, any direction
    else if (Math.abs(sdH) > Math.abs(fwdH) && Math.abs(sdH) > 0.3) { e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sdH < 0 ? -1 : 1; }
    else if (fwdH < -0.3) { e.dodgeClip = 'dodge_backflip'; e.dodgeKind = 'back'; e.dodgeSign = 1; }
    else { e.dodgeClip = 'dodge_roll'; e.dodgeKind = 'fwd'; e.dodgeSign = 1; }   // forward, NEUTRAL, and diagonal-forward → forward roll (the neutral spin/twirl is gone)
    // the DASH goes the true (diagonal-capable) input direction; a neutral roll (no stick) rolls forward.
    const dx = f[0] * fwdH + rt[0] * sdH, dy = f[1] * fwdH + rt[1] * sdH;
    const dl = Math.hypot(dx, dy);
    e.dodgeDir = dl > 1e-3 ? [dx / dl, dy / dl] : [f[0], f[1]];
  }

  function stepReaction(e, input, dt) {
    if (e.poise == null) return false;                 // opt-in: only poise-bearing suits react
    // WAKE GUARD (R20.4, opt-in body.wakeGuard sec): fresh off a KNOCKDOWN the suit is
    // UNTOUCHABLE while the timer runs — the anti-juggle window that pays for the longer getup.
    // Asserted per frame (a dodge ending mid-guard can't strip it); every hit adjudicator
    // already skips invincible targets.
    if (e.wakeGuardT > 0) {
      e.wakeGuardT = Math.max(0, e.wakeGuardT - dt);
      e.invincible = e.wakeGuardT > 0;
    }
    if (e.staggerT == null) {
      if (e.poise < e.poiseMax) e.poise = Math.min(e.poiseMax, e.poise + (e.poiseRegen || 0) * dt);
      return false;
    }
    const inKnockdown = e.reactClip === 'topple' || e.reactClip === 'downpause' || e.reactClip === 'getup';
    // DODGE-CANCEL (operator): a dodge roll BREAKS OUT of a plain stagger. The PILOT (a platform rule
    // with dodge) double-tapping F while staggering — IF the thruster can pay for a roll — cancels the
    // reaction and commits the roll THIS frame (via the staggerCancel seam just below). All the normal
    // dodge rules apply: the double-tap, the boost cost, the overheat dump. Only a PLAIN stagger (never
    // a topple / getup knockdown or a downed frame), and only if you have the boost to spend — a dead
    // bar means you eat the stagger. The F-tap window is tracked here (the rule is suppressed mid-
    // stagger, so it hands the tracking off to this block and back, sharing e.fTapWin / e.boostPrev).
    if (!inKnockdown && !e.downed && e.reactClip === 'stagger' && e.dodgeT == null
        && e.rule && e.rule.type === 'platform' && (e.rule.dodge === true || e.rule.dodge === 'twirl')
        && (e.grounded || e.rule.space === true)) {
      const rr = e.rule;
      const boostEdge = !!input.boost && !e.boostPrev;
      e.boostPrev = !!input.boost;
      const hasGauge = rr.boostMax > 0, dodgeCost = rr.dodgeBoostCost ?? 2;
      const canDodge = !hasGauge || dodgeCost <= 0 || (e.boost >= dodgeCost && !e.boostLock);
      if (boostEdge && (e.fTapWin ?? 0) > 0 && canDodge) { e.staggerCancel = true; beginDodge(e, input, rr); }
      else if (boostEdge) { e.fTapWin = rr.doubleTapWindow ?? 0.28; }
      if ((e.fTapWin ?? 0) > 0) e.fTapWin = Math.max(0, e.fTapWin - dt);
    }
    if (e.staggerCancel && !e.downed && !inKnockdown) { e.staggerT = null; e.staggerCancel = false; e.locomotion = e.staggerReturn || 'forward'; e.invincible = false; return false; }
    if (e.reactClip === 'downpause') {   // backward-compatible old state: fold into the toppled flat hold.
      const hold = e.downPause ?? 2;
      e.reactClip = 'topple'; e.downPauseT = e.downPauseT ?? Math.min(hold, (e.staggerT || 0) * hold); e.staggerT = 1;
    }
    if (e.reactClip === 'topple' && e.downPauseT != null) {
      e.downPauseT += dt;
      if (e.downPauseT >= (e.downPause ?? 2)) {
        // the toppled punish window finished → chain into the `getup` rise, the shared recovery primitive.
        // The i-frames trigger HERE, as the rise begins, not while flat on the ground.
        e.reactClip = 'getup'; e.reactDur = e.getupDur || (e.staggerDur || 1.3) * 1.4; e.staggerT = 0; e.downPauseT = null;
        e.locomotion = 'getup'; e.moving = true; e.gaitPhase = 0; e.invincible = true; return true;
      }
      e.staggerT = 1; e.locomotion = 'topple'; e.moving = true; e.gaitPhase = 1; e.invincible = false; return true;
    }
    e.staggerT += dt / (e.reactDur || e.staggerDur || 1.3);
    if (e.staggerT >= 1) {
      if (e.reactClip === 'topple') {
        // the topple FALL finished — the unit is now FLAT on the ground (topple ends
        // at TOPPLE_FLAT, so gaitPhase 1 IS the felled frame). A DOWNED (hp≤0) unit
        // HOLDS it forever — the wreck lies where it fell.
        if (e.downed) { e.staggerT = 1; e.locomotion = 'topple'; e.moving = true; e.gaitPhase = 1; e.invincible = false; return true; }
        // an alive unit stays TOPPLED + VULNERABLE for `downPause` sec before the rise — the
        // i-frames start on the getup, NOT here, so a floored suit can be punished for two beats.
        e.downPauseT = 0; e.staggerT = 1;
        e.locomotion = 'topple'; e.moving = true; e.gaitPhase = 1; e.invincible = false; return true;
      }
      // stagger or getup finished → back on its feet, rule resumes.
      // `reactionEnded` is the recovery EDGE a brain rule consumes (the ai dodge-rolls out on it);
      // rules that don't read it just leave it set until the next reaction overwrites it.
      // Rising from a KNOCKDOWN (getup, not a plain stagger) arms the wake guard: `wakeGuard`
      // seconds of invincibility so the floored suit can't be chain-juggled off the ground.
      const rose = e.reactClip === 'getup';
      e.staggerT = null; e.downPauseT = null; e.locomotion = e.staggerReturn || 'forward'; e.reactionEnded = true;
      if (rose && e.wakeGuard > 0) { e.wakeGuardT = e.wakeGuard; e.invincible = true; }
      else e.invincible = false;
      return false;
    }
    e.locomotion = e.reactClip || 'stagger'; e.moving = true; e.gaitPhase = e.staggerT;   // the rooted reaction clip
    e.invincible = (e.reactClip === 'getup');   // i-frames only while getting up (not the fall, the pause, or a stagger)
    return true;
  }

  // applySpawnProtect(e, m) — arm a fresh spawn (R24): the DROP-IN (lift into the sky, fall under
  // stepDrop, control back on landing — ground only) + the spawn INVINCIBILITY. When `m.fireGuard`
  // the protection is FIRE-GATED (invincible until the suit shoots, cleared in stepWeapon / on a
  // melee swing); else it falls back to the time-based `iFrames` wake-guard. Called at match start
  // (createWorld) and on every respawn.
  function applySpawnProtect(e, m) {
    if (!m) return;
    const t = e.transform;
    const r = e.pilotRule || e.rule || {};
    const isSpace = !!r.space;
    if (m.dropHeight > 0 && !isSpace) {
      e.dropTargetZ = t.pos[2];                 // the current pos IS the resting spawn point
      t.pos[2] = e.dropTargetZ + m.dropHeight;  // lift into the sky; stepDrop falls it back
      e.vel = [0, 0, 0];
      e.dropping = true; e.grounded = false;
      e.dropSpeed = m.dropSpeed > 0 ? m.dropSpeed : Math.max(1, m.dropHeight) * 0.6;   // ~1.7s default
      e.locomotion = 'leap'; e.moving = true; e.thrust = 1; e.gaitPhase = 0;
    } else {
      e.dropping = false;
    }
    if (m.fireGuard) { e.spawnGuard = true; e.invincible = true; e.spawnGuardT = m.fireGuardMax ?? 5; }   // R26: armed with the anti-camp cap
    else if (m.iFrames > 0) { e.wakeGuardT = m.iFrames; e.invincible = true; }
  }

  // stepDrop(e, dt) — the SPAWN DROP-IN descent (R24). While `e.dropping`, the suit falls straight
  // down toward `e.dropTargetZ` at `e.dropSpeed`, posed in the airborne `leap` with thrusters lit,
  // its rule + weapon SUPPRESSED (no control mid-air). On the frame it lands it clears `dropping` and
  // returns false, so the rule runs that same frame — control is back "as soon as it hits ground".
  // Invincibility (spawnGuard) rides through the drop and past the landing until the first shot.
  function stepDrop(e, dt, world) {
    if (!e.dropping) return false;
    const t = e.transform;
    const target = Number.isFinite(e.dropTargetZ) ? e.dropTargetZ : 0;
    t.pos[2] = Math.max(target, t.pos[2] - (e.dropSpeed || 0) * dt);
    e.grounded = false; e.locomotion = 'leap'; e.moving = true; e.thrust = 1; e.gaitPhase = 0; e.vel = [0, 0, 0];
    if (t.pos[2] <= target + 1e-6) {
      // Land on the ACTUAL surface under the feet via the live ground raycast, not the precomputed
      // dropTargetZ. The target is a mint-time point sample that rarely equals the wavy drape, so trusting
      // it lands the suit a few units ABOVE the real surface — then the rule free-falls that gap, which at
      // a low framerate can tunnel (see the platform touchdown sweep). Probing the live ground here lands
      // the suit truly grounded, flush on the surface, every drop. No hook / a void → keep the raw target.
      const eye = (e.pilotRule || e.rule || {}).eye ?? 0;
      const step = (e.rule && Number.isFinite(e.rule.step)) ? e.rule.step : 0.35;
      const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], target + step]) : null;
      t.pos[2] = gz != null ? gz + eye : target;
      e.dropping = false; e.grounded = true;
      e.locomotion = 'forward'; e.moving = false; e.thrust = 0;
      return false;   // landed this frame → the rule runs, control returns
    }
    return true;       // still falling → suppress the rule
  }

  // respawnEntity(e, state) — a fresh life in a MATCH world: full hp/poise/ammo/gauge/shield, spawn
  // protection riding the existing wake-guard machinery, all volatile maneuver state cleared. The
  // spawn point is the declared spawn FARTHEST from any living contender (deterministic; ties break
  // by index) so nobody respawns into the muzzle that just killed them; no declared spawns → the
  // entity's authored start pose.
  function respawnEntity(e, state) {
    const m = state.match;
    let at = e.spawn ? e.spawn.pos : e.transform.pos;
    const heading = e.spawn ? e.spawn.heading : e.transform.heading;
    if (m.spawns) {
      let best = -1, bestD = -1;
      for (let i = 0; i < m.spawns.length; i++) {
        const s = m.spawns[i];
        let dmin = Infinity;
        for (const o of state.entities) {
          if (o === e || o.isCamera || o.downed || !(o.body && o.body.hittable)) continue;
          const dx = o.transform.pos[0] - s[0], dy = o.transform.pos[1] - s[1];
          const d = dx * dx + dy * dy;
          if (d < dmin) dmin = d;
        }
        if (dmin > bestD) { bestD = dmin; best = i; }
      }
      if (best >= 0) at = m.spawns[best];
    }
    e.transform.pos = [at[0], at[1], at[2] || 0];
    e.transform.heading = heading; e.transform.pitch = 0;
    e.vel = [0, 0, 0];
    if (Number.isFinite(e.hpMax)) e.body.hp = e.hpMax;
    if (Number.isFinite(e.poiseMax)) e.poise = e.poiseMax;
    e.body.hittable = true;                // the corpse window (stepMatch) made it untargetable
    e.staggerT = null; e.downPauseT = null; e.downed = false; e.deadAt = null; e.lastHitBy = null; e.reactionEnded = false; e.deathBurstDone = false;
    e.gone = false; e.settledAt = null;    // wreck finisher: clear the vanish so the respawned body renders + retargets again
    e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;
    e.swingT = null; e.dodgeT = null; e.tumble = null; e.dashVel = null;
    e.comboT = 0; e.swingCombo = false; e.strikeCdT = 0; e.readyT = 0; e.aiFire = 0;
    e.boostCut = false; e.boosting = false; e.hovering = false; e.spawnGuard = false; e.dropping = false;
    // full kit: every carried magazine refilled, cooldowns cold, the shield reforged (a new life
    // gets the whole loadout — the no-regen shield rule is per-life, not per-match).
    const rearm = (w) => { if (w) { w.ammo = w.magazine; w.cooldownT = 0; w.reloading = false; w.reloadT = 0; w.burstLeft = 0; cancelWeaponCharge(w); if (w.energyMax > 0) { w.energy = w.energyMax; w.energyLock = false; } } };
    if (e.loadoutWeapons) e.loadoutWeapons.forEach(rearm); else rearm(e.weapon);
    if (Number.isFinite(e.shieldMax)) { e.shieldHp = e.shieldMax; e.shieldBroken = false; }
    const bm = (e.pilotRule && e.pilotRule.boostMax) || (e.rule && e.rule.boostMax);
    if (Number.isFinite(bm) && bm > 0) { e.boost = bm; e.boostLock = false; }   // a fresh life's full bar = boost + dodge ready
    applySpawnProtect(e, m);   // R24: drop-in from the sky (ground) + fire-gated / timed spawn protection
  }

  // stepMatch(state) — the MATCH layer (opt-in `spec.match`): scan for entities that FELL this
  // frame (downed edge), credit the kill to the last hitter (feed line kept short for the HUD),
  // open the corpse window (unhittable while down — no farming the wreck), end the match when a
  // contender reaches killTarget, and respawn the fallen after respawnDelay while the match runs.
  // Runs after all of the frame's damage adjudication (rules + weapons + melee + projectiles).
  //
  // SELF-QUARANTINE (fault containment): the match layer is ADDITIVE game logic over the sim —
  // if it ever throws, the error is reported ONCE and the layer disables itself for the session
  // (state.match.dead), so a scoring bug degrades to "the bout stops being scored" while the
  // world keeps stepping. The core sim stays loud; only this opt-in layer eats its own faults.
  function stepMatch(state) {
    try { stepMatchInner(state); } catch (err) {
      if (state.match && !state.match.dead) { state.match.dead = true; console.error('match layer disabled after error:', err); }
    }
  }
  function stepMatchInner(state) {
    const m = state.match;
    if (!m || m.dead) return;
    for (const e of state.entities) {
      if (e.isCamera || m.kills[e.id] == null) continue;   // contenders only
      if (e.downed && e.deadAt == null) {
        e.deadAt = state.time;
        e.body.hittable = false;   // the corpse window: a wreck takes no further hits
        if (m.stats && m.stats[e.id]) m.stats[e.id].deaths += 1;   // score screen: the fall is counted even when unattributed
        const killer = e.lastHitBy && e.lastHitBy !== e.id ? e.lastHitBy : null;
        if (killer != null) {
          m.kills[killer] = (m.kills[killer] || 0) + 1;
          m.feed.push({ killer, victim: e.id, t: state.time });
          if (m.feed.length > 6) m.feed.shift();
          if (m.teamMode) {
            // TEAM win: credit the killer's team (friendly fire is off, so every credited kill is an
            // enemy kill), first team to killTarget takes the bout. `winner` still holds the finishing
            // pilot for the kill-feed; `winnerTeam` is the victor the banner/score screen read.
            const kt = m.teamOf[killer];
            if (kt) {
              m.teamKills[kt] = (m.teamKills[kt] || 0) + 1;
              if (!m.over && m.teamKills[kt] >= m.killTarget) { m.over = true; m.winner = killer; m.winnerTeam = kt; m.endedAt = state.time; }
            }
          } else if (!m.over && m.kills[killer] >= m.killTarget) { m.over = true; m.winner = killer; m.endedAt = state.time; }
        }
      }
      if (!m.over && e.deadAt != null && state.time - e.deadAt >= m.respawnDelay) respawnEntity(e, state);
    }
  }

  // stepWorld(state, input, dt, hooks) — advance every entity one frame. Non-camera rules run first
  // (so a follow camera reads updated targets), then cameras. `hooks` supplies renderer seams:
  // `hooks.physics(dt)` steps the shared integrator (physics-rule entities read their body back),
  // `hooks.ground(pos)` returns terrain height for walk. Mutates and returns `state`.
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

  function stepWorld(state, input, dt, hooks) {
    dt = dt || 1 / 60;
    input = readInput(input);
    hooks = hooks || {};
    // MATCH OVER: the bout is decided — controls go dead and the ai stands down (below), so the
    // world settles into the result tableau (final topple plays out, walkers idle) instead of
    // fighting on past the fifth kill. Deterministic: a zeroed input is just another input.
    if (state.match && state.match.over) input = readInput(null);
    if (hooks.physics) hooks.physics(dt);
    // AI ATTACK TOGGLE: G press edge flips the world-level switch the ai ambients gate on.
    if (input.aiToggle) state.aiEnabled = state.aiEnabled === false;
    // SUIT SWITCHER: `input.swap` (T press edge) transfers the pilot to the next pilotable
    // entity. The vacated suit drops to its ambient rule where it stands (volatile pilot state
    // cleared so it stands clean); the possessed one takes its pilot rule — loadout, tuning and
    // all. A follow camera tracking the old pilot retargets and eases over. Gated while the
    // current pilot is mid-swing / mid-dodge / charging / airborne — those own the body.
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
    const world = { byId: state.byId, ground: hooks.ground || null, colliders: state.colliders || null, pilotId: state.pilotId || null, aiEnabled: state.aiEnabled !== false && !(state.match && state.match.over), aiTuning: state.aiTuning || null, get cinematic() { return state.cinematic; } };
    // MOVING-PLATFORM CARRY (setup): snapshot each carrier's pre-step position so the post-pass below
    // can inherit its per-tick horizontal delta to grounded riders. No carriers → a no-op.
    for (const e of state.entities) { if (e.body && e.body.carrier) e._carryFrom = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2]]; }
    for (const e of state.entities) {
      if (e.isCamera) continue;
      // R20.3: passive weapon timers tick for EVERY carried weapon, every frame — stowed loadout
      // slots keep reloading / cooling down, and a stagger doesn't pause the autoloader. (With a
      // loadout, e.weapon aliases a loadoutWeapons entry, so only one of the two paths runs.)
      if (e.loadoutWeapons) { for (const lw of e.loadoutWeapons) tickWeapon(lw, dt); }
      else if (e.weapon) tickWeapon(e.weapon, dt);
      // R20.5: the melee swing cooldown is the same kind of machinery — drains between swings,
      // through staggers, stows, and pilot transfers alike.
      if (e.swingT == null && e.strikeCdT > 0) e.strikeCdT = Math.max(0, e.strikeCdT - dt);
      if (e.dodgeT == null && e.dodgeCdT > 0) e.dodgeCdT = Math.max(0, e.dodgeCdT - dt);   // dodge recovery (2026-07-27)
      if (e.readyT > 0) e.readyT = Math.max(0, e.readyT - dt);   // switch ready-time (2026-07-28) — ticks even mid-reload (the windows overlap)
      const staggered = stepReaction(e, input, dt);    // hit reaction first; a staggered unit's rule + weapon are suppressed
      const clashing = stepClash(e, dt, state);        // CLASH lock (2026-07-28): owns the body like a stagger — invincible blade-lock, then the shove
      const cine = stepTackleCine(e, dt, state);       // TACKLE-COUNTER CINEMATIC: the shove-down set piece owns the body (invincible), like a clash
      const dropping = stepDrop(e, dt, world);         // SPAWN DROP-IN (R24): falling from the sky suppresses control until it lands (lands on the live ground raycast)
      if (e.weapon && (staggered || dropping || clashing || cine)) cancelWeaponCharge(e.weapon);
      if (e.spawnGuard) {                              // fire-gated spawn protection holds until the suit shoots (cleared on fire, below)
        e.invincible = true;
        // R26: capped — decay only once it can act (not mid-drop), so an un-fired shield still expires.
        if (!dropping) { e.spawnGuardT -= dt; if (e.spawnGuardT <= 0) { e.spawnGuard = false; e.invincible = false; } }
      }
      const fn = RULES[e.rule.type];
      const ranRule = fn && !staggered && !dropping && !clashing && !cine;
      if (ranRule) fn(e, input, dt, world);
      else tickBoostRecovery(e, dt);   // rule owns the gauge when it runs; suppressed (reeling / dropping / clashing) the thruster still recharges — the boost/overheat analog of the autoloader
      // fire AFTER the rule (aim reads the updated heading/pitch). Input is GLOBAL, so an armed
      // pilotable suit only consumes the trigger while it IS the pilot — the vacated suit must
      // not drain its magazine (or land hits) every time the piloted one fires. An AI-ruled
      // entity fires from its OWN trigger (`e.aiFire`, the ai rule's decision) and NEVER from
      // the global input — the no-ghost-fire invariant kept in both directions. A DROPPING suit
      // can't fire (control is suppressed mid-air), so its spawn guard can't break until it lands.
      const firesForPilot = !e.pilotable || state.pilotId === e.id;
      if (e.weapon && !staggered && !dropping && !clashing && !cine && e.rule && e.rule.type === 'ai') stepWeapon(e, { fire: e.aiFire ? 1 : 0 }, dt, state);
      else if (e.weapon && !staggered && !dropping && !clashing && !cine && e.tackleT == null && firesForPilot) stepWeapon(e, input, dt, state);   // a tackle owns the body — no firing mid-charge
      if (e.swingT != null && !staggered && !dropping && !cine) stepMelee(e, dt, state);   // melee connect adjudication (the saber swing)
      if (e.tackleT != null && !staggered && !dropping && !clashing && !cine) stepTackle(e, dt, state);   // TACKLE body-check adjudication (the shift dash)
    }
    // SUIT-vs-SUIT solidity (opt-in body.collide): separate overlapping bodies so suits can't fly
    // through each other. After the rules move everyone, before projectiles/cameras read positions.
    stepBodyCollisions(state);
    stepCarry(state);   // moving-platform carry: grounded riders inherit their carrier's horizontal motion
    // R14: advance in-flight projectiles + adjudicate bursts (after all entities move, before cameras).
    if (!state.projectiles) { state.projectiles = []; state.bursts = []; state.projSeq = 0; state.burstSeq = 0; }
    if (!state.clashes) { state.clashes = []; state.clashSeq = 0; }   // melee-clash-fx pool (legacy states)
    if (state.shieldBreaks == null) state.shieldBreaks = 0;
    stepProjectiles(state, dt);
    // DEATH BURST (R34): a downed unit explodes — after every damage adjudicator has run, before
    // the match layer credits the kill. Edge-latched per death; the match respawn clears the latch
    // with `downed`, so every life ends in its own blast. DEFAULT: instant on the downed edge (the
    // wreck then lies where it fell). WRECK FINISHER (`state.wreckExplodes`): the blast is HELD until
    // the topple FALL has settled (the wreck lies flat) + a `delay` linger, then it detonates AND the
    // wreck VANISHES (`gone` — hidden by the renderer, untargetable in the sim; a match respawn later
    // clears `gone`). The kill still credits at the downed edge (stepMatch), so deferring is visual.
    const wreckFin = state.wreckExplodes;
    for (const e of state.entities) {
      if (e.gone || !e.downed || e.deathBurstDone) continue;
      if (wreckFin) {
        if (!(e.reactClip === 'topple' && e.staggerT >= 1)) continue;   // topple fall not settled yet
        if (e.settledAt == null) e.settledAt = state.time;
        if (state.time - e.settledAt < wreckFin.delay) continue;        // lingering before the blow
      }
      e.deathBurstDone = true;
      explodeUnit(state, e);
      if (wreckFin) { e.gone = true; if (e.body) e.body.hittable = false; }   // the wreck is removed the frame it detonates
    }
    stepMatch(state);   // after ALL damage adjudication this frame (weapons + melee + projectiles)
    if (state.camera) {
      const fn = RULES[state.camera.rule.type];
      if (fn) fn(state.camera, input, dt, world);
    }
    state.time += dt;
    return state;
  }

  // ── figure delivery math (renderer-ladder.plan.md, Phase 2 rung 1) ────────────────────────────
  // The gait rules above WRITE gaitPhase/locomotion/moving; these two pure helpers are how a
  // figure-frames body READS them smoothly. Baked figure clips have fixed topology (same corner
  // list every frame — the invariant packFigureFrames relies on), so the renderer can lerp corner
  // positions between a frame PAIR instead of snapping to floor(phase·N), and crossfade between
  // locomotion modes (forward↔strafe↔idle) instead of hard-switching geometry.

  // gaitFramePair(N, phase) → { i0, i1, t }: the two frames bracketing a continuous, wrapping
  // phase (negative phases wrap too — strafe left runs the same clip backwards) and the lerp
  // weight between them. N=1 degenerates to a static frame.
  function gaitFramePair(N, phase) {
    if (!(N > 1)) return { i0: 0, i1: 0, t: 0 };
    const ph = ((phase % 1) + 1) % 1;
    const x = ph * N;
    const i0 = Math.min(N - 1, Math.floor(x));
    return { i0, i1: (i0 + 1) % N, t: x - i0 };
  }

  // advanceGaitMix(mix, mode, phase, dt, blendTime) — crossfade bookkeeping between locomotion
  // modes. `mix` is per-body state the renderer owns ({} initially): { mode, phase, prevMode,
  // prevPhase, w }. On a mode switch the OUTGOING pose is frozen at its last phase and faded out
  // over `blendTime` seconds (default 0.18). w ∈ [0,1] is the incoming mode's weight; prevMode is
  // null once the fade completes. dt-driven, so fixed-step replay reproduces it exactly.
  function advanceGaitMix(mix, mode, phase, dt, blendTime) {
    const bt = blendTime > 0 ? blendTime : 0.18;
    if (!mix.mode) { mix.mode = mode; mix.phase = phase; mix.w = 1; mix.prevMode = null; return mix; }
    if (mode !== mix.mode) {
      mix.prevMode = mix.mode;
      mix.prevPhase = mix.phase;
      mix.mode = mode;
      mix.w = 0;
    }
    mix.phase = phase;
    if (mix.w < 1) {
      mix.w = Math.min(1, mix.w + (dt || 0) / bt);
      if (mix.w >= 1) mix.prevMode = null;
    }
    return mix;
  }

  // hitEgg rides the export so the renderer's target-acquired reticle (channels.js __aimLocked)
  // adjudicates with the ENGINE'S OWN ray-vs-egg — the HUD can never be more forgiving than the shot.
  return { RULES, normalizeEntity, createWorld, stepWorld, fwdXY, rightXY, gaitFramePair, advanceGaitMix, hitEgg, AI_DIFFICULTY };
}

// ── standalone `controllable` world kind ─────────────────────────────────────────────────────────
// Most controllable worlds RIDE on an existing kind (a figure walking a stored city). This assembler
// is for the standalone case: a bare stage (a floor, or caller-supplied `faces`) that exists only to
// host entities, so an entities-only manifest renders without piggybacking on another kind. NOT part
// of the browser-emitted closure — it builds server-side faces like every other assemble*Scene.
// (The import is server-side only, like this whole section — buildControllable stays import-free.)
// engine→mobile-suit seam (extraction.plan.md): the atmosphere regrade lives in the content
// pack, loaded LAZILY and CONTAINED — pack absent, the no-op mirrors the function's own
// "no manifest.atmosphere" null return, so un-keyed worlds are byte-identical either way.
let applyArenaAtmosphere = () => null;
try {
  ({ applyArenaAtmosphere } = await import('../mobile-suit/arena-atmosphere.js'));
} catch (err) { console.error('mobile-suit pack absent — atmosphere keying disabled:', err?.message); }
function defaultGround(spec = {}) {
  const size = spec.size || 40, cell = spec.cell || 4, n = Math.max(2, Math.round(size / cell));
  const a = spec.colorA || '#2f3b50', b = spec.colorB || '#3b4a64';
  const faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -size / 2 + i * cell, y = -size / 2 + j * cell;
    faces.push({ corners: [[x, y, 0], [x + cell, y, 0], [x + cell, y + cell, 0], [x, y + cell, 0]], fill: (i + j) % 2 ? a : b, doubleSided: true });
  }
  return faces;
}

/**
 * assembleControllableScene(manifest, opts) → payload for emitThreeWorld. The `entities` / `camera`
 * / `figures` are layered on by resolveWorldScene's controllable passthrough (same as on any kind);
 * this just provides the static stage + an initial camera framing.
 */
export function assembleControllableScene(manifest = {}, opts = {}) {
  let faces = Array.isArray(manifest.faces) && manifest.faces.length ? manifest.faces : defaultGround(manifest.ground || {});
  // opt-in atmosphere keying (arena-atmosphere.js): regrade the stage fills under a low warm
  // key + blue-shifted ambient, cast baked long-shadow decals off `colliders`, and derive a
  // matching sky + payload light. Absent `manifest.atmosphere` ⇒ byte-identical.
  const atmo = applyArenaAtmosphere(manifest, faces);
  if (atmo) faces = atmo.faces;
  const framing = manifest.worldFraming || manifest.framing || { cameraPosition: [14, -18, 10], lookAt: [0, 0, 1], horizontalFov: 60 };
  return {
    faces,
    cameras: [{ worldFraming: framing }],
    viewBox: manifest.viewBox || { width: 1120, height: 780 },
    title: opts.title || manifest.title || 'mojulo controllable world',
    bg: manifest.bg || '#0b1220',
    // opt-in sky (e.g. `{ space:true }` for a full-sphere starfield + void bg — the SPACE maps) —
    // additive; an explicit `manifest.sky` wins over the atmosphere-derived dome.
    ...(manifest.sky && typeof manifest.sky === 'object' ? { sky: manifest.sky }
      : (atmo && atmo.sky ? { sky: atmo.sky } : {})),
    ...(atmo && atmo.light ? { light: atmo.light } : {}),
  };
}

// Live node instance (tested in controllable-world.test.js). The browser runs
// buildControllable().toString() (Phase 3), so there is no second copy — keep them in sync via
// buildControllable only.
const _cw = buildControllable();
export const createWorld = _cw.createWorld;
export const stepWorld = _cw.stepWorld;
export const normalizeEntity = _cw.normalizeEntity;
export const gaitFramePair = _cw.gaitFramePair;
export const advanceGaitMix = _cw.advanceGaitMix;
export const RULES = _cw.RULES;
export const AI_DIFFICULTY = _cw.AI_DIFFICULTY;
