/**
 * figure-gate — the pure half of the Godot leg's FIGURE probe (driven by
 * scripts/export-godot.mjs over scripts/godot-figure-probe.gd, on a rigged
 * layered figure's world pack). The question is narrow: did the importer build
 * the figure the GLB DECLARES — one skeleton with the skin's joints, an
 * AnimationPlayer listing every clip — under the importer settings the pack
 * ships (model.glb.import: no LOD, no surface compressed), and does the pack's
 * scene play the chosen clip on a loop with the authored view current? Advisory
 * verdicts: every check is a named boolean with the two values beside it.
 */
import { glbJson } from './materials-gate.js';

/** Godot's import renaming of a node or animation name (the kernel's level.gd gd_name): `body:idle` → `body_idle`. */
export const godotName = (s) => String(s).replace(/[:.@/"%]/g, '_');

/** declaredFigure(glbBuffer) → what the file says: its skins, the first skin's joints (0 when none) and its
 * animations under the names Godot gives them. */
export function declaredFigure(buf) {
  const j = glbJson(buf);
  const skins = Array.isArray(j.skins) ? j.skins : [];
  return {
    skins: skins.length,
    joints: skins[0]?.joints?.length ?? 0,
    animations: (j.animations || []).map((a) => godotName(a.name)),
  };
}

const NUMERIC = ['skeletons', 'bones', 'players', 'compressed', 'lods', 'loop'];

/** The probe's one line (`[mojulo-figure] k=v …`) → null when absent, { error } when the probe could not load the
 * model or the scene, else { skeletons, bones, players, animations, compressed, lods, playing, loop, camera }. */
export function parseFigureLine(text) {
  const line = /\[mojulo-figure\] (.*)/.exec(String(text ?? ''));
  if (!line) return null;
  const kv = {};
  for (const tok of line[1].trim().split(/\s+/)) {
    const i = tok.indexOf('=');
    if (i > 0) kv[tok.slice(0, i)] = tok.slice(i + 1);
  }
  if (kv.error != null) return { error: kv.error };
  const out = {};
  for (const k of NUMERIC) out[k] = kv[k] != null && kv[k] !== '' && Number.isFinite(+kv[k]) ? +kv[k] : null;
  out.animations = kv.animations ? kv.animations.split(',').filter(Boolean) : [];
  out.playing = kv.playing ?? '';
  out.camera = kv.camera ?? '';
  return out;
}

/**
 * compareFigure({ declared, built, figure }) → { ok, checks }. `declared` is declaredFigure's, `built` parseFigureLine's,
 * `figure` the pack's ({ name, clip, view }). A check is null when the probe did not measure it; `ok` needs at least one
 * decided check and every decided one true.
 */
export function compareFigure({ declared, built, figure } = {}) {
  const d = declared || {}; const b = built && !built.error ? built : {}; const f = figure || {};
  const has = (k) => b[k] !== undefined && b[k] !== null;
  const want = f.name != null && f.clip != null ? godotName(`${f.name}:${f.clip}`) : null;
  const declaredClips = d.animations || [];
  const checks = {
    skeleton: { expected: d.skins ?? null, got: b.skeletons ?? null, ok: has('skeletons') && d.skins != null ? b.skeletons === d.skins : null },
    bones: { expected: d.joints ?? null, got: b.bones ?? null, ok: has('bones') && d.joints != null ? b.bones === d.joints : null },
    animation_player: { expected: '≥ 1', got: b.players ?? null, ok: has('players') ? b.players >= 1 : null },
    clips_listed: { expected: declaredClips.join(','), got: has('animations') ? b.animations.join(',') : null, ok: has('animations') ? declaredClips.every((a) => b.animations.includes(a)) : null },
    // Godot never compresses a skinned surface, so this holds without model.glb.import too: it guards the static
    // meshes once they carry normals; no_lods is the check the .import decides (six LODs of the figure without it)
    uncompressed: { expected: 0, got: b.compressed ?? null, ok: has('compressed') ? b.compressed === 0 : null },
    no_lods: { expected: 0, got: b.lods ?? null, ok: has('lods') ? b.lods === 0 : null },
    clip_playing: { expected: want, got: b.playing ?? null, ok: has('playing') && want != null ? b.playing === want : null },
    // Animation.LOOP_LINEAR — the kernel's _play_loop; mojulo clips carry the wrap key
    clip_loops: { expected: 1, got: b.loop ?? null, ok: has('loop') ? b.loop === 1 : null },
    // the authored view is the current camera (it frames the figure at rest; a clip may reach out of it)
    view_current: { expected: f.view != null ? `View${f.view}` : null, got: b.camera ?? null, ok: has('camera') && f.view != null ? b.camera === `View${f.view}` : null },
  };
  const values = Object.values(checks).map((c) => c.ok).filter((v) => v !== null);
  return { ok: values.length > 0 && values.every(Boolean), checks };
}
