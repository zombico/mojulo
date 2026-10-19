// THE EDIT AND THE AUTHORED VIEW IN GODOT (since kernel 0.25.0): a world's shoot plan plays in the kernel (P, or
// --mojulo-edit) through the program camera the GLB carries, frame for frame where shootCameraDefs puts it, with its lens
// from score.shoot; a world with no player opens on its authored view, the walker waiting until 0 hands it the view.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';
import { extractEngineScore } from './engine-score.js';
import { shootCameraDefs } from './scene-gltf-level.js';
import { writeHarnessPack } from './godot-harness.js';
import { normalizeShoot, lowerShoot } from '../shoot/plan.js';

const GODOT = process.env.MOJULO_GODOT;
const FLOOR = { corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], fill: '#556655' };
// two cameras, a lens change on the first (50 mm → 24 mm) and a roll, then a cut to the second
const PLAN = normalizeShoot({ fps: 12, cameras: [
  { id: 'a', keys: [{ t: 0, pos: [-4, -4, 2], poi: [0, 0, 0], ease: 'easy ease', lens: 50 }, { t: 2, pos: [4, -4, 2], poi: [0, 0, 0], roll: 10, lens: 24 }] },
  { id: 'b', keys: [{ t: 0, pos: [0, 6, 3], poi: [0, 0, 0] }] },
], shots: [{ name: 'one', camera: 'a', span: [0, 2] }, { name: 'two', camera: 'b', span: [0, 1] }] }).plan;
const VIEW = { name: 'front', worldFraming: { cameraPosition: [0, -8, 3], lookAt: [0, 0, 0], horizontalFov: 60 } };
const world = (extra = {}) => ({ faces: [FLOOR], viewBox: { width: 1120, height: 780 }, ...extra });
const run = (dir, args, extra = []) => spawnSync(GODOT, ['--headless', ...extra, '--path', dir, '--', ...args], { encoding: 'utf8', timeout: 300000 });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mojulo-edit-'));
// a harness pack without the harness's sim autoload (it ends a run that brings no script): the level as a pack plays it
const pack = (dir, payload, mutate = []) => {
  writeHarnessPack(dir, payload, { godot: GODOT, mutate });
  const p = path.join(dir, 'project.godot');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\n\[autoload\]\n\nMojuloSim=.*\n/, '\n'));
};
// a z-up quaternion under the GLB's y-up root: R(-90° about x) · q
const yup = ([x, y, z, w]) => { const s = Math.SQRT1_2; return [s * x - s * w, s * y + s * z, s * z - s * y, s * w + s * x]; };

describe('the edit and the authored view in Godot', () => {
  it('score.shoot carries the program\'s lens per frame, its rate and length; no plan, no key', () => {
    const shoot = lowerShoot(PLAN), score = extractEngineScore({ ref: 'e', manifest: {} }, world({ shoot }));
    const program = shootCameraDefs(shoot, { width: 1120, height: 780 }).find((d) => d.name === 'shot:program');
    expect(score.shoot.fps).toBe(12);
    expect(score.shoot.total).toBe(3);
    expect(score.shoot.cameras).toEqual(['shot:a', 'shot:b']);
    expect(score.shoot.fov).toHaveLength(program.times.length);
    // the lens changes over the first shot (24 mm is wider than 50 mm)
    expect(score.shoot.fov[23]).toBeGreaterThan(score.shoot.fov[0]);
    expect('shoot' in extractEngineScore({ ref: 'e', manifest: {} }, world())).toBe(false);
  });

  // the edit as Godot plays it against the program camera's frames: the first frame off, or null when every one holds
  const playEdit = ({ mutate = [], bake = true } = {}) => {
    const dir = tmp();
    try {
      const shoot = lowerShoot(PLAN), payload = world({ shoot });
      pack(dir, payload, mutate);
      if (!bake) { fs.rmSync(path.join(dir, 'model.glb.import')); fs.rmSync(path.join(dir, '.godot'), { recursive: true, force: true }); spawnSync(GODOT, ['--headless', '--path', dir, '--import'], { timeout: 300000 }); }
      const r = run(dir, ['--mojulo-edit'], ['--fixed-fps', '12', '--quit-after', '60']);
      const lines = `${r.stdout}${r.stderr}`.split('\n').filter((l) => l.startsWith('[mojulo-edit] '));
      const program = shootCameraDefs(shoot, payload.viewBox).find((d) => d.name === 'shot:program');
      const score = JSON.parse(fs.readFileSync(path.join(dir, 'score.json'), 'utf8'));
      if (lines.length !== program.times.length) return `${lines.length} frames of ${program.times.length}`;
      for (let j = 0; j < lines.length; j++) {
        const [, f, p, q, fov] = lines[j].split(' '), t = program.translations[j], want = [t[0], t[2], -t[1]];
        if (+f !== j) return `frame ${j} numbered ${f}`;
        if (p.split(',').map(Number).some((v, c) => Math.abs(v - want[c]) >= 1e-3)) return `frame ${j} position`;
        const g = q.split(',').map(Number), w = yup(program.rotations[j]);
        if (Math.abs(g.reduce((s, v, c) => s + v * w[c], 0)) <= 1 - 1e-5) return `frame ${j} rotation`;
        if (Math.abs(+fov - score.shoot.fov[j]) >= 1e-3) return `frame ${j} lens`;
      }
      return null;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };

  it.skipIf(!GODOT)('the edit plays frame for frame where the program camera stands, its lens with it (MOJULO_GODOT)', () => {
    expect(playEdit()).toBe(null);
  }, 600000);

  const PLANTS = [
    { name: 'another camera\'s held track', mutate: [{ file: 'level.gd', from: 'String(np.get_name(np.get_name_count() - 1)) != String(edit_cam.name)', to: 'false' }] },
    { name: 'a blend across the cut', mutate: [{ file: 'level.gd', from: '		var at := float(j) / fps\n', to: '		var at := edit_t + 0.5 / fps\n' }] },
    { name: 'the GLB\'s lens kept', mutate: [{ file: 'level.gd', from: '		edit_cam.fov = float(fov[j])\n', to: '' }] },
    { name: 'the last frame dropped', mutate: [{ file: 'level.gd', from: '	if j >= fov.size():', to: '	if j >= fov.size() - 1:' }] },
    { name: 'Godot\'s default bake (30 fps across the twelfths)', bake: false },
  ];
  it.skipIf(!GODOT)('every planted bug in the edit is caught (MOJULO_GODOT)', () => {
    for (const p of PLANTS) expect(playEdit(p), p.name).not.toBe(null);
  }, 900000);

  it.skipIf(!GODOT)('a world with no player opens on its authored view; a player, or a walking probe, starts on the walker (MOJULO_GODOT)', () => {
    const dir = tmp();
    try {
      pack(dir, world({ cameras: [VIEW] }));
      const opens = (args) => /opens on the authored view/.test(`${run(dir, args, ['--quit-after', '3']).stdout}`);
      expect(opens([])).toBe(true);
      expect(opens(['--mojulo-autowalk', '--mojulo-frames=2'])).toBe(false);
      pack(dir, world({ cameras: [VIEW], entities: [{ id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [0, 0, 1.7], heading: 0 } }] }));
      expect(opens([])).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }, 600000);
});
