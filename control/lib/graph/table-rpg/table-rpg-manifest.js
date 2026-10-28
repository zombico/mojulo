/**
 * THE TABLE GAME AS A RECIPE — a table RPG module (table-rpg-module.js) stored as a game row, the way a board game is
 * (tabletop/tabletop-manifest.js): `{ kind: 'game', engine: 'table-rpg', title, tableRpg }`, minted by create_game's
 * `table_rpg`, its play page and its game book regenerated from the keys on every read.
 *
 *   tableRpg: { <the module's keys: system, starter, party, world, dungeons, foes, items, tables, beats, goal, hook,
 *               ending, seed, title>, book?: <a book style: book/book-style.js>, characters?: false }
 *     characters: the party made real characters through the character loop when the game is minted (true unless
 *     false: create_game, lib/mcp/tools/table-rpg-portraits.js), each member's `character: <ref>` then written in
 *
 *   readTableRpg(tableRpg) → { K, module, checks, style }   throws, teaching (the module's, then the style's)
 *   buildTableRpgGameManifest({ title?, tableRpg }) → manifest   refuses a game that cannot play
 *   emitTableRpgGame(manifest, { title?, bookHref? }) → html      the play page (table-rpg-page.js)
 *   tableRpgBookOf(manifest, { title?, parts?, style?, portraits? }) → { html, findings }   the game book
 *     (table-rpg-book.js); parts narrows it (the party alone: its characters' sheets to print); portraits the members'
 *     photographs, taken by the caller (they need the characters' rows and a browser)
 *   tableRpgPaper(manifest, { style? }) → hex   the paper the book is printed on (a photograph is taken on it)
 *   tableRpgReadout(K, checks) → { party, factions?, findings }   what character creation made (each sheet as rolled,
 *     who wears it), the factions and their people by rank, and what the checks found (a faction's foe placed in no
 *     room and on no table among them): the mint's answer
 */
import { readModule, TABLE_RPG_KEYS } from './table-rpg-module.js';
import { tableRpgPageHtml } from './table-rpg-page.js';
import { tableRpgBook } from './table-rpg-book.js';
import { readBookStyle } from '../book/book-style.js';
import { tableSheetLines } from './table-rpg-kernel.js';

export const TABLE_RPG_GAME_KEYS = Object.freeze([...TABLE_RPG_KEYS, 'book', 'characters']);

export function readTableRpg(tableRpg) {
  if (!tableRpg || typeof tableRpg !== 'object' || Array.isArray(tableRpg)) throw new Error(`table rpg: table_rpg is { ${TABLE_RPG_GAME_KEYS.join(', ')} } (get_game_vocab({ id: 'table-rpg' }))`);
  for (const k of Object.keys(tableRpg)) if (!TABLE_RPG_GAME_KEYS.includes(k)) throw new Error(`table rpg: unknown key '${k}' (keys: ${TABLE_RPG_GAME_KEYS.join(', ')})`);
  const { book, characters, ...raw } = tableRpg;
  if (characters !== undefined && typeof characters !== 'boolean') throw new Error('table rpg: characters is true (the party made real characters, the default) or false');
  const { K, module, checks } = readModule(raw);
  const style = readBookStyle(book ?? 'tome');
  return { K, module, checks, style: book ?? 'tome', findings: style.findings };
}

export function buildTableRpgGameManifest({ title, tableRpg } = {}) {
  const { K } = readTableRpg(tableRpg);
  return { kind: 'game', engine: 'table-rpg', title: String(title ?? tableRpg.title ?? K.title), tableRpg };
}

const tableOf = (manifest) => {
  if (manifest?.engine !== 'table-rpg' || !manifest.tableRpg) throw new Error('not a table game (engine \'table-rpg\' with its `tableRpg` keys)');
  return manifest.tableRpg;
};

export function emitTableRpgGame(manifest, { title, bookHref } = {}) {
  const T = tableOf(manifest);
  const { module, style } = readTableRpg(T);
  return tableRpgPageHtml(module, { title: title ?? manifest.title, style, ...(bookHref ? { bookHref } : {}) });
}

export function tableRpgBookOf(manifest, { title, parts, style, portraits, foePortraits, itemPortraits } = {}) {
  const T = tableOf(manifest);
  const { K, style: own } = readTableRpg(T);
  if (title ?? manifest.title) K.title = title ?? manifest.title;
  return tableRpgBook(K, { style: style ?? own, ...(parts ? { parts } : {}), ...(portraits ? { portraits } : {}), ...(foePortraits ? { foePortraits } : {}), ...(itemPortraits ? { itemPortraits } : {}) });
}

export function tableRpgPaper(manifest, { style } = {}) {
  return readBookStyle(style ?? tableOf(manifest).book ?? 'tome').colours.paper;
}

export function tableRpgReadout(K, checks) {
  const lines = tableSheetLines(K, { party: K.party });
  const party = K.party.map((p, i) => ({
    id: p.id, name: p.name, class: p.class, sheet: lines[i], made: `${p.method}: ${p.rolls.join('; ')}`,
    ...(p.persona ? { persona: p.persona.reads } : {}),
  }));
  const placed = new Set([...Object.values(K.D).flatMap((D) => Object.values(D.rooms).flatMap((R) => R.foes ?? [])), ...Object.values(K.tables).flatMap((T) => T.rows.flatMap((r) => r.foes ?? []))]);
  const STAND = ['hostile', 'wary', 'neutral', 'friendly', 'allied'];
  const factions = Object.values(K.factions).map((F) => ({
    id: F.id, name: F.name, standing: STAND[(F.standing ?? 0) + 2],
    people: Object.entries(K.foes).filter(([, f]) => f.faction === F.id).sort(([, a], [, b]) => b.rank - a.rank)
      .map(([id, f]) => `${id}: ${f.name ?? id}, rank ${f.rank}${f.persona ? `, ${[f.persona.name !== f.name ? f.persona.name : null, f.persona.epithet].filter(Boolean).join(', ')}` : ''}${f.heeds?.length ? `; heeds ${f.heeds.join(', ')}` : ''}${f.scorns?.length ? `; scorns ${f.scorns.join(', ')}` : ''}`),
  }));
  const findings = [
    ...checks.world.findings.map((f) => ({ where: 'world', ...f })),
    ...Object.entries(checks.dungeons).flatMap(([id, c]) => c.findings.map((f) => ({ where: id, ...f }))),
    ...Object.entries(K.foes).filter(([id, f]) => f.faction && !placed.has(id)).map(([id, f]) => ({ where: 'factions', level: 'advice', text: `${f.name ?? id} (${id}, of ${K.factions[f.faction].name}) is in no room and on no table: place it, or leave it to the referee` })),
  ];
  return { party, ...(factions.length ? { factions } : {}), findings };
}
