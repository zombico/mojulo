#!/usr/bin/env node
/**
 * The metroidvania box for the eyes gate (docs/metroidvania-map.md): a box's words laid (gameworld/metroidvania/box.js),
 * built in greybox (rooms.js), solved (solve.js), held to its laws (laws.js) and written as its elevation (drawing.js):
 * box.svg, a PNG of it where sharp is installed, and box.json (the layout, the solution and the laws).
 *
 *   node scripts/metroidvania.mjs [words.json] [--out dir] [--turn ccw|cw] [--box 14x8] [--shape serpentine|hub] [--castle]
 *
 * With no words, Vampire Sonata (vampire-sonata.js), the castle stormed; `--shape` its bell tower (a serpentine) or its
 * courtyard (a hub); `--castle` the castle of boxes (castle.js: the tower, a bridge, the courtyard, a gatehouse, the keep). Prints the laws and the order it is solved in.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { layBox } = await import('../lib/graph/gameworld/metroidvania/box.js');
const { isCastle, layCastle, castleLaws } = await import('../lib/graph/gameworld/metroidvania/castle.js');
const { greyboxOf } = await import('../lib/graph/gameworld/metroidvania/rooms.js');
const { solveBox } = await import('../lib/graph/gameworld/metroidvania/solve.js');
const { boxLaws } = await import('../lib/graph/gameworld/metroidvania/laws.js');
const { drawBox } = await import('../lib/graph/gameworld/metroidvania/drawing.js');
const { vampireSonata, bellTower, courtyard, vampireSonataCastle } = await import('../lib/graph/gameworld/metroidvania/vampire-sonata.js');

const args = process.argv.slice(2), opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('--') && !['--out', '--turn', '--box', '--shape'].includes(args[i - 1]));
const out = path.resolve(opt('--out') ?? 'metroidvania-out');
const box = opt('--box')?.split('x').map(Number);
const shaped = { serpentine: bellTower, hub: courtyard }[opt('--shape')];
const words = file ? JSON.parse(readFileSync(file, 'utf8')) : args.includes('--castle') ? vampireSonataCastle() : shaped ? shaped(box ? { box } : {}) : vampireSonata({ ...(box ? { box } : {}), ...(opt('--turn') ? { turn: opt('--turn') } : {}) });

const layout = isCastle(words) ? layCastle(words) : layBox(words), greybox = greyboxOf(layout), solved = solveBox(layout), laws = (layout.castle ? castleLaws : boxLaws)(layout, { solved, greybox });
mkdirSync(out, { recursive: true });
const svg = drawBox({ layout, greybox, laws, solved });
writeFileSync(path.join(out, 'box.svg'), svg);
writeFileSync(path.join(out, 'box.json'), JSON.stringify({ layout: { ...layout, ...(layout.castle ? { castle: { ...layout.castle, laid: undefined } } : {}) }, solved: { ...solved, heldAt: undefined }, laws }, null, 1));
try {
  const { loadSharp } = await import('../lib/sharp-lazy.js');
  const sharp = await loadSharp();
  if (sharp) await sharp(Buffer.from(svg)).png().toFile(path.join(out, 'box.png'));
} catch (e) { console.log(`(no PNG: ${e.message})`); }
console.log(`${layout.rooms.length} rooms, ${layout.doors.length} doors in a ${layout.box.join(' × ')} box, ${layout.shape === 'spiral' ? `walked ${layout.turn}` : layout.castle ? `a castle of ${layout.castle.boxes.map((b) => b.id).join(', ')}` : `a ${layout.shape}`}`);
console.log(`solved: ${solved.got.filter((g) => g.kind !== 'pocket').map((g) => g.what).join(' → ')}`);
for (const l of laws) console.log(`${l.holds ? 'holds' : 'LOST '}  ${l.id}: ${l.says}`);
console.log(`written to ${out}`);
