/**
 * The table games' vocab card (get_game_vocab({ id: 'table-rpg' })): how create_game's `table_rpg` is written — the
 * rules cards and how a named game is written out as one, character creation, the starter, the module's grammar in
 * portable words, the book's styles — each list read from the table that defines it, so the card cannot drift from
 * what plays.
 */
import { TABLE_RPG_SYSTEMS, FACULTIES, DIFFICULTIES } from './table-rpg-systems.js';
import { TABLE_RPG_GAME_KEYS } from './table-rpg-manifest.js';
import { BOOK_PARTS } from './table-rpg-book.js';
import { STARTER_PARTY } from './table-rpg-starter.js';
import { BOOK_STYLES, BOOK_FORMATS, PAPERS } from '../book/book-style.js';
import { PROGRAM_IDS } from '../era/programs.js';
import { ROLES } from '../egocube/facets.js';

export function tableRpgCard() {
  const starters = Object.entries(TABLE_RPG_SYSTEMS).map(([id, c]) => `${id} (${c.about})`).join('; ');
  const body = [
    `create_game({ title, table_rpg: { ${TABLE_RPG_GAME_KEYS.join(', ')} } }): a pen-and-paper role-playing game played in text, every die rolled in the open; its own page (no store, no levels) at /api/sketches/<ref>/game, its game book at /api/sketches/<ref>/bible (?parts=party for the characters alone, ?style=<preset>), export_game writes the page, the book and its PDF. Not the live RPG: battles in a 3D field are design_game's.`,
    `- The quickest game: { starter: { use: <a building: ${PROGRAM_IDS.join(' | ')}>, town? }, system? }: a town, the road, the building as a dungeon (a loop, its goal locked and keyed, minions, the boss guarding the prize, a wandering table), the goal to bring the prize back. Every key the module writes itself wins over the starter's; edit in place with update_sketch.`,
    `- system: a rules starter, one per resolution procedure: ${starters}. Or a card written out (the same keys as a starter: abilities, names, faculties, generate, modifier, check, combat, foes by rank, hp, progression, classes, live, range, attribution?). A game the person names is never guessed: ask for its rules and write them out as a card.`,
    `- CHARACTER CREATION is the party: [{ id, name?, class? | role?, method?, assign?, scores?, level?, egocube? }], 1 to 6, rolled for this game only, each on its own dice. role: an egocube role (${Object.keys(ROLES).join(', ')}) played as the card's first class that takes it. method: the card's generate methods (rolled in order, rolled and placed by the class, an array, points bought: scores). egocube: true | { brief?, facets? } rolls who they are (a persona, a name when none, the role when none). No party: ${STARTER_PARTY.join(', ')} rolled for you. The answer says each sheet as rolled; the book prints a sheet a page.`,
    `- Each member rolled on the egocube is made a real character through the character loop when the game is minted (its egocube sheet and its body, as create_character { egocube } makes one; characters: false skips it), recorded as character: <ref>: revise it with update_character, walk it, export it. A member may name one already made: character: <ref>. The book photographs each character: the party lined up on the title page, each bust heading its sheet.`,
    `- Portable words, so one module plays under any card: a check's faculty (${FACULTIES.join(', ')}), a difficulty (${DIFFICULTIES.join(', ')}, or the card's own number), a foe's rank 1 (a minion) to 5 (a boss), a trap's harm as a rank or dice, a heal of some | all.`,
    `- world: { start, places: [{ id, name?, kind?: town | wild | landmark | dungeon, text?, dungeon? }], routes: [{ a, b, days?, danger?: <table> }] }: a point-crawl. dungeons: { <id>: { name?, entry, wander?: <table>, rooms: [{ id, name?, text?, foes?: [foe], items?: [item | { item, hidden: true }], trap?: { faculty, difficulty?, harm, text? }, search? }], links: [{ a, b, kind?: open | door | stair | locked | secret, key?, force?: <difficulty>, oneWay? }] } }. foes: { <id>: { name?, rank, text?, stats? } }. items: { <id>: { name?, kind?: key | treasure | heal, heal?, text? } }. tables: { <id>: { name?, die, rows: [{ on: n | [lo, hi], text, foes?, item? }] } }. beats: [{ id, at: <place> | <dungeon>/<room>, text, sets?, milestone? }]. goal: { item } | { room } | { place } | { cleared } | { flag }. hook, ending, seed.`,
    `- The checks advise, never refuse: a room no way reaches, a key behind its own lock, a lock with no key and no force, the goal out of reach, no loop, a place no road reaches.`,
    `- book: the game book's style: a preset (${Object.entries(BOOK_STYLES).map(([k, v]) => `${k}: ${v.reads}`).join('; ')}) or { style?, look?: <a presentation theme token>, format?: ${Object.keys(BOOK_FORMATS).join(' | ')}, paper?: ${Object.keys(PAPERS).join(' | ')}, faces?: { text, display, mono }, palette?: { paper, tint, ink, muted, rule, accent } }. Its chapters: ${BOOK_PARTS.join(', ')}; a one-sheet format keeps what the table needs in play.`,
    `- Played at the page: the moves offered as buttons and typed (look, go <room>, unlock, force, search, take, use, attack <foe>, flee, travel <place>, enter, leave, rest, check <faculty> [difficulty] [by <member>], roll <dice>, ask <question> [likely | even | unlikely], table <id>); the moves kept in the player's browser are the save.`,
  ].join('\n');
  return {
    id: 'table-rpg',
    name: 'Table games: a pen-and-paper RPG played in text, its characters rolled, its book printed',
    summary: 'create_game\'s table_rpg: a rules card, a party rolled from it, a world, dungeons, foes, tables; played in text and printed as a game book.',
    when: 'a tabletop RPG, a game master, roll for stats, a character sheet, a one-shot module, a dungeon to run at the table, a printable adventure',
    scope: 'rail',
    body,
  };
}
