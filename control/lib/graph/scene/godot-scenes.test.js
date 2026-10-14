// SCENES AND QUESTS IN GODOT (III-d): a level's scenes play in the kernel (kernel/scenes.gd, since 0.23.0) as the
// page's runner plays them, its shots direct the camera (kernel/rules.gd shot), a skip lands the walks (kernel/cast.gd
// finish), and its quests are kept as a journal (kernel/quests.gd). The corpus holds the runner and the journal equal
// step by step (scenes-conformance.js); a whole level holds the bus, the cast, the pilot and the camera equal frame by
// frame through a scene watched, answered and skipped.
import { describe, it, expect } from 'vitest';
import { corpus, runScenes, scenarioById } from './scenes-conformance.js';
import { extractBus } from './engine-score.js';
import { playBoth } from './godot-harness.js';
import { playScript } from '../game/level-equivalence.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { buildSceneRunner } from '../playscape/ui/scene-runner.js';
import { runGodotScenes, compare } from '../../../scripts/godot-scenes-conformance.mjs';

const GODOT = process.env.MOJULO_GODOT;
const quad = { corners: [[-30, -30, 0], [30, -30, 0], [30, 30, 0], [-30, 30, 0]] };
const ENTITIES = [
  { id: 'hero', pilotable: true, rule: { type: 'walk', eye: 1.7 }, transform: { pos: [0, -6, 1.7], heading: Math.PI / 2 } },
  { id: 'mayor', rule: { type: 'static' }, transform: { pos: [6, 0, 0], heading: Math.PI }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } },
];
export function sceneLevel() {
  const play = {
    spots: [{ id: 'porch', at: [2, -4], face: -90 }],
    scenes: [
      { id: 'arrival', when: { start: true }, names: { mayor: 'Mayor Ilse' }, beats: [
        { shot: { frame: 'wide', on: ['mayor'] }, for: 0.6 },
        { do: { walk: { who: 'mayor', to: 'porch' } } },
        { until: { arrive: 'mayor' } },
        { banter: { with: ['mayor', 'hero'], lines: [{ who: 'mayor', say: 'Welcome to the hold.' }, { who: 'hero' }] } },
        { choose: { options: [{ say: 'I will help', sets: ['took-job'], beats: [{ line: { who: 'mayor', say: 'Good.' } }] }, { say: 'Not now' }] } },
      ] },
      { id: 'later', when: { on: 'scene-end:arrival' }, beats: [{ shot: { frame: 'close', on: ['mayor'], move: 'push' } }, { do: { walk: { who: 'mayor', to: [9, 3] } } }, { wait: 2 }, { line: { who: 'mayor', say: 'Off you go.' } }] },
    ],
    quests: [{ id: 'help-the-hold', starts: 'took-job', steps: [{ log: 'Hear the mayor out', done: 'took-job' }] }],
  };
  return { faces: [quad], entities: ENTITIES, camera: { rule: 'follow', target: 'hero' }, events: lowerPlay({ entities: ENTITIES, play }, { player: 'hero' }) };
}
const run = (...parts) => parts.flatMap(([n, f]) => Array.from({ length: n }, () => JSON.parse(JSON.stringify(f))));
// held input that a scene takes away: the pilot walks only once the scenes are done
const script = () => run([10, { forward: 1 }], [80, { forward: 1 }], [1, { scene: { next: true } }], [30, {}], [1, { scene: { next: true } }], [10, {}], [1, { scene: { next: true } }],
  [5, {}], [1, { scene: { move: 1 } }], [1, { scene: { pick: 0 } }], [20, {}], [1, { scene: { next: true } }], [1, { scene: { next: true } }], [20, {}], [1, { scene: { skip: true } }], [40, { forward: 1, turn: 0.3 }]);
const camLines = (text) => text.split('\n').filter((l) => l.startsWith('[mojulo-cam] ')).map((l) => l.split(' ').slice(1));

describe('scenes and quests in Godot', () => {
  it('bus.json carries the scenes\' program and the quests\' journal; the web side plays the level through', () => {
    const bus = extractBus(sceneLevel());
    expect(bus.scenes.map((s) => s.id)).toEqual(['arrival', 'later']);
    expect(bus.quests.map((q) => q.id)).toEqual(['help-the-hold']);
    const views = [];
    const r = playScript(sceneLevel(), script(), { onFrame: (sim) => views.push(sim.sceneView) });
    expect(views.some((v) => v.choice)).toBe(true);
    expect(views.at(-1).on).toBe(false);
    const last = JSON.parse(r.keys.at(-1).split('|')[0]);
    expect(last.vars['flag-took-job']).toBe(1);
    // the input was held while a scene played: the pilot stood through them, then walked
    const y = (k) => Number(k.split('|')[1].split(':')[1].split(',')[1]);
    expect(y(r.keys[5])).toBe(y(r.keys[0]));
    expect(y(r.keys.at(-1))).toBeGreaterThan(y(r.keys[0]));
    // the corpus reaches the half-typed pair the page draws (below)
    expect(runScenes(scenarioById('scenes-watched')).some((s) => s.includes('wölves'))).toBe(true);
  });

  // TWIN QUIRK: a line typed on is cut by UTF-16 units (String.prototype.slice), so for one frame the page draws half of
  // a character outside the Basic Multilingual Plane (an emoji): a lone surrogate. Godot keeps the half back.
  it.fails('the page never shows half a character as a line types on', () => {
    const R = buildSceneRunner(), S = R.create([{ id: 's', once: true, beats: [{ kind: 'line', who: 'a', name: 'A', text: '🐺🐺🐺' }] }]);
    R.hear(S, ['scene:s']);
    R.step(S, 0);
    for (let i = 0; i < 6; i++) { R.step(S, 1 / 40); expect(R.view(S).line.text).not.toMatch(/[\ud800-\udbff]$/); }
  });

  it.skipIf(!GODOT)('kernel/scenes.gd and quests.gd are equal to the web\'s, step by step (MOJULO_GODOT)', () => {
    const { out, errors } = runGodotScenes(corpus(), GODOT);
    expect(errors).toEqual([]);
    const rows = compare(out);
    expect(rows.filter((r) => !r.equal)).toEqual([]);
    expect(rows.length).toBeGreaterThan(8);
  }, 300000);

  const PLANTS = [
    { file: 'scenes.gd', name: 'a line typed faster', from: 'const RATE := 40.0', to: 'const RATE := 41.0' },
    { file: 'scenes.gd', name: 'a skip past a choice', from: '				_choose(A, b)\n				return\n		j += 1', to: '				pass\n		j += 1' },
    { file: 'scenes.gd', name: 'a line cut by code points', from: 'return buf.slice(0, m * 2).get_string_from_utf16()', to: 'return String(s).substr(0, n)' },
    { file: 'scenes.gd', name: 'a scene played again and again', from: '	S["played"][sc["id"]] = int(S["played"].get(sc["id"], 0)) + 1', to: '	pass' },
    { file: 'scenes.gd', name: 'a choice that only moves down', from: 'A["sel"] = (int(A["sel"]) + (1 if float(mv) > 0 else -1) + n) % n', to: 'A["sel"] = (int(A["sel"]) + 1) % n' },
    { file: 'quests.gd', name: 'every step shown at once', from: '			if not d:\n				break', to: '			pass' },
  ];
  it.skipIf(!GODOT)('every planted bug in the runner and the journal is caught (MOJULO_GODOT)', () => {
    const c = corpus();
    for (const p of PLANTS) {
      const { out } = runGodotScenes(c, GODOT, { mutate: [{ file: p.file, from: p.from, to: p.to }] });
      expect(compare(out).some((r) => !r.equal), p.name).toBe(true);
    }
  }, 900000);

  it.skipIf(!GODOT)('a whole level: a scene watched, answered and skipped, the camera directed, key for key (MOJULO_GODOT)', () => {
    const want = [];
    playScript(sceneLevel(), script(), { onFrame: (sim) => { const c = sim.world.camera; want.push([c.transform.pos, c.lookAt]); } });
    const { godot, compare: cmp } = playBoth(sceneLevel(), script(), { godot: GODOT });
    expect(godot.error).toBe(null);
    expect(cmp.first).toBe(null);
    expect(cmp.equal).toBe(true);
    const got = camLines(godot.text), f4 = (v) => v.map((x) => x.toFixed(4)).join(',');
    expect(got.length).toBe(want.length);
    for (let i = 0; i < want.length; i++) expect(`${got[i][1]} ${got[i][2]}`, `f${i}`).toBe(`${f4(want[i][0])} ${want[i][1] ? f4(want[i][1]) : 'null'}`);
    // a skipped scene lands its walk: without the cast's finish, the mayor stands where the skip found him
    const { compare: planted } = playBoth(sceneLevel(), script(), { godot: GODOT, mutate: [{ file: 'cast.gd', from: '		if op == "finish":', to: '		if op == "finish-not":' }] });
    expect(planted.equal).toBe(false);
  }, 600000);
});
