/**
 * THE TABLE GAME AS A RECIPE — a table RPG module (table-rpg-module.js) stored as a game row, the way a board game is
 * (tabletop/tabletop-manifest.js): `{ kind: 'game', engine: 'table-rpg', title, tableRpg }`, minted by create_game's
 * `table_rpg`, its play page and its game book regenerated from the keys on every read.
 *
 *   tableRpg: { <the module's keys: system, starter, party, world, dungeons, foes, items, tables, beats, goal, hook,
 *               ending, seed, title>, book?: <a book style: book/book-style.js> }
 *
 *   readTableRpg(tableRpg) → { K, module, checks, style }   throws, teaching (the module's, then the style's)
 *   buildTableRpgGameManifest({ title?, tableRpg }) → manifest   refuses a game that cannot play
 *   emitTableRpgGame(manifest, { title?, bookHref? }) → html      the play page (table-rpg-page.js)
 *   tableRpgBookOf(manifest, { title?, parts?, style? }) → { html, findings }   the game book (table-rpg-book.js);
 *     parts narrows it (the party alone: its characters' sheets to print)
 *   tableRpgReadout(K, checks) → { party, findings }   what character creation made (each sheet as rolled, who wears
 *     it), and what the checks found: the mint's answer
 */
import { readModule, TABLE_RPG_KEYS } from './table-rpg-module.js';
import { tableRpgPageHtml } from './table-rpg-page.js';
import { tableRpgBook } from './table-rpg-book.js';
import { readBookStyle } from '../book/book-style.js';
import { tableSheetLines } from './table-rpg-kernel.js';

export const TABLE_RPG_GAME_KEYS = Object.freeze([...TABLE_RPG_KEYS, 'book']);

export function readTableRpg(tableRpg) {
  if (!tableRpg || typeof tableRpg !== 'object' || Array.isArray(tableRpg)) throw new Error(`table rpg: table_rpg is { ${TABLE_RPG_GAME_KEYS.join(', ')} } (get_game_vocab({ id: 'table-rpg' }))`);
  for (const k of Object.keys(tableRpg)) if (!TABLE_RPG_GAME_KEYS.includes(k)) throw new Error(`table rpg: unknown key '${k}' (keys: ${TABLE_RPG_GAME_KEYS.join(', ')})`);
  const { book, ...raw } = tableRpg;
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

export function tableRpgBookOf(manifest, { title, parts, style } = {}) {
  const T = tableOf(manifest);
  const { K, style: own } = readTableRpg(T);
  if (title ?? manifest.title) K.title = title ?? manifest.title;
  return tableRpgBook(K, { style: style ?? own, ...(parts ? { parts } : {}) });
}

export function tableRpgReadout(K, checks) {
  const lines = tableSheetLines(K, { party: K.party });
  const party = K.party.map((p, i) => ({
    id: p.id, name: p.name, class: p.class, sheet: lines[i], made: `${p.method}: ${p.rolls.join('; ')}`,
    ...(p.persona ? { persona: p.persona.reads } : {}),
  }));
  const findings = [
    ...checks.world.findings.map((f) => ({ where: 'world', ...f })),
    ...Object.entries(checks.dungeons).flatMap(([id, c]) => c.findings.map((f) => ({ where: id, ...f }))),
  ];
  return { party, findings };
}
