/**
 * The character bible's turnaround: mint the world's composed hero through the hero door in a throwaway in-memory
 * database and draw it front, three-quarter and back, twice over: in COLOUR, the World page's own render (its palette,
 * its toon light) photographed in headless Chromium, and as hidden-line WIRE views of the compiled mesh (the same
 * camera and drawing as export-wire-svg.mjs), which show its construction. Returns `{ front, three, back }` wire SVG
 * strings, `color: { front, three, back }` PNG data URIs, and `world`, the live page, for characterBibleHtml's `renders`;
 * and, in colour only, `equipped: { front, right }`, the hero holding the table's gear at the final stage
 * (equipment.js `equippedHero`), and `gear: { <class>: PNG data URI }`, each filled class of the equipment table at its
 * last tier.
 *
 * Chromium is an optional worker: without one (resolveChromium finds none, and nothing is fetched here) the colour
 * plates are left out and the wire views stand alone. Nothing is kept: the sketch lives only in memory for the run.
 * Whether the hero reads right in any of them is the creator's to judge. Used by `out-sheet.mjs characters --render`.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

const PAPER = '#eef1f4';   // the binder's paper (bible-html.js --paper), so a colour plate sits on the sheet
const VIEWS = { front: 180, three: 150, back: 0 };   // az 0 looks north (+y): the hero faces +y, so its front is az 180
// the hero equipped: the front, and a three-quarter from the right, the side a right-hand item is carried on (the
// door's haft hold leans a staff back, so from the left its head is behind the shoulder)
const EQUIPPED_VIEWS = { front: 180, right: 120 };

export async function renderHeroViews(world, { size = 640, elevation = 10, focal = 1400 } = {}) {
  const { readGameworld, heroOrders } = await import('../lib/graph/gameworld/index.js');
  const { mintSolidHandler } = await import('../lib/mcp/tools/mint-solid.js');
  const { SketchRepository } = await import('../lib/db/repositories/sketches.js');
  const { resolveWorldScene } = await import('../lib/graph/worlds/world-scene.js');
  const { orbitCamera, wireSvg, weldFaces, frameSource } = await import('../lib/graph/scene/wire-svg.js');

  const G = readGameworld(world), orders = heroOrders(G);
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
    out.color = await photograph(payload, faces, cams.map(([name, cam]) => [name, cam.position, target]), { size, focal });
    console.error(`character-renders: the colour plates are ${kb(out.color)} KB`);
  } catch (e) { console.error(`character-renders: no colour plates (${e.message.split('\n')[0]}); the wire views stand alone`); return out; }
  // the hero equipped: the same views, the same feel, holding the table's gear at the final stage
  try {
    const { equippedHero } = await import('../lib/graph/gameworld/index.js');
    const Q = equippedHero(G);
    if (Q) {
      const eq = await mintHero({ ...orders.mint.args, spec: { ...spec, gear: Q.spec.gear, ...(Q.spec.gesture ? { gesture: Q.spec.gesture } : {}) } }, `${ref}-equipped`);
      const at = frameSource(eq.source, { focalPixels: focal, size });
      out.equipped = await photograph(eq.payload, eq.faces, Object.entries(EQUIPPED_VIEWS).map(([name, az]) => [name, orbitCamera({ azimuthDegrees: az, elevationDegrees: elevation, target: at.target, distance: at.distance, focalPixels: focal, size }).position, at.target]), { size, focal });
      console.error(`character-renders: the equipped plates are ${kb(out.equipped)} KB (${Q.carried.map((c) => `${c.id} in the ${c.slot}`).join(', ')})`);
    }
  } catch (e) { console.error(`character-renders: the hero was not drawn equipped (${e.message.split('\n')[0]})`); }
  // the gear: every filled class of the table, alone, at its last tier
  try {
    const { resolveEquipment, buildAt } = await import('../lib/graph/gameworld/index.js');
    const gear = {};
    for (const r of resolveEquipment(G).rows.filter((x) => x.build)) {
      const minted = await mintSolidHandler({ kind: 'equipment', title: r.class, ref: `${ref}-gear-${r.class}`, spec: buildAt({ build: r.build, tiers: r.tiers }) });
      if (!minted?.ok) throw new Error(`the ${r.class} did not mint`);
      const { payload: gp } = await resolveWorldScene(SketchRepository.getByRef(`${ref}-gear-${r.class}`));
      const gf = (gp?.faces ?? []).filter((f) => !f.studio);
      const at = frameSource({ schema: 'wire-source-v1', ref: r.class, ...weldFaces(gf) }, { focalPixels: focal, size: GEAR_SIZE });
      const cam = orbitCamera({ azimuthDegrees: 160, elevationDegrees: 12, target: at.target, distance: at.distance, focalPixels: focal, size: GEAR_SIZE });
      gear[r.class] = (await photograph(gp, gf, [['one', cam.position, at.target]], { size: GEAR_SIZE, focal })).one;
    }
    if (Object.keys(gear).length) { out.gear = gear; console.error(`character-renders: the gear photos are ${kb(gear)} KB (${Object.keys(gear).join(', ')})`); }
  } catch (e) { console.error(`character-renders: the gear was not photographed (${e.message.split('\n')[0]})`); }
  return out;

  async function mintHero(args, at) {
    const m = await mintSolidHandler({ ...args, ref: at });
    if (!m?.ok) throw new Error(`the hero door did not mint it: ${JSON.stringify(m).slice(0, 300)}`);
    const { payload: p, kind: k } = await resolveWorldScene(SketchRepository.getByRef(at));
    const f = (p?.faces ?? []).filter((x) => !x.studio);
    return { payload: p, faces: f, source: { schema: 'wire-source-v1', ref: at, kind: k, ...weldFaces(f) } };
  }
}

const GEAR_SIZE = 360;
const kb = (uris) => Math.round(Object.values(uris).reduce((n, u) => n + u.length * 0.75, 0) / 1024);

/** The World page of a payload in capture mode (no HUD, no loop, no studio sky), on the sheet's paper, photographed
 * from each `[name, position, target]` → { <name>: PNG data URI } */
async function photograph(payload, faces, shots, { size, focal }) {
  const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
  const { renderWorldFrames } = await import('../lib/motion/world-frames.js');
  const page = emitThreeWorld({ ...payload, faces, sky: null, bg: PAPER, wireframe: false, walk: false, spin: false, decollide: true, hud: false, inline: true, capture: true, xr: null });
  const vfov = 2 * Math.atan((size / 2) / focal) * 180 / Math.PI;
  const { pngs } = await renderWorldFrames(page, shots.map(([, pos, target]) => ({ pos, target, vfov })), { width: size, height: size, deviceScaleFactor: 2 });
  return Object.fromEntries(shots.map(([name], i) => [name, `data:image/png;base64,${pngs[i].toString('base64')}`]));
}
