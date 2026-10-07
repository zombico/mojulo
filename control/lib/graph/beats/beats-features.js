/**
 * beats-features — which kernel features a recipe uses, and which patches a page
 * must carry. Pure; no audio.
 *
 * A page (the player, a world's audio channel, the diff exhibit, a game shell)
 * embeds emitBeatsKernel(features) and a patch shelf. With no opt-in in the
 * recipe, both are exactly the pre-fidelity bytes. Each opt-in adds only its own
 * kernel slice (see the feature table above buildBeatsKernel), and each new
 * patch name adds only its own shelf entry. The offline export loads everything,
 * so the detector only has to be right for pages: a feature it misses would be
 * silently absent live. beats-features.test.js renders every fixture through
 * the sliced kernel and requires the same WAV bytes as the full one.
 */

import { PATCHES, LEGACY_PATCH_NAMES } from './audio-patches.js';
import { INSTRUMENTS } from './instruments.js';
import { IMPLIES } from './beats-kernel.js';
import { expandBeatsManifest } from './beats-authoring.js';

const LEGACY = new Set(LEGACY_PATCH_NAMES);
const AMBIENT_DEFAULT = { harmony: 'pad', roots: 'bassMono', melody: 'sinePluck', pulse: 'kick' };
const VOICE_KEYS = ['vary', 'width', 'curve', 'keyTrack', 'decayTrack', 'drift', 'breath', 'pitch', 'kit'];
const STRING_KEYS = ['tune', 'ringT60', 'stiffness'];
const NEW_MATERIALS = new Set(['cymbal', 'plate', 'bell']);
const GUITAR_ARTS = new Set(['bend', 'slide', 'dive', 'vib', 'pm', 'harm', 'pop', 'hammer', 'pull', 'tap', 'nat']);

function rowsOf(m) {
  return (m && (m.channels || m.parts || m.tracks)) || [];
}

function patchNameOf(row) {
  if (row.patch) return row.patch;
  if (row.instrument && INSTRUMENTS[row.instrument]) return INSTRUMENTS[row.instrument].patch;
  return AMBIENT_DEFAULT[row.role] || 'sinePluck';
}

// a row's patch plus, for a kit, every piece it can select.
function patchNamesOf(row) {
  if (row.cue || row.gesture) return [];
  const name = patchNameOf(row);
  const p = PATCHES[name];
  return p && p.kit ? [name, ...new Set(Object.values(p.kit))] : [name];
}

function voiceNeeds(p) {
  if (!p) return false;
  if (VOICE_KEYS.some((k) => p[k] !== undefined)) return true;
  if (p.vibrato && p.vibrato.spread) return true;
  if (p.voice === 'modal' && (p.filter || p.filterEnv || (p.partials || []).some((q) => q && q.wave))) return true;
  return !!(p.filterEnv && p.velToFilter != null);
}

const PRODUCTION = new Set(['riser', 'downlifter', 'impact', 'reverse-cymbal', 'scratch']);
function gestureNeedsSfx(g) {
  if (!g || typeof g !== 'object') return false;
  if (PRODUCTION.has(g.type)) return true;
  if (g.type === 'tone') return true;
  if (g.type === 'thump') return g.mass !== undefined;
  if (g.type === 'burst') return g.bandpass !== undefined || g.filterEnv !== undefined;
  if (g.type === 'ring') {
    return NEW_MATERIALS.has(g.material) || ['wave', 'excite', 'highpass', 'size'].some((k) => g[k] !== undefined);
  }
  return false;
}

function addGestures(set, list) {
  if (Array.isArray(list) && list.some(gestureNeedsSfx)) set.add('sfx');
  if (Array.isArray(list) && list.some((g) => g && PRODUCTION.has(g.type))) set.add('anthem');
}

// the kernel's `scored` test, mirrored: a composition that uses the score
// substrate (meter, tempo map, phrases/form, object or 5-slot events, dynamics).
function scored(m) {
  return !!(m.meter || m.meters || m.tempo || m.phrases || (m.parts || []).some((p) => p && (p.form || p.dynamics || (p.events || []).some((e) => !Array.isArray(e) || e.length > 4))));
}

// every articulation type a composition names (events, phrases).
function artsOf(m) {
  const out = [];
  const read = (ev) => { const a = Array.isArray(ev) ? ev[4] : ev && ev.art; if (a) out.push(typeof a === 'string' ? a : a.type); };
  for (const p of m.parts || []) for (const ev of (p && p.events) || []) read(ev);
  for (const list of Object.values(m.phrases || {})) for (const ev of list || []) read(ev);
  return out;
}

function collect(m, set) {
  if (!m || typeof m !== 'object') return;
  if (m.room || m.master) set.add('mix');
  if ((m.room && m.room.model === 'plate') || (m.master && m.master.style)) set.add('anthem');
  if (scored(m)) set.add('score');
  if (m.kind === 'beats-composition' && Array.isArray(m.sweeps) && m.sweeps.length) set.add('anthem');
  const arts = artsOf(m);
  if (arts.length) set.add('orch');
  if (arts.includes('pizz') || arts.includes('pm')) set.add('strings');
  if (arts.some((a) => GUITAR_ARTS.has(a))) set.add('anthem');
  if (m.a4) set.add('orch');
  if (m.stutter || (m.room && (m.room.model === 'gated' || m.room.model === 'reverse'))) set.add('fx');
  for (const row of rowsOf(m)) {
    if (!row || typeof row !== 'object') continue;
    // a composition cue part: the transport fires its gestures (each hit a variant).
    if (m.kind === 'beats-composition' && (row.cue || row.gesture)) { set.add('anthem'); if (row.vary !== false) set.add('sfx'); }
    if (row.pan != null || row.send) set.add('mix');
    if (row.trim) set.add('anthem');
    if ((row.chain || []).some((f) => f && f.type === 'reverb' && f.model === 'plate')) { set.add('anthem'); set.add('mix'); }
    if ((row.chain || []).some((f) => f && (f.type === 'wah' || f.type === 'rotary'))) set.add('anthem');
    if (row.desk) { set.add('mix'); set.add('orch'); }
    if (row.players) set.add('orch');
    if (row.choke) set.add('perc');
    if (row.accent || row.ratchet || row.prob != null) set.add('va');
    if (row.slide) { set.add('va'); set.add('orch'); }
    const fl = row.feel && typeof row.feel === 'object' ? row.feel : null;
    if (fl && (fl.laid || fl.accent || fl.flam)) set.add('perc');
    if (row.feel === 'rock-drummer') set.add('perc');
    if ((row.chain || []).some((f) => f && (f.type === 'compress' || (f.type === 'reverb' && f.drive)))) set.add('perc');
    const RACK = new Set(['phaser', 'flanger', 'tape', 'autopan', 'crush', 'ringmod', 'vocoder']);
    if ((row.chain || []).some((f) => f && (RACK.has(f.type) || f.model === 'bbd' || f.model === 'dub' || f.model === 'gated' || f.model === 'reverse' || (f.type === 'drive' && f.model)))) set.add('fx');
    if (row.gate || row.duck || row.stutter) set.add('fx');
    if ((row.chain || []).some((f) => f && f.type === 'reverb' && f.model === 'room2')) set.add('mix');
    if ((row.chain || []).some((f) => f && ((f.type === 'body' && f.model === 'modal') || f.type === 'sympathetic'))) set.add('timbre');
    if (row.patchParams || row.glide) set.add('voice');
    if (row.vary && (row.cue || row.gesture)) set.add('sfx');
    addGestures(set, row.cue || (row.gesture ? [row.gesture] : null));
    for (const name of patchNamesOf(row)) {
      const p = row.patchParams ? { ...PATCHES[name], ...row.patchParams } : PATCHES[name];
      if (!LEGACY.has(name) || voiceNeeds(p)) set.add('voice');
      if (p && (p.harmonics || p.tremolo || p.pedal || p.players)) set.add('orch');
      if (p && (p.velMap || p.claps || p.drive || p.excite === 'noise' || p.chokes || (p.partials || []).some((q) => q && q.rise))) set.add('perc');
      if (p && (p.wave === 'pulse' || p.wave === 'supersaw' || p.sub || p.noise || p.lfo || p.voice === 'fm4' || (p.filter && p.filter.slope) || (p.filterEnv && (p.filterEnv.amount != null || p.filterEnv.velAmount)))) set.add('va');
      if (p && p.bend) set.add('orch');
      if (p && (p.harmonicsLoud || p.life || p.damper || p.ringExact)) set.add('timbre');
      if (p && p.unisonSpread) { set.add('timbre'); set.add('anthem'); } // the second string's ring sits in the anthem string clause
      if (p && STRING_KEYS.some((k) => p[k] != null && p[k] !== false)) set.add('strings');
    }
  }
  for (const list of Object.values(m.cues || {})) addGestures(set, list);
}

const ORDER = ['x', 'voice', 'strings', 'mix', 'sfx', 'ev', 'score', 'orch', 'perc', 'va', 'fx', 'anthem', 'timbre'];
const sorted = (set) => {
  for (const f of [...set]) for (const g of IMPLIES[f] || []) set.add(g);
  return ORDER.filter((f) => set.has(f));
};

/** Kernel features a beats manifest needs (normalized or not). [] = the 2.1 kernel. */
export function beatsFeatures(manifest) {
  const set = new Set();
  collect(expandBeatsManifest(manifest), set);
  return sorted(set);
}

/** Kernel features a resolved world `audio` payload needs (beats-world.js). */
export function audioFeatures(audio) {
  const set = new Set();
  if (!audio || typeof audio !== 'object') return [];
  collect(expandBeatsManifest(audio.soundtrack), set);
  for (const list of Object.values(audio.cues || {})) addGestures(set, list);
  for (const list of Object.values(audio.footsteps || {})) addGestures(set, list);
  addGestures(set, audio.jump && audio.jump.land);
  addGestures(set, audio.dodge);
  for (const k of ['weapon', 'strike']) for (const list of Object.values(audio[k] || {})) addGestures(set, list);
  if (audio.vary) set.add('sfx');
  if (audio.wind && audio.wind.vary) set.add('x');
  return sorted(set);
}

/**
 * The patch shelf a page embeds: the pre-fidelity shelf plus any newer names
 * the given manifests reference (kit pieces included), in shelf order. With no
 * newer name referenced this is the 2.1 shelf, JSON-identical.
 */
export function pagePatches(...manifests) {
  const want = new Set(LEGACY_PATCH_NAMES);
  for (const m of manifests) for (const row of rowsOf(expandBeatsManifest(m))) if (row) for (const n of patchNamesOf(row)) want.add(n);
  return Object.fromEntries(Object.entries(PATCHES).filter(([k]) => want.has(k)));
}
