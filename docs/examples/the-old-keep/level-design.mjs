// LEVEL DESIGN for a planned map's world, a block at a time (control/lib/graph/level/play-layer.js, play-brief.js):
//
//   node docs/examples/the-old-keep/level-design.mjs briefs <ref> <dir>        each block's brief, <dir>/<S>.md (and
//                                                                              <dir>/<S>.brief.json for the check)
//   node docs/examples/the-old-keep/level-design.mjs check <dir> <S> <file>    a designer's own check of one block's JSON
//   node docs/examples/the-old-keep/level-design.mjs laws <ref>                the play layer's laws on the built pages
//
// Reads the database at $MOJULO_DATA_DIR (the world `<ref>` and its first level, `<ref>-level-<level>-0`, made by a
// design_game run). Briefs and laws build each zone page as it plays (a minute or two each). The level's tickets (each
// block's suggestions with their authority) are the world's own: `levels.<level>.glyphs.play.<S>.suggestions`.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../control');
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href, import.meta.url);
const lib = (p) => import(pathToFileURL(path.join(control, 'lib/graph', p)).href);
const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'check') {
  const [dir, S, file] = args;
  const { readPlay, authorityLaws, OBSTACLES } = await lib('level/play-layer.js');
  const brief = JSON.parse(fs.readFileSync(path.join(dir, `${S}.brief.json`), 'utf8')), mine = JSON.parse(fs.readFileSync(file, 'utf8'));
  let Y;
  try { Y = readPlay({ [S]: { suggestions: brief.suggestions, ...mine } }, { size: 1, at: { [S]: true } })[S]; } catch (e) { console.log('REFUSED:', e.message); process.exit(1); }
  const [x0, y0, x1, y1] = brief.box, bad = [];
  for (const p of Y.pieces) {
    const [x, y] = p.at, r = p.kind === 'obstacle' || p.kind === 'cover' ? (Math.max(...OBSTACLES[p.of].size.slice(0, 2)) / 2) * (p.scale ?? 1) : 0.6;
    if (x < x0 || x > x1 || y < y0 || y > y1) bad.push(`${p.id}: outside the square`);
    const hit = brief.solid.find((c) => Math.abs(c.at[0] - x) < c.size[0] / 2 + r && Math.abs(c.at[1] - y) < c.size[1] / 2 + r);
    if (hit) bad.push(`${p.id}: overlaps the ${hit.of} at [${hit.at.join(', ')}]`);
  }
  console.log(bad.length ? `NO pieces: ${bad.join('; ')}` : `ok pieces: ${Y.pieces.length} in the square, clear of the solid things`);
  for (const l of authorityLaws(Y, { beats: brief.scenarioBeats ?? null, segment: S })) console.log(`${l.ok ? 'ok' : 'NO'} ${l.law}: ${l.value}`);
  process.exit(0);
}

if (cmd !== 'briefs' && cmd !== 'laws') { console.log('usage: briefs <ref> <dir> | check <dir> <S> <file> | laws <ref>'); process.exit(1); }
const [ref, dir] = args;
const data = process.env.MOJULO_DATA_DIR;
if (!data) { console.log('set MOJULO_DATA_DIR to the database\'s directory'); process.exit(1); }
const Database = (await import(pathToFileURL(path.join(control, 'node_modules/better-sqlite3/lib/index.js')).href)).default;
const db = new Database(path.join(data, 'mojulo-lite.db'), { readonly: true });
const row = (r) => { const x = db.prepare('select manifest_json from sketches where ref = ?').get(r); if (!x) throw new Error(`no row '${r}': run design_game({ ref: '${ref}', run: true }) first`); return JSON.parse(x.manifest_json); };
const { assembleGridScene } = await lib('level/grid-scene.js');
const { levelGrid, readSketch } = await lib('level/map-sketch.js');
const { readPlay } = await lib('level/play-layer.js');
const { playBrief } = await lib('level/play-brief.js');
const W = row(ref), [levelId, L0] = Object.entries(W.levels).find(([, l]) => l.glyphs?.plan);
const lvl0 = row(`${ref}-level-${levelId}-0`).level, glyphs = L0.glyphs;
const G = levelGrid({ ...lvl0, zone: undefined }), K = readSketch(glyphs.sketch, G.plan), Y = glyphs.play ? readPlay(glyphs.play, G.plan) : {};
// (the hero's kit, from the level's own rule: its run, its sprint, its jump; its moves said)
const rule = row(`${ref}-level-${levelId}-0`).entities?.[0]?.rule ?? {};
const kit = { run: rule.speed ?? 6, ...(rule.boostSpeed ? { sprint: rule.boostSpeed } : {}), ...(rule.jumpSpeed && rule.gravity ? { jump: Math.round((rule.jumpSpeed ** 2 / (2 * rule.gravity)) * 10) / 10 } : {}), moves: ['strike (click)', ...(rule.stamina ? ['sprint on stamina (F)'] : []), ...(rule.dodge ? ['dodge (F F)'] : []), 'lock on (C)', 'jump (Space)'], abilities: [] };
const roster = Object.fromEntries((L0.foes?.from ?? []).map((k) => [k, W.foes?.[k]?.class ?? '?']));
const zoned = glyphs.zoned === true ? Object.keys(G.plan.segments).map((s) => [s]) : [...glyphs.zoned, ...Object.keys(G.plan.segments).filter((s) => !glyphs.zoned.flat().includes(s)).map((s) => [s])];
if (dir) fs.mkdirSync(dir, { recursive: true });
for (const page of zoned) {
  const zone = page.length > 1 ? page : page[0];
  const P = await assembleGridScene({ level: { ...lvl0, zone, ...(glyphs.play ? { play: glyphs.play } : {}) } }, {});
  if (cmd === 'briefs') for (const S of page) {
    const B = playBrief({ segment: S, G, sketch: K, page: P, kit, roster, block: Y[S] ?? null, seed: lvl0.seed });
    fs.writeFileSync(path.join(dir, `${S}.md`), B.text);
    fs.writeFileSync(path.join(dir, `${S}.brief.json`), JSON.stringify({ box: B.box, solid: B.solid, beats: B.beats, suggestions: B.suggestions, scenarioBeats: glyphs.sketch?.scenario?.beats ?? null }));
    console.log(`${S}: ${B.solid.length} solid, ${B.beats.length} beats → ${path.join(dir, `${S}.md`)}`);
  }
  else for (const l of P.map.laws.filter((x) => ['pieces-fit', 'suggestions-kept', 'casting'].includes(x.law))) console.log(`${l.ok ? 'ok' : 'NO'} ${l.law}: ${l.value}`);
}
