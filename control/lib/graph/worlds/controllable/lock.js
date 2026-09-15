/**
 * lock.js — TARGET LOCK (target-lock.plan.md, P1): the piloted entity locks onto a hittable and is
 * steered to face it; the follow camera may track the pair (rules-basic.js `lockTrack`).
 *
 * Opt-in at the world level: `lock: true | { range, cone, release, aimRate, los, pitch }`. Absent ⇒
 * `state.lock` is null and both passes return at once — stepping is unchanged for every world
 * that never asked.
 *
 *   state.lock = { cfg, target: <entity id> | null, pilot: <the pilot the lock belongs to> }
 *
 * ACQUIRE (pre-step, on the `input.lock` press edge): the candidate nearest the pilot's AIM AXIS
 * (`fwd3(heading, pitch)`, the axis the ranged weapon fires along) among entities that are
 * hittable, not self, not an ally (team), not a vanished wreck, within `range` and the `cone`
 * half-angle, with line of sight (`los`, colliders). Pressed while locked: the NEXT candidate by
 * angle (wrapping); none other ⇒ release. A pilot swap releases. While locked the input's mouse
 * look is zeroed — the mouse stands down, strafing orbits the target.
 *
 * STEER (world pass, after the match adjudication): release when the target died / vanished /
 * left `release` range or the pilot is downed; else ease heading (shortest arc) and pitch toward
 * the target at `aimRate`/s. Positions only — no dice, no clock; replay-safe.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core precedes this in EMISSION.
 * Field ownership: state.lock. Reads e.team, e.gone, e.downed, e.body.hittable, e.rule.eye.
 */

export function buildLock(E) {
  const { sub, clamp, smooth, fwd3, sightBlocked, registerStateInit, registerPreStep, registerWorldPass, TAU, HALF_PI } = E;

  function normalizeLock(raw) {
    if (!raw) return null;
    const o = raw === true ? {} : (raw && typeof raw === 'object' ? raw : {});
    const range = Number.isFinite(o.range) && o.range > 0 ? o.range : 120;
    return {
      range,
      cone: clamp(Number.isFinite(o.cone) ? o.cone : 60, 1, 180) * Math.PI / 180,   // half-angle about the aim axis
      release: Number.isFinite(o.release) && o.release >= range ? o.release : range * 1.25,
      aimRate: Number.isFinite(o.aimRate) && o.aimRate > 0 ? o.aimRate : 8,
      los: o.los !== false,      // acquisition needs line of sight (analytic colliders)
      pitch: o.pitch !== false,  // steer pitch as well as heading
    };
  }
  const eyeOf = (e) => (e.rule && Number.isFinite(e.rule.eye) ? e.rule.eye : 1.4);
  const targetable = (me, tg) => tg !== me && !tg.isCamera && !!(tg.body && tg.body.hittable) && !tg.gone
    && !(me.team && tg.team && tg.team === me.team);

  // candidates(state, me) → [{ id, ang, d }] within range + cone (+ LOS), nearest the aim first.
  // Ties break by distance, then id — a total order, so two hosts pick the same target.
  function candidates(state, me) {
    const cfg = state.lock.cfg, t = me.transform, aim = fwd3(t.heading, t.pitch || 0);
    const origin = [t.pos[0], t.pos[1], t.pos[2] + eyeOf(me)];
    const out = [];
    for (const tg of state.entities) {
      if (!targetable(me, tg)) continue;
      const v = sub(tg.transform.pos, origin), d = Math.hypot(v[0], v[1], v[2]);
      if (d < 1e-3 || d > cfg.range) continue;
      const ang = Math.acos(clamp((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1, 1));
      if (ang > cfg.cone) continue;
      if (cfg.los && sightBlocked(origin, tg.transform.pos, state.colliders)) continue;
      out.push({ id: tg.id, ang, d });
    }
    out.sort((a, b) => a.ang - b.ang || a.d - b.d || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  registerStateInit((state, spec) => {
    const cfg = normalizeLock(spec && spec.lock);
    state.lock = cfg ? { cfg, target: null, pilot: state.pilotId || null } : null;
  });

  // the press edge: acquire / cycle / release. Returns a replacement input (mouse zeroed) while locked.
  registerPreStep('lock', (state, input) => {
    const L = state.lock; if (!L) return null;
    const me = state.pilotId ? state.byId[state.pilotId] : null;
    if (!me || L.pilot !== (state.pilotId || null)) { L.target = null; L.pilot = state.pilotId || null; }
    if (me && input.lock) {
      const cs = candidates(state, me);
      if (!L.target) L.target = cs.length ? cs[0].id : null;
      else if (cs.some((c) => c.id !== L.target)) {
        const i = cs.findIndex((c) => c.id === L.target);
        L.target = (i < 0 ? cs[0] : cs[(i + 1) % cs.length]).id;
      } else L.target = null;
    }
    return L.target ? { ...input, lookDX: 0, lookDY: 0 } : null;
  });

  // steer toward the target (or let go of it) — after the match pass so a kill this frame releases.
  registerWorldPass('lock', (state, input, dt) => {
    const L = state.lock; if (!L || !L.target) return;
    const me = state.pilotId ? state.byId[state.pilotId] : null, tg = state.byId[L.target];
    if (!me || !tg || !targetable(me, tg) || me.downed) { L.target = null; return; }
    const t = me.transform, origin = [t.pos[0], t.pos[1], t.pos[2] + eyeOf(me)];
    const v = sub(tg.transform.pos, origin), d = Math.hypot(v[0], v[1], v[2]);
    if (d < 1e-3 || d > L.cfg.release) { L.target = null; return; }
    const k = smooth(L.cfg.aimRate, dt);
    let dh = Math.atan2(v[1], v[0]) - t.heading;
    dh = ((dh + Math.PI) % TAU + TAU) % TAU - Math.PI;   // shortest arc
    t.heading += dh * k;
    if (L.cfg.pitch) {
      const want = Math.atan2(v[2], Math.hypot(v[0], v[1])), cur = t.pitch || 0;
      t.pitch = clamp(cur + (want - cur) * k, -HALF_PI + 0.05, HALF_PI - 0.05);
    }
  }, 55);

  Object.assign(E, { normalizeLock, lockCandidates: candidates });
}
