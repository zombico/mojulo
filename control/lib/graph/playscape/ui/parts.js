/**
 * PARTS — the UI encyclopedia: what a part IS, apart from where it sits (regions.js), what it looks like (the guide's
 * tokens and the register's dials) and which appearance state it is in. One shape for every rung:
 *
 *   { part, id?, variant?, bind?: { var, of? } | { on, of? }, at?: '<region>' | { region } | 'over', audience?, mark?,
 *     label?, max?, text?, ttl?, color?, when?: ['<phase>', …], …the part's own fields (rows, rate, into, columns) }
 *
 * WHOSE value a part shows is `bind.of`: 'self' (mine, the default), 'team', 'all' (the match's shared state), 'target'
 * (what I have locked or aim at), or 'each:<tag>' (one copy per entity with that tag: a nameplate over every player, a scoreboard row per player).
 * WHO may see it is `audience`: 'self', 'team', 'all' or 'spectator' (default: as wide as its owner). An `each` part
 * that allies and enemies both see declares `mark: { ally, enemy }`, shapes that tell mine from theirs in values.
 *
 * The parts today's HUD draws lower exactly: `readPart(p).row` is an `events.hud` row the HUD page reads through
 * normalizeHud. A part that reads a SYSTEM (`bind: { from }`, systems.js: the shooter's reticle, ammo, lock) binds what
 * the piloted runtime publishes. The others are designed on the board first (`page: false`): lowering skips them and the laws say so.
 * A part owned by a team or by each entity is board-only too: the bus is local, and authority over shared state is
 * the exported engine's.
 *
 *   PARTS          part → { variants, bind, rung, page, about, example }
 *   UI_STATES      the appearance states every part is drawn in on the board (the UI's t)
 *   OWNERS, AUDIENCES, MARKS
 *   readPart(p, i) a part → { part, variant, region, row, page, of, audience, mark, binds } or throws, teaching
 *   lowerParts(ps, phases)  parts → hud rows for the parts the page draws, in order; a row keeps the part's id (the
 *                  ui-<id> vars a cue sets) and its `when` as phase indices
 */
import { HUD_KINDS } from '../../game/hud-widgets.js';
import { UI_REGIONS, HUD_REGIONS, regionOf } from './regions.js';
import { SYSTEMS, SYSTEM_IDS } from './systems.js';

export const UI_STATES = Object.freeze(['hidden', 'shown', 'focus', 'active', 'disabled', 'alert']);
export const AUDIENCES = Object.freeze(['self', 'team', 'all', 'spectator']);
export const MARKS = Object.freeze(['chevron', 'diamond', 'circle', 'square', 'bar', 'none']);
export const OWNER_WORDS = Object.freeze(['self', 'team', 'all', 'target', 'each:<tag>']);
export const RETICLE_LAYERS = Object.freeze(['core', 'assist', 'status', 'charge']);

export const PARTS = Object.freeze({
  readout: {
    variants: [...HUD_KINDS], bind: 'var', rung: 2, page: true,
    about: 'a bus var, read at a glance: text, a big counter, a bar against a max, or a clock',
    example: { part: 'readout', variant: 'bar', bind: { var: 'hp' }, at: 'bottom-left', label: 'HP', max: 100, color: 'harm' },
  },
  banner: {
    variants: ['banner'], bind: 'on', rung: 2, page: true,
    about: 'a moment: big words when the bus emits an event, held for ttl seconds, replacing the last; as: \'title\' carves the words into 3D letters put on the screen in a design theme (arcade | pixel | cel | cartoon | cinematic | speed; the game\'s own by default), each dial of which the part may name (look, style, caps, edge, color, material, block), and a text may name a word in the world\'s language (\'@fight\')',
    example: { part: 'banner', bind: { on: 'level-complete' }, text: 'Cleared!', at: 'center' },
  },
  toast: {
    variants: ['event', 'change'], bind: 'var|on', rung: 2, page: true,
    about: 'a small rising number or word: one per event, or one per change of a var ({delta}); toasts stack',
    example: { part: 'toast', variant: 'change', bind: { var: 'score' }, text: '{delta}', at: 'top-right' },
  },
  legend: {
    variants: ['legend'], bind: 'none', rung: 1, page: true,
    about: 'standing words: the controls, a hint; fades after ttl seconds if given',
    example: { part: 'legend', text: 'WASD to move · click to use', at: 'bottom', ttl: 12 },
  },
  // ── flows: a management screen shows rates, not stocks (the pool archetype with its rate, history and links) ──
  ledger: {
    variants: ['ledger'], bind: 'rows', rung: 3, page: false,
    about: 'stocks with their rates and the net: wood 120 +12/min, food 40 −30/min',
    example: { part: 'ledger', rows: [{ var: 'wood', rate: 'wood-rate', label: 'Wood' }, { var: 'food', rate: 'food-rate', label: 'Food' }, { var: 'power', rate: 'power-rate', label: 'Power' }], at: 'top-left', label: 'Stores' },
  },
  forecast: {
    variants: ['empty', 'full'], bind: 'var', rung: 3, page: false,
    about: 'when a stock runs out (or fills) at its current rate: "food runs out in 2:10"',
    example: { part: 'forecast', variant: 'empty', bind: { var: 'food' }, rate: 'food-rate', label: 'Food', at: 'top' },
  },
  trend: {
    variants: ['sparkline'], bind: 'var', rung: 3, page: false,
    about: 'a stock over the last span seconds, a line at a glance',
    example: { part: 'trend', bind: { var: 'food' }, span: 120, label: 'Food', at: 'top-left' },
  },
  alerts: {
    variants: ['feed'], bind: 'on', rung: 3, page: false,
    about: 'events that need a decision; unlike toasts they stay until acted on',
    example: { part: 'alerts', bind: { on: 'alert-*' }, text: '{event.text}', at: 'right' },
  },
  allocator: {
    variants: ['steppers', 'sliders'], bind: 'var', rung: 4, page: false,
    about: 'splitting a fixed pool (workers, power, budget) between uses',
    example: { part: 'allocator', variant: 'steppers', bind: { var: 'workers' }, into: ['farms', 'mills', 'mines'], label: 'Workers', at: 'bottom-left' },
  },
  queue: {
    variants: ['list', 'strip'], bind: 'var', rung: 4, page: false,
    about: 'what is being made and in what order, the first with its progress',
    example: { part: 'queue', variant: 'strip', bind: { var: 'build-queue' }, label: 'Building', at: 'bottom' },
  },
  // ── the shooter's idioms: parts that read a system (systems.js), not a bus var ──
  reticle: {
    variants: ['ring', 'cross', 'dot', 'chevron'], bind: 'system', from: ['weapon'], rung: 3, page: false,
    about: 'where the shot goes: a mark at the aim point, sized from the weapon\'s spread; layers: core, assist (the aim-assist cone), status (the readiness arc), charge',
    example: { part: 'reticle', variant: 'ring', layers: ['core', 'assist', 'status'], at: 'center' },
  },
  hitmarker: {
    variants: ['x', 'ring'], bind: 'system', from: ['weapon'], rung: 3, page: false,
    about: 'a hit lands: a mark at the aim point for a few frames, in shape as well as colour (a kill draws it heavier)',
    example: { part: 'hitmarker', variant: 'x', at: 'center' },
  },
  ammo: {
    variants: ['count', 'pips', 'bar', 'gauge'], bind: 'system', from: ['weapon'], rung: 3, page: false,
    about: 'rounds left: "24 / 30", one pip a round, a bar, or a gauge for an energy weapon; reloading and overheat are its states',
    example: { part: 'ammo', variant: 'count', at: 'bottom-right' },
  },
  weapon: {
    variants: ['icon-name', 'loadout'], bind: 'system', from: ['weapon'], rung: 3, page: false,
    about: 'the active weapon: its icon and name, or the loadout strip with the active slot raised',
    example: { part: 'weapon', variant: 'icon-name', at: 'bottom-right' },
  },
  lock: {
    variants: ['diamond', 'brackets'], bind: 'system', from: ['lock'], rung: 3, page: false,
    about: 'over the locked target: a diamond or four brackets with a LOCK caption',
    example: { part: 'lock', variant: 'diamond', bind: { from: 'lock', of: 'target' }, at: 'over' },
  },
  target: {
    variants: ['name-bar'], bind: 'system', from: ['lock'], rung: 3, page: false,
    about: 'the target\'s card: its name and its bar, while something is locked or aimed at',
    example: { part: 'target', bind: { from: 'lock', of: 'target' }, bar: 'hp', at: 'top' },
  },
  damage: {
    variants: ['arcs'], bind: 'system', from: ['body'], rung: 3, page: false,
    about: 'where harm came from: an arc around the centre on the side it hit from, fading',
    example: { part: 'damage', variant: 'arcs', at: 'center' },
  },
  feed: {
    variants: ['lines'], bind: 'system', from: ['match'], rung: 3, page: false,
    about: 'the kill feed: who took down whom, newest on top, each line fading',
    example: { part: 'feed', at: 'top-right' },
  },
  // ── shared status: one part, one copy per entity ──
  nameplate: {
    variants: ['name', 'name-bar'], bind: 'var', rung: 3, page: false,
    about: 'over each tagged entity: its name, and with name-bar its bar (bar: \'<var>\')',
    example: { part: 'nameplate', variant: 'name-bar', bind: { var: 'name', of: 'each:player' }, bar: 'hp', at: 'over', audience: 'all', mark: { ally: 'chevron', enemy: 'diamond' } },
  },
  scoreboard: {
    variants: ['table'], bind: 'var', rung: 3, page: false,
    about: 'a row per tagged entity, a column per var; held open or shown between rounds',
    example: { part: 'scoreboard', bind: { var: 'name', of: 'each:player' }, columns: ['kills', 'deaths', 'score'], at: 'center', audience: 'all', when: ['scores'] },
  },
});
export const PART_IDS = Object.keys(PARTS);

const isStr = (v) => typeof v === 'string' && v.length > 0;
const OWNER = /^(self|team|all|target|each:[a-z0-9_-]+)$/i;

/** A part → { part, variant, region, row, page, of, audience, mark }. Throws a teaching error. */
export function readPart(p, i = 0) {
  const where = `play.parts[${i}]`;
  if (!p || typeof p !== 'object') throw new Error(`${where} is { part, variant?, bind?, at?, … } — parts: ${PART_IDS.join(', ')}`);
  const P = PARTS[p.part];
  if (!P) throw new Error(`${where}.part '${p.part}' is not a part — parts: ${PART_IDS.join(', ')}`);
  const b = p.bind && typeof p.bind === 'object' ? p.bind : {};
  const variant = p.variant === undefined ? (p.part === 'toast' ? (isStr(b.var) ? 'change' : 'event') : P.variants[0]) : p.variant;
  if (!P.variants.includes(variant)) throw new Error(`${where}.variant for a ${p.part} is one of: ${P.variants.join(', ')}`);

  // a system part reads its system; a var part may read a system's field instead of a bus var (bind: { from, field })
  const from = P.bind === 'system' ? (b.from === undefined ? P.from[0] : b.from) : P.bind === 'var' && b.from !== undefined ? b.from : null;
  if (from && P.bind === 'var') {
    if (!SYSTEM_IDS.includes(from)) throw new Error(`${where}.bind.from is a system: ${SYSTEM_IDS.join(', ')}`);
    if (!SYSTEMS[from].fields.includes(b.field)) throw new Error(`${where}.bind.field: the ${from} system publishes ${SYSTEMS[from].fields.join(', ')}`);
  }
  if (from && P.from && !P.from.includes(from)) throw new Error(`${where}.bind.from for a ${p.part} is ${P.from.join(' or ')} (systems: ${SYSTEM_IDS.join(', ')})`);
  if (P.bind === 'system' && p.field !== undefined && !SYSTEMS[from].fields.includes(p.field)) throw new Error(`${where}.field: the ${from} system publishes ${SYSTEMS[from].fields.join(', ')}`);
  if (p.part === 'reticle' && p.layers !== undefined && !(Array.isArray(p.layers) && p.layers.length && p.layers.every((l) => RETICLE_LAYERS.includes(l)))) throw new Error(`${where}.layers are drawn from: ${RETICLE_LAYERS.join(', ')}`);
  const of = b.of === undefined ? (from === 'match' ? 'all' : 'self') : b.of;
  if (!(isStr(of) && OWNER.test(of))) throw new Error(`${where}.bind.of is one of: ${OWNER_WORDS.join(', ')}`);
  const each = of.startsWith('each:');
  if ((p.part === 'nameplate' || p.part === 'scoreboard') && !each) throw new Error(`${where}: a ${p.part} is one per entity — bind: { var, of: 'each:<tag>' }`);
  // default audience: as wide as the owner (what I target is mine to see)
  const audience = p.audience === undefined ? (of === 'self' || of === 'target' ? 'self' : of === 'team' ? 'team' : 'all') : p.audience;
  if (!AUDIENCES.includes(audience)) throw new Error(`${where}.audience is one of: ${AUDIENCES.join(', ')}`);
  let mark = null;
  if (p.mark !== undefined) {
    if (!p.mark || typeof p.mark !== 'object' || !MARKS.includes(p.mark.ally) || !MARKS.includes(p.mark.enemy)) throw new Error(`${where}.mark is { ally, enemy }, each one of: ${MARKS.join(', ')}`);
    mark = { ally: p.mark.ally, enemy: p.mark.enemy };
  }

  let region = null;
  if (p.at === 'over' || (p.at === undefined && (p.part === 'nameplate' || p.part === 'lock'))) {
    if (!each && of !== 'target') throw new Error(`${where}.at 'over' sits over an entity — it needs bind.of 'each:<tag>' or 'target'`);
    region = 'over';
  } else if (p.at !== undefined) {
    region = regionOf(p.at);
    if (!region) throw new Error(`${where}.at is a region (${UI_REGIONS.join(', ')}), or 'over' for a part over each entity`);
  }
  if (p.when !== undefined && !(Array.isArray(p.when) && p.when.every(isStr))) throw new Error(`${where}.when is a list of phase names`);
  if (p.id !== undefined && !(isStr(p.id) && /^[a-z][a-z0-9-]*$/.test(p.id))) throw new Error(`${where}.id '${p.id}' is a lower-case word (a cue names a part by it)`);

  const needVar = P.bind === 'var' || (p.part === 'toast' && variant === 'change'), needOn = P.bind === 'on' || (p.part === 'toast' && variant === 'event');
  if (needVar && !from && !isStr(b.var)) throw new Error(`${where}: a ${p.part}${p.part === 'toast' ? ' (change)' : ''} binds a bus var — bind: { var: '<name>' }`);
  if (needOn && !isStr(b.on)) throw new Error(`${where}: a ${p.part}${p.part === 'toast' ? ' (event)' : ''} binds a bus event — bind: { on: '<event>' }`);
  if (p.part === 'ledger' && !(Array.isArray(p.rows) && p.rows.length && p.rows.every((r) => r && isStr(r.var)))) throw new Error(`${where}: a ledger lists rows: [{ var, rate?, label? }, …]`);
  if (p.part === 'forecast' && !isStr(p.rate)) throw new Error(`${where}: a forecast reads a rate — rate: '<var>' (per minute)`);
  if (p.part === 'allocator' && !(Array.isArray(p.into) && p.into.length >= 2 && p.into.every(isStr))) throw new Error(`${where}: an allocator splits its pool into: ['<var>', '<var>', …]`);
  if (p.part === 'scoreboard' && !(Array.isArray(p.columns) && p.columns.length && p.columns.every(isStr))) throw new Error(`${where}: a scoreboard lists columns: ['<var>', …]`);
  if (p.part === 'nameplate' && variant === 'name-bar' && !isStr(p.bar)) throw new Error(`${where}: a name-bar nameplate names its bar — bar: '<var>'`);

  // the page draws a part when its renderer exists and its value is on the local bus (mine, or the match's)
  const page = P.page && !from && (of === 'self' || of === 'all') && (region === null || HUD_REGIONS.includes(region));
  let row = null;
  if (page) {
    const slot = region ? { slot: region } : {};
    const pass = (keys) => Object.fromEntries(keys.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
    if (p.part === 'readout') row = { var: b.var, as: variant, ...slot, ...pass(['label', 'max', 'color']) };
    else if (p.part === 'banner') row = { on: b.on, ...pass(['text', 'as', 'theme', 'look', 'style', 'caps', 'edge', 'material', 'block', 'blockColor']), ...slot, ...pass(['ttl', 'color']) };
    else if (p.part === 'toast') row = variant === 'change' ? { var: b.var, as: 'toast', ...pass(['text']), ...slot, ...pass(['ttl', 'color']) } : { on: b.on, as: 'toast', ...pass(['text']), ...slot, ...pass(['ttl', 'color']) };
    else row = { ...pass(['text']), ...slot, ...pass(['ttl', 'color']) };
    // a part a cue names (show / hide / state: the ui-<id> vars) keeps its id on the row, so the page gates it
    if (p.id !== undefined) row.id = p.id;
  }
  const binds = b.var || b.on || (Array.isArray(p.rows) ? p.rows.map((r) => r.var).join('+') : '') || (from ? `${from}${b.field || p.field ? `.${b.field || p.field}` : ''}` : '');
  return { part: p.part, id: p.id ?? null, variant, region, row, page, of, audience, mark, binds, from, layers: p.part === 'reticle' ? (p.layers || ['core']) : null };
}

/** Parts → their events.hud rows, in order, for the parts the page draws (the others are the board's). A part's
 *  `when` (phase names) rides as the phases' indices in `phases` (the `phase` var holds an index); a name that is no
 *  phase throws, teaching. */
export function lowerParts(parts, phases = ['playing']) {
  const list = Array.isArray(parts) ? parts : [];
  return list.map((p, i) => [p, readPart(p, i), i]).filter(([, x]) => x.row).map(([p, x, i]) => {
    if (p.when === undefined) return x.row;
    const when = p.when.map((n) => {
      const k = phases.indexOf(n);
      if (k < 0) throw new Error(`play.parts[${i}].when names '${n}', which is no phase (play.phases: ${phases.join(', ')})`);
      return k;
    });
    return { ...x.row, when };
  });
}
