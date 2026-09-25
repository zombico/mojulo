/**
 * beats-manifest — validate + normalize the three beats manifest kinds
 * (beats.plan.md). A beats artifact rides the `sketches` table like every other
 * mint; `manifest.kind` is the render discriminator and the manifest stores the
 * RECIPE, never rendered audio (regenerated per request, seeded → deterministic).
 *
 *   beats-ambient     — generative loop: bpm/swing/key/seed, progression, channels.
 *   beats-composition — explicit score: bpm/swing, parts with literal events.
 *   beats-pattern     — groove loop (B5.1): tracks × sixteenth-step velocity masks,
 *                       optional per-step note contours; instrument = patch | gesture | cue.
 *   beats-sfx         — foley cues: named gesture lists (sweep|flutter|burst|thump|grain|ring|tone).
 *
 * Validation throws teaching errors (the create_beats handler surfaces them with
 * a pointer at the kind's beats-vocab card). Normalization fills musical defaults
 * so a minimal recipe still plays — the stored manifest is always the normalized,
 * self-contained form.
 */

import { PATCHES } from './audio-patches.js';
import { INSTRUMENTS, FEEL_PRESETS, resolveInstrument, resolveFeel } from './instruments.js';

export const BEATS_KINDS = ['beats-ambient', 'beats-composition', 'beats-pattern', 'beats-sfx'];
const KIND_SET = new Set(BEATS_KINDS);
const ROLES = new Set(['harmony', 'roots', 'melody', 'pulse']);
const GESTURES = new Set(['sweep', 'flutter', 'burst', 'thump', 'grain', 'ring', 'tone']);
const RING_MATERIALS = new Set(['glass', 'metal', 'wood', 'cymbal', 'plate', 'bell']);
const WAVES = new Set(['sine', 'square', 'triangle', 'sawtooth']);
const FX = new Set(['filter', 'delay', 'pingpong', 'chorus', 'reverb', 'body', 'drive', 'amp']);
// B7 harmony bus: a chordVoice track derives its notes from the shared
// progression instead of a note contour. Modes = how it reads the chord.
const CHORD_VOICE_MODES = new Set(['chord', 'strum', 'block', 'arp', 'root', 'upper']);
const NOTE_RE = /^[A-Ga-g][#b]?-?\d+$/;

export function isBeatsKind(kind) {
  return KIND_SET.has(kind);
}

function checkNote(n, where, errors) {
  if (typeof n !== 'string' || !NOTE_RE.test(n)) {
    errors.push(`${where}: '${n}' is not a note name (expected e.g. "A4", "Bb1", "F#3")`);
  }
}

function checkChain(chain, where, errors) {
  if (chain === undefined) return;
  if (!Array.isArray(chain)) { errors.push(`${where}.chain must be an array of fx objects`); return; }
  chain.forEach((f, i) => {
    if (!f || typeof f !== 'object' || !FX.has(f.type)) {
      errors.push(`${where}.chain[${i}].type must be one of: ${[...FX].join(', ')}`);
      return;
    }
    // delay/pingpong time: seconds, or a note fraction resolved against bpm at
    // play time ('3/16' = dotted eighth) so the echo stays in the pocket (B5.0).
    if (f.type === 'reverb') checkRoomShape(f, `${where}.chain[${i}]`, errors);
    if ((f.type === 'delay' || f.type === 'pingpong') && f.time !== undefined) {
      const isFraction = typeof f.time === 'string' && /^\d+\s*\/\s*\d+$/.test(f.time.trim()) && Number(f.time.split('/')[1]) > 0;
      const isSeconds = typeof f.time === 'number' && isFinite(f.time) && f.time > 0;
      if (!isFraction && !isSeconds) {
        errors.push(`${where}.chain[${i}].time must be seconds or a note fraction like "3/16" (got '${f.time}')`);
      }
    }
  });
}

// Audio fidelity bus + export blocks (all opt-in; absent = today's bus/WAV).
const inRange = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
function checkRoomShape(r, where, errors) {
  if (r.model !== undefined && r.model !== 'room2' && r.model !== 'noise') errors.push(`${where}.model must be 'room2' (pre-delay, early reflections, highs die first) or 'noise' (the classic tail)`);
  if (r.predelay !== undefined && !inRange(r.predelay, 0, 0.2)) errors.push(`${where}.predelay must be seconds in [0, 0.2]`);
  if (r.damp !== undefined && !inRange(r.damp, 0, 1)) errors.push(`${where}.damp must be in [0, 1] (how fast the highs die)`);
}
function checkBus(m, rows, errors) {
  if (m.room !== undefined) {
    if (!isObj(m.room)) errors.push('room must be an object { decay?, model?, predelay?, damp?, level? } (one shared reverb; rows join it with `send`)');
    else {
      checkRoomShape(m.room, 'room', errors);
      if (m.room.decay !== undefined && !inRange(m.room.decay, 0.1, 10)) errors.push('room.decay must be seconds in [0.1, 10]');
      if (m.room.level !== undefined && !inRange(m.room.level, -40, 12)) errors.push('room.level must be dB in [-40, 12] (the room return)');
    }
  }
  (rows || []).forEach((r, i) => {
    if (!r || r.send === undefined) return;
    if (!inRange(r.send, 0, 1)) errors.push(`row ${i} ('${r.name}').send must be in [0, 1]`);
    else if (!m.room) errors.push(`row ${i} ('${r.name}').send needs a manifest-level room: { decay: 2 } to send into`);
  });
  if (m.master !== undefined) {
    const ms = m.master;
    if (!isObj(ms)) errors.push('master must be an object { limit?, glue? }');
    else {
      if (ms.limit !== undefined && !inRange(ms.limit, -24, 0)) errors.push('master.limit must be dBFS in [-24, 0] (the limiter threshold)');
      if (ms.glue !== undefined) {
        const g = ms.glue, lim = { threshold: [-60, 0], ratio: [1, 20], knee: [0, 40], attack: [0, 1], release: [0, 1] };
        if (!isObj(g)) errors.push('master.glue must be { threshold?, ratio?, knee?, attack?, release? }');
        else for (const [k, [lo, hi]] of Object.entries(lim)) if (g[k] !== undefined && !inRange(g[k], lo, hi)) errors.push(`master.glue.${k} must be in [${lo}, ${hi}]`);
      }
    }
  }
  if (m.export !== undefined) {
    const ex = m.export;
    if (!isObj(ex)) errors.push('export must be an object { bitDepth?, dither?, normalize? } (WAV export only)');
    else {
      if (ex.bitDepth !== undefined && ![16, 24, 32].includes(ex.bitDepth)) errors.push('export.bitDepth must be 16, 24 or 32 (32 = float)');
      if (ex.dither !== undefined && typeof ex.dither !== 'boolean') errors.push('export.dither must be true | false (seeded TPDF on 16/24-bit)');
      if (ex.normalize !== undefined) {
        const n = ex.normalize;
        if (!isObj(n) || (n.peak === undefined && n.lufs === undefined)) errors.push('export.normalize must be { peak?: dBTP, lufs?: integrated loudness }');
        else {
          if (n.peak !== undefined && !inRange(n.peak, -24, 0)) errors.push('export.normalize.peak must be dBTP in [-24, 0] (e.g. -1)');
          if (n.lufs !== undefined && !inRange(n.lufs, -40, -5)) errors.push('export.normalize.lufs must be in [-40, -5] (e.g. -14 streaming, -16 podcast)');
        }
      }
    }
  }
}

function checkPatch(patch, where, errors) {
  if (patch !== undefined && !PATCHES[patch]) {
    errors.push(`${where}.patch '${patch}' is unknown (patches: ${Object.keys(PATCHES).join(', ')})`);
  }
}

// The singing instrument (beats-song S0). `patch: 'voice'` selects the parametric
// vocal emitter (rendered beside the kernel, not a synth patch). A voice part
// carries `lyrics` (1:1 with its events; padded/truncated at render, never crashes)
// plus optional per-part `voice` (formant/register/choir knobs) and `emphasis`
// (per-consonant legibility scalars). All fields are optional and additive; a
// non-voice part is untouched.
export const VOICE_PATCH = 'voice';
function checkVoicePart(node, where, errors) {
  if (node.lyrics !== undefined) {
    if (!Array.isArray(node.lyrics) || node.lyrics.some((s) => typeof s !== 'string')) {
      errors.push(`${where}.lyrics must be an array of syllable strings (1:1 with events)`);
    }
  }
  if (node.emphasis !== undefined) {
    if (!node.emphasis || typeof node.emphasis !== 'object' || Array.isArray(node.emphasis)
      || Object.values(node.emphasis).some((v) => !Number.isFinite(v))) {
      errors.push(`${where}.emphasis must be an object of per-consonant numbers (e.g. { m: 2.0 })`);
    }
  }
  const v = node.voice;
  if (v !== undefined) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) {
      errors.push(`${where}.voice must be an object { formantScale?, detuneCents?, register?, ensemble? }`);
    } else {
      if (v.formantScale !== undefined && (!Number.isFinite(v.formantScale) || v.formantScale <= 0)) {
        errors.push(`${where}.voice.formantScale must be a positive number (vocal-tract size; >1 = lower/darker)`);
      }
      if (v.detuneCents !== undefined && !Number.isFinite(v.detuneCents)) {
        errors.push(`${where}.voice.detuneCents must be a number (cents)`);
      }
      if (v.register !== undefined && typeof v.register !== 'string') {
        errors.push(`${where}.voice.register must be a string (register recipe name)`);
      }
      // The choir is an OPTIONAL register: `ensemble` renders N de-locked copies of
      // this one voice (the locked voice, deliberately de-locked per singer) and mixes
      // them. Absent → a solo voice. Each singer nudges detune / vocal-tract / timing.
      if (v.ensemble !== undefined) {
        const en = v.ensemble;
        if (!en || typeof en !== 'object' || Array.isArray(en) || !Array.isArray(en.voices) || !en.voices.length) {
          errors.push(`${where}.voice.ensemble must be { voices: [{ detuneCents?, formantScale?, timeMs? }, ...] } (the de-locked singers)`);
        } else {
          en.voices.forEach((sv, k) => {
            const w2 = `${where}.voice.ensemble.voices[${k}]`;
            if (!sv || typeof sv !== 'object' || Array.isArray(sv)) { errors.push(`${w2} must be an object`); return; }
            if (sv.formantScale !== undefined && (!Number.isFinite(sv.formantScale) || sv.formantScale <= 0)) errors.push(`${w2}.formantScale must be a positive number`);
            if (sv.detuneCents !== undefined && !Number.isFinite(sv.detuneCents)) errors.push(`${w2}.detuneCents must be a number (cents)`);
            if (sv.timeMs !== undefined && !Number.isFinite(sv.timeMs)) errors.push(`${w2}.timeMs must be a number (ms onset offset)`);
          });
        }
      }
    }
  }
}

// A kit row (the drum kit: patch drumKit / instrument drum-kit) picks a piece by
// GM drum note; a note with no piece would be silent, so it's taught here.
function kitOf(node) {
  const name = node && (node.patch || (node.instrument && INSTRUMENTS[node.instrument] && INSTRUMENTS[node.instrument].patch));
  return name && PATCHES[name] && PATCHES[name].kit;
}
function checkKitNotes(node, notes, where, errors) {
  const kit = kitOf(node);
  if (!kit) return;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  for (const n of notes) {
    const m = typeof n === 'string' && /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(n);
    if (!m) continue;
    const midi = (Number(m[3]) + 1) * 12 + SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    if (!kit[midi]) {
      errors.push(`${where}: '${n}' has no drum-kit piece (GM drum notes, C4 = 60: C2 kick, D2 snare, F#2 closed hat, A#2 open hat, F2/A2/C3 toms, C#3 crash, D#3 ride)`);
    }
  }
}

// B6: an `instrument` name resolves to { patch, chain, feel } at normalize time.
function checkInstrument(instrument, where, errors) {
  if (instrument !== undefined && !INSTRUMENTS[instrument]) {
    errors.push(`${where}.instrument '${instrument}' is unknown (instruments: ${Object.keys(INSTRUMENTS).join(', ')})`);
  }
}

// B7: the harmony bus — a named chord dictionary + a progression that
// references it. chordVoice tracks read progression[step] → chords[name].
function checkHarmony(manifest, errors) {
  const { chords, progression } = manifest;
  if (chords !== undefined) {
    if (!chords || typeof chords !== 'object' || Array.isArray(chords) || !Object.keys(chords).length) {
      errors.push('chords must be a non-empty object { name: [notes] } (the chord dictionary)');
    } else {
      for (const [name, notes] of Object.entries(chords)) {
        if (!Array.isArray(notes) || !notes.length) errors.push(`chords.${name} must be a non-empty note array`);
        else notes.forEach((n) => checkNote(n, `chords.${name}`, errors));
      }
    }
  }
  if (progression !== undefined) {
    if (!Array.isArray(progression) || !progression.length) {
      errors.push('progression must be a non-empty array of chord names (stretched across the loop)');
    } else if (chords && typeof chords === 'object') {
      progression.forEach((nm, i) => {
        if (typeof nm !== 'string' || !chords[nm]) errors.push(`progression[${i}] '${nm}' is not a key in chords`);
      });
    }
  }
}

// B7: a chordVoice track follows the harmony bus. Requires chords+progression
// and a sounding voice (patch|instrument, not a foley gesture/cue).
function checkChordVoice(tr, where, manifest, errors) {
  if (!tr || tr.chordVoice === undefined) return;
  if (tr.chordVoice !== true && !CHORD_VOICE_MODES.has(tr.chordVoice)) {
    errors.push(`${where}.chordVoice must be one of: ${[...CHORD_VOICE_MODES].join(', ')} (or true = chord)`);
  }
  if (tr.gesture !== undefined || tr.cue !== undefined) {
    errors.push(`${where}.chordVoice needs a musical voice (patch | instrument), not a gesture/cue`);
  }
  if (!manifest.chords || !manifest.progression) {
    errors.push(`${where}.chordVoice needs a harmony bus: add manifest-level chords + progression`);
  }
}

// B5.2 performance macros: per-channel transpose (semitones) and tone (a
// low-pass at the chain head, 1 = open). Stored values seed the player's
// sliders and the world `bindings` seam; they round-trip through normalize.
function checkMacros(node, where, errors) {
  if (!node || typeof node !== 'object') return;
  if (node.transpose !== undefined && (!Number.isFinite(node.transpose) || node.transpose < -24 || node.transpose > 24)) {
    errors.push(`${where}.transpose must be a number in [-24, 24] (semitones)`);
  }
  if (node.tone !== undefined && (!Number.isFinite(node.tone) || node.tone < 0 || node.tone > 1)) {
    errors.push(`${where}.tone must be a number in [0, 1] (1 = open, 0 = dark)`);
  }
}

// Audio fidelity: per-row opt-ins. `pan` places the row in the stereo field;
// `patchParams` merges over the named patch (the shelf entry is never edited)
// — the door to the voice-level opt-ins below on any patch or instrument.
const PATCH_PARAM_CHECKS = {
  curve: [(v) => v === 'exp' || v === 'linear', "'exp' (exponential decay/release) or 'linear'"],
  vary: [(v) => typeof v === 'boolean', 'true | false (per-hit noise variation)'],
  width: [(v) => Number.isFinite(v) && v >= 0 && v <= 1, 'a number in [0, 1] (unison/partial stereo spread)'],
  tune: [(v) => v === 'exact', "'exact' (fractional-delay string tuning)"],
  ringT60: [(v) => [].concat(v).length <= 2 && [].concat(v).every((x) => Number.isFinite(x) && x > 0 && x <= 30), 'seconds to −60 dB in (0, 30], or [at C2, at C7]'],
  stiffness: [(v) => Number.isFinite(v) && v >= 0 && v <= 1, 'a number in [0, 1] (string dispersion; ~0.5 = grand piano)'],
  maxRing: [(v) => Number.isFinite(v) && v > 0 && v <= 8, 'seconds in (0, 8] (string buffer cap)'],
  keyTrack: [(v) => Number.isFinite(v) && v >= 0 && v <= 2, 'a number in [0, 2] (cutoff × (hz/C4)^k; 1 = brightness follows pitch)'],
  velToFilter: [(v) => Number.isFinite(v) && v >= 0 && v <= 4, 'a number in [0, 4] (velocity → cutoff exponent)'],
  decayTrack: [(v) => Number.isFinite(v) && v >= 0 && v <= 2, 'a number in [0, 2] (modal decay × (C4/hz)^k)'],
  drift: [(v) => Number.isFinite(v) && v >= 0 && v <= 100, 'cents in [0, 100] (slow seeded pitch walk)'],
  breath: [(v) => isObj(v) && ['level', 'tone', 'q'].every((k) => v[k] === undefined || Number.isFinite(v[k])), '{ level? (dB), tone? (Hz), q? } (filtered air under the note)'],
  vibrato: [(v) => isObj(v) && ['rate', 'depth', 'delay'].every((k) => v[k] === undefined || Number.isFinite(v[k])) && (v.spread === undefined || (Number.isFinite(v.spread) && v.spread >= 0 && v.spread <= 1)), '{ rate?, depth? (cents), delay?, spread? (0..1 per-voice de-lock) }'],
};
function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function checkPatchParams(pp, where, errors) {
  if (pp === undefined) return;
  if (!pp || typeof pp !== 'object' || Array.isArray(pp)) {
    errors.push(`${where}.patchParams must be an object merged over the patch (e.g. { "curve": "exp", "vary": true })`);
    return;
  }
  for (const [k, [ok, want]] of Object.entries(PATCH_PARAM_CHECKS)) {
    if (pp[k] !== undefined && !ok(pp[k])) errors.push(`${where}.patchParams.${k} must be ${want}`);
  }
}
function checkMix(node, where, errors) {
  if (!node || typeof node !== 'object') return;
  if (node.pan !== undefined && (!Number.isFinite(node.pan) || node.pan < -1 || node.pan > 1)) {
    errors.push(`${where}.pan must be a number in [-1, 1] (−1 hard left, 0 centre, 1 hard right)`);
  }
  checkPatchParams(node.patchParams, where, errors);
  if (node.glide !== undefined && (!Number.isFinite(node.glide) || node.glide <= 0 || node.glide > 2)) {
    errors.push(`${where}.glide must be seconds in (0, 2] (osc-voice portamento from the row's previous note)`);
  }
}

// B6: `feel` is a preset name or an inline noteFeel params object.
function checkFeel(feel, where, errors) {
  if (feel === undefined) return;
  if (typeof feel === 'string') {
    if (!FEEL_PRESETS[feel]) errors.push(`${where}.feel '${feel}' is unknown (presets: ${Object.keys(FEEL_PRESETS).join(', ')})`);
  } else if (typeof feel !== 'object' || Array.isArray(feel)) {
    errors.push(`${where}.feel must be a preset name (string) or a params object`);
  }
}

function checkGestures(list, where, errors) {
  if (!Array.isArray(list) || !list.length) { errors.push(`${where} must be a non-empty gesture array`); return; }
  list.forEach((g, i) => {
    if (!g || typeof g !== 'object' || !GESTURES.has(g.type)) {
      errors.push(`${where}[${i}].type must be one of: ${[...GESTURES].join(', ')}`);
      return;
    }
    if (g.type === 'sweep') { if (g.from != null) checkNote(g.from, `${where}[${i}].from`, errors); if (g.to != null) checkNote(g.to, `${where}[${i}].to`, errors); }
    if (g.type === 'thump') {
      if (g.from != null) checkNote(g.from, `${where}[${i}].from`, errors);
      if (g.to != null) checkNote(g.to, `${where}[${i}].to`, errors);
      if (g.mass !== undefined && !inRange(g.mass, 0.001, 10000)) errors.push(`${where}[${i}].mass must be kg in [0.001, 10000] (sets from/to/decay you leave out: heavier = lower, longer)`);
    }
    if (g.type === 'burst' && g.filterEnv !== undefined && !(isObj(g.filterEnv) && ['from', 'to', 'decay'].every((k) => g.filterEnv[k] === undefined || (Number.isFinite(g.filterEnv[k]) && g.filterEnv[k] > 0)))) {
      errors.push(`${where}[${i}].filterEnv must be { from?: Hz, to?: Hz, decay?: seconds } (a lowpass sweep over the burst)`);
    }
    if (g.type === 'tone') {
      const w = `${where}[${i}]`;
      if (g.note != null) checkNote(g.note, `${w}.note`, errors);
      if (g.to != null) checkNote(g.to, `${w}.to`, errors);
      if (g.wave !== undefined && !WAVES.has(g.wave)) errors.push(`${w}.wave must be one of: ${[...WAVES].join(', ')}`);
      if (g.dur !== undefined && !inRange(g.dur, 0.01, 30)) errors.push(`${w}.dur must be seconds in [0.01, 30] (how long the tone holds)`);
      for (const k of ['hz', 'attack', 'release', 'lowpass', 'vol']) if (g[k] !== undefined && !(Number.isFinite(g[k]) && g[k] >= 0)) errors.push(`${w}.${k} must be a non-negative number`);
      for (const k of ['tremolo', 'vibrato']) {
        if (g[k] !== undefined && !(isObj(g[k]) && ['rate', 'depth'].every((q) => g[k][q] === undefined || Number.isFinite(g[k][q])))) errors.push(`${w}.${k} must be { rate?: Hz, depth? } (tremolo depth 0..1, vibrato depth in cents)`);
      }
    }
    if (g.type === 'flutter' && g.jitter !== undefined && (!Number.isFinite(g.jitter) || g.jitter < 0 || g.jitter > 1)) {
      errors.push(`${where}[${i}].jitter must be in [0, 1] (0 = machine-gun flutter, ~0.8 = stick-slip creak)`);
    }
    if (g.type === 'grain') {
      if (g.decay !== undefined && !(Number.isFinite(g.decay) || (Array.isArray(g.decay) && g.decay.length === 2 && g.decay.every(Number.isFinite)))) {
        errors.push(`${where}[${i}].decay must be seconds or [min, max] seconds per grain`);
      }
      if (g.band !== undefined && (typeof g.band !== 'object' || Array.isArray(g.band))) {
        errors.push(`${where}[${i}].band must be { lo?: hzHighpass, hi?: hzLowpass }`);
      }
    }
    if (g.type === 'burst' && g.bandpass !== undefined && !(Number.isFinite(g.bandpass) && g.bandpass > 0)) {
      errors.push(`${where}[${i}].bandpass must be a centre frequency in Hz (with q?, e.g. a snare's wires: bandpass 3400, q 0.5)`);
    }
    if (g.type === 'ring') {
      if (g.note != null) checkNote(g.note, `${where}[${i}].note`, errors);
      if (g.wave !== undefined && !WAVES.has(g.wave)) errors.push(`${where}[${i}].wave must be one of: ${[...WAVES].join(', ')}`);
      if (g.size !== undefined && !inRange(g.size, 0.005, 20)) errors.push(`${where}[${i}].size must be metres in [0.005, 20] (pitch = the material's constant / size)`);
      if (g.size !== undefined && (g.note != null || g.hz != null)) errors.push(`${where}[${i}]: pass size OR note/hz, not both (size derives the pitch)`);
      if (g.excite !== undefined && g.excite !== 'noise') errors.push(`${where}[${i}].excite must be 'noise' (a resonator bank struck by noise) or absent (sine/wave partials)`);
      for (const k of ['q', 'highpass']) {
        if (g[k] !== undefined && !(Number.isFinite(g[k]) && g[k] >= 0)) errors.push(`${where}[${i}].${k} must be a non-negative number`);
      }
      if (g.material !== undefined && !RING_MATERIALS.has(g.material)) {
        errors.push(`${where}[${i}].material must be one of: ${[...RING_MATERIALS].join(', ')} (or pass partials)`);
      }
      if (g.partials !== undefined) {
        if (!Array.isArray(g.partials) || !g.partials.length) errors.push(`${where}[${i}].partials must be a non-empty array of { ratio, gain?, decay? }`);
        else g.partials.forEach((p, j) => {
          if (!p || !Number.isFinite(p.ratio)) errors.push(`${where}[${i}].partials[${j}] must be { ratio: number, gain?, decay? }`);
        });
      }
    }
    if (g.type === 'flutter' && g.tiers !== undefined) {
      if (!Array.isArray(g.tiers) || !g.tiers.length) errors.push(`${where}[${i}].tiers must be a non-empty array of { at, table }`);
      else g.tiers.forEach((tier, j) => {
        if (!tier || typeof tier.at !== 'number' || !Array.isArray(tier.table) || !tier.table.length) {
          errors.push(`${where}[${i}].tiers[${j}] must be { at: seconds, table: [notes] }`);
        } else tier.table.forEach((n) => checkNote(n, `${where}[${i}].tiers[${j}].table`, errors));
      });
    }
  });
}

export function validateBeatsManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
  const kind = manifest.kind;
  if (!KIND_SET.has(kind)) {
    return { ok: false, errors: [`manifest.kind must be one of: ${BEATS_KINDS.join(', ')}`] };
  }
  if (!manifest.title || typeof manifest.title !== 'string') errors.push('manifest.title is required (string)');

  if (kind === 'beats-ambient') {
    if (!Number.isFinite(manifest.bpm) || manifest.bpm < 20 || manifest.bpm > 300) errors.push('bpm must be a number in [20, 300]');
    if (manifest.swing !== undefined && (!Number.isFinite(manifest.swing) || manifest.swing < 0 || manifest.swing > 0.5)) errors.push('swing must be in [0, 0.5]');
    if (!Number.isInteger(manifest.seed) || manifest.seed < 0) errors.push('seed is required (non-negative integer) — same recipe + seed replays the same performance');
    if (!Array.isArray(manifest.progression) || !manifest.progression.length) {
      errors.push('progression is required: [{ chord: [notes], root: note }] — one entry per bar');
    } else {
      manifest.progression.forEach((s, i) => {
        if (!s || !Array.isArray(s.chord) || !s.chord.length) errors.push(`progression[${i}].chord must be a non-empty note array`);
        else s.chord.forEach((n) => checkNote(n, `progression[${i}].chord`, errors));
        if (s.root == null) errors.push(`progression[${i}].root is required`);
        else checkNote(s.root, `progression[${i}].root`, errors);
      });
    }
    if (!Array.isArray(manifest.channels) || !manifest.channels.length) {
      errors.push('channels is required: [{ name, role, patch, chain?, level?, sequence?|steps? }]');
    } else {
      const seen = new Set();
      manifest.channels.forEach((ch, i) => {
        const where = `channels[${i}]`;
        if (!ch || typeof ch.name !== 'string' || !ch.name) errors.push(`${where}.name is required (string)`);
        else if (seen.has(ch.name)) errors.push(`${where}.name '${ch.name}' is duplicated`);
        else seen.add(ch.name);
        if (!ROLES.has(ch && ch.role)) errors.push(`${where}.role must be one of: ${[...ROLES].join(', ')}`);
        // B6: ambient channels take `instrument` too (piano in the world orchestra),
        // expanding to patch + chain + feel exactly like parts/tracks.
        checkInstrument(ch && ch.instrument, where, errors);
        checkPatch(ch && ch.patch, where, errors);
        checkFeel(ch && ch.feel, where, errors);
        checkChain(ch && ch.chain, where, errors);
        checkMacros(ch, where, errors);
        checkMix(ch, where, errors);
        if (ch && ch.role === 'melody') {
          if (!ch.sequence || !Array.isArray(ch.sequence.table) || !ch.sequence.table.length) {
            errors.push(`${where} (melody) needs sequence: { table: [notes], gate? }`);
          } else {
            ch.sequence.table.forEach((n) => checkNote(n, `${where}.sequence.table`, errors));
            if (ch.sequence.gate !== undefined && (!Number.isFinite(ch.sequence.gate) || ch.sequence.gate < 0 || ch.sequence.gate > 1)) {
              errors.push(`${where}.sequence.gate must be in [0, 1]`);
            }
          }
        }
        if (kitOf(ch) && ch.role !== 'pulse') errors.push(`${where}: a drum kit belongs on a pulse channel (its note picks the piece)`);
        if (ch && ch.role === 'pulse') {
          checkKitNotes(ch, [ch.note || 'C1'], `${where}.note`, errors); // C1 = the pulse default note
          if (!Array.isArray(ch.steps) || !ch.steps.length) errors.push(`${where} (pulse) needs steps: a 16-slot velocity array (0 = rest)`);
          if (ch.note != null) checkNote(ch.note, `${where}.note`, errors);
        }
      });
    }
  }

  if (kind === 'beats-composition') {
    if (!Number.isFinite(manifest.bpm) || manifest.bpm < 20 || manifest.bpm > 300) errors.push('bpm must be a number in [20, 300]');
    if (!Array.isArray(manifest.parts) || !manifest.parts.length) {
      errors.push('parts is required: [{ name, patch, chain?, events: [[bar:beat:sixteenth, note|[chord], dur?, vel?]] }]');
    } else {
      manifest.parts.forEach((p, i) => {
        const where = `parts[${i}]`;
        if (!p || typeof p.name !== 'string' || !p.name) errors.push(`${where}.name is required (string)`);
        checkInstrument(p && p.instrument, where, errors);
        if (p && p.patch === VOICE_PATCH) checkVoicePart(p, where, errors);
        else checkPatch(p && p.patch, where, errors);
        checkFeel(p && p.feel, where, errors);
        checkChain(p && p.chain, where, errors);
        checkMacros(p, where, errors);
        checkMix(p, where, errors);
        if (!p || !Array.isArray(p.events) || !p.events.length) {
          errors.push(`${where}.events must be a non-empty array of [time, notes, dur?, vel?]`);
        } else {
          p.events.forEach((ev, j) => {
            if (!Array.isArray(ev) || ev.length < 2) { errors.push(`${where}.events[${j}] must be [time, notes, dur?, vel?]`); return; }
            const notes = Array.isArray(ev[1]) ? ev[1] : [ev[1]];
            notes.forEach((n) => checkNote(n, `${where}.events[${j}]`, errors));
            checkKitNotes(p, notes, `${where}.events[${j}]`, errors);
          });
        }
      });
    }
  }

  if (kind === 'beats-pattern') {
    if (!Number.isFinite(manifest.bpm) || manifest.bpm < 20 || manifest.bpm > 300) errors.push('bpm must be a number in [20, 300]');
    if (manifest.swing !== undefined && (!Number.isFinite(manifest.swing) || manifest.swing < 0 || manifest.swing > 0.5)) errors.push('swing must be in [0, 0.5]');
    if (manifest.steps !== undefined && (!Number.isInteger(manifest.steps) || manifest.steps < 8 || manifest.steps > 64)) {
      errors.push('steps must be an integer in [8, 64] (sixteenths per loop; default 32 = two bars)');
    }
    checkHarmony(manifest, errors);
    if (!Array.isArray(manifest.tracks) || !manifest.tracks.length) {
      errors.push('tracks is required: [{ name, patch|gesture|cue, mask: [velocities], notes?|note?, chain?, level? }]');
    } else {
      const seen = new Set();
      manifest.tracks.forEach((tr, i) => {
        const where = `tracks[${i}]`;
        if (!tr || typeof tr.name !== 'string' || !tr.name) errors.push(`${where}.name is required (string)`);
        else if (seen.has(tr.name)) errors.push(`${where}.name '${tr.name}' is duplicated`);
        else seen.add(tr.name);
        // exactly one voice source: a patch or B6 instrument (musical voice) OR a
        // gesture / cue (the foley vocabulary doubling as the drum kit).
        const instruments = ['patch', 'instrument', 'gesture', 'cue'].filter((k) => tr && tr[k] !== undefined);
        if (instruments.length !== 1) {
          errors.push(`${where} needs exactly ONE voice: patch | instrument (synth voice) | gesture (one foley gesture) | cue (gesture list)${instruments.length ? ` — got ${instruments.join(' + ')}` : ''}`);
        } else if (tr.patch !== undefined) {
          checkPatch(tr.patch, where, errors);
        } else if (tr.instrument !== undefined) {
          checkInstrument(tr.instrument, where, errors);
        } else if (tr.gesture !== undefined) {
          checkGestures([tr.gesture], `${where}.gesture`, errors);
        } else {
          checkGestures(tr.cue, `${where}.cue`, errors);
        }
        checkChordVoice(tr, where, manifest, errors);
        if (tr && tr.vary !== undefined) {
          if (typeof tr.vary !== 'boolean') errors.push(`${where}.vary must be true | false`);
          else if (tr.gesture === undefined && tr.cue === undefined) errors.push(`${where}.vary is for gesture/cue tracks (each hit a variant); a patch track varies with patchParams: { vary: true }`);
        }
        if (!tr || !Array.isArray(tr.mask) || !tr.mask.length) {
          errors.push(`${where}.mask is required: velocities per sixteenth (0 = rest, true = 0.9), wraps if shorter than steps`);
        } else {
          tr.mask.forEach((v, j) => {
            const okVel = v === true || v === false || (Number.isFinite(v) && v >= 0 && v <= 1);
            if (!okVel) errors.push(`${where}.mask[${j}] must be a velocity in [0, 1] (or true/false)`);
          });
        }
        if (tr && tr.notes !== undefined) {
          if (!Array.isArray(tr.notes) || !tr.notes.length) errors.push(`${where}.notes must be a non-empty note array (the per-step contour, wraps)`);
          else tr.notes.forEach((n) => {
            // a contour entry is one note or a chord (a note array).
            if (Array.isArray(n)) {
              if (!n.length) errors.push(`${where}.notes: a chord entry must be a non-empty note array`);
              else n.forEach((c) => checkNote(c, `${where}.notes`, errors));
            } else checkNote(n, `${where}.notes`, errors);
          });
        }
        if (tr && tr.note != null) checkNote(tr.note, `${where}.note`, errors);
        if (kitOf(tr)) {
          if (tr.chordVoice !== undefined) errors.push(`${where}: a drum kit plays GM drum notes, not the harmony bus (drop chordVoice)`);
          else if (tr.notes === undefined && tr.note === undefined) errors.push(`${where}: a drum-kit track needs notes (the per-step GM drum notes, e.g. ["C2", "F#2", "D2", "F#2"]) or note`);
          else checkKitNotes(tr, [].concat(...(tr.notes || [tr.note])), `${where}.notes`, errors);
        }
        checkFeel(tr && tr.feel, where, errors);
        checkChain(tr && tr.chain, where, errors);
        checkMacros(tr, where, errors);
        checkMix(tr, where, errors);
      });
    }
  }

  if (kind === 'beats-sfx') {
    const cues = manifest.cues;
    if (!cues || typeof cues !== 'object' || !Object.keys(cues).length) {
      errors.push('cues is required: { <cueId>: [gesture, ...] } with gesture.type ∈ sweep|flutter|burst|thump|grain|ring|tone');
    } else {
      for (const [id, list] of Object.entries(cues)) checkGestures(list, `cues.${id}`, errors);
    }
  }

  checkBus(manifest, manifest.channels || manifest.parts || manifest.tracks, errors);
  return { ok: errors.length === 0, errors };
}

/**
 * Fill musical defaults so a minimal valid recipe is fully self-contained when
 * stored. Never mutates the input. Defaults mirror the spike's tuned values.
 */
// B6: expand a part's `instrument` into { patch, chain, feel } (part fields
// override the instrument's defaults), and resolve any `feel` preset name to
// params. A node with neither is returned unchanged — the null path is stable.
function expandNode(node, { allowInstrument }) {
  const out = { ...node };
  if (allowInstrument && node.instrument) {
    const r = resolveInstrument(node.instrument, { patch: node.patch, chain: node.chain, feel: node.feel });
    out.patch = r.patch;
    if (r.chain !== undefined) out.chain = r.chain; else delete out.chain;
    if (r.feel !== undefined) out.feel = r.feel; else delete out.feel;
    delete out.instrument;
  } else if (node.feel !== undefined) {
    const f = resolveFeel(node.feel);
    if (f !== undefined) out.feel = f; else delete out.feel;
  }
  return out;
}

export function normalizeBeatsManifest(manifest) {
  const m = JSON.parse(JSON.stringify(manifest));
  if (m.kind === 'beats-ambient') {
    if (m.swing === undefined) m.swing = 0;
    m.channels = m.channels.map((ch) => {
      const out = { level: 0, ...expandNode(ch, { allowInstrument: true }) };
      if (!out.patch) {
        out.patch = { harmony: 'pad', roots: 'bassMono', melody: 'sinePluck', pulse: 'kick' }[out.role];
      }
      if (out.role === 'melody' && out.sequence && out.sequence.gate === undefined) {
        out.sequence = { ...out.sequence, gate: 0.7 };
      }
      return out;
    });
  }
  if (m.kind === 'beats-composition') {
    if (m.swing === undefined) m.swing = 0;
    if (m.loop === undefined) m.loop = false;
    m.parts = m.parts.map((p) => {
      const e = expandNode(p, { allowInstrument: true });
      const out = { level: 0, ...e };
      if (!out.patch) out.patch = 'sinePluck';
      return out;
    });
  }
  if (m.kind === 'beats-pattern') {
    if (m.swing === undefined) m.swing = 0;
    if (m.steps === undefined) m.steps = 32;
    // store masks/contours expanded to full loop length — the stored manifest
    // IS the grid (B5.2 renders it), so make every cell explicit.
    const expand = (arr) => Array.from({ length: m.steps }, (_, i) => arr[i % arr.length]);
    // B7 harmony bus: stretch the progression across the loop (4 chords over 32
    // steps → 8 steps each), then store it per-step so every cell is explicit.
    if (Array.isArray(m.progression) && m.progression.length) {
      const pl = m.progression.length;
      m.progression = Array.from({ length: m.steps }, (_, i) => m.progression[Math.floor((i * pl) / m.steps)]);
    }
    m.tracks = m.tracks.map((tr) => {
      const out = { level: 0, ...expandNode(tr, { allowInstrument: true }) };
      out.mask = expand(out.mask).map((v) => (v === true ? 0.9 : v === false ? 0 : v));
      if (out.notes) out.notes = expand(out.notes);
      return out;
    });
  }
  return m;
}
