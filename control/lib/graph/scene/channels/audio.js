import { buildBeatsKernel } from '../../beats/beats-kernel.js';
import { MSG_AUDIO as GAME_MSG_AUDIO } from '../../game/level-contract.js';
import { PATCHES as BEATS_PATCHES } from '../../beats/audio-patches.js';
import { safeJson } from '../emit-util.js';

// audio channel (beats.plan.md): synthesized WebAudio presence over the live World — an ambient
// soundtrack, bus-event SFX stingers, gait/walk footsteps, and wind. Emitted ONLY when the payload
// carries `audio` AND the run is not a capture (muted headless bakes stay byte-identical); the
// returned string starts with '\n' and the call site interpolates '' when absent, so a world
// without audio emits byte-identical HTML to today. Presentation, not simulation: everything here
// READS sim state (bus events, gait phase, camera motion) and never writes back. The browser
// autoplay policy needs a user gesture — the canvas's existing click/pointer-lock entry is the
// unlock; a small HUD speaker toggles mute after that.
export function audioChannelScript(audio) {
  return `
// ---- beats audio channel (opt-in, presentation-only) ----
const __AUDIO = ${safeJson(audio)};
const __BEATS_PATCHES = ${safeJson(BEATS_PATCHES)};
const __BEATS = (${buildBeatsKernel.toString()})();
let __beatsCtx = null, __beatsEng = null, __beatsMuted = false, __beatsVol = 1;
// one write path for mute × volume (0.9 is the engine's stock master level); suspend keeps
// CPU quiet while muted. resume() only sticks post-gesture — the pointerdown unlock owns that.
function __beatsApply() {
  __beatsBtn.textContent = __beatsMuted ? '\\u{1F507}' : '\\u{1F50A}';
  if (!__beatsEng) return;
  __beatsEng.master.gain.value = __beatsMuted ? 0 : 0.9 * __beatsVol;
  if (__beatsMuted) __beatsCtx.suspend(); else __beatsCtx.resume().catch(() => {});
}
function __beatsUnlock() {
  if (__beatsCtx) { if (__beatsCtx.state === 'suspended' && !__beatsMuted) __beatsCtx.resume(); return; }
  __beatsCtx = new (window.AudioContext || window.webkitAudioContext)();
  __beatsEng = __BEATS.createEngine(__beatsCtx);
  if (__AUDIO.soundtrack) {
    if (__AUDIO.soundtrack.kind === 'beats-composition') __beatsEng.startComposition(__AUDIO.soundtrack, __BEATS_PATCHES);
    else if (__AUDIO.soundtrack.kind === 'beats-pattern') __beatsEng.startPattern(__AUDIO.soundtrack, __BEATS_PATCHES);
    else __beatsEng.startAmbient(__AUDIO.soundtrack, __BEATS_PATCHES);
  }
  if (__AUDIO.wind) __beatsEng.wind(__AUDIO.wind);
  __beatsApply();   // prefs may have arrived over the sidecar before the unlock gesture
}
renderer.domElement.addEventListener('pointerdown', __beatsUnlock);
// audio sidecar (game shell settings → hosted world): presentation-only prefs, applied to the
// live engine or held until the unlock gesture creates one. Unversioned by design.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.moj !== '${GAME_MSG_AUDIO}') return;
  if (typeof d.on === 'boolean') __beatsMuted = !d.on;
  if (typeof d.volume === 'number' && isFinite(d.volume)) __beatsVol = Math.max(0, Math.min(1, d.volume));
  __beatsApply();
});
// HUD speaker: pre-unlock it advertises sound; after, it toggles mute (suspend keeps CPU quiet).
// Carries a class so a chrome-less host (?hud=0 — the game shell) can hide it; the shell's own
// settings panel drives the same state over the sidecar.
const __beatsBtn = document.createElement('button');
__beatsBtn.className = 'moj-audio-btn';
__beatsBtn.textContent = '\\u{1F507}';
__beatsBtn.title = 'sound (click world to start)';
__beatsBtn.setAttribute('aria-label', 'toggle sound');
__beatsBtn.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:12;width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(10,12,18,.55);color:#dfe6f2;font-size:15px;cursor:pointer';
__beatsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
__beatsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!__beatsCtx) { __beatsUnlock(); return; }
  __beatsMuted = !__beatsMuted;
  __beatsApply();
});
document.body.appendChild(__beatsBtn);
// PROXIMITY audio (R28): the LISTENER is the piloted suit; a combat cue's volume scales down with the
// distance from you to its SOURCE, so a firefight across the map is a faint thud, not a full-volume
// pew in your ear. gain is passed to playCue's velScale (null dest -> master). No pilot (or no source
// point) -> gain 1 (unchanged), so non-combat / single-figure worlds are unaffected.
function __listenerPos() {
  var w = window.__mojCtrl && window.__mojCtrl.world;
  if (w && w.pilotId && w.byId && w.byId[w.pilotId] && w.byId[w.pilotId].transform) return w.byId[w.pilotId].transform.pos;
  return null;
}
function __proxGain(srcPos) {
  var L = __listenerPos();
  if (!L || !srcPos) return 1;
  var dx = srcPos[0] - L[0], dy = srcPos[1] - L[1], dz = srcPos[2] - L[2];
  var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d <= 250) return 1;         // NEAR: your own fight + point-blank rivals at full
  if (d >= 900) return 0;         // FAR: across the arena -> silent (skip the synth)
  return (900 - d) / 650;         // rolloff between
}
function __beatsCue(cue, gain) { if (__beatsEng && !__beatsMuted && cue && (gain == null || gain > 0.02)) __beatsEng.playCue(cue, null, null, gain == null ? 1 : gain); }
// bus stingers: observe the drained event stream by wrapping the reducer entry — audio reads the
// events and never touches state, so bus determinism (hash → replay) is untouched.
if (__AUDIO.on && typeof __BUS !== 'undefined') {
  const __beatsGlob = (str, pat) => {
    if (pat === '*') return true;
    if (pat.indexOf('*') < 0) return String(str) === pat;
    return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*') + '$').test(String(str));
  };
  const __beatsPE = __BUS.processEvents;
  __BUS.processEvents = function (state, events) {
    for (const ev of events) {
      for (const pat in __AUDIO.on) {
        if (__beatsGlob(ev.type, pat)) { __beatsCue(__AUDIO.cues && __AUDIO.cues[__AUDIO.on[pat]]); break; }
      }
    }
    return __beatsPE(state, events);
  };
}
// footsteps: two sources, both read-only. Controllable entities expose gait edges (gaitPhase /
// jumped / landed — controllable-world.js computes them for exactly this); first-person walk mode
// has no entity, so accumulated camera travel stands in for stride. Half-gait crossings = steps.
if (__AUDIO.footsteps) {
  const __gaitLast = {};
  let __walkAcc = 0;
  const __walkPrev = { x: null, y: null };
  (function __beatsGait() {
    requestAnimationFrame(__beatsGait);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (ctrl) {
      for (const e of ctrl.entities) {
        // when a suit switcher is present, only the PILOTED suit's steps sound — a distant ambient
        // mech marching should not stomp full-volume in your ear (audio here is non-positional). No
        // pilot => every walker sounds (single-figure walk worlds unchanged).
        if (ctrl.pilotId && e.id !== ctrl.pilotId) continue;
        const last = __gaitLast[e.id] || (__gaitLast[e.id] = { ix: 0, jumped: false, landed: false });
        const ix = Math.floor((e.gaitPhase || 0) * 2);
        if (e.moving && e.grounded !== false && ix !== last.ix) __beatsCue(__AUDIO.footsteps.step);
        if (e.jumped && !last.jumped) __beatsCue(__AUDIO.footsteps.jump);
        if (e.landed && !last.landed) __beatsCue(__AUDIO.footsteps.land);
        last.ix = ix; last.jumped = !!e.jumped; last.landed = !!e.landed;
      }
    }
    if (typeof walkOn !== 'undefined' && walkOn) {
      if (__walkPrev.x !== null) {
        __walkAcc += Math.hypot(camera.position.x - __walkPrev.x, camera.position.y - __walkPrev.y);
        if (__walkAcc > 2.2) { __walkAcc = 0; __beatsCue(__AUDIO.footsteps.step); }
      }
      __walkPrev.x = camera.position.x; __walkPrev.y = camera.position.y;
    } else { __walkPrev.x = null; __walkPrev.y = null; }
  })();
}
// weapon SFX: watch controllable entities' weapon state (read-only, presentation-only — the same
// posture as footsteps) and fire a cue on each new round (weapon.shots increments), and optionally
// on a landed hit / on a reload. Muted-capture-safe: the whole audio channel is absent on captures.
if (__AUDIO.weapon) {
  const __wLast = {};
  (function __beatsGun() {
    requestAnimationFrame(__beatsGun);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (!ctrl) return;
    for (const e of ctrl.entities) {
      if (!e.weapon) continue;
      const last = __wLast[e.id] || (__wLast[e.id] = { w: e.weapon, shots: e.weapon.shots || 0, charge: e.weapon.chargeCount || 0, reloading: !!e.weapon.reloading, hitT: null });
      if (last.w !== e.weapon) {
        last.w = e.weapon; last.shots = e.weapon.shots || 0; last.charge = e.weapon.chargeCount || 0; last.reloading = !!e.weapon.reloading; last.hitT = null;
      }
      // per-weapon SFX (initWeapon carries e.weapon.sfx): a loadout's beam rifle and machine gun
      // sound DIFFERENT, so the active weapon's own cue wins over the world-level fallback. A
      // switch swaps e.weapon by reference, so this re-reads the live weapon's sound every frame.
      const __ws = e.weapon.sfx || null;
      const __shot = (__ws && __ws.shot) || __AUDIO.weapon.shot;
      const __charge = (__ws && __ws.charge) || __AUDIO.weapon.charge;
      const __chargedShot = (__ws && __ws.chargedShot) || __AUDIO.weapon.chargedShot;
      const __hit = (__ws && __ws.hit) || __AUDIO.weapon.hit;
      const __reload = (__ws && __ws.reload) || __AUDIO.weapon.reload;
      // R28 proximity: the SHOT scales by the shooter's distance from you; the HIT by the impact point
      // (lastShot.to — where it landed, which may be nearer you than the shooter), the reload by the shooter.
      if (__charge && (e.weapon.chargeCount || 0) > last.charge) __beatsCue(__charge, __proxGain(e.transform.pos));
      const __shotCue = e.lastShot && e.lastShot.charged ? (__chargedShot || __shot) : __shot;
      if (__shotCue && (e.weapon.shots || 0) > last.shots) __beatsCue(__shotCue, __proxGain(e.transform.pos));
      if (__hit && e.lastShot && (e.lastShot.mode === 'core' || e.lastShot.mode === 'assist') && e.lastShot.t !== last.hitT) { __beatsCue(__hit, __proxGain(e.lastShot.to || e.transform.pos)); last.hitT = e.lastShot.t; }
      if (__reload && e.weapon.reloading && !last.reloading) __beatsCue(__reload, __proxGain(e.transform.pos));
      last.shots = e.weapon.shots || 0; last.charge = e.weapon.chargeCount || 0; last.reloading = !!e.weapon.reloading;
    }
  })();
}
// strike (melee) SFX: the beam saber's overhead cross. Read-only sim-state → SFX, the same
// posture as footsteps/weapon. 'swing' fires on each swing START (e.swingCount edge — the
// crackling-ozone whoosh); 'hit' fires whenever the blade CONNECTS (e.meleeHitCount edge — the
// distinct impact clash). A swing that whiffs plays only the swing cue; a connect plays both.
// (No backticks in this comment on purpose — it lives inside an emitted template literal.)
if (__AUDIO.strike) {
  const __mLast = {};
  (function __beatsMelee() {
    requestAnimationFrame(__beatsMelee);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (!ctrl) return;
    for (const e of ctrl.entities) {
      const last = __mLast[e.id] || (__mLast[e.id] = { swing: e.swingCount || 0, hit: e.meleeHitCount || 0 });
      if (__AUDIO.strike.swing && (e.swingCount || 0) > last.swing) __beatsCue(__AUDIO.strike.swing, __proxGain(e.transform.pos));   // R28 proximity: distant swings fade
      if (__AUDIO.strike.hit && (e.meleeHitCount || 0) > last.hit) __beatsCue(__AUDIO.strike.hit, __proxGain(e.transform.pos));
      last.swing = e.swingCount || 0; last.hit = e.meleeHitCount || 0;
    }
  })();
}
// DODGE (acrobatic roll) SFX: fired once per roll on the e.dodgeCount edge. The cue is a single
// beats gesture list whose per-gesture time offsets lay out THREE landing-like beats across the
// tumble — LAND (0), ROLL (mid), STAND (end) — so playing it once schedules all three at their
// phase times. Piloted suit only (the ambient mech's rolls should not sound in your ear). Read-only.
// (No backticks in this comment on purpose — it lives inside an emitted template literal.)
if (__AUDIO.dodge) {
  const __dLast = {};
  (function __beatsDodge() {
    requestAnimationFrame(__beatsDodge);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (!ctrl) return;
    for (const e of ctrl.entities) {
      if (ctrl.pilotId && e.id !== ctrl.pilotId) continue;
      const last = __dLast[e.id] || (__dLast[e.id] = { c: e.dodgeCount || 0 });
      if ((e.dodgeCount || 0) > last.c) __beatsCue(__AUDIO.dodge);
      last.c = e.dodgeCount || 0;
    }
  })();
}
// thruster ROAR (boost, the F key): a SUSTAINED rocket-engine voice — the acoustic twin of the
// visual jets. Unlike the one-shot cues above it is a continuous, gain-modulated noise bed that
// SWELLS with e.thrust (the same 0..1 the platform rule flags on boost and the jets read) and dies
// on release. Two seeded-noise layers (a bright roar + a deep rumble) plus a low sub-tone, summed
// into one gain that rides the thrust via setTargetAtTime (an exponential spool-up / spool-down),
// with an LFO wobbling the roar cutoff for combustion flutter. Read-only + presentation-only like
// every other layer; built lazily on first unlock. (No backticks — this lives in a template literal.)
if (__AUDIO.thruster) {
  let __thr = null;
  const __thrBuild = () => {
    const ctx = __beatsCtx, master = __beatsEng.master;
    // seeded white-noise buffer (2s loop) — an LCG, never Math.random (beats determinism rule)
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 0x9e3779b1 >>> 0;
    for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 0x7fffffff) - 1; }
    // SMOOTH + TONAL (this plays constantly, so it is a soft high jet-WHINE, not a rough hiss):
    // roughness lives in the noise, so the noise is turned DOWN and band-limited high (airy, not
    // gritty), with a whisper of warm body under it, and a soft high SINE tone riding on top — a
    // pitched whine that is smooth by nature and lifts the whole thing higher. A slow sine LFO
    // breathes the cutoff for gentle life (no fast flutter — that was the grating part).
    const airSrc = ctx.createBufferSource(); airSrc.buffer = buf; airSrc.loop = true;
    const airHp = ctx.createBiquadFilter(); airHp.type = 'highpass'; airHp.frequency.value = 500; airHp.Q.value = 0.4;
    const airLp = ctx.createBiquadFilter(); airLp.type = 'lowpass'; airLp.frequency.value = 2400; airLp.Q.value = 0.3;
    const airG = ctx.createGain(); airG.gain.value = 0.5;   // noise turned down — the roughness lives here
    const midSrc = ctx.createBufferSource(); midSrc.buffer = buf; midSrc.loop = true;
    const midLp = ctx.createBiquadFilter(); midLp.type = 'lowpass'; midLp.frequency.value = 900; midLp.Q.value = 0.3;
    const midG = ctx.createGain(); midG.gain.value = 0.16;   // faint warm body so it is not thin
    const tone = ctx.createOscillator(); tone.type = 'sine'; tone.frequency.value = 760;   // the pitched whine
    const toneG = ctx.createGain(); toneG.gain.value = 0.16;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.1;   // slow, gentle breath
    const lfoG = ctx.createGain(); lfoG.gain.value = 110;
    lfo.connect(lfoG); lfoG.connect(airLp.frequency);
    const g = ctx.createGain(); g.gain.value = 0;   // the swell — driven by e.thrust every frame
    airSrc.connect(airHp); airHp.connect(airLp); airLp.connect(airG); airG.connect(g);
    midSrc.connect(midLp); midLp.connect(midG); midG.connect(g);
    tone.connect(toneG); toneG.connect(g);
    g.connect(master);
    airSrc.start(); midSrc.start(); tone.start(); lfo.start();
    return { g, airLp, tone, level: __AUDIO.thruster.level == null ? 0.4 : __AUDIO.thruster.level };
  };
  (function __beatsThruster() {
    requestAnimationFrame(__beatsThruster);
    if (!__beatsEng) return;
    if (!__thr) { try { __thr = __thrBuild(); } catch (e) { return; } }
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    let thrust = 0;
    if (ctrl) for (const e of ctrl.entities) { const v = e.thrust || 0; if (v > thrust) thrust = v; }
    if (__beatsMuted) thrust = 0;
    thrust = Math.max(0, Math.min(1, thrust));
    const now = __beatsCtx.currentTime;
    __thr.g.gain.setTargetAtTime(thrust * __thr.level, now, 0.07);          // exponential spool up/down
    __thr.airLp.frequency.setTargetAtTime(1900 + thrust * 1700, now, 0.1);  // airy band brightens as it winds up
    __thr.tone.frequency.setTargetAtTime(720 + thrust * 620, now, 0.12);    // the whine rises 720 -> 1340 Hz
  })();
}
// JUMP audio (charge / release / land): the stop-and-charge GATHERS like a mech loading up — a low
// hydraulic SERVO STRAIN (a resonant sawtooth-through-lowpass motor, not a cartoon tone) with rhythmic
// PISTON chuffs that speed up as it coils (e.chargeFrac) — then a piston-SLAM RELEASE on launch whose
// weight scales with how long it was held (e.jumpPower), and a metal CLANG when the suit lands (scaled
// by the fall speed e.landVel). Charge + release are raw synth (dynamic, like the thruster); land is an
// authored beats cue. Read-only + presentation-only; built lazily on unlock. (No backticks in here.)
if (__AUDIO.jump) {
  const __J = __AUDIO.jump;
  let __jn = null;
  const __jLast = {};
  const __jBuild = () => {
    const ctx = __beatsCtx, master = __beatsEng.master;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
    const d = buf.getChannelData(0); let s = 0x1a2b3c4d >>> 0;
    for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 0x7fffffff) - 1; }
    // the GATHER = a hydraulic servo STRAIN: a low sawtooth through a resonant lowpass (a motor
    // loading up, not a tone), gated by charging. Piston chuffs layer on top in the loop.
    const motor = ctx.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 66;
    const motorLp = ctx.createBiquadFilter(); motorLp.type = 'lowpass'; motorLp.frequency.value = 300; motorLp.Q.value = 4;
    const motorG = ctx.createGain(); motorG.gain.value = 0;
    motor.connect(motorLp); motorLp.connect(motorG); motorG.connect(master); motor.start();
    return { buf, motor, motorLp, motorG, chuffPh: 0, lastT: ctx.currentTime, level: (__J.charge && __J.charge.level) || 0.26 };
  };
  // one PISTON chuff: a short highpassed+lowpassed noise thump — a mechanical CHUNK, brighter + firmer
  // as the charge builds. Fired rhythmically from the loop at a rate that rises with the charge.
  const __jChuff = (frac) => {
    const ctx = __beatsCtx, master = __beatsEng.master, t0 = ctx.currentTime;
    const nz = ctx.createBufferSource(); nz.buffer = __jn.buf; nz.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 130;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480 + frac * 520; lp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime((0.13 + frac * 0.17) * __jn.level, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    nz.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master); nz.start(t0); nz.stop(t0 + 0.08);
  };
  const __jFireRelease = (p) => {
    const ctx = __beatsCtx, master = __beatsEng.master, t0 = ctx.currentTime;
    const lvl = (__J.release && __J.release.level) || 0.5;
    // a PISTON SLAM: a sharp pneumatic air-release burst + a deep SINE launch thunk (sine, not saw —
    // a weighty thunk, not a cartoon boing). Depth + length scale with the charge held.
    const nz = ctx.createBufferSource(); nz.buffer = __jn.buf; nz.loop = true;
    const nhp = ctx.createBiquadFilter(); nhp.type = 'highpass'; nhp.frequency.value = 300;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 1100 + p * 1500;
    const ng = ctx.createGain(); ng.gain.setValueAtTime((0.2 + p * 0.28) * lvl, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08 + p * 0.12);
    nz.connect(nhp); nhp.connect(nlp); nlp.connect(ng); ng.connect(master); nz.start(t0); nz.stop(t0 + 0.32);
    const dur = 0.12 + p * 0.2;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(180 - p * 55, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(28, 72 - p * 40), t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime((0.4 + p * 0.5) * lvl, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.1);
  };
  (function __beatsJump() {
    requestAnimationFrame(__beatsJump);
    if (!__beatsEng || __beatsMuted) return;
    if (!__jn) { try { __jn = __jBuild(); } catch (e) { return; } }
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    let frac = 0, charging = false;
    if (ctrl) for (const e of ctrl.entities) {
      if (e.charging) { charging = true; if ((e.chargeFrac || 0) > frac) frac = e.chargeFrac || 0; }
      const last = __jLast[e.id] || (__jLast[e.id] = { j: false, l: false });
      if (__J.release && e.jumped && !last.j) __jFireRelease(Math.max(0, Math.min(1, e.jumpPower || 0)));
      if (__J.land && e.landed && !last.l) {
        const vel = Math.min(1, (e.landVel || 0) / (__J.landRef || 30));   // fall speed -> clang loudness
        __beatsEng.playCue(__J.land, __beatsCtx.currentTime, __beatsEng.master, 0.55 + vel * 0.75);
      }
      last.j = !!e.jumped; last.l = !!e.landed;
    }
    const now = __beatsCtx.currentTime;
    const dtJ = Math.min(0.1, Math.max(0, now - __jn.lastT)); __jn.lastT = now;
    // servo strain rises + tightens as it gathers; the resonant cutoff climbs so the motor "loads up"
    __jn.motor.frequency.setTargetAtTime(66 + frac * 74, now, 0.05);
    __jn.motorLp.frequency.setTargetAtTime(240 + frac * 520, now, 0.06);
    __jn.motorG.gain.setTargetAtTime(charging ? (0.16 + frac * 0.34) * __jn.level : 0, now, 0.03);
    // piston chuffs: 4/sec at rest -> ~13/sec at full coil (the pistons pumping faster as it gathers)
    if (charging) { __jn.chuffPh += dtJ * (4 + frac * 9); while (__jn.chuffPh >= 1) { __jn.chuffPh -= 1; __jChuff(frac); } }
    else __jn.chuffPh = 0;
  })();
}
// world bindings (B5.3): sim-state selectors → soundtrack channel macros, evaluated per frame.
// Read-only and one-directional — the binding READS the camera / controllable entities and writes
// only into the audio engine's B5.2 macro state (tone / level / transpose); nothing flows back into
// sim state, so bus determinism and capture byte-identity are untouched (capture never emits audio).
if (__AUDIO.bindings && __AUDIO.bindings.length) {
  const __bindLast = new Array(__AUDIO.bindings.length).fill(null);
  const __bindKin = { pos: null, t: 0, speed: 0 };
  function __bindEntityPos(id) {
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (!ctrl) return null;
    for (const e of ctrl.entities) if (e.id === id) return e.position;
    return null;
  }
  (function __beatsBind() {
    requestAnimationFrame(__beatsBind);
    if (!__beatsEng || __beatsMuted) return;
    const now = performance.now() / 1000;
    const cam = [camera.position.x, camera.position.y, camera.position.z];
    if (__bindKin.pos) {
      const dt = Math.min(0.1, Math.max(1e-3, now - __bindKin.t));
      const d = Math.hypot(cam[0] - __bindKin.pos[0], cam[1] - __bindKin.pos[1], cam[2] - __bindKin.pos[2]);
      __bindKin.speed += (d / dt - __bindKin.speed) * 0.15;   // smoothed travel speed
    }
    __bindKin.pos = cam; __bindKin.t = now;
    __AUDIO.bindings.forEach((b, i) => {
      let v = null;
      if (b.source === 'speed') v = __bindKin.speed;
      else if (b.source === 'proximity') {
        const ref = b.point || __bindEntityPos(b.entity);
        if (ref) v = Math.hypot(cam[0] - ref[0], cam[1] - ref[1], cam[2] - ref[2]);
      } else {
        const pos = b.entity ? __bindEntityPos(b.entity) : cam;
        if (pos) v = b.source === 'depth' ? -pos[2] : pos[2];
      }
      if (v === null) return;
      const n = Math.max(0, Math.min(1, (v - b.range[0]) / (b.range[1] - b.range[0] || 1e-9)));
      const out = b.target.range[0] + n * (b.target.range[1] - b.target.range[0]);
      if (__bindLast[i] !== null && Math.abs(out - __bindLast[i]) < 0.002) return;
      __bindLast[i] = out;
      if (b.target.macro === 'tone') __beatsEng.setTone(b.target.channel, out);
      else if (b.target.macro === 'level') __beatsEng.setLevel(b.target.channel, out);
      else __beatsEng.setTranspose(b.target.channel, out);
    });
  })();
}`;
}
