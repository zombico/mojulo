import { emitBeatsKernel } from '../../beats/beats-kernel.js';
import { audioFeatures, gestureSampleCards, pagePatches } from '../../beats/beats-features.js';
import { sampleSliceBase64 } from '../../sound-library/library.js';
import { MSG_AUDIO as GAME_MSG_AUDIO } from '../../game/level-contract.js';
import { safeJson } from '../emit-util.js';
import { weatherAudioScript } from '../../beats/weather-audio.js';
import { buildAdaptive } from '../../beats/adaptive-music.js';
import { runAudioScript } from './run-audio.js';

// audio channel (beats.plan.md): synthesized WebAudio presence over the live World — an ambient
// soundtrack, bus-event SFX stingers, gait/walk footsteps, and wind. Emitted ONLY when the payload
// carries `audio` AND the run is not a capture (muted headless bakes stay byte-identical); the
// returned string starts with '\n' and the call site interpolates '' when absent, so a world
// without audio emits byte-identical HTML to today. Presentation, not simulation: everything here
// READS sim state (bus events, gait phase, camera motion) and never writes back. The browser
// autoplay policy needs a user gesture — the canvas's existing click/pointer-lock entry is the
// unlock; a small HUD speaker toggles mute after that.
export function audioChannelScript(audio) {
  // adaptive music (audio.combat): the scores play on two engines of their own, crossfaded; the first engine keeps the
  // cues, footsteps and wind at a steady level. Without it every line below is as it was.
  const combat = !!audio.combat;
  // the effects' level under the score (audio.sfxLevel, 0..1, opt-in): the cue engine's own master, where the scores play
  // on engines of their own (combat); absent, the stock 0.9
  const sfxGain = combat && Number.isFinite(audio.sfxLevel) ? Math.round(0.9 * audio.sfxLevel * 1000) / 1000 : 0.9;
  // the boss's piece (audio.boss, with combat): a third engine, changed to for good once the boss's room has shut
  const bossOn = combat && !!audio.boss;
  const musicEng = combat ? '(__engs ? __engs[__music.active] : __beatsEng)' : '__beatsEng';
  // the SFX mixer (audio.mix, opt-in): the cues on a bus in a space, ducks dipping the score, a voice cap, a cue placed
  // by its distance from the pilot. Absent, not a byte of it is emitted.
  const mix = audio.mix || null, mixFar = !!(mix && mix.distance);
  // (the mix's reach, opt-in with its distance: the metres a cue is heard to, for a range of big guns whose shells burst
  // kilometres off; absent, the arena's 900)
  const reach = mixFar && mix.reach > 900 ? mix.reach : 0;
  // held voices (the sustain feature): a thruster or a jump charge given a `voice` plays it, not its own synth
  // the ground by place (audio.surfaces, opt-in) and the sounds of a place (audio.emitters, opt-in): absent, not a byte
  const surf = !!(audio.surfaces && audio.surfaces.length), fsOf = surf ? '__fsOf(e)' : '__AUDIO.footsteps';
  const emit = !!(audio.emitters && audio.emitters.length);
  const thrHeld = !!(audio.thruster && audio.thruster.voice), jumpHeld = !!(audio.jump && audio.jump.charge && audio.jump.charge.voice);
  // an environment's bed (audio.bed, sfx-shelf/beds.js): a pattern of the shelf's one-shots on its own engine, under the
  // score at its own level. Absent, not a byte of it is emitted.
  const bed = !!audio.bed, bedLevel = Number(audio.bedLevel ?? 0.5);
  // recorded sounds (the sound library's, opt-in): the samples the payload's recorded gestures name, inlined when this
  // machine holds them, decoded by the cue engine at the unlock; a cue before they are decoded plays its synthesized
  // fallback. A payload without recorded gestures (every world where the library is not installed) emits nothing here.
  const cards = gestureSampleCards(audio), samples = cards.length ? sampleSliceBase64(cards) : null;
  // a city's cars' own events (audio.engine.cueOf, sound-sheet.js citySounds): the car taken heard by its own cues, and the
  // events only some cars have (a siren, a reverse beeper, a backfire, the lock); absent, not a byte of it
  // a racing car's (a ride's) own events and tyres (audio.engine.ride, sound-sheet.js rideEvents): absent, not a byte of it
  const rideEv = !!(audio.engine && !audio.engine.cab && audio.engine.ride), rideHas = (k) => rideEv && !!(audio.cues && audio.cues[`ride:${k}`]);
  const carSets = !!(audio.engine && audio.engine.cab && audio.engine.cueOf), carHas = (k) => carSets && Object.keys(audio.cues || {}).some((c) => c.indexOf(`${k}@`) === 0);
  return `
// ---- beats audio channel (opt-in, presentation-only) ----
const __AUDIO = ${safeJson(audio)};
const __BEATS_PATCHES = ${safeJson(bossOn ? pagePatches(audio.soundtrack, audio.combat, audio.boss) : combat ? pagePatches(audio.soundtrack, audio.combat) : pagePatches(audio.soundtrack))};
const __BEATS = (${emitBeatsKernel(audioFeatures(audio))})();
let __beatsCtx = null, __beatsEng = null, __beatsMuted = false, __beatsVol = 1;${bed ? '\nlet __bedEng = null;' : ''}${samples ? `
const __SAMPLES = ${safeJson(samples)};` : ''}
// one write path for mute × volume (0.9 is the engine's stock master level); suspend keeps
// CPU quiet while muted. resume() only sticks post-gesture — the pointerdown unlock owns that.
function __beatsApply() {
  __beatsBtn.textContent = __beatsMuted ? '\\u{1F507}' : '\\u{1F50A}';
  if (!__beatsEng) return;
  __beatsEng.master.gain.value = __beatsMuted ? 0 : ${sfxGain} * __beatsVol;${bed ? `
  if (__bedEng) __bedEng.master.gain.value = __beatsMuted ? 0 : ${bedLevel} * __beatsVol;` : ''}${combat ? `
  if (__engs && !__switching) __engs[__music.active].master.gain.value = __beatsMuted ? 0 : 0.9 * __beatsVol;` : ''}
  if (__beatsMuted) __beatsCtx.suspend(); else __beatsCtx.resume().catch(() => {});
}
function __beatsUnlock() {
  if (__beatsCtx) { if (__beatsCtx.state === 'suspended' && !__beatsMuted) __beatsCtx.resume().catch(() => {}); return; }
  __beatsCtx = new (window.AudioContext || window.webkitAudioContext)();
  __beatsEng = __BEATS.createEngine(__beatsCtx);${samples ? `
  __beatsEng.loadSamples({ cards: __SAMPLES.cards, bytes: Object.fromEntries(Object.entries(__SAMPLES.bytes).map(([id, b]) => [id, Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer])), roots: __SAMPLES.roots, loops: __SAMPLES.loops, vels: __SAMPLES.vels, keyAt: __SAMPLES.keyAt, keyRoot: __SAMPLES.keyRoot });   // the recorded sounds` : ''}${mix ? `
  __beatsEng.setSfx(__AUDIO.mix);   // the SFX mixer: the cues' bus and space, and the music bus a duck dips (before the score starts)` : ''}
  if (__AUDIO.soundtrack) {${audio.beat ? `
    __beatT0 = __beatsCtx.currentTime + 0.08;   // the transport's own start (startTransport's t0): the beat clock's zero` : ''}
${combat ? `    __engs = { explore: __BEATS.createEngine(__beatsCtx), combat: __BEATS.createEngine(__beatsCtx)${bossOn ? ', boss: __BEATS.createEngine(__beatsCtx)' : ''} };${mix ? `
    __engs.explore.setSfx({}); __engs.combat.setSfx({}); __beatsEng.linkDuck(__engs.explore); __beatsEng.linkDuck(__engs.combat);   // a duck dips whichever score plays${bossOn ? '\n    __engs.boss.setSfx({}); __beatsEng.linkDuck(__engs.boss);' : ''}` : ''}
    __engs.combat.master.gain.value = 0;${bossOn ? ' __engs.boss.master.gain.value = 0;' : ''}
    __startTrack(__engs.explore, __AUDIO.soundtrack);
    __musicT0 = __beatsCtx.currentTime + 0.08;   // the explore piece's t0: its bar lines are where a change may land` : `    if (__AUDIO.soundtrack.kind === 'beats-composition') __beatsEng.startComposition(__AUDIO.soundtrack, __BEATS_PATCHES);
    else if (__AUDIO.soundtrack.kind === 'beats-pattern') __beatsEng.startPattern(__AUDIO.soundtrack, __BEATS_PATCHES);
    else __beatsEng.startAmbient(__AUDIO.soundtrack, __BEATS_PATCHES);`}
  }
  if (__AUDIO.wind) __beatsEng.wind(__AUDIO.wind);${bed ? `
  __bedEng = __BEATS.createEngine(__beatsCtx); __bedEng.startPattern(__AUDIO.bed, __BEATS_PATCHES);   // the environment's bed` : ''}
  __beatsApply();   // prefs may have arrived over the sidecar before the unlock gesture
}
renderer.domElement.addEventListener('pointerdown', __beatsUnlock);
// (a key, a pad's play or the game shell's word that sound is on also unlock it: a game played on the keys or hosted in the
// shell's frame, which delegates autoplay, is never clicked, and was silent)
window.addEventListener('keydown', __beatsUnlock);${audio.tension ? `
// THE TENSION (adaptive-music.js, the same closure the tests hold): raised by the level's own events off the bus log
// (like the stingers: the reducer drains reaction-emitted events internally), leaking back toward calm. Read-only.
const __ADAPT = (${buildAdaptive.toString()})();
const __TEN = __AUDIO.tension;
let __tension = 0, __tenLast = null;
if (typeof __BUS !== 'undefined') {
  const __tenPE = __BUS.processEvents;
  __BUS.processEvents = function (state, events) {
    const n0 = state.log.length, out = __tenPE(state, events);
    for (let i = n0; i < state.log.length; i++) { const ev = state.log[i]; if (ev && ev.type) __tension = __ADAPT.raise(__tension, ev.type, __TEN.on); }
    return out;
  };
}${combat ? `
// THE CHANGE: combat comes in when the tension reaches \`enter\`, on the playing piece's next bar line, crossfading over
// one bar; it goes back once the tension has stayed under \`exit\` for \`hold\` bars. Both pieces share the game's key.
let __engs = null, __music = { active: 'explore', below: 0 }, __musicT0 = null, __switching = false;
function __startTrack(eng, r) {
  if (r.kind === 'beats-composition') eng.startComposition(r, __BEATS_PATCHES);
  else if (r.kind === 'beats-pattern') eng.startPattern(r, __BEATS_PATCHES);
  else eng.startAmbient(r, __BEATS_PATCHES);
}
function __switchTo(to) {
  const from = __music.active, outEng = __engs[from], inEng = __engs[to];
  const bar = __ADAPT.barSeconds(from === 'explore' ? __AUDIO.soundtrack : ${bossOn ? "from === 'boss' ? __AUDIO.boss : " : ''}__AUDIO.combat);
  const now = __beatsCtx.currentTime, at = __ADAPT.nextBar(now + 0.25, __musicT0, bar);
  __switching = true;
  setTimeout(() => {
    __startTrack(inEng, to === 'explore' ? __AUDIO.soundtrack : ${bossOn ? "to === 'boss' ? __AUDIO.boss : " : ''}__AUDIO.combat);
    const t = __beatsCtx.currentTime + 0.08, vol = __beatsMuted ? 0 : 0.9 * __beatsVol;   // the new piece's t0: the bar line
    __musicT0 = t;
    inEng.master.gain.cancelScheduledValues(t); inEng.master.gain.setValueAtTime(0, t); inEng.master.gain.linearRampToValueAtTime(vol, t + bar);
    outEng.master.gain.cancelScheduledValues(t); outEng.master.gain.setValueAtTime(outEng.master.gain.value, t); outEng.master.gain.linearRampToValueAtTime(0, t + bar);
    __music = { active: to, below: 0 };
    setTimeout(() => { outEng.stop(); __switching = false; }, (bar + 0.2) * 1000);
  }, Math.max(0, (at - 0.08 - now) * 1000));
}` : ''}
(function __tensionLoop() {
  requestAnimationFrame(__tensionLoop);
  if (!__beatsCtx || __beatsCtx.state !== 'running') return;
  const now = __beatsCtx.currentTime, dt = __tenLast === null ? 0 : Math.min(0.25, now - __tenLast);
  __tenLast = now;
  __tension = __ADAPT.leak(__tension, dt, __TEN.decay);${combat ? `
  if (!__engs || __switching || __beatsMuted) return;${bossOn ? `
  // (the boss's room shut behind the hero, sidemap.js the camera's _shut: its piece, for good)
  if (__music.active === 'boss') return;
  const __cw = window.__mojCtrl && window.__mojCtrl.world, __sh = __cw && __cw.camera && __cw.camera._shut;
  if (__sh && Object.keys(__sh).some((k) => __sh[k] != null)) { __switchTo('boss'); return; }` : ''}
  const next = __ADAPT.decide(__music, __tension, dt, __TEN, __ADAPT.barSeconds(__AUDIO.combat));
  if (next.to) __switchTo(next.to); else __music = next;` : ''}
})();
window.__mojMusic = { get tension() { return __tension; }${combat ? ', get active() { return __music.active; }' : ''} };` : ''}${audio.beat ? `
// THE BEAT ON THE BUS (audio.beat): the music's own clock says each beat, \`lead\` seconds early (a judging window opens
// on it), as { type: 'beat', n }. No music playing (not started, muted), no beat: the clock is the AudioContext's.
let __beatT0 = null, __beatN = 0;
(function __beatClock() {
  requestAnimationFrame(__beatClock);
  if (__beatT0 === null || !__beatsCtx || __beatsMuted || __beatsCtx.state !== 'running' || typeof __inputQueue === 'undefined') return;
  const B = __AUDIO.beat, t = __beatsCtx.currentTime - __beatT0 + B.lead;
  let k = 0;
  while (__beatN * B.every <= t && k++ < 4) { if (t - __beatN * B.every < B.every) __inputQueue.push({ type: 'beat', n: __beatN }); __beatN++; }
})();` : ''}
// audio sidecar (game shell settings → hosted world): presentation-only prefs, applied to the
// live engine or held until the unlock gesture creates one. Unversioned by design.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.moj !== '${GAME_MSG_AUDIO}') return;
  if (typeof d.on === 'boolean') __beatsMuted = !d.on;
  if (typeof d.volume === 'number' && isFinite(d.volume)) __beatsVol = Math.max(0, Math.min(1, d.volume));
  if (d.on === true) __beatsUnlock();
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
${mixFar ? `// the SFX mixer's distance (audio.mix.distance): __proxGain also leaves the source's distance (d / 900 m) for the
// cue it scales, read once and only by the call that passes that same gain (a loop that only reads a gain leaves no
// distance for another cue) — a far cue duller and roomier, not only quieter.
let __pf = null;
__proxGain = (function (g) { return function (p) { var L = __listenerPos(), v = g(p); __pf = L && p ? { far: Math.min(1, Math.hypot(p[0] - L[0], p[1] - L[1], p[2] - L[2]) / 900), g: v } : null; return v; }; })(__proxGain);
${reach ? `// the mix's reach (audio.mix.reach): a source as far off as the arena's distances times its reach is heard as one at them
__proxGain = (function (g) { var k = ${900 / reach}; return function (p) { var L = __listenerPos(); return L && p ? g([L[0] + (p[0] - L[0]) * k, L[1] + (p[1] - L[1]) * k, L[2] + (p[2] - L[2]) * k]) : g(p); }; })(__proxGain);
` : ''}${audio.vary ? 'let __beatsVar = 0;\n' : ''}function __beatsCue(cue, gain) { var pl = __pf && gain != null && __pf.g === gain ? { far: __pf.far } : null; __pf = null; if (__beatsEng && !__beatsMuted && cue && (gain == null || gain > 0.02)) __beatsEng.playCue(cue, null, null, gain == null ? 1 : gain, ${audio.vary ? '++__beatsVar' : 'undefined'}, pl); }` : audio.vary ? `// audio.sfx.vary (opt-in): each fired cue is the next variant (seeded per-hit variation).
let __beatsVar = 0;
function __beatsCue(cue, gain) { if (__beatsEng && !__beatsMuted && cue && (gain == null || gain > 0.02)) __beatsEng.playCue(cue, null, null, gain == null ? 1 : gain, ++__beatsVar); }` : `function __beatsCue(cue, gain) { if (__beatsEng && !__beatsMuted && cue && (gain == null || gain > 0.02)) __beatsEng.playCue(cue, null, null, gain == null ? 1 : gain); }`}
${audio.breath ? `// one breath across the game's hits (audio.breath, the sound sheet's): each hit is played at the breath left (down to
// floor), spends spend of it, and a rest refills recover a second: a fast combo lightens, the first hit after a pause
// is the strongest
let __breath = 1, __breathT = 0;
__beatsCue = (function (play) { return function (cue, gain) {
  var now = __beatsCtx ? __beatsCtx.currentTime : 0;
  __breath = Math.min(1, __breath + (now - __breathT) * ${Number(audio.breath.recover)}); __breathT = now;
  var k = ${Number(audio.breath.floor)} + ${1 - Number(audio.breath.floor)} * __breath;
  __breath = Math.max(0, __breath - ${Number(audio.breath.spend)});
  return play(cue, gain == null ? k : gain * k);
}; })(__beatsCue);
` : ''}// bus stingers: observe the drained event stream by wrapping the reducer entry — audio reads the
// events and never touches state, so bus determinism (hash → replay) is untouched. Match the
// state.log DELTA, not the incoming array: the reducer cascades reaction-emitted events
// (goal:reached, pickup:*, door:*) internally, so only the log holds the whole drained stream.
if (__AUDIO.on && typeof __BUS !== 'undefined') {
  const __beatsGlob = (str, pat) => {
    if (pat === '*') return true;
    if (pat.indexOf('*') < 0) return String(str) === pat;
    return new RegExp('^' + pat.split('*').map((s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')).join('.*') + '$').test(String(str));
  };
  const __beatsPE = __BUS.processEvents, __beatsLast = {};
  __BUS.processEvents = function (state, events) {
    const n0 = state.log.length;
    const out = __beatsPE(state, events);
    for (let i = n0; i < state.log.length; i++) {
      const ev = state.log[i];
      if (!ev || !ev.type) continue;   // cap/noop markers carry no type
      for (const pat in __AUDIO.on) {
        if (!__beatsGlob(ev.type, pat)) continue;
        // one cue at most every 60 ms: a burst of the same event (ten pickups in one tick) is one sound, not a pile-up
        const id = __AUDIO.on[pat], now = performance.now();
        if (!(now - (__beatsLast[id] || -1e9) < 60)) { __beatsLast[id] = now; __beatsCue(__AUDIO.cues && __AUDIO.cues[id]); }
        break;
      }
    }
    return out;
  };
}
${audio.mount ? `// a RIDDEN ANIMAL (audio.mount, beats-world.js; the mount lane's horse): its hooves held by its speed over its top
// gait's while it is ridden and silent standing, a call as its rider settles in the saddle, a snort as it is urged up to
// its top gait. Read-only, as every layer here is.
(function () {
  const M = __AUDIO.mount, L = { id: null, gi: 0 };
  let H = null;
  (function __beatsMount() {
    requestAnimationFrame(__beatsMount);
    if (!__beatsEng) return;
    const c = window.__mojCtrl && window.__mojCtrl.world;
    if (!c) return;
    let h = null;
    for (const e of c.entities) if (e.mount && e.riderId && !e.gone) { const r = c.byId[e.riderId]; if (r && r.mountPhase === 'ride') { h = e; break; } }
    const G = (h && h.rule && h.rule.gaits) || [], top = G.length ? G[G.length - 1].v : 1;
    if (M.hooves) {
      if (h && !H) { try { H = __beatsEng.sustain(Object.assign({}, M.hooves, { level: (M.hooves.level == null ? 1 : M.hooves.level) * M.level })); } catch (e) { return; } }
      if (H) H.set(__beatsMuted || !h ? 0 : Math.max(0, Math.min(1, Math.abs(h.speed || 0) / (top || 1))));
    }
    if (h && L.id !== h.id) { if (M.mounted) __beatsCue(M.mounted); L.gi = 0; }
    if (h) { const gi = h.gaitIx | 0; if (M.gallop && G.length > 1 && gi === G.length - 1 && L.gi < gi) __beatsCue(M.gallop); L.gi = gi; }
    L.id = h ? h.id : null;
  })();
})();
` : ''}${audio.battle ? `// an RPG BATTLE's sounds (audio.battle, beats-world.js; sfx-shelf/magic-sounds.js battleSounds): the page's RPG puts
// each happening of a moment on the bus as rpg-on:<key> (a blow's skill, its element, a crit, a weakness, the hit); of
// those a frame carries, the first of each lane plays (the act: a status, a heal, a blow, a cast; its end: a foe gone, a
// level, the fight's start), the accents (crit, weak) over them. Read-only, as every layer here is.
if (typeof __BUS !== 'undefined') {
  const __rpgB = __AUDIO.battle, __rpgPE = __BUS.processEvents;
  __BUS.processEvents = function (state, events) {
    const n0 = state.log.length;
    const out = __rpgPE(state, events);
    if (!__beatsEng || __beatsMuted) return out;
    const has = {};
    let any = false;
    for (let i = n0; i < state.log.length; i++) { const ev = state.log[i], t = ev && ev.type; if (typeof t === 'string' && t.indexOf('rpg-on:') === 0) { has[t.slice(7)] = true; any = true; } }
    if (!any) return out;
    const C = __AUDIO.cues || {};
    for (const L of [__rpgB.order, __rpgB.ends]) for (const p of L) if (has[p[0]]) { __beatsCue(C[p[1]]); break; }
    const A = __rpgB.also || {};
    for (const k in A) if (has[k]) __beatsCue(C[A[k]]);
    return out;
  };
}
` : ''}// footsteps: two sources, both read-only. Controllable entities expose gait edges (gaitPhase /
// jumped / landed — controllable-world.js computes them for exactly this); first-person walk mode
// has no entity, so accumulated camera travel stands in for stride. Half-gait crossings = steps.
if (__AUDIO.footsteps) {${surf ? `
  // the ground by place: the first box the body's feet stand in gives its step and its landing; outside every box the
  // level's own
  const __fsOf = (e) => {
    const p = e.transform.pos, z = p[2] - ((e.rule && e.rule.eye) || 0);
    for (const s of __AUDIO.surfaces) { const b = s.box; if (p[0] >= b[0] && p[1] >= b[1] && z >= b[2] && p[0] <= b[3] && p[1] <= b[4] && z <= b[5]) return { step: __AUDIO.cues[s.step], land: s.land ? __AUDIO.cues[s.land] : __AUDIO.footsteps.land }; }
    return __AUDIO.footsteps;
  };` : ''}
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
        // (a rider is carried, not walking: no steps while in a car or in a saddle; its ride is heard instead)
        if (e.mountedOn || e.gone) continue;
        const last = __gaitLast[e.id] || (__gaitLast[e.id] = { ix: 0, jumped: false, landed: false });
        const ix = Math.floor((e.gaitPhase || 0) * 2);
        if (e.moving && e.grounded !== false && ix !== last.ix) __beatsCue(${fsOf}.step, __AUDIO.footsteps.gain);
        if (e.jumped && !last.jumped) __beatsCue(__AUDIO.footsteps.jump);
        if (e.landed && !last.landed) __beatsCue(${fsOf}.land);
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
${emit ? `// the sounds of a place (audio.emitters): each sounds its cue again after a wait rolled between its bounds, on its
// own dice, heard by the listener's distance and not past its reach. Presentation only: nothing reads it back.
{
  const __emS = __AUDIO.emitters.map((E, i) => ({ s: (Math.imul(i + 1, 2654435761) + 12345) >>> 0, t: 0 }));
  const __emR = (S) => { S.s = (Math.imul(S.s, 1664525) + 1013904223) >>> 0; return S.s / 4294967296; };
  __emS.forEach((S, i) => { S.t = __emR(S) * __AUDIO.emitters[i].every[1]; });
  let __emT = performance.now() / 1000;
  (function __beatsPlaces() {
    requestAnimationFrame(__beatsPlaces);
    const now = performance.now() / 1000, dt = Math.min(0.25, now - __emT); __emT = now;
    if (!__beatsEng || __beatsMuted) return;
    for (let i = 0; i < __AUDIO.emitters.length; i++) {
      const E = __AUDIO.emitters[i], S = __emS[i];
      S.t -= dt; if (S.t > 0) continue;
      S.t = E.every[0] + (E.every[1] - E.every[0]) * __emR(S);
      const g = Math.max(0, 1 - Math.hypot(camera.position.x - E.at[0], camera.position.y - E.at[1], camera.position.z - E.at[2]) / E.reach), gain = g * g * (E.level == null ? 1 : E.level);
      if (gain > 0.02) __beatsCue(__AUDIO.cues[E.cue], gain);
    }
  })();
}
` : ''}// weapon SFX: watch controllable entities' weapon state (read-only, presentation-only — the same
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
      if (last.w !== e.weapon) {${audio.weapon && audio.weapon.switch ? `
        // (a switch: the incoming gun drawn, its own draw or the world's)
        const __sw = (e.weapon.sfx && e.weapon.sfx.draw) || __AUDIO.weapon.switch;
        if (__sw) __beatsCue(__sw, __proxGain(e.transform.pos));` : ''}
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
${audio.burst ? `// BURSTS (audio.burst, opt-in): a travelling round's burst (a rocket, a grenade: the world's bursts, seq-keyed as the
// effects read them) sounds where it went off, by its distance from you. Read-only.
if (__AUDIO.burst) {
  let __bSeq = null;
  (function __beatsBurst() {
    requestAnimationFrame(__beatsBurst);
    const W = window.__mojCtrl && window.__mojCtrl.world;
    if (!W || !W.bursts) return;
    const top = W.bursts.length ? W.bursts[W.bursts.length - 1].seq : -1;
    if (__bSeq === null || !__beatsEng || __beatsMuted) { __bSeq = top; return; }
    for (const b of W.bursts) if (b.seq > __bSeq) __beatsCue(__AUDIO.burst, __proxGain(b.pos));
    __bSeq = Math.max(__bSeq, top);
  })();
}
` : ''}// strike (melee) SFX: the beam saber's overhead cross. Read-only sim-state → SFX, the same
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
${audio.moves ? `// a MOVESET's sounds (audio.moves, beats-world.js; gameworld/combos.js): the pilot's swing by its weapon and its weight
// (light, a heavy's H, a finisher), its blow landing, the guard meeting a blow (block, parry, broken), the bow's draw and
// loose and an arrow striking home, the weapon cycle; a foe's swing, a foe felled, a blow taken. Each a cue of the
// level's own (__AUDIO.cues). Read-only, as the strike's above. (No backticks: inside an emitted template literal.)
(function () {
  const M = __AUDIO.moves, C = __AUDIO.cues || {}, L = {};
  const play = (id, at) => { if (id && C[id]) __beatsCue(C[id], at ? __proxGain(at) : null); };
  const pick = (map, w, weight) => { const W = map && (map[w] || map[Object.keys(map)[0]]); return W ? (W[weight] || W.heavy || W.light) : null; };
  (function __beatsMoves() {
    requestAnimationFrame(__beatsMoves);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (!ctrl) return;
    const P = ctrl.byId && ctrl.byId[ctrl.pilotId], blade = !!(P && L[P.id] && (P.meleeHitCount || 0) > L[P.id].hit);
    for (const e of ctrl.entities) {
      const l = L[e.id] || (L[e.id] = { swing: e.swingCount || 0, hit: e.meleeHitCount || 0, guard: e.lastGuard ? e.lastGuard.seq : 0, w: e.mvWeapon, charge: e.weapon ? e.weapon.chargeCount || 0 : 0, shots: e.weapon ? e.weapon.shots || 0 : 0, down: !!e.downed, hits: e.hits || 0 });
      if (e === P) {
        // (the move's weight: a finisher by its role, a heavy by the beat that took it)
        const weight = e.mvRole === 'finisher' ? 'finisher' : e.mvPress && e.mvPress.verdict === 'taken' && (e.mvPress.beat === 'H' || e.mvPress.beat === 'bH' || e.mvPress.beat === 'mH') ? 'heavy' : 'light';
        if ((e.swingCount || 0) > l.swing) play(pick(M.swing, e.mvWeapon, weight));
        if ((e.meleeHitCount || 0) > l.hit) play(pick(M.hit, e.mvWeapon, weight));
        if (e.lastGuard && e.lastGuard.seq !== l.guard) play(M[e.lastGuard.kind]);
        if (e.mvWeapon !== l.w && l.w != null) play(M.cycle);
        if (e.weapon && e.weapon === l.wpn && (e.weapon.chargeCount || 0) > l.charge) play(M.draw);
        if (e.weapon && e.weapon === l.wpn && (e.weapon.shots || 0) > l.shots) play(M.loose);
        if ((e.hits || 0) > l.hits) play(M.hurt);
      } else if (e.team === 'foes') {
        if ((e.swingCount || 0) > l.swing) play(M.foeSwing, e.transform.pos);
        if (e.downed && !l.down) play(M.felled, e.transform.pos);
        // (a foe struck by no blade this frame: the pilot's arrow)
        if ((e.hits || 0) > l.hits && !blade) play(M.arrow, e.transform.pos);
      }
      l.swing = e.swingCount || 0; l.hit = e.meleeHitCount || 0; l.guard = e.lastGuard ? e.lastGuard.seq : 0; l.w = e.mvWeapon;
      l.wpn = e.weapon; l.charge = e.weapon ? e.weapon.chargeCount || 0 : 0; l.shots = e.weapon ? e.weapon.shots || 0 : 0; l.down = !!e.downed; l.hits = e.hits || 0;
    }
  })();
})();
` : ''}${audio.run ? runAudioScript({ air: !!audio.run.air }) : ''}${audio.foes ? `// a sheet level's FOES (audio.foes, beats-world.js; gameworld/sound-sheet.js): each foe of the bestiary by its id
// (a body's id is foe-<its id>-<n>) sounds on its attack (a swing begun), on a blow taken and as it falls, each a cue
// of the level's, placed where it stands. A kind's attacks are held apart (a pack never says one sound at once).
// Read-only, as the moveset's above. (No backticks: inside an emitted template literal.)
(function () {
  const F = __AUDIO.foes, C = __AUDIO.cues || {}, L = {}, keys = Object.keys(F).sort(function (a, b) { return b.length - a.length; }), said = {};
  const kindOf = (id) => { for (const k of keys) if (id.indexOf('foe-' + k + '-') === 0) return k; return null; };
  (function __beatsFoes() {
    requestAnimationFrame(__beatsFoes);
    if (!__beatsEng || __beatsMuted) return;
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    if (!ctrl) return;
    const now = performance.now() / 1000;
    for (const e of ctrl.entities) {
      if (e.team !== 'foes' || typeof e.id !== 'string') continue;
      const l = L[e.id] || (L[e.id] = { k: kindOf(e.id), swing: e.swingCount || 0, hits: e.hits || 0, down: !!e.downed });
      const S = l.k ? F[l.k] : null;
      if (S) {
        const play = (what, gap) => { const id = S[what], key = l.k + ':' + what; if (!id || !C[id] || (gap && now - (said[key] || -1e9) < gap)) return; said[key] = now; __beatsCue(C[id], __proxGain(e.transform.pos)); };
        if (e.downed && !l.down) play('down', 0);
        else if ((e.hits || 0) > l.hits && !e.downed) play('hurt', 0.12);
        if ((e.swingCount || 0) > l.swing) play('attack', 0.3);
      }
      l.swing = e.swingCount || 0; l.hits = e.hits || 0; l.down = !!e.downed;
    }
  })();
})();
` : ''}${audio.ambience ? `// a place's own held sound (audio.ambience: a city's traffic far off, gameworld/sound-sheet.js citySounds): held under
// the bed while the level plays, quieter from inside a car. Read-only and presentation-only. (No backticks.)
(function () {
  const A = __AUDIO.ambience; let H = null, lv = 1;
  (function __beatsAmbience() {
    requestAnimationFrame(__beatsAmbience);
    if (!__beatsEng) return;
    if (!H) { try { H = __beatsEng.sustain(Object.assign({}, A.voice, { level: (A.voice.level == null ? 1 : A.voice.level) * A.level })); } catch (e) { return; } }
    const c = window.__mojCtrl && window.__mojCtrl.world, P = c && c.byId && c.byId[c.pilotId], inside = !!(P && P.mount && P.riderId);
    lv += ((inside ? 0.25 : 0.6) - lv) * 0.03;
    H.set(__beatsMuted ? 0 : lv);
  })();
})();
` : ''}${audio.engine ? `// a ride's ENGINE (audio.engine, beats-world.js; gameworld/sound-sheet.js rideSound): a held voice driven by the
// pilot's own travel speed over the ride's top, from its idle up, smoothed so a stop winds down. Built lazily on
// unlock; silent while muted or with no pilot. Read-only and presentation-only. (No backticks.)
(function () {
  const E = __AUDIO.engine, K = { pos: null, t: 0, speed: 0 };
${audio.engine.cab || rideEv ? `  // (a car's revs through its GEARS: in each gear the engine climbs from a third of its range to the top and drops back
  // as the next gear takes up, so a car pulling away is heard changing up, not one long rising whine; stopped, it idles)
  const __GEARS = [0.18, 0.36, 0.56, 0.78, 1];
  const __rev = (v) => { const f = Math.max(0, Math.min(1, v / E.top)); if (f < 0.01) return E.idle; let lo = 0; for (const hi of __GEARS) { if (f <= hi) return E.idle + (1 - E.idle) * (lo ? 0.34 : 0.06 + 0.28 * Math.min(1, f / 0.04)) + (1 - E.idle) * 0.66 * ((f - lo) / (hi - lo)); lo = hi; } return 1; };
  const __gearOf = (v) => { const f = Math.max(0, Math.min(1, v / E.top)); let i = 0; while (i < __GEARS.length - 1 && f > __GEARS[i]) i++; return i; };
${carSets ? `  // (the car taken: the set of its own cues its model names, audio.engine.cueOf)
  const __setOf = (c) => { const m = c && c.mount && c.mount.pool && c.mount.pool.model, mk = m && m.indexOf('loft:') === 0 ? m.split('|')[0] : m; return (mk && E.cueOf[mk]) || null; };
` : ''}` : ''}  let H = null;
  (function __beatsEngine() {
    requestAnimationFrame(__beatsEngine);
    if (!__beatsEng) return;
${audio.engine.cab ? `    // (THE CAR'S SOUND DESIGN, a city's: gameworld/sound-sheet.js citySounds. Whoever is at the wheel: while a car is
    // driven the pilot is the car, the one who got in its rider. Getting in: the door opened as they reach it, shut as
    // they sit, the starter cranking and the engine catching a moment on. Getting out: the engine stopped, the door
    // opened and shut. Walking is its own sound and hears no engine, not even an idle)
    const __cw = window.__mojCtrl && window.__mojCtrl.world, __cp = __cw && __cw.byId && __cw.byId[__cw.pilotId];
    const __hero = __cp && __cp.mount ? __cw.byId[__cp.riderId] || null : __cp, __phase = __hero && __hero.mountedOn ? __hero.mountPhase || 'ride' : null;
    const __t = performance.now() / 1000, __cue = ${carSets ? `function (k, g) { if (K.set && E.mute && E.mute[K.set] && E.mute[K.set].indexOf(k) >= 0) return; __beatsCue(__AUDIO.cues && ((K.set && __AUDIO.cues[k + '@' + K.set]) || __AUDIO.cues[k]), g); };` : 'function (k, g) { __beatsCue(__AUDIO.cues && __AUDIO.cues[k], g); };'}
    if (__phase !== K.phase) {${carSets ? `
      if (__phase && !K.set) K.set = __setOf(__hero && __cw.byId[__hero.mountedOn]);   // (the car being got into: its own cues)` : ''}
      if (__phase === 'mount') __cue('car:open');
      if (__phase === 'ride' && K.phase !== 'ride') { __cue('car:door'); K.startAt = __t + 0.3; }
      if (__phase === 'dismount') { if (K.started) __cue('car:off'); K.started = false; K.startAt = 0; K.runAt = 0; __cue('car:open', 0.8); }
      if (!__phase && K.phase) { __cue('car:door'); ${carHas('car:lock') ? "__cue('car:lock', 0.7); " : ''}${carSets ? 'K.set = null; K.siren = false; ' : ''}K.started = false; K.startAt = 0; K.runAt = 0; }
      K.phase = __phase;
    }
    if (K.startAt && __t >= K.startAt) { K.startAt = 0; __cue('car:start'); K.runAt = __t + 0.75; }
    if (K.runAt && __t >= K.runAt) { K.runAt = 0; K.started = true; }
    const __rides = !!K.started && __phase === 'ride';
    const __held = function (v, lv) { return __beatsEng.sustain(Object.assign({}, v, { level: (v.level == null ? 1 : v.level) * lv })); };
    if (__rides && !H) { try { ${audio.engine.models ? `const __mdl = __cp && __cp.mount && __cp.mount.pool && __cp.mount.pool.model, __mk = __mdl && __mdl.indexOf('loft:') === 0 ? __mdl.split('|')[0] : __mdl;   // (the car taken: its own engine where the level names one, audio.engine.models)
      H = __held((__mk && E.models[__mk] && E.voices[E.models[__mk]]) || E.voice, E.level);` : 'H = __held(E.voice, E.level);'} const D = E.drive || {}; for (const k of ['load', 'road', 'skid']) K[k] = D[k] ? __held(D[k].voice, D[k].level) : null; } catch (e) { return; } }
    else if (!__rides && H) { H.stop(); H = null; for (const k of ['load', 'road', 'skid']) if (K[k]) { K[k].stop(); K[k] = null; } }
` : rideEv ? `    // (a racing car's: its engine, its tyres' roar and screech beside it, and its start as it first runs)
    if (!H) { try { H = __beatsEng.sustain(Object.assign({}, E.voice, { level: (E.voice.level == null ? 1 : E.voice.level) * E.level })); const D = E.drive || {}; for (const k of ['road', 'skid']) K[k] = D[k] ? __beatsEng.sustain(Object.assign({}, D[k].voice, { level: (D[k].voice.level == null ? 1 : D[k].voice.level) * D[k].level })) : null;${rideHas('start') ? " __beatsCue(__AUDIO.cues['ride:start']);" : ''} } catch (e) { return; } }
` : `    if (!H) { try { H = __beatsEng.sustain(Object.assign({}, E.voice, { level: (E.voice.level == null ? 1 : E.voice.level) * E.level })); } catch (e) { return; } }
`}    const ctrl = window.__mojCtrl && window.__mojCtrl.world, P${audio.engine.cab ? '0' : ''} = ctrl && ctrl.byId && ctrl.byId[ctrl.pilotId];
    const now = performance.now() / 1000;
${audio.engine.cab ? `    // (a city's cars, its cab: heard only while the pilot rides one, by that car's own speed; the door as it is got into
    // and out of, a crash on a hard stop)
    const P = E.cab ? (P0 && P0.mount && P0.riderId ? P0 : null) : P0;
    if (E.cab) {
      const riding = !!P;
      K.riding = riding;
      if (!riding) { K.pos = null; K.speed = 0; }
      // (a hard stop: its speed fallen faster than any brake drops it)
      // (the speed is smoothed, an eighth of the way a frame: a fall of more than a tenth of it in a frame is the car
      // stopped near dead at once, which no brake does; once in a second and a half)
      if (riding && K.prev !== undefined && K.prev > 6 && K.prev - K.speed > 0.1 * K.prev && !(now - (K.crashT || -9) < 1.5)) { K.crashT = now; __beatsCue(__AUDIO.cues && __AUDIO.cues['car:crash'], Math.min(1, K.prev / 20)); }
      K.prev = K.speed;
    }
${audio.cues && audio.cues['law:siren'] ? `    // (the law's cars, gameworld/law.js: the nearest one's siren while one is about, louder the nearer, a call at a time)
    if (P0 && P0.transform) {
      let sd = Infinity;
      for (const c of ctrl.entities) if (c.carBody && !c.gone) sd = Math.min(sd, Math.hypot(c.transform.pos[0] - P0.transform.pos[0], c.transform.pos[1] - P0.transform.pos[1]));
      if (sd < 110 && !(now - (K.sirenT || -9) < 2.3)) { K.sirenT = now; __beatsCue(__AUDIO.cues['law:siren'], Math.max(0.15, 1 - sd / 110)); }
    }
` : ''}` : ''}    if (P && P.transform && P.transform.pos) {
      const p = P.transform.pos, dt = now - K.t;
      if (K.pos && dt > 0 && dt < 0.5) { const d = Math.hypot(p[0] - K.pos[0], p[1] - K.pos[1], (p[2] || 0) - (K.pos[2] || 0)); K.speed += (d / dt - K.speed) * 0.12; }
      K.pos = [p[0], p[1], p[2] || 0]; K.t = now;
    } else K.speed *= 0.9;
    const x = E.idle + (1 - E.idle) * Math.max(0, Math.min(1, K.speed / E.top));
${audio.engine.cab ? `    // (the car at the wheel: its pedal (the growl under load, silent coasting), its speed (the tyres' roar and the wind),
    // its tyres past their grip in a turn or under hard braking (their screech), the brakes as it stops hard, a gear
    // changed up under the pedal)
    if (H && P) {
      const spd = Math.abs(P.speed || 0), thr = Math.max(0, P.throttle || 0), rpm = __rev(K.speed);
      K.thr = (K.thr || 0) + (thr - (K.thr || 0)) * 0.15;
      if (K.load) K.load.set(__beatsMuted ? 0 : K.thr * (0.35 + 0.65 * rpm));
      if (K.road) K.road.set(__beatsMuted ? 0 : Math.min(1, K.speed / E.top));
      const wb = (P.rule && P.rule.wheelbase) || 2.7, grip = (P.rule && P.rule.grip) || 1, slip = (spd * spd * Math.abs(Math.tan(P.steerAngle || 0))) / wb / (grip * 9.81);
      if (K.skid) K.skid.set(__beatsMuted ? 0 : Math.max(P.braking && spd > 8 ? 0.4 : 0, Math.min(1, (slip - 0.8) * 2.5)));
      if (P.braking && !K.braking && spd > 9 && !(now - (K.brakeT || -9) < 1.5)) { K.brakeT = now; ${carSets ? "__cue('car:brake', Math.min(1, spd / 25));" : "__beatsCue(__AUDIO.cues && __AUDIO.cues['car:brake'], Math.min(1, spd / 25));"} }
      K.braking = !!P.braking;${carHas('car:reverse') ? `
      // (backing up: its reverse beeper, where the car has one)
      if ((P.speed || 0) < -0.8 && !(now - (K.revT || -9) < 2.8)) { K.revT = now; __cue('car:reverse', 0.5); }` : ''}${carHas('car:backfire') ? `
      // (off the pedal high in its revs: a backfire, where the car has one)
      if ((K.lastThr || 0) > 0.7 && thr < 0.15 && rpm > 0.6 && !(now - (K.bfT || -9) < 2)) { K.bfT = now; __cue('car:backfire', 0.7); }
      K.lastThr = thr;` : ''}${carHas('car:siren') ? `
      // (its siren, where the car has one: N at the wheel turns it on and off)
      if (K.siren && !(now - (K.sirT || -9) < 3.8)) { K.sirT = now; __cue('car:siren', 0.6); }` : ''}
      const gear = __gearOf(K.speed);
      if (K.gear != null && gear > K.gear && K.thr > 0.5) ${carSets ? "__cue('car:shift', 0.45);" : "__beatsCue(__AUDIO.cues && __AUDIO.cues['car:shift'], 0.45);"}
      K.gear = gear;
    }
    if (H) H.set(__beatsMuted || !P ? 0 : __rev(K.speed));` : rideEv ? `    // (a racing car's sound design, sound-sheet.js rideEvents: its revs through its gears and a gear changed up under the
    // pedal, its tyres' roar by the speed and their screech as they slip, the brakes as it stops hard, a backfire off the
    // pedal high in its revs, its reverse beeper backing up: each only where the car has it)
    if (P) {
      const spd = Math.abs(P.speed || 0), thr = Math.max(0, P.throttle || 0), rpm = __rev(K.speed);
      K.thr = (K.thr || 0) + (thr - (K.thr || 0)) * 0.15;
      if (K.road) K.road.set(__beatsMuted ? 0 : Math.min(1, K.speed / E.top));
      const wb = (P.rule && P.rule.wheelbase) || 2.7, grip = (P.rule && P.rule.grip) || 1, slip = (spd * spd * Math.abs(Math.tan(P.steerAngle || 0))) / wb / (grip * 9.81);
      if (K.skid) K.skid.set(__beatsMuted ? 0 : Math.max(P.braking && spd > 8 ? 0.4 : 0, Math.min(1, (slip - 0.8) * 2.5)));${rideHas('brake') ? `
      if (P.braking && !K.braking && spd > 9 && !(now - (K.brakeT || -9) < 1.5)) { K.brakeT = now; __beatsCue(__AUDIO.cues['ride:brake'], Math.min(1, spd / 25)); }` : ''}
      K.braking = !!P.braking;${rideHas('reverse') ? `
      if ((P.speed || 0) < -0.8 && !(now - (K.revT || -9) < 2.8)) { K.revT = now; __beatsCue(__AUDIO.cues['ride:reverse'], 0.5); }` : ''}${rideHas('backfire') ? `
      if ((K.lastThr || 0) > 0.7 && thr < 0.15 && rpm > 0.6 && !(now - (K.bfT || -9) < 2)) { K.bfT = now; __beatsCue(__AUDIO.cues['ride:backfire'], 0.7); }
      K.lastThr = thr;` : ''}${rideHas('shift') ? `
      const gear = __gearOf(K.speed);
      if (K.gear != null && gear > K.gear && K.thr > 0.5) __beatsCue(__AUDIO.cues['ride:shift'], 0.45);
      K.gear = gear;` : ''}
    } else { if (K.road) K.road.set(0); if (K.skid) K.skid.set(0); }
    H.set(__beatsMuted || !P ? 0 : ${audio.engine.gears ? '__rev(K.speed)' : 'x'});` : '    H.set(__beatsMuted || !P ? 0 : x);'}
  })();
${audio.engine.cab ? `  // (the horn: H at the wheel)
  // (at the wheel the pilot is the car, its driver its rider: riderId; on foot beside it, mountedOn)
  if (E.cab) addEventListener('keydown', function (ev) { const c = window.__mojCtrl && window.__mojCtrl.world, P = c && c.byId && c.byId[c.pilotId]; if (ev.code === 'KeyH' && !ev.repeat && P && (P.mountedOn || P.riderId) && !window.__mojMenuOpen) __beatsCue(__AUDIO.cues && (${carSets ? "(K.set && __AUDIO.cues['car:horn@' + K.set]) || " : ''}__AUDIO.cues['car:horn']));${carHas('car:siren') ? " if (ev.code === 'KeyN' && !ev.repeat && P && P.riderId && K.set && __AUDIO.cues['car:siren@' + K.set] && !window.__mojMenuOpen) { K.siren = !K.siren; K.sirT = -9; }" : ''} });
` : ''}${rideHas('horn') ? `  // (a racing car's horn: H while it is driven)
  addEventListener('keydown', function (ev) { const c = window.__mojCtrl && window.__mojCtrl.world, P = c && c.byId && c.byId[c.pilotId]; if (ev.code === 'KeyH' && !ev.repeat && P && !window.__mojMenuOpen) __beatsCue(__AUDIO.cues['ride:horn']); });
` : ''}})();
` : ''}// thruster ROAR (boost, the F key): a SUSTAINED rocket-engine voice — the acoustic twin of the
// visual jets. Unlike the one-shot cues above it is a continuous, gain-modulated noise bed that
// SWELLS with e.thrust (the same 0..1 the platform rule flags on boost and the jets read) and dies
// on release. Two seeded-noise layers (a bright roar + a deep rumble) plus a low sub-tone, summed
// into one gain that rides the thrust via setTargetAtTime (an exponential spool-up / spool-down),
// with an LFO wobbling the roar cutoff for combustion flutter. Read-only + presentation-only like
// every other layer; built lazily on first unlock. (No backticks — this lives in a template literal.)
${thrHeld ? `if (__AUDIO.thruster) {
  // the thruster's held voice (audio.thruster.voice, a sustain spec: the SFX shelf's port of the synth this replaces,
  // or another): built lazily on unlock, its control the loudest thrust weighted by its distance from you, its level
  // the thruster's level. Read-only and presentation-only, as every layer here is.
  let __thrH = null;
  (function __beatsThruster() {
    requestAnimationFrame(__beatsThruster);
    if (!__beatsEng) return;
    if (!__thrH) { try { const v = __AUDIO.thruster.voice; __thrH = __beatsEng.sustain(Object.assign({}, v, { level: (v.level == null ? 1 : v.level) * (__AUDIO.thruster.level == null ? 0.4 : __AUDIO.thruster.level) })); } catch (e) { return; } }
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    let thrust = 0;
    if (ctrl) for (const e of ctrl.entities) { const v = (e.thrust || 0) * __proxGain(e.transform.pos); if (v > thrust) thrust = v; }
    if (__beatsMuted) thrust = 0;
    __thrH.set(Math.max(0, Math.min(1, thrust)));
  })();
}
` : `if (__AUDIO.thruster) {
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
    // R28 proximity: weight each suit's thrust by its distance from you BEFORE taking the loudest, so a
    // booster across the map is a faint roar (or silent past the far cutoff), not full-volume in your ear.
    if (ctrl) for (const e of ctrl.entities) { const v = (e.thrust || 0) * __proxGain(e.transform.pos); if (v > thrust) thrust = v; }
    if (__beatsMuted) thrust = 0;
    thrust = Math.max(0, Math.min(1, thrust));
    const now = __beatsCtx.currentTime;
    __thr.g.gain.setTargetAtTime(thrust * __thr.level, now, 0.07);          // exponential spool up/down
    __thr.airLp.frequency.setTargetAtTime(1900 + thrust * 1700, now, 0.1);  // airy band brightens as it winds up
    __thr.tone.frequency.setTargetAtTime(720 + thrust * 620, now, 0.12);    // the whine rises 720 -> 1340 Hz
  })();
}
`}// JUMP audio (charge / release / land): the stop-and-charge GATHERS like a mech loading up — a low
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
${jumpHeld ? `    // the charge's held voice (audio.jump.charge.voice): the servo and its chuffs in one sustain, at the charge's level
    const v = __J.charge.voice, held = __beatsEng.sustain(Object.assign({}, v, { level: (v.level == null ? 1 : v.level) * (__J.charge.level || 0.26) }));
    return { buf, held, lastT: ctx.currentTime, level: __J.charge.level || 0.26 };` : `    const motor = ctx.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 66;
    const motorLp = ctx.createBiquadFilter(); motorLp.type = 'lowpass'; motorLp.frequency.value = 300; motorLp.Q.value = 4;
    const motorG = ctx.createGain(); motorG.gain.value = 0;
    motor.connect(motorLp); motorLp.connect(motorG); motorG.connect(master); motor.start();
    return { buf, motor, motorLp, motorG, chuffPh: 0, lastT: ctx.currentTime, level: (__J.charge && __J.charge.level) || 0.26 };`}
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
  const __jFireRelease = (p, gain) => {
    const ctx = __beatsCtx, master = __beatsEng.master, t0 = ctx.currentTime;
    const lvl = ((__J.release && __J.release.level) || 0.5) * (gain == null ? 1 : gain);   // R28 proximity: fades with the jumper's range
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
    let frac = 0, charging = false, chargeG = 0;
    if (ctrl) for (const e of ctrl.entities) {
      // R28 proximity: a distant suit's charge/jump/land fades with range (charge servo scaled by
      // chargeG, the nearest charger's gain; the release + land cues by their own jumper's gain).
      const __pg = __proxGain(e.transform.pos);
      if (e.charging && __pg > 0.02) { charging = true; if ((e.chargeFrac || 0) > frac) frac = e.chargeFrac || 0; if (__pg > chargeG) chargeG = __pg; }
      const last = __jLast[e.id] || (__jLast[e.id] = { j: false, l: false });
      if (__J.release && e.jumped && !last.j && __pg > 0.02) __jFireRelease(Math.max(0, Math.min(1, e.jumpPower || 0)), __pg);
      if (__J.land && e.landed && !last.l && __pg > 0.02) {
        const vel = Math.min(1, (e.landVel || 0) / (__J.landRef || 30));   // fall speed -> clang loudness
        __beatsEng.playCue(__J.land, __beatsCtx.currentTime, __beatsEng.master, (0.55 + vel * 0.75) * __pg);
      }
      last.j = !!e.jumped; last.l = !!e.landed;
    }
    const now = __beatsCtx.currentTime;
    const dtJ = Math.min(0.1, Math.max(0, now - __jn.lastT)); __jn.lastT = now;
${jumpHeld ? `    // the held voice's control: a third of the way in as the charge begins (the servo's gain at rest), full at full coil
    __jn.held.set(charging ? (0.32 + 0.68 * frac) * chargeG : 0, now);` : `    // servo strain rises + tightens as it gathers; the resonant cutoff climbs so the motor "loads up"
    __jn.motor.frequency.setTargetAtTime(66 + frac * 74, now, 0.05);
    __jn.motorLp.frequency.setTargetAtTime(240 + frac * 520, now, 0.06);
    __jn.motorG.gain.setTargetAtTime(charging ? (0.16 + frac * 0.34) * __jn.level * chargeG : 0, now, 0.03);   // R28 proximity: distant charge servo fades
    // piston chuffs: 4/sec at rest -> ~13/sec at full coil (the pistons pumping faster as it gathers)
    if (charging) { __jn.chuffPh += dtJ * (4 + frac * 9); while (__jn.chuffPh >= 1) { __jn.chuffPh -= 1; __jChuff(frac); } }
    else __jn.chuffPh = 0;`}
  })();
}
${audio.weather ? weatherAudioScript() + '\n' : ''}// world bindings (B5.3): sim-state selectors → soundtrack channel macros, evaluated per frame.
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
      ${audio.tension ? "if (b.source === 'tension') v = __tension;\n      else " : ''}if (b.source === 'speed') v = __bindKin.speed;
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
      if (b.target.macro === 'tone') ${musicEng}.setTone(b.target.channel, out);
      else if (b.target.macro === 'level') ${musicEng}.setLevel(b.target.channel, out);
      else ${musicEng}.setTranspose(b.target.channel, out);
    });
  })();
}`;
}
