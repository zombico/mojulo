#!/usr/bin/env node
// fake-blender — a stand-in for `blender -b` in the render worker's tests (scripts/render-film.test.js): it does what
// each mojulo script's call leaves on disk, not what Blender draws. film.blend is a file; film_render.py writes a PNG
// a frame (the range --frames asks, the rest kept) and, without --no-encode, the film's MP4 once every frame is there;
// cut.py writes the cut once every scene's film is there. Every call is logged (FAKE_BLENDER_LOG) as a JSON line.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const a = process.argv.slice(2), cwd = process.cwd();
const after = a.includes('--') ? a.slice(a.indexOf('--') + 1) : [];
const opt = (k) => { const i = after.indexOf(k); return i >= 0 ? after[i + 1] : null; };
const py = a.includes('--python') ? a[a.indexOf('--python') + 1] : null;
if (process.env.FAKE_BLENDER_LOG) appendFileSync(process.env.FAKE_BLENDER_LOG, `${JSON.stringify({ cwd, py, after })}\n`);
if (process.env.FAKE_BLENDER_FAIL && py === process.env.FAKE_BLENDER_FAIL) { console.error('fake: asked to fail'); process.exit(1); }
const expr = a.includes('--python-expr') ? a[a.indexOf('--python-expr') + 1] : '';
if (expr.includes('save_as_mainfile') || (py && py.endsWith('import_mojulo.py'))) writeFileSync(path.join(cwd, 'film.blend'), 'blend');
if (py === 'film_render.py') {
  if (!existsSync(path.join(cwd, 'film.blend'))) { console.error('fake: no film.blend'); process.exit(1); }
  const S = JSON.parse(readFileSync(path.join(cwd, 'scene.json'), 'utf8')), preset = opt('--preset') ?? 'draft', locale = opt('--locale');
  const dir = path.join(cwd, 'film', `frames-${preset}`);
  mkdirSync(dir, { recursive: true });
  const [lo, hi] = opt('--frames') ? opt('--frames').split('-').map(Number) : [1, S.frames];
  for (let f = Math.max(1, lo); f <= Math.min(S.frames, hi); f++) { const p = path.join(dir, `${String(f).padStart(4, '0')}.png`); if (!existsSync(p)) writeFileSync(p, 'png'); }
  if (!after.includes('--no-encode')) writeFileSync(path.join(cwd, 'film', `film-${preset}${locale ? `-${locale}` : ''}.mp4`), 'mp4');
}
if (py === 'cut.py') {
  const F = JSON.parse(readFileSync(path.join(cwd, 'film.json'), 'utf8')), preset = opt('--preset') ?? 'draft';
  if (!F.order.every((id) => existsSync(path.join(cwd, 'scenes', id, 'blender', 'film', `film-${preset}.mp4`)))) { console.error('fake: a scene not rendered'); process.exit(1); }
  writeFileSync(path.join(cwd, `cut-${preset}.mp4`), 'mp4');
}
console.log('fake blender ok');
