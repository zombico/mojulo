/**
 * THE WORLD MAP'S TEST BED — a zoned map (level/zones.js) made into a game you can walk, with no database, no design
 * loop and no people: the world's run steps (runner.js, a world before its people: each zone a level walked first
 * person) built straight to a folder of pages, the play shell over them. What it proves is the primitive: maps linked
 * at their borders, each loaded as it is walked into, the player set down where the gate crossed.
 *
 *   WORLDMAP_SAMPLE                 a 2 × 2 world of 3 × 3-tile zones: the town, the fields, the woods, the keep
 *   worldmapGame(world, { ref })    → { levels: [{ ref, title, zone, manifest }], game, zones: { <ref>: zone } } pure
 *   buildWorldmap(world, { ref, outDir, log? }) → { dir, pages: [{ ref, zone, bytes, buildMs, emitMs }] }
 *                                     writes `<dir>/index.html` (the shell), `<dir>/levels/<ref>.html` (a page a zone) and
 *                                     `<dir>/map.html` (the world map in miniature, worldmapPage)
 *   worldmapPage(world, made)       → the miniature: the world, a zone, a tile, drilled into (level/worldmap-view.js)
 *   crossings(made)                 → the walk round the world: each zone left by each of its gates once, in order
 *
 * scripts/worldmap.mjs serves the folder and walks it in headless Chrome.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { runSteps } from './runner.js';
import { gridEnds } from '../level/grid-ends.js';
import { worldmapView, worldmapHtml } from '../level/worldmap-view.js';

/** Four zones round a square: the walk town → fields → keep, the woods off it, joined to the town and the keep. */
export const WORLDMAP_SAMPLE = Object.freeze({
  id: 'worldmap-sample', name: 'The Four Fields', topology: 'interconnected', start: 'overworld',
  levels: {
    overworld: {
      glyphs: {
        tile: 24, zoned: true,
        plan: {
          size: 3, rows: ['A B', 'C D'], route: ['A', 'B', 'D'], joins: [['A', 'C'], ['C', 'D']],
          key: { A: { name: 'the town' }, B: { name: 'the fields', rise: 2 }, C: { name: 'the woods' }, D: { name: 'the keep', rise: 4, goal: { use: 'temple' } } },
        },
        segments: { A: { rows: ['. . .', 'h # #', '. # .'], key: { h: { use: 'dwelling' } } } },
      },
    },
  },
});

/** The game the world's run would make: its zone levels (each a world manifest) and the game over them. */
export function worldmapGame(world, { ref = world.id } = {}) {
  const steps = runSteps(world, { ref });
  const game = steps.find((s) => s.key === 'game');
  if (!game) throw new Error('worldmap: the world makes no game (is it a world before its people, with levels?)');
  const levels = steps.filter((s) => s.key.startsWith('level-')).map((s) => {
    const m = s.order.manifest, zone = m.level?.zone ?? null;
    return { ref: s.ref, title: s.order.title ?? s.ref, zone, manifest: m };
  });
  const zones = Object.fromEntries(levels.filter((l) => l.zone).map((l) => [l.ref, gridEnds(l.manifest.level).zone]));
  return { levels, game: game.order, zones };
}

/** Each zone left by each of its gates, in a walk that only ever leaves the zone it stands in. */
export function crossings(made) {
  const exitsOf = Object.fromEntries(made.game.levels.map((l) => [l.ref, l.exits ?? []]));
  const left = new Set(), out = [];
  let at = made.game.levels[0].ref;
  for (;;) {
    const fresh = exitsOf[at].find((e) => !left.has(`${at}>${e.id}`));
    // (nothing fresh here: on to a zone that still has a gate not crossed, by a gate already crossed)
    const e = fresh ?? exitsOf[at].find((x) => exitsOf[x.to].some((y) => !left.has(`${x.to}>${y.id}`)));
    if (!e) break;
    left.add(`${at}>${e.id}`);
    const zone = made.zones[at], way = zone.ways.find((w) => `gate-${w.side}` === e.id);
    out.push({ from: at, exit: e.id, to: e.to, at: way.exit, arrive: made.zones[e.to].ways.find((w) => w.to === zone.id).arrive });
    at = e.to;
    if (out.length > 64) break;
  }
  return out;
}

/** The world map in miniature (level/worldmap-view.js): its first zoned level drawn from its recipe, no page built, each
 * zone's walk its page in the folder. */
export function worldmapPage(world, made) {
  const first = made.levels.find((l) => l.zone);
  if (!first) throw new Error('worldmap: the world has no zoned level to draw');
  const { zone: _z, apron: _a, ...level } = first.manifest.level;
  const play = Object.fromEntries(made.levels.filter((l) => l.zone).map((l) => [l.zone, `levels/${l.ref}.html`]));
  return worldmapHtml(worldmapView(level, { title: world.name ?? world.id }), { play });
}

/** The world built to a folder: a page a zone, the play shell over them. */
export async function buildWorldmap(world, { ref = world.id, outDir, log = () => {} } = {}) {
  const [{ resolveWorldScene }, { emitThreeWorld }, { resolveGame }, { emitPlayShell }] = await Promise.all([
    import('../worlds/world-scene.js'), import('../scene/scene-three.js'), import('../game/game-resolve.js'), import('../game/play-shell.js'),
  ]);
  const made = worldmapGame(world, { ref });
  await fs.mkdir(path.join(outDir, 'levels'), { recursive: true });
  const pages = [];
  for (const L of made.levels) {
    let t = Date.now();
    const { payload } = await resolveWorldScene({ ref: L.ref, manifest: L.manifest });
    const buildMs = Date.now() - t;
    t = Date.now();
    const html = emitThreeWorld({ ...payload, walk: true, hud: false, decollide: true, inline: true, spin: false, wireframe: false });
    const emitMs = Date.now() - t;
    await fs.writeFile(path.join(outDir, 'levels', `${L.ref}.html`), html);
    const laws = payload.map?.laws ?? [];
    pages.push({ ref: L.ref, zone: L.zone, bytes: Buffer.byteLength(html), buildMs, emitMs, tiles: payload.map?.cells?.length ?? 0, laws });
    log(`zone ${L.zone ?? '-'} (${L.ref}): ${payload.map?.cells?.length ?? '?'} tiles, built ${(buildMs / 1000).toFixed(1)} s, emitted ${(emitMs / 1000).toFixed(1)} s, ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB; laws ${laws.filter((l) => !l.ok).map((l) => l.law).join(', ') || 'all hold'}`);
  }
  const byRef = new Map(made.levels.map((l) => [l.ref, l]));
  const resolved = resolveGame({ kind: 'game', ...made.game }, (r) => (byRef.has(r) ? { ref: r, manifest: byRef.get(r).manifest } : null), (r) => `levels/${r}.html`);
  const shell = emitPlayShell(resolved.manifest, resolved.levels, { playtest: true, startLevel: made.levels[0].ref });
  await fs.writeFile(path.join(outDir, 'index.html'), shell);
  await fs.writeFile(path.join(outDir, 'map.html'), worldmapPage(world, made));
  await fs.writeFile(path.join(outDir, 'worldmap.json'), JSON.stringify({ world, game: made.game, zones: made.zones, pages: pages.map(({ laws: _l, ...p }) => p) }, null, 1));
  return { dir: outDir, made, pages };
}
