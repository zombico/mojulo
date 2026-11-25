/**
 * BLAZE GUNNER'S BOT — the machine gate's player: a scroll stage played to its end on the rules it ships
 * (worlds/controllable/scroll.js, scroll-pods.js, scroll-foes.js, rupa.js for a hull on the play plane), its world built
 * as its page builds it (the resolved payload's entities, camera, colliders, breakables and rupa), stepped at a fixed
 * clock. It plays as a player who reads the screen would, and says what playing the stage took.
 *
 *   the DODGE    each frame the d-pad's nine choices (the eight ways and none) weighed over the next HORIZON seconds (fine near,
 *                coarse far; each interval read by its nearest pass, so a fast bullet is never missed between two looks): the
 *                ship where each would carry it (at its gear's speed, held in the frame), the foes' bullets where theirs
 *                carry them, a hull's standing blocks as terrain; the danger a choice meets (how far inside a bullet's or
 *                a block's reach the hitbox would come, the nearer in time the worse) above all else
 *   the LEAN     among choices as safe: toward the height of the nearest foe ahead of it (to be in line to hit it), toward
 *                a dropped pod while a slot is open, and back toward its home a quarter of the screen behind the middle
 *   the GUNS     fired throughout; a pod in the other slot switched to when the live one is empty
 *
 *   botInput(world, { horizon?, scores? }) → the frame's input (the d-pad as the screen reads it, fire, slot); `scores`, a
 *                                          list, takes each choice's danger and lean (what a trace reads)
 *   playScrollStage(spec, { seconds?, dt?, trace? }) → { cleared, ended, bossDown, time, hp, hits, foes: { down, of },
 *                                             caught, held: [pods], peak (the most foes' bullets on the screen at once) }   spec: { entities, camera, pilot?, colliders?,
 *                                             breakables?, rupa? } (a payload, or a level's manifest-level play); cleared:
 *                                             the track run to its end, its boss (if it holds for one) down, the ship up
 *   stageSpec(manifest)                   → (async) the spec as the page resolves it (worlds/world-scene.js)
 *
 * Deterministic: a fixed step, no dice: the same stage plays the same way.
 */
import { composeLive } from '../../worlds/controllable/compose.js';
import { SCROLL_VIEWS } from './frame.js';

/** How far ahead the dodge looks (s), and how finely. */
export const HORIZON = 0.7;
// (the times it looks at, shares of the horizon: fine near, coarse far)
const TIMES = [0.05, 0.1, 0.15, 0.22, 0.32, 0.45, 0.6, 0.8, 1], MARGIN = 0.6;
const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
let E = null;

/** The frame's input for the pilot of a scroll stage. */
export function botInput(w, { horizon = HORIZON, scores = null } = {}) {
  const cam = w.camera, s = w.pilotId && w.byId[w.pilotId];
  if (!cam || !cam._sc || !s || !s.screenAt || !s.rule) return { fire: 1 };
  const view = cam.rule.view === 'top' ? 'top' : 'side', V = SCROLL_VIEWS[view], [SA, SC] = cam.rule.screen, c = cam._sc, sc = cam.scrollVel || [0, 0];
  const r = s.rule, G = Array.isArray(r.gears) && r.gears.length ? r.gears : [0.45, 0.65, 0.9], speed = G[s.gear ?? 0] * SC;
  const hb = r.hitbox || { r: 0.5, at: 0 }, size = r.size || [0, 0], edge = (r.margin ?? 1 / 30) * SC;
  const hu = SA / 2 - edge - size[0] / 2, hv = SC / 2 - edge - size[1] / 2, off = s.off || [s.screenAt[0] - c[0], s.screenAt[1] - c[1]];
  const dot = (a, q) => a[0] * q[0] + a[1] * q[1] + a[2] * q[2];
  // what it meets: the foes' bullets (screen axes, moving), a hull's standing blocks (their outlines, fixed in the world)
  const shots = (w.foeShots || []).map((b) => ({ u: b.u, v: b.v, du: b.du, dv: b.dv, r: b.r }));
  const blocks = (w.breakables || []).filter((k) => !k.broken && k.min).map((k) => {
    const a = [dot(V.along, k.min), dot(V.along, k.max)], b = [dot(V.across, k.min), dot(V.across, k.max)];
    return [Math.min(...a), Math.max(...a), Math.min(...b), Math.max(...b)];
  });
  // what it leans toward: the nearest foe ahead in the frame (its height), a pod while a slot is open
  const ahead = w.entities.filter((e) => e.team === 'foes' && !e.downed && !e.gone && !e.waiting && !(e.body && e.body.hittable === false)).map((e) => [dot(V.along, e.transform.pos), dot(V.across, e.transform.pos)])
    .filter(([u, v]) => u > s.screenAt[0] && u < c[0] + SA / 2 && Math.abs(v - c[1]) < SC / 2).sort((a, b) => a[0] - b[0])[0];
  const open = s.slots && s.slots.some((x) => !x), pod = open ? (w.podDrops || [])[0] : null;
  let best = null, bestScore = Infinity;
  for (const [du0, dv0] of DIRS) {
    let du = du0, dv = dv0;
    if (du && dv) { du *= Math.SQRT1_2; dv *= Math.SQRT1_2; }
    // (two futures for each choice: held all the horizon, and one step then still; it is only as safe as the worse of
    // them, so a step that is safe only while it keeps going is not taken, and the bot does not swing to and fro)
    const step = TIMES[0] * horizon, first = [Math.max(-hu, Math.min(hu, off[0] + du * speed * step)), Math.max(-hv, Math.min(hv, off[1] + dv * speed * step))];
    const meet = (held) => {
      let d0 = 0, ou = off[0], ov = off[1], t0 = 0, pu0 = c[0] + ou + (hb.at || 0), pv0 = c[1] + ov;
      for (let k = 0; k < TIMES.length; k++) {
        const t = TIMES[k] * horizon, dt = t - t0;
        if (held || k === 0) { ou = Math.max(-hu, Math.min(hu, ou + du * speed * dt)); ov = Math.max(-hv, Math.min(hv, ov + dv * speed * dt)); }
        // (the screen's back edge is no refuge: a ship pinned against it has nowhere left to go)
        if (ou < -hu * 0.85) d0 += (-hu * 0.85 - ou) * 0.05;
        const pu = c[0] + sc[0] * t + ou + (hb.at || 0), pv = c[1] + sc[1] * t + ov, wgt = 1 + (TIMES.length - k) * 0.25;
        // (a bullet's nearest pass over the interval, ship and bullet each moving straight across it: never missed
        // between two samples, as a fast one would be)
        for (const b of shots) {
          const a0u = b.u + b.du * t0 - pu0, a0v = b.v + b.dv * t0 - pv0, a1u = b.u + b.du * t - pu, a1v = b.v + b.dv * t - pv;
          const ru = a1u - a0u, rv = a1v - a0v, L2 = ru * ru + rv * rv, x = L2 > 0 ? Math.max(0, Math.min(1, -(a0u * ru + a0v * rv) / L2)) : 0;
          const d = Math.hypot(a0u + ru * x, a0v + rv * x), reach = b.r + hb.r + MARGIN;
          if (d < reach) d0 += (reach - d) * wgt;
        }
        for (const q of blocks) { const g = hb.r + MARGIN; if (pu > q[0] - g && pu < q[1] + g && pv > q[2] - g && pv < q[3] + g) d0 += 3 * wgt * (1 + Math.min(pu - q[0] + g, q[1] + g - pu, pv - q[2] + g, q[3] + g - pv)); }
        t0 = t; pu0 = pu; pv0 = pv;
      }
      return d0;
    };
    const danger = Math.max(meet(true), meet(false));
    // (the lean read a step ahead, where the choice puts it next: home along the scroll held harder than the height, so a
    // dodge steps across a bullet's line rather than backing away down it)
    const want = pod ? [pod.u - c[0], pod.v - c[1]] : [-SA / 4, ahead ? ahead[1] - c[1] : 0];
    const lean = Math.hypot((want[0] - first[0]) * (pod ? 1 : 1.5), want[1] - first[1]);
    const score = danger * 1000 + lean;
    if (scores) scores.push({ d: [du0, dv0], danger: +danger.toFixed(3), lean: +lean.toFixed(2) });
    if (score < bestScore - 1e-9) { bestScore = score; best = [du0, dv0]; }
  }
  // the d-pad as the screen reads it: right and up (scroll.js: the side view's right is ahead, its up across; the top
  // view's up is ahead, its right the side view's down)
  const [bu, bv] = best || [0, 0], input = view === 'side' ? { turn: bu, forward: bv } : { forward: bu, turn: -bv };
  const swap = s.slots && !s.slots[s.live] && s.slots.some((x) => x) && !s._botSlot;
  s._botSlot = swap;
  return { ...input, fire: 1, ...(swap ? { slot: 1 } : {}) };
}

/** A scroll stage played to its end by the bot. */
export function playScrollStage(spec, { seconds = 300, dt = 1 / 30, trace = null } = {}) {
  E ??= composeLive();
  const w = E.createWorld({ entities: spec.entities, camera: spec.camera, pilot: spec.pilot ?? 'player', colliders: spec.colliders ?? [],
    ...(spec.breakables ? { breakables: spec.breakables } : {}), ...(spec.rupa ? { rupa: spec.rupa } : {}) });
  const track = (spec.camera && spec.camera.track) || [], boss = [...track].reverse().find((L) => L && L.hold === true && L.until)?.until ?? null;
  const foes = w.entities.filter((e) => e.team === 'foes' && !(e.body && e.body.hittable === false));
  let n = 0, peak = 0;
  const ship = () => w.byId[w.pilotId];
  for (; n * dt < seconds; n++) {
    E.stepWorld(w, botInput(w), dt);
    peak = Math.max(peak, (w.foeShots || []).length);
    if (trace && n % Math.round(1 / dt) === 0) trace.push({ t: +w.time.toFixed(2), u: +w.camera._sc[0].toFixed(1), hp: ship().body?.hp ?? null, shots: (w.foeShots || []).length });
    if (ship().downed || (w.camera.scrollEnd && (!boss || w.byId[boss]?.downed))) break;
  }
  const s = ship(), bossDown = !boss || !!w.byId[boss]?.downed;
  return {
    cleared: !!w.camera.scrollEnd && bossDown && !s.downed, ended: !!w.camera.scrollEnd, bossDown, time: +w.time.toFixed(2),
    hp: s.body?.hp ?? null, hits: s.hitsTaken || 0, foes: { down: foes.filter((e) => e.downed).length, of: foes.length },
    caught: s.caught || 0, held: (s.slots || []).map((x) => x && x.id), peak,
  };
}

/** The spec of a stage as its page resolves it: its manifest with the level's play on it, through the world scene. */
export async function stageSpec(manifest) {
  const [{ resolveWorldScene }, { scrollStagePlay }] = await Promise.all([import('../../worlds/world-scene.js'), import('./stage-scene.js')]);
  const { payload } = await resolveWorldScene({ manifest: { ...manifest, ...scrollStagePlay(manifest, { airframe: false }), ...levelPhysics(manifest) } });
  return { entities: payload.entities, camera: payload.camera, pilot: payload.pilot, colliders: payload.colliders, breakables: payload.breakables, rupa: payload.rupa };
}
// (the level's physics a hull on the play plane asks, as scrollStagePlay gives a level with its airframe)
const levelPhysics = (m) => ((m.scroll?.hulls ?? []).some((H) => H.depth === 0) ? { destruction: 'physical', matter: { g: 0, power: 1e3 } } : {});
