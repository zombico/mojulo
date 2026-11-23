/**
 * THE VIEW'S PAGES — pure: data in, a whole HTML document out (html.js's page). The order is the work's: games first,
 * then a game's levels and its cast, a level (play it, its gates, the person's stamp), then every level, every
 * character, and every other thing. Machine gates and the eyes gate are always shown apart (docs/bicycles.md).
 * Every page takes `to`, the links it writes (html.js SERVED, the default, or STATIC for an export).
 *
 *   gamesPage(games, opts?) · gamePage({ G, readout?, rows, to? }) · levelPage({ r, of?, gates, ends, mechanics, to? })
 *   levelsPage(levels, opts?) · charactersPage(characters, opts?) · objectsPage(objects, opts?)
 */
import { page, esc, badge, SERVED } from './html.js';

const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const gateChips = (gs) => gs.map((g) => badge(g.status, `${g.kind === 'eyes' ? 'eyes' : g.id}: ${g.status}`)).join('');
const empty = (what) => `<p class="empty">${esc(what)}</p>`;

export function gamesPage(games, { to = SERVED } = {}) {
  const cards = games.map((g) => {
    const frames = g.made.filter((l) => l.frame).length, walked = g.made.filter((l) => l.walk?.verdict?.completable === true).length;
    return `<div class="card"><a class="t" href="${esc(to.game(g.ref))}">${esc(g.title)}</a>
      <div class="why">${esc([g.rail, g.size].filter(Boolean).join(' · ') || g.kind)}</div>
      <div>${g.levels.length} level${g.levels.length === 1 ? '' : 's'}${g.made.length ? ` · walked ${walked}/${g.made.length} · first frame ${frames}/${g.made.length}` : ''}</div></div>`;
  }).join('');
  return page({ to, title: 'Games', active: 'games', body: `<h1>Games</h1><p class="sub">Each game, its levels and what has proved them.</p>${cards ? `<div class="grid">${cards}</div>` : empty('No games yet. Ask your agent to make one.')}` });
}

export function gamePage({ G, readout = null, rows = {}, to = SERVED }) {
  const m = G.row.manifest || {}, title = m.name || G.row.title || G.row.ref;
  const posts = readout?.goalposts?.posts ?? [];
  const path = posts.length
    ? `<h2>From nothing to level 1 · ${readout.goalposts.met}/${readout.goalposts.of}</h2><table><tr><th>Goalpost</th><th>State</th><th>What it says</th></tr>${posts.map((p) => `<tr><td>${esc(p.id)}</td><td>${badge(p.status === 'met' ? 'pass' : p.status === 'partial' ? 'open' : 'skip', p.status)}</td><td class="why">${esc(p.says || '')}</td></tr>`).join('')}</table>`
    : m.kind === 'gameworld' ? '<h2>From nothing to level 1</h2><p class="why">The game\'s path has not been read yet.</p>' : '';
  const lv = G.levels.length
    ? `<table><tr><th>#</th><th>Level</th><th>Gates</th><th>What they say</th></tr>${G.levels.map((l, i) => {
      const gs = rows[l.ref]?.gates ?? [];
      return `<tr><td>${i + 1}</td><td>${link(to.level(l.ref), rows[l.ref]?.title || l.ref)}</td><td>${gateChips(gs)}</td><td class="why">${esc(gs.filter((g) => g.status === 'fail').map((g) => `${g.id}: ${g.says}`).join(' · '))}</td></tr>`;
    }).join('')}</table>`
    : empty('No levels made yet.');
  const cast = G.characters.length ? `<div class="grid">${G.characters.map((c) => `<div class="card">${link(to.character(c), rows[c]?.title || c)}</div>`).join('')}</div>` : empty('No characters made for it yet.');
  const sub = [m.rail?.from && `started from ${m.rail.from}`, m.rail?.size, G.game && `game ${G.game.ref}`].filter(Boolean).join(' · ');
  return page({ to, title, active: 'games', body: `<h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${path}<h2>Levels</h2>${lv}<h2>Cast</h2>${cast}` });
}

export function levelPage({ r, of = null, gates = [], ends = [], mechanics = [], to = SERVED }) {
  const title = r.title || r.ref;
  const machine = gates.filter((g) => g.kind === 'machine'), E = gates.find((g) => g.kind === 'eyes');
  const table = `<table><tr><th>Gate</th><th>State</th><th>What it says</th></tr>${machine.map((g) => `<tr><td>${esc(g.id)}</td><td>${badge(g.status, g.status)}</td><td class="why">${esc(g.says)}</td></tr>`).join('')}</table>`;
  // (the stamp needs somewhere to write: a served view posts it; a static page says how to give it until the page can
  // record a person's decision itself)
  const stamp = to.eyes
    ? `<form class="eyes" method="post" action="${esc(to.eyes(r.ref))}">
      <input type="text" name="note" placeholder="What you saw (optional)">
      <button name="verdict" value="it is the game">I played it: it is the game</button>
      <button name="verdict" value="not yet">Not yet</button></form>`
    : '<p class="why">Played it? Tell your agent whether it is the game, and what you saw.</p>';
  const eyes = `<p>${E ? badge(E.status, E.status) : ''} <span class="why">${esc(E?.says ?? '')}</span></p>${stamp}`;
  const contract = ends.length ? ends.map((e) => badge(e.end === 'success' ? 'pass' : 'fail', `${e.event} → ${e.end}`)).join('') : '<span class="why">no contract</span>';
  return page({ to, title, active: 'levels', body: `<h1>${esc(title)}</h1>
    <p class="sub">${esc(r.manifest?.kind ?? '')}${of ? ' · ' : ''}${of ? link(to.game(of), `in ${of}`) : ''}</p>
    <iframe src="${esc(to.play(r.ref))}" title="Play ${esc(title)}" loading="lazy"></iframe>
    <h2>How it ends</h2><p>${contract}</p>${mechanics.length ? `<p class="why">mechanics: ${esc(mechanics.join(', '))}</p>` : ''}
    <h2>Machine gates</h2>${table}
    <h2>Eyes</h2><p class="why">Only you can say whether this is the game you want to play.</p>${eyes}` });
}

export function levelsPage(levels, { to = SERVED } = {}) {
  const t = levels.length
    ? `<table><tr><th>Level</th><th>Kind</th><th>Game</th></tr>${levels.map((l) => `<tr><td>${link(to.level(l.ref), l.title)}</td><td>${esc(l.kind)}</td><td>${l.of ? link(to.game(l.of), l.of) : '<span class="why">on its own</span>'}</td></tr>`).join('')}</table>`
    : empty('No levels yet.');
  return page({ to, title: 'Levels', active: 'levels', body: `<h1>Levels</h1><p class="sub">Every level, a game's or on its own.</p>${t}` });
}

export function charactersPage(characters, { to = SERVED } = {}) {
  const cards = characters.map((c) => {
    const m = c.manifest || {}, name = m.hero?.name || c.title || c.ref;
    return `<div class="card" id="${esc(c.ref)}"><b>${esc(name)}</b><div class="why">${esc(m.kind)} · ${esc(c.ref)}</div>
      <div>${c.games.length ? `in ${c.games.map((g) => link(to.game(g), g)).join(', ')}` : '<span class="why">in no game yet</span>'}</div></div>`;
  }).join('');
  return page({ to, title: 'Characters', active: 'characters', body: `<h1>Characters</h1><p class="sub">Heroes, foes and figures, and the games they are in.</p>${cards ? `<div class="grid">${cards}</div>` : empty('No characters yet.')}` });
}

export function objectsPage(objects, { to = SERVED } = {}) {
  const t = objects.length
    ? `<table><tr><th>Thing</th><th>Kind</th></tr>${objects.map((o) => `<tr><td>${esc(o.title)}</td><td>${esc(o.kind)}</td></tr>`).join('')}</table>`
    : empty('Nothing else yet.');
  return page({ to, title: 'Objects', active: 'objects', body: `<h1>Objects</h1><p class="sub">Everything else: objects, worlds, views, sounds.</p>${t}` });
}
