#!/usr/bin/env node
// A grimoire page on the press with drawn plates in it: node scripts/spikes/plate/grimoire.mjs <out.html> [style]
import { writeFileSync } from 'node:fs';
import { bookHtml, heading, para, plate, aside, facts } from '../../../lib/graph/book/book-press.js';
import { readBookStyle } from '../../../lib/graph/book/book-style.js';
import { renderPlate } from './plate.js';
import { alchemy, skull, stillLife } from './subjects.js';

const style = process.argv[3] ?? 'tome';
const C = readBookStyle(style).colours;
const draw = (subject, finish, prefix) => renderPlate(
  { ...subject, finish, palette: { paper: C.paper, ink: C.ink } }, { res: 2, prefix, backdrop: false },
).svg;
const html = bookHtml({
  title: 'The Lesser Grimoire', style,
  chapters: [{
    id: 'distillation', title: 'Of Distillation', body: [
      para('The work begins with a clean vessel and a low flame. Set the alembic upon the table where the light falls from the left, that the rising of the vapour may be watched against its shadowed side, and let nothing that is not of the work stand within a hand of it.', { drop: true }),
      plate(draw(alchemy, 'engraving', 'a'), { caption: 'Plate I. The alembic, the taper and the red cap, set out for the first work.', span: true }),
      para('When the belly of the glass has warmed, the spirit climbs the neck and falls by the beak. What is gathered there in the first hour is thin and of little virtue; cast it out.'),
      heading('The memento', 3),
      para('Keep before you, on the table, that which reminds the worker of the end of all works.'),
      plate(draw(skull, 'wash', 'b'), { caption: 'Plate II. The memento.' }),
      aside(facts([['Vessel', 'alembic of green glass'], ['Flame', 'one taper, never two'], ['Hour', 'before first light']]), { label: 'For the work' }),
      plate(draw(stillLife, 'woodcut', 'c'), { caption: 'Plate III. The measure, the chest and the weight.' }),
    ].join(''),
  }],
});
writeFileSync(process.argv[2], html);
console.log(process.argv[2], `${(html.length / 1024).toFixed(0)} kB`);
