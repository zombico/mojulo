/**
 * FLIGHT AUDIO — a flown level's sounds (sfx-shelf/flight-sounds.js: the kit by its pilot's rule), inside the audio
 * channel (scene/channels/audio.js: its engine, its cue, its distance gain). Every flown airspace hears its craft: a
 * level that writes `audio: false` hears nothing, and one with an `audio` of its own keeps it and takes the flight's
 * sounds under it (its own cues win).
 *
 *   FLIGHT_REACH               a kit → the metres a cue is heard to (a flight's fights are kilometres across, an
 *                              arena's 900 m would leave a wingman's fight silent)
 *   flightAudio(payload, manifest?) → a world's audio spec (beats-world.js resolveWorldAudio: `audio.flight` and the mix)
 *                              for the payload's flown pilot, or null (nothing flies, or the level says `audio: false`)
 *   flightAudioScript()        the page's block (spliced into the audio channel when `audio.flight` is set)
 *
 * The events, each read off the world every frame and never written back (as every layer of the channel is):
 *   engine     HELD by the throttle (the fly rule's lever, a cockpit's thrust, a rail's boost), eased
 *   air        HELD by the airspeed over the craft's own cruise, in the air (the trainer's)
 *   wheels     HELD by the speed on the ground (the take-off roll and the roll-out)
 *   shot       a round of the pilot's leaving; foeShot one of anyone else's, by its distance
 *   hit        the pilot struck (its shields, a cockpit's; a hull hit, `hull`, when they are down)
 *   down       a foe destroyed (its blast's size: `bigDown` a warship's; `groundDown` a unit on the ground; `bossDown` a boss)
 *   boost, brake, roll   the pilot's boost and brake begun, a barrel roll begun
 *   stall      the stall warning, again while the stall lasts; touchdown, hardLanding (a sink over the gear's), crash
 *   gate       a ring flown through (the course's next gate taken)
 *   lockSeek, locked, missile, incoming, flare   a lock building, made, a warhead away, one homing on the pilot (again while
 *              it does), a flare dispensed
 *   flyby      a foe passing within FLYBY_M, at its nearest; scrape the pilot's craft along a hull
 */

import { sfxSound } from '../../sfx-shelf/resolve.js';
import { FLIGHT_HELD, flightKitOf, flightSounds } from '../../sfx-shelf/flight-sounds.js';

export const FLIGHT_REACH = Object.freeze({ trainer: 2000, arcade: 1600, cockpit: 3000 });
// FLYBY_M  how near a foe passes for its flyby (m); HARD_SINK  the sink (m/s) a touchdown is heard hard at
// STALL_EVERY, INCOMING_EVERY  how often the stall warning and the incoming warning sound again (s)
export const FLYBY_M = 45, HARD_SINK = 3.5, STALL_EVERY = 1.1, INCOMING_EVERY = 0.9;

const FLOWN = new Set(['fly', 'rail', 'starfighter']);
/** The payload's flown pilot (its pilotable on a flight rule), or null. */
export function flownPilot(entities) {
  return (Array.isArray(entities) ? entities : []).find((e) => e && e.pilotable && e.rule && FLOWN.has(e.rule.type)) ?? null;
}

/** A world's audio spec for a flown level, or null. */
export function flightAudio(payload, manifest = null) {
  if (manifest && manifest.audio === false) return null;
  const P = flownPilot(payload && payload.entities);
  if (!P) return null;
  const kit = flightKitOf(P.rule), S = flightSounds(kit, manifest && manifest.flightSound && typeof manifest.flightSound === 'object' ? manifest.flightSound : null);
  const flight = {};
  for (const [ev, word] of Object.entries(S.words)) {
    const v = sfxSound(word, { style: 'realistic' });
    if (!v) continue;
    if (FLIGHT_HELD.includes(ev)) { if (v.sustain) flight[ev] = v.sustain; }
    else if (v.gestures) flight[ev] = v.gestures;
  }
  if (!Object.keys(flight).length) return null;
  return { kit, reach: FLIGHT_REACH[kit], spec: { flight, sfx: { cues: {}, mix: { space: 'open', distance: true, pan: true } } } };
}

export function flightAudioScript() {
  return `
// A FLOWN LEVEL'S SOUNDS (flight-audio.js): the engine, the air and the wheels held; the guns, the hits, the kills, the
// boost, the stall, the landing, the rings, the lock, the warheads, a fighter past. Read-only.
(function () {
  const F = __AUDIO.flight, FLYBY_M = ${FLYBY_M}, HARD_SINK = ${HARD_SINK}, STALL_EVERY = ${STALL_EVERY}, INCOMING_EVERY = ${INCOMING_EVERY};
  const H = {}, L = {};
  let rounds = null, last = null, said = {}, cpVar = null, ownNext = 0;
  const play = (cue, at) => { if (cue) __beatsCue(cue, at ? __proxGain(at) : null); };
  const again = (k, every, now) => { if (now - (said[k] == null ? -1e9 : said[k]) < every) return false; said[k] = now; return true; };
  // (the course's next ring: the game's count where a game counts them, the bus's __cp_ var, else counted here as the
  // flight HUD does, each ring when the craft is inside it)
  const nextGate = (P) => {
    const C = P.rule && P.rule.course; if (!C || !Array.isArray(C.gates)) return null;
    const B = window.__mojBus, v = B && B.state && B.state.vars;
    if (v && cpVar === null) { cpVar = ''; for (const k in v) if (/^__cp_\\d+$/.test(k)) { cpVar = k; break; } }
    if (v && cpVar) return v[cpVar];
    const G = C.gates[ownNext], q = P.transform.pos;
    if (G && Math.hypot(q[0] - G[0], q[1] - G[1], q[2] - G[2]) <= G[3]) ownNext++;
    return ownNext;
  };
  const held = (k) => { if (!F[k]) return null; if (!H[k]) { try { H[k] = __beatsEng.sustain(F[k]); } catch (e) { H[k] = null; F[k] = null; } } return H[k]; };
  let ctl = { engine: 0, air: 0, wheels: 0 };
  (function __beatsFlight() {
    requestAnimationFrame(__beatsFlight);
    if (!__beatsEng) return;
    const W = window.__mojCtrl && window.__mojCtrl.world;
    const P = W && W.byId && W.pilotId ? W.byId[W.pilotId] : null;
    const now = performance.now() / 1000;
    // (held: the engine by its throttle, the air by the speed in the air, the wheels by the speed on the ground)
    let we = 0, wa = 0, ww = 0;
    if (P && !P.gone && !P.downed) {
      const r = P.rule || {}, v = P.airspeed || 0;
      const cruise = r.type === 'rail' ? (r.speed > 0 ? r.speed : 60) : r.type === 'starfighter' ? (P.topSpeed || r.speed || 100) : (r.cruise || 55);
      if (r.type === 'starfighter') we = P.thrust == null ? (P.throttle || 0) : P.thrust;
      else if (r.type === 'rail') we = P.boosting ? 1 : P.braking ? 0.1 : 0.35;
      else we = 0.15 + 0.85 * (P.throttle || 0);
      if (P.airborne) wa = Math.min(1, v / Math.max(1, cruise * 1.4));
      else ww = Math.min(1, v / Math.max(1, cruise * 0.8));
    }
    if (__beatsMuted) { we = 0; wa = 0; ww = 0; }
    ctl.engine += (we - ctl.engine) * 0.08; ctl.air += (wa - ctl.air) * 0.06; ctl.wheels += (ww - ctl.wheels) * 0.2;
    const he = held('engine'), ha = held('air'), hw = held('wheels');
    if (he) he.set(Math.max(0, Math.min(1, ctl.engine)));
    if (ha) ha.set(Math.max(0, Math.min(1, ctl.air)));
    if (hw) hw.set(Math.max(0, Math.min(1, ctl.wheels)));
    if (!W || __beatsMuted) return;
    const first = last === null;
    // (the rounds: each new one by who fired it; a warhead the pilot's is its own sound, as it is launched)
    const seen = {};
    for (const p of W.projectiles || []) {
      seen[p.id] = 1;
      if (first || (rounds && rounds[p.id]) || p.missile) continue;
      if (P && p.owner === P.id) play(F.shot); else play(F.foeShot, p.pos);
    }
    rounds = seen;
    // (the bodies: a foe destroyed, by what it was; a fighter past)
    for (const e of W.entities || []) {
      if (!e || !e.transform) continue;
      const l = L[e.id] || (L[e.id] = { down: !!(e.downed || e.gone), d: null, past: false });
      if (P && e !== P && e.team && e.team !== P.team) {
        if ((e.downed || e.gone) && !l.down && !first) {
          const fig = e.body && typeof e.body.figure === 'string' ? e.body.figure : '', big = e.body && e.body.blast > 30;
          const boss = typeof e.id === 'string' && e.id.indexOf('boss-') === 0;
          play((boss && (F.bossDown || F.bigDown)) || (fig.indexOf('unit-') === 0 && F.groundDown) || (big && F.bigDown) || F.down, e.transform.pos);
        }
        if (F.flyby && !e.downed && !e.gone && P.transform) {
          const q = e.transform.pos, m = P.transform.pos, d = Math.hypot(q[0] - m[0], q[1] - m[1], q[2] - m[2]);
          if (l.d != null && d < FLYBY_M && d > l.d && !l.past) { l.past = true; if (again('flyby', 0.6, now)) play(F.flyby, q); }
          if (d > FLYBY_M * 2) l.past = false;
          l.d = d;
        }
      }
      l.down = !!(e.downed || e.gone);
    }
    if (!P) { last = null; return; }
    // (the pilot: struck, its boost, its roll, the stall, the landing, a crash, a ring, the lock, the warheads)
    const S = P.ship, hp = P.body && Number.isFinite(P.body.hp) ? P.body.hp : null;
    const cur = { hits: P.hits || 0, shN: S ? S.hitN || 0 : 0, hp, boost: !!P.boosting, brake: !!P.braking, roll: !!P.rolling, stall: !!P.stalled,
      air: !!P.airborne, mlock: P.mlock ? (P.mlock.locked ? 2 : 1) : 0, missiles: P.missilesLeft, flares: P.flaresLeft, crashN: P.crashN || 0, gate: nextGate(P), down: !!(P.downed || P.gone) };
    if (!first && last) {
      if (cur.shN > last.shN) play(F.hit);
      else if (hp != null && last.hp != null && hp < last.hp) play(S && S.shMax > 0 ? F.hull || F.hit : F.hit);
      else if (cur.hits > last.hits && !S) play(F.hit);
      if (cur.boost && !last.boost) play(F.boost);
      if (cur.brake && !last.brake) play(F.brake);
      if (cur.roll && !last.roll) play(F.roll);
      if (cur.stall && (!last.stall || again('stall', STALL_EVERY, now))) { if (!last.stall) said.stall = now; play(F.stall); }
      if (!cur.air && last.air && !cur.down) play(Math.abs(P.climbRate || last.sink || 0) > HARD_SINK ? F.hardLanding || F.touchdown : F.touchdown);
      if (cur.down && !last.down) play(F.crash);
      if (cur.crashN > last.crashN) play(F.scrape || F.hull || F.hit);
      if (cur.gate != null && last.gate != null && cur.gate !== last.gate) play(F.gate);
      if (cur.mlock === 1 && last.mlock === 0) play(F.lockSeek);
      if (cur.mlock === 2 && last.mlock !== 2) play(F.locked);
      if (cur.missiles != null && last.missiles != null && cur.missiles < last.missiles) play(F.missile);
      if (cur.flares != null && last.flares != null && cur.flares < last.flares) play(F.flare);
      if (P.incoming != null && F.incoming && again('incoming', INCOMING_EVERY, now)) play(F.incoming);
    }
    cur.sink = P.airborne ? P.climbRate || 0 : last ? last.sink : 0;
    last = cur;
  })();
})();
`;
}
