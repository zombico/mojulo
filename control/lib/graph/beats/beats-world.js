/**
 * beats-world — resolve a world manifest's opt-in `audio` channel into the
 * emit-ready payload (beats.plan.md → "Wiring to worlds"). The audio sibling of
 * composeVolumeFog: called from resolveWorldScene, additive, absent ⇒ untouched.
 *
 *   manifest.audio = {
 *     soundtrack?: <inline beats-ambient|beats-composition recipe> | { beatsRef }
 *                  | 'field:<mood>' | { score: { mood, seed?, game?, role? } }   (a generated field cue, field-cue.js)
 *     sfx?:        { cues?: {...} | undefined, beatsRef?, on?: { '<event type glob>': '<cueId>' } },
 *     footsteps?:  true | { step?, jump?, land? (gesture lists) },
 *     wind?:       true | { level (dB), freq (Hz) },
 *     weather?:    true | { level? (0..1), surface? }   the world's sky, sounding (manifest.weather; beats/weather-audio.js)
 *     (a sheet level also carries `foes`: { <foe id>: { attack?, hurt?, down? } } cue ids, from sfx.sheet.foes)
 *     moves?:      { swing?, hit?, block?, parry?, break?, draw?, loose?, arrow?, felled?, cycle?, foeSwing?, hurt? }
 *                  a moveset's events (gameworld/combos.js, combat-melee.js) → the ids of sfx cues: `swing` and `hit`
 *                  by weapon and weight ({ <weapon>: { light, heavy?, finisher? } }), the rest one cue each
 *     bindings?:   [{ source, entity?|point?, range: [from,to],
 *                     target: { channel, macro: tone|level|transpose, range: [a,b] } }]
 *   }
 *
 * `bindings` (B5.3) is the world-modulation seam: sim-state selectors → the
 * soundtrack's B5.2 channel macros, evaluated per frame in the audio channel,
 * read-only, one direction — depth rolls the pads' tone down, sprint raises
 * the hats' level, proximity opens the stab's filter. Sources:
 *   height    — subject's vertical position (z; subject = `entity` id, else camera)
 *   depth     — negative height (deeper = larger)
 *   speed     — the player/camera's smoothed travel speed (units/s)
 *   proximity — distance from the camera to `point: [x,y,z]` or to entity `entity`
 * The value maps through `range: [from, to]` → 0..1 (from > to inverts), then
 * onto `target.range`. Beats joins the world's atmosphere model the way the
 * lighting layer did — and stays inside "audio is presentation, not
 * simulation" because the flow never reverses.
 *
 * `beatsRef` follows the workbench wrap-texture `sketchRef` precedent: the
 * referenced beats artifact's recipe is INLINED into the payload here, so the
 * emitted page stays self-contained — the ref is authoring-time indirection
 * only. Audio is presentation, not simulation: the resolved payload is read by
 * the audio channel in emitThreeWorld and never feeds back into world state,
 * and the channel is not emitted at all on capture runs (muted bakes stay
 * byte-identical).
 */

import { SketchRepository } from '../../db/repositories/sketches.js';
import { validateBeatsManifest, normalizeBeatsManifest, isBeatsKind, checkSfxMix, checkSustain } from './beats-manifest.js';
import { emitBeatsKernel } from './beats-kernel.js';
import { expandBeatsManifest } from './beats-authoring.js';
import { audioFeatures, pagePatches } from './beats-features.js';
import { safeJson } from '../scene/emit-util.js';
import { parseFieldSpec, fieldCue, seedOfRef } from './field-cue.js';
import { SCORE_MOODS } from './field-score.js';
import { SFX_PALETTES, SFX_PALETTE_NAMES, levelSfx, MECHANIC_SFX } from './sfx-palettes.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { bedManifest, resolveBed, BEDS } from '../sfx-shelf/beds.js';
import { resolveTension } from './adaptive-music.js';
import { SURFACES } from '../weather/weather.js';

// chiptune foley defaults for the gait bindings — overridable per world.
const DEFAULT_FOOTSTEPS = {
  step: [{ type: 'burst', decay: 0.06, vol: 0.22, highpass: 1800 }],
  jump: [{ type: 'sweep', wave: 'square', from: 'A4', to: 'E5', dur: 0.12, vol: 0.3 }],
  land: [{ type: 'thump', from: 'A2', to: 'G1', decay: 0.18, vol: 0.5 }],
};

const BINDING_SOURCES = new Set(['depth', 'height', 'speed', 'proximity', 'tension']);
const BINDING_MACROS = new Set(['tone', 'level', 'transpose']);

// B5.3: validate + normalize audio.bindings against the resolved soundtrack —
// a binding targeting a channel that doesn't exist is a manifest error, caught
// at resolve time (authoring), never at play time.
function resolveBindings(bindings, soundtrack) {
  if (!Array.isArray(bindings) || !bindings.length) {
    throw new Error('audio.bindings must be a non-empty array of { source, range, target } bindings');
  }
  const rows = soundtrack.channels || soundtrack.parts || soundtrack.tracks || [];
  const names = new Set(rows.map((r) => r.name));
  const pair = (v, where) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite)) {
      throw new Error(`${where} must be [from, to] (two numbers; from > to inverts the mapping)`);
    }
  };
  return bindings.map((b, i) => {
    const where = `audio.bindings[${i}]`;
    if (!b || typeof b !== 'object' || !BINDING_SOURCES.has(b.source)) {
      throw new Error(`${where}.source must be one of: ${[...BINDING_SOURCES].join(', ')}`);
    }
    pair(b.range, `${where}.range`);
    const t = b.target;
    if (!t || typeof t !== 'object') throw new Error(`${where}.target is required: { channel, macro, range }`);
    if (!names.has(t.channel)) {
      throw new Error(`${where}.target.channel '${t.channel}' is not a soundtrack channel (${[...names].join(', ')})`);
    }
    if (!BINDING_MACROS.has(t.macro)) throw new Error(`${where}.target.macro must be one of: ${[...BINDING_MACROS].join(', ')}`);
    pair(t.range, `${where}.target.range`);
    if (b.point !== undefined && (!Array.isArray(b.point) || b.point.length !== 3 || !b.point.every(Number.isFinite))) {
      throw new Error(`${where}.point must be [x, y, z]`);
    }
    if (b.entity !== undefined && (typeof b.entity !== 'string' || !b.entity)) {
      throw new Error(`${where}.entity must be a controllable entity id (string)`);
    }
    if (b.source === 'proximity' && b.point === undefined && b.entity === undefined) {
      throw new Error(`${where} (proximity) needs a reference: point: [x,y,z] or entity: '<id>'`);
    }
    const out = { source: b.source, range: b.range.slice(), target: { channel: t.channel, macro: t.macro, range: t.range.slice() } };
    if (b.entity !== undefined) out.entity = b.entity;
    if (b.point !== undefined) out.point = b.point.slice();
    return out;
  });
}

function resolveBeatsRef(beatsRef, expectKinds) {
  const sketch = SketchRepository.getByRef(beatsRef);
  if (!sketch || !sketch.manifest) {
    throw new Error(`audio: beats artifact '${beatsRef}' not found`);
  }
  const kind = sketch.manifest.kind;
  if (!isBeatsKind(kind) || (expectKinds && !expectKinds.includes(kind))) {
    throw new Error(`audio: '${beatsRef}' is kind '${kind}', expected ${(expectKinds || []).join(' | ')}`);
  }
  return sketch.manifest;
}

// one score spec ('field:<mood>', 'club:<mood>', { score }, { beatsRef }, an inline recipe) to the expanded recipe a
// page plays, looped; and the score identity it plays in (sfx 'auto' and a combat score take its key)
function resolveTrack(spec, ctx, where) {
  let recipe = spec, identity = null, club = false;
  // a generated cue: the stored seed, else the world's own ref (unique per world, stable per render)
  const field = parseFieldSpec(recipe);
  if (field && SCORE_MOODS[field.mood]?.stinger && field.style !== 'club') {
    throw new Error(`${where} '${field.mood}' is a stinger: it plays once at an outcome (create_beats({ score: { mood: '${field.mood}' } }), then create_game music.${field.mood}), not under a level`);
  }
  if (field) {
    const f = field.game === undefined && Number.isInteger(ctx.game) ? { ...field, game: ctx.game } : field;
    identity = f.game ?? f.seed ?? (ctx.ref ? seedOfRef(ctx.ref) : 0);
    club = f.style === 'club';
    recipe = normalizeBeatsManifest(fieldCue(f, { fallbackSeed: ctx.ref ? seedOfRef(ctx.ref) : 0 }));
  } else if (typeof recipe === 'string') {
    throw new Error(`${where} '${recipe}' — use 'field:<mood>', 'club:<mood>', an inline beats recipe or { beatsRef }`);
  } else if (recipe.beatsRef) {
    recipe = resolveBeatsRef(recipe.beatsRef, ['beats-ambient', 'beats-composition', 'beats-pattern']);
    // a stored field cue (create_beats({ score })) keeps the identity it was minted in
    if (recipe.score && Number.isInteger(recipe.score.game)) identity = recipe.score.game;
  } else {
    const { ok, errors } = validateBeatsManifest(recipe);
    if (!ok) throw new Error(`${where}: invalid recipe:\n - ${errors.join('\n - ')}`);
    recipe = normalizeBeatsManifest(recipe);
  }
  // a level's music loops even when authored as a one-shot score (ambient and pattern kinds loop by construction)
  if (recipe.kind === 'beats-composition') recipe = { ...recipe, loop: true };
  return { recipe: expandBeatsManifest(recipe), identity, club };
}

/**
 * resolveWorldAudio(audioSpec, ctx) → payload.audio | null
 * ctx carries the manifest's declarative lighting mood ({ time }) so wind
 * defaults follow the scene (night reads quieter and darker), and the world's
 * `ref`, the seed of a field soundtrack that names none.
 */
export function resolveWorldAudio(audioSpec, ctx = {}) {
  if (!audioSpec || typeof audioSpec !== 'object') return null;
  const out = {};
  // the score identity a field soundtrack plays in (its game, else its cue's own seed): sfx 'auto' takes its key
  let identity = null, clubStyle = false;

  if (audioSpec.soundtrack) {
    const st = resolveTrack(audioSpec.soundtrack, ctx, 'audio.soundtrack');
    identity = st.identity; clubStyle = st.club;
    out.soundtrack = st.recipe;
  }

  // COMBAT (adaptive-music.js): a second score the level changes to when its tension rises, on the bar line, and back
  // when it has settled. It plays in the soundtrack's identity unless it names its own.
  if (audioSpec.combat !== undefined) {
    if (!out.soundtrack) throw new Error('audio.combat is the score a level changes to in a fight: add audio.soundtrack (the explore score) first');
    if (audioSpec.beat !== undefined) throw new Error('audio.beat runs on one steady soundtrack: a level with audio.combat changes its music, so it cannot keep a beat');
    out.combat = resolveTrack(audioSpec.combat, { ...ctx, game: identity }, 'audio.combat').recipe;
    out.tension = resolveTension(audioSpec.tension, Array.isArray(ctx.mechanics) ? ctx.mechanics : []);
  }

  // THE BEAT (audio.beat: { lead? }): the soundtrack's pulse said on the bus, `lead` (0.15 s) before each beat. A beat
  // is a quarter, or a dotted quarter in a compound meter (6/8, 9/8, 12/8)
  if (audioSpec.beat !== undefined) {
    const st = out.soundtrack, b = audioSpec.beat === true ? {} : audioSpec.beat;
    if (!st || !(st.bpm > 0) || st.tempo) throw new Error('audio.beat says the soundtrack\'s beat on the bus: it needs a soundtrack with a steady bpm (a composition or pattern, no tempo map)');
    if (!b || typeof b !== 'object' || (b.lead !== undefined && !(Number.isFinite(b.lead) && b.lead >= 0 && b.lead <= 0.5))) throw new Error('audio.beat is true or { lead?: seconds before each beat, 0 to 0.5 }');
    const m = /^(\d+)\/(\d+)$/.exec(String(st.meter || '4/4')), compound = !!m && m[2] === '8' && Number(m[1]) % 3 === 0;
    out.beat = { every: Math.round((60 / st.bpm) * (compound ? 1.5 : 1) * 1e6) / 1e6, lead: b.lead ?? 0.15 };
  }

  if (audioSpec.bindings) {
    if (!out.soundtrack) {
      throw new Error('audio.bindings drive soundtrack channel macros — add audio.soundtrack first');
    }
    out.bindings = resolveBindings(audioSpec.bindings, out.soundtrack);
  }
  // the meter without a combat score: a tension binding fades the soundtrack's own layers by it (vertical layering)
  if (!out.tension && out.bindings && out.bindings.some((b) => b.source === 'tension')) out.tension = resolveTension(audioSpec.tension, Array.isArray(ctx.mechanics) ? ctx.mechanics : []);
  if (audioSpec.tension !== undefined && !out.tension) throw new Error('audio.tension drives audio.combat or a tension binding: add audio.combat (the fight score) or a binding with source: \'tension\'');

  // sfx { sheet: { style?, slots?, on? } } (gameworld/sound-sheet.js): the SFX shelf's own voices by word, the newest
  // first (the sheet's style, `mouth` unless it names another: a row the mouth does not voice is realistic). Wired as
  // `auto` wires a palette: each cue id the level's mechanics play (MECHANIC_SFX) is voiced by the sheet's word for it,
  // else by the shelf's row of that id (every palette cue id is a row); the gait, weapon, melee and dodge by its slots.
  // What the spec writes wins.
  const sheet = audioSpec.sfx && typeof audioSpec.sfx === 'object' && audioSpec.sfx.sheet ? audioSpec.sfx.sheet : null;
  let sheetFoes = null;
  if (sheet) {
    const style = sheet.style ?? 'mouth';
    const cueOf = (word) => { const v = sfxSound(word, { style }); if (!v) throw new Error(`audio.sfx.sheet: '${word}' is not a sound on the SFX shelf`); return v.gestures ?? null; };
    // (`sheet.cues`: more cues, each a gesture list, for the level's book: its guns' own, played from the weapon)
    const cues = { ...(sheet.cues && typeof sheet.cues === 'object' ? sheet.cues : {}) }, on = {};
    for (const kind of Array.isArray(ctx.mechanics) ? ctx.mechanics : []) {
      for (const [glob, cue] of Object.entries(MECHANIC_SFX[kind] || {})) {
        if (glob in on) continue;
        const g = cues[cue] ?? cueOf(sheet.on?.[cue] ?? cue);
        if (g) { cues[cue] = g; on[glob] = cue; }
      }
    }
    const slot = (k, row) => cueOf(sheet.slots?.[k] ?? row) ?? undefined;
    const kept = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
    // its foes (`sheet.foes`, sound-sheet.js foeSounds): what each foe of the bestiary sounds like on its attack, on a
    // blow taken and as it falls, each word a cue of the level's (`foe-<word>`); the page's foe channel plays them
    if (sheet.foes && audioSpec.foes === undefined) {
      const idOf = (word) => { const id = `foe-${word}`; if (!(id in cues)) cues[id] = cueOf(word); return cues[id] ? id : null; };
      const F = Object.fromEntries(Object.entries(sheet.foes).map(([f, S]) => [f, kept(Object.fromEntries(Object.entries(S).map(([k, word]) => [k, idOf(word)])))]).filter(([, S]) => Object.keys(S).length));
      for (const id of Object.keys(cues)) if (!cues[id]) delete cues[id];
      if (Object.keys(F).length) sheetFoes = F;
    }
    // the whole arsenal (`sheet.moves`, sound-sheet.js): the moveset's events by shelf word, each word a cue of the
    // level's (`mv-<word>`), wired as the practice room wires them (audio.moves). It stands in the strike's place: the
    // moveset's channel sounds the pilot's swing and blow by its weapon and weight, and the foes' own
    let moves = null;
    if (sheet.moves && audioSpec.moves === undefined) {
      const idOf = (word) => { const id = `mv-${word}`; if (!(id in cues)) cues[id] = cueOf(word); return cues[id] ? id : null; };
      const byWeight = (m) => Object.fromEntries(Object.entries(m ?? {}).map(([w, W]) => [w, kept(Object.fromEntries(Object.entries(W).map(([x, word]) => [x, idOf(word)])))]).filter(([, W]) => Object.keys(W).length));
      const { swing, hit, ...one } = sheet.moves;
      moves = kept({ swing: byWeight(swing), hit: byWeight(hit), ...Object.fromEntries(Object.entries(one).map(([ev, word]) => [ev, idOf(word)])) });
      for (const id of Object.keys(cues)) if (!cues[id]) delete cues[id];
    }
    audioSpec = {
      ...audioSpec,
      sfx: { cues, ...(Object.keys(on).length ? { on } : {}), vary: sheet.vary !== false, ...(sheet.mix !== undefined ? { mix: sheet.mix } : {}) },
      footsteps: audioSpec.footsteps ?? kept({ step: slot('step', 'step'), jump: slot('jump', 'jump'), land: slot('land', 'land') }),
      weapon: audioSpec.weapon ?? kept({ shot: slot('shot', 'shoot'), hit: slot('hit', 'hit'), reload: slot('reload', 'reload') }),
      ...(moves ? { moves } : { strike: audioSpec.strike ?? kept({ swing: slot('swing', 'swing'), hit: slot('strike', 'strike') }) }),
      dodge: audioSpec.dodge ?? slot('dodge', 'dodge'),
    };
    out.sheet = style;
    // one breath across the game's hits (a performer's): each hit spends some, a rest refills it; `breath: false` off
    if (sheet.breath !== false) out.breath = { spend: 0.18, recover: 0.8, floor: 0.7, ...(typeof sheet.breath === 'object' ? sheet.breath : {}) };
  }

  // sfx 'auto' | { auto: '<palette>' | true, cues?, on?, beatsRef?, vary? } (sfx-palettes.js): a palette's cues in the
  // soundtrack's key, wired to the events this level's mechanics emit (ctx.mechanics), and the gait, weapon, melee and
  // dodge sounds from the same palette where the spec names none. What the spec writes wins: its rows first, its cues
  // over a stored pack's over the palette's. `vary` is on unless the spec says false.
  const auto = audioSpec.sfx === 'auto' ? {} : audioSpec.sfx && typeof audioSpec.sfx === 'object' && audioSpec.sfx.auto ? audioSpec.sfx : null;
  if (auto) {
    const pal = typeof auto.auto === 'string' ? auto.auto : undefined;
    if (pal !== undefined && !SFX_PALETTES[pal]) throw new Error(`audio.sfx.auto '${pal}' — the palettes: ${SFX_PALETTE_NAMES.join(', ')} (or true: the soundtrack's)`);
    // an electronic score takes the synth palette; a field score the one its band implies
    const L = levelSfx({ palette: pal ?? (clubStyle ? 'synth' : undefined), identity, mechanics: Array.isArray(ctx.mechanics) ? ctx.mechanics : [] });
    const stored = auto.beatsRef ? resolveBeatsRef(auto.beatsRef, ['beats-sfx']).cues : {};
    const own = auto.on && typeof auto.on === 'object' ? auto.on : {};
    const on = { ...own };
    for (const [g, c] of Object.entries(L.on)) if (!(g in on)) on[g] = c;
    audioSpec = {
      ...audioSpec,
      sfx: { cues: { ...L.cues, ...stored, ...(auto.cues || {}) }, ...(Object.keys(on).length ? { on } : {}), vary: auto.vary !== false, ...(auto.mix !== undefined ? { mix: auto.mix } : {}) },
      footsteps: audioSpec.footsteps ?? L.footsteps, weapon: audioSpec.weapon ?? L.weapon, strike: audioSpec.strike ?? L.strike, dodge: audioSpec.dodge ?? L.dodge,
    };
    out.palette = L.palette;
  }

  if (audioSpec.sfx) {
    const sfx = audioSpec.sfx;
    if (typeof sfx !== 'object') throw new Error(`audio.sfx is 'auto' or { cues?, on?, beatsRef?, vary?, auto?, sheet? } (got ${JSON.stringify(sfx)})`);
    let cues = sfx.cues && typeof sfx.cues === 'object' ? sfx.cues : {};
    if (sfx.beatsRef) {
      cues = { ...resolveBeatsRef(sfx.beatsRef, ['beats-sfx']).cues, ...cues };
    }
    if (Object.keys(cues).length) {
      const check = validateBeatsManifest({ kind: 'beats-sfx', title: 'world sfx', cues });
      if (!check.ok) throw new Error(`audio.sfx: invalid cues:\n - ${check.errors.join('\n - ')}`);
      out.cues = cues;
    }
    if (sfx.on && typeof sfx.on === 'object') {
      for (const [pat, cueId] of Object.entries(sfx.on)) {
        if (!out.cues || !out.cues[cueId]) {
          throw new Error(`audio.sfx.on['${pat}'] points at unknown cue '${cueId}'`);
        }
      }
      out.on = sfx.on;
    }
    // vary (opt-in): the audio channel passes a hit counter as playCue's variant.
    if (sfx.vary === true) out.vary = true;
    // mix (opt-in, the SFX mixer): the level's cues on an SFX bus in a space, ducking the score where a cue carries a
    // duck, at most `voices` at once, and placed by their distance from the pilot (`distance`, on unless false).
    if (sfx.mix !== undefined) {
      const errors = [];
      checkSfxMix(sfx.mix, 'audio.sfx.mix', errors, { world: true });
      if (errors.length) throw new Error(`audio.sfx.mix:\n - ${errors.join('\n - ')}`);
      out.mix = { ...sfx.mix, distance: sfx.mix.distance !== false };
    }
  }

  if (audioSpec.footsteps) {
    const f = audioSpec.footsteps === true ? {} : audioSpec.footsteps;
    out.footsteps = {
      step: f.step || DEFAULT_FOOTSTEPS.step,
      jump: f.jump || DEFAULT_FOOTSTEPS.jump,
      land: f.land || DEFAULT_FOOTSTEPS.land,
    };
  }

  // bed '<bed>' | { bed, level?, style? } (sfx-shelf/beds.js): the environment's bed, the shelf's one-shots as a groove,
  // played on its own engine under the score
  if (audioSpec.bed !== undefined && audioSpec.bed !== null && audioSpec.bed !== false) {
    const b = typeof audioSpec.bed === 'string' ? { bed: audioSpec.bed } : audioSpec.bed;
    if (!b || typeof b !== 'object' || !resolveBed(b.bed)) throw new Error(`audio.bed is a bed (${Object.keys(BEDS).join(', ')}) or { bed, level?, style? } (got ${JSON.stringify(audioSpec.bed)})`);
    if (b.level !== undefined && !(Number.isFinite(b.level) && b.level >= 0 && b.level <= 1)) throw new Error('audio.bed.level is in [0, 1] (the bed under the score)');
    out.bed = bedManifest(b.bed, { style: b.style ?? 'mouth' });
    out.bedLevel = b.level ?? 0.5;
  }

  if (audioSpec.wind) {
    const night = ctx.time === 'night';
    const w = audioSpec.wind === true ? {} : audioSpec.wind;
    out.wind = {
      level: w.level == null ? (night ? -34 : -30) : w.level,
      freq: w.freq == null ? (night ? 260 : 320) : w.freq,
    };
    if (w.vary === true) out.wind.vary = true; // the long noise bed (opt-in)
  }

  // WEATHER sound: the manifest's `weather` (its states, its seed) rolled to beds, drops and thunder on the page
  // (beats/weather-audio.js). `true` takes the weather's own surface; `{ level }` is a 0..1 gain on it all.
  if (audioSpec.weather) {
    const w = audioSpec.weather === true ? {} : audioSpec.weather;
    if (typeof w !== 'object' || Array.isArray(w)) throw new Error('audio.weather is true or { level?, surface? }');
    for (const k of Object.keys(w)) if (!['level', 'surface'].includes(k)) throw new Error(`audio.weather.${k} is not a weather sound setting (level, surface)`);
    if (w.level !== undefined && !(Number.isFinite(w.level) && w.level >= 0 && w.level <= 1)) throw new Error('audio.weather.level is a gain from 0 to 1');
    if (w.surface !== undefined && !Object.prototype.hasOwnProperty.call(SURFACES, w.surface)) throw new Error(`audio.weather.surface is one of: ${Object.keys(SURFACES).join(', ')}`);
    out.weather = { ...(w.level !== undefined ? { level: w.level } : {}), ...(w.surface ? { surface: w.surface } : {}) };
  }

  // thruster ROAR: a sustained rocket-engine voice the audio channel swells with a controllable
  // entity's e.thrust (boost). Continuous like wind, but gain-modulated by sim state instead of an
  // LFO. `level` (0..1) is the overall loudness; `true` takes the default.
  // `voice` (opt-in, a sustain spec: the SFX shelf's held voices) plays instead of the channel's own synth.
  const heldVoice = (v, where) => {
    const errors = [];
    checkSustain(v, where, errors);
    if (errors.length) throw new Error(`${where}:\n - ${errors.join('\n - ')}`);
    return v;
  };
  if (audioSpec.thruster) {
    const th = audioSpec.thruster === true ? {} : audioSpec.thruster;
    out.thruster = { level: Number.isFinite(th.level) ? th.level : 0.5 };
    if (th.voice !== undefined) out.thruster.voice = heldVoice(th.voice, 'audio.thruster.voice');
  }

  // JUMP audio: the stop-and-charge GATHER whine (sustained synth) + a RELEASE transient scaled by
  // hold-time + a metal-clang LAND cue scaled by fall speed. `charge`/`release` take `{ level }` (or
  // `true`); `land` is a beats gesture list (validated); `landRef` (world units/sec) is the fall
  // speed that maxes the clang. All read-only sim-state → SFX, absent on captures (byte-identical).
  if (audioSpec.jump) {
    const jp = audioSpec.jump, jOut = {};
    if (jp.charge) jOut.charge = { level: Number.isFinite((jp.charge || {}).level) ? jp.charge.level : 0.26 };
    if (jp.charge && jp.charge.voice !== undefined) jOut.charge.voice = heldVoice(jp.charge.voice, 'audio.jump.charge.voice');
    if (jp.release) jOut.release = { level: Number.isFinite((jp.release || {}).level) ? jp.release.level : 0.5 };
    if (Array.isArray(jp.land) && jp.land.length) {
      const check = validateBeatsManifest({ kind: 'beats-sfx', title: 'jump land', cues: { land: jp.land } });
      if (!check.ok) throw new Error(`audio.jump.land: invalid cue:\n - ${check.errors.join('\n - ')}`);
      jOut.land = jp.land;
      if (Number.isFinite(jp.landRef) && jp.landRef > 0) jOut.landRef = jp.landRef;
    }
    if (Object.keys(jOut).length) out.jump = jOut;
  }

  // DODGE (acrobatic roll) SFX: one beats gesture list whose `at` offsets lay out the three roll
  // beats (land / roll / stand) across the tumble. Fired once per roll on the dodgeCount edge.
  if (Array.isArray(audioSpec.dodge) && audioSpec.dodge.length) {
    const check = validateBeatsManifest({ kind: 'beats-sfx', title: 'dodge roll', cues: { dodge: audioSpec.dodge } });
    if (!check.ok) throw new Error(`audio.dodge: invalid cue:\n - ${check.errors.join('\n - ')}`);
    out.dodge = audioSpec.dodge;
  }

  // weapon SFX (mobile-suit R6-C): a controllable entity's `weapon` firing drives cues, the same
  // read-only sim-state → SFX pattern as footsteps. `shot` plays on each round; optional `hit`
  // (a landed shot) and `reload` (magazine empties). Each is a beats gesture list, passed to playCue.
  if (audioSpec.weapon) {
    const wp = audioSpec.weapon;
    const wOut = {};
    for (const k of ['shot', 'hit', 'reload']) if (Array.isArray(wp[k]) && wp[k].length) wOut[k] = wp[k];
    if (Object.keys(wOut).length) out.weapon = wOut;
  }

  // strike (melee) SFX: the beam saber's swing + connect — the same read-only sim-state → SFX
  // pattern as weapon. `swing` plays on each swing START (the crackling-ozone whoosh); `hit`
  // plays whenever the blade CONNECTS with a target. Each is a beats gesture list for playCue.
  if (audioSpec.strike) {
    const st = audioSpec.strike;
    const sOut = {};
    for (const k of ['swing', 'hit']) if (Array.isArray(st[k]) && st[k].length) sOut[k] = st[k];
    if (Object.keys(sOut).length) out.strike = sOut;
  }

  // a MOVESET's sounds (`moves`, the practice room's and an action game's: gameworld/combos.js): each of its events names
  // one of the level's sfx cues; the swing and the hit by the weapon in hand and the move's weight. A cue it names that
  // the level has not is refused, saying which
  if (audioSpec.moves !== undefined) out.moves = resolveMoves(audioSpec.moves, out.cues || {});
  // a sheet level's FOES (above): { <foe id>: { attack?, hurt?, down? } }, each a cue id of the level's
  if (sheetFoes && out.cues) out.foes = sheetFoes;

  return Object.keys(out).length ? out : null;
}

export const MOVE_SOUNDS = Object.freeze({ weighted: ['swing', 'hit'], weights: ['light', 'heavy', 'finisher'], one: ['block', 'parry', 'break', 'draw', 'loose', 'arrow', 'felled', 'cycle', 'foeSwing', 'hurt'] });
function resolveMoves(m, cues) {
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const say = (msg) => { throw new Error(`audio.moves${msg}`); };
  if (!isObj(m)) say(` is { ${[...MOVE_SOUNDS.weighted, ...MOVE_SOUNDS.one].join(', ')} }: each a cue id of audio.sfx.cues`);
  const cue = (id, at) => { if (typeof id !== 'string' || !cues[id]) say(`${at}: '${id}' is no cue of audio.sfx.cues (${Object.keys(cues).join(', ') || 'none'})`); return id; };
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (MOVE_SOUNDS.weighted.includes(k)) {
      if (!isObj(v)) say(`.${k} is { <weapon>: { ${MOVE_SOUNDS.weights.join('?, ')}? } }`);
      out[k] = Object.fromEntries(Object.entries(v).map(([w, W]) => {
        if (!isObj(W)) say(`.${k}.${w} is { ${MOVE_SOUNDS.weights.join('?, ')}? }`);
        for (const x of Object.keys(W)) if (!MOVE_SOUNDS.weights.includes(x)) say(`.${k}.${w}.${x}: a move's weight is ${MOVE_SOUNDS.weights.join(', ')}`);
        return [w, Object.fromEntries(Object.entries(W).map(([x, id]) => [x, cue(id, `.${k}.${w}.${x}`)]))];
      }));
    } else if (MOVE_SOUNDS.one.includes(k)) out[k] = cue(v, `.${k}`);
    else say(`.${k} is not a moveset's event (${[...MOVE_SOUNDS.weighted, ...MOVE_SOUNDS.one].join(', ')})`);
  }
  return out;
}

/**
 * emitSceneSoundtrackScript(resolvedAudio) → '<script>…</script>' | '' (B4).
 *
 * The CSS3D `/scene` path's soundtrack: the dependency-free preserve-3d pages
 * have no bus, no gait, and no sim loop, so only the presence layers ride —
 * soundtrack + wind. Injected by renderSceneHtml before </body> on live views
 * only (the PNG rasterizer passes capture:true and gets byte-identical HTML to
 * a soundtrack-less page). Same posture as the three.js audio channel: the
 * kernel is emitted via .toString(), the first pointer gesture unlocks the
 * AudioContext, and a HUD speaker toggles mute.
 */
export function emitSceneSoundtrackScript(resolvedAudio) {
  if (!resolvedAudio || (!resolvedAudio.soundtrack && !resolvedAudio.wind)) return '';
  const audio = {};
  if (resolvedAudio.soundtrack) audio.soundtrack = resolvedAudio.soundtrack;
  if (resolvedAudio.wind) audio.wind = resolvedAudio.wind;
  return `<script>
// ---- beats soundtrack channel (CSS3D scene, presentation-only) ----
const __AUDIO = ${safeJson(audio)};
const __BEATS_PATCHES = ${safeJson(pagePatches(audio.soundtrack))};
const __BEATS = (${emitBeatsKernel(audioFeatures(audio))})();
let __beatsCtx = null, __beatsEng = null, __beatsMuted = false;
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
  __beatsBtn.textContent = '\\u{1F50A}';
}
document.addEventListener('pointerdown', __beatsUnlock);
const __beatsBtn = document.createElement('button');
__beatsBtn.textContent = '\\u{1F507}';
__beatsBtn.title = 'sound (click scene to start)';
__beatsBtn.setAttribute('aria-label', 'toggle sound');
__beatsBtn.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:40;width:34px;height:34px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(10,12,18,.55);color:#dfe6f2;font-size:15px;cursor:pointer';
__beatsBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
__beatsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!__beatsCtx) { __beatsUnlock(); return; }
  __beatsMuted = !__beatsMuted;
  __beatsEng.setMuted(__beatsMuted);
  if (__beatsMuted) __beatsCtx.suspend(); else __beatsCtx.resume();
  __beatsBtn.textContent = __beatsMuted ? '\\u{1F507}' : '\\u{1F50A}';
});
document.body.appendChild(__beatsBtn);
</script>`;
}
