/**
 * BATTLE LEVELS — a book whose battles are fought on boards (`battles.on: 'board'`): each stage that meets packs is a
 * tactics battle on its own ground, the whole level. The stage is laid as ever (its trail, its geocube or kit); its
 * `board` is the battle (board/board-scene.js boardOverWorld lays it over the stage when the level is made): the party
 * the book's (battles.js battleParty: the hero and the cast who join, each in a class, standing as their own stored
 * heroes), deployed on the board's near rows; the stage's packs the foes, in its far rows; the hero's fall the battle
 * lost. The level ends where the board says (the `board` mechanic), and the party and bag are carried as the party
 * battles carry them (the `party` and `bag` mechanics).
 *
 *   boardLevelOrder(G, stage, { ref, title, packs, figures?, seed? }) → { tool: 'create_sketch', args: { title, manifest } }
 *     figures: { <member id>: <stored hero ref> }
 *   BOARD_CAP   how many of the party fight a battle, unless the book's board says
 */
import { battleParty, PARTY_SLICE, BAG_SLICE } from './battles.js';

export const BOARD_CAP = 4;
const MAX_FOES = 8;
const OWN = ['classes', 'skills', 'foes', 'items', 'gear'];

export function boardLevelOrder(G, stage, { ref, title, packs = [], figures = {}, seed = 1 } = {}) {
  const B = G.battles ?? {}, opts = B.board ?? {};
  const name = title ?? `${G.name ?? G.id} · ${stage.level} · ${stage.node}`;
  const party = battleParty(G).map((p) => ({ id: p.id, class: p.class, name: p.name, ...['level', 'bonus', 'classes', 'gear'].reduce((o, k) => (p[k] !== undefined ? { ...o, [k]: p[k] } : o), {}), ...(figures[p.id] ? { figure: figures[p.id] } : {}) }));
  let n = 0;
  const foes = packs.flat().slice(0, MAX_FOES).map((foe) => ({ id: `foe-${++n}`, foe }));
  const own = Object.fromEntries(OWN.filter((k) => B[k] !== undefined).map((k) => [k, B[k]]));
  const battle = { party, foes, deploy: 'near', cap: opts.cap ?? BOARD_CAP, seed: `${G.id}:${seed}`, rules: { lose: { leader: 'hero' }, ...(opts.rules ?? {}) }, ...(Object.keys(own).length ? { rpg: own } : {}) };
  const board = { ...(opts.cols !== undefined ? { cols: opts.cols } : {}), ...(opts.rows !== undefined ? { rows: opts.rows } : {}), battle };
  const game = { levelRef: ref, mechanics: [{ kind: 'board' }, { kind: 'party', slice: PARTY_SLICE }, { kind: 'bag', slice: BAG_SLICE }] };
  return { tool: 'create_sketch', args: { title: name, manifest: { ...stage.manifest, title: name, board, game } } };
}
