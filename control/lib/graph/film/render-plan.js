/**
 * render-plan — how a scene's Blender film pack is built and rendered, as plain data: the build's steps, the render
 * cut into CHUNKS (frame ranges inside a shot, so one shot's settings hold through a chunk and a stopped render loses
 * at most a chunk), and its progress read from the frames on disk (Blender writes `frames-<preset>/0001.png` …; a frame
 * there is a frame done). The worker (scripts/render-film.mjs) runs it; the door reads its record (render.json) and
 * never launches Blender.
 *
 *   RENDER_PRESETS          film_render.py's: draft (EEVEE, its own sampling, 100 %), final (Cycles, 128 samples, denoised,
 *                           200 %)
 *   buildSteps({ shotFiles, look, set?, lights? }) → [{ step, args }]   blender's arguments after -b, in order: the set's
 *                           pack builds film.blend (else an empty one), the cast, the cameras, the lights, the look
 *   shotFramesOf(scene)     each shot's frame count, from scene.json's coverage as the pack laid it (the shot files)
 *   renderChunks(counts, { chunk? }) → [{ shot, from, to }]   1-based frames on the film's timeline, a chunk never
 *                           crossing a cut
 *   frameFile(f)            the frame's file name as Blender writes it
 *   renderProgress(chunks, done) → { frames, done, chunks: [{ …, done, state: 'done' | 'partial' | 'todo' }] }
 *
 * Pure.
 */
export const RENDER_PRESETS = Object.freeze({ draft: { engine: 'EEVEE', samples: 0, res: 100 }, final: { engine: 'CYCLES', samples: 128, res: 200 } });
export const RENDER_CHUNK = 24;

/** An EMPTY film.blend: Blender's startup file brings a cube, a camera and a light, which would stand in the film */
export const EMPTY_BLEND = "import bpy; bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.wm.save_as_mainfile(filepath='film.blend')";

/** The build: blender's arguments (after -b) a step at a time, run in the pack's folder */
export function buildSteps({ shotFiles, look = 'film', set = false, lights = false }) {
  return [
    ...(set
      ? [{ step: 'set', args: ['--python', 'set/import_mojulo.py', '--', '--mode', 'run', '--blend', 'film.blend'] }, { step: 'set.py', args: ['film.blend', '--python', 'set.py'] }]
      : [{ step: 'film.blend', args: ['--python-expr', EMPTY_BLEND] }]),
    { step: 'actors', args: ['film.blend', '--python', 'actors.py', '--python-expr', 'import bpy; bpy.ops.wm.save_mainfile()'] },
    { step: 'shots', args: ['film.blend', '--python', 'film_shots.py', '--', '--root', 'none', ...shotFiles.flatMap((f) => ['--shot', f]), '--verify', 'film-gate.json'] },
    ...(lights ? [{ step: 'light.py', args: ['film.blend', '--python', 'light.py'] }] : []),
    { step: 'look', args: ['film.blend', '--python', 'look.py', '--python-expr', 'import bpy; bpy.ops.wm.save_mainfile()', '--', '--look', look] },
  ];
}

/** Each shot's frame count, from the shot files' cameras (one a frame) */
export const shotFramesOf = (shots) => shots.map((s) => s.frame_count ?? s.cameras?.length ?? 0);

/** The render in chunks: frame ranges within each shot, `chunk` frames at most */
export function renderChunks(counts, { chunk = RENDER_CHUNK } = {}) {
  if (!Number.isInteger(chunk) || chunk < 1) throw new Error('render: a chunk is a whole number of frames, 1 or more');
  const out = [];
  let f = 1;
  counts.forEach((n, shot) => {
    for (let a = 0; a < n; a += chunk) out.push({ shot, from: f + a, to: f + Math.min(n, a + chunk) - 1 });
    f += n;
  });
  return out;
}

/** A frame's file as Blender names it (`####` of the output path) */
export const frameFile = (f) => `${String(f).padStart(4, '0')}.png`;

/** How far a render has come, by the frames on disk (`done`: a Set of frame numbers) */
export function renderProgress(chunks, done) {
  let frames = 0, n = 0;
  const rows = chunks.map((c) => {
    let k = 0;
    for (let f = c.from; f <= c.to; f++) if (done.has(f)) k++;
    frames += c.to - c.from + 1; n += k;
    return { ...c, done: k, state: k === c.to - c.from + 1 ? 'done' : k ? 'partial' : 'todo' };
  });
  return { frames, done: n, chunks: rows };
}

/** a film's or a scene's render settings: { light?: 'setups' | 'world', dof?: <an f-stop> | false, motion_blur?, samples? } */
export const RENDER_KEYS = Object.freeze(['light', 'dof', 'motion_blur', 'samples']);
export const LIGHTINGS = Object.freeze(['setups', 'world']);

/** Error lines for render settings (empty = valid) */
export function renderErrors(R, at = 'render') {
  if (R === undefined || R === null) return [];
  if (typeof R !== 'object' || Array.isArray(R)) return [`${at}: { light?: setups | world, dof?: an f-stop, motion_blur?: true, samples?: a count }`];
  const errs = [], extra = Object.keys(R).filter((k) => !RENDER_KEYS.includes(k));
  if (extra.length) errs.push(`${at} takes ${RENDER_KEYS.join(', ')} (not ${extra.join(', ')})`);
  if (R.light !== undefined && !LIGHTINGS.includes(R.light)) errs.push(`${at}.light: setups (each shot its key, fill and rim, from the cast rig) | world (the set's own light alone)`);
  if (R.dof !== undefined && R.dof !== false && !(Number.isFinite(R.dof) && R.dof >= 0.5 && R.dof <= 32)) errs.push(`${at}.dof: an f-stop, 0.5 to 32 (1.4 shallow, 8 deep), or false`);
  if (R.motion_blur !== undefined && typeof R.motion_blur !== 'boolean') errs.push(`${at}.motion_blur: true or false`);
  if (R.samples !== undefined && !(Number.isInteger(R.samples) && R.samples >= 1 && R.samples <= 4096)) errs.push(`${at}.samples: Cycles' samples for the final render, 1 to 4096`);
  return errs;
}
