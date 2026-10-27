/**
 * THE GAME BOOK — a table RPG module (table-rpg-module.js) set as a book by the press (book/book-press.js), for the
 * table and for print: a title page; how the rules run, in the card's own numbers; the world, its map and its places;
 * each dungeon, its map and its rooms keyed by the map's numbers; the foes as stat blocks; the tables to roll on; the
 * story's beats; the party's sheets, a page each, as rolled; the dice tape; the colophon. The same module and the same
 * style give the same page; headless Chromium prints it (book/book-pdf.js).
 *
 *   tableRpgBook(K, { style?, tape?, parts?, portraits?, foePortraits? }) → { html, findings }   style a book style
 *     (book/book-style.js: a preset's key or its parts; 'tome' when none); tape the dice tape's length (20; 0 leaves it
 *     out); parts the chapters to print, of BOOK_PARTS (['party']: the characters' sheets alone; factions when the module
 *     has them: their diagram, how talk and standing run, each faction's people by rank with who they are and what they
 *     listen to); portraits each member's photographs ({ <id>: { figure, bust } }, image URIs:
 *     lib/mcp/tools/table-rpg-portraits.js), the figures lined up on the title page and each bust heading its sheet
 *     (none: no picture, the sheet as it was); foePortraits the foes' ({ <foe id>: { figure, bust } }: the cast's
 *     leaders lined up in the Factions chapter, each bust in its entry; a foe of no faction, its bust over its stat
 *     block); findings the style's advice
 *   BOOK_PARTS   the chapters in their order
 */
import { bookHtml, esc, heading, para, aside, keyed, facts, statBlock, rollTable, grid, plate, mono, lines } from '../book/book-press.js';
import { readBookStyle } from '../book/book-style.js';
import { rulesDigest, foeRows } from './table-rpg-module.js';
import { roomNumbers, dungeonMapSvg, worldMapSvg, factionMapSvg } from './table-rpg-maps.js';
import { beastWords } from './table-rpg-cast.js';
import { tableTape, TABLE_RPG_FACULTIES, TABLE_RPG_STANDING, TABLE_RPG_TALK } from './table-rpg-kernel.js';

export const BOOK_PARTS = Object.freeze(['title', 'running', 'world', 'dungeons', 'foes', 'factions', 'tables', 'party', 'tape', 'colophon']);

const words = (s) => String(s).replace(/[-_]/g, ' ');
const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);

function goalWords(K) {
  const G = K.M.goal;
  if (G.item) return `bring back ${K.items[G.item]?.name ?? words(G.item)}`;
  if (G.place) return `reach ${K.places[G.place].name}`;
  if (G.room) return `reach ${words(G.room.split('/')[1])}`;
  if (G.cleared) return `clear ${words(G.cleared.split('/')[1])}`;
  return `see the story through (${G.flag})`;
}

function titlePage(K, portraits) {
  const line = K.party.filter((p) => portraits[p.id]?.figure);
  const party = K.party.map((p) => `${p.name} the ${p.className}`);
  return `<h1>${esc(K.title)}</h1>`
    + (K.M.hook ? `<p class="sub">${esc(K.M.hook)}</p>` : '')
    + `<p class="sub">An adventure for ${K.party.length === 1 ? 'one' : K.party.length} — ${esc(list(party))} — played by the ${esc(K.sys.name)} rules.</p>`
    + (line.length ? `<div class="lineup">${line.map((p) => `<figure><img src="${esc(portraits[p.id].figure)}" alt="${esc(p.name)}"><figcaption>${esc(p.name)}</figcaption></figure>`).join('')}</div>` : '')
    + '<p class="mark">a mojulo table game</p>';
}

function running(K) {
  const sys = K.sys, D = sys.check.difficulty;
  const out = [para(`${cap(sys.about)}.`, { drop: true }), para(rulesDigest(sys))];
  out.push(aside(`${esc(cap(goalWords(K)))}.`, { label: 'The goal' }));
  out.push(heading('Faculties', 3), para('A check names a faculty; the rules read it as one of their abilities.'));
  out.push(facts(TABLE_RPG_FACULTIES.map((f) => [f, sys.names?.[sys.faculties[f]] ?? sys.faculties[f]])));
  out.push(heading('Difficulty', 3), facts([['easy', D.easy], ['medium', D.medium], ['hard', D.hard]]));
  out.push(heading('Reading the maps', 3), para('Each room is numbered as the key numbers it. A line is a way through, a bar across it a door, three ticks a stair, a filled square a lock, a dashed line marked S a hidden way a search finds, an arrow a way that goes one way only. A cross marks foes.'));
  return out.join('');
}

function world(K) {
  const out = [plate(worldMapSvg(K), { caption: 'The world: each road with its days; a dashed road rolls its table each day', span: true })];
  const beats = (at) => (K.M.beats ?? []).filter((b) => b.at === at);
  Object.values(K.places).forEach((P, i) => {
    const roads = P.routes.map((r) => `${K.places[r.to].name} (${r.days} day${r.days === 1 ? '' : 's'}${r.danger ? `, roll ${K.tables[r.danger].name ?? words(r.danger)}` : ''})`);
    const body = (P.text ? para(P.text) : '')
      + facts([['kind', P.kind ?? 'place'], ...(roads.length ? [['roads', list(roads)]] : []), ...(P.dungeon ? [['within', K.D[P.dungeon].name]] : [])])
      + beats(P.id).map((b) => aside(esc(b.text), { label: 'On arrival' })).join('');
    out.push(keyed(String.fromCharCode(65 + i), cap(P.name), body));
  });
  return out.join('');
}

function exitWords(K, D, R, num) {
  return R.exits.map((e) => {
    const L = e.L, to = `${num[e.to]}, ${D.rooms[e.to].name}`;
    if (L.kind === 'locked') return `locked to ${to} (${[L.key ? K.items[L.key].name ?? words(L.key) : null, L.force ? `forced: a ${L.force} might check` : null].filter(Boolean).join('; or ')})`;
    if (L.kind === 'secret') return `hidden way to ${to} (a ${L.search ?? R.search ?? 'medium'} search finds it)`;
    return `${{ open: 'way', door: 'door', stair: 'stair' }[L.kind]} to ${to}${L.oneWay && L.b === e.to ? ' (one way)' : ''}`;
  });
}

function dungeon(K, D) {
  const num = roomNumbers(D), beats = (at) => (K.M.beats ?? []).filter((b) => b.at === at);
  const out = [plate(dungeonMapSvg(K, D.id), { caption: `${cap(D.name)}: the way in is ${num[D.entry]}, ${D.rooms[D.entry].name}`, span: true })];
  if (D.wander) out.push(aside(`Resting here, or a loud failure, rolls ${esc(K.tables[D.wander].name ?? words(D.wander))}.`, { label: 'Wandering' }));
  for (const R of Object.values(D.rooms)) {
    const rows = [];
    if (R.foes?.length) rows.push(['foes', list(R.foes.map((f) => K.foes[f].name ?? words(f)))]);
    if (R.items.length) rows.push(['here', list(R.items.map((x) => `${K.items[x.item].name ?? words(x.item)}${x.hidden ? ' (hidden)' : ''}`))]);
    if (R.trap) rows.push(['trap', `a ${R.trap.difficulty ?? 'medium'} ${R.trap.faculty} check, or harm`]);
    rows.push(['ways', list(exitWords(K, D, R, num))]);
    const body = (R.text ? para(R.text) : '')
      + (R.trap?.text ? aside(esc(R.trap.text), { label: 'Trap' }) : '')
      + facts(rows)
      + beats(`${D.id}/${R.id}`).map((b) => aside(esc(b.text), { label: 'On first entering' })).join('');
    out.push(keyed(num[R.id], cap(R.name), body));
  }
  return out.join('');
}

function foes(K, shots) {
  return Object.entries(K.foes).map(([id, F]) => (shots[id]?.bust && !F.faction ? `<img class="foe-bust" src="${esc(shots[id].bust)}" alt="${esc(F.name ?? id)}">` : '') + statBlock(cap(F.name ?? words(id)), foeRows(K, id), { note: `rank ${F.rank}${F.faction ? `, ${K.factions[F.faction].name}` : ''}${F.text ? `: ${F.text}` : ''}${F.beast ? ` (${beastWords(F.beast)})` : ''}` })).join('');
}

const ear = (F) => [F.heeds?.length ? `heeds ${list(F.heeds.map((t) => `a ${t === 'threaten' ? 'threat' : t}`))}` : null, F.scorns?.length ? `scorns ${list(F.scorns.map((t) => `a ${t === 'threaten' ? 'threat' : t}`))}` : null].filter(Boolean).join('; ');

function factions(K, shots) {
  const D = K.sys.check.difficulty, word = (n) => TABLE_RPG_STANDING[n + 2];
  const out = [plate(factionMapSvg(K), { caption: 'The factions: where each stands with the party at the start, and with each other', span: true })];
  // the cast's leaders as they stand, a square each: a beast is longer than it is tall
  const led = Object.entries(K.foes).filter(([id, f]) => f.faction && shots[id]?.figure).sort(([, a], [, b]) => b.rank - a.rank);
  if (led.length) out.push(`<div class="lineup cast">${led.map(([id, f]) => `<figure><img src="${esc(shots[id].figure)}" alt="${esc(f.persona?.name ?? f.name ?? id)}"><figcaption>${esc(f.persona?.name && f.persona.name !== f.name ? `${f.persona.name}, ${f.name}` : f.name ?? words(id))}</figcaption></figure>`).join('')}</div>`);
  out.push(para(`A fight with a faction's foes is spoken to through its leader, the highest-ranked of them standing. On a member's turn, once a fight, they may parley (${TABLE_RPG_TALK.parley}), threaten (${TABLE_RPG_TALK.threaten}) or bribe with a treasure (${TABLE_RPG_TALK.bribe}). A success and the foes stand aside, the room passed and their experience earned: a parley or a bribe raises the faction's standing a step, a threat lowers it. At a cost they stand aside and nothing changes, though a threatened leader strikes first. A failure and the fight goes on; a fumble lowers the standing too. Foes beaten lower their faction and its allies a step, and raise its rivals one.`));
  out.push(facts([['hostile', 'will not hear you'], ['wary', `hard (${D.hard})`], ['neutral', `medium (${D.medium})`], ['friendly', `easy (${D.easy})`], ['allied', 'they stand aside unasked']]));
  out.push(para('A leader who heeds a talk makes it a step easier; one who scorns it, a step harder.'));
  for (const F of Object.values(K.factions)) {
    const members = Object.entries(K.foes).filter(([, f]) => f.faction === F.id).sort(([, a], [, b]) => b.rank - a.rank);
    const rel = [...(F.allies.length ? [['allies', list(F.allies.map((a) => K.factions[a].name))]] : []), ...(F.rivals.length ? [['rivals', list(F.rivals.map((a) => K.factions[a].name))]] : [])];
    const body = (F.text ? para(F.text) : '') + facts([['at the start', word(F.standing ?? 0)], ...rel])
      + members.map(([id, f]) => {
        const P = f.persona, rel = P?.relation && !P.relation.startsWith('one of') ? `the ${P.relation}` : P?.relation;
        const who = [P?.name && P.name !== f.name ? P.name : null, rel].filter(Boolean).join(', ');
        const says = [who || null, P?.reads ? cap(P.reads) : null, ear(f) ? cap(ear(f)) : null].filter(Boolean);
        const leads = P?.relation ? ['mastermind', 'rival'].includes(P.relation) : f.rank === members[0][1].rank;
        return aside(`${shots[id]?.bust ? `<img class="bust" src="${esc(shots[id].bust)}" alt="">` : ''}<b>${esc(cap(f.name ?? words(id)))}</b>, rank ${f.rank}${says.length ? `: ${esc(says.join('. '))}.` : '.'}`, { label: leads ? 'Leads' : 'Serves' });
      }).join('');
    out.push(heading(cap(F.name), 3) + body);
  }
  return out.join('');
}

function tables(K) {
  return Object.entries(K.tables).map(([id, T]) => rollTable(T.die ?? '1d6', T.rows.map((r) => [Array.isArray(r.on) ? `${r.on[0]}–${r.on[1]}` : String(r.on), r.text]), { title: T.name ?? words(id) })).join('')
    + ((K.M.beats ?? []).length ? heading('Beats', 3) + facts(K.M.beats.map((b) => [words(b.at.includes('/') ? b.at.split('/')[1] : K.places[b.at]?.name ?? b.at), `${b.text}${b.milestone ? ' (a milestone)' : ''}`])) : '');
}

function sheet(K, p, portrait) {
  const sys = K.sys;
  const scores = sys.abilities.map((a) => [sys.names?.[a] ?? a, p.scores[a], sys.modifier.kind === 'none' ? undefined : signed(p.mods[a])]);
  // a short track is boxes to tick; a long one a number to keep
  const hp = sys.hp.kind === 'fixed' && p.maxHp <= 12 ? ['harm', `${'□'.repeat(p.maxHp)}`, `${p.maxHp} to take`] : ['hit points', `${p.maxHp}`, 'now: ____'];
  const vit = [hp, ...(sys.combat.defence === 'armour' ? [['defence', p.defence]] : []), ['level', p.level]];
  const w = p.weapon, ab = sys.abilities.includes(w.faculty) ? w.faculty : sys.faculties[w.faculty];
  const weapon = `${w.name}${w.dice ? `, ${w.dice}` : w.harm !== undefined ? `, harm ${w.harm}` : ''} (${sys.names?.[ab] ?? ab})`;
  const prog = sys.progression.kind === 'xp' ? ['experience', `0 of ${sys.progression.thresholds[1]} for level 2`] : sys.progression.kind === 'misses' ? ['marks', `○ `.repeat(sys.progression.at).trim()] : ['levels', 'at the story\'s milestones'];
  const who = heading(`${p.name}${p.persona?.epithet ? `, ${p.persona.epithet}` : ''}`, 3)
    + para(`${p.className} — ${sys.classes[p.class].about}.`)
    + (p.persona ? aside(esc(p.persona.reads), { label: 'Who they are' }) : '');
  return `<section class="page">${portrait?.bust ? `<div class="sheet-head"><img class="bust" src="${esc(portrait.bust)}" alt="${esc(p.name)}"><div>${who}</div></div>` : who}`
    + grid(scores) + grid(vit)
    + facts([['weapon', weapon], prog, ['made', `${p.method}: ${p.rolls.join('; ')}`]])
    + heading('Notes', 4) + lines(8) + '</section>';
}

export function tableRpgBook(K, { style = 'tome', tape = 20, parts, portraits = {}, foePortraits = {} } = {}) {
  if (parts !== undefined && !(Array.isArray(parts) && parts.length && parts.every((p) => BOOK_PARTS.includes(p)))) throw new Error(`table rpg book: parts are some of ${BOOK_PARTS.join(', ')}`);
  const S = readBookStyle(style);
  // a one-sheet format carries what the table needs in play: the title, the dungeons, the foes, the tables
  const keep = new Set(parts ?? (S.onePage ? ['title', 'dungeons', 'foes', 'tables'] : BOOK_PARTS));
  const chapters = [
    { id: 'title', kind: 'title', body: titlePage(K, portraits) },
    { id: 'running', title: 'Running the game', body: running(K) },
    { id: 'world', title: 'The world', body: world(K) },
    ...Object.values(K.D).map((D) => ({ id: `dungeon-${D.id}`, title: cap(D.name), body: dungeon(K, D) })),
    { id: 'foes', title: 'Foes', body: foes(K, foePortraits) },
    ...(Object.keys(K.factions).length ? [{ id: 'factions', title: 'Factions', body: factions(K, foePortraits) }] : []),
    ...(Object.keys(K.tables).length || (K.M.beats ?? []).length ? [{ id: 'tables', title: 'Tables', body: tables(K) }] : []),
    { id: 'party', title: 'The party', kind: 'pages', body: K.party.map((p) => sheet(K, p, portraits[p.id])).join('') },
    ...(tape ? [{ id: 'tape', title: 'The dice', body: para('Read in order, one die at a time: the game is fair and can be played again the same way.') + mono([20, 6, 10, 100].map((s) => `d${String(s).padEnd(3)} ${tableTape(K.seed, s, tape).map((v) => String(v).padStart(String(s).length)).join(' ')}`).join('\n')) }] : []),
    { id: 'colophon', title: 'Colophon', body: para(`Rules: the ${K.sys.name} card.${K.sys.attribution ? ` ${K.sys.attribution}` : ''}`) + para(`Set in ${list([...new Set(Object.values(S.faces))].map((f) => words(f)))}; the ${S.style} style, ${S.look} on ${S.paper}. Made with mojulo from the module's recipe: the same recipe prints the same book.`) },
  ];
  const part = (c) => (c.id.startsWith('dungeon-') ? 'dungeons' : c.id);
  return { html: bookHtml({ title: K.title, style, chapters: chapters.filter((c) => keep.has(part(c))) }), findings: S.findings };
}
