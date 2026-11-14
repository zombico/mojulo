// a scene as a Blender film pack: the files, the scene, the coverage cut into film shots keyed every frame; and an
// actor's GLB carrying its act with its place over time
import { describe, it, expect } from 'vitest';
import { actScene } from './scene.js';
import { coverScene } from './coverage.js';
import { BASELINE } from './baseline.js';
import { sceneFilmFiles, coverageCameraAt, actorsPy, lookPy, LOOKS } from './scene-film.js';
import { sceneActOf } from './act.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from '../scene/scene-gltf.js';

const S = actScene(BASELINE.blocked), C = coverScene(S), FPS = 24;
const files = sceneFilmFiles({ S, coverage: C, actors: { mara: { take: 'scene' }, jon: { take: 'scene' } }, fps: FPS, title: 'blocked' });
const byName = Object.fromEntries(files.map((f) => [f.file, f.text]));

describe('the scene film pack', () => {
  it('writes the scene, the film layer, the cast and the look', () => {
    for (const f of ['scene.json', 'shot.json', 'film_shots.py', 'film_light.py', 'film_render.py', 'actors.py', 'look.py', 'SCENE.md']) expect(byName[f], f).toBeTruthy();
    expect(files.filter((f) => f.file.startsWith('shots/'))).toHaveLength(C.shots.length);
  });

  it('actors.py leaves a hero\'s page out of the film (its view cameras, its ground) and stands a scene with no set on a bare stage', () => {
    const py = byName['actors.py'];
    // (the page's cameras and the meshes no armature carries go; a thing held on a bone stays)
    expect(py).toContain("o.type == 'CAMERA' or (o.type == 'MESH' and not carried(o))");
    expect(py).toContain('bpy.data.objects.remove(o, do_unlink=True)');
    // (the stage: made once, only where there is no set; its key only where the setups are not lit)
    expect(py).toContain("if S.get('set') or bpy.data.objects.get('stage:floor') is not None:");
    expect(py).toContain("if not S.get('lights'):");
    expect(byName['SCENE.md']).toContain('read_factory_settings(use_empty=True)');
    // (a dub's face takes outlive the save: Blender keeps no action that nothing uses)
    expect(py).toContain('a.use_fake_user = True');
    // (a walled set with no light of its own: its house lights, made by actors.py from scene.json set.house)
    expect(py).toContain("'house:%d' % (i + 1)");
  });

  it('scene.json: each actor\'s GLB, its takes and its place over time; the coverage; the lines', () => {
    const J = JSON.parse(byName['scene.json']);
    expect(J.frames).toBe(Math.round(S.seconds * FPS));
    expect(J.actors.mara).toMatchObject({ glb: 'actors/mara.glb', act: 'act:scene', face: 'face:scene' });
    expect(J.actors.mara.root).toHaveLength(S.actors.mara.root.length);
    expect(J.coverage.shots).toHaveLength(C.shots.length);
    expect(J.turns.map((T) => T.who)).toEqual(S.turns.map((T) => T.who));
  });

  it('cuts the coverage into film shots keyed every frame, end to end', () => {
    const shots = files.filter((f) => f.file.startsWith('shots/')).map((f) => JSON.parse(f.text));
    expect(shots.reduce((n, s) => n + s.frame_count, 0)).toBe(Math.round(S.seconds * FPS));
    for (const s of shots) for (const c of s.cameras) { expect(c.pos).toHaveLength(3); expect(c.hfov_deg).toBeGreaterThan(5); }
    // (a shot's first frame is its camera's first key)
    const first = coverageCameraAt(C, C.shots[1].span[0]).framing, cam = C.cameras.find((c) => c.id === C.shots[1].camera);
    expect(first.cameraPosition).toEqual(cam.keys.find((k) => k.t === C.shots[1].span[0]).pos);
  });

  it('the scripts bind the takes on the cast and build either look', () => {
    expect(actorsPy()).toMatch(/import_scene\.gltf/);
    expect(actorsPy()).toMatch(/'pose\.bones'/);
    expect(actorsPy()).toMatch(/'key_blocks'/);
    for (const look of LOOKS) expect(lookPy()).toContain(`'${look}'`);
    expect(lookPy()).toMatch(/ShaderNodeShaderToRGB/);
    expect(lookPy()).toMatch(/SOLIDIFY/);
  });

  it('carries a scene\'s props: each its model, its place, its turn and its size; none adds nothing', () => {
    const props = [{ name: 'car', ref: 'sk_car', glb: 'props/car.glb', at: [4.5, 3], turn: 90, dims: [4.5, 2.2, 1.9] }];
    const withProps = Object.fromEntries(sceneFilmFiles({ S, coverage: C, actors: { mara: { take: 'scene' }, jon: { take: 'scene' } }, fps: FPS, title: 'blocked', props }).map((f) => [f.file, f.text]));
    expect(JSON.parse(withProps['scene.json']).props).toEqual(props);
    expect(JSON.parse(files.find((f) => f.file === 'scene.json').text).props).toBeUndefined();
    // (the build stands each under its own empty, at the plan's size)
    expect(actorsPy()).toMatch(/def props\(S\)/);
    expect(actorsPy()).toMatch(/'prop:%s' % Q\['name'\]/);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(sceneFilmFiles({ S, coverage: C, actors: { mara: { take: 'scene' }, jon: { take: 'scene' } }, fps: FPS, title: 'blocked' }))).toBe(JSON.stringify(files));
  });
});

describe('a scene actor\'s GLB', () => {
  it('carries its act with its place over time and its walks (moj:act)', async () => {
    const h = heroRecord({ cast: 'female' }), base = { ...expandLayeredManifest({ kind: 'layered', title: 'mara', hero: h }), hero: h }, T = sceneActOf(S.actors.mara);
    const { payload } = await resolveWorldScene({ ref: 'scene-mara', title: 'mara', manifest: { ...base, hero: { ...base.hero, perform: T.perform, acts: T.acts } } }, { face: true, unshaded: true });
    const glb = Buffer.from(facesToGlb(payload, { generator: 'scene film test', clips: '_all', skinned: true, lit: true }).bytes), jl = glb.readUInt32LE(12), J = JSON.parse(glb.subarray(20, 20 + jl).toString('utf8'));
    const act = J.animations.find((a) => a.name === 'act:scene'), x = act.extras['moj:act'];
    expect(x.root).toEqual(S.actors.mara.root);
    expect(x.walks).toEqual(S.actors.mara.walks.map((w) => ({ start: w.start, end: w.end })));
    expect(J.accessors[act.samplers[0].input].max[0]).toBeCloseTo(S.seconds, 3);
  });
});
