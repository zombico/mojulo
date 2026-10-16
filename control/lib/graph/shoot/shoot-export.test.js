import { describe, it, expect } from 'vitest';
import { facesToGlb } from '../scene/scene-gltf.js';
import { shootCameraDefs } from '../scene/scene-gltf-level.js';
import { normalizeShoot, lowerShoot } from './plan.js';

// Parse a GLB Buffer back into its JSON chunk and binary (as the export-kinds test does)
function parseGlb(buf) {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binAt = 20 + jsonLen;
  return { json, bin: buf.slice(binAt + 8, binAt + 8 + buf.readUInt32LE(binAt)) };
}
const read = ({ json, bin }, a) => {
  const acc = json.accessors[a], view = json.bufferViews[acc.bufferView], n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type];
  return new Float32Array(bin.buffer.slice(bin.byteOffset + (view.byteOffset || 0) + (acc.byteOffset || 0), bin.byteOffset + (view.byteOffset || 0) + (acc.byteOffset || 0) + acc.count * n * 4));
};

const FLOOR = { corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], fill: '#556655' };
const PLAN = normalizeShoot({ fps: 12, cameras: [
  { id: 'a', keys: [{ t: 0, pos: [-4, -4, 2], poi: [0, 0, 0], ease: 'easy ease' }, { t: 2, pos: [4, -4, 2], poi: [0, 0, 0], roll: 10 }] },
  { id: 'b', keys: [{ t: 0, pos: [0, 6, 3], poi: [0, 0, 0] }] },
], shots: [{ name: 'one', camera: 'a', span: [0, 2] }, { name: 'two', camera: 'b', span: [0, 1] }] }).plan;
const SHOOT = lowerShoot(PLAN);

describe('a shoot plan in a GLB', () => {
  it('one animated camera per plan camera, and one playing the edit', () => {
    const r = facesToGlb({ faces: [FLOOR], shoot: SHOOT }, { generator: 'test' });
    expect(r.shotCameras).toEqual(['shot:a', 'shot:b', 'shot:program']);
    const glb = parseGlb(r.glb || r.bytes || r.buffer || r);
    const anims = glb.json.animations.map((a) => a.name);
    expect(anims).toEqual(['shot:a', 'shot:b', 'shot:program']);
    const prog = glb.json.animations[2];
    expect(prog.samplers.every((s) => s.interpolation === 'STEP')).toBe(true);   // cuts are cuts
    const times = read(glb, prog.samplers[0].input);
    expect(times.length).toBe(3 * 12 + 1);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    const q = read(glb, glb.json.animations[0].samplers[1].output);
    for (let i = 0; i < q.length; i += 4) expect(Math.hypot(q[i], q[i + 1], q[i + 2], q[i + 3])).toBeCloseTo(1, 4);
  });

  it('the program cuts: its frame after the cut is camera b', () => {
    const prog = shootCameraDefs(SHOOT, null).find((d) => d.name === 'shot:program');
    expect(prog.translations[0]).toEqual([-4, -4, 2]);
    expect(prog.translations[2 * 12 + 1]).toEqual([0, 6, 3]);
  });

  it('a payload without a plan exports the same bytes as before', () => {
    const a = facesToGlb({ faces: [FLOOR] }, { generator: 'test' });
    expect(a.shotCameras).toBeUndefined();
    expect(shootCameraDefs(undefined)).toEqual([]);
  });
});

describe('a shoot plan as a Blender film', async () => {
  const { planFilmShots } = await import('../../motion/world-motion.js');
  const { filmShot, emitBlenderFilm } = await import('../../motion/blender-film.js');
  const WORLD = { kind: 'css3d-turntable', shape: 'dodecahedron', color: '#7a5fad', surface: 'vexar' };
  const RAW = { fps: 12, cameras: [
    { id: 'a', keys: [{ t: 0, pos: [-4, -4, 2], poi: [0, 0, 0] }, { t: 2, pos: [4, -4, 2], poi: [0, 0, 0] }] },
    { id: 'b', keys: [{ t: 0, pos: [0, 6, 3], poi: [0, 0, 0] }] },
  ], shots: [{ name: 'one', camera: 'a', span: [0, 2] }, { name: 'two', camera: 'b', span: [0, 1] }, { name: 'cued', camera: 'b', span: [0, 1], on: 'goal:*' }] };

  it('one run of cameras per shot of the running order, sampled as the render samples them', async () => {
    const film = await planFilmShots({ sketch: { ref: 'w', manifest: { ...WORLD, shoot: RAW } } });
    expect(film.shots.map((s) => [s.name, s.cameras.length])).toEqual([['one', 24], ['two', 13]]);   // the cued shot waits for its event
    expect(film.shots[1].cameras[0].cameraPosition).toEqual([0, 6, 3]);
  });

  it('the pack carries a shot file per plan shot and the command lays them out as cuts', async () => {
    const film = await planFilmShots({ sketch: { ref: 'w', manifest: { ...WORLD, shoot: RAW } } });
    const shots = film.shots.map((s, k) => filmShot({ motionRef: `mo_x-0${k + 1}`, worldRef: 'w', title: s.name, motion: 'plan', fps: film.fps, width: film.width, height: film.height, cameras: s.cameras }));
    const { files } = emitBlenderFilm({ shot: shots[0], shots, title: 'plan' });
    expect(files.map((f) => f.file)).toEqual(expect.arrayContaining(['shot.json', 'shots/mo_x-01.json', 'shots/mo_x-02.json']));
    expect(files.find((f) => f.file === 'FILM.md').text).toContain('--shot shots/mo_x-01.json --shot shots/mo_x-02.json');
  });
});
