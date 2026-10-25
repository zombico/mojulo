// THE DEPICTION SOLVER's run — every scalp style (dermal-hair.js SCALP_STYLES) grouped by its class (hair-depict.js
// hairClass), each class solved at a rung (epidermis/hair-solve.js solveClass) on the pole's own head, the rows printed
// as HAIR_DEPICTION wants them and each class's table written beside them.
//
//   node .claude/skills/dermis-study/hair-solve.mjs [--level L1] [--classes a,b] [--per n] [--px 120] [--out dir]
//
// --per: at most n cases a class (spread over its styles; absent, every one). Writes rows.json and tables.json.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const CONTROL = resolve(dirname(new URL(import.meta.url).pathname), '../../../control');
register(pathToFileURL(`${CONTROL}/scripts/mcp-stdio-loader.mjs`).href);
process.chdir(CONTROL);
const { relationalHead } = await import('@/lib/graph/polygonizer/head-relational.js');
const { HEAD_TUNES } = await import('@/lib/graph/polygonizer/hero-relational-head.js');
const { relationalHeadChart, STAND_M } = await import('@/lib/graph/epidermis/dermal-head.js');
const { readDermis } = await import('@/lib/graph/epidermis/dermal-map.js');
const { readScalp, SCALP_STYLES } = await import('@/lib/graph/epidermis/dermal-hair.js');
const { hairClass } = await import('@/lib/graph/epidermis/hair-depict.js');
const { prepareCase, solveClass } = await import('@/lib/graph/epidermis/hair-solve.js');

const args = process.argv.slice(2);
let level = 'L1', classes = null, per = Infinity, px = 120, out = '/tmp/hair-solve';
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--level') level = args[++i];
  else if (a === '--classes') classes = args[++i].split(',');
  else if (a === '--per') per = +args[++i];
  else if (a === '--px') px = +args[++i];
  else if (a === '--out') out = args[++i];
  else throw new Error(`hair-solve: unknown flag ${a}`);
}
mkdirSync(out, { recursive: true });
const heads = {}, headOf = (sex) => (heads[sex] ??= (() => { const h = relationalHead({ sex, tune: HEAD_TUNES[sex] }); return { h, chart: relationalHeadChart(h, { cells: 60 }) }; })());
const byClass = {};
for (const style of Object.keys(SCALP_STYLES)) { const S = readScalp(style); if (S.length < 0.02 && !S.ties.length) continue; (byClass[hairClass(S)] ??= []).push(style); }
const rows = {}, tables = {};
for (const [cls, all] of Object.entries(byClass)) {
  if (classes && !classes.includes(cls)) continue;
  const styles = all.length <= per ? all : Array.from({ length: per }, (_, k) => all[Math.floor((k * all.length) / per)]);
  const t0 = Date.now();
  const cases = styles.map((style) => {
    const S = readScalp(style), sex = S.length > 0.25 ? 'female' : 'male', { h, chart } = headOf(sex);
    return prepareCase(chart, readDermis({ from: sex }), S, { level, centre: [0, h.landmarks.eyeR.y * STAND_M * 0.3, h.landmarks.eyeR.z * STAND_M] });
  });
  const r = solveClass(cases, cls, { level, px });
  rows[cls] = { [level]: r.rules };
  tables[cls] = { styles, table: r.table };
  const fmt = (t) => t.scores.map((s, i) => `${styles[i]} ${s.coverage}/${s.bladeCover}/${s.silhouette}/${s.faces}`).join('  ');
  console.log(`${cls.padEnd(9)} ${JSON.stringify(r.rules).padEnd(40)} ${Date.now() - t0} ms\n  rung:   ${fmt(r.baseline)}\n  solved: ${fmt(r.best)}`);
}
writeFileSync(join(out, 'rows.json'), JSON.stringify(rows, null, 2));
writeFileSync(join(out, 'tables.json'), JSON.stringify(tables, null, 2));
console.log(`— hair-solve: ${Object.keys(rows).length} classes at ${level} → ${join(out, 'rows.json')}`);
