/**
 * BATTLE LEVELS — a book whose battles are fought on boards (`battles.on: 'board'`): each stage that meets packs is a
 * tactics battle on its own ground, the whole level. The stage is laid as ever (its trail, its geocube or kit); its
 * `board` is the battle (board/board-scene.js boardOverWorld lays it over the stage when the level is made): the party
 * the book's (battles.js battleParty: the hero and the cast who join, each in a class, standing as their own stored
 * heroes), deployed on the board's near rows; the stage's packs the foes, in its far rows; the hero's fall the battle
 * lost. The level ends where the board says (the `board` mechanic), and the party and bag are carried as the party
 * battles carry them (the `party` and `bag` mechanics).
 *
 * The book's stages are an epoch's dots (board/board-map.js): its first level the epoch's map, a diorama in the first
 * stage's geocube, each stage a dot on it in story order, each dot's road opening when the dot before it is won; every
 * dot's level is left, when won, back to the map (its `map` exit), and the map is left by the dot the party walks to.
 *
 *   boardLevelOrder(G, stage, { ref, title, packs, figures?, seed?, exit? }) → { tool: 'create_sketch', args: { title, manifest } }
 *     figures: { <member id>: <stored hero ref> }; exit: the way the level is left when won (the map's);
 *     draw: true for a skirmish: no packs of its own, a pack drawn from the book's (weakest first) as the party stands
 *   mapLevelOrder(G, { ref, dots, geocube? }) → { tool: 'create_sketch', args: { title, manifest } }
 *     dots: [{ id, name, kind, ref, gate? }] (board-map.js's, each its level's ref)
 *   epochDots(stages, refs, battles, skirmish?) → dots   the stages as the epoch's dots: a stage that meets packs a battle,
 *     any other a story stop; each gated on the story dot before it. skirmish: { <stage index>: ref }, a skirmish dot after
 *     that stage's, open once it is won, fought again as often as the party likes
 *   skirmishStages(stages, battles) → [stage index]   where an area's skirmish stands: on the ground of its first battle
 *   BOARD_CAP   how many of the party fight a battle, unless the book's board says
 *   MAP_DOTS    the most dots one map holds (a longer book keeps its levels in a row, with no map)
 */
import { battleParty, PARTY_SLICE, BAG_SLICE, PACKS } from './battles.js';

export const BOARD_CAP = 4;
export const MAP_DOTS = 24;
export const MAP_SLICE = 'campaign';
const MAP_SIZE = { cols: 16, rows: 12 };
const MAX_FOES = 8;
const OWN = ['classes', 'skills', 'foes', 'items', 'gear'];

export function boardLevelOrder(G, stage, { ref, title, packs = [], figures = {}, seed = 1, exit = null, draw = false } = {}) {
  const B = G.battles ?? {}, opts = B.board ?? {};
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  const party = battleParty(G).map((p) => ({ id: p.id, class: p.class, name: p.name, ...['level', 'bonus', 'classes', 'gear'].reduce((o, k) => (p[k] !== undefined ? { ...o, [k]: p[k] } : o), {}), ...(figures[p.id] ? { figure: figures[p.id] } : {}) }));
  let n = 0;
  const foes = packs.flat().slice(0, MAX_FOES).map((foe) => ({ id: `foe-${++n}`, foe }));
  const own = Object.fromEntries(OWN.filter((k) => B[k] !== undefined).map((k) => [k, B[k]]));
  const battle = { party, ...(draw ? { draw: (B.packs ?? PACKS).map((p) => p.slice(0, MAX_FOES)) } : { foes }), deploy: 'near', cap: opts.cap ?? BOARD_CAP, seed: `${G.id}:${seed}`, rules: { lose: { leader: 'hero' }, ...(opts.rules ?? {}) }, ...(Object.keys(own).length ? { rpg: own } : {}) };
  const board = { ...(opts.cols !== undefined ? { cols: opts.cols } : {}), ...(opts.rows !== undefined ? { rows: opts.rows } : {}), battle };
  const game = { levelRef: ref, mechanics: [{ kind: 'board', ...(exit ? { exit } : {}) }, { kind: 'party', slice: PARTY_SLICE }, { kind: 'bag', slice: BAG_SLICE }] };
  return { tool: 'create_sketch', args: { title: name, manifest: { ...stage.manifest, title: name, board, game } } };
}

const dotId = (s) => `${s.level}-${s.index}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'dot';
const words = (s) => String(s).replace(/[-_]/g, ' ').replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function skirmishStages(stages, battles = []) {
  const seen = new Set();
  return stages.map((s, i) => i).filter((i) => battles[i]?.length && !seen.has(stages[i].level) && seen.add(stages[i].level));
}

export function epochDots(stages, refs, battles = [], skirmish = {}) {
  const seen = new Set(), out = [];
  const unique = (base) => { let id = base; for (let n = 2; seen.has(id); n++) id = `${base}-${n}`; seen.add(id); return id; };
  let story = null;
  stages.forEach((s, i) => {
    const d = { id: unique(dotId(s)), name: words(s.node === s.level ? s.level : s.node), kind: battles[i]?.length ? 'battle' : 'story', ref: refs[i], ...(story ? { gate: story } : {}) };
    out.push(d);
    story = d.id;
    if (skirmish[i]) out.push({ id: unique(`${dotId({ level: s.level, index: 'skirmish' })}`), name: `${words(s.level)} wilds`, kind: 'skirmish', ref: skirmish[i], gate: d.id });
  });
  return out;
}

export function mapLevelOrder(G, { ref, dots, geocube } = {}) {
  const name = `${G.name ?? G.id} · map`;
  const board = { from: 'blocks', side: 'outside', ...MAP_SIZE, seed: `${G.id}:map`, relief: 0.45, ...(geocube !== undefined ? { geocube } : {}) };
  const game = { levelRef: ref, mechanics: [{ kind: 'map', slice: MAP_SLICE, dots: dots.map((d) => d.id) }] };
  return { tool: 'create_sketch', args: { title: name, manifest: { kind: 'board', title: name, board, map: { dots }, game } } };
}
