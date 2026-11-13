/**
 * SHOVELS & BUCKETS: THE CARD. A work sim (a kitchen, a farm, a site, a chore) is a set of stations that turn things into
 * other things, a crew that works them, and a demand that asks for what comes out. Each unit of labour is one of two kinds:
 *
 *   shovel   active processing: a worker's hands are on it for `work` seconds (chop the fish, plough the field, dig the
 *            trench, rake the roof). It may then run on its own for `wait` seconds (the pot cooks, the crop grows, the
 *            concrete mixes) while the worker is free. What it made sits `hold` seconds before it burns, rots or sets.
 *   bucket   passive sorting, to storage or to the next step: short, attention-light handling (fetch from the crate, take
 *            the rice off the hob, harvest the field, plate, bag the leaves, serve, carry down the ladder). A bucket
 *            station combines without processing; collecting a finished shovel and serving an order are always bucket work.
 *
 * Three families of levers tune it, and nothing else does:
 *
 *   capacity  crew.workers (hands), a station's `slots` (hobs, fields, mixers), an item's `store` (the shelf, the silo)
 *   output    a station's `batch` (what one run yields: a bigger pot, a wider plough, a blower), `work` (a better tool)
 *   demand    demand.every (seconds between orders), demand.patience (seconds an order waits), the order mix, the rush,
 *             demand.backlog (a chore's standing job)
 *
 * The card (a recipe of data, never code):
 *   {
 *     id, name?, why?,
 *     crew:     { workers? (1), travel? (1): seconds a hop between stations, foresight? (1): the player measured against,
 *                 0 answers open orders only, 1 makes ahead what the orders to come will want (sim.js) },
 *     items?:   { <item>: { fetch? (1): seconds to take one raw unit from its crate, store?: how many the shelf holds,
 *                           spoil?: seconds one keeps, prep?: how many the crew keeps made ahead } },
 *     stations: { <id>: { verb: 'shovel' | 'bucket', takes?: { <item>: n }, gives: { <item>: n } (one item: its batch),
 *                         work: seconds, wait?: seconds, hold?: seconds, slots? (1), far?: seconds more to reach it,
 *                         collect?: seconds to take its output off (the card's `collect`) } },
 *     collect?: seconds (1),
 *     demand:   { mode?: 'orders' | 'backlog', orders: [{ name?, wants: { <item>: n }, weight? (1) }],
 *                 every?: seconds between arrivals (orders: required; backlog: the regrowth, absent none),
 *                 patience?: seconds an order waits (orders: required; backlog: the session),
 *                 backlog?: orders standing at the start (backlog: required), serve? (1): seconds to hand one in,
 *                 far?: seconds more to reach the hand-in, cadence?: 'random' | 'steady', first? (2),
 *                 rush?: { period, length, factor }: for `length` seconds in every `period`, orders come `factor` times as often },
 *     session?: seconds (240),
 *     site?:    { up: metres, climb?: 'ladder' | 'rungs' | 'rope' | 'net' }: the line on a deck `up` metres high (a
 *               roof, a scaffold), the hand-in on the ground below, joined by a real climb (climbOf): its seconds both
 *               ways join demand.far, and a room lays the deck, the climb and the walk to it
 *   }
 *
 * An item no station gives is raw (taken from its crate as bucket work, never short). Every other item is given by one
 * station or by several: its ROUTES. The puzzle is never one solution; the card lays the situations where solutions are
 * found (land graded with a hoe or a leveller, to the degree of done the worker can and the job needs). The preferred
 * route is the one whose unit costs the least labour; the crew takes another when it is busy or its inputs are not
 * there. The recipes are a graph read from the orders down, never a loop.
 *
 *   readCard(card)   → the card with every default written (throws, teaching, on a malformed one)
 *                      { …, producer: { <item>: the preferred station }, producers: { <item>: [stations] },
 *                        routes: { <item>: [{ station, perUnit }] } for each item with more than one }
 *   producerOf(C)    → { <item>: <the preferred station> }
 *   isRaw(C, item)
 *
 * Pure, no dice.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const pos = (v) => Number.isFinite(v) && v > 0;
const nonneg = (v) => Number.isFinite(v) && v >= 0;
const posInt = (v) => Number.isInteger(v) && v >= 1;
const WORD = /^[a-z][a-z0-9-]{0,31}$/;
import { ladderParams, climbSurface, LADDER_VARIANTS } from '../playscape/objects/ladder.js';

/**
 * A site's climb (`site: { up, climb? }`): the line stands `up` metres over the ground on a deck (a roof, a scaffold),
 * the hand-in below it, the two joined by a climb (playscape/objects/ladder.js: a lean ladder by default, fixed rungs,
 * a rope or a net). One way's seconds: up its length at its speed, and the step off at the lip. → { up, climb, length,
 * speed, seconds }
 */
export function climbOf(site) {
  const p = ladderParams({ variant: site.climb, to: [0, 0, site.up], rise: site.up, facing: [0, 1] }), S = climbSurface(p);
  return { up: site.up, climb: site.climb, length: S.length, speed: p.speed, seconds: Math.round((S.length / p.speed + (p.mount ? 0.5 : 0)) * 1000) / 1000 };
}

export const VERBS = Object.freeze({
  shovel: 'active processing: the hands are on it for its work, then it may run alone (wait) and must be taken off before it burns (hold)',
  bucket: 'passive sorting to storage or the next step: fetch, collect, combine, plate, bag, carry, serve',
});

export const LEVERS = Object.freeze({
  capacity: ['crew.workers', 'stations.<id>.slots', 'items.<item>.store'],
  output: ['stations.<id>.batch', 'stations.<id>.work'],
  demand: ['demand.every', 'demand.patience', 'demand.orders (the mix)', 'demand.rush', 'demand.backlog'],
});

function counts(m, at, fail) {
  if (!isObj(m) || !Object.keys(m).length) fail(`${at} is { <item>: n }`);
  for (const [k, n] of Object.entries(m)) {
    if (!WORD.test(k)) fail(`${at}: '${k}' is not an item word (lower case, a-z 0-9 -)`);
    if (!posInt(n)) fail(`${at}.${k} is how many, a whole number from 1`);
  }
  return { ...m };
}

export function readCard(card) {
  const id = card?.id ?? 'worksim';
  const fail = (m) => { throw new Error(`worksim '${id}': ${m}`); };
  if (!isObj(card)) fail('the card is { id, crew, stations, demand, items?, collect?, session? }');
  const crew = { workers: 1, travel: 1, ...(card.crew ?? {}) };
  if (crew.foresight === undefined) crew.foresight = 1;
  if (!(Number.isFinite(crew.foresight) && crew.foresight >= 0 && crew.foresight <= 1)) fail('crew.foresight is the player measured against, 0 (answers open orders only) to 1 (makes ahead what is coming)');
  if (!posInt(crew.workers)) fail('crew.workers is how many hands, a whole number from 1');
  if (!nonneg(crew.travel)) fail('crew.travel is the seconds a hop between stations takes');
  const collect = card.collect ?? 1;
  if (!nonneg(collect)) fail('collect is the seconds taking a finished output off its station takes');

  if (!isObj(card.stations) || !Object.keys(card.stations).length) fail('stations is { <id>: { verb, takes?, gives, work, wait?, hold?, slots? } }');
  const stations = {};
  for (const [sid, s] of Object.entries(card.stations)) {
    const at = `stations.${sid}`;
    if (!WORD.test(sid)) fail(`${at}: a station id is one lower-case word`);
    if (!isObj(s)) fail(`${at} is { verb, takes?, gives, work }`);
    if (!VERBS[s.verb]) fail(`${at}.verb is shovel (${VERBS.shovel}) or bucket (${VERBS.bucket})`);
    const gives = counts(s.gives, `${at}.gives`, fail);
    if (Object.keys(gives).length !== 1) fail(`${at}.gives is one item and its batch ({ rice: 2 }): a station makes one thing`);
    const takes = s.takes === undefined ? {} : counts(s.takes, `${at}.takes`, fail);
    if (!nonneg(s.work)) fail(`${at}.work is the seconds the hands are on it`);
    const out = { verb: s.verb, takes, gives, item: Object.keys(gives)[0], batch: Object.values(gives)[0], work: s.work,
      wait: s.wait ?? 0, hold: s.hold ?? Infinity, slots: s.slots ?? 1, far: s.far ?? 0, collect: s.collect ?? collect };
    if (!nonneg(out.wait)) fail(`${at}.wait is the seconds it runs alone after the work`);
    if (!(out.hold === Infinity || nonneg(out.hold))) fail(`${at}.hold is the seconds its output keeps on the station`);
    if (s.hold !== undefined && !out.wait) fail(`${at}.hold needs a wait: only what runs alone is left on a station`);
    if (!posInt(out.slots)) fail(`${at}.slots is how many of it there are, a whole number from 1`);
    if (!nonneg(out.far) || !nonneg(out.collect)) fail(`${at}.far and .collect are seconds`);
    if (out.verb === 'bucket' && out.wait) fail(`${at}: a bucket does not run alone (wait): that is a shovel's`);
    if (out.takes[out.item]) fail(`${at}: a station cannot take what it gives`);
    stations[sid] = out;
  }

  // several stations may give one item: its ROUTES (a hoe or a leveller grades the land). The preferred is the one whose
  // unit costs the least labour (its work, its collect, its hop, its raw fetches, over its batch); the others are there to
  // be found, taken when the preferred is busy or out of reach
  const producers = {};
  for (const [sid, s] of Object.entries(stations)) (producers[s.item] ??= []).push(sid);
  const known = new Set([...Object.keys(producers), ...Object.values(stations).flatMap((s) => Object.keys(s.takes))]);

  const items = {};
  for (const k of known) {
    const p = card.items?.[k] ?? {};
    const it = { fetch: p.fetch ?? 1, store: p.store ?? Infinity, spoil: p.spoil ?? Infinity, prep: p.prep ?? 0 };
    if (!nonneg(it.fetch) || !(it.store === Infinity || posInt(it.store)) || !(it.spoil === Infinity || pos(it.spoil)) || !(Number.isInteger(it.prep) && it.prep >= 0)) {
      fail(`items.${k} is { fetch?: seconds, store?: a whole number, spoil?: seconds, prep?: a whole number }`);
    }
    items[k] = it;
  }
  for (const k of Object.keys(card.items ?? {})) if (!known.has(k)) fail(`items.${k}: no station takes or gives it`);
  const unitCost = (sid) => {
    const st = stations[sid], fetch = Object.entries(st.takes).reduce((t, [i, n]) => t + (producers[i] ? 0 : n * items[i].fetch), 0);
    return (st.work + (st.wait ? st.collect + crew.travel + st.far : 0) + crew.travel + st.far + fetch) / st.batch;
  };
  const producer = {};
  for (const [item, list] of Object.entries(producers)) producer[item] = list.reduce((a, b) => (unitCost(b) < unitCost(a) ? b : a));

  // a cycle in the recipes would make an item its own ingredient
  const seen = new Map();
  const walk = (item, path) => {
    if (seen.get(item) === 'done') return;
    if (seen.get(item) === 'open') fail(`the recipes loop: ${[...path, item].join(' ← ')}`);
    seen.set(item, 'open');
    for (const sid of producers[item] ?? []) for (const i of Object.keys(stations[sid].takes)) walk(i, [...path, item]);
    seen.set(item, 'done');
  };
  for (const k of known) walk(k, []);

  const D = card.demand;
  if (!isObj(D)) fail('demand is { mode?, orders, every?, patience?, backlog?, serve? }');
  const mode = D.mode ?? 'orders';
  if (!['orders', 'backlog'].includes(mode)) fail('demand.mode is orders (they come over time and wait a while) or backlog (a standing job to clear by the end)');
  if (!Array.isArray(D.orders) || !D.orders.length) fail('demand.orders is [{ wants: { <item>: n }, weight? }]');
  const orders = D.orders.map((o, j) => {
    const at = `demand.orders[${j}]`;
    if (!isObj(o)) fail(`${at} is { name?, wants, weight? }`);
    const wants = counts(o.wants, `${at}.wants`, fail);
    for (const k of Object.keys(wants)) if (!producer[k]) fail(`${at}.wants.${k}: no station gives it (an order asks for what is made)`);
    const weight = o.weight ?? 1;
    if (!pos(weight)) fail(`${at}.weight is how often it is asked for, relative to the others`);
    return { name: o.name ?? Object.keys(wants).join('+'), wants, weight };
  });
  const session = card.session ?? 240;
  if (!pos(session)) fail('session is the seconds one sitting runs');
  let site = null;
  if (card.site !== undefined) {
    const S = card.site;
    if (!isObj(S) || !(Number.isFinite(S.up) && S.up >= 0.6 && S.up <= 12)) fail('site is { up, climb? }: the line on a deck `up` metres over the ground (0.6 to 12), the hand-in below it');
    const climb = S.climb ?? 'ladder';
    if (!LADDER_VARIANTS[climb]) fail(`site.climb is ${Object.keys(LADDER_VARIANTS).join(', ')}`);
    site = climbOf({ up: S.up, climb });
  }
  // a site's climb is walked to every hand-in and back: its seconds both ways join the hand-in's reach
  const demand = { mode, orders, serve: D.serve ?? 1, far: (D.far ?? 0) + (site ? 2 * site.seconds : 0), cadence: D.cadence ?? 'random', first: D.first ?? 2,
    every: D.every ?? null, patience: D.patience ?? (mode === 'backlog' ? session : null), backlog: D.backlog ?? 0, rush: D.rush ?? null };
  if (!nonneg(demand.serve) || !nonneg(demand.far) || !nonneg(demand.first)) fail('demand.serve, .far and .first are seconds');
  if (!['random', 'steady'].includes(demand.cadence)) fail('demand.cadence is random (seeded arrivals) or steady (an even beat, a little jitter)');
  if (mode === 'orders') {
    if (!pos(demand.every)) fail('demand.every is the mean seconds between orders');
    if (!pos(demand.patience)) fail('demand.patience is the seconds an order waits before it walks out');
  } else {
    if (!posInt(demand.backlog)) fail('demand.backlog is the standing job: how many orders stand at the start');
    if (demand.every !== null && !pos(demand.every)) fail('demand.every is the regrowth: mean seconds between orders added (absent, none)');
  }
  if (demand.rush !== null) {
    const r = demand.rush;
    if (!isObj(r) || !pos(r.period) || !pos(r.length) || !(r.length <= r.period) || !(Number.isFinite(r.factor) && r.factor >= 1)) {
      fail('demand.rush is { period, length, factor }: for length seconds in every period, orders come factor (≥ 1) times as often');
    }
  }
  const routes = Object.fromEntries(Object.entries(producers).filter(([, l]) => l.length > 1).map(([item, l]) => [item, l.map((sid) => ({ station: sid, perUnit: Math.round(unitCost(sid) * 1000) / 1000 }))]));
  return { id, name: card.name ?? id, why: card.why ?? null, crew, collect, stations, items, demand, session, site, producer, producers, routes };
}

export const producerOf = (C) => C.producer;
export const isRaw = (C, item) => !C.producer[item];
