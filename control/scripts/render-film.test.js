import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// the render worker (render-film.mjs) against a stand-in Blender (fixtures/fake-blender.mjs: what each call leaves on
// disk): a film of two scenes built once, rendered in chunks within a budget, resumed where it stopped, encoded, cut;
// a run with nothing left to do calls Blender not at all
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = mkdtempSync(path.join(tmpdir(), 'render-film-'));
const LOG = path.join(DIR, 'calls.log');
const FAKE = path.join(DIR, 'blender');
writeFileSync(FAKE, `#!/bin/sh\nexec node "${path.join(HERE, 'fixtures', 'fake-blender.mjs')}" "$@"\n`);
chmodSync(FAKE, 0o755);

/** a scene's pack, as small as the worker reads it: scene.json, shot files of so many frames */
function pack(dir, counts) {
  mkdirSync(path.join(dir, 'shots'), { recursive: true });
  counts.forEach((n, k) => writeFileSync(path.join(dir, 'shots', `s-${String(k + 1).padStart(2, '0')}.json`), JSON.stringify({ source: 'mojulo', frame_count: n })));
  writeFileSync(path.join(dir, 'scene.json'), JSON.stringify({ source: 'mojulo', frames: counts.reduce((a, n) => a + n, 0) }));
}
const calls = () => (existsSync(LOG) ? readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const render = (dir, ...args) => {
  const r = spawnSync(process.execPath, [path.join(HERE, 'render-film.mjs'), dir, ...args], { encoding: 'utf8', env: { ...process.env, MOJULO_BLENDER: FAKE, FAKE_BLENDER_LOG: LOG }, cwd: path.join(HERE, '..') });
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout);
};

describe('the render worker', () => {
  const film = path.join(DIR, 'film');
  pack(path.join(film, 'scenes', 'one', 'blender'), [30, 20]);
  pack(path.join(film, 'scenes', 'two', 'blender'), [25]);
  writeFileSync(path.join(film, 'film.json'), JSON.stringify({ source: 'mojulo', fps: 24, look: 'anime', order: ['one', 'two'] }));

  it('plans without Blender: the build, the frames, the chunks', () => {
    const r = render(film, '--plan', '--chunk', '10');
    expect(r.scenes.one).toMatchObject({ frames: 50, done: 0, chunks: 5 });
    expect(r.scenes.one.build).toEqual(['film.blend', 'actors', 'shots', 'look']);
    expect(calls()).toEqual([]);
  });

  it('stops starting chunks at its budget and goes on where it stopped, then encodes each scene and cuts the film', () => {
    const first = render(film, '--chunk', '10', '--budget-min', '0');
    expect(first.scenes.one.state).toBe('paused');
    expect(first.cut.file).toBeNull();
    const built = calls().filter((c) => c.py === 'look.py');
    expect(built[0].after).toEqual(['--look', 'anime']);
    const second = render(film, '--chunk', '10');
    expect(second.scenes.one).toMatchObject({ frames: 50, done: 50, encoded: 'film/film-draft.mp4' });
    expect(second.scenes.two).toMatchObject({ frames: 25, done: 25, encoded: 'film/film-draft.mp4' });
    expect(second.cut.file).toBe('cut-draft.mp4');
    const chunkCalls = calls().filter((c) => c.after.includes('--no-encode'));
    expect(chunkCalls.map((c) => c.after[c.after.indexOf('--frames') + 1])).toEqual(['1-10', '11-20', '21-30', '31-40', '41-50', '1-10', '11-20', '21-25']);
    expect(readdirSync(path.join(film, 'scenes', 'one', 'blender', 'film', 'frames-draft'))).toHaveLength(50);
    const rec = JSON.parse(readFileSync(path.join(film, 'scenes', 'one', 'blender', 'render.json'), 'utf8'));
    expect(rec.calls.map((c) => c.step)).toEqual(['film.blend', 'actors', 'shots', 'look', 'chunk', 'chunk', 'chunk', 'chunk', 'chunk', 'encode']);
  });

  it('calls Blender not at all when nothing is left to do', () => {
    const before = calls().length;
    render(film, '--chunk', '10');
    expect(calls().length).toBe(before);
  });

  it('builds and renders a pack made again since its render (the scene edited), and cuts the film again; the other scene is kept', () => {
    const one = path.join(film, 'scenes', 'one', 'blender');
    const was = JSON.parse(readFileSync(path.join(one, 'render.json'), 'utf8')).pack;
    pack(one, [12]);
    writeFileSync(path.join(one, 'shots', 's-02.json'), JSON.stringify({ source: 'mojulo', frame_count: 0 }));
    const plan = render(film, '--plan', '--chunk', '10');
    expect(plan.scenes.one).toMatchObject({ frames: 12, done: 0 });
    expect(plan.scenes.one.stale).toBeTruthy();
    expect(plan.scenes.two).toMatchObject({ build: 'built', done: 25 });
    const before = calls().length;
    const r = render(film, '--chunk', '10');
    expect(r.scenes.one).toMatchObject({ frames: 12, done: 12, encoded: 'film/film-draft.mp4' });
    expect(readdirSync(path.join(one, 'film', 'frames-draft'))).toHaveLength(12);
    const rec = JSON.parse(readFileSync(path.join(one, 'render.json'), 'utf8'));
    expect(rec.pack).not.toBe(was);
    expect(rec.calls.some((c) => c.step === 'made again')).toBe(true);
    const mine = calls().slice(before);
    expect(mine.filter((c) => c.cwd.endsWith(path.join('two', 'blender')))).toEqual([]);
    expect(mine.at(-1).py).toBe('cut.py');
    expect(r.cut.file).toBe('cut-draft.mp4');
  });
});
