/**
 * historic-city — a historic city's scene: the plan the solver lays (./solver/: the town solved from its culture's
 * form, its monument and what its people had, ./ledger/) emitted through the existing scene builders, the CSS 3D
 * page and the WebGL World. The plan's SLOTS ({ asset, rect, facing }) are built by the culture's asset kit, each on
 * its own dressing stream; its light is the culture's style card's; statues and people stand over it on the World.
 * Plans in metres; the emitter converts to scene units. Pure and deterministic.
 */
import { SUMER } from './cultures/sumer.js';
import { assembleBoxCityScene, emitPreserve3dScene } from '../scene/scene-css3d.js';
import { scaleHex } from '../polygonizer/vexar.js';
import { placeAsset, localSize } from './assets/kit.js';
import { HISTORIC_CULTURES } from './cultures/index.js';
import { solveHistoric } from './solver/index.js';
import { stream } from './layout-kit.js';
import { solidFaces, scaleSolid } from './assets/solids.js';
import { assetBlueprintSvg } from './assets/blueprint.js';
import { makeLight, litFactor } from '../polygonizer/vexar.js';
import { groundTileFace, groundTileCss, skinFace } from './ground.js';
import { bakeShade, shadeLayer, shadeCss } from './light.js';
import { HISTORIC_STYLES } from './style/index.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';
import { deriveSky } from '../polygonizer/painted-landscape.js';
import { resolveFire, firePageChannel } from '../fire/fire.js';
import { standStatues } from './statues.js';
import { sceneFolk } from './crews.js';

export { HISTORIC_CULTURES };   // the registry: ./cultures/index.js
export const METRES_PER_UNIT = 3.66;              // the city scenes' unit (a storey ≈ 0.85 u)

/**
 * Plan a historic scene: the solver's plan for `{ culture, seed, scene, focus, form }` (./solver/index.js). An unknown
 * culture is refused by name.
 */
export function planHistoricCity(opts = {}) {
  return solveHistoric({ ...opts, culture: opts.culture || 'sumer' });
}

/**
 * The asset call: what a layout asks the kit for — each asset's slot count, the size envelope its slots
 * span (local W × D, metres) and whether the kit has a designed asset or still a placeholder. This is
 * the design brief for the image worker.
 */
export function assetCall(plan, kit) {
  const by = new Map();
  for (const q of plan.slots) {
    const { W, D } = localSize(q.rect, q.facing);
    const e = by.get(q.asset) || { asset: q.asset, count: 0, W: [Infinity, -Infinity], D: [Infinity, -Infinity] };
    e.count++; e.W = [Math.min(e.W[0], W), Math.max(e.W[1], W)]; e.D = [Math.min(e.D[0], D), Math.max(e.D[1], D)];
    by.set(q.asset, e);
  }
  return [...by.values()].map((e) => ({ ...e, designed: !!kit[e.asset]?.designed }));
}

/** Plan → a CSS 3D scene (the city scene's assembler), in scene units, with an aerial and a lane-level camera. */
// the box city's own light, so solids shade like the masses beside them
export const SCENE_LIGHT = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
// px per scene unit. A panel rasterises at its own px size and an eye-level camera magnifies the near
// ground many times, so at the box city's 22 the paving smears to a blur — the eye-level views raster
// at 48. From the air every panel is on screen at once and the box city's 22 is plenty. Lindos' views across the
// water (`sea`, `bay`) look at the rock from afar: 22, or the page drops faces under the load.
const UNIT_SCALE = { aerial: 22, approach: 22, street: 48, precinct: 48, canal: 48, avenue: 48, temple: 48, river: 48, valley: 48, pyramid: 48, cemetery: 48, town: 48, harbour: 48, works: 48, summit: 48, climb: 48, stoa: 48, sea: 22, bay: 22, theatre: 48, palace: 48, gate: 48, ward: 48, market: 48, bridge: 48, bluff: 48, forum: 48, faun: 48, castor: 48, sacra: 48, rostra: 48, capitol: 48, lacus: 48, julius: 48, basilica: 48, aisle: 48, cella: 48 };

/**
 * Metre grounds → scene faces, kept in their stacking order (base earth, then fields, water, lanes,
 * courts): the ground layers sit millimetres apart, so it is draw order that keeps the canal above the
 * earth. A surfaced ground (mud, rubble, brick, dry earth) is a tiled face; the rest flat colour.
 * `shade` (a ./light.js bake): its map is laid over every ground face, at the face's place in it.
 */
export function groundsToScene(grounds, s, us, textured = true, shade = null, world = false) {
  const faces = [];
  // the shade layer goes over a face whose local axes run +x and +y (a ground rect; a near-square poly)
  const shaded = (f, x, y) => (shade ? { ...f, shade: shade.key, bg: `${shadeLayer(shade, x, y, s, us)}, ${f.bg || f.fill}` } : f);
  for (const g of grounds) {
    const o = { ...g, x: g.x * s, y: g.y * s, w: g.w * s, d: g.d * s, z: g.z * s }, lit = scaleHex(g.fill, litFactor([0, 0, 1], SCENE_LIGHT));
    if (g.poly) {
      const f = { corners: g.poly.map(([x, y]) => [x * s, y * s, g.z * s]), fill: lit, doubleSided: true }, [a, b, , c] = g.poly;
      const square = g.poly.length === 4 && b[0] - a[0] > 0 && Math.abs(b[1] - a[1]) < 0.1 * (b[0] - a[0]) && c[1] - a[1] > 0 && Math.abs(c[0] - a[0]) < 0.1 * (c[1] - a[1]);
      faces.push(square ? shaded(f, a[0], a[1]) : f);
      continue;
    }
    if (g.surface && textured) faces.push(shaded(groundTileFace(o, g.surface, g.fill, lit, { us, mpu: METRES_PER_UNIT }), g.x, g.y));
    // water with a look (`liquid`), for the World page: its water shader and the opacity at each corner
    else if (world && g.liquid) {
      // one sheet: each piece at its exact rect and one level (overlaps would darken twice through translucent water)
      const q = g.sheet ? { x: g.sheet.x * s, y: g.sheet.y * s, w: g.sheet.w * s, d: g.sheet.d * s, z: g.sheet.z * s } : o;
      faces.push({ corners: [[q.x, q.y, q.z], [q.x + q.w, q.y, q.z], [q.x + q.w, q.y + q.d, q.z], [q.x, q.y + q.d, q.z]], fill: (g.sheet && g.sheet.fill) || g.fill, water: true, liquid: g.liquid, ...(g.cornerAlpha ? { cornerAlpha: g.cornerAlpha } : {}), doubleSided: true });
    }
    else faces.push(shaded({ corners: [[o.x, o.y, o.z], [o.x + o.w, o.y, o.z], [o.x + o.w, o.y + o.d, o.z], [o.x, o.y + o.d, o.z]], fill: lit, doubleSided: true }, g.x, g.y));
  }
  return { grounds: [], faces };
}
/** Emit a historic scene: the box city's page, with the ground tiles defined once at the top. */
function emitHistoric(scene) {
  const css = groundTileCss(scene.faces) + shadeCss(scene.faces);
  const html = emitPreserve3dScene(scene);
  return css ? html.replace('<style>\n', `<style>\n${css}`) : html;
}

/**
 * Metre masses → scene units: plain boxes for the box emitter, angled solids as their own faces.
 * `focus` (metres): what directed skins face — a temple's sanctuary.
 */
export function toScene(masses, s, us = UNIT_SCALE.aerial, focus) {
  const boxes = [], faces = [];
  for (const b of masses) {
    const tile = { us, mpu: METRES_PER_UNIT, toward: focus && [focus[0] * s, focus[1] * s] };
    // a skinned box goes the solid way (an unleaning frustum) so its faces can wear the skin
    const m = b.skin && !b.solid ? { ...b, solid: 'frustum', top: { x: b.x, y: b.y, w: b.w, d: b.d } } : b;
    if (m.solid) { const fs = solidFaces(scaleSolid(m, s), SCENE_LIGHT, tile); faces.push(...(b.skin ? fs.map((f) => skinFace(f, b.skin, tile)) : fs)); continue; }
    const o = { ...b, x: b.x * s, y: b.y * s, w: b.w * s, d: b.d * s, z0: b.z0 * s, z1: b.z1 * s };
    if (b.plant) o.plant = { ...b.plant, height: b.plant.height * s, stemRadius: b.plant.stemRadius * s };
    else o.lod = 'mass';   // a plain lit mass in its own tint: the big read
    boxes.push(o);
  }
  return { boxes, faces };
}

/**
 * The culture's style card dresses the scene's light: its sun baked into a shade map over the ground
 * (./light.js) and its sky behind the town. `shade: false` (or a culture without a card) leaves both off.
 */
export function historicLight(plan, opts = {}) {
  const style = HISTORIC_STYLES[plan.stats.culture];
  if (!style || opts.shade === false) return { style: null, shade: null, sky: undefined };
  // a card that says `light.terrain` stands the land in the bake too (its cliffs cast onto the sea)
  const terrain = style.light.terrain && plan.hAt ? plan.hAt : undefined;
  return { style, shade: bakeShade({ frame: plan.frame, masses: plan.boxes, grounds: plan.grounds, terrain }, SCENE_LIGHT, style.light), sky: style.sky };
}

export function assembleHistoricCityScene(opts = {}) {
  let plan = planHistoricCity(opts);
  // STATUES (historic/statues.js, the World's alone): the stand-ins on the named slots come down, and a record per
  // figure says where a stored statue stands instead — the World resolver fits its faces there. Absent ⇒ untouched.
  const stood = opts.world && opts.statues?.length ? standStatues(plan, opts.statues, { culture: plan.stats?.culture }) : null;
  if (stood) plan = { ...plan, boxes: stood.boxes };
  // `people` (the World's alone): the town's citizens and field hands, the crews at its work places and any team at a
  // yoke, stood over the finished plan (./crews.js), statues included; the scene builds from the folk's boxes (a hitched yoke lifted)
  const folk = opts.world && opts.people ? sceneFolk(plan, opts.people, 1 / METRES_PER_UNIT, opts.seed ?? 1) : null;
  if (folk) plan = { ...plan, boxes: folk.boxes };
  const view = opts.view === 'approach' || (opts.view && plan.views[opts.view]) ? opts.view : 'aerial';
  // px per scene unit for the view: the table's, or eye level for a view it does not name (a new culture's own views)
  const US = UNIT_SCALE[view] ?? 48;
  const s = 1 / METRES_PER_UNIT, world = !!opts.world;
  // `world`: built for the WebGL World page, which also draws what the plan keeps for it alone (a seabed)
  // a World with live fire (`fire`) burns its flames itself: the painted flame cards stand down there
  const live = world && Array.isArray(plan.fireSources) && plan.fireSources.length > 0;
  const masses = live ? plan.boxes.filter((m) => m.kind !== 'flame') : plan.boxes;
  // repeated parts (a plan's `repeats`): the World draws each template once as instances; the CSS page their light stand-ins
  const reps = plan.repeats || [];
  const lows = world ? [] : reps.filter((r) => !r.world).flatMap((r) => r.transforms.flatMap((t) => r.low.map((m) => liftMass(m, t.pos))));
  const { boxes, faces } = toScene(world && plan.world ? [...masses, ...lows, ...plan.world.boxes] : [...masses, ...lows], s, US, plan.focus);
  const { shade, sky } = historicLight(plan, opts);
  const G = groundsToScene(plan.grounds, s, US, true, shade, world), grounds = G.grounds;
  faces.unshift(...G.faces);
  if (folk) for (const f of folk.faces) faces.push(f);
  const W = plan.frame.w * s, Dd = plan.frame.d * s, pc = plan.stats.precinct;
  const pcx = (pc.x + pc.w / 2) * s, pcy = (pc.y + pc.d / 2) * s;
  const cameras = [
    { name: 'aerial', worldFraming: { cameraPosition: [W * 0.5, Dd * 1.25, Math.max(W, Dd) * 0.55], lookAt: [W * 0.5, Dd * 0.45, 0], horizontalFov: 62, pictureCenter: [560, 390] } },
    { name: 'approach', worldFraming: { cameraPosition: [pcx - 30, pcy + 55, 6], lookAt: [pcx, pcy, 4], horizontalFov: 70, pictureCenter: [560, 390] } },
  ];
  for (const [name, v] of Object.entries(plan.views)) cameras.push({ name, worldFraming: { cameraPosition: v.eye.map((q) => q * s), lookAt: v.at.map((q) => q * s), horizontalFov: 74, pictureCenter: [560, 390] } });
  // the asked-for view first (it is the one the page opens on)
  const first = cameras.findIndex((c) => c.name === view);
  if (first > 0) cameras.unshift(...cameras.splice(first, 1));
  const scene = assembleBoxCityScene({ boxes, grounds, faces, cameras, title: `mojulo historic ${plan.stats.scene && plan.stats.scene !== 'city' ? plan.stats.scene : 'city'} · ${(HISTORIC_CULTURES[plan.stats.culture] || SUMER).label}`, bg: '#d9cdb4', sky, light: SCENE_LIGHT, unitScale: US });
  // the fires stay in metres: the World's fire channel burns them so and scales them into the scene's units
  const fireSources = live ? plan.fireSources : null;
  // the World's crop (`plan.world.skirt`): kept with the plan's heights until the sky's horizon colour is known
  const skirt = world && plan.world && plan.world.skirt && plan.hAt ? { ...plan.world.skirt, hAt: plan.hAt, frame: plan.frame } : null;
  const repeats = world && reps.length ? reps.map((r) => {
    const T = toScene(r.template, s, US);
    if (T.boxes.length) throw new Error(`repeat '${r.key}': a template is built of solids only`);
    return { group: r.key, template: T.faces, transforms: r.transforms.map((t) => ({ pos: t.pos.map((v) => v * s) })) };
  }) : null;
  // the statue records in metres, with the unit and the sun their faces bake under (worlds/world-scene.js resolves them)
  const statueRefs = stood?.statueRefs.length ? { unit: METRES_PER_UNIT, light: SCENE_LIGHT, list: stood.statueRefs } : null;
  const stats = folk ? { ...plan.stats, people: folk.stats } : plan.stats;
  return { ...scene, stats, ...(shade ? { shade } : {}), ...(fireSources ? { fireSources } : {}), ...(skirt ? { skirt } : {}), ...(repeats ? { repeats } : {}), ...(statueRefs ? { statueRefs } : {}) };
}
/** A mass moved by `[dx, dy, dz]` (an instance's stand-in put in place). */
function liftMass(m, [dx, dy, dz]) {
  const o = { ...m, x: m.x + dx, y: m.y + dy, z0: m.z0 + dz, z1: m.z1 + dz };
  if (m.top) o.top = { ...m.top, x: m.top.x + dx, y: m.top.y + dy };
  if (m.pts) o.pts = m.pts.map(([x, y, z]) => [x + dx, y + dy, z + dz]);
  for (const k of ['a', 'b']) if (Array.isArray(m[k])) o[k] = [m[k][0] + dx, m[k][1] + dy, m[k][2] + dz];
  return o;
}

/**
 * A historic city for the WebGL World page (scene/scene-three.js `emitThreeWorld`): the same scene, with the
 * World's own needs met — the ground tiles and wall skins resolved into its texture map, the style card's sky as
 * the World's zenith/horizon dome (the water reflects it), the sea under its water look where the culture gives
 * one, and what the plan keeps for the World alone (a seabed under clear shallows). The World ignores the CSS
 * shade map: its light is its own. Opens on `view` like the page.
 */
export function assembleHistoricWorld(opts = {}) {
  // the CSS shade map is the page's: the World never reads it, so it is not baked here
  const { fireSources, skirt, ...scene } = assembleHistoricCityScene({ ...opts, world: true, shade: false });
  const style = HISTORIC_STYLES[scene.stats.culture];
  const card = style && style.sky && style.sky.palette ? deriveSky(style.sky.palette, { x: 0, y: 0, z: style.sky.sunElev }) : null;
  if (skirt) scene.faces.push(...skirtFaces(skirt, 1 / METRES_PER_UNIT, card ? card.horizon : [208, 217, 218]));
  // `fire`: the hearths and kilns burn live (fire/fire.js), lighting the town by day as their own glow
  const lit = fireSources ? resolveFire(true, fireSources, { explicit: false }) : null;
  // a repeat's template wears its skins too: its textures are collected with the page's own
  return { ...scene, textures: collectFaceTextures(scene.repeats ? [...scene.faces, ...scene.repeats.flatMap((r) => r.template)] : scene.faces, { ...(scene.textures || {}) }), ...(card ? { sky: { zenith: card.zenith.map(Math.round), horizon: card.horizon.map(Math.round), day: 1, stars: 0, seed: 1 } } : {}),
    ...(lit ? { fire: firePageChannel(lit, { day: card ? 1 : 0, unit: METRES_PER_UNIT }) } : {}) };
}
/**
 * The World's crop: the land just past the frame, `width` m of it in `cell` squares, its heights the frame edge's
 * carried straight out (a bluff or a river runs on), each corner's colour fading from the ground's (or the water's,
 * below `waterZ`) to the sky's horizon by its distance from the frame. Past it the picture is sky and haze, so the
 * town stays the focus however the World is turned. Metres in, scene units out.
 */
function skirtFaces({ width, cell, waterZ = -Infinity, fill, water, hAt, frame }, s, horizon) {
  const lit = litFactor([0, 0, 1], SCENE_LIGHT), base = [scaleHex(fill, lit), scaleHex(water || fill, lit)].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const hex = (c) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
  const clamp = (v, hi) => Math.min(hi - 0.01, Math.max(0.01, v)), out = [];
  const corner = (x, y) => {
    const z = hAt(clamp(x, frame.w), clamp(y, frame.d)), wet = z < waterZ, d = Math.hypot(Math.max(0, -x, x - frame.w), Math.max(0, -y, y - frame.d));
    const t = Math.min(1, d / width) ** 0.7, c = base[wet ? 1 : 0];
    return { p: [x * s, y * s, (wet ? waterZ : z) * s], fill: hex(c.map((v, i) => v + (horizon[i] - v) * t)), far: d >= width };
  };
  for (let y = -width; y < frame.d + width; y += cell) for (let x = -width; x < frame.w + width; x += cell) {
    if (x >= 0 && y >= 0 && x + cell <= frame.w && y + cell <= frame.d) continue;   // the frame draws its own ground
    const c = [corner(x, y), corner(x + cell, y), corner(x + cell, y + cell), corner(x, y + cell)];
    if (c.every((q) => q.far)) continue;
    out.push({ corners: c.map((q) => q.p), fill: c[0].fill, cornerFills: c.map((q) => q.fill), doubleSided: true });
  }
  return out;
}
/** A historic city → the World page HTML (self-contained unless `cdn`). */
export function renderHistoricCityToWorld(opts = {}) {
  const { cdn = false, walk = false, ...rest } = opts;
  return emitThreeWorld({ ...assembleHistoricWorld(rest), inline: !cdn, cdn, walk, hud: false });
}

/** A plan or asset scene → the CSS 3D page (ground tiles embedded once). */
export { emitHistoric };

export function renderHistoricCityToHtml(opts = {}) {
  return emitHistoric(assembleHistoricCityScene(opts));
}

/**
 * One asset alone on a base tile, seen from the front-left and above, like the massing sheet it was
 * read from: the review view for the asset loop (set it beside the sheet).
 */
export function assembleAssetSheetScene({ asset, culture = 'sumer', size, seed = 1, kit, palette } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER;
  const A = kit[asset];
  if (!A) throw new Error(`unknown asset '${asset}'`);
  const [w, d] = size || [(A.envelope.w[0] + A.envelope.w[1]) / 2, (A.envelope.d[0] + A.envelope.d[1]) / 2];
  const pad = Math.max(w, d) * 0.45, tile = { x: 0, y: 0, w: w + 2 * pad, d: d + 2 * pad };
  const slot = { asset, rect: { x: pad, y: pad, w, d }, facing: 's', exposed: true };   // front toward +y, where the camera stands
  const placed = placeAsset(A, slot, { palette: palette || K.palette, culture: K, rng: stream(seed, `asset|${asset}`) });
  const s = 1 / METRES_PER_UNIT;
  // small pieces (a stele, a vase) get more pixels per unit, or their facets are a pixel wide
  const us = Math.round(Math.min(150, Math.max(UNIT_SCALE.aerial, UNIT_SCALE.aerial * (50 / Math.max(tile.w, tile.d)))));
  const { boxes, faces } = toScene(placed.boxes, s, us);
  // a sunk asset (a pit) shows through a hole in the sheet's ground
  const r = slot.rect, base = A.sunk
    ? [{ ...tile, d: r.y }, { ...tile, y: r.y + r.d, d: tile.d - r.y - r.d }, { ...tile, y: r.y, w: r.x, d: r.d }, { ...tile, x: r.x + r.w, y: r.y, w: tile.w - r.x - r.w, d: r.d }]
    : [tile];
  const G = groundsToScene([...base.map((t) => ({ kind: 'ground', ...t, z: 0.01, fill: K.palette.ground })), ...placed.grounds], s, us), grounds = G.grounds;
  faces.unshift(...G.faces);
  const top = Math.max(...placed.boxes.map((b) => b.z1));   // frame the tall ones by their height too
  const S = Math.max(tile.w, tile.d, top * 2.4) * s, cx = tile.w * s / 2, cy = tile.d * s / 2;
  const cameras = [{ name: 'sheet', worldFraming: { cameraPosition: [cx - S * 0.75, cy + S * 0.95, S * 0.85], lookAt: [cx, cy, top * s * 0.4], horizontalFov: 42, pictureCenter: [560, 390] } }];
  return assembleBoxCityScene({ boxes, grounds, faces, cameras, title: `mojulo historic asset · ${asset}`, bg: '#dcdcdc', light: SCENE_LIGHT, unitScale: us });
}

/**
 * An asset's blueprint (SVG): its own parts, built for a mid-envelope slot, drawn as pure geometry —
 * the step before the 3D render (see assets/blueprint.js).
 */
export function assetBlueprint({ asset, culture = 'sumer', size, seed = 1, kit, palette } = {}) {
  const K = HISTORIC_CULTURES[culture] || SUMER, A = (kit || K.assets)[asset];
  if (!A) throw new Error(`unknown asset '${asset}'`);
  const [W, D] = size || [(A.envelope.w[0] + A.envelope.w[1]) / 2, (A.envelope.d[0] + A.envelope.d[1]) / 2];
  const out = A.build({ W, D, slot: { asset, rect: { x: 0, y: 0, w: W, d: D }, facing: 'n', exposed: true } }, { palette: palette || K.palette, culture: K, rng: stream(seed, `asset|${asset}`) });
  const parts = Array.isArray(out) ? out : out.boxes;
  return assetBlueprintSvg({ id: asset, read: A.read || '', notes: A.notes || [], W, D, parts });
}
