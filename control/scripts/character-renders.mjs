/**
 * The character bible's turnaround: mint the world's composed hero through the hero door in a throwaway in-memory
 * database and draw it front, three-quarter and back, twice over: in COLOUR, the World page's own render (its palette,
 * its toon light) photographed in headless Chromium, and as hidden-line WIRE views of the compiled mesh (the same
 * camera and drawing as export-wire-svg.mjs), which show its construction. Returns `{ front, three, back }` wire SVG
 * strings, `color: { front, three, back }` PNG data URIs, and `world`, the live page, for characterBibleHtml's `renders`.
 *
 * Chromium is an optional worker: without one (resolveChromium finds none, and nothing is fetched here) the colour
 * plates are left out and the wire views stand alone. Nothing is kept: the sketch lives only in memory for the run.
 * Whether the hero reads right in any of them is the creator's to judge. Used by `out-sheet.mjs characters --render`.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

const PAPER = '#eef1f4';   // the binder's paper (bible-html.js --paper), so a colour plate sits on the sheet
const VIEWS = { front: 180, three: 150, back: 0 };   // az 0 looks north (+y): the hero faces +y, so its front is az 180

export async function renderHeroViews(world, { size = 640, elevation = 10, focal = 1400 } = {}) {
  const { readGameworld, heroOrders } = await import('../lib/graph/gameworld/index.js');
  const { mintSolidHandler } = await import('../lib/mcp/tools/mint-solid.js');
  const { SketchRepository } = await import('../lib/db/repositories/sketches.js');
  const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
  const { orbitCamera, wireSvg, weldFaces, frameSource } = await import('../lib/graph/scene/wire-svg.js');

  const orders = heroOrders(readGameworld(world));
  if (!orders) throw new Error('the world has no character book to draw');
  const ref = 'character-bible-hero';
  // the base is minted bare; the motion page's gaits and stand are applied to this throwaway copy so the live page plays
  // the feel the creator asked for (the stored orders apply them as patches after the real mint)
  const { applyManifestPatch } = await import('../lib/mcp/tools/manifest-patch.js');
  const spec = orders.motion ? applyManifestPatch({ hero: orders.mint.args.spec }, orders.motion.args.patch).manifest.hero : orders.mint.args.spec;
  const minted = await mintSolidHandler({ ...orders.mint.args, spec, ref });
  if (!minted?.ok) throw new Error(`the hero door did not mint the composed hero: ${JSON.stringify(minted).slice(0, 300)}`);

  const sketch = SketchRepository.getByRef(ref);
  const { payload, kind } = await resolveWorldScene(sketch);
  const faces = (payload?.faces ?? []).filter((f) => !f.studio);   // the workbench floor and grid are studio furniture
  if (!faces.length) throw new Error(`the minted hero (kind '${kind}') has no face geometry to draw`);
  const source = { schema: 'wire-source-v1', ref, kind, ...weldFaces(faces) };
  const { target, distance } = frameSource(source, { focalPixels: focal, size });
  const out = {};
  // the live view: the same self-contained three.js page the dashboard's World serves (coloured, orbitable), baked
  // into one string so the bible stays one file. A rigged hero's page carries its packed rig and plays its clips over
  // the hidden solid (the page's own controls pick the clip); what the payload carries is logged, to say whether it did.
  try {
    const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
    out.world = emitThreeWorld({ ...payload, wireframe: false, walk: false, spin: false, decollide: true, hud: true, inline: true, xr: null });
    console.error(`character-renders: the live page is ${Math.round(out.world.length / 1024)} KB; its payload carries ${Object.keys(payload).join(', ')}`);
  } catch (e) { console.error(`character-renders: the live view was not baked (${e.message}); the wire views stand alone`); }
  const cams = Object.entries(VIEWS).map(([name, az]) => [name, orbitCamera({ azimuthDegrees: az, elevationDegrees: elevation, target, distance, focalPixels: focal, size })]);
  for (const [name, cam] of cams) out[name] = wireSvg(source, cam, { features: [], title: `${world.name ?? world.id} hero — ${name}`, embedSource: false });
  // the colour plates: the World page in capture mode (no HUD, no loop), each view from the wire view's own camera,
  // the hero alone on the sheet's paper (the studio floor and grid, and the studio's dark sky, are left out)
  try {
    const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
    const { renderWorldFrames } = await import('../lib/motion/world-frames.js');
    const page = emitThreeWorld({ ...payload, faces, sky: null, bg: PAPER, wireframe: false, walk: false, spin: false, decollide: true, hud: false, inline: true, capture: true, xr: null });
    const vfov = 2 * Math.atan((size / 2) / focal) * 180 / Math.PI;
    const { pngs } = await renderWorldFrames(page, cams.map(([, cam]) => ({ pos: cam.position, target, vfov })), { width: size, height: size, deviceScaleFactor: 2 });
    out.color = Object.fromEntries(cams.map(([name], i) => [name, `data:image/png;base64,${pngs[i].toString('base64')}`]));
    console.error(`character-renders: the colour plates are ${Math.round(pngs.reduce((n, b) => n + b.length, 0) / 1024)} KB`);
  } catch (e) { console.error(`character-renders: no colour plates (${e.message.split('\n')[0]}); the wire views stand alone`); }
  return out;
}
