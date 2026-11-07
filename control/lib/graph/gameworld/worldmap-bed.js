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
 *   worldmapModelPage(world, made)  → the miniature as a greybox model on a plinth (level/worldmap-model.js), `model.html`
 *   worldmapBriefs(world, made)     → each segment's planning subtask as words (level/map-sketch.js), `briefs/<S>.md`
 *   approveSegment(world, S)        → the world with S's sketch approved
 *   crossings(made)                 → the walk round the world: each zone left by each of its gates once, in order
 *
 * scripts/worldmap.mjs serves the folder and walks it in headless Chrome.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { runSteps } from './runner.js';
import { gridEnds } from '../level/grid-ends.js';
import { worldmapView, worldmapHtml } from '../level/worldmap-view.js';
import { worldmapModelHtml } from '../level/worldmap-model.js';
import { readGrid } from '../level/grid.js';
import { readSketch, segmentBriefs, briefText } from '../level/map-sketch.js';

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
        // THE SKETCH (level/map-sketch.js): the level decided in miniature before it is built. The town is approved; the
        // fields and the keep are drafts; the woods not yet planned.
        sketch: {
          concept: {
            pitch: 'Reach the old keep before the bell tolls: out across the fields, past an ambush, up the switchback to its gate.',
            journey: [
              { id: 'set-out', say: 'Set out from the town square', kind: 'arrival', at: 'A' },
              { id: 'old-road', say: 'Follow the old road east across the fields', kind: 'traverse', at: 'B' },
              { id: 'ambush', say: 'Bandits spring an ambush from the rocks at the bend', kind: 'encounter', at: 'B' },
              { id: 'cache', say: 'A supply cache in the ruined barn', kind: 'find', at: 'B' },
              { id: 'shrine', say: 'A shrine hidden in the woods holds the keep\'s side key', kind: 'secret', at: 'C' },
              { id: 'switchback', say: 'Climb the switchback under the cliffs', kind: 'climb', at: 'D' },
              { id: 'warden', say: 'The warden waits at the keep\'s gate', kind: 'climax', at: 'D' },
            ],
          },
          segments: {
            A: {
              status: 'approved',
              ground: ['m m g', '. . .', 'g . m'], height: ['0 0 0', '0 0 0', '1 0 1'],
              marks: [{ at: [1, 1], kind: 'npc', say: 'The captain sends you out' }, { at: [1, 0], kind: 'rest', say: 'Home: save here' }],
            },
            B: {
              status: 'draft',
              ground: ['m m r', '. . r', 'm . c'], height: ['1 2 3', '0 0 1', '1 0 2'],
              marks: [{ at: [1, 1], kind: 'encounter', say: 'Bandits from the rocks at the bend', foes: { kind: 'bandit', count: 4 } }, { at: [0, 0], kind: 'loot', say: 'The ruined barn\'s cache', item: 'lantern' }],
              notes: 'Keep the bend open so the ambush reads from the road.',
            },
            D: {
              status: 'draft',
              ground: ['r . c', '. . c', 'r f c'], height: ['1 0 2', '0 1 3', '1 2 3'],
              marks: [{ at: [0, 1], kind: 'encounter', say: 'The warden and two guards at the gate', foes: { kind: 'guard', count: 3 } }, { at: [1, 1], kind: 'landmark', say: 'The keep\'s tower, seen from the fields' }, { at: [2, 2], kind: 'hazard', say: 'The cliff\'s edge' }],
            },
          },
        },
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
// (the world's first zoned level, its zone words left off: the whole map)
function zonedLevel(made) {
  const first = made.levels.find((l) => l.zone);
  if (!first) throw new Error('worldmap: the world has no zoned level to draw');
  const { zone: _z, apron: _a, ...level } = first.manifest.level;
  return level;
}
export function worldmapPage(world, made, { built = null } = {}) {
  // (each zone's walk its page: only the zones built, when the build was of some)
  const play = Object.fromEntries(made.levels.filter((l) => l.zone && (!built || built.includes(l.zone))).map((l) => [l.zone, `levels/${l.ref}.html`]));
  return worldmapHtml(worldmapView(zonedLevel(made), { title: world.name ?? world.id }), { play, model: 'model.html', brief: (S) => `briefs/${S}.md` });
}
/** Each segment's planning subtask (level/map-sketch.js segmentBriefs), as words: { <segment>: markdown }. */
export function worldmapBriefs(world, made) {
  const level = zonedLevel(made), G = readGrid(level.grid, 'level.grid');
  const B = segmentBriefs(G, readSketch(level.sketch, G.plan), { title: world.name ?? world.id });
  return Object.fromEntries(Object.entries(B).map(([S, b]) => [S, briefText(b)]));
}
/** The world with a segment's sketch approved (a new world: the one given is left as it is). */
export function approveSegment(world, S) {
  const id = Object.keys(world.levels).find((k) => world.levels[k].glyphs?.zoned);
  const g = world.levels[id].glyphs, seg = g.sketch?.segments?.[S];
  if (!seg) throw new Error(`worldmap: '${S}' has no sketch to approve (sketched: ${Object.keys(g.sketch?.segments ?? {}).join(', ') || 'none'})`);
  return { ...world, levels: { ...world.levels, [id]: { ...world.levels[id], glyphs: { ...g, sketch: { ...g.sketch, segments: { ...g.sketch.segments, [S]: { ...seg, status: 'approved' } } } } } } };
}
/** The world map as a greybox model on a plinth (level/worldmap-model.js): orbit it, a bookmark a zone. */
export const worldmapModelPage = (world, made, { cdn = false } = {}) => worldmapModelHtml(zonedLevel(made), { title: world.name ?? world.id, cdn });

/** Each segment's brief into `<dir>/briefs/<segment>.md`. */
export async function writeBriefs(world, made, outDir) {
  await fs.mkdir(path.join(outDir, 'briefs'), { recursive: true });
  for (const [S, text] of Object.entries(worldmapBriefs(world, made))) await fs.writeFile(path.join(outDir, 'briefs', `${S}.md`), text);
}

/** The world built to a folder: a page a zone, the play shell over them. */
export async function buildWorldmap(world, { ref = world.id, outDir, log = () => {}, only = null, cdn = false } = {}) {
  const [{ resolveWorldScene }, { emitThreeWorld }, { resolveGame }, { emitPlayShell }] = await Promise.all([
    import('../worlds/world-scene.js'), import('../scene/scene-three.js'), import('../game/game-resolve.js'), import('../game/play-shell.js'),
  ]);
  const made = worldmapGame(world, { ref });
  await fs.mkdir(path.join(outDir, 'levels'), { recursive: true });
  const pages = [];
  for (const L of made.levels) {
    // (`only`: the zones to build, the rest left as they are: a segment geocubed on its own)
    if (only && !only.includes(L.zone)) continue;
    let t = Date.now();
    const { payload } = await resolveWorldScene({ ref: L.ref, manifest: L.manifest });
    const buildMs = Date.now() - t;
    t = Date.now();
    // (`cdn`: three.js from the pinned CDN, the only form a page host running a CSP executes; else inlined)
    const html = emitThreeWorld({ ...payload, walk: true, hud: false, decollide: true, inline: !cdn, cdn, spin: false, wireframe: false });
    const emitMs = Date.now() - t;
    await fs.writeFile(path.join(outDir, 'levels', `${L.ref}.html`), html);
    const laws = payload.map?.laws ?? [];
    pages.push({ ref: L.ref, zone: L.zone, bytes: Buffer.byteLength(html), buildMs, emitMs, tiles: payload.map?.cells?.length ?? 0, laws, ...(payload.map?.sketch ? { sketch: payload.map.sketch } : {}) });
    const SK = payload.map?.sketch;
    if (SK) log(`zone ${L.zone}: the sketch of ${SK.approved.join(', ')} lowered (${SK.laid.height} tiles' heights, ${SK.laid.ground} tiles' ground, ${SK.laid.boulders} rocky paths, ${SK.marks.length} marks on this page)${SK.unlaid ? `; not laid: ${SK.unlaid.join('; ')}` : ''}`);
    log(`zone ${L.zone ?? '-'} (${L.ref}): ${payload.map?.cells?.length ?? '?'} tiles, built ${(buildMs / 1000).toFixed(1)} s, emitted ${(emitMs / 1000).toFixed(1)} s, ${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB; laws ${laws.filter((l) => !l.ok).map((l) => l.law).join(', ') || 'all hold'}`);
  }
  const byRef = new Map(made.levels.map((l) => [l.ref, l]));
  const resolved = resolveGame({ kind: 'game', ...made.game }, (r) => (byRef.has(r) ? { ref: r, manifest: byRef.get(r).manifest } : null), (r) => `levels/${r}.html`);
  const shell = emitPlayShell(resolved.manifest, resolved.levels, { playtest: true, startLevel: made.levels[0].ref });
  await fs.writeFile(path.join(outDir, 'index.html'), shell);
  await fs.writeFile(path.join(outDir, 'map.html'), worldmapPage(world, made, { built: only }));
  await fs.writeFile(path.join(outDir, 'model.html'), await worldmapModelPage(world, made, { cdn }));
  await writeBriefs(world, made, outDir);
  await fs.writeFile(path.join(outDir, 'worldmap.json'), JSON.stringify({ world, game: made.game, zones: made.zones, pages: pages.map(({ laws: _l, ...p }) => p) }, null, 1));
  return { dir: outDir, made, pages };
}
