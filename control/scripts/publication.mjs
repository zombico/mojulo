#!/usr/bin/env node
/**
 * Publications (lib/graph/publication/) from the shell: each as its press page, its reader (the book held open) and,
 * with --pdf, its print. No database writes. From control/:
 *
 *   node scripts/publication.mjs <out-dir> [notebook,fieldManual,bestiary,grimoire | recipe.json] [--pdf] [--res 2]
 *
 * `bestiary` and `grimoire` are made from the lorecube's sample manual and tree (scripts/lorecube-diagrams.mjs), their
 * diagrams drawn in. Writes <name>.html (the press), <name>-reader.html (the open book), <name>.pdf.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
register('./mcp-stdio-loader.mjs', import.meta.url);
const { compilePublication, publicationBook } = await import('../lib/graph/publication/publication.js');
const { readerHtml } = await import('../lib/graph/publication/reader.js');
const { PUBLICATION_EXAMPLES } = await import('../lib/graph/publication/examples.js');

const args = process.argv.slice(2);
const has = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 && Boolean(args.splice(i, 1)); };
const flag = (name, d) => { const i = args.indexOf(`--${name}`); return i < 0 ? d : args.splice(i, 2)[1]; };
const pdf = has('pdf'), res = Number(flag('res', 2));
const [out, pick] = args;
if (!out) { console.error('usage: node scripts/publication.mjs <out-dir> [notebook,fieldManual,bestiary,grimoire | recipe.json] [--pdf]'); process.exit(2); }
mkdirSync(out, { recursive: true });

async function fromLore(name) {
  const { bestiaryOf, grimoireOf } = await import('../lib/graph/publication/from-lore.js');
  const { SAMPLE_MANUAL, SAMPLE_TREE } = await import('./lorecube-diagrams.mjs');
  const { renderSketchToSvg } = await import('../lib/sketch-svg.js');
  const draw = (manifest) => renderSketchToSvg(manifest, { surface: 'light' });
  if (name === 'bestiary') {
    const { newManual, intensifyManual } = await import('../lib/graph/lorecube/manual.js');
    const { polarityDiagram } = await import('../lib/graph/lorecube/diagram.js');
    const { newPolarity, intensifyPolarity } = await import('../lib/graph/lorecube/polarity.js');
    const M = intensifyManual(newManual(SAMPLE_MANUAL), { affinity: true, levels: true }).manual;
    return bestiaryOf(M, { diagram: await draw(polarityDiagram(intensifyPolarity(newPolarity(M.polarity)).polarity)) });
  }
  const { newTree, intensifyTree } = await import('../lib/graph/lorecube/tree.js');
  const { treeDiagram } = await import('../lib/graph/lorecube/diagram.js');
  const T = intensifyTree(newTree(SAMPLE_TREE.premise), { order: SAMPLE_TREE.order, costs: true }).tree;
  return grimoireOf(T, { diagram: await draw(treeDiagram(T)) });
}

const names = pick && pick.endsWith('.json') ? [pick] : (pick ? pick.split(',') : [...Object.keys(PUBLICATION_EXAMPLES), 'bestiary', 'grimoire']);
for (const name of names) {
  const t = performance.now();
  const P = name.endsWith('.json') ? JSON.parse(readFileSync(name, 'utf8')) : PUBLICATION_EXAMPLES[name] ?? (['bestiary', 'grimoire'].includes(name) ? await fromLore(name) : null);
  if (!P) { console.error(`no publication '${name}'`); process.exit(2); }
  const base = path.join(out, path.basename(name, '.json'));
  const C = compilePublication(P, { res });
  const book = publicationBook(C), reader = readerHtml(C);
  writeFileSync(`${base}.html`, book);
  writeFileSync(`${base}-reader.html`, reader);
  if (pdf) { const { printPdf } = await import('../lib/graph/book/book-pdf.js'); writeFileSync(`${base}.pdf`, await printPdf(book)); }
  console.log(`${base}: ${P.kind}, "${P.title}", ${C.chapters.length - 1} chapters, press ${(book.length / 1024).toFixed(0)} kB, reader ${(reader.length / 1024).toFixed(0)} kB, ${Math.round(performance.now() - t)} ms`);
}
process.exit(0);
