/**
 * STATS — the numbers behind a game's phenomena. A stat is a key and a value on a holder; it has no register of its own
 * (strength is drawn nowhere): it is felt through the phenomena it scales, a hit that lands harder. Levels, resources,
 * buying, epochs and tech trees are how stats move. The runtime is kernel.js; this module reads and lowers.
 *
 *   play.stats: {
 *     holders?: ['player'],                     who carries stats (a character's id, or 'game'), or { id, stats?, resources? }
 *                                               (where that holder starts apart); the first is the default
 *     stats: [{ id, base?, min?, max? } | { id, from: formula, min?, max? }],   from: a DERIVED stat, never raised
 *     bodies?: { hpMax?: stat, speed?: stat },  a stat bound to each holder character's body
 *     resources?: [{ id, start?, cap? }],        stat currency (points), money (gold), anything a cost names
 *     level?: { start?: 1, max?, xp: [n, …] | { base, growth }, each?: gives, at?: { <level>: gives } },
 *     epochs?: [{ id, level?, cost?, requires? }],   ordered; the first is where a holder starts; reached by level, bought, or both
 *     tree?: [node],     node = { id, epoch?, requires?, cost?, ranks?, growth?, gives?, opens?, tree?: [node] }
 *     offers?: [{ id, cost, gives, requires?, max? }] }     buys outside the tree (the attribute screen)
 *   gives    = { raise?: { <stat>: n }, grant?: { <resource>: n }, xp?: n }
 *   cost     = { <resource>: n }
 *   requires = { level: n } | { epoch: id } | { has: node, rank? } | { stat: key, gte } | { all: [..] } | { any: [..] }
 *   formula  = n | { stat, of?: holder | 'self' | 'target', base?, per?, min?, max? }
 *            | { sum?: [formula], mul?: [formula], curve?: { mitigate: k } | { soft: at, slope? } | 'sqrt', min?, max? }
 *              where a phenomenon takes a number (SCALABLE), a gift's by, a derived stat's from, a buff's add / pct / mul
 *   modifiers: effective = (base + Σ add) × (1 + Σ pct) × Π mul; buffs by id, a status's mods as status:<is>
 *
 *   STAT_THEN, STAT_WHEN      the effects and happenings a cue may name, one line each
 *   readStats(play)           → the kernel's cfg, or null; throws, teaching
 *   lowerStats(play)          → { vars, stats: cfg } or null (absent: zero bytes)
 *   readFormula(v, where, cfg, { target })   one formula, read (target: whether 'target' means anything here)
 *   readMods(v, where, cfg)   a buff's (a status's) modifiers
 *   readStatEffect / readStatWhen / statFire / lowerStatEffect / lowerStatusMods   the cue side
 *   statVar(holder, key)      the bus var a stat, a resource, level, xp, epoch or a node's rank lives in
 */
import { initStatVars } from './kernel.js';

export const DEFAULT_HOLDER = 'player';
export const RESERVED = Object.freeze(['level', 'xp', 'epoch']);
export const BODY_FIELDS = Object.freeze(['hpMax', 'speed']);
// where a phenomenon may take a scaling in place of a number: the cue effect's key → its fields
export const SCALABLE = Object.freeze({ hurt: ['by'], heal: ['by'], explode: ['scale'], status: ['for'], shake: ['k', 'for'], puff: ['shake'], walk: ['speed'] });

export const STAT_THEN = Object.freeze({
  raise: '{ raise: { stat, by?, of? } } a stat goes up (by may be negative, or a scaling); held to its min / max',
  grant: '{ grant: { res, by?, of? } } a resource is given (a pickup, a reward); held to 0 and its cap',
  xp: '{ xp: { by, of? } } experience: crossing a threshold levels up (each level gives its gives)',
  level: '{ level: { by?, of? } } level up now (by levels, 1 by default)',
  buy: '{ buy: id | { id, of? } } buy a tech node (its next rank), an offer or the next epoch: requirements, then the cost; bought or denied fires',
  buff: '{ buff: { id, of?, mods: [{ stat, add? | pct? | mul? }] | stat, add? | pct? | mul?, for? } } modifiers on stats under one id (again: replaced); for: seconds, then gone',
  unbuff: '{ unbuff: id | { id, of? } } take a buff off (an id ending * takes every one it starts)',
});
export const STAT_WHEN = Object.freeze({
  levelled: 'a holder levels up: { levelled: holder } any level, or { levelled: { of, to } } reaching one',
  bought: 'a purchase went through: { bought: id } (a node, an offer, an epoch)',
  denied: 'a purchase was refused: { denied: id } (why: requires | cost | max on the event)',
  epoch: 'a holder reaches an epoch: { epoch: id }',
  opened: 'a tech node becomes buyable: { opened: id }',
});

export const statVar = (holder, key) => `${holder}.${key}`;

const ID = /^[a-z][a-z0-9-]*$/;
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const id = (v, where) => { if (!isStr(v) || !ID.test(v)) throw new Error(`${where} '${v}' is a lower-case word`); return v; };
const optNum = (v, where, what) => { if (v !== undefined && !num(v)) throw new Error(`${where} is ${what}`); return v; };

function list(v, where, shape) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new Error(`${where} is a list of ${shape}`);
  return v;
}

/** play.stats → the kernel's cfg, or null. Every name is checked; errors say what a field is. */
export function readStats(play) {
  const s = play && play.stats;
  if (s === undefined) return null;
  if (!isObj(s)) throw new Error('play.stats is { holders?, stats, resources?, level?, epochs?, tree?, offers? }');
  const hs = s.holders === undefined ? [DEFAULT_HOLDER] : s.holders;
  if (!Array.isArray(hs) || !hs.length) throw new Error("play.stats.holders is a list of who carries stats (a character's id, or 'game'), or { id, stats?, resources? }");
  const holders = hs.map((h, i) => id(isObj(h) ? h.id : h, `play.stats.holders[${i}]${isObj(h) ? '.id' : ''}`));
  if (new Set(holders).size !== holders.length) throw new Error('play.stats.holders names a holder twice');

  // one namespace per holder: stats, resources, nodes, offers and epochs share it, beside level, xp and epoch
  const names = new Set(RESERVED);
  const claim = (n, where) => {
    id(n, where);
    if (names.has(n)) throw new Error(`${where} '${n}' is taken (${RESERVED.includes(n) ? 'level, xp and epoch are the track\'s own' : 'a stat, a resource, a node, an offer and an epoch share one set of names'})`);
    names.add(n);
    return n;
  };

  const stats = {}, derived = [];
  list(s.stats, 'play.stats.stats', '{ id, base?, min?, max? }').forEach((x, i) => {
    const w = `play.stats.stats[${i}]`;
    if (!isObj(x)) throw new Error(`${w} is { id, base?, min?, max? }`);
    claim(x.id, `${w}.id`);
    optNum(x.base, `${w}.base`, 'where it starts'); optNum(x.min, `${w}.min`, 'its floor'); optNum(x.max, `${w}.max`, 'its ceiling');
    if (num(x.min) && num(x.max) && x.min > x.max) throw new Error(`${w}: min is above max`);
    if (x.from !== undefined && x.base !== undefined) throw new Error(`${w}: a derived stat (from) has no base: its formula is its base`);
    stats[x.id] = { base: x.base ?? 0, ...(num(x.min) ? { min: x.min } : {}), ...(num(x.max) ? { max: x.max } : {}) };
    if (x.from !== undefined) { delete stats[x.id].base; derived.push([x.id, x.from, `${w}.from`]); }
  });
  const resources = {};
  list(s.resources, 'play.stats.resources', '{ id, start?, cap? }').forEach((x, i) => {
    const w = `play.stats.resources[${i}]`;
    if (!isObj(x)) throw new Error(`${w} is { id, start?, cap? }`);
    claim(x.id, `${w}.id`);
    if (x.start !== undefined && !(num(x.start) && x.start >= 0)) throw new Error(`${w}.start is how much a holder starts with (0 or more)`);
    if (x.cap !== undefined && !(num(x.cap) && x.cap > 0)) throw new Error(`${w}.cap is the most a holder can carry`);
    resources[x.id] = { start: x.start ?? 0, ...(num(x.cap) ? { cap: x.cap } : {}) };
  });

  // the rest names stats and resources: check them once those are known
  const later = [];
  const gives = (g, w) => {
    if (g === undefined) return undefined;
    if (!isObj(g)) throw new Error(`${w} is { raise?: { stat: n }, grant?: { resource: n }, xp?: n }`);
    const out = {};
    for (const k of Object.keys(g)) if (!['raise', 'grant', 'xp'].includes(k)) throw new Error(`${w}.${k}: gives are raise, grant and xp`);
    for (const [k, table] of [['raise', stats], ['grant', resources]]) {
      if (g[k] === undefined) continue;
      if (!isObj(g[k])) throw new Error(`${w}.${k} is { <${k === 'raise' ? 'stat' : 'resource'}>: n }`);
      for (const [n, v] of Object.entries(g[k])) {
        if (!table[n]) throw new Error(`${w}.${k}.${n} is no ${k === 'raise' ? 'stat' : 'resource'} (${Object.keys(table).join(', ') || 'none declared'})`);
        if (!num(v)) throw new Error(`${w}.${k}.${n} is a number`);
      }
      out[k] = { ...g[k] };
    }
    if (g.xp !== undefined) { if (!(num(g.xp) && g.xp > 0)) throw new Error(`${w}.xp is experience given`); later.push(() => { if (!s.level) throw new Error(`${w}.xp: experience needs play.stats.level`); }); out.xp = g.xp; }
    return out;
  };
  const cost = (c, w, need) => {
    if (c === undefined) { if (need) throw new Error(`${w} is { <resource>: n }`); return {}; }
    if (!isObj(c)) throw new Error(`${w} is { <resource>: n }`);
    for (const [n, v] of Object.entries(c)) {
      if (!resources[n]) throw new Error(`${w}.${n} is no resource (${Object.keys(resources).join(', ') || 'declare play.stats.resources'})`);
      if (!(num(v) && v > 0)) throw new Error(`${w}.${n} is how much it costs`);
    }
    return { ...c };
  };
  const req = (r, w) => {
    if (r === undefined) return undefined;
    if (!isObj(r)) throw new Error(`${w} is { level } | { epoch } | { has, rank? } | { stat, gte } | { all: [..] } | { any: [..] }`);
    if (r.all !== undefined || r.any !== undefined) {
      const k = r.all !== undefined ? 'all' : 'any';
      if (!Array.isArray(r[k]) || !r[k].length) throw new Error(`${w}.${k} is a list of requirements`);
      return { [k]: r[k].map((x, i) => req(x, `${w}.${k}[${i}]`)) };
    }
    if (r.level !== undefined) { if (!num(r.level)) throw new Error(`${w}.level is a level`); later.push(() => { if (!s.level) throw new Error(`${w}: a level requirement needs play.stats.level`); }); return { level: r.level }; }
    if (r.epoch !== undefined) { later.push(() => { if (!epochIds.includes(r.epoch)) throw new Error(`${w}.epoch '${r.epoch}' is no epoch (${epochIds.join(', ') || 'none declared'})`); }); return { epoch: r.epoch }; }
    if (r.has !== undefined) {
      if (r.rank !== undefined && !(Number.isInteger(r.rank) && r.rank >= 1)) throw new Error(`${w}.rank is a node's rank (1 or more)`);
      later.push(() => { if (!nodes[r.has] && !offers[r.has]) throw new Error(`${w}.has '${r.has}' is no tech node or offer`); });
      return { has: r.has, ...(r.rank ? { rank: r.rank } : {}) };
    }
    if (r.stat !== undefined) {
      if (!num(r.gte)) throw new Error(`${w}.gte is the least the value must be`);
      later.push(() => { if (!names.has(r.stat)) throw new Error(`${w}.stat '${r.stat}' is nothing a holder carries`); });
      return { stat: r.stat, gte: r.gte };
    }
    throw new Error(`${w} names one requirement: level, epoch, has, stat, all or any`);
  };

  let level = null;
  if (s.level !== undefined) {
    const L = s.level, w = 'play.stats.level';
    if (!isObj(L)) throw new Error(`${w} is { start?, max?, xp, each?, at? }`);
    if (L.start !== undefined && !(Number.isInteger(L.start) && L.start >= 0)) throw new Error(`${w}.start is the first level (0 or 1)`);
    const start = L.start ?? 1;
    if (L.max !== undefined && !(Number.isInteger(L.max) && L.max > start)) throw new Error(`${w}.max is the last level (above start)`);
    level = { start, ...(L.max !== undefined ? { max: L.max } : {}), xp: xpTable(L.xp, start, L.max, `${w}.xp`) };
    const each = gives(L.each, `${w}.each`);
    if (each) level.each = each;
    if (L.at !== undefined) {
      if (!isObj(L.at)) throw new Error(`${w}.at is { <level>: gives }`);
      level.at = {};
      for (const [k, g] of Object.entries(L.at)) {
        if (!/^\d+$/.test(k) || +k <= start) throw new Error(`${w}.at.${k}: a level above start`);
        level.at[k] = gives(g, `${w}.at.${k}`);
      }
    }
  }

  const epochIds = [];
  const epochs = list(s.epochs, 'play.stats.epochs', '{ id, level?, cost?, requires? }').map((e, i) => {
    const w = `play.stats.epochs[${i}]`;
    if (!isObj(e)) throw new Error(`${w} is { id, level?, cost?, requires? }`);
    claim(e.id, `${w}.id`);
    epochIds.push(e.id);
    if (i === 0 && (e.level !== undefined || e.cost !== undefined || e.requires !== undefined)) throw new Error(`${w}: the first epoch is where every holder starts (no level, cost or requires)`);
    if (e.level !== undefined) { if (!Number.isInteger(e.level)) throw new Error(`${w}.level is the level that reaches it`); later.push(() => { if (!s.level) throw new Error(`${w}.level needs play.stats.level`); }); }
    if (i > 0 && e.level === undefined && e.cost === undefined) throw new Error(`${w} is reached by a level, bought for a cost, or both`);
    return { id: e.id, ...(e.level !== undefined ? { level: e.level } : {}), ...(e.cost !== undefined ? { cost: cost(e.cost, `${w}.cost`, true) } : {}), ...(e.requires !== undefined ? { requires: req(e.requires, `${w}.requires`) } : {}) };
  });

  const nodes = {};
  const walk = (xs, w, parent) => list(xs, w, '{ id, epoch?, requires?, cost?, ranks?, growth?, gives?, opens?, tree? }').forEach((n, i) => {
    const wn = `${w}[${i}]`;
    if (!isObj(n)) throw new Error(`${wn} is a tech node { id, cost?, ranks?, … }`);
    claim(n.id, `${wn}.id`);
    if (n.ranks !== undefined && !(Number.isInteger(n.ranks) && n.ranks >= 1)) throw new Error(`${wn}.ranks is how many times it can be bought (1 by default)`);
    if (n.growth !== undefined && !(num(n.growth) && n.growth > 0)) throw new Error(`${wn}.growth multiplies the cost each rank (1 by default)`);
    if (n.opens !== undefined && !(parent && Number.isInteger(n.opens) && n.opens >= 1)) throw new Error(`${wn}.opens is the parent's rank that opens it (a subtree node only)`);
    if (n.epoch !== undefined) later.push(() => { if (!epochIds.includes(n.epoch)) throw new Error(`${wn}.epoch '${n.epoch}' is no epoch (${epochIds.join(', ') || 'none declared'})`); });
    nodes[n.id] = {
      ...(parent ? { parent, opens: n.opens ?? 1 } : { opens: 0 }),
      ...(n.epoch !== undefined ? { epoch: n.epoch } : {}),
      ...(n.requires !== undefined ? { requires: req(n.requires, `${wn}.requires`) } : {}),
      cost: cost(n.cost, `${wn}.cost`, false), ranks: n.ranks ?? 1, growth: n.growth ?? 1,
      ...(n.gives !== undefined ? { gives: gives(n.gives, `${wn}.gives`) } : {}),
    };
    if (n.opens !== undefined && n.opens > (nodes[parent] && nodes[parent].ranks)) throw new Error(`${wn}.opens is above the parent's ranks: it could never open`);
    walk(n.tree, `${wn}.tree`, n.id);
  });
  walk(s.tree, 'play.stats.tree', null);

  const offers = {};
  list(s.offers, 'play.stats.offers', '{ id, cost, gives, requires?, max? }').forEach((o, i) => {
    const w = `play.stats.offers[${i}]`;
    if (!isObj(o)) throw new Error(`${w} is { id, cost, gives, requires?, max? }`);
    claim(o.id, `${w}.id`);
    if (o.gives === undefined) throw new Error(`${w}.gives is what it buys`);
    if (o.max !== undefined && !(Number.isInteger(o.max) && o.max >= 1)) throw new Error(`${w}.max is how many times it can be bought`);
    offers[o.id] = { cost: cost(o.cost, `${w}.cost`, true), gives: gives(o.gives, `${w}.gives`), ...(o.requires !== undefined ? { requires: req(o.requires, `${w}.requires`) } : {}), ...(o.max !== undefined ? { max: o.max } : {}) };
  });

  for (const k of Object.keys(s)) if (!['holders', 'stats', 'resources', 'level', 'epochs', 'tree', 'offers', 'bodies'].includes(k)) throw new Error(`play.stats.${k}: play.stats has holders, stats, resources, level, epochs, tree, offers, bodies`);
  for (const f of later) f();
  const cfg = { holders: [...holders], starts: {}, stats, order: [], resources, level, epochs, nodes, offers, bodies: null };

  // where a holder starts apart: its own stats' bases and resources
  hs.forEach((h, i) => {
    if (!isObj(h)) return;
    const w = `play.stats.holders[${i}]`, st = {};
    for (const k of Object.keys(h)) if (!['id', 'stats', 'resources'].includes(k)) throw new Error(`${w}.${k}: a holder has id, stats, resources`);
    for (const [k, table, what] of [['stats', stats, 'stat'], ['resources', resources, 'resource']]) {
      if (h[k] === undefined) continue;
      if (!isObj(h[k])) throw new Error(`${w}.${k} is { <${what}>: n }`);
      for (const [n, v] of Object.entries(h[k])) {
        if (!table[n]) throw new Error(`${w}.${k}.${n} is no ${what}`);
        if (k === 'stats' && table[n].from === undefined && !('base' in table[n])) throw new Error(`${w}.stats.${n} is derived: it starts where its formula says`);
        if (!num(v)) throw new Error(`${w}.${k}.${n} is a number`);
      }
      st[k] = { ...h[k] };
    }
    cfg.starts[h.id] = st;
  });

  // derived stats after what they read; a cycle can never settle
  const reads = new Map(derived.map(([n, f, w]) => [n, statsRead(readFormula(f, w, cfg, { target: false }))]));
  for (const [n, f, w] of derived) stats[n].from = readFormula(f, w, cfg, { target: false });
  const order = Object.keys(stats).filter((n) => !reads.has(n)), placed = new Set(order);
  while (placed.size < Object.keys(stats).length) {
    const next = [...reads.keys()].find((n) => !placed.has(n) && [...reads.get(n)].every((r) => placed.has(r) || !stats[r]));
    if (!next) throw new Error(`play.stats.stats: ${[...reads.keys()].filter((n) => !placed.has(n)).join(', ')} read each other round in a circle: a derived stat reads stats that settle first`);
    order.push(next); placed.add(next);
  }
  cfg.order = order;

  if (s.bodies !== undefined) {
    if (!isObj(s.bodies)) throw new Error('play.stats.bodies is { hpMax?: stat, speed?: stat }');
    for (const [k, v] of Object.entries(s.bodies)) {
      if (!BODY_FIELDS.includes(k)) throw new Error(`play.stats.bodies.${k}: a body takes ${BODY_FIELDS.join(', ')}`);
      if (!stats[v]) throw new Error(`play.stats.bodies.${k} '${v}' is no stat`);
    }
    cfg.bodies = { ...s.bodies };
  }
  return cfg;
}

// total xp to reach start + 1, start + 2, …: a list as given (each above the last), or base × growth^i a level, summed
function xpTable(x, start, max, w) {
  if (Array.isArray(x)) {
    if (!x.length || !x.every((v, i) => num(v) && v > 0 && (i === 0 || v > x[i - 1]))) throw new Error(`${w} is the total xp for each level after start, rising`);
    return [...x];
  }
  if (!isObj(x) || !(num(x.base) && x.base > 0)) throw new Error(`${w} is a list of totals, or { base, growth? } (base xp to the first level up, each next level growth × the last)`);
  const g = x.growth ?? 1.5;
  if (!(num(g) && g >= 1)) throw new Error(`${w}.growth is 1 or more`);
  const n = Math.min((max ?? start + 99) - start, 999), out = [];
  let total = 0;
  for (let i = 0; i < n; i++) { total += Math.round(x.base * Math.pow(g, i)); out.push(total); }
  return out;
}

/** The stats fragment: the vars every holder starts with and the kernel's cfg, or null (absent: zero bytes). */
export function lowerStats(play) {
  const cfg = readStats(play);
  if (!cfg) return null;
  return { vars: initStatVars(cfg), stats: cfg };
}

const holderKeys = (cfg) => new Set([...RESERVED, ...Object.keys(cfg.stats), ...Object.keys(cfg.resources), ...Object.keys(cfg.nodes), ...Object.keys(cfg.offers)]);

/** One formula: a number, a term { stat, of?, base?, per?, min?, max? }, or { sum?, mul?, curve?, min?, max? }. */
export function readFormula(v, where, cfg, { target = true, depth = 0 } = {}) {
  if (!cfg) throw new Error(`${where} reads a stat: declare play.stats first`);
  if (num(v)) return v;
  if (depth > 8) throw new Error(`${where}: a formula nests at most 8 deep`);
  if (!isObj(v)) throw new Error(`${where} is a number, a term { stat, of?, base?, per? }, or { sum?, mul?, curve?, min?, max? }`);
  for (const k of ['min', 'max']) optNum(v[k], `${where}.${k}`, 'a number');
  if (isStr(v.stat)) {
    for (const k of Object.keys(v)) if (!['stat', 'of', 'base', 'per', 'min', 'max', 'curve'].includes(k)) throw new Error(`${where}.${k}: a term has stat, of, base, per, min, max, curve`);
    if (!holderKeys(cfg).has(v.stat)) throw new Error(`${where}.stat '${v.stat}' is nothing a holder carries (${[...holderKeys(cfg)].join(', ')})`);
    if (v.of !== undefined && !(cfg.holders.includes(v.of) || v.of === 'self' || v.of === 'target')) throw new Error(`${where}.of '${v.of}' is a holder (${cfg.holders.join(', ')}), 'self' or 'target'`);
    if (v.of === 'target' && !target) throw new Error(`${where}.of: there is no target here (a derived stat, a buff and a gift read their own holder)`);
    for (const k of ['base', 'per']) optNum(v[k], `${where}.${k}`, 'a number');
    return { ...v, ...(v.curve !== undefined ? { curve: readCurve(v.curve, `${where}.curve`) } : {}) };
  }
  if (v.sum === undefined && v.mul === undefined) throw new Error(`${where} is a term (it names a stat) or adds and multiplies: { sum?: [..], mul?: [..] }`);
  for (const k of Object.keys(v)) if (!['sum', 'mul', 'curve', 'min', 'max'].includes(k)) throw new Error(`${where}.${k}: a formula has sum, mul, curve, min, max`);
  const out = {};
  for (const k of ['sum', 'mul']) {
    if (v[k] === undefined) continue;
    if (!Array.isArray(v[k]) || !v[k].length) throw new Error(`${where}.${k} is a list of formulas`);
    out[k] = v[k].map((x, i) => readFormula(x, `${where}.${k}[${i}]`, cfg, { target, depth: depth + 1 }));
  }
  if (v.curve !== undefined) out.curve = readCurve(v.curve, `${where}.curve`);
  for (const k of ['min', 'max']) if (v[k] !== undefined) out[k] = v[k];
  return out;
}
function readCurve(c, where) {
  if (c === 'sqrt') return c;
  if (isObj(c) && Object.keys(c).length === 1 && num(c.mitigate) && c.mitigate > 0) return { mitigate: c.mitigate };
  if (isObj(c) && num(c.soft) && Object.keys(c).every((k) => k === 'soft' || k === 'slope') && (c.slope === undefined || (num(c.slope) && c.slope >= 0))) return { soft: c.soft, ...(c.slope !== undefined ? { slope: c.slope } : {}) };
  throw new Error(`${where} is { mitigate: k } (k / (k + v): the armor curve, a factor that never reaches 0), { soft: at, slope? } (full to at, then slope a point) or 'sqrt'`);
}
// the stats a formula reads of its own holder (for a derived stat's order)
function statsRead(f, out = new Set()) {
  if (isObj(f)) {
    if (isStr(f.stat) && (f.of === undefined || f.of === 'self')) out.add(f.stat);
    for (const x of [...(f.sum || []), ...(f.mul || [])]) statsRead(x, out);
  }
  return out;
}
export const readScaling = (v, where, cfg) => readFormula(v, where, cfg);
export const isFormula = (v) => isObj(v) && (typeof v.stat === 'string' || Array.isArray(v.sum) || Array.isArray(v.mul));
export const isScaling = isFormula;

/** A buff's modifiers: [{ stat, add? | pct? | mul? }] (each value a number or a formula of the holder). */
export function readMods(v, where, cfg) {
  if (!cfg) throw new Error(`${where}: modifiers need play.stats`);
  const list = Array.isArray(v) ? v : [v];
  if (!list.length) throw new Error(`${where} is a list of { stat, add? | pct? | mul? }`);
  return list.map((m, i) => {
    const w = Array.isArray(v) ? `${where}[${i}]` : where;
    if (!isObj(m) || !cfg.stats[m.stat]) throw new Error(`${w}.stat '${isObj(m) ? m.stat : m}' is no stat (${Object.keys(cfg.stats).join(', ')})`);
    const ks = ['add', 'pct', 'mul'].filter((k) => m[k] !== undefined);
    if (!ks.length) throw new Error(`${w} adds (add: +3), adds a share (pct: 0.2 is +20%) or multiplies (mul: 1.5)`);
    for (const k of Object.keys(m)) if (!['stat', 'add', 'pct', 'mul'].includes(k)) throw new Error(`${w}.${k}: a modifier has stat, add, pct, mul`);
    return { stat: m.stat, ...Object.fromEntries(ks.map((k) => [k, readFormula(m[k], `${w}.${k}`, cfg, { target: false })])) };
  });
}

const ofHolder = (o, w, cfg) => {
  if (o.of === undefined) return {};
  if (!cfg.holders.includes(o.of)) throw new Error(`${w}.of '${o.of}' is no holder (${cfg.holders.join(', ')})`);
  return { of: o.of };
};

/** One stat effect, read into an intent ({ kind: 'stat', op, … }) that lowers as a `ctrl` op. */
export function readStatEffect(k, t, where, ctx = {}) {
  const cfg = ctx.stats, v = t[k], w = `${where}.${k}`;
  if (!cfg) throw new Error(`${w}: stat effects need play.stats`);
  const by = (x, wb) => (x === undefined ? {} : isFormula(x) ? { by: readFormula(x, wb, cfg, { target: false }) } : num(x) ? { by: x } : (() => { throw new Error(`${wb} is a number or a formula`); })());
  if (k === 'buy') {
    const o = isStr(v) ? { id: v } : v;
    if (!isObj(o) || !isStr(o.id)) throw new Error(`${w} is an id (a node, an offer, an epoch), or { id, of? }`);
    if (!cfg.nodes[o.id] && !cfg.offers[o.id] && !cfg.epochs.some((e) => e.id === o.id)) throw new Error(`${w} '${o.id}' is no tech node, offer or epoch`);
    return { kind: 'stat', op: 'buy', id: o.id, ...ofHolder(o, w, cfg), page: true };
  }
  if (k === 'unbuff') {
    const o = isStr(v) ? { id: v } : v;
    if (!isObj(o) || !isStr(o.id)) throw new Error(`${w} is a buff's id, or { id, of? } (an id ending * takes every one it starts)`);
    return { kind: 'stat', op: 'unbuff', id: o.id, ...ofHolder(o, w, cfg), page: true };
  }
  if (k === 'buff') {
    if (!isObj(v) || !(isStr(v.id) && ID.test(v.id))) throw new Error(`${w} is { id, of?, mods: [{ stat, add? | pct? | mul? }] | stat, add? | pct? | mul?, for? }`);
    const mods = readMods(v.mods !== undefined ? v.mods : { stat: v.stat, add: v.add, pct: v.pct, mul: v.mul }, `${w}${v.mods !== undefined ? '.mods' : ''}`, cfg)
      .map((m) => Object.fromEntries(Object.entries(m).filter(([, x]) => x !== undefined)));
    if (v.for !== undefined && !(num(v.for) && v.for > 0)) throw new Error(`${w}.for is seconds`);
    return { kind: 'stat', op: 'buff', id: v.id, mods, ...ofHolder(v, w, cfg), ...(v.for !== undefined ? { for: v.for } : {}), page: true };
  }
  const o = isObj(v) ? v : k === 'level' && v === true ? {} : null;
  if (!o) throw new Error(`${w} is ${STAT_THEN[k].split(' } ')[0]} }`);
  const out = { kind: 'stat', op: k, ...ofHolder(o, w, cfg), page: true };
  if (k === 'raise') {
    if (!cfg.stats[o.stat]) throw new Error(`${w}.stat '${o.stat}' is no stat (${Object.keys(cfg.stats).join(', ')})`);
    if (cfg.stats[o.stat].from) throw new Error(`${w}.stat '${o.stat}' is derived: raise what it is made of, or buff it`);
    out.stat = o.stat;
  }
  if (k === 'grant') { if (!cfg.resources[o.res]) throw new Error(`${w}.res '${o.res}' is no resource (${Object.keys(cfg.resources).join(', ') || 'none declared'})`); out.res = o.res; }
  if ((k === 'xp' || k === 'level') && !cfg.level) throw new Error(`${w}: needs play.stats.level`);
  if (k === 'xp' && o.by === undefined) throw new Error(`${w}.by is the experience given`);
  return Object.assign(out, by(o.by, `${w}.by`));
}

/** One stat happening, read. */
export function readStatWhen(k, w, where, ctx = {}) {
  const cfg = ctx.stats, v = w[k], wk = `${where}.${k}`;
  if (!cfg) throw new Error(`${wk}: stat happenings need play.stats`);
  if (k === 'levelled') {
    const o = isStr(v) ? { of: v } : v;
    if (!isObj(o) || !cfg.holders.includes(o.of)) throw new Error(`${wk} is a holder (${cfg.holders.join(', ')}), or { of, to? }`);
    if (o.to !== undefined && !Number.isInteger(o.to)) throw new Error(`${wk}.to is a level`);
    return { kind: 'levelled', of: o.of, ...(o.to !== undefined ? { to: o.to } : {}) };
  }
  if (!isStr(v)) throw new Error(`${wk} is an id`);
  const known = k === 'epoch' ? cfg.epochs.some((e) => e.id === v) : k === 'opened' ? !!cfg.nodes[v] : !!(cfg.nodes[v] || cfg.offers[v] || cfg.epochs.some((e) => e.id === v));
  if (!known && !v.includes('*')) throw new Error(`${wk} '${v}' is no ${k === 'epoch' ? 'epoch' : k === 'opened' ? 'tech node' : 'tech node, offer or epoch'}`);
  return { kind: k, id: v };
}

/** A stat happening's reaction onto the bus: the kernel's event, matched. */
export function statFire(w, type) {
  if (w.kind === 'levelled') return { on: 'level-up', match: { of: w.of, ...(w.to !== undefined ? { level: String(w.to) } : {}) }, do: 'emit', type };
  if (w.kind === 'epoch') return { on: 'epoch', match: { epoch: w.id }, do: 'emit', type };
  return { on: w.kind, match: { id: w.id }, do: 'emit', type };
}

/** A stat effect onto the bus, on one event: a `ctrl` intent the stats kernel takes off the queue. */
export function lowerStatEffect(t, on, frag) {
  const r = { on, do: 'ctrl', op: t.op };
  for (const k of ['of', 'stat', 'res', 'id', 'by', 'mods']) if (t[k] !== undefined) r[k] = t[k];
  frag.reactions.push(r);
  // a buff for a while: a sequence waits it out after each firing, then takes it off (re-fired while it waits: the first
  // wait stands)
  if (t.op === 'buff' && t.for !== undefined) frag.sequences.push(unbuffAfter(t.of, t.id, t.for, on));
  return frag;
}
const unbuffAfter = (of, id, secs, on) => ({ id: `unbuff-${of || ''}-${id}-${on}`, trigger: { on }, steps: [{ await: { timer: secs } }, { do: 'ctrl', op: 'unbuff', ...(of ? { of } : {}), id }] });

/**
 * A status that carries modifiers on a holder (cues.js reads `mods` beside the status): buffed as status:<is> with it,
 * taken off when it is lifted, when its `for` runs out, or (no `for`) when the cue ends.
 */
export function lowerStatusMods(t, on, frag, end = null) {
  if (!t.mods) return frag;
  const id = `status:${t.is}`;
  frag.reactions.push({ on, do: 'ctrl', op: 'buff', of: t.who, id, mods: t.mods });
  if (t.for !== undefined && Number.isFinite(t.for)) frag.sequences.push(unbuffAfter(t.who, id, t.for, on));
  else if (end) frag.reactions.push({ on: end, do: 'ctrl', op: 'unbuff', of: t.who, id });
  return frag;
}
