#!/usr/bin/env node
/**
 * Drawn plates (lib/graph/book/drawn-plate.js) from the shell. No database writes. From control/:
 *
 *   node scripts/drawn-plate.mjs <out-dir> [example,… | plate.json] [--finish wash,engraving,woodcut] [--res 2] [--construction] [--full]
 *       each plate as <name>-<finish>.svg (the examples: lib/graph/book/drawn-plate-examples.js; a .json file is a plate spec)
 *   node scripts/drawn-plate.mjs --book <out.html> [--style tome] [--pdf out.pdf]
 *       a sample book on the press with three plates in it
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderPlate, drawnPlate, FINISH_NAMES } from '../lib/graph/book/drawn-plate.js';
import { PLATE_EXAMPLES } from '../lib/graph/book/drawn-plate-examples.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args.splice(i, 2)[1]; };
const has = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && Boolean(args.splice(i, 1)); };
const book = flag('book'), style = flag('style', 'tome'), pdf = flag('pdf');
const res = Number(flag('res', 2)), finishes = flag('finish', FINISH_NAMES.join(',')).split(',');
const construction = has('construction'), full = has('full');

if (book) {
  const { bookHtml, heading, para, aside, facts } = await import('../lib/graph/book/book-press.js');
  const { alchemy, skull, stillLife } = PLATE_EXAMPLES;
  const html = bookHtml({
    title: 'The Lesser Grimoire', style,
    chapters: [{
      id: 'distillation', title: 'Of Distillation', body: [
        para('The work begins with a clean vessel and a low flame. Set the alembic upon the table where the light falls from the left, that the rising of the vapour may be watched against its shadowed side, and let nothing that is not of the work stand within a hand of it.', { drop: true }),
        drawnPlate({ ...alchemy, finish: 'engraving' }, { style, id: 'a', span: true, caption: 'Plate I. The alembic, the taper and the red cap, set out for the first work.' }),
        para('When the belly of the glass has warmed, the spirit climbs the neck and falls by the beak. What is gathered there in the first hour is thin and of little virtue; cast it out.'),
        heading('The memento', 3),
        para('Keep before you, on the table, that which reminds the worker of the end of all works.'),
        drawnPlate({ ...skull, finish: 'wash' }, { style, id: 'b', caption: 'Plate II. The memento.' }),
        aside(facts([['Vessel', 'alembic of green glass'], ['Flame', 'one taper, never two'], ['Hour', 'before first light']]), { label: 'For the work' }),
        drawnPlate({ ...stillLife, finish: 'woodcut' }, { style, id: 'c', caption: 'Plate III. The measure, the chest and the weight.' }),
      ].join(''),
    }],
  });
  writeFileSync(book, html);
  console.log(`${book}  ${(html.length / 1024).toFixed(0)} kB`);
  if (pdf) {
    const { register } = await import('node:module');
    register('./mcp-stdio-loader.mjs', import.meta.url);   // the PDF path reaches Chromium through the `@/` alias
    const { printPdf } = await import('../lib/graph/book/book-pdf.js');
    writeFileSync(pdf, await printPdf(html));
    console.log(pdf);
  }
} else {
  const [out, pick] = args;
  if (!out) { console.error('usage: node scripts/drawn-plate.mjs <out-dir> [example,… | plate.json] [--finish …]  |  --book <out.html>'); process.exit(2); }
  mkdirSync(out, { recursive: true });
  const plates = pick && pick.endsWith('.json') ? { [path.basename(pick, '.json')]: JSON.parse(readFileSync(pick, 'utf8')) }
    : Object.fromEntries((pick ? pick.split(',') : Object.keys(PLATE_EXAMPLES)).map((name) => {
      if (!PLATE_EXAMPLES[name]) { console.error(`no example '${name}' (${Object.keys(PLATE_EXAMPLES).join(', ')})`); process.exit(2); }
      return [name, PLATE_EXAMPLES[name]];
    }));
  for (const [name, plate] of Object.entries(plates)) for (const finish of finishes) {
    const t = performance.now();
    const { svg, width, height } = renderPlate({ ...plate, finish, ...(construction ? { construction: true } : {}), ...(full ? { frame: 'full' } : {}) }, { res });
    const file = path.join(out, `${name}-${finish}.svg`);
    writeFileSync(file, svg);
    console.log(`${file}  ${width}x${height}  ${Math.round(performance.now() - t)} ms  ${(svg.length / 1024).toFixed(1)} kB`);
  }
}
