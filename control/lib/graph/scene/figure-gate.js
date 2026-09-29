/**
 * figure-gate — the pure half of the Godot leg's FIGURE probe (driven by
 * scripts/export-godot.mjs over scripts/godot-figure-probe.gd, on a rigged
 * layered figure's world pack). The question is narrow: did the importer build
 * the figure the GLB DECLARES — one skeleton with the skin's joints, an
 * AnimationPlayer listing every clip — under the importer settings the pack
 * ships (model.glb.import: no LOD, no surface compressed), and does the pack's
 * scene play the chosen clip on a loop with the authored view current? A figure
 * whose mesh carries the anime face (mesh.extras.face) adds the face's checks:
 * the blend shapes by name, the authored face restored on ready (Godot ignores
 * mesh.weights), a blend-shape track per target in every body clip, each clip's
 * length its designed duration, and the ambient layer's tree active exactly when
 * the clip is one it layers over. Advisory verdicts: every check is a named
 * boolean with the two values beside it.
 */
import { glbJson } from './materials-gate.js';

/** Godot's import renaming of a node or animation name (the kernel's level.gd gd_name): `body:idle` → `body_idle`. */
export const godotName = (s) => String(s).replace(/[:.@/"%]/g, '_');

/** declaredFigure(glbBuffer) → what the file says: its skins, the first skin's joints (0 when none) and its
 * animations under the names Godot gives them; with the anime face (the first mesh carrying `extras.face`) also
 * `face`: { targets, authored, ambientClip, ambientOver } (the clip names Godot gives them). */
export function declaredFigure(buf) {
  const j = glbJson(buf);
  const skins = Array.isArray(j.skins) ? j.skins : [];
  const faced = (j.meshes || []).find((m) => m?.extras?.face && Array.isArray(m.extras.targetNames));
  return {
    skins: skins.length,
    joints: skins[0]?.joints?.length ?? 0,
    animations: (j.animations || []).map((a) => godotName(a.name)),
    ...(faced ? { face: {
      targets: faced.extras.targetNames,
      authored: faced.extras.face.words?.authored ?? null,
      ambientClip: faced.extras.face.ambientClip ? godotName(faced.extras.face.ambientClip) : null,
      ambientOver: (faced.extras.face.ambientOver || []).map(godotName),
    } } : {}),
  };
}

const NUMERIC = ['skeletons', 'bones', 'players', 'compressed', 'lods', 'loop'];
// `a:1,b:2` → { a: 1, b: 2 }
const pairs = (v) => Object.fromEntries(String(v).split(',').filter(Boolean).map((p) => { const i = p.lastIndexOf(':'); return [p.slice(0, i), +p.slice(i + 1)]; }));

/** The probe's one line (`[mojulo-figure] k=v …`) → null when absent, { error } when the probe could not load the
 * model or the scene, else { skeletons, bones, players, animations, compressed, lods, playing, loop, camera } — and,
 * when the line carries the face's fields, { shapes, face, faceTracks, lengths, tree }. */
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
  if (kv.shapes !== undefined) {
    out.shapes = kv.shapes.split(',').filter(Boolean);
    out.face = kv.face ? kv.face.split(',').filter(Boolean).map(Number) : [];
    out.faceTracks = pairs(kv.face_tracks ?? '');
    out.lengths = pairs(kv.lengths ?? '');
    out.tree = kv.tree != null && Number.isFinite(+kv.tree) ? +kv.tree : null;
  }
  return out;
}

/** The face's checks (a figure whose GLB declares the anime face): `null` when the probe did not measure it. */
function faceChecks(face, b, f, want) {
  const measured = Array.isArray(b.shapes);
  const body = Object.keys(b.faceTracks || {}).filter((a) => a !== face.ambientClip);
  const worstFace = measured && Array.isArray(face.authored) && b.face.length === face.authored.length ? Math.max(0, ...face.authored.map((w, i) => Math.abs(b.face[i] - w))) : null;
  const seconds = f.seconds || {};
  const lengthOff = measured ? Object.entries(seconds).map(([c, s]) => { const got = b.lengths?.[godotName(`${f.name}:${c}`)]; return Number.isFinite(got) ? Math.abs(got - s) : Infinity; }) : [];
  const layered = want != null ? face.ambientOver.includes(want) && face.ambientClip != null : null;
  return {
    // the face's targets by name, in the file's order
    blend_shapes: { expected: face.targets.join(','), got: measured ? b.shapes.join(',') : null, ok: measured ? b.shapes.join(',') === face.targets.join(',') : null },
    // Godot ignores mesh.weights: the scene's script restores the authored face on ready
    authored_face: { expected: '≤ 1e-5', got: worstFace, ok: measured ? worstFace !== null && worstFace <= 1e-5 : null },
    // every body clip carries its face: a blend-shape track per target
    face_tracks: { expected: `${face.targets.length} per clip`, got: measured ? body.map((a) => `${a}:${b.faceTracks[a]}`).join(',') : null, ok: measured ? body.length > 0 && body.every((a) => b.faceTracks[a] === face.targets.length) : null },
    // each clip plays its designed duration (the pack's seconds)
    durations: { expected: Object.entries(seconds).map(([c, s]) => `${c} ${s}`).join(', ') || null, got: measured ? Object.entries(seconds).map(([c]) => `${c} ${b.lengths?.[godotName(`${f.name}:${c}`)] ?? '?'}`).join(', ') : null, ok: measured && lengthOff.length ? lengthOff.every((d) => d <= 1e-3) : null },
    // the ambient blink's tree is active exactly when the clip is one it layers over
    ambient_layer: { expected: layered === null ? null : layered ? 1 : 0, got: b.tree ?? null, ok: layered !== null && b.tree != null ? b.tree === (layered ? 1 : 0) : null },
  };
}

/**
 * compareFigure({ declared, built, figure }) → { ok, checks }. `declared` is declaredFigure's, `built` parseFigureLine's,
 * `figure` the pack's ({ name, clip, view, seconds? }). A check is null when the probe did not measure it; `ok` needs at
 * least one decided check and every decided one true. The face's checks join only when the GLB declares the face.
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
    ...(d.face ? faceChecks(d.face, b, f, want) : {}),
  };
  const values = Object.values(checks).map((c) => c.ok).filter((v) => v !== null);
  return { ok: values.length > 0 && values.every(Boolean), checks };
}
