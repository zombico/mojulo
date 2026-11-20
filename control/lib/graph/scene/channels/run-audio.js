// In-page script: A RUN AND GUN'S VOICES (audio.run, beats/beats-world.js; gameworld/sound-sheet.js RUN_SOUNDS), inside the
// audio channel (audio.js: its engine, its cue and its distance gain). Read-only, as every layer of the channel is: it
// reads the world each frame and never writes back.
//
//   THE BUSTER  a round of the pilot's leaving (a round the world has that it had not): its tap, its first charged round or
//               the full charge's, by the round's level (buster.js busterLv); the charge HELD (`charge`) while it builds,
//               its control how full (e.chargeFrac), silent the moment it is let go
//   THE HERO    a dash begun (e.dashT from none), a wall kick (e.kickT from none), on a wall (e.cling from none), a blow
//               taken (its health down)
//   ITS FOES    a round of a foe's leaving (`foeShot`; a thrown rock its `throw`), a foe struck (its health down: `foeHit`,
//               a heavy's, the elite rank's, `armour`), one down (`wreck`; a boss, an id of boss-, `boss`)
//   A ROCK      heaved (a thrower's e.foeRock begun: `lift`), shot apart in the air (a burst marked broke: `break`), else
//               landing where its round ended (`rock`)
//   THE ROOM    the boss room's shutter down (the camera's _shut by zone, sidemap.js: `shut`)
//   TREADS      a boss that paces (rule.foe.move 'pace'), HELD (`treads`): its control its speed over its own
//
// Each foe's sound is heard while it is in the frame (RUN_EDGE), placed by its distance from the pilot (__proxGain). What the world had when the sound was unlocked
// is taken as heard, so a page does not say every round in the air at once.

// RUN_EDGE  how far past the frame's edge (in its own half widths: 1 the edge) a foe is still heard
// RUN_HUM   how full the charge is before its hum is heard, so a tap is a tap and not a tap and a hum
export const RUN_EDGE = 1.2, RUN_HUM = 0.12;

export function runAudioScript() {
  return `
// A RUN AND GUN'S VOICES (run-audio.js): the buster, the hero, its foes, a rock, the shutter, a boss's treads
(function () {
  const R = __AUDIO.run, L = {}, RUN_EDGE = ${RUN_EDGE}, RUN_HUM = ${RUN_HUM};
  let rounds = null, rocks = {}, bSeq = null, shut = null, chg = null, trd = null, trdK = null;
  // (a foe's sound is heard while it is in the frame, a little past its edges: off the screen, silent)
  const V = new THREE.Vector3(), seen = (at) => { V.set(at[0], at[1], at[2]).project(camera); return Math.abs(V.x) <= RUN_EDGE && Math.abs(V.y) <= RUN_EDGE && V.z < 1 ? 1 : 0; };
  const gainAt = (at) => __proxGain(at) * seen(at);
  const play = (cue, at) => { if (cue) __beatsCue(cue, at ? gainAt(at) : null); };
  const hpOf = (e) => (e.body && Number.isFinite(e.body.hp) ? e.body.hp : null);
  (function __beatsRun() {
    requestAnimationFrame(__beatsRun);
    if (!__beatsEng) return;
    const W = window.__mojCtrl && window.__mojCtrl.world;
    if (!W) return;
    if (R.charge && !chg) { try { chg = __beatsEng.sustain(R.charge); } catch (e) { chg = null; } }
    if (R.treads && !trd) { try { trd = __beatsEng.sustain(R.treads); } catch (e) { trd = null; } }
    const P = W.byId && W.pilotId ? W.byId[W.pilotId] : null, first = rounds === null;
    if (__beatsMuted) { if (chg) chg.set(0); if (trd) trd.set(0); }
    // (the rounds: each new one by who fired it)
    const now = {}, broke = [];
    for (const p of W.projectiles || []) {
      now[p.id] = p;
      if (first || rounds[p.id]) continue;
      if (P && p.owner === P.id && p.busterLv != null) {
        const top = P.rule && P.rule.buster && P.rule.buster.levels ? P.rule.buster.levels.length : 2;
        play(p.busterLv === 0 ? R.tap : p.busterLv >= top ? R.full || R.shot : R.shot || R.full);
      } else if (p.rock) { play(R.throw, p.pos); rocks[p.id] = p; }
      else if (!P || p.owner !== P.id) play(R.foeShot, p.pos);
    }
    for (const p of W.projectiles || []) if (p.rock && !rocks[p.id]) rocks[p.id] = p;
    // (bursts: a rock shot apart in the air)
    const top = W.bursts && W.bursts.length ? W.bursts[W.bursts.length - 1].seq : -1;
    if (bSeq !== null) for (const b of W.bursts || []) if (b.seq > bSeq && b.broke) { broke.push(b); play(R.break, b.pos); }
    bSeq = Math.max(bSeq === null ? -1 : bSeq, top);
    // (a rock whose round has ended and was not shot apart: it landed)
    for (const id in rocks) if (!now[id]) {
      const q = rocks[id], hit = broke.some((b) => Math.hypot(b.pos[0] - q.pos[0], b.pos[1] - q.pos[1], b.pos[2] - q.pos[2]) < 2);
      if (!hit && !first) play(R.rock, q.pos);
      delete rocks[id];
    }
    rounds = now;
    // (the hero: a dash, a wall kick, on a wall, a blow taken; the charge held while it builds)
    if (P) {
      const l = L[P.id] || (L[P.id] = { dash: P.dashT > 0, kick: P.kickT > 0, cling: !!P.cling, hp: hpOf(P) });
      if (!first) {
        if (P.dashT > 0 && !l.dash) play(R.dash);
        if (P.kickT > 0 && !l.kick) play(R.kick);
        if (P.cling && !l.cling) play(R.cling);
        if (l.hp != null && hpOf(P) != null && hpOf(P) < l.hp) play(R.hurt);
      }
      l.dash = P.dashT > 0; l.kick = P.kickT > 0; l.cling = !!P.cling; l.hp = hpOf(P);
      if (chg && !__beatsMuted) chg.set(P.charging && !P.downed && (P.chargeFrac || 0) >= RUN_HUM ? Math.min(1, P.chargeFrac) : 0);
    }
    // (its foes: struck, down, a rock heaved; a boss that paces, its treads)
    let tread = 0;
    for (const e of W.entities) {
      if (e.team !== 'foes') continue;
      const l = L[e.id] || (L[e.id] = { hp: hpOf(e), down: !!e.downed, rock: !!(e.foeRock && !e.foeRock.thrown), at: e.transform.pos.slice(), t: W.time });
      const boss = String(e.id).indexOf('boss-') === 0, rock = !!(e.foeRock && !e.foeRock.thrown);
      if (!first) {
        if (e.downed && !l.down) play(boss ? R.boss || R.wreck : R.wreck, e.transform.pos);
        else if (!e.downed && l.hp != null && hpOf(e) != null && hpOf(e) < l.hp) play(e.rule && e.rule.mind && e.rule.mind.rank === 'elite' ? R.armour || R.foeHit : R.foeHit, e.transform.pos);
        if (rock && !l.rock) play(R.lift, e.transform.pos);
      }
      if (boss && trd && e.rule && e.rule.foe && e.rule.foe.move === 'pace' && !e.downed && !e.gone) {
        const dt = W.time - l.t, p = e.transform.pos;
        if (dt > 0) { const v = Math.hypot(p[0] - l.at[0], p[1] - l.at[1]) / dt, k = Math.min(1, v / Math.max(0.1, e.rule.speed || 1)); tread = Math.max(tread, k * gainAt(p)); }
      }
      l.hp = hpOf(e); l.down = !!e.downed; l.rock = rock;
      if (W.time > l.t) { l.at = e.transform.pos.slice(); l.t = W.time; }
    }
    if (trd && !__beatsMuted && W.time !== trdK) { trd.set(tread); trdK = W.time; }
    // (the boss room's shutter coming down: a zone's shut time newly set)
    const S = (W.camera && W.camera._shut) || {};
    if (shut && !first) for (const k in S) if (S[k] != null && shut[k] == null) play(R.shut);
    shut = Object.assign({}, S);
  })();
})();
`;
}
