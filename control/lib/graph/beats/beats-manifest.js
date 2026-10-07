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

import { PATCHES, TABLES } from './audio-patches.js';
import { INSTRUMENTS, FEEL_PRESETS, resolveInstrument, resolveFeel, rangeOfPatch } from './instruments.js';
import { expandBeatsManifest, checkAuthoring } from './beats-authoring.js';

export const BEATS_KINDS = ['beats-ambient', 'beats-composition', 'beats-pattern', 'beats-sfx'];
const KIND_SET = new Set(BEATS_KINDS);
const ROLES = new Set(['harmony', 'roots', 'melody', 'pulse']);
const GESTURES = new Set(['sweep', 'flutter', 'burst', 'thump', 'grain', 'ring', 'tone', 'riser', 'downlifter', 'impact', 'reverse-cymbal', 'scratch']);
// production gestures (anthem styles): the song's transitions.
const PRODUCTION_GESTURES = new Set(['riser', 'downlifter', 'impact', 'reverse-cymbal', 'scratch']);
const RING_MATERIALS = new Set(['glass', 'metal', 'wood', 'cymbal', 'plate', 'bell']);
const WAVES = new Set(['sine', 'square', 'triangle', 'sawtooth']);
const FX = new Set(['filter', 'delay', 'pingpong', 'chorus', 'reverb', 'body', 'drive', 'amp', 'compress', 'phaser', 'flanger', 'tape', 'autopan', 'crush', 'ringmod', 'vocoder', 'wah', 'rotary', 'sympathetic']);
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
    if (f.type === 'reverb' && f.drive !== undefined && !inRange(f.drive, 0, 0.99)) errors.push(`${where}.chain[${i}].drive must be in [0, 0.99] (saturation on the reverb return — the room roars)`);
    const fw = `${where}.chain[${i}]`, lim = (k, lo, hi, why) => { if (f[k] !== undefined && !inRange(f[k], lo, hi)) errors.push(`${fw}.${k} must be in [${lo}, ${hi}]${why ? ` (${why})` : ''}`); };
    if (f.type === 'body' && f.model !== undefined) {
      if (f.model !== 'modal') errors.push(`${fw}.model must be 'modal' (dozens of seeded body modes, convolved) or absent (the parallel resonators)`);
      lim('modes', 4, 160, 'how many body modes'); lim('ring', 0.02, 0.5, 'seconds a 100 Hz mode rings'); lim('lo', 20, 2000); lim('hi', 200, 16000);
    }
    if (f.type === 'sympathetic') {
      lim('mix', 0, 1, 'the halo under the dry part'); lim('decay', 0.5, 20, 'seconds the bass strings ring'); lim('length', 0.5, 6); lim('partials', 1, 8);
      lim('lo', 21, 108, 'lowest key (MIDI)'); lim('hi', 21, 108, 'highest key (MIDI)');
    }
    if (f.type === 'chorus' && f.model !== undefined) {
      if (f.model !== 'bbd') errors.push(`${fw}.model must be 'bbd' (the bucket-brigade ensemble) or absent`);
      if (f.mode !== undefined && !['I', 'II', 'I+II'].includes(f.mode)) errors.push(`${fw}.mode must be 'I', 'II' or 'I+II'`);
    }
    if (f.type === 'drive' && f.model !== undefined && !['tube', 'fuzz', 'fold'].includes(f.model)) errors.push(`${fw}.model must be 'tube' | 'fuzz' | 'fold'`);
    if ((f.type === 'delay' || f.type === 'pingpong') && f.model !== undefined && f.model !== 'dub') errors.push(`${fw}.model must be 'dub' (a filter and a clip inside the feedback) or absent`);
    if (f.type === 'phaser') { lim('stages', 2, 12); lim('rate', 0.01, 20, 'Hz'); lim('depth', 0, 4, 'octaves of sweep'); lim('freq', 50, 12000); lim('mix', 0, 1); }
    if (f.type === 'flanger') { lim('rate', 0.01, 20, 'Hz'); lim('delay', 3, 20, 'ms'); lim('depth', 0, 5, 'ms'); lim('feedback', 0, 0.95); lim('mix', 0, 1); }
    if (f.type === 'tape') { lim('wow', 0, 1); lim('flutter', 0, 1); lim('drive', 0, 0.99); lim('bump', -12, 12, 'dB at 90 Hz'); lim('tone', 1000, 20000); }
    if (f.type === 'autopan') { lim('rate', 0.01, 20, 'Hz'); lim('depth', 0, 1); if (f.sync !== undefined && !/^\d+\/\d+[t.]?$/.test(f.sync)) errors.push(`${fw}.sync must be a note fraction like '1/4' ('1/8t', '1/8.')`); }
    if (f.type === 'wah') { lim('lo', 100, 2000, 'Hz: the heel-down centre'); lim('hi', 400, 6000, 'Hz: the toe-down centre'); lim('q', 0.5, 20); lim('sens', 0, 40, 'how far the playing opens it'); lim('rate', 0.05, 20, 'Hz: an LFO instead of the playing'); lim('at', 0, 1, 'a parked pedal: 0 heel, 1 toe'); lim('level', 0, 4); }
    if (f.type === 'rotary') { if (f.speed !== undefined && !['slow', 'fast'].includes(f.speed)) errors.push(`${fw}.speed must be 'slow' (chorale) or 'fast' (tremolo)`); lim('rate', 0.1, 12, 'Hz: the horn, overriding the speed'); }
    if (f.type === 'crush') { lim('bits', 1, 16, 'the quantizer; rate reduction is not built'); lim('mix', 0, 1); }
    if (f.type === 'ringmod') { lim('hz', 0.1, 10000, 'the carrier sine'); lim('mix', 0, 1); }
    if (f.type === 'vocoder') {
      if (typeof f.modulator !== 'string' || !f.modulator) errors.push(`${fw}.modulator must name another row (the voice whose bands shape this row)`);
      lim('bands', 4, 24); lim('gain', 0, 40); lim('smooth', 2, 200, 'Hz of the band followers');
    }
    if (f.type === 'compress') {
      const lim = { threshold: [-60, 0], ratio: [1, 20], attack: [0, 1], release: [0, 1], parallel: [0, 1], level: [-24, 24] };
      for (const [k, [lo, hi]] of Object.entries(lim)) if (f[k] !== undefined && !inRange(f[k], lo, hi)) errors.push(`${where}.chain[${i}].${k} must be in [${lo}, ${hi}]${k === 'parallel' ? ' (the crushed copy blended under the dry)' : ''}`);
    }
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
  if (r.model !== undefined && !['room2', 'noise', 'gated', 'reverse', 'plate'].includes(r.model)) errors.push(`${where}.model must be 'room2' (pre-delay, early reflections, highs die first), 'noise' (the classic tail), 'gated' (a room cut at \`gate\` s), 'reverse' (the impulse backwards) or 'plate' (dense and bright from the first millisecond: the 90s snare and vocal)`);
  if (r.gate !== undefined && !inRange(r.gate, 0.03, 2)) errors.push(`${where}.gate must be seconds in [0.03, 2] (where the gated room is cut)`);
  if (r.predelay !== undefined && !inRange(r.predelay, 0, 0.2)) errors.push(`${where}.predelay must be seconds in [0, 0.2]`);
  if (r.damp !== undefined && !inRange(r.damp, 0, 1)) errors.push(`${where}.damp must be in [0, 1] (how fast the highs die)`);
}
export const MASTER_STYLES = ['loud-00s', 'bright-90s'];
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
    if (!isObj(ms)) errors.push('master must be an object { limit?, glue?, style? }');
    else {
      if (ms.style !== undefined && !MASTER_STYLES.includes(ms.style)) errors.push(`master.style must be one of: ${MASTER_STYLES.join(', ')} (the era's bus: 'loud-00s' masters the export to about −8 LUFS, 'bright-90s' to about −11)`);
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
      if (ex.loop !== undefined && typeof ex.loop !== 'boolean') errors.push('export.loop must be true | false (one seamless pass to the bar line, with a smpl loop chunk)');
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
  players: [(v) => Number.isInteger(v) && v >= 1 && v <= 16, 'an integer in [1, 16] (section size; voices cap at 8)'],
  velMap: [(v) => isObj(v) && Object.values(v).every((r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)), "{ param | 'group.param': [at vel 0, at vel 1] } (velocity → timbre, e.g. { 'attackNoise.level': [-24, -8] })"],
  drive: [(v) => inRange(v, 0, 0.99), 'a number in [0, 0.99] (the piece\'s own clip stage)'],
  claps: [(v) => Number.isInteger(v) && v >= 1 && v <= 24, 'an integer in [1, 24] (noise bursts in the train)'],
  // the era synths (va / fm4)
  wave: [(v) => ['sine', 'square', 'triangle', 'sawtooth', 'pulse', 'supersaw'].includes(v), "one of sine | square | triangle | sawtooth | pulse | supersaw"],
  pw: [(v) => inRange(v, 0.02, 0.98), 'a pulse width in [0.02, 0.98] (0.5 = square: no even harmonics)'],
  supersaw: [(v) => isObj(v) && (v.detune === undefined || inRange(v.detune, 0, 1)) && (v.mix === undefined || inRange(v.mix, 0, 1)), '{ detune?: 0..1 (the classic curve), mix?: 0..1 (centre vs sides) }'],
  sub: [(v) => isObj(v) && (v.level === undefined || inRange(v.level, -60, 12)) && (v.octave === undefined || v.octave === 1 || v.octave === 2), '{ level?: dB, octave?: 1 | 2 } (a square under the note)'],
  noise: [(v) => isObj(v) && (v.level === undefined || inRange(v.level, -60, 12)), '{ level?: dB } (white noise in the oscillator mix)'],
  lfo: [(v) => [].concat(v).length >= 1 && [].concat(v).length <= 2 && [].concat(v).every((l) => isObj(l) && LFO_TARGETS.includes(l.target) && (l.rate === undefined || inRange(l.rate, 0.01, 40)) && (l.sync === undefined || SYNC_RE.test(l.sync)) && (l.shape === undefined || LFO_SHAPES.includes(l.shape)) && (l.depth === undefined || Number.isFinite(l.depth)) && (l.delay === undefined || inRange(l.delay, 0, 10))), "1–2 slots { rate?: Hz | sync?: '1/8' ('1/8t', '1/8.'), shape?: sine|triangle|square|ramp, target: pitch|filter|pw|amp|pan, depth (cents for pitch/filter, 0..1 for pw/amp/pan), delay? }"],
  filter: [(v) => isObj(v) && (v.mode === undefined || FILTER_MODES.includes(v.mode)) && (v.slope === undefined || v.slope === 12 || v.slope === 24) && (v.drive === undefined || inRange(v.drive, 0, 0.99)) && (v.freq === undefined || inRange(v.freq, 10, 22000)), "{ mode?: lowpass | highpass | bandpass | … | ladder24 | hp24 | bp | svf12, freq?, q?, slope?: 12 | 24, drive? }"],
  filterEnv: [(v) => isObj(v) && ['from', 'to', 'decay'].every((k) => v[k] === undefined || (Number.isFinite(v[k]) && v[k] > 0)) && (v.amount === undefined || inRange(v.amount, 0, 4)) && (v.velAmount === undefined || inRange(v.velAmount, 0, 4)), '{ from?, to?, decay?, amount?: 0..4 (sweep depth), velAmount?: 0..4 (harder = deeper) }'],
  algorithm: [(v) => Number.isInteger(v) && v >= 1 && v <= 8, 'an integer in [1, 8] (the 4-op algorithm)'],
  feedback: [(v) => inRange(v, 0, 1), 'a number in [0, 1] (operator 4 self-feedback)'],
  ops: [(v) => Array.isArray(v) && v.length <= 4 && v.every((o) => isObj(o) && ['ratio', 'level', 'attack', 'decay', 'sustain', 'release', 'velSens', 'detune'].every((k) => o[k] === undefined || Number.isFinite(o[k]))), 'up to 4 operators [{ ratio, level (a modulator\'s level is its index), attack?, decay?, sustain?, release?, velSens?, detune? }]'],
  table: [(v) => (typeof v === 'string' && TABLES[v]) || (Array.isArray(v) && v.length && v.every((x) => Number.isFinite(x) && Math.abs(x) <= 1)), `a named table (${Object.keys(TABLES).join(', ')}) or sine amplitudes [h1, h2, …]`],
  harmonics: [(v) => Array.isArray(v) && v.length >= 1 && v.length <= 64 && v.every((x) => Number.isFinite(x) && Math.abs(x) <= 1), 'sine amplitudes [h1, h2, …] in [-1, 1], up to 64'],
  tremolo: [(v) => isObj(v) && (v.rate === undefined || inRange(v.rate, 0.1, 40)) && (v.depth === undefined || inRange(v.depth, 0, 1)), '{ rate?: Hz (0.1..40), depth?: 0..1 } (an amplitude LFO)'],
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
  // orchestra section params: players (section size) and desk (depth).
  if (node.players !== undefined && !(Number.isInteger(node.players) && node.players >= 1 && node.players <= 16)) {
    errors.push(`${where}.players must be an integer in [1, 16] (the section size: unison voices with de-locked onsets and vibrato)`);
  }
  if (node.choke !== undefined && !(isObj(node.choke) && Object.entries(node.choke).every(([k, v]) => /^\d+$/.test(k) && typeof v === 'string' && v))) {
    errors.push(`${where}.choke must be { <GM note number>: group } (an open hat is cut by the next note of its group, e.g. { "42": "hat", "46": "hat" })`);
  }
  if (node.roomMix !== undefined && !inRange(node.roomMix, 0, 1)) {
    errors.push(`${where}.roomMix must be in [0, 1] (how big the room is: the wet of the row's last reverb)`);
  }
  if (node.trim !== undefined && !inRange(node.trim, -40, 12)) errors.push(`${where}.trim must be dB in [-40, 12] (a gain at the row's chain head)`);
  if (node.desk !== undefined && node.desk !== 'front' && node.desk !== 'back') {
    errors.push(`${where}.desk must be 'front' or 'back' (depth: back is darker, later and wetter)`);
  }
}
export const SEATINGS = ['american', 'european', 'film'];
const LFO_TARGETS = ['pitch', 'filter', 'pw', 'amp', 'pan'];
const LFO_SHAPES = ['sine', 'triangle', 'square', 'ramp', 'saw', 'sawtooth'];
const FILTER_MODES = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass', 'ladder24', 'hp24', 'bp', 'svf12'];
const SYNC_RE = /^\d+\/\d+[t.]?$/;
// the era rack's scheduled transforms on a row: gate, duck, stutter.
function checkRack(node, where, rows, errors) {
  if (node.gate !== undefined) {
    const g = node.gate;
    if (!isObj(g) || !Array.isArray(g.mask) || !g.mask.length || !g.mask.every((v) => v === true || v === false || inRange(v, 0, 1))) errors.push(`${where}.gate must be { mask: [levels per sixteenth, 0..1], smooth?: s, depth?: 0..1 } (the trance gate)`);
    else { if (g.smooth !== undefined && !inRange(g.smooth, 0, 0.05)) errors.push(`${where}.gate.smooth must be seconds in [0, 0.05]`); if (g.depth !== undefined && !inRange(g.depth, 0, 1)) errors.push(`${where}.gate.depth must be in [0, 1]`); }
  }
  if (node.duck !== undefined) {
    const d = node.duck;
    if (!isObj(d) || typeof d.by !== 'string') errors.push(`${where}.duck must be { by: '<row name>', depth?: dB, attack?: s, release?: s } (the sidechain pump)`);
    else {
      if (!rows.some((r) => r && r.name === d.by)) errors.push(`${where}.duck.by '${d.by}' is not a row of this recipe`);
      if (d.depth !== undefined && !inRange(d.depth, 0, 60)) errors.push(`${where}.duck.depth must be dB in [0, 60]`);
      for (const k of ['attack', 'release']) if (d[k] !== undefined && !inRange(d[k], 0, 2)) errors.push(`${where}.duck.${k} must be seconds in [0, 2]`);
    }
  }
  if (node.stutter !== undefined) checkStutter(node.stutter, `${where}.stutter`, errors);
}
function checkStutter(st, where, errors) {
  if (!Array.isArray(st) || !st.every((x) => isObj(x) && isTime(x.at) && isTime(x.len) && (x.repeats === undefined || (Number.isInteger(x.repeats) && x.repeats >= 2 && x.repeats <= 32)))) errors.push(`${where} must be [{ at, len, repeats? (2..32) }] (beat-repeat: the slice at \`at\` plays \`repeats\` times)`);
}
// step fields beside a pattern track's mask (the acid line): accent, slide, ratchet, prob.
function checkSteps(tr, where, errors) {
  const arr = (k, ok, want) => {
    const v = tr[k];
    if (v === undefined) return;
    if (!(Array.isArray(v) ? v.length && v.every(ok) : ok(v))) errors.push(`${where}.${k} must be ${want} — per step, wrapping like mask`);
  };
  arr('accent', (x) => x === true || x === false || inRange(x, 0, 2), 'a level (0 off, 1 on, up to 2) or true/false');
  arr('slide', (x) => x === true || x === false || x === 0 || x === 1, '1/0 (true/false): hold into the next note with a 60 ms glide');
  arr('ratchet', (x) => Number.isInteger(x) && x >= 1 && x <= 8, 'a retrigger count in [1, 8]');
  arr('prob', (x) => inRange(x, 0, 1), 'a probability in [0, 1] (a seeded coin per loop)');
  if ((tr.accent || tr.slide || tr.ratchet) && (tr.gesture !== undefined || tr.cue !== undefined) && tr.slide) errors.push(`${where}.slide needs a pitched voice (patch | instrument), not a gesture/cue`);
}

// B6: `feel` is a preset name or an inline noteFeel params object.
function checkFeel(feel, where, errors) {
  if (feel === undefined) return;
  if (typeof feel === 'string') {
    if (!FEEL_PRESETS[feel]) errors.push(`${where}.feel '${feel}' is unknown (presets: ${Object.keys(FEEL_PRESETS).join(', ')})`);
  } else if (typeof feel !== 'object' || Array.isArray(feel)) {
    errors.push(`${where}.feel must be a preset name (string) or a params object`);
  } else {
    if (feel.laid !== undefined && !(isObj(feel.laid) && Object.values(feel.laid).every((v) => inRange(v, -0.05, 0.05)))) errors.push(`${where}.feel.laid must be { <GM note>: seconds in [-0.05, 0.05] } (behind (+) or ahead (−) of the beat)`);
    if (feel.accent !== undefined && !(isObj(feel.accent) && Array.isArray(feel.accent.notes) && Array.isArray(feel.accent.pattern) && feel.accent.pattern.length && feel.accent.pattern.every((v) => inRange(v, 0, 2)))) errors.push(`${where}.feel.accent must be { notes: [GM notes], pattern: [velocity scale per sixteenth of the beat] }`);
    if (feel.flam !== undefined && !(isObj(feel.flam) && Array.isArray(feel.flam.notes))) errors.push(`${where}.feel.flam must be { notes: [GM notes], gap?: seconds, vel?: scale } (a grace hit before)`);
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
    if (PRODUCTION_GESTURES.has(g.type)) {
      const w = `${where}[${i}]`, lim = (k, lo, hi, why) => { if (g[k] !== undefined && !inRange(g[k], lo, hi)) errors.push(`${w}.${k} must be in [${lo}, ${hi}]${why ? ` (${why})` : ''}`); };
      lim('dur', 0.05, 60, 'seconds'); lim('bars', 0.25, 64, 'bars at the recipe\'s tempo'); lim('beats', 0.25, 256); lim('vol', 0, 2); lim('at', 0, 60, 'seconds after the hit');
      if (g.dur !== undefined && (g.bars !== undefined || g.beats !== undefined)) errors.push(`${w}: give dur (seconds) OR bars / beats, not both`);
      if (g.type === 'riser' || g.type === 'downlifter' || g.type === 'reverse-cymbal') { lim('from', 20, 20000, 'Hz where the filter starts'); lim('to', 20, 20000, 'Hz where it ends'); lim('q', 0.1, 30); }
      if (g.tone != null) { if (g.type !== 'riser' && g.type !== 'downlifter') errors.push(`${w}.tone is for a riser or downlifter (a tone layer moving an octave)`); else checkNote(g.tone, `${w}.tone`, errors); }
      if (g.note != null) { if (g.type !== 'impact' && g.type !== 'scratch') errors.push(`${w}.note is for an impact (its body) or a scratch (its pitch)`); else checkNote(g.note, `${w}.note`, errors); }
      if (g.type === 'scratch') lim('rate', 1, 30, 'strokes per second (a baby scratch ~8)');
      if (g.type === 'impact') lim('decay', 0.1, 10, 'seconds of the boom');
      if (g.seed !== undefined && !(Number.isInteger(g.seed) && g.seed >= 0)) errors.push(`${w}.seed must be a non-negative integer`);
    }
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

// ── the score substrate (orchestra and era; beats-composition only) ────────
// meter / meters / tempo / phrases at manifest level; per part `form`,
// `dynamics`, and events as tuples [at, notes, dur?, vel?, art?] or objects
// { at, n, d?, v?, art?, dyn? }. Shapes are taught as errors; musical range
// is ADVICE (a warning, the note still plays).
export const DYNAMICS = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff'];
const DYN_SET = new Set(DYNAMICS);
const METER_RE = /^([1-9]\d?)\/(1|2|4|8|16)$/;
const isTime = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0) || (typeof v === 'string' && /^\d+(\.\d+)?(:\d+(\.\d+)?){0,2}$/.test(v));
const SCORE_FIELDS = ['meter', 'meters', 'tempo', 'phrases'];
function midiOfName(n) {
  const m = typeof n === 'string' && /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(n);
  if (!m) return null;
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (Number(m[3]) + 1) * 12 + SEMI[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
// one event, either form → its notes (for note/kit/range checks), or null.
function checkEvent(ev, where, errors) {
  let at, notes, art, dyn;
  if (Array.isArray(ev)) {
    if (ev.length < 2) { errors.push(`${where} must be [time, notes, dur?, vel?, art?] or { at, n, d?, v?, art?, dyn? }`); return null; }
    [at, notes] = ev; art = ev[4];
    if (ev[3] != null && !(Number.isFinite(ev[3]) && ev[3] >= 0 && ev[3] <= 1)) errors.push(`${where}: velocity must be in [0, 1]`);
  } else if (isObj(ev)) {
    ({ at, n: notes, art, dyn } = ev);
    if (notes === undefined) { errors.push(`${where}: an object event needs n (a note or chord), e.g. { at: '0:0:0', n: 'C4', d: '0:1:0', v: 0.7 }`); return null; }
    if (ev.v != null && !(Number.isFinite(ev.v) && ev.v >= 0 && ev.v <= 1)) errors.push(`${where}.v must be a velocity in [0, 1]`);
    if (dyn !== undefined && !DYN_SET.has(dyn)) errors.push(`${where}.dyn must be one of: ${DYNAMICS.join(', ')} (it replaces v)`);
  } else { errors.push(`${where} must be [time, notes, dur?, vel?, art?] or { at, n, d?, v?, art?, dyn? }`); return null; }
  if (at === undefined || !isTime(at)) errors.push(`${where}: time must be "bar:beat:sixteenth" or a number of beats (got ${JSON.stringify(at)})`);
  if (art !== undefined) checkArt(art, where, errors);
  return Array.isArray(notes) ? notes : [notes];
}
export const ARTICULATIONS = ['legato', 'staccato', 'staccatissimo', 'tenuto', 'marcato', 'accent', 'sfz', 'fp', 'swell', 'pizz', 'col-legno', 'trem', 'roll', 'trill', 'gliss', 'port', 'mute', 'flutter-tongue'];
// guitar and lead articulations (anthem styles).
export const GUITAR_ARTICULATIONS = ['bend', 'slide', 'dive', 'vib', 'pm', 'harm', 'pop', 'hammer', 'pull', 'tap', 'nat', 'rake', 'rest'];
const ART_SET = new Set([...ARTICULATIONS, ...GUITAR_ARTICULATIONS]);
const GUITAR_SET = new Set(GUITAR_ARTICULATIONS);
function checkGuitarArt(art, ty, where, errors) {
  const w = `${where}.art`, lim = (k, lo, hi, why) => { if (art[k] !== undefined && !inRange(art[k], lo, hi)) errors.push(`${w}.${k} must be in [${lo}, ${hi}]${why ? ` (${why})` : ''}`); };
  if (ty === 'bend' || ty === 'dive') lim('to', -48, 24, 'semitones: a bend of 2 is a whole step; a dive goes down');
  lim('at', 0, 30, 'seconds after the onset'); lim('over', 0.005, 30, 'seconds the move takes');
  if (ty === 'slide') { lim('in', -24, 24, 'semitones the note slides in from'); lim('out', -48, 24, 'semitones it slides away to at the end'); if (art.in === undefined && art.out === undefined) errors.push(`${w} (slide) needs in (semitones, e.g. -3) and/or out (e.g. -12)`); }
  if (art.release !== undefined && art.release !== true && !(isObj(art.release) && ['at', 'over'].every((k) => art.release[k] === undefined || inRange(art.release[k], 0, 30)))) errors.push(`${w}.release must be true or { at?, over? } (seconds: the bend comes back down)`);
  if (art.pre !== undefined && typeof art.pre !== 'boolean') errors.push(`${w}.pre must be true | false (a pre-bend: the note starts bent, then releases)`);
  if (ty === 'harm') { if (art.k !== undefined && !(Number.isInteger(art.k) && art.k >= 2 && art.k <= 8)) errors.push(`${w}.k must be the partial that squeals, an integer in [2, 8] (default a seeded 3–5)`); lim('gain', 0, 30, 'dB of the squeal at the attack'); }
  if (ty === 'pm') lim('t60', 0.03, 0.5, 'seconds the muted string rings');
  if (ty === 'nat' && art.k !== undefined && !(Number.isInteger(art.k) && art.k >= 2 && art.k <= 6)) errors.push(`${w}.k must be the harmonic, an integer in [2, 6] (2 = the 12th fret, 3 = the 7th, 4 = the 5th)`);
  if (ty === 'rake' && art.n !== undefined && !(Number.isInteger(art.n) && art.n >= 1 && art.n <= 4)) errors.push(`${w}.n must be 1–4 muted grace notes raked into the note`);
  const v = ty === 'vib' ? art : art.vib;
  if (v !== undefined && !(Number.isFinite(v) || isObj(v))) errors.push(`${w}.vib must be a depth in cents or { depth?, rate?, delay? }`);
  else if (isObj(v)) { if (v.depth !== undefined && !inRange(v.depth, 0, 400)) errors.push(`${w}${ty === 'vib' ? '' : '.vib'}.depth must be cents in [0, 400]`); if (v.rate !== undefined && !inRange(v.rate, 0.5, 20)) errors.push(`${w}${ty === 'vib' ? '' : '.vib'}.rate must be Hz in [0.5, 20]`); if (v.delay !== undefined && !inRange(v.delay, 0, 10)) errors.push(`${w}${ty === 'vib' ? '' : '.vib'}.delay must be seconds in [0, 10]`); }
}
function checkArt(art, where, errors) {
  const type = typeof art === 'string' ? art : isObj(art) ? art.type : undefined;
  if (typeof type !== 'string' || !ART_SET.has(type)) { errors.push(`${where}.art must be one of: ${ARTICULATIONS.join(', ')} (or { type, rate?, interval?, to?, mode?, scale? }); guitar and lead: ${GUITAR_ARTICULATIONS.join(', ')}`); return; }
  if (!isObj(art)) return;
  if (GUITAR_SET.has(type)) { checkGuitarArt(art, type, where, errors); return; }
  if (art.rate !== undefined && !inRange(art.rate, 1, 40)) errors.push(`${where}.art.rate must be Hz in [1, 40] (trill notes / tremolo strokes per second)`);
  if (art.interval !== undefined && !(Number.isInteger(art.interval) && art.interval >= -12 && art.interval <= 12 && art.interval)) errors.push(`${where}.art.interval must be semitones in [-12, 12], not 0 (the trill's neighbour; default 2)`);
  if (art.to !== undefined) checkNote(art.to, `${where}.art.to`, errors);
  if (art.mode !== undefined && art.mode !== 'lfo') errors.push(`${where}.art.mode must be 'lfo' (an amplitude tremolo instead of retriggered strokes)`);
  if (art.time !== undefined && !inRange(art.time, 0.005, 2)) errors.push(`${where}.art.time must be seconds in [0.005, 2] (the portamento slide)`);
  if (art.scale !== undefined && !(Array.isArray(art.scale) && art.scale.length && art.scale.every((x) => Number.isInteger(x) && x >= 0 && x < 12))) errors.push(`${where}.art.scale must be pitch classes [0..11] (the gliss run; default major)`);
  if (art.run !== undefined && typeof art.run !== 'boolean') errors.push(`${where}.art.run must be true | false (a stepped run instead of a pitch slide)`);
  if (art.cresc !== undefined && !inRange(art.cresc, 0.2, 4)) errors.push(`${where}.art.cresc must be a velocity ratio in [0.2, 4] (a roll/trem that swells from its first stroke to its last)`);
}
function checkScore(m, errors) {
  if (m.kind !== 'beats-composition') {
    for (const k of SCORE_FIELDS) if (m[k] !== undefined) errors.push(`${k} is a beats-composition field (the score substrate); a ${m.kind} has no score`);
    return;
  }
  if (m.meter !== undefined && !METER_RE.test(String(m.meter))) errors.push(`meter must be like '3/4', '6/8', '5/4', '7/8' (beats in the bar / note value)`);
  if (m.meters !== undefined) {
    if (!Array.isArray(m.meters)) errors.push('meters must be [{ at: bar, meter }] (a meter change from that bar on)');
    else m.meters.forEach((x, i) => {
      if (!isObj(x) || !Number.isInteger(x.at) || x.at < 0) errors.push(`meters[${i}].at must be a bar index (integer ≥ 0)`);
      if (!isObj(x) || !METER_RE.test(String(x.meter))) errors.push(`meters[${i}].meter must be like '3/4' or '6/8'`);
    });
  }
  if (m.tempo !== undefined) {
    if (!Array.isArray(m.tempo)) errors.push("tempo must be [{ at, bpm, ramp? }] — a tempo map; ramp 'linear' | 'exp' arrives at bpm by `at` (rit./accel.), no ramp = a step");
    else m.tempo.forEach((x, i) => {
      if (!isObj(x) || !isTime(x.at)) errors.push(`tempo[${i}].at must be "bar:beat:sixteenth" or beats`);
      if (!isObj(x) || !inRange(x.bpm, 20, 300)) errors.push(`tempo[${i}].bpm must be in [20, 300]`);
      if (isObj(x) && x.ramp !== undefined && x.ramp !== 'linear' && x.ramp !== 'exp') errors.push(`tempo[${i}].ramp must be 'linear' or 'exp' (or absent for a step)`);
    });
  }
  if (m.phrases !== undefined) {
    if (!isObj(m.phrases)) errors.push('phrases must be { name: [events] } — a motif written once, placed by a part\'s form');
    else for (const [name, list] of Object.entries(m.phrases)) {
      if (!Array.isArray(list) || !list.length) errors.push(`phrases.${name} must be a non-empty event array (times relative to the phrase start)`);
      else list.forEach((ev, j) => { const notes = checkEvent(ev, `phrases.${name}[${j}]`, errors); if (notes) notes.forEach((n) => (typeof n === 'number' ? null : checkNote(n, `phrases.${name}[${j}]`, errors))); });
    }
  }
}
function checkPartScore(p, where, m, errors, warnings) {
  if (p.form !== undefined) {
    if (!Array.isArray(p.form)) errors.push(`${where}.form must be [{ phrase, at, transpose?, vel?, invert?, retro? }]`);
    else p.form.forEach((f, j) => {
      const w = `${where}.form[${j}]`;
      if (!isObj(f)) { errors.push(`${w} must be { phrase, at, transpose?, vel?, invert?, retro? }`); return; }
      if (!m.phrases || !m.phrases[f.phrase]) errors.push(`${w}.phrase '${f.phrase}' is not in the manifest's phrases (${Object.keys(m.phrases || {}).join(', ') || 'none defined'})`);
      if (!isTime(f.at)) errors.push(`${w}.at must be "bar:beat:sixteenth" or beats`);
      if (f.transpose !== undefined && !(Number.isInteger(f.transpose) && Math.abs(f.transpose) <= 48)) errors.push(`${w}.transpose must be whole semitones in [-48, 48]`);
      if (f.vel !== undefined && !inRange(f.vel, 0, 2)) errors.push(`${w}.vel must be a velocity scale in [0, 2]`);
      for (const k of ['invert', 'retro']) if (f[k] !== undefined && typeof f[k] !== 'boolean') errors.push(`${w}.${k} must be true | false`);
    });
  }
  if (p.dynamics !== undefined) {
    if (!Array.isArray(p.dynamics)) errors.push(`${where}.dynamics must be [{ at, to, over?, from? }] — marks and hairpins (to: a mark like 'ff' or a velocity)`);
    else p.dynamics.forEach((d, j) => {
      const w = `${where}.dynamics[${j}]`;
      const lvl = (v) => DYN_SET.has(v) || inRange(v, 0, 1);
      if (!isObj(d) || !isTime(d.at)) errors.push(`${w}.at must be "bar:beat:sixteenth" or beats`);
      if (!isObj(d) || !lvl(d.to)) errors.push(`${w}.to must be a mark (${DYNAMICS.join(' ')}) or a velocity in [0, 1]`);
      if (isObj(d) && d.from !== undefined && !lvl(d.from)) errors.push(`${w}.from must be a mark or a velocity in [0, 1]`);
      if (isObj(d) && d.over !== undefined && !isTime(d.over)) errors.push(`${w}.over must be a length ("0:2:0") or beats — the hairpin's span`);
    });
  }
  // musical range (advice only): the named instrument's playable range.
  const range = rangeOfPatch(p.patch || (p.instrument && INSTRUMENTS[p.instrument] && INSTRUMENTS[p.instrument].patch));
  if (range && warnings) {
    const [lo, hi] = range.map(midiOfName);
    const all = [...(p.events || []).map((ev) => (Array.isArray(ev) ? ev[1] : ev && ev.n))];
    for (const f of p.form || []) for (const ev of (m.phrases || {})[f && f.phrase] || []) all.push([].concat(Array.isArray(ev) ? ev[1] : ev && ev.n).map((n) => { const x = midiOfName(n); return x == null ? n : x + (f.transpose || 0); }));
    const out = new Set();
    for (const n of all.flatMap((x) => [].concat(x))) { const x = typeof n === 'number' ? n : midiOfName(n); if (x != null && (x < lo || x > hi)) out.add(typeof n === 'number' ? `midi ${n}` : n); }
    if (out.size) warnings.push(`${where} ('${p.name}'): ${[...out].slice(0, 6).join(', ')} outside the ${range[0]}–${range[1]} range of ${p.instrument || p.patch} (advice: it plays anyway)`);
  }
}

export function validateBeatsManifest(manifest) {
  const errors = [];
  const warnings = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
  const kind = manifest.kind;
  if (!KIND_SET.has(kind)) {
    return { ok: false, errors: [`manifest.kind must be one of: ${BEATS_KINDS.join(', ')}`] };
  }
  if (!manifest.title || typeof manifest.title !== 'string') errors.push('manifest.title is required (string)');
  // anthem styles: the compact authoring fields (chord symbols, a chart,
  // grooves, modulate, cue parts …) are taught first, then the recipe they
  // expand to is validated like any literal one.
  const nBefore = errors.length;
  checkAuthoring(manifest, errors);
  if (errors.length > nBefore) return { ok: false, errors };
  manifest = expandBeatsManifest(manifest);

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
        // a cue part (anthem styles): fires a gesture list at each event.
        if (p && (p.cue !== undefined || p.gesture !== undefined)) {
          const voices = ['patch', 'instrument', 'gesture', 'cue'].filter((k) => p[k] !== undefined);
          if (voices.length !== 1) errors.push(`${where} needs exactly ONE voice: patch | instrument (a pitched part) or cue | gesture (a cue part firing gestures at its events) — got ${voices.join(' + ')}`);
          if (p.cue !== undefined) checkGestures(p.cue, `${where}.cue`, errors);
          else if (p.gesture !== undefined) checkGestures([p.gesture], `${where}.gesture`, errors);
          if (p.vary !== undefined && typeof p.vary !== 'boolean') errors.push(`${where}.vary must be true | false (default true: each hit is a variant)`);
          for (const k of ['form', 'dynamics', 'chordVoice', 'groove', 'glide', 'players']) if (p[k] !== undefined) errors.push(`${where}.${k} is not for a cue part (it fires gestures; give it events: times, { at, v }, or [at, _, dur, vel])`);
          if (!Array.isArray(p.events) || !p.events.length) errors.push(`${where}.events must be a non-empty array of hit times — '4:0:0', { at: '8:0:0', v: 0.7 }, or [at, _, dur, vel]`);
          else p.events.forEach((ev, j) => checkEvent(ev, `${where}.events[${j}]`, errors));
          checkChain(p.chain, where, errors);
          checkMacros(p, where, errors);
          checkMix(p, where, errors);
          return;
        }
        checkInstrument(p && p.instrument, where, errors);
        if (p && p.patch === VOICE_PATCH) checkVoicePart(p, where, errors);
        else checkPatch(p && p.patch, where, errors);
        checkFeel(p && p.feel, where, errors);
        checkChain(p && p.chain, where, errors);
        checkMacros(p, where, errors);
        checkMix(p, where, errors);
        const hasForm = p && Array.isArray(p.form) && p.form.length;
        if (!p || (!hasForm && (!Array.isArray(p.events) || !p.events.length)) || (p.events !== undefined && !Array.isArray(p.events))) {
          errors.push(`${where}.events must be a non-empty array of [time, notes, dur?, vel?] (or give the part a form over the manifest's phrases)`);
        } else {
          (p.events || []).forEach((ev, j) => {
            const notes = checkEvent(ev, `${where}.events[${j}]`, errors);
            if (!notes) return;
            notes.forEach((n) => checkNote(n, `${where}.events[${j}]`, errors));
            checkKitNotes(p, notes, `${where}.events[${j}]`, errors);
          });
        }
        if (p) checkPartScore(p, where, manifest, errors, warnings);
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
        if (tr) checkSteps(tr, where, errors);
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
      for (const [id, list] of Object.entries(cues)) {
        checkGestures(list, `cues.${id}`, errors);
        if (Array.isArray(list) && list.some((g) => g && (g.bars !== undefined || g.beats !== undefined))) errors.push(`cues.${id}: bars / beats need a tempo — a beats-sfx cue times its gestures in dur (seconds)`);
      }
    }
  }

  checkBus(manifest, manifest.channels || manifest.parts || manifest.tracks, errors);
  checkScore(manifest, errors);
  const allRows = manifest.channels || manifest.parts || manifest.tracks || [];
  allRows.forEach((r, i) => { if (r && typeof r === 'object') checkRack(r, `row ${i} ('${r.name}')`, allRows, errors); });
  if (manifest.stutter !== undefined) checkStutter(manifest.stutter, 'stutter', errors);
  if ((manifest.stutter || allRows.some((r) => r && (r.gate || r.duck || r.stutter))) && manifest.kind === 'beats-ambient') errors.push('gate / duck / stutter are for beats-composition and beats-pattern (an ambient bar is derived live)');
  if (manifest.seating !== undefined && !SEATINGS.includes(manifest.seating)) errors.push(`seating must be one of: ${SEATINGS.join(', ')} (pan + depth per orchestral family; a row's own pan/desk wins)`);
  if (manifest.a4 !== undefined && !inRange(manifest.a4, 415, 466)) errors.push('a4 must be Hz in [415, 466] (the reference pitch; 440 default, 442 orchestral, 415 baroque)');
  // warnings (advice) only when there are some: the result shape is unchanged otherwise.
  return warnings.length ? { ok: errors.length === 0, errors, warnings } : { ok: errors.length === 0, errors };
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

// players (a section size) lowers into patchParams: one voice per player (the
// kernel caps at 8), the patch's vibrato de-locked per voice, a little drift.
// a kit's chokes become the row's `choke` (explicit in the stored row), and a
// row's `roomMix` sets its last reverb's wet (the kit room's size dial).
function lowerKit(out) {
  const p = PATCHES[out.patch];
  if (p && p.chokes && out.choke === undefined) out = { ...out, choke: { ...p.chokes } };
  if (out.roomMix !== undefined && Array.isArray(out.chain)) {
    const i = out.chain.map((f) => f && f.type).lastIndexOf('reverb');
    if (i >= 0) out = { ...out, chain: out.chain.map((f, j) => (j === i ? { ...f, wet: out.roomMix } : f)) };
  }
  return out;
}
// the era synths at normalize: a `table` name becomes `harmonics`; the plan's
// filter mode names become a native mode + slope; an lfo `sync` fraction gets
// its rate in Hz at the recipe's bpm (a shelf patch's synced lfo is written
// into the row's patchParams so the page needs no tempo).
const MODE_OF = { ladder24: ['lowpass', 24], hp24: ['highpass', 24], bp: ['bandpass'], svf12: ['lowpass'] };
function syncHz(sync, bpm) {
  const m = /^(\d+)\/(\d+)([t.]?)$/.exec(sync);
  const beats = (4 * Number(m[1])) / Number(m[2]) * (m[3] === 't' ? 2 / 3 : m[3] === '.' ? 1.5 : 1);
  return Math.round((bpm / 60 / beats) * 1e6) / 1e6;
}
function lowerSynth(out, bpm) {
  const pp0 = out.patchParams;
  const base = { ...(PATCHES[out.patch] || {}), ...(pp0 || {}) };
  let pp = pp0;
  const set = (k, v) => { pp = { ...(pp || {}), [k]: v }; };
  if (pp0 && pp0.table !== undefined) { set('harmonics', typeof pp0.table === 'string' ? TABLES[pp0.table] : pp0.table); const { table, ...rest } = pp; pp = rest; }
  if (pp0 && pp0.filter && MODE_OF[pp0.filter.mode]) { const [mode, slope] = MODE_OF[pp0.filter.mode]; set('filter', { ...pp0.filter, mode, ...(slope ? { slope } : {}) }); }
  if (base.lfo && bpm && [].concat(base.lfo).some((l) => l && l.sync)) set('lfo', [].concat(base.lfo).map((l) => (l.sync ? { ...l, rate: syncHz(l.sync, bpm) } : l)));
  return pp === pp0 ? out : { ...out, patchParams: pp };
}
let normBpm = null;
function lowerPlayers(out) {
  out = lowerSynth(lowerKit(out), normBpm);
  if (out.players === undefined) return out;
  const base = PATCHES[out.patch] || {};
  const pp = { ...(out.patchParams || {}), players: out.players };
  if (base.vibrato && !(pp.vibrato && pp.vibrato.spread)) pp.vibrato = { ...base.vibrato, ...(pp.vibrato || {}), spread: 1 };
  if (pp.drift === undefined) pp.drift = 3;
  const { players, ...rest } = out;
  return { ...rest, patchParams: pp };
}
// seating presets: pan + desk per orchestral family, filled only where a row
// sets neither. The first violin row sits as firsts, the next as seconds.
const FAMILY = {
  violin: 'vn', violin2: 'vn', viola: 'va', viola2: 'va', cello: 'vc', cello2: 'vc', contrabass: 'cb', contrabass2: 'cb',
  flute: 'ww', flute2: 'ww', clarinet: 'ww', clarinet2: 'ww', oboe: 'ww', oboe2: 'ww', bassoon: 'ww', bassoon2: 'ww',
  frenchHorn: 'hn', frenchHorn2: 'hn', trumpet: 'br', trumpet2: 'br', trombone: 'br', trombone2: 'br', tuba: 'br', tuba2: 'br',
  timpani: 'pc', glockenspiel: 'pc', xylophone: 'pc', marimba: 'pc', vibraphone: 'pc', tubularBells: 'pc', celesta: 'kb', harp: 'hp',
  piano: 'kb', pianoGrand: 'kb',
};
const SEATING = {
  american: { vn1: [-0.55, 'front'], vn2: [-0.25, 'front'], va: [0.25, 'front'], vc: [0.5, 'front'], cb: [0.7, 'back'], ww: [0, 'back'], hn: [-0.3, 'back'], br: [0.35, 'back'], pc: [0.05, 'back'], hp: [-0.7, 'front'], kb: [-0.6, 'front'] },
  european: { vn1: [-0.6, 'front'], vn2: [0.6, 'front'], va: [0.3, 'front'], vc: [-0.2, 'front'], cb: [-0.45, 'back'], ww: [0, 'back'], hn: [-0.35, 'back'], br: [0.3, 'back'], pc: [0, 'back'], hp: [-0.75, 'front'], kb: [0.7, 'front'] },
  film: { vn1: [-0.75, 'front'], vn2: [-0.4, 'front'], va: [0.35, 'front'], vc: [0.6, 'front'], cb: [0.75, 'back'], ww: [0.1, 'back'], hn: [-0.45, 'back'], br: [0.5, 'back'], pc: [0, 'back'], hp: [-0.8, 'front'], kb: [-0.6, 'front'] },
};
function seatRows(rows, seating) {
  const seats = SEATING[seating];
  if (!seats) return rows;
  let violins = 0;
  return rows.map((r) => {
    let fam = FAMILY[r.patch];
    if (fam === 'vn') fam = violins++ ? 'vn2' : 'vn1';
    const seat = fam && seats[fam];
    if (!seat) return r;
    const out = { ...r };
    if (out.pan === undefined) out.pan = seat[0];
    if (out.desk === undefined) out.desk = seat[1];
    return out;
  });
}

export function normalizeBeatsManifest(manifest) {
  const m = JSON.parse(JSON.stringify(manifest));
  normBpm = m.bpm;
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
      return lowerPlayers(out);
    });
    if (m.seating) m.channels = seatRows(m.channels, m.seating);
  }
  if (m.kind === 'beats-composition') {
    if (m.swing === undefined) m.swing = 0;
    if (m.loop === undefined) m.loop = false;
    m.parts = m.parts.map((p) => {
      const e = expandNode(p, { allowInstrument: true });
      const out = { level: 0, ...e };
      if (out.cue !== undefined || out.gesture !== undefined) return out; // a cue part has no patch
      if (!out.patch) out.patch = 'sinePluck';
      return lowerPlayers(out);
    });
    if (m.seating) m.parts = seatRows(m.parts, m.seating);
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
      return lowerPlayers(out);
    });
  }
  return m;
}
