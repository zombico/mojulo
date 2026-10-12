/**
 * MECHANICS — the game's systems: the hero's actions numbered, and the HUD that shows them. A concern of the world
 * beside its ground, its characters and its equipment. The numbers are DERIVED from the loop (the actions page's
 * mechanics seed) through small tables, each number with its reason, and lowered to the `play.stats` the stats kernel
 * runs (playscape/stats): the creator's own numbers are laid over them, ledgered.
 *
 *   stage            →  an epoch, reached by level (EPOCH_LEVEL)
 *   power            →  a tech node in its stage's epoch, gained as the system gains powers (GAINED)
 *   system resource  →  a resource the powers spend (ki, mana, stamina)
 *   equipment class  →  what equipping it raises, by tier (GEAR_STAT, GEAR_BY): tree nodes, or offers to buy
 *   the systems      →  the HUD: hp, the resource, the level, a banner on each level and epoch, a status page (I)
 *   each power       →  a key (1, 2, 3 …): it spends its cost and shows its look on the hero (KEYS)
 *
 *   mechanics?: {
 *     stats?: { <play.stats fields> },          // the creator's own, laid over the derived (lists by id, objects by key)
 *     scale?: { hp?, power?, cost?, curve? },   // the coarse dials the derivation reads (SCALE)
 *     powers?: { <power id>: { spends } },      // a power's own spend of the resource over the derived (0: free; ledgered)
 *     hud?: 'derive' | false | [part],          // the readouts: derived (default), none, or the creator's own
 *     ui?: 'propose' | 'auto' | <direction>,    // play.ui (playscape/ui/direction.js), resolved when the world is minted
 *     gear?: { <class>: { stat?, by?: [early, mid, late] } },   // what a class raises, over GEAR_STAT / GEAR_BY
 *     destruction?: 'none' | 'objects' | 'cover' | 'world',    // how much the game lets break (playscape/destruct/
 *                                                              // breakability.js), copied onto every level it makes
 *   }
 *
 * Pure: no dice, no clock. `readMechanics` reads the shape (the world reader calls it); `resolveMechanics` derives the
 * play block, its keys and their legend from the resolved book; `mechanicsOrders` the tool call that realizes it. How
 * hard a power lands (`powers[].hurt`) is carried as data until the powers have targets.
 */
import { readStats, statVar } from '../playscape/stats/stats.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { readPart } from '../playscape/ui/parts.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { playerWorld } from '../playscape/player.js';
import { STAGES } from './actions.js';
import { readDegree } from '../playscape/destruct/breakability.js';

/** The coarse dials: a hero's starting health and power, the price unit, and the xp curve's growth per level. */
export const SCALE = Object.freeze({ hp: 100, power: 10, cost: 1, curve: 1.5 });
/** The level each stage's epoch is reached at; the first stage laid out is where the hero starts. */
export const EPOCH_LEVEL = Object.freeze({ early: 1, mid: 5, late: 10 });
/** How a power is gained, by the system's kind (actions.js SYSTEM_KINDS). */
export const GAINED = Object.freeze({
  unlock: { cost: false, why: 'found in the world: a pickup buys it, free' },
  resource: { cost: true, why: 'bought with the points each level gives' },
  transform: { cost: true, why: 'bought with the points each level gives; each epoch is a form that raises power' },
  stamina: { cost: false, why: 'learned, not bought: the upgrades are sparse offers at a rest' },
  equip: { cost: false, why: 'opened by the item that serves it' },
});
/** What equipping a class raises. */
export const GEAR_STAT = Object.freeze({ dagger: 'speed', sword: 'power', greatsword: 'power', staff: 'power', bow: 'power', shield: 'guard' });
/** How much each tier adds, by the stat it raises. */
export const GEAR_BY = Object.freeze({ power: [2, 3, 5], guard: [2, 3, 5], speed: [0.05, 0.05, 0.1] });
/** Systems whose gear and upgrades are bought as offers with a currency, not grown on the tree. */
const OFFERED = Object.freeze(['stamina', 'equip']);
/** Who carries the stats: the player world's pilot (playscape/player.js), so a bound stat (hp) reaches its body. */
export const HOLDER = 'hero';
/** The keys: the status page, and the powers in the page's order (1 … 9). */
export const KEYS = Object.freeze({ status: 'i', powers: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] });

const ID = /^[a-z][a-z0-9-]*$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const fail = (m) => new Error(`mechanics: ${m}`);
const r2 = (x) => Math.round(x * 100) / 100;
const STATS_LISTS = ['holders', 'stats', 'resources', 'epochs', 'tree', 'offers'];

/** Read a world's mechanics and say what is wrong. The numbers are judged by the stats kernel once laid over. */
export function readMechanics(M) {
  if (!isObj(M)) throw fail('mechanics is { stats?, scale?, powers?, hud?, ui?, gear?, destruction? }: the game\'s systems, derived from the hero\'s actions');
  for (const k of Object.keys(M)) if (!['stats', 'scale', 'powers', 'hud', 'ui', 'gear', 'destruction'].includes(k)) throw fail(`${k} is not part of the mechanics (stats, scale, powers, hud, ui, gear, destruction)`);
  const out = {};
  if (M.destruction !== undefined) out.destruction = readDegree(M.destruction, 'mechanics.destruction');
  if (M.stats !== undefined) {
    if (!isObj(M.stats)) throw fail('stats is { <play.stats fields> }: holders, stats, resources, level, epochs, tree, offers, bodies');
    out.stats = M.stats;
  }
  if (M.scale !== undefined) {
    if (!isObj(M.scale)) throw fail(`scale is { ${Object.keys(SCALE).join(', ')} }`);
    for (const [k, v] of Object.entries(M.scale)) {
      if (!(k in SCALE)) throw fail(`scale.${k} is not a dial (${Object.keys(SCALE).join(', ')})`);
      if (!(num(v) && v > 0) || (k === 'curve' && v < 1)) throw fail(`scale.${k} is a number above 0${k === 'curve' ? ', 1 or more' : ''}`);
    }
    out.scale = { ...M.scale };
  }
  // a power's own numbers over the derived: what it spends of the resource (0: free, a guard that costs nothing)
  if (M.powers !== undefined) {
    if (!isObj(M.powers)) throw fail('powers is { <power id>: { spends } }: what a power spends of the resource, over the derived');
    out.powers = {};
    for (const [id, p] of Object.entries(M.powers)) {
      if (!isObj(p)) throw fail(`powers.${id} is { spends }`);
      for (const k of Object.keys(p)) if (k !== 'spends') throw fail(`powers.${id}.${k} is not a power's number (spends)`);
      if (p.spends !== undefined && !(num(p.spends) && p.spends >= 0)) throw fail(`powers.${id}.spends is a number, 0 or more (0: the power is free)`);
      out.powers[id] = { ...p };
    }
  }
  if (M.hud !== undefined) {
    if (M.hud !== 'derive' && M.hud !== false && !Array.isArray(M.hud)) throw fail('hud is \'derive\' (the default), false, or a list of play.parts');
    if (Array.isArray(M.hud)) M.hud.forEach((p, i) => readPart(p, i));
    out.hud = M.hud;
  }
  if (M.ui !== undefined) {
    if (!(M.ui === 'propose' || M.ui === 'auto' || isObj(M.ui))) throw fail('ui is \'propose\', \'auto\', or a stored play.ui direction');
    out.ui = M.ui;
  }
  if (M.gear !== undefined) {
    if (!isObj(M.gear)) throw fail(`gear is { <class>: { stat?, by? } } (${EQUIPMENT_ITEMS.join(', ')})`);
    out.gear = {};
    for (const [cls, g] of Object.entries(M.gear)) {
      if (!EQUIPMENT_ITEMS.includes(cls)) throw fail(`gear.${cls}: not a class of gear (${EQUIPMENT_ITEMS.join(', ')})`);
      if (!isObj(g)) throw fail(`gear.${cls} is { stat?, by?: [early, mid, late] }`);
      for (const k of Object.keys(g)) if (!['stat', 'by'].includes(k)) throw fail(`gear.${cls}.${k} is not part of a class's gives (stat, by)`);
      if (g.stat !== undefined && !(typeof g.stat === 'string' && ID.test(g.stat))) throw fail(`gear.${cls}.stat is a stat's id`);
      if (g.by !== undefined && !(Array.isArray(g.by) && g.by.length === STAGES.length && g.by.every(num))) throw fail(`gear.${cls}.by is three numbers, what each tier adds (${STAGES.join(', ')})`);
      out.gear[cls] = { ...g };
    }
  }
  return out;
}

/** A play.stats list laid over another by id: the creator's entry replaces the derived one, a new one is added. */
function overList(derived = [], own, at, ledger) {
  const out = derived.map((x) => ({ ...x }));
  for (const x of own) {
    const xid = isObj(x) ? x.id : x, i = out.findIndex((y) => (isObj(y) ? y.id : y) === xid);
    ledger.push({ scope: 'mechanics', at: `${at}.${xid}`, key: String(xid), world: i >= 0 ? 'derived' : 'none', local: 'own' });
    if (i >= 0) out[i] = x; else out.push(x);
  }
  return out;
}

/**
 * The play block the loop calls for: `{ play: { stats, parts?, cues?, menus?, ui }, inputs, legend, powers, reasons, ledger,
 * open, limits }`; `open` is what the creator can settle, `limits` what the runtime cannot do yet.
 * `book` carries the resolved actions (`actions`), the equipment table (`equipment`) and the adornment (`adornment`, or
 * null); a world with no mechanics has none (null). Throws only when the creator's own numbers are refused by the
 * stats kernel (its words quoted); what the derivation cannot place goes to `open`.
 */
export function resolveMechanics(G, { actions, equipment, adornment = null }) {
  if (!G.mechanics) return null;
  const M = G.mechanics, S = { ...SCALE, ...(M.scale || {}) }, reasons = [], open = [], ledger = [];
  const seed = actions.mechanicsSeed, kind = seed.system?.kind ?? null;
  if (!kind) open.push('no power system on the actions page: powers are bought with points, as a resource system\'s are');
  const gained = GAINED[kind ?? 'resource'], offered = OFFERED.includes(kind);
  const stages = seed.stages.map((s) => s.stage);
  if (!stages.length) open.push('no stage is laid out: the stats have no epochs, and every power is had from the start');
  const stageOf = new Map(), stageIx = (s) => Math.max(0, stages.indexOf(s));
  for (const s of seed.stages) for (const g of s.gains) if (!stageOf.has(g)) stageOf.set(g, s.stage);

  // the core: health on the body, power behind every blow, guard against them
  const gearRows = equipment.rows.filter((r) => r.build).map((r) => ({ ...r, stat: M.gear?.[r.class]?.stat ?? GEAR_STAT[r.class], by: M.gear?.[r.class]?.by ?? GEAR_BY[M.gear?.[r.class]?.stat ?? GEAR_STAT[r.class]] ?? [1, 1, 1] }));
  const stats = [{ id: 'hp', base: S.hp, min: 1 }, { id: 'power', base: S.power, min: 0 }, { id: 'guard', base: r2(S.power / 2), min: 0 }];
  reasons.push(`hp ${S.hp}, power ${S.power}, guard ${r2(S.power / 2)}: the core every hero carries (scale: hp, power)`);
  for (const r of gearRows) if (!stats.some((x) => x.id === r.stat)) { stats.push({ id: r.stat, base: r.stat === 'speed' ? 1 : 0, min: 0 }); reasons.push(`${r.stat}: the ${r.class} raises it`); }

  const resources = [], resOf = seed.system?.resource ? seed.system.resource.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null;
  const res = resOf && ID.test(resOf) && !stats.some((x) => x.id === resOf) ? resOf : null;
  if (resOf && !res) open.push(`the system's resource '${seed.system.resource}' cannot be a resource id beside the stats: name it otherwise`);
  if (res) { resources.push({ id: res, start: 100 * S.cost, cap: 100 * S.cost }); reasons.push(`${res}: the system's resource, what the powers spend (cap ${100 * S.cost})`); }
  // what is bought with: coin for offers; points for the tree, when a power or a gear tier costs (an unlock costs nothing)
  const treeCosts = gained.cost || (gearRows.length > 0 && kind !== 'unlock');
  const currency = offered ? 'coin' : treeCosts ? 'points' : null;
  if (currency) { resources.push({ id: currency, start: 0 }); reasons.push(`${currency}: ${offered ? 'what offers are bought with' : 'what each level gives, to buy the tree with'}`); }

  const last = stages.length ? stages[stages.length - 1] : 'early';
  const level = {
    start: 1, max: Math.max(2, EPOCH_LEVEL[last]), xp: { base: 100, growth: S.curve },
    each: { raise: { hp: r2(S.hp / 10), power: 1 }, ...(currency === 'points' ? { grant: { points: S.cost } } : {}) },
  };
  reasons.push(`levels 1 to ${level.max}: ${level.xp.base} xp to the first, each next ${S.curve} × the last; each level raises hp ${r2(S.hp / 10)} and power 1${currency === 'points' ? `, and gives ${S.cost} point` : ''}`);
  const epochs = stages.map((st, i) => (i === 0 ? { id: st } : { id: st, level: EPOCH_LEVEL[st] }));
  if (stages.length) reasons.push(`epochs ${stages.map((st, i) => (i ? `${st} at level ${EPOCH_LEVEL[st]}` : `${st} (the start)`)).join(', ')}: the stages of the escalation`);
  if (kind === 'transform') {
    level.at = Object.fromEntries(stages.slice(1).map((st) => [String(EPOCH_LEVEL[st]), { raise: { power: r2(S.power / 2) } }]));
    if (stages.length > 1) reasons.push(`each form after the first raises power ${r2(S.power / 2)} (transform)`);
  }

  // the powers: one node each, in the epoch of the stage that gains it
  const servedBy = new Map();
  for (const it of adornment?.items ?? []) for (const p of it.serves) if (!servedBy.has(p)) servedBy.set(p, it.build.item);
  const firstGear = (cls) => (stages.length ? `${cls}-${stages[0]}` : null);
  const tree = [], offers = [];
  for (const v of seed.verbs) {
    if (stats.some((x) => x.id === v.id) || resources.some((x) => x.id === v.id) || stages.includes(v.id)) { open.push(`power '${v.id}' shares its name with a stat, a resource or a stage: rename it to put it on the tree`); continue; }
    const st = stageOf.get(v.id) ?? stages[0], node = { id: v.id, ...(st ? { epoch: st } : {}) };
    if (gained.cost) node.cost = { points: S.cost * (stageIx(st) + 1) };
    const cls = kind === 'equip' ? servedBy.get(v.id) : null;
    // an equip system opens a power by the item that serves it; a power the body carries needs none
    if (kind === 'equip' && !adornment?.bodily.includes(v.id)) {
      if (cls && gearRows.some((r) => r.class === cls) && firstGear(cls)) node.requires = { has: firstGear(cls) };
      else open.push(`power '${v.id}': no item on the equipment table serves it, so nothing opens it`);
    }
    tree.push(node);
    reasons.push(`${v.id} (${st ?? 'from the start'}): ${gained.why}${node.cost ? ` (${node.cost.points} point${node.cost.points === 1 ? '' : 's'})` : ''}${node.requires ? `, by ${node.requires.has}` : ''}`);
  }

  // the gear: each filled class, one tier per stage, each raising its stat
  for (const r of gearRows) {
    stages.forEach((st, i) => {
      const gid = `${r.class}-${st}`, gives = { raise: { [r.stat]: r.by[STAGES.indexOf(st)] } }, prev = i ? `${r.class}-${stages[i - 1]}` : null;
      if (offered) offers.push({ id: gid, cost: { coin: 10 * S.cost * (i + 1) }, gives, ...(i ? { requires: { all: [{ epoch: st }, { has: prev }] } } : {}), max: 1 });
      else tree.push({ id: gid, epoch: st, ...(kind !== 'unlock' ? { cost: { points: S.cost * (i + 1) } } : {}), ...(prev ? { requires: { has: prev } } : {}), gives });
    });
    if (stages.length) reasons.push(`${r.class} (${r.status === 'seeded' ? r.from : 'the world\'s own'}): raises ${r.stat} by ${stages.map((st) => r.by[STAGES.indexOf(st)]).join(', ')} at ${stages.join(', ')}${offered ? ', bought with coin' : ''}`);
  }
  if (kind === 'stamina') {
    offers.push({ id: 'vigor', cost: { coin: 5 * S.cost }, gives: { raise: { hp: r2(S.hp / 10) } } }, { id: 'might', cost: { coin: 5 * S.cost }, gives: { raise: { power: 1 } } });
    reasons.push('vigor and might: the sparse upgrades, bought at a rest');
  }

  const derived = { holders: [HOLDER], stats, resources, level, epochs, tree, offers, bodies: { hpMax: 'hp' } };
  for (const k of ['resources', 'epochs', 'tree', 'offers']) if (!derived[k].length) delete derived[k];
  // the creator's numbers, over the derived: lists by id, the level and the bodies by key
  const own = M.stats ?? {}, statsOut = { ...derived };
  for (const [k, v] of Object.entries(own)) {
    if (STATS_LISTS.includes(k) && Array.isArray(v)) statsOut[k] = overList(derived[k], v, `mechanics.stats.${k}`, ledger);
    else if ((k === 'level' || k === 'bodies') && isObj(v)) {
      for (const f of Object.keys(v)) ledger.push({ scope: 'mechanics', at: `mechanics.stats.${k}.${f}`, key: f, world: derived[k]?.[f] ?? 'none', local: v[f] });
      statsOut[k] = { ...(derived[k] || {}), ...v };
    } else { statsOut[k] = v; ledger.push({ scope: 'mechanics', at: `mechanics.stats.${k}`, key: k, world: 'derived', local: 'own' }); }
  }
  try { readStats({ stats: statsOut }); } catch (e) { throw fail(`the stats, with the creator's own laid over: ${e.message}`); }

  // how each power is used: its key, what it spends, how it shows on the hero (its look; an attack with none, the look
  // of its element), and how hard it lands (carried until the powers have targets)
  const powers = seed.verbs.map((v, i) => {
    const ix = stageIx(stageOf.get(v.id)), p = actions.powers.find((x) => x.id === v.id) ?? {};
    const look = LOOKS[p.look] ? p.look : LOOKS[p.element?.toLowerCase()] ? p.element.toLowerCase() : null;
    return { id: v.id, ...(KEYS.powers[i] ? { key: KEYS.powers[i] } : {}), ...(res ? { spends: { [res]: 10 * S.cost * (ix + 1) } } : {}), ...(look ? { look } : {}), ...(p.attack ? { hurt: { stat: 'power', per: r2(1 + 0.2 * ix) } } : {}) };
  });
  for (const p of powers) if (!p.key) open.push(`power '${p.id}' has no key: only ${KEYS.powers.length} powers are on the keys`);
  // the creator's own spend over the derived, ledgered; a power the actions do not have is open, never thrown
  for (const [id, own] of Object.entries(M.powers ?? {})) {
    const p = powers.find((x) => x.id === id);
    if (!p) { open.push(`mechanics.powers.${id}: not a power of the hero's (${powers.map((x) => x.id).join(', ') || 'none'})`); continue; }
    if (own.spends === undefined) continue;
    ledger.push({ scope: 'mechanics', at: `mechanics.powers.${id}.spends`, key: id, world: p.spends?.[res] ?? 'none', local: own.spends });
    if (!res) { open.push(`mechanics.powers.${id}.spends: the system has no resource to spend`); continue; }
    if (own.spends === 0) delete p.spends; else p.spends = { [res]: own.spends };
  }
  // what the runtime cannot do yet: said on the page, never an advice the creator could act on
  const limits = ['a power fires on its key whether it has been gained or can be afforded: the bus has no such guard yet (the resource is held at 0)', 'how hard a power lands is carried as data: the powers have no targets yet', 'the HP bar is designed on the UI board: the page draws it once the body publishes its hp to the bus (only the piloted shooter does today)'];

  const play = { stats: statsOut, ui: M.ui ?? 'propose' };
  const hud = M.hud ?? 'derive';
  if (Array.isArray(hud)) play.parts = hud;
  else if (hud === 'derive') Object.assign(play, deriveHud(statsOut, res, epochs));
  // the keys: each power, and the status page when the HUD has one
  const inputs = [...powers.filter((p) => p.key).map((p) => ({ on: 'key', key: p.key, emit: { type: `power-${p.id}` } })), ...(play.menus ? [{ on: 'key', key: KEYS.status, emit: { type: 'status' } }] : [])];
  play.cues = [...(play.cues ?? []), ...powers.filter((p) => p.key).map((p) => ({
    id: `power-${p.id}`, when: { on: `power-${p.id}` },
    then: [...(p.spends ? [{ grant: { res, by: -p.spends[res] } }] : []), ...(p.look ? [{ status: { who: HOLDER, is: p.id, look: p.look, for: 1.5 } }] : []), { say: p.id, as: 'toast' }],
  })), ...(play.menus ? [{ id: 'open-status', when: { on: 'status' }, then: { open: 'status' } }] : [])];
  const legend = [...powers.filter((p) => p.key).map((p) => `${p.key} ${p.id}`), ...(play.menus ? [`${KEYS.status.toUpperCase()} status`] : [])].join(' · ');
  return { play, inputs, legend, powers, reasons, ledger, open, limits, ...(M.destruction ? { destruction: M.destruction } : {}) };
}

/** The readouts the systems call for, the banners on each level and epoch, and a status page of the stats. */
function deriveHud(stats, res, epochs) {
  const v = (k) => statVar(HOLDER, k), cap = stats.resources?.find((r) => r.id === res)?.cap;
  const parts = [
    // the bar's max is the hp stat itself, so it grows with every level
    { part: 'readout', id: 'hp', variant: 'bar', bind: { from: 'body', field: 'hp' }, at: 'bottom-left', label: 'HP', max: v('hp'), color: 'harm' },
    ...(res ? [{ part: 'readout', id: res, variant: 'bar', bind: { var: v(res) }, at: 'bottom-left', label: res.toUpperCase(), max: cap ?? 100 }] : []),
    { part: 'readout', id: 'level', variant: 'counter', bind: { var: v('level') }, at: 'top-left', label: 'LV' },
  ];
  const cues = [
    { id: 'level-up', when: { levelled: HOLDER }, then: { say: 'Level up', as: 'banner' } },
    ...epochs.slice(1).map((e) => ({ id: `epoch-${e.id}`, when: { epoch: e.id }, then: { say: `The ${e.id} stage`, as: 'banner' } })),
  ];
  const rows = [...stats.stats.map((s) => ({ label: s.id, var: v(s.id) })), ...(stats.resources ?? []).map((r) => ({ label: r.id, var: v(r.id) })), { label: 'level', var: v('level') }];
  return { parts, cues, menus: [{ id: 'status', kind: 'list', title: 'Status', rows }] };
}

/**
 * The tool call that realizes the systems while the world's levels are not yet minted as games: a `create_sketch` of a
 * player world (playscape/player.js, its pilot the stats' holder) with the hero (`heroRef`, the base the hero orders
 * mint), the play block, and the keys (`events.inputs`) the legend names, so the numbers can be played; the door
 * resolves its `play.ui` when it mints. `R` is resolveMechanics'. Null without it.
 */
export function mechanicsOrders(G, R, { heroRef = '<ref of the hero mint>' } = {}) {
  if (!R) return null;
  const W = playerWorld({ heroRef, id: HOLDER, title: `${G.name} · systems`, controls: `W / S  run · A / D  turn · Space  jump · ${R.legend}` });
  const events = { ...(W.events || {}), ...(R.inputs.length ? { inputs: [...(W.events?.inputs ?? []), ...R.inputs] } : {}) };
  return { tool: 'create_sketch', part: 'mechanics:stats', args: { title: `${G.name} · systems`, manifest: { ...W, events, play: R.play } } };
}
