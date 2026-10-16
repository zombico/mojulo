/**
 * THE CONFORMANCE PROTOCOL, engine-neutral: how any engine's kernel is held EQUAL to the web runtime (the truth). A
 * corpus is a list of scenarios; the web runs each into one canonical string per frame (or step); the engine's runner
 * (engines/runners.js) runs the same scenarios through its kernel and writes `{ [id]: [string] }`; the two are
 * compared character for character. The engine never sees the web's answer, and a planted bug in its kernel copy
 * must make some scenario unequal (the corpus is only as good as what it catches).
 *
 *   CORPORA[name]                   { module, kernel: [module id], web(scenarios, opts) → { [id]: [string] } }
 *     kernel   the kernel modules the corpus needs, by module id (the same map in every engine: runners.js names the
 *              file each id is in that engine)
 *   scenariosOf(name, opts)         the corpus's scenarios, as plain JSON (what the engine's runner reads)
 *   compare(name, scenarios, out, opts) → [{ id, frames, equal, first? }]   first: { frame, at, web, engine }
 *   firstDifference(a, b)           where two strings part, with context
 *
 * The sound meter's corpus compares numbers within a tolerance and keeps its own runner (scripts/godot-sound-conformance.mjs).
 */
import * as busC from '../bus-conformance.js';
import * as combatC from '../combat-conformance.js';
import * as mindC from '../mind-conformance.js';
import * as rulesC from '../rules-conformance.js';
import * as scenesC from '../scenes-conformance.js';
import * as levelC from '../level-conformance.js';

const byId = (scenarios, run) => Object.fromEntries(scenarios.map((sc) => [sc.id, run(sc)]));

export const CORPORA = Object.freeze({
  bus: {
    module: 'lib/graph/scene/bus-conformance.js', kernel: ['bus', 'json', 'store', 'stats'],
    scenarios: (opts) => busC.corpus(opts),
    web: (scenarios) => byId(scenarios, (sc) => (sc.store ? busC.runStoreScenario(sc) : busC.runScenario(sc))),
  },
  combat: {
    module: 'lib/graph/scene/combat-conformance.js', kernel: ['bus', 'json', 'cast', 'combat', 'rules', 'nav', 'mind', 'group'],
    scenarios: (opts) => combatC.corpus(opts),
    web: (scenarios, opts) => byId(scenarios, (sc) => combatC.runCombat(combatC.scenarioById(sc.id, opts)).snaps),
  },
  mind: {
    module: 'lib/graph/scene/mind-conformance.js', kernel: ['bus', 'json', 'cast', 'combat', 'rules', 'nav', 'mind', 'group'],
    scenarios: (opts) => mindC.corpus(opts),
    web: (scenarios, opts) => byId(scenarios, (sc) => mindC.runMinds(mindC.scenarioById(sc.id, opts)).snaps),
  },
  // a whole level over the track an engine's bodies walk: the bus in the page's order and the game channel
  level: {
    module: 'lib/graph/scene/level-conformance.js', kernel: ['bus', 'json', 'stats', 'game', 'level'],
    scenarios: (opts) => levelC.corpus(opts),
    web: (scenarios) => byId(scenarios, levelC.runLevel),
  },
  rules: {
    module: 'lib/graph/scene/rules-conformance.js', kernel: ['bus', 'json', 'rules'],
    scenarios: (opts) => rulesC.corpus(opts),
    web: (scenarios, opts) => byId(scenarios, (sc) => rulesC.runRules(rulesC.scenarioById(sc.id, opts))),
  },
  // the scenes corpus is one object (its scenes, the program they share, the journal's quests), the journals beside it
  scenes: {
    module: 'lib/graph/scene/scenes-conformance.js', kernel: ['bus', 'json', 'scenes', 'quests'],
    scenarios: (opts) => scenesC.corpus(opts),
    web: (c, opts) => {
      const out = {};
      for (const sc of c.scenes) out[sc.id] = scenesC.runScenes(scenesC.scenarioById(sc.id, opts), c.program);
      for (const j of scenesC.QUEST_SCENARIOS) out[j.id] = scenesC.runQuests(j, c.quests);
      return out;
    },
  },
});

export function corpusOf(name) {
  const c = CORPORA[name];
  if (!c) throw new Error(`conformance: unknown corpus '${name}' (known: ${Object.keys(CORPORA).join(', ')})`);
  return c;
}

export const scenariosOf = (name, opts = {}) => corpusOf(name).scenarios(opts);

export function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return { at: i, web: a.slice(Math.max(0, i - 60), i + 80), engine: b.slice(Math.max(0, i - 60), i + 80) };
}

/** Every web run against the engine's output, in the web's order: the first unequal frame of each, if any. */
export function compare(name, scenarios, out, opts = {}) {
  return Object.entries(corpusOf(name).web(scenarios, opts)).map(([id, web]) => {
    const got = (out && out[id]) || [];
    let bad = null;
    for (let f = 0; f < web.length; f++) if (web[f] !== got[f]) { bad = { frame: f, ...firstDifference(web[f], got[f] || '') }; break; }
    return { id, frames: web.length, equal: !bad, ...(bad ? { first: bad } : {}) };
  });
}
