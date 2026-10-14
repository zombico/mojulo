// Screenshot a composed HTML sheet.
//   node docs/images/src/snap-html.mjs <page.html> <out.png> <W>x<H> [dpr]
import { snapHtml } from './lib/browser.mjs';

const [html, out, size, dpr = '1'] = process.argv.slice(2);
if (!html || !out || !size) { console.error('usage: snap-html.mjs <page.html> <out.png> <W>x<H> [dpr]'); process.exit(1); }
const [width, height] = size.split('x').map(Number);
await snapHtml(html, out, { width, height, dpr: Number(dpr) });
console.log(out);
