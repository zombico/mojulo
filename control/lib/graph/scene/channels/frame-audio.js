// In-page script: AN ASSAULT FRAME'S FIELD, HEARD (audio.frame, beats/beats-world.js; gameworld/frame-sound.js), inside
// the audio channel (audio.js: its engine, its cue and its distance gain). Read-only, as every layer of the channel is:
// it reads the world each frame and never writes back.
//
//   EVERY FRAME (the pilot's and its foes', e.rule.type 'frame'), by its parts read off it (e.frame.build: a frame the
//               hangar refitted is heard as fitted): its footfalls by its legs' weight (two a stride, its gait's phase),
//               a landing (hard: e.landed; soft: down off the air), its booster lit (e.boosting from none) and its quick
//               boost (e.qbT from none) by its drive, its thrust HELD by its drive (the loudest frame's e.thrust, by its
//               distance), each slot's rounds by the weapon's kind (its st.shots up; an automatic's no closer than
//               `every`), a charge begun (st.charge from none) and a charged round, struck (e.hits up: on its shield while
//               it stands, else on its plates), its shield broken, and its wreck (down)
//   THE PILOT   lifted on its thrusters (e.ascending from none), EN out (e.enShut) and back, the FCS locked (e.locked),
//               a missile homing on it (`warn`), and the power-up as it is first free to move (no hangar, no briefing up)
//   EACH UNIT   (a body unit-<kind>) its rounds (its weapon's shots up), its missiles (a new missile round of its
//               own), its HUM held while it stands awake (drones, rotors, tracks: its control steady, its level its
//               distance), struck, and down by its size
//   BURSTS      a splash round's burst where it went off (a small one under BURST_SMALL is its hit's), a big one a blast
//   THE MENUS   window.__mojUiCue(<ui cue>) for the hangar and the briefing over the field (the holo table's set)
//   window.__mojFrameHeard  the last cue ids played (a headless probe's: what the field said)
//
// While the hangar or the briefing holds the field, the field is silent. What the world had when the sound was unlocked
// is taken as heard, so a page does not say every round in the air at once.

// FRAME_STEP_GAIN  a footfall's level beside the guns (twice a stride for as long as the frame walks)
// BURST_SMALL      a burst's radius under which it is a round's hit, not a burst of its own; BURST_BIG a blast's
// FRAME_HUM        a unit's hum control (its held voice at a steady pitch: a drone's motors, a rotor, the tracks)
// WARN_EVERY       the least seconds between two missile warnings
export const FRAME_STEP_GAIN = 0.55, BURST_SMALL = 5, BURST_BIG = 10, FRAME_HUM = 0.6, WARN_EVERY = 1.2;

export function frameAudioScript() {
  return `
// AN ASSAULT FRAME'S FIELD, HEARD (frame-audio.js)
(function () {
  const F = __AUDIO.frame, L = {}, FRAME_STEP_GAIN = ${FRAME_STEP_GAIN}, BURST_SMALL = ${BURST_SMALL}, BURST_BIG = ${BURST_BIG}, FRAME_HUM = ${FRAME_HUM}, WARN_EVERY = ${WARN_EVERY};
  const W0 = F.world || {}, CK = F.cockpit || {}, PL = (F.parts && F.parts.legs) || {}, PB = (F.parts && F.parts.booster) || {};
  let first = true, booted = false, bSeq = null, rounds = null, warnT = -9, burstT = -9;
  const drives = {}, hums = {};
  // (a cue by its id among the level's cues: the engine plays a gesture list; the last heard kept for a headless probe)
  const C = __AUDIO.cues || {}, heard = window.__mojFrameHeard = [];
  const play = (cue, gain) => { if (!cue || !C[cue]) return; __beatsCue(C[cue], gain); heard.push(cue); if (heard.length > 64) heard.shift(); };
  const at = (e, P) => (P && e === P ? null : __proxGain(e.transform.pos));
  const held = () => !!((window.__mojGarage && window.__mojGarage.up) || (window.__mojBriefing && window.__mojBriefing.up));
  const hpOf = (e) => (e.body && Number.isFinite(e.body.hp) ? e.body.hp : null);
  const kindOf = (e) => { const f = e.body && e.body.figure; return typeof f === 'string' && f.indexOf('unit-') === 0 ? f.slice(5) : null; };
  const built = (e) => (e.frame && e.frame.build) || {};
  const weightOf = (e) => F.weights[PL[built(e).legs]] || F.weights.medium || {};
  const driveOf = (e) => PB[built(e).booster] || 'jet';
  // (the hangar and the briefing play the menus' cues; a press on them unlocks the sound as a press on the field does)
  window.__mojUiCue = function (c) { play(F.ui && F.ui[c], 0.7); };
  window.addEventListener('pointerdown', __beatsUnlock, true);
  const voice = (tab, k, spec, level) => {
    if (tab[k] !== undefined) return tab[k];
    try { const g = __beatsCtx.createGain(); g.gain.value = 0; g.connect(__beatsEng.master); const h = __beatsEng.sustain(spec, g); tab[k] = { h, g, level: level == null ? 1 : level }; }
    catch (err) { tab[k] = null; }
    return tab[k];
  };
  const hold = (v, ctl, lv) => { if (!v) return; v.h.set(ctl); v.g.gain.setTargetAtTime(Math.max(0, lv) * v.level, __beatsCtx.currentTime, 0.12); };
  (function __beatsFrame() {
    requestAnimationFrame(__beatsFrame);
    if (!__beatsEng || !__beatsCtx) return;
    const Wd = window.__mojCtrl && window.__mojCtrl.world;
    if (!Wd) return;
    const P = Wd.byId && Wd.pilotId ? Wd.byId[Wd.pilotId] : null, hush = held() || __beatsMuted;
    const thrust = {}, hum = {};
    // (the power-up: the first moment the frame is free, the hangar and the briefing down)
    if (!booted && !held() && P) { booted = true; play(CK.boot, 0.8); }
    // (the rounds: a missile of a unit's own, a missile homing on the pilot)
    const now = {};
    for (const p of Wd.projectiles || []) {
      now[p.id] = 1;
      if (first || hush || rounds[p.id] || !p.missile) continue;
      const o = Wd.byId && Wd.byId[p.owner], k = o && kindOf(o), U = k && F.units && F.units[k];
      if (U && U.missile) { const l = L[o.id]; if (!l || Wd.time - (l.mT || -9) > 0.5) { play(U.missile, __proxGain(o.transform.pos)); if (l) l.mT = Wd.time; } }
      if (P && p.owner !== P.id && p.homing && p.homing.target === P.id && Wd.time - warnT > WARN_EVERY) { warnT = Wd.time; play(CK.warn, 0.6); }
    }
    rounds = now;
    // (bursts: a splash round's, where it went off)
    const top = Wd.bursts && Wd.bursts.length ? Wd.bursts[Wd.bursts.length - 1].seq : -1;
    if (bSeq !== null && !hush) for (const b of Wd.bursts || []) if (b.seq > bSeq && (b.radius || 0) >= BURST_SMALL && Wd.time - burstT > 0.06) { burstT = Wd.time; play(b.radius >= BURST_BIG ? W0.blast : W0.burst, __proxGain(b.pos)); }
    bSeq = Math.max(bSeq === null ? -1 : bSeq, top);
    for (const e of Wd.entities) {
      if (e.dormant) continue;
      const fr = e.rule && e.rule.type === 'frame', k = fr ? null : kindOf(e), U = k && F.units && F.units[k];
      if (!fr && !U) continue;
      const S = fr ? e.rule.slots || {} : null;
      const l = L[e.id] || (L[e.id] = { hp: hpOf(e), down: !!e.downed || (hpOf(e) != null && hpOf(e) <= 0), hits: e.hits || 0, shield: !!e.shieldBroken,
        boost: !!e.boosting, qb: (e.qbT || 0) > 0, landed: e.landed, air: !!e.airborne, asc: !!e.ascending, en: !!e.enShut, lock: !!e.locked,
        step: Math.floor((e.gaitPhase || 0) * 2), slot: {}, wShots: e.weapon ? e.weapon.shots || 0 : 0, hitT: -9 });
      const down = !!e.downed || (hpOf(e) != null && hpOf(e) <= 0), g = at(e, P);
      if (!first && !hush) {
        if (down && !l.down) play(fr ? W0.wreck : U.down, g);
        else if (!down) {
          // (struck: on its shield while it stands, on its plates; its shield broken)
          if ((e.hits || 0) > l.hits && Wd.time - l.hitT > 0.1) {
            // (a frame's round by its weapon's kind: the one its hitter last fired, a beam's sear, a blade's cut)
            const by = Wd.byId && Wd.byId[e.lastHitBy], bs = by && by.rule && by.rule.type === 'frame' && by.lastShot && by.rule.slots ? by.rule.slots[by.lastShot.slot] : null, A = bs && F.arms ? F.arms[bs.kind] : null;
            l.hitT = Wd.time; play(e.shieldHp > 0 && !e.shieldBroken ? W0.shield : (A && A.hit) || W0.struck, g == null ? 0.7 : g * 0.7);
          }
          if (e.shieldBroken && !l.shield) play(W0.shieldBreak, g);
          if (fr) {
            const Wt = weightOf(e), D = F.drives[driveOf(e)] || {};
            const step = Math.floor((e.gaitPhase || 0) * 2);
            if (!e.airborne && e.locomotion === 'forward' && step !== l.step) play(Wt.step, (g == null ? 1 : g) * FRAME_STEP_GAIN);
            l.step = step;
            if (e.landed != null && e.landed !== l.landed) play(Wt.land, g);
            else if (l.air && !e.airborne) play(Wt.land, (g == null ? 1 : g) * 0.4);
            if (e.boosting && !l.boost) play(D.boost, g == null ? 0.8 : g * 0.8);
            if ((e.qbT || 0) > 0 && !l.qb) play(D.quick, g);
            if (e === P) {
              if (e.ascending && !l.asc && !e.boosting) play(CK.jump, 0.7);
              if (e.enShut && !l.en) play(CK.enOut, 0.8);
              if (!e.enShut && l.en) play(CK.enBack, 0.6);
              if (e.locked && !l.lock) play(CK.lock, 0.5);
            }
            // (each slot's rounds by the weapon's kind; a charge begun; an automatic no closer than its every)
            for (const s in S) {
              const Wp = S[s], st = Wp && Wp.st;
              if (!st) continue;
              const A = (F.arms && F.arms[Wp.kind]) || {}, ls = l.slot[s] || (l.slot[s] = { shots: st.shots || 0, charge: st.charge || 0, t: -9 });
              if ((st.charge || 0) > 0 && !(ls.charge > 0)) play(A.charge, g);
              if ((st.shots || 0) > ls.shots && Wd.time - ls.t >= (A.every || 0)) { ls.t = Wd.time; play(ls.charge >= 0.9 && A.charged ? A.charged : A.shot, g); }
              ls.shots = st.shots || 0; ls.charge = st.charge || 0;
            }
          } else if (e.weapon && (e.weapon.shots || 0) > l.wShots && Wd.time - (l.uT || -9) >= (U.every || 0)) { l.uT = Wd.time; play(U.shot, g); }
        }
      }
      if (fr && !down && e.thrust > 0) { const d = driveOf(e), v = e.thrust * (g == null ? 1 : g); if (!(thrust[d] >= v)) thrust[d] = v; }
      if (U && U.hum && !down && !e.gone) { const v = __proxGain(e.transform.pos); if (!(hum[k] >= v)) hum[k] = v; }
      l.hp = hpOf(e); l.down = down; l.hits = e.hits || 0; l.shield = !!e.shieldBroken; l.boost = !!e.boosting; l.qb = (e.qbT || 0) > 0;
      l.landed = e.landed; l.air = !!e.airborne; l.asc = !!e.ascending; l.en = !!e.enShut; l.lock = !!e.locked; l.wShots = e.weapon ? e.weapon.shots || 0 : 0;
    }
    // (the thrust held by its drive, the units' hums: silent while the field is held)
    for (const d in F.drives) if (F.drives[d].held && (thrust[d] > 0 || drives[d])) { const v = voice(drives, d, F.drives[d].held, 0.6), x = hush ? 0 : Math.min(1, thrust[d] || 0); hold(v, x, x > 0 ? 1 : 0); }
    for (const k in F.units || {}) if (F.units[k].hum && (hum[k] > 0 || hums[k])) { const v = voice(hums, k, F.units[k].hum, 0.5); hold(v, FRAME_HUM, hush ? 0 : hum[k] || 0); }
    first = false;
  })();
})();
`;
}
