/**
 * THE VIEW AS A FOLDER — the whole view written as static pages (html.js STATIC: flat, relative links), so it opens from
 * disk or an artifact host with no server: the games, each game and its levels' gates, each level with its page to play
 * (inlined: three.js and all, self-contained), every level, the characters and the rest. The slow work a server warms in
 * the background (a level's resolve for its still check and its page; a game's readout) is done here in turn, once.
 *
 *   exportView(dir, { play?: true, games?: [ref], log? }) → { dir, files: [path], levels: n, stills: { pass, fail, skip } }
 *     play   false: the level pages without their playable page (small, quick; the frame says it was left out)
 *     games  only these games and their levels (default: every game)
 *     log    (line) → void, a line a step
 *
 * The eyes stamp is not on a static page: it has nowhere to write until the person's decisions have a record of their own.
 */
import fs from 'node:fs';
import path from 'node:path';
import { STATIC } from './html.js';
import * as D from './data.js';
import * as V from './verify.js';
import { gamesPage, gamePage, levelPage, levelsPage, charactersPage, objectsPage } from './pages.js';

const LEFT_OUT = '<!doctype html><body style="font:15px system-ui;color:#9aa0a6;background:#000;display:grid;place-items:center;height:100vh;margin:0">This export was made without the levels\' playable pages.</body>';

export async function exportView(dir, { play = true, games: only = null, log = () => {} } = {}) {
  const to = STATIC, files = [], stills = { pass: 0, fail: 0, skip: 0 };
  const write = (rel, html) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); files.push(rel); };
  const all = D.games().filter((g) => !only || only.includes(g.ref));
  const { designGameHandler } = await import('@/lib/mcp/tools/design-game.js');
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');

  const levelOf = new Map(), stillOf = new Map();
  for (const g of all) {
    const G = D.gameOf(g.ref);
    if (!G) continue;
    const rows = {};
    for (const l of G.levels) {
      const r = D.row(l.ref);
      if (!r) { rows[l.ref] = { title: l.ref, gates: [{ id: 'stored', kind: 'machine', status: 'fail', says: 'the level is not in the store' }] }; continue; }
      log(`still: ${l.ref}`);
      const S = V.stillNow(r) ?? await V.still(r);
      V.recordStill(r, S); stillOf.set(l.ref, S); stills[S.status] += 1;
      levelOf.set(l.ref, { of: g.ref, level: l });
      rows[l.ref] = { title: r.title || l.ref, gates: V.gates(l, r, { still: S }) };
    }
    for (const c of G.characters) rows[c] = { title: D.row(c)?.manifest?.hero?.name || D.row(c)?.title || c };
    let readout = null;
    if (G.row.manifest?.kind === 'gameworld') { log(`readout: ${g.ref}`); try { readout = await designGameHandler({ ref: g.ref }); } catch { readout = null; } }
    write(to.game(g.ref), gamePage({ G, readout, rows, to }));
  }
  write(to.games, gamesPage(all, { to }));

  const levels = D.levels().filter((l) => !only || levelOf.has(l.ref));
  for (const l of levels) {
    const r = D.row(l.ref);
    if (!r) continue;
    const S = stillOf.get(l.ref) ?? V.stillNow(r) ?? await V.still(r);
    const { of = null, level = { ref: l.ref } } = levelOf.get(l.ref) ?? {};
    const mechanics = (r.manifest?.game?.mechanics ?? []).map((x) => x?.kind).filter(Boolean);
    write(to.level(l.ref), levelPage({ r, of, gates: V.gates(level, r, { still: S }), ends: S.ends ?? [], mechanics, to }));
    if (!play) { write(to.play(l.ref), LEFT_OUT); continue; }
    log(`page: ${l.ref}`);
    try { const { payload } = await resolveWorldScene(r); write(to.play(l.ref), emitThreeWorld({ ...payload, inline: true })); }
    catch (err) { write(to.play(l.ref), LEFT_OUT.replace('This export was made without the levels\' playable pages.', `The level's page could not be built: ${String(err?.message ?? err).split('\n')[0].replace(/[<&]/g, '')}`)); }
  }
  write(to.levels, levelsPage(levels, { to }));
  write(to.characters, charactersPage(D.characters().filter((c) => !only || c.games.length), { to }));
  write(to.objects, objectsPage(only ? [] : D.objects(), { to }));
  return { dir, files, levels: levels.length, stills };
}
