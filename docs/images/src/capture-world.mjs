// Render an exported world.html from one camera.
//   node docs/images/src/capture-world.mjs <world.html> <out.png> <W>x<H> '<camera json>' [dpr]
// The camera is { pos, target, vfov } in the page's world units (a floorplan: feet, y negated; a workbench: mm).
import { captureWorld } from './lib/browser.mjs';

const [world, out, size, camera, dpr = '2'] = process.argv.slice(2);
if (!world || !out || !size || !camera) {
  console.error("usage: capture-world.mjs <world.html> <out.png> <W>x<H> '<camera json>' [dpr]");
  process.exit(1);
}
const [width, height] = size.split('x').map(Number);
await captureWorld(world, out, { width, height, dpr: Number(dpr), camera: JSON.parse(camera) });
console.log(out);
