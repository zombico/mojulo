import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BASELINE } from '../actor/baseline.js';
import { actScene, placeOn } from '../actor/scene.js';
import { coverScene } from '../actor/coverage.js';
import { sceneFilmFiles } from '../actor/scene-film.js';
import { buildSteps, renderChunks, renderProgress, renderErrors, frameFile } from './render-plan.js';
import { setupLights } from './setup-light.js';

// the render's plan (chunks a shot at a time, progress from the frames on disk) and a scene lit per setup
const S = actScene(BASELINE.blocked), C = coverScene(S);
const shots = C.shots.map((s) => ({ frame_count: Math.round((s.span[1] - s.span[0]) * 24) }));

describe('the render plan', () => {
  it('builds the set first where there is one, the lights where they are asked, the look last', () => {
    expect(buildSteps({ shotFiles: ['shots/a.json'] }).map((s) => s.step)).toEqual(['film.blend', 'actors', 'shots', 'look']);
    const lit = buildSteps({ shotFiles: ['shots/a.json', 'shots/b.json'], set: true, lights: true, look: 'anime' });
    expect(lit.map((s) => s.step)).toEqual(['set', 'set.py', 'actors', 'shots', 'light.py', 'look']);
    expect(lit.find((s) => s.step === 'shots').args.filter((x) => x.startsWith('shots/'))).toEqual(['shots/a.json', 'shots/b.json']);
    expect(lit.at(-1).args.at(-1)).toBe('anime');
  });

  it('starts a scene with no set from an EMPTY file: Blender\'s startup cube, camera and light never stand in the film', () => {
    const first = buildSteps({ shotFiles: ['shots/a.json'] })[0];
    expect(first.args.at(-1)).toContain('read_factory_settings(use_empty=True)');
    expect(first.args.at(-1)).toContain("save_as_mainfile(filepath='film.blend')");
  });

  it('cuts the render into chunks that cover every frame once and never cross a cut', () => {
    const counts = shots.map((s) => s.frame_count), ch = renderChunks(counts, { chunk: 24 });
    expect(ch[0].from).toBe(1);
    ch.slice(1).forEach((c, i) => expect(c.from).toBe(ch[i].to + 1));
    expect(ch.at(-1).to).toBe(counts.reduce((a, n) => a + n, 0));
    let start = 1;
    counts.forEach((n, k) => { for (const c of ch.filter((x) => x.shot === k)) { expect(c.from).toBeGreaterThanOrEqual(start); expect(c.to).toBeLessThan(start + n); expect(c.to - c.from).toBeLessThan(24); } start += n; });
  });

  it('reads its progress from the frames on disk', () => {
    const ch = renderChunks([30, 10], { chunk: 24 }), P = renderProgress(ch, new Set([...Array(24).keys()].map((i) => i + 1).concat([25])));
    expect(P.chunks.map((c) => c.state)).toEqual(['done', 'partial', 'todo']);
    expect([P.done, P.frames]).toEqual([25, 40]);
    expect(frameFile(7)).toBe('0007.png');
  });

  it('takes render settings it knows and refuses the rest by name', () => {
    expect(renderErrors({ light: 'setups', dof: 2.8, motion_blur: true, samples: 256 })).toEqual([]);
    expect(renderErrors({ light: 'moody', dof: 99, samples: 0, bloom: 1 }).join('\n')).toMatch(/not bloom[\s\S]*light[\s\S]*dof[\s\S]*samples/);
  });
});

describe('a scene lit per setup', () => {
  const L = setupLights({ S, coverage: C, shots });
  it('lights each shot from its first frame, the shots end to end', () => {
    expect(L.map((l) => l.frame)).toEqual(shots.reduce((a, s, k) => [...a, k ? a[k - 1] + shots[k - 1].frame_count : 1], []));
  });
  it('keys the short side, fills across the lens, rims from behind', () => {
    const h = (p, s) => { const x = p[0] - s[0], y = p[1] - s[1], l = Math.hypot(x, y); return [x / l, y / l]; };
    const cross = (a, b) => a[0] * b[1] - a[1] * b[0], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
    L.forEach((l, k) => {
      const s = C.shots[k], cam = C.cameras.find((c) => c.id === s.camera), K = cam.keys.filter((x) => x.t >= s.span[0] - 1e-3 && x.t <= s.span[1] + 1e-3);
      const toCam = h(K[Math.floor(K.length / 2)].pos, l.subject), key = h(l.key.pos, l.subject), fill = h(l.fill.pos, l.subject), rim = h(l.rim.pos, l.subject);
      expect(Math.sign(cross(toCam, key))).toBe(-Math.sign(cross(toCam, fill)));
      expect(dot(rim, toCam)).toBeLessThan(0);
      expect(l.fill.energy).toBeLessThan(l.key.energy);
      expect(l.key.pos[2]).toBeGreaterThan(l.subject[2]);
    });
    // the close on a speaker: the key in front of the face it turns
    const close = L.find((l) => /close/.test(l.name)), mid = C.shots[close.shot].span.reduce((a, b) => (a + b) / 2), who = /close: (\w+)/.exec(close.name)[1];
    const P = placeOn(S.actors[who].root, mid), face = [Math.sin((P.yaw * Math.PI) / 180), Math.cos((P.yaw * Math.PI) / 180)];
    expect(dot(h(close.key.pos, close.subject), face)).toBeGreaterThan(0);
  });
});

describe('a pack\'s render settings', () => {
  const actors = { mara: { take: 'scene' }, jon: { take: 'scene' } };
  const plain = sceneFilmFiles({ S, coverage: C, actors });
  const lit = sceneFilmFiles({ S, coverage: C, actors, render: { light: 'setups', dof: 2, motion_blur: true, samples: 256 } });
  const at = (files, name) => files.find((f) => f.file === name)?.text;
  it('add nothing where none is asked', () => {
    expect(JSON.stringify(sceneFilmFiles({ S, coverage: C, actors, render: null }))).toBe(JSON.stringify(plain));
    expect(at(plain, 'light.py')).toBeUndefined();
  });
  it('carry the lights, the focus and the blur, and a light.py that Python reads', () => {
    const scene = JSON.parse(at(lit, 'scene.json'));
    expect(scene.render).toEqual({ samples: 256, motion_blur: true, dof: 2 });
    expect(scene.lights).toHaveLength(C.shots.length);
    expect(JSON.parse(lit.find((f) => f.file.startsWith('shots/')).text).dof).toEqual({ fstop: 2 });
    expect(at(lit, 'SCENE.md')).toMatch(/--python light\.py/);
    const dir = mkdtempSync(path.join(tmpdir(), 'light-py-')), py = path.join(dir, 'light.py');
    writeFileSync(py, at(lit, 'light.py'));
    const r = spawnSync('python3', ['-m', 'py_compile', py], { encoding: 'utf8' });
    if (r.error?.code !== 'ENOENT') expect(r.status, r.stderr).toBe(0);
  });
});
