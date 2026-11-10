/**
 * Reads every facet's SOURCE tables live: the values the tree defines today, in the table's own order. The registry
 * (registry.js) reads them through this on its first call, so there is no copy of them to keep. A facet names a table's
 * module by its path under control/ (its `lowers`); the module is imported here, in MODULES, and a facet naming one
 * that is not throws, saying so.
 *
 *   readSources() → { 'facet.setting': { lowers, values: [...] } }
 */
import { FACETS } from './facets/index.js';
import * as mechanics from '../game/mechanics.js';
import * as kits from '../game/kits.js';
import * as controllable from '../worlds/controllable/compose.js';
import * as beams from '../playscape/elements/beams.js';
import * as explosions from '../playscape/elements/explosions.js';
import * as boardBattle from '../board/board-battle.js';
import * as actions from '../gameworld/actions.js';
import * as stats from '../playscape/stats/stats.js';
import * as sixthGen from '../era/sixth-gen.js';
import * as stage from '../era/stage.js';
import * as weather from '../weather/weather.js';
import * as figureCast from '../polygonizer/figure-cast.js';
import * as heroVibe from '../gameworld/hero-vibe.js';
import * as heroMotion from '../polygonizer/hero-motion.js';
import * as equipment from '../equipment/expand.js';
import * as species from '../fauna/species.js';
import * as floormap from '../era/floormap.js';
import * as objects from '../playscape/objects/index.js';
import * as scenes from '../playscape/ui/scenes.js';
import * as juiceStyle from '../scene/juice-style.js';
import * as gameBodies from '../gameworld/game-bodies.js';

// the modules a facet's source may name, by their path under control/ (read when the registry is first asked for)
const MODULES = {
  'lib/graph/game/mechanics.js': mechanics,
  'lib/graph/game/kits.js': kits,
  'lib/graph/worlds/controllable/compose.js': controllable,
  'lib/graph/playscape/elements/beams.js': beams,
  'lib/graph/playscape/elements/explosions.js': explosions,
  'lib/graph/board/board-battle.js': boardBattle,
  'lib/graph/gameworld/actions.js': actions,
  'lib/graph/playscape/stats/stats.js': stats,
  'lib/graph/era/sixth-gen.js': sixthGen,
  'lib/graph/era/stage.js': stage,
  'lib/graph/weather/weather.js': weather,
  'lib/graph/polygonizer/figure-cast.js': figureCast,
  'lib/graph/gameworld/hero-vibe.js': heroVibe,
  'lib/graph/polygonizer/hero-motion.js': heroMotion,
  'lib/graph/equipment/expand.js': equipment,
  'lib/graph/fauna/species.js': species,
  'lib/graph/era/floormap.js': floormap,
  'lib/graph/playscape/objects/index.js': objects,
  'lib/graph/playscape/ui/scenes.js': scenes,
  'lib/graph/scene/juice-style.js': juiceStyle,
  'lib/graph/gameworld/game-bodies.js': gameBodies,
};

// a table's values: an object's keys, an array's items, a string as itself
const valuesOf = (t) => (Array.isArray(t) ? t.map(String) : t && typeof t === 'object' ? Object.keys(t) : typeof t === 'string' ? [t] : null);

// tables that are assembled, not written: read by composing what assembles them
const SPACE_CAMERA_RULES = ['eye', 'overhead', 'side'];
// and the directing camera (playscape/ui/scenes.js): time.shots and time.framing, not a power
const TIME_CAMERA_RULES = ['shot'];
// the values of tables that are assembled, not written
const READERS = {
  // the camera rules that lower space.camera (eye, overhead, side) are Space's, not Power's verbs. `follow` predates the
  // split and stays a Power rule.
  engineRules: (m) => Object.keys(m.composeControllable(m.EMISSION_ENGINE).RULES).filter((k) => !SPACE_CAMERA_RULES.includes(k) && !TIME_CAMERA_RULES.includes(k)),
  aiDifficulty: (m) => Object.keys(m.composeLive().AI_DIFFICULTY || {}),
};

function load(module) {
  const m = MODULES[module];
  if (!m) throw new Error(`cosmos source ${module} is not imported by cosmos/read-sources.js: add it to MODULES there`);
  return m;
}

function read({ module, table, read: reader }) {
  const m = load(module);
  const values = reader ? READERS[reader]?.(m) : valuesOf(m[table]);
  if (!values) throw new Error(`cosmos source ${module}#${reader || table} gave no values`);
  return values;
}

export function readSources() {
  const out = {};
  for (const facet of FACETS) {
    for (const [setting, spec] of Object.entries(facet.settings)) {
      if (!spec.source) continue;
      const src = spec.source, lowers = `${src.module}#${src.read || src.table}`;
      const values = read(src);
      out[`${facet.id}.${setting}`] = { lowers, values };
    }
  }
  return out;
}
