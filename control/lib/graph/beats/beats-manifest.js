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
 *   beats-sfx         — foley cues: named gesture lists (sweep|flutter|burst|thump).
 *
 * Validation throws teaching errors (the create_beats handler surfaces them with
 * a pointer at the kind's beats-vocab card). Normalization fills musical defaults
 * so a minimal recipe still plays — the stored manifest is always the normalized,
 * self-contained form.
 */

import { PATCHES } from './audio-patches.js';

export const BEATS_KINDS = ['beats-ambient', 'beats-composition', 'beats-pattern', 'beats-sfx'];
const KIND_SET = new Set(BEATS_KINDS);
const ROLES = new Set(['harmony', 'roots', 'melody', 'pulse']);
const GESTURES = new Set(['sweep', 'flutter', 'burst', 'thump']);
const FX = new Set(['filter', 'delay', 'pingpong', 'chorus', 'reverb', 'body', 'drive']);
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
    if ((f.type === 'delay' || f.type === 'pingpong') && f.time !== undefined) {
      const isFraction = typeof f.time === 'string' && /^\d+\s*\/\s*\d+$/.test(f.time.trim()) && Number(f.time.split('/')[1]) > 0;
      const isSeconds = typeof f.time === 'number' && isFinite(f.time) && f.time > 0;
      if (!isFraction && !isSeconds) {
        errors.push(`${where}.chain[${i}].time must be seconds or a note fraction like "3/16" (got '${f.time}')`);
      }
    }
  });
}

function checkPatch(patch, where, errors) {
  if (patch !== undefined && !PATCHES[patch]) {
    errors.push(`${where}.patch '${patch}' is unknown (patches: ${Object.keys(PATCHES).join(', ')})`);
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
    if (g.type === 'thump') { if (g.from != null) checkNote(g.from, `${where}[${i}].from`, errors); if (g.to != null) checkNote(g.to, `${where}[${i}].to`, errors); }
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
        checkPatch(ch && ch.patch, where, errors);
        checkChain(ch && ch.chain, where, errors);
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
        if (ch && ch.role === 'pulse') {
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
        checkPatch(p && p.patch, where, errors);
        checkChain(p && p.chain, where, errors);
        if (!p || !Array.isArray(p.events) || !p.events.length) {
          errors.push(`${where}.events must be a non-empty array of [time, notes, dur?, vel?]`);
        } else {
          p.events.forEach((ev, j) => {
            if (!Array.isArray(ev) || ev.length < 2) { errors.push(`${where}.events[${j}] must be [time, notes, dur?, vel?]`); return; }
            const notes = Array.isArray(ev[1]) ? ev[1] : [ev[1]];
            notes.forEach((n) => checkNote(n, `${where}.events[${j}]`, errors));
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
    if (!Array.isArray(manifest.tracks) || !manifest.tracks.length) {
      errors.push('tracks is required: [{ name, patch|gesture|cue, mask: [velocities], notes?|note?, chain?, level? }]');
    } else {
      const seen = new Set();
      manifest.tracks.forEach((tr, i) => {
        const where = `tracks[${i}]`;
        if (!tr || typeof tr.name !== 'string' || !tr.name) errors.push(`${where}.name is required (string)`);
        else if (seen.has(tr.name)) errors.push(`${where}.name '${tr.name}' is duplicated`);
        else seen.add(tr.name);
        // exactly one instrument: a patch (musical voice) OR a gesture / cue
        // (the foley vocabulary doubling as the drum kit).
        const instruments = ['patch', 'gesture', 'cue'].filter((k) => tr && tr[k] !== undefined);
        if (instruments.length !== 1) {
          errors.push(`${where} needs exactly ONE instrument: patch (synth voice) | gesture (one foley gesture) | cue (gesture list)${instruments.length ? ` — got ${instruments.join(' + ')}` : ''}`);
        } else if (tr.patch !== undefined) {
          checkPatch(tr.patch, where, errors);
        } else if (tr.gesture !== undefined) {
          checkGestures([tr.gesture], `${where}.gesture`, errors);
        } else {
          checkGestures(tr.cue, `${where}.cue`, errors);
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
        checkChain(tr && tr.chain, where, errors);
      });
    }
  }

  if (kind === 'beats-sfx') {
    const cues = manifest.cues;
    if (!cues || typeof cues !== 'object' || !Object.keys(cues).length) {
      errors.push('cues is required: { <cueId>: [gesture, ...] } with gesture.type ∈ sweep|flutter|burst|thump');
    } else {
      for (const [id, list] of Object.entries(cues)) checkGestures(list, `cues.${id}`, errors);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Fill musical defaults so a minimal valid recipe is fully self-contained when
 * stored. Never mutates the input. Defaults mirror the spike's tuned values.
 */
export function normalizeBeatsManifest(manifest) {
  const m = JSON.parse(JSON.stringify(manifest));
  if (m.kind === 'beats-ambient') {
    if (m.swing === undefined) m.swing = 0;
    m.channels = m.channels.map((ch) => {
      const out = { level: 0, ...ch };
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
    m.parts = m.parts.map((p) => ({ level: 0, patch: p.patch || 'sinePluck', ...p }));
  }
  if (m.kind === 'beats-pattern') {
    if (m.swing === undefined) m.swing = 0;
    if (m.steps === undefined) m.steps = 32;
    // store masks/contours expanded to full loop length — the stored manifest
    // IS the grid (B5.2 renders it), so make every cell explicit.
    const expand = (arr) => Array.from({ length: m.steps }, (_, i) => arr[i % arr.length]);
    m.tracks = m.tracks.map((tr) => {
      const out = { level: 0, ...tr };
      out.mask = expand(out.mask).map((v) => (v === true ? 0.9 : v === false ? 0 : v));
      if (out.notes) out.notes = expand(out.notes);
      return out;
    });
  }
  return m;
}
