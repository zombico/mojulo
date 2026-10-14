/**
 * THE SCENES CONFORMANCE CORPUS — the Godot kernel's scene runner (kernel/scenes.gd) and quest journal (kernel/quests.gd)
 * against the web's (playscape/ui/scene-runner.js, quests.js questView / questNews: the code the page ships), step by
 * step. A scenario is a level's scenes lowered by the web's own sceneProgram, and a script a frame: the bus event types
 * heard, the player's presses (next, held, skip, move, pick) and the vars; both runners print one canonical snapshot a
 * frame (what fired, the camera ops, the scenes started and ended, the view: bars, the line typed so far, the choice).
 * A quest scenario is a journal over a run of flags: its view and its news, each step.
 *
 *   SCENARIOS, QUEST_SCENARIOS, randomScenarios(n, seed), corpus({ random, seed }), runScenes(sc), runQuests(sc)
 */
import { buildSceneRunner } from '../playscape/ui/scene-runner.js';
import { sceneProgram } from '../playscape/ui/scenes.js';
import { questProgram, questView, questNews } from '../playscape/ui/quests.js';
import { mulberry32 } from '../vegetation/grow.js';

export const DT = 1 / 30;
const clone = (x) => JSON.parse(JSON.stringify(x));
const R = buildSceneRunner();

const SPOTS = [{ id: 'porch', at: [2, -4], face: -90 }];
const PLAY = {
  spots: SPOTS,
  scenes: [
    { id: 'arrival', when: { start: true }, names: { mayor: 'Mayor Ilse' }, beats: [
      { shot: { frame: 'wide', on: ['mayor', 'porch'] }, for: 0.5 },
      { do: { walk: { who: 'mayor', to: 'porch' } } },
      { until: { arrive: 'mayor' } },
      { banter: { with: ['mayor', 'hero'], lines: [{ who: 'mayor', say: 'Welcome to the hold.' }, { who: 'hero' }, { who: 'mayor', say: 'Mind the gate — and the wölves 🐺🐺 by night.', expression: 'smile' }] } },
    ] },
    { id: 'offer', when: { on: 'ask' }, if: { var: 'gold', gte: 2 }, beats: [
      { line: { who: 'mayor', say: 'Will you help?' } },
      { choose: { options: [{ say: 'Yes', sets: ['took-job'], beats: [{ line: { who: 'hero', say: 'Gladly.' } }, { wait: 0.4 }] }, { say: 'No', beats: [{ line: { who: 'hero' } }] }, { sets: ['asked-twice'] }] } },
      { line: { who: 'mayor', say: 'So be it.' } },
    ] },
    { id: 'again', when: { on: 'bell' }, once: false, beats: [{ wait: 0.2 }, { line: { who: 'mayor', say: 'The bell!' } }, { choose: { who: 'mayor', say: 'Which way?', options: [{ say: 'East' }, { say: 'West', sets: ['went-west'] }] } }] },
  ],
};
const program = () => sceneProgram(PLAY);

const run = (...parts) => parts.flatMap(([n, f]) => Array.from({ length: n }, () => clone(f)));
export const SCENARIOS = [
  { id: 'scenes-watched', about: 'a scene begun, its shot held, its until heard, the lines typed on and pressed through', frames: [
    { heard: ['scene:arrival'] }, ...run([20, {}]), { heard: ['scene-heard:arrival:2'] }, ...run([10, {}]), { ctl: { next: 1 } }, ...run([30, {}]),
    { ctl: { next: 1 } }, ...run([5, {}]), { ctl: { next: 1 } }, { ctl: { next: 1 } }, ...run([45, {}]), { ctl: { next: 1 } }, ...run([30, {}])] },
  { id: 'scenes-skipped', about: 'Esc skips what is left (the beats fire, the walks land), holding the key does too', frames: [
    { heard: ['scene:arrival'] }, ...run([3, {}]), { ctl: { skip: 1 } }, ...run([10, {}]), { heard: ['scene:arrival'] }, ...run([5, {}]),
    { heard: ['scene:again'] }, ...run([3, {}]), ...run([25, { ctl: { held: 1 } }]), ...run([10, {}])] },
  { id: 'scenes-choices', about: 'a condition that fails then holds; a choice moved, picked by number, taken by the press; a skip stops at a choice', frames: [
    { heard: ['scene:offer'], vars: { gold: 1 } }, ...run([3, {}]), { heard: ['scene:offer'], vars: { gold: 2 } }, ...run([30, {}]), { ctl: { next: 1 } },
    { ctl: { move: 1 } }, { ctl: { move: 1 } }, { ctl: { move: -1 } }, { ctl: { next: 1 } }, ...run([30, {}]), { ctl: { next: 1 } }, ...run([20, {}]),
    { ctl: { next: 1 } }, { ctl: { next: 1 } }, ...run([30, {}]), { ctl: { next: 1 } }, ...run([10, {}]),
    { heard: ['scene:again'] }, { ctl: { skip: 1 } }, ...run([5, {}]), { ctl: { pick: 1 } }, ...run([10, {}]), { heard: ['scene:again'] }, ...run([20, {}]), { ctl: { pick: 7 } }, { ctl: { skip: 1 } }, ...run([5, { ctl: { held: 1 } }]), { ctl: { next: 1 } }, ...run([5, {}])] },
];

const TYPES = ['scene:arrival', 'scene:offer', 'scene:again', 'scene:nobody', 'scene-heard:arrival:2', 'scene-heard:arrival:9', 'bell', 'scene-end:arrival'];
export function randomScenarios(n = 6, seed = 3) {
  const rand = mulberry32(seed), pick = (l) => l[Math.floor(rand() * l.length)];
  return Array.from({ length: n }, (_, s) => ({
    id: `scenes-random-${s}`, about: 'seeded presses and happenings',
    frames: Array.from({ length: 160 }, () => {
      const f = {};
      if (rand() < 0.08) f.heard = [pick(TYPES), ...(rand() < 0.3 ? [pick(TYPES)] : [])];
      const r = rand();
      if (r < 0.1) f.ctl = { next: 1 };
      else if (r < 0.14) f.ctl = { skip: 1 };
      else if (r < 0.24) f.ctl = { held: 1, ...(rand() < 0.5 ? { next: 1 } : {}) };
      else if (r < 0.3) f.ctl = { move: pick([1, -1]) };
      else if (r < 0.34) f.ctl = { pick: pick([0, 1, 2, 3, 1.5, -1]) };
      if (rand() < 0.05) f.vars = { gold: pick([0, 2, 3]) };
      return f;
    }),
  }));
}

// ── the snapshot ──────────────────────────────────────────────────────────────────────────────────────────────────
function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const nano = (x) => Math.floor(x * 1e9 + 0.5) / 1e9;

export function runScenes(sc, prog = program()) {
  const S = R.create(clone(prog));
  let vars = {};
  return sc.frames.map((f) => {
    if (f.vars) vars = { ...vars, ...f.vars };
    R.hear(S, f.heard || []);
    const out = R.step(S, DT, { ...(f.ctl || {}), vars });
    const v = R.view(S);
    // a line cut inside a surrogate pair as it types on: the page draws half a character for a frame (a twin quirk,
    // named in godot-scenes.test.js); a Godot String cannot hold one, so the half is left off on both sides here
    const line = v.line ? { ...v.line, text: v.line.text.replace(/[\ud800-\udbff]$/, '') } : null;
    return canon({ out, view: { ...v, line, bars: nano(v.bars) } });
  });
}

// ── the quests ──────────────────────────────────────────────────────────────────────────────────────────────────────
const QUESTS = { quests: [
  { id: 'clear-the-cave', starts: 'took-job', steps: [{ log: 'Find the cave', done: 'found-cave' }, { done: 'cave-cleared' }, { log: 'Tell the mayor', done: 'told-mayor' }] },
  { id: 'bell', name: 'The bell tower', steps: [{ done: 'rang-bell' }] },
] };
export const QUEST_SCENARIOS = [{ id: 'quests-journal', about: 'a quest begun on its flag, its steps shown one by one as each is done, another on from the start', flags: [
  [], ['found-cave'], ['took-job'], ['rang-bell', 'found-cave'], ['nothing'], ['cave-cleared'], ['told-mayor', 'took-job'],
] }];
export function runQuests(sc, prog = questProgram(QUESTS)) {
  const vars = {};
  return sc.flags.map((set) => {
    for (const f of set) vars[`flag-${f}`] = 1;
    return canon({ view: questView(prog, vars), news: questNews(prog, set) });
  });
}

export function corpus({ random = 6, seed = 3 } = {}) {
  return {
    program: program(), quests: questProgram(QUESTS),
    scenes: [...SCENARIOS, ...randomScenarios(random, seed)].map((s) => clone({ id: s.id, frames: s.frames })),
    journal: clone(QUEST_SCENARIOS),
  };
}
export const scenarioById = (id, { random = 6, seed = 3 } = {}) => [...SCENARIOS, ...randomScenarios(random, seed)].find((s) => s.id === id);
