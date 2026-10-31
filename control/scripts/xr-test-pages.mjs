/**
 * xr-test-pages — static World pages for trying the headset walk on a real device (a Quest browser only opens a WebXR
 * session over https, so these are built for a static host such as GitHub Pages, three from the pinned CDN).
 *
 *   cd control && node scripts/xr-test-pages.mjs <out-dir>
 *     → <out-dir>/index.html and one page per world; the modes are links (?xr=snap,hand: channels/xr.js)
 *
 * Two worlds: a COURSE (a flat checkered field, one straight lane painted down +X with a post every 5 m, so a path that
 * bends is plain to see) and the walkable fractal CITY. Nothing here is a recipe: it calls the emitter directly.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';

register('./mcp-stdio-loader.mjs', import.meta.url);   // the `@/` alias the city's imports use
const { assembleFractalCityScene } = await import('../lib/graph/city/fractal-city.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');

const out = path.resolve(process.argv[2] || 'xr-test-pages');
mkdirSync(out, { recursive: true });

const quad = (x0, y0, x1, y1, z, fill) => ({ corners: [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill });
function box(cx, cy, w, d, h, fill) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  return [
    quad(x0, y0, x1, y1, h, fill),
    { corners: [[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], fill },
    { corners: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], fill },
    { corners: [[x1, y1, 0], [x0, y1, 0], [x0, y1, h], [x1, y1, h]], fill },
    { corners: [[x0, y1, 0], [x0, y0, 0], [x0, y0, h], [x0, y1, h]], fill },
  ];
}

function course() {
  const faces = [];
  for (let i = -10; i < 30; i++) for (let j = -15; j < 15; j++) faces.push(quad(i * 2, j * 2, i * 2 + 2, j * 2 + 2, 0, (i + j) & 1 ? '#3a4a3a' : '#465a46'));
  faces.push(quad(-4, -0.6, 60, 0.6, 0.01, '#c9c2a8'));                 // the lane, 1.2 m wide, down +X
  faces.push(quad(-4, -0.06, 60, 0.06, 0.02, '#f2f2f2'));               // its centre line
  for (let x = 0; x <= 55; x += 5) {
    faces.push(...box(x, -1.5, 0.3, 0.3, x % 10 ? 1.2 : 2.2, x % 10 ? '#d0a040' : '#e05030'));
    faces.push(...box(x, 1.5, 0.3, 0.3, x % 10 ? 1.2 : 2.2, x % 10 ? '#d0a040' : '#e05030'));
  }
  faces.push(...box(58, 0, 2, 2, 4, '#4070d0'));                         // the goal, straight ahead
  // landmarks either side, mirrored, so the field's centre (where the walk spawn faces) sits on the lane
  for (const [x, c] of [[12, '#a050c0'], [28, '#50b0a0'], [44, '#c06060']]) faces.push(...box(x, 10, 3, 3, 3, c), ...box(x, -10, 3, 3, 3, c));
  return {
    faces, title: 'mojulo · xr course', sky: null, bg: '#1b2433',
    // the opening view stands on the lane looking down it: entering VR from it starts the player there, facing the goal
    cameras: [{ name: 'lane', worldFraming: { cameraPosition: [-4, 0, 1.7], lookAt: [20, 0, 1.5], horizontalFov: 80 } }],
    walk: { eye: 1.7, spawn: [-4, 0], speed: 5 },   // on the lane, facing down it
  };
}

function city() {
  const p = assembleFractalCityScene({ region: { x: 0, y: 0, w: 80, d: 52 }, depth: 4, seed: 5, anchor: 'tower', density: 0.9, profile: 'city', elements: { townhouses: true }, time: 'day', groundShadows: true, title: 'mojulo · xr city' });
  return { ...p, walk: { eye: 1.7, spawn: [40, 4] } };
}

// the page reads its mode off ?xr= (channels/xr.js), so a world is one page and a mode a link
const MODES = [
  ['', 'default: smooth turn, the heading latched when the stick engages'],
  ['snap', 'snap turn (30°), heading latched'],
  ['head', 'steer by the gaze (the old way), smooth turn'],
  ['hand', 'walk where the left controller points, smooth turn'],
  ['hand,snap', 'walk where the left controller points, snap turn'],
];
const WORLDS = [['course', course(), 'a straight lane with a post every 5 m: does a push forward stay on it?'], ['city', city(), 'the walkable fractal city']];

const rows = [];
for (const [w, payload, about] of WORLDS) {
  writeFileSync(path.join(out, `${w}.html`), emitThreeWorld({ ...payload, cdn: true, xr: true }));
  const links = MODES.map(([m, what]) => `<li><a href="${w}.html${m ? '?xr=' + m : ''}">${m || 'default'}</a> — ${what}</li>`);
  rows.push(`<h2>${w}</h2><p>${about}</p><ul>${links.join('')}</ul>`);
}
writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>mojulo xr test pages</title><style>body{font:18px/1.5 system-ui,sans-serif;background:#111;color:#eee;max-width:760px;margin:24px auto;padding:0 16px}a{color:#7cf}li{margin:8px 0}code{color:#fc8}</style></head><body>
<h1>mojulo · headset walk test pages</h1>
<p>Open a page in the Quest browser and press <code>vr</code> (top left, beside walk) straight away: VR starts you where the page's view stands, on the course's lane facing the blue goal. Left stick walks and strafes, right stick turns.</p>
<p>Check: a long push forward stays on the lane while you look around; turning happens where you stand; the turn speed feels right.</p>
${rows.join('\n')}
</body></html>
`);
console.log('wrote', out);
