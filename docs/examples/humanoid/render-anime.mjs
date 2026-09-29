/** render-anime.mjs — the ANIME HEAD contact sheets (anime-head.js: the Anime Form Studio's head, worn by the hero).
 *   anime-heads-<preset>.png   rows: bald, then each hair family (bob, short, long) and the three poses (blink, smile,
 *                              open) on the base's own family; columns: front, three-quarter, lateral, back — one
 *                              camera per base, so a long family reads long, not re-framed
 *   anime-hero.png             both hero casts wearing the anime head (their own family), four views
 *   anime-looks-<preset>.png   every LOOK archetype on that base (anime-looks.js), four views
 *   anime-looks-compose.png    one look growing word by word (heroine → +tsurime → +peekaboo → +messy), front and ¾
 *   anime-looks-heroes.png     every archetype worn by a hero of each cast, front view (the tune's head and stature)
 *   anime-hair-fit-<preset>.png  the HAIR FIT (hair-passes): each studio family as the studio grew it beside the fit, then
 *                              hime and an ahoge; columns back, lateral, three-quarter, above — with the coverage ledger
 *                              (the scalp's share still showing per view) in anime-measures
 *   anime-hair-forms-<preset>.png  the HAIR FORMS: bob, long and hime as the studio's separate strands (`strands: 1`)
 *                              beside the consolidated sections, four views
 * with a measurements table (anime-measures.json / .md: the head's crown to chin, across the face, depth, between the
 * pupils, the eye opening; the hair's top above the crown, hem below the chin, reach behind the occiput). Diagnostic
 * renders for the eyes gate; nothing here is a recipe change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-anime.mjs [--face '<json>'] [--hair '<json>'] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { animeHead, describeAnimeHair, animeDefaultStyle } from '../../../control/lib/graph/polygonizer/anime-head.js';
import { ANIME_LOOKS, resolveLook, composeAnime } from '../../../control/lib/graph/polygonizer/anime-looks.js';
import { humanoidPlan } from '../../../control/lib/graph/polygonizer/humanoid-plan.js';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0928/spike-output/anime-form', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const arg = (k) => (process.argv.includes(k) ? JSON.parse(process.argv[process.argv.indexOf(k) + 1]) : undefined);
const face = arg('--face') ?? {}, hairArg = arg('--hair');
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const VIEWS = ['frontal', 'three-quarter', 'lateral', 'back'];

function render(mesh, palette, view, frame, framing) {
  const camera = Array.isArray(view) ? viewCamera(framing, view[0], { ...frame, elevationDegrees: view[1] }) : viewCamera(framing, view, frame), raster = rasterDepth(mesh, camera, frame.size * 2);
  const colours = mesh.faces.map((f, i) => {
    const [a, b, c] = f.map((k) => mesh.vertices[k]), n = unit(cross(sub(b, a), sub(c, a)));
    const light = 0.48 + 0.42 * Math.max(0, dot(n, key)) + 0.13 * Math.max(0, dot(n, fill));
    return hex(palette[mesh.groups[i]] || '#ff00ff').map((c) => Math.min(255, Math.round(c * light)));
  });
  const size = frame.size, rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const fi = raster.face[(y * 2 + dy) * size * 2 + x * 2 + dx], col = fi < 0 ? BG : colours[fi]; for (let k = 0; k < 3; k++) sum[k] += col[k]; }
    rgb.set(sum.map((c) => Math.round(c / 4)), (y * size + x) * 3);
  }
  return rgb;
}
function sheet(name, cells, columns, size) {
  const rows = Math.ceil(cells.length / columns), rgb = new Uint8Array(columns * size * rows * size * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set(BG, i);
  cells.forEach((cell, i) => { for (let y = 0; y < size; y++) rgb.set(cell.subarray(y * size * 3, (y + 1) * size * 3), ((Math.floor(i / columns) * size + y) * columns * size + (i % columns) * size) * 3); });
  writeFileSync(`${OUT}/${name}.png`, encodePng(Buffer.from(rgb), columns * size, rows * size));
}

const HEAD = { size: 300, focalPixels: 420, elevationDegrees: 4 }, table = [];
for (const preset of ['female', 'male']) {
  const framing = compileLayered(animeHead({ preset, face, hair: 'long' }));   // the longest family frames every row
  const rows = [['bald', { hair: 'none' }], ...['bob', 'short', 'long'].map((s) => [s, { hair: s }]), ...['blink', 'smile', 'open'].map((p) => [p, { expression: p }]), ...(hairArg ? [['--hair', { hair: hairArg }]] : [])];
  const cells = [];
  for (const [label, spec] of rows) {
    const head = animeHead({ preset, face, ...spec }), mesh = compileLayered(head);
    table.push({ preset, row: label, hair: head.hair.style === 'none' ? 'none' : describeAnimeHair(head.hair), ...head.measures, ...(head.hairMeasures ?? {}) });
    for (const view of VIEWS) cells.push(render(mesh, head.palette, view, HEAD, framing));
  }
  sheet(`anime-heads-${preset}`, cells, VIEWS.length, HEAD.size);
}
const HERO = { size: 360, focalPixels: 520, elevationDegrees: 6 }, heroCells = [];
for (const preset of ['female', 'male']) {
  const recipe = expandPlan(humanoidPlan({ preset, head: 'anime', face })), mesh = compileLayered(recipe);
  for (const view of VIEWS) heroCells.push(render(mesh, recipe.palette, view, HERO, mesh));
}
sheet('anime-hero', heroCells, VIEWS.length, HERO.size);
// the LOOKS: each archetype on each base; one look growing word by word; the archetypes on hero bodies
const lookHead = (preset, words) => { const e = composeAnime({ lookResolved: resolveLook(words), face, hair: { style: null, locks: {} } }, animeDefaultStyle(preset)); return { e, head: animeHead({ preset, face: e.face, hair: e.hair, expression: e.expression }) }; };
for (const preset of ['female', 'male']) {
  const framing = compileLayered(animeHead({ preset, face, hair: 'long' })), cells = [];
  for (const name of Object.keys(ANIME_LOOKS)) { const { head } = lookHead(preset, [name]), mesh = compileLayered(head); for (const view of VIEWS) cells.push(render(mesh, head.palette, view, HEAD, framing)); }
  sheet(`anime-looks-${preset}`, cells, VIEWS.length, HEAD.size);
}
{
  const framing = compileLayered(animeHead({ preset: 'female', face, hair: 'long' })), cells = [];
  for (const words of [['heroine'], ['heroine', 'tsurime'], ['heroine', 'tsurime', 'peekaboo'], ['heroine', 'tsurime', 'peekaboo', 'messy']]) { const { head } = lookHead('female', words), mesh = compileLayered(head); for (const view of ['frontal', 'three-quarter']) cells.push(render(mesh, head.palette, view, HEAD, framing)); }
  sheet('anime-looks-compose', cells, 2, HEAD.size);
}
{
  const cells = [], names = Object.keys(ANIME_LOOKS), BODY = { size: 280, focalPixels: 400, elevationDegrees: 6 };
  const tallest = compileLayered(expandPlan(humanoidPlan({ preset: 'male', head: 'anime', face, tune: { stature: 1 } })));
  for (const preset of ['female', 'male']) for (const name of names) {
    const { e } = lookHead(preset, [name]);
    const recipe = expandPlan(humanoidPlan({ preset, head: 'anime', face: e.face, hair: e.hair, expression: e.expression, tune: e.tune })), mesh = compileLayered(recipe);
    cells.push(render(mesh, recipe.palette, 'frontal', BODY, tallest));
  }
  sheet('anime-looks-heroes', cells, names.length, BODY.size);
}
// the hair fit: the studio's cap and clumps beside the fitted ones, with the coverage ledger
const FIT_VIEWS = ['back', 'lateral', 'three-quarter', [0, 70]];
for (const preset of ['female', 'male']) {
  const framing = compileLayered(animeHead({ preset, face, hair: 'long' })), cells = [];
  for (const [label, spec] of [...['bob', 'short', 'long'].flatMap((s) => [[`${s} · studio`, { hair: s, hairFit: false }], [`${s} · fit`, { hair: s }]]), ['sleek bob · studio', { hair: ['bob', 'sleek'], hairFit: false }], ['sleek bob · fit', { hair: ['bob', 'sleek'] }], ['hime', { hair: 'hime' }], ['short + ahoge', { hair: ['short', 'ahoge'] }]]) {
    const head = animeHead({ preset, face, ...spec }), mesh = compileLayered(head);
    table.push({ preset, row: label, hair: describeAnimeHair(head.hair), ...head.hairMeasures, ...Object.fromEntries(Object.entries(head.hairCoverage.views).map(([k, v]) => [`scalp ${k}`, v])) });
    for (const view of FIT_VIEWS) cells.push(render(mesh, head.palette, view, HEAD, framing));
  }
  sheet(`anime-hair-fit-${preset}`, cells, FIT_VIEWS.length, HEAD.size);
}
// the forms: strands beside consolidated sections
for (const preset of ['female', 'male']) {
  const framing = compileLayered(animeHead({ preset, face, hair: 'long' })), cells = [];
  for (const fam of ['bob', 'long', 'hime']) for (const strands of [1, 0]) {
    const head = animeHead({ preset, face, hair: [fam, { strands }] }), mesh = compileLayered(head);
    for (const view of ['frontal', 'three-quarter', 'lateral', 'back']) cells.push(render(mesh, head.palette, view, HEAD, framing));
  }
  sheet(`anime-hair-forms-${preset}`, cells, 4, HEAD.size);
}
writeFileSync(`${OUT}/anime-measures.json`, JSON.stringify(table, null, 1) + '\n');
const cols = [...new Set(table.flatMap((r) => Object.keys(r)))];
writeFileSync(`${OUT}/anime-measures.md`, [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...table.map((r) => `| ${cols.map((c) => r[c] ?? '').join(' | ')} |`)].join('\n') + '\n');
console.table(table);
console.log(`wrote ${OUT}`);
