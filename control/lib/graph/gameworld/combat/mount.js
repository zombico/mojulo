/**
 * THE MOUNTS — the turret's numbers by what carries it (worlds/controllable/turret.js steps them), and their measures on
 * the runtime. Magnitudes by class, never one maker's figures. Pure but for the measures' time.
 *
 *   MOUNTS                 the classes: a battle tank's turret, a light tank's, a field gun laid by hand, a self-propelled
 *                          howitzer's, a fortress tower's
 *   mountOf(word, over?)   → an entity's `turret` ({ mount, gun }), the class's with `over` laid on it
 *   measureMount(turret)   → how it moves under the hand: the time to traverse 90°, its whole arc, to elevate from its
 *                            depression to its elevation; a flick's settle and overshoot; its lag behind a hand that
 *                            sweeps; and on a base turning, how far its world aim drifts (a stabilized mount holds it)
 *   mountLaws(m, turret)   → [{ name, ok, info }]: the mount within its limits at its rates, braking onto its aim
 */
import { composeLive } from '../../worlds/controllable/compose.js';

// the trunnion's place (m: forward, right, up off the base), the barrel (m), the slew (°/s, °/s²) and the limits (°)
export const MOUNTS = Object.freeze({
  // a main battle tank: a powered turret all round, a stabilized gun, a long barrel
  'battle-tank': Object.freeze({ mount: { at: [0.3, 0, 2.1], traverse: { rate: 40, accel: 60 }, elevation: { rate: 18, accel: 45, min: -9, max: 20 }, stabilized: true, look: 0.06 }, gun: { barrel: 5.3 } }),
  // a light tank: lighter and quicker, stabilized
  'light-tank': Object.freeze({ mount: { at: [0.2, 0, 1.8], traverse: { rate: 50, accel: 90 }, elevation: { rate: 22, accel: 60, min: -10, max: 22 }, stabilized: true, look: 0.07 }, gun: { barrel: 4.3 } }),
  // a towed field gun laid by its cranks: a narrow arc, slow, its aim carried by whatever it stands on
  'field-gun': Object.freeze({ mount: { at: [0, 0, 1.2], traverse: { rate: 4, accel: 8, min: -25, max: 25 }, elevation: { rate: 3, accel: 6, min: -5, max: 65 }, stabilized: false, look: 0.03 }, gun: { barrel: 3.4 } }),
  // a self-propelled howitzer: all round, high, unstabilized (it fires halted)
  howitzer: Object.freeze({ mount: { at: [-0.4, 0, 2.4], traverse: { rate: 12, accel: 20 }, elevation: { rate: 8, accel: 16, min: -3, max: 70 }, stabilized: false, look: 0.05 }, gun: { barrel: 6.5 } }),
  // a fortress or coastal tower's gun: all round, quick for its size, on a base that never moves
  tower: Object.freeze({ mount: { at: [0, 0, 6], traverse: { rate: 20, accel: 30 }, elevation: { rate: 12, accel: 25, min: -10, max: 45 }, stabilized: false, look: 0.05 }, gun: { barrel: 6 } }),
});
export const MOUNT_NAMES = Object.freeze(Object.keys(MOUNTS));

/** A turret by its class, `over` laid on it (its mount's and its gun's fields; a traverse's or an elevation's by field). */
export function mountOf(word, over = {}) {
  const C = MOUNTS[word];
  if (!C) throw new Error(`mount: one of ${MOUNT_NAMES.join(', ')}`);
  const m = over.mount ?? {};
  return {
    mount: { ...C.mount, ...m, traverse: { ...C.mount.traverse, ...(m.traverse ?? {}) }, elevation: { ...C.mount.elevation, ...(m.elevation ?? {}) } },
    gun: { ...C.gun, ...(over.gun ?? {}) },
  };
}

const E = composeLive(), FPS = 60, DT = 1 / FPS, hooks = { ground: () => 0 };
const r2 = (v) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 100) / 100);
const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
// a turret on a base that stands (or turns at `hull` °/s), at rest before it is asked anything
function onBase(turret) {
  const w = E.createWorld({ entities: [{ id: 'g', pilotable: true, rule: { type: 'static' }, body: { type: 'none' }, turret, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } }] });
  for (let i = 0; i < 5; i++) E.stepWorld(w, {}, DT, hooks);
  return { w, g: w.byId.g };
}
const k = (turret) => (turret.mount.look > 0 ? turret.mount.look : 0.08);
// the hand asks `dy`° of yaw and `dp`° of pitch at once (the page's look: a positive lookDX left, lookDY up)
const ask = (w, turret, dy, dp) => E.stepWorld(w, { lookDX: dy / k(turret), lookDY: dp / k(turret) }, DT, hooks);
// frames until the mount stands within `tol`° of (yaw, pitch); null past `most` seconds
function until(w, g, yaw, pitch, tol = 0.1, most = 60) {
  let peak = 0;
  for (let f = 0; f < most * FPS; f++) {
    const ey = Math.abs(wrap(g.turret.yaw - yaw)), ep = Math.abs(g.turret.pitch - pitch);
    if (ey <= tol && ep <= tol) return { s: r2((f + 1) * DT), peak };
    E.stepWorld(w, {}, DT, hooks);
    peak = Math.max(peak, Math.sign(yaw || 1) * wrap(g.turret.yaw - yaw), Math.sign(pitch || 1) * (g.turret.pitch - pitch));
  }
  return { s: null, peak };
}

export function measureMount(turret, { hull = 20, sweep = 30 } = {}) {
  const tr = turret.mount.traverse, el = turret.mount.elevation, limited = Number.isFinite(tr.min) || Number.isFinite(tr.max);
  const out = { traverse: { rate: tr.rate, arc: limited ? [tr.min, tr.max] : 'all round' }, elevation: { rate: el.rate, from: el.min, to: el.max }, stabilized: !!turret.mount.stabilized };
  // a quarter turn (or as far as its arc goes), and its whole arc end to end
  { const q = limited ? Math.min(90, tr.max) : 90, { w, g } = onBase(turret); ask(w, turret, q, 0); out.traverse.quarter = { deg: q, ...until(w, g, q, 0) }; }
  if (limited) { const { w, g } = onBase(turret); ask(w, turret, tr.min, 0); until(w, g, tr.min, 0); ask(w, turret, tr.max - tr.min, 0); out.traverse.arcEndToEnd = until(w, g, tr.max, 0).s; }
  else { const { w, g } = onBase(turret); ask(w, turret, 179.9, 0); out.traverse.half = until(w, g, 179.9, 0).s; }
  // depression to full elevation
  { const { w, g } = onBase(turret); ask(w, turret, 0, el.min); until(w, g, 0, el.min); ask(w, turret, 0, el.max - el.min); out.elevation.full = until(w, g, 0, el.max).s; }
  // a flick of 5° each way: the settle and how far past it swings
  { const { w, g } = onBase(turret); ask(w, turret, 5, 5); const u = until(w, g, 5, 5, 0.05); out.flick = { s: u.s, overshoot: r2(u.peak) }; }
  // a hand sweeping at `sweep` °/s for three seconds: how far behind it the gun lags in the last second
  { const { w, g } = onBase(turret), per = sweep * DT; let lag = 0, n = 0;
    for (let f = 0; f < 3 * FPS; f++) { ask(w, turret, per, 0); if (f >= 2 * FPS) { lag += Math.abs(wrap(g.turret.want.yaw - (turret.mount.stabilized ? g.turret.yaw + g.transform.heading * 180 / Math.PI : g.turret.yaw))); n++; } }
    out.lag = { sweep, deg: r2(lag / n) }; }
  // the base turning at `hull` °/s for three seconds under a held aim: how far the world aim drifts from where it was
  { const { w, g } = onBase(turret); const world0 = g.turret.yaw; let drift = 0;
    for (let f = 0; f < 3 * FPS; f++) { g.transform.heading += hull * DT * Math.PI / 180; E.stepWorld(w, {}, DT, hooks); drift = Math.max(drift, Math.abs(wrap(g.turret.yaw + g.transform.heading * 180 / Math.PI - world0))); }
    out.hold = { hull, drift: r2(drift) }; }
  return out;
}

/** The mount's laws on its measures. */
export function mountLaws(m, turret) {
  const L = [], law = (name, ok, info) => L.push({ name, ok: !!ok, ...(info !== undefined ? { info } : {}) });
  const tr = turret.mount.traverse, el = turret.mount.elevation;
  const q = m.traverse.quarter, acc = (ax) => (ax.accel > 0 ? ax.rate / ax.accel : 0);
  // (no faster than its rate allows, and no slower than its rate and its acceleration's run-up and braking need)
  law('it traverses at its rate', q.s != null && q.s >= q.deg / tr.rate - 0.05 && q.s <= q.deg / tr.rate + acc(tr) + 0.1, { asked: r2(q.deg / tr.rate), runtime: q.s });
  law('it elevates from its depression to its elevation at its rate', m.elevation.full != null && Math.abs(m.elevation.full - ((el.max - el.min) / el.rate + acc(el))) <= 0.15, { asked: r2((el.max - el.min) / el.rate + acc(el)), runtime: m.elevation.full });
  law('it brakes onto its aim (a flick overshoots by under a tenth of a degree)', m.flick.s != null && m.flick.overshoot < 0.1, m.flick);
  law('it lags behind a hand faster than its rate, and keeps up with one slower', m.lag.sweep > tr.rate ? m.lag.deg > 1 : m.lag.deg < 2, m.lag);
  if (turret.mount.stabilized) law('stabilized, it holds its world aim while its base turns slower than it traverses', m.hold.hull >= tr.rate || m.hold.drift < 1, m.hold);
  else law('unstabilized, its aim is carried by its base', m.hold.drift > m.hold.hull * 3 * 0.9, m.hold);
  return L;
}
