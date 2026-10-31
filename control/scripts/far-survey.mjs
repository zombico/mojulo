// The surveyor (lib/graph/form/survey.js): what an eye sees of a sketch's form land, solved from its recipe, not
// rendered. For each camera, the counts of the image's samples (sky, inside the view cone's reach, and past it: grass
// the grass map covers, ground outside the map, bare, another class, the contour) and the image as a chart.
//
//   node scripts/far-survey.mjs <ref> [--cams cams.json] [--cols 96] [--rows 40] [--height 720] [--reach m]
//
// cams: [{ name, pos, target, vfov }] (runnability's); without it, the sketch's own cameras. The reach is the view
// cone's at that vfov and canvas height (scene/channels/view-cone.js), unless --reach fixes it.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const ref = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!ref) { console.error('usage: node scripts/far-survey.mjs <ref> [--cams cams.json] [--cols 96] [--rows 40] [--height 720] [--reach m]'); process.exit(2); }

const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { surveyView, surveyChart, surveyRegions } = await import('@/lib/graph/form/survey.js');
const { VIEW_CONE } = await import('@/lib/graph/scene/channels/view-cone.js');

const sketch = SketchRepository.getByRef(ref);
if (!sketch) { console.error(`no sketch '${ref}'`); process.exit(1); }
const { payload } = await resolveWorldScene(sketch, {});
const land = payload?.form?.land;
if (!land) { console.error(`${ref} has no form land (a gen-7 outside)`); process.exit(1); }
const cols = Number(flag('--cols', 96)), rows = Number(flag('--rows', 40)), height = Number(flag('--height', 720)), aspect = 16 / 9;
const cams = flag('--cams') ? JSON.parse(readFileSync(path.resolve(process.env.INIT_CWD || process.cwd(), flag('--cams')), 'utf8'))
  : (payload.cameras || []).map((c, i) => ({ name: c.name || `view ${i}`, pos: c.worldFraming.cameraPosition, target: c.worldFraming.lookAt, vfov: 50 }));
const G = land.grass;
console.log(`${ref}: land classes ${[...new Set(land.ranges.map((r) => r.key))].join(', ')}; grass map ${G ? `x ${G.origin[0]}..${(G.origin[0] + G.size[0] * G.cell).toFixed(1)}, y ${G.origin[1]}..${(G.origin[1] + G.size[1] * G.cell).toFixed(1)} at ${G.cell} m` : 'none'}`);
for (const c of cams) {
  const reach = Number(flag('--reach', 0)) || VIEW_CONE.blade / (VIEW_CONE.px * ((2 * Math.tan(((c.vfov ?? 50) * Math.PI) / 360)) / height));
  const S = surveyView(land, { eye: c.pos, target: c.target, vfov: c.vfov ?? 50, aspect, cols, rows, reach });
  console.log(`\n== ${c.name}: reach ${reach.toFixed(1)} m · ${Object.entries(S.counts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`   far by class: ${Object.entries(S.byClass).map(([k, v]) => `${k} ${v.far} (grass ${v.grass})`).join(' · ')}`);
  console.log(surveyChart(S, reach));
  // (what the art is handed: each far region's substance and colour, its horizontal bounds, its upper and lower bounds)
  const pct = (v) => `${Math.round(v * 100)}%`, span = (a) => (Math.min(...a) === Math.max(...a) ? `${Math.min(...a)}` : `${Math.min(...a)}..${Math.max(...a)}`);
  for (const R of surveyRegions(S, { reach, height, vfov: c.vfov ?? 50 }).filter((R) => R.columns.length > 1)) {
    const col = R.substance === 'grass' && G ? ` colour ${G.base.map((v) => v.toFixed(3)).join(',')}` : '';
    console.log(`   ${R.substance.padEnd(7)}${col} · x ${pct(R.x[0])}..${pct(R.x[1])} · top ${span(R.columns.map((k) => Math.round(k.top * height)))} px · bottom ${span(R.columns.map((k) => Math.round(k.bottom * height)))} px · stands ${span(R.columns.map((k) => k.standsPx))} px · d ${span(R.columns.map((k) => k.d))} m`);
  }
}
console.log("\n' ' sky · '.' inside the reach · past it: '^' grass contour · 'G' grass on ground · 'g' grass on another class · 'o' outside the grass map · 'n' no grass");
