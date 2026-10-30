// A GEOCITY'S MAP (geocity/): a metro's major streets first, the neighbourhoods they carve, each in its ring, the city
// park, the land's fall and the region graph's portals, then its heights (the rings' medians, the nodes, the arterials'
// frontages) and each neighbourhood's park. Writes the sheet in both views (rings, heights: the map, its ledger and its
// laws) and prints the laws. The machine gate: the laws; the look of the map is the operator's.
//
// Then its blocks: each neighbourhood's streets and blocks by segment, the whole map and cropped round `--focus`.
//
//   node scripts/spikes/geocity/geocity.mjs [--out <dir>] [--seed 1] [--geocity '{"metro":"harbour-island"}'] [--px 0.2]
//     [--focus D2,E2,D3,E3]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { designGeocity } = await import('@/lib/graph/geocity/design');
const { geocitySheet } = await import('@/lib/graph/geocity/sheet');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'geocity')), seed = Number(arg('--seed', '1')), px = Number(arg('--px', '0.2'));
const geocity = JSON.parse(arg('--geocity', '{}'));
fs.mkdirSync(out, { recursive: true });

const t0 = Date.now(), d = designGeocity(geocity, { seed });
const file = path.join(out, `geocity-${d.metro.id}-${seed}-sheet.svg`), hfile = file.replace('-sheet.svg', '-heights.svg'), bfile = file.replace('-sheet.svg', '-blocks.svg'), ffile = file.replace('-sheet.svg', '-focus.svg');
fs.writeFileSync(file, geocitySheet(d, { px }));
fs.writeFileSync(hfile, geocitySheet(d, { px, view: 'heights' }));
fs.writeFileSync(bfile, geocitySheet(d, { px, view: 'blocks' }));
// (the focus: the four round the seat unless named)
const focus = arg('--focus', null)?.split(',') ?? d.regions.filter((r) => Math.abs(r.mid[0] - d.seat[0]) < 700 && Math.abs(r.mid[1] - d.seat[1]) < 700).sort((a, b) => a.dist - b.dist).slice(0, 6).map((r) => r.id);
fs.writeFileSync(ffile, geocitySheet(d, { px: 1, view: 'blocks', focus }));
const rings = Object.fromEntries(['core', 'frame', 'outskirts'].map((k) => [k, d.regions.filter((r) => r.ring === k).length]));
console.log(`map: ${d.metro.id} · ${d.frame.W}×${d.frame.D} m · ${d.lines.length} arterials · ${d.regions.length} neighbourhoods (${Object.entries(rings).map(([k, n]) => `${k} ${n}`).join(', ')}) · ${d.graph.beyond.length} at the beyond · the ground ${d.land.range.join('–')} m · ${Date.now() - t0} ms`);
const spine = d.lines.filter((l) => l.rank === 'spine');
for (const l of spine) console.log(`  spine ${l.id}: ${l.ends.join(' → ')} m, steepest ${Math.round(l.grade * 1000) / 10}%`);
console.log(`  nodes: ${d.heights.nodes.map((n) => n.id).join(', ') || 'none'}`);
for (const l of d.laws) console.log(`  ${l.ok ? '✓' : '·'} ${l.law}: ${l.value} (${l.want})`);
for (const f of [file, hfile, bfile, ffile]) console.log(f);
