/** render-articulation.mjs — the FORM ARTICULATION review sheets (the character light, the graphic face, the hair
 * bases, the neck form and the stand on the anime hero), and a CHARACTER CARD for any hero spec (CARD MODE, below).
 * A hero as the door mints it (heroRecord → heroPlanOf → expandPlan, the path expandLayeredManifest takes) is resolved
 * through the World resolver itself (world-scene.js resolveWorldScene), and its static faces are drawn by a software
 * depth raster coloured from the payload's OWN fills: the character light's iso-split pieces (the step, the hair
 * highlight's second split, the neck occlusion rule) are flat-filled, so for the figure a face-id raster + fill IS the
 * World bake, with no shading of its own (held gear is drawn in its baked fill alone: see CARD MODE). Each face's
 * palette group and part (the head framing and the lit shares read them) come from re-deriving the resolver's faces
 * with the same exported calls (station-loft-shade.js, hero-gesture.js, and hero-gear.js for a hero's held gear, which
 * the payload carries after the figure's own faces: group Gear, part gear.<slot>, baked by the studio key, never lit by
 * the character light); the run REFUSES when those differ from the payload by one face, coordinate, fill, draw layer
 * or ink mark, the gear's included, so a drifted resolver can never feed a sheet. The outline is the World's character
 * ink in screen space: an
 * outward band `toon.ink.widthAbs` wide (projected per pixel), wherever the depth buffer breaks by more than that width
 * against the local slope, never from a drawn feature (`noInk`: the eye lenses, the strokes, the mouth); a payload
 * without ink draws none (the World as it was). The World's DRAW LAYERS (a payload face's `layer`, the page's stencil
 * rules, channels/draw-layers.js) are emulated per pixel: a `through` face (a brow, a lid band) that wins the raster of
 * every face but the `veil` (the fringe) takes the pixel wherever the full raster's winner is a veil face, and a hair
 * face's band (`hair` or `veil`) is never drawn over a pixel whose visible face is hair, nor a veil's over a through
 * pixel. Supersampled 2× (head, bust, parity) / 4× (body), box-filtered. The head frames the skull and the hair above
 * the chin (hair hanging below the chin never widens it), so a long cut does not shrink the face.
 *   articulation-progression-<cast>.png  a BASELINE (--baseline <dir>: the anime-<cast>.json manifests an earlier
 *                                  --parity run wrote, drawn as stored) beside the door's default today, on one lens
 *   articulation-expressions.png   the default at neutral, blink, smile, open, angry, surprised and deadpan: head ¾
 *                                  and front per cast
 *   articulation-stands.png        each stand (rest, relaxed, hand-on-hip, guard) at 256 px ¾ and front, and as black
 *                                  silhouettes; the label carries the hero readout's stand (clearance, free sole)
 *   articulation-before-after.png  per cast: the World as it was (toon.light false, gesture rest), the character light
 *                                  at rest (gesture rest), and the default (the character light, the relaxed stand) —
 *                                  so the light is judged apart from the stand
 *   articulation-keys.png          the default under three key directions: the default key, its mirror (the key on
 *                                  the far side from the ¾ camera), a high top-front key
 *   articulation-measures.json     per render: faces, payload bytes, and the lit share of Skin / Hair / face pixels;
 *                                  `gates`: the hair lit at the rear ¾ and the ¾, and the hair's lit and shade tones
 *                                  against the World backdrop in CIE L* (`hairValue`)
 * Rows of the progression: head ¾ (first), front, profile from the key's side and from the shade side, rear ¾ 20° down
 * (the gameplay camera, key side), the bust ¾, the body at 256 px ¾ and front, 128 px ¾, a black silhouette (256 px ¾),
 * a 3-value thumbnail (128 px ¾: the figure posterised to light / mid / dark at CIE L* 66 / 33), and the head ¾ on the
 * World's own backdrop (the payload's `bg`: the hair and the outline against the dark the product shows them on). The
 * before/after and keys sheets keep their rows: head ¾, front, the key-side profile and rear ¾ (they move with the key),
 * 256 px ¾ and front, 128 px ¾, the head ¾ and 256 px ¾ on the backdrop, the silhouette (before/after only: a key never
 * moves it) and the 3-value thumbnail.
 * THE BASELINE is resolved through today's World resolver like any manifest (parity-guarded the same way); the page and
 * bake rules it predates are named with --predates (comma-separated) and emulated off: `neck-shade` and `hair-top`
 * re-derive the pieces without the neck occlusion rule and the hair's top planes (characterLitPieces' own switches;
 * every face they do not reach is checked equal to the payload's), `draw-layers` drops the faces' `layer` (the page
 * before the stencil rules). A baseline's own light is its manifest's `toon.light`.
 * PARITY with the World page: --parity writes parity/ — the default hero's manifest, a lookdev-shots camera list (the
 * World's own front camera and the head ¾) and this raster at those cameras over every payload face (the studio floor
 * too, on the payload's background; a floor strip running under the camera is dropped — the raster has no near-plane
 * clip). A standing hero's page opens on its static solid (the stand, skinned exactly: preview `solid: 'stand'`), the
 * faces this raster draws. Capture the page, then compare:
 *   node scripts/lookdev-shots.mjs <out>/parity/anime-female.json <out>/parity/capture <out>/parity/shots.json --width 900 --height 900
 *   node ../docs/examples/humanoid/render-articulation.mjs --only parity --compare <out>/parity/capture
 * which writes parity-<dir>-<shot>.png (raster | capture | difference ×3) and parity-<dir>.json (the mean colour
 * difference inside the figure, the share of figure pixels off by more than 48 of 255, the whole frame's mean).
 * Diagnostic renders for the eyes gate; nothing here is a recipe change. Deterministic. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-articulation.mjs [--cast female] [--head 384]
 *     [--only progression,expressions,stands,before-after,keys | parity] [--baseline <dir>] [--predates neck-shade,hair-top,draw-layers]
 *     [--parity] [--compare <capture dir>]   (default --only: progression,expressions,stands; parity: the first --cast)
 * CARD MODE (--spec <file.json>): { name, hero: { <the hero door's fields> }, toon?, palette? } (a key starting with $
 * is a comment) is taken through the hero door's own steps without a database (layered.js: HERO_FIELDS → heroRecord
 * (validateHeroSpec) → heroPlanOf → expandLayeredManifest → the toon light's check → planLayered → heroReadout), refusing
 * with the door's own messages (exit 1) wherever the door would; `palette` rides the hero (a hero field), `toon` the
 * manifest (as the door stores it). The manifest is resolved through the World resolver under the same parity guard as
 * the review sheets. Writes <out>/<name>/readout.json (the hero readout the door returns) and <out>/<name>/card.png: the
 * spec's words and what the door read; the head ¾ at 512 px; at 256 px the head front, the key-side profile, the rear ¾
 * 20° down and the head ¾ on the World backdrop; the bust ¾, the body ¾, front and from behind (rear ¾ 20° down, the
 * gameplay camera), a silhouette and a 3-value render (the profile and both rears stand on the spec's key side). A hero
 * with `gear` (the door's held and carried equipment) is drawn with it in its baked fill (the studio bake): its faces
 * re-derived (gearMounts, then gearFaces at the stand's bone frames) and held to the parity guard with the figure's.
 * The World page's metal and specular channels, which re-shade a blade, and any texture are not drawn, and the guard
 * does not hold them. The body frames take their height and floor from the figure with its gear (so a long item shrinks
 * the figure) and aim across at the figure's own box (so a blade held forward never pulls the frame off the feet).
 * --expr adds expressions.png (the head ¾ at 256 px for every expression word the worn head takes, each minted through
 * the door); --check-lens adds head-3q-review-lens.png (the head ¾ at the review sheets' lens, frozen on the same hero
 * at gesture rest with toon.light false, to lay over a column of a progression sheet). SHEET MODE (--sheet
 * <config.json>: { columns: [{ spec, summary }], title?, sheet?, expressions? }, spec paths relative to the config)
 * draws the specs side by side, one lens per row (sheetMain), the body from the ¾ and from behind (rear ¾ 20° down)
 * with any held gear, parity-guarded and framed as on a card; --expr adds a row of expressions per spec. <out> is
 * --out, else cast/ under the spike tree. docs/examples/humanoid/cast/ holds worked specs. Run from control:
 *   node ../docs/examples/humanoid/render-articulation.mjs --spec ../docs/examples/humanoid/cast/lead.json [--expr]
 *     [--check-lens] [--out <dir>]
 *   node ../docs/examples/humanoid/render-articulation.mjs --sheet <config.json> [--expr] [--out <dir>] */
import { register, createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

register('../../../control/scripts/mcp-stdio-loader.mjs', import.meta.url);   // the `@/` alias the resolver's modules import through
const lib = (p) => import(new URL(`../../../control/lib/${p}`, import.meta.url).href);
const sharp = createRequire(new URL('../../../control/package.json', import.meta.url))('sharp');
const { HERO_FIELDS, heroRecord, heroPlanOf, heroReadout, planLayered, expandLayeredManifest, gestureReadout } = await lib('mcp/tools/layered.js');
const { ANIME_POSES } = await lib('graph/polygonizer/anime-head.js');
const { EXPRESSIONS: LANDMARK_EXPRESSIONS } = await lib('graph/polygonizer/humanoid-head.js');
const { resolveWorldScene } = await lib('graph/worlds/world-scene.js');
const { compileLayered } = await lib('graph/polygonizer/station-loft.js');
const { layeredSeat, persistedLayeredLedger, swimCells } = await lib('graph/polygonizer/station-loft-faces.js');
const { seatPanels } = await lib('graph/polygonizer/seat-panels.js');
const { validateRig, bindLayered, rigNodesAt, boneFrames } = await lib('graph/polygonizer/station-loft-rig.js');
const { standPose, poseLayered, rigidParts, GESTURE_WORDS } = await lib('graph/polygonizer/hero-gesture.js');
const { resolveCharacterLight, layeredShadingNormals, characterLitPieces, ANIME_CHARACTER_LIGHT, derivedHighlight, drawLayer } = await lib('graph/polygonizer/station-loft-shade.js');
const { resolveToon, toonLightErrors, withBands } = await lib('graph/polygonizer/vexar.js');
const { gearMounts, gearFaces } = await lib('graph/polygonizer/hero-gear.js');
const { WORKBENCH_LIGHT } = await lib('graph/worlds/workbench.js');

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0928/spike-output/form-articulation', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const argOf = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : undefined);
const CASTS = argOf('--cast') ? [argOf('--cast')] : ['female', 'male'];
const HEAD_PX = Number(argOf('--head') ?? 384);
const ONLY = new Set((argOf('--only') ?? 'progression,expressions,stands').split(',').map((s) => (s === 'gestures' ? 'stands' : s)));
const PREDATES = new Set((argOf('--predates') ?? '').split(',').filter(Boolean));
for (const r of PREDATES) if (!['neck-shade', 'hair-top', 'draw-layers'].includes(r)) throw new Error(`--predates: unknown rule '${r}' (have neck-shade, hair-top, draw-layers)`);

// ─── a small vector kit ────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hexRgb('#e9e6df'), SIL = hexRgb('#1b1a19'), PAPER = hexRgb('#f7f5f0');
const VALUES = [hexRgb('#35312d'), hexRgb('#8f897f'), hexRgb('#d9d4ca')];   // dark, mid, light
const HEAD_RE = /^(cranium|face|ear|brow|hair|iris|pupil|lash|lid|catch|noseLine)/;   // the graphic face adds the lid bands, catchlights and nose line

// ─── the hero, through the door and the World resolver ─────────────────────
/** The faces the layered resolver emits for `m`, re-derived with its own calls (world-kinds.js `layered`), with each
 * face's source: palette group, part, lit (character light only), its draw layer and ink mark (`noInk`); a hero's held
 * gear follows the figure's own faces, as in the payload (heldGear). Returns the rest mesh for the readouts and `gear`,
 * the count of held-gear faces at the tail. `occlusion: false` / `hairTop: false` derive the pieces as they were before
 * the neck occlusion rule / the hair's top planes (characterLitPieces' `neckShade` / `hairTop` turned off). */
function resolverFaces(m, { occlusion = true, hairTop = true } = {}) {
  const mesh = compileLayered(m.recipe, m.dials || {}, m.channels || {});
  const rigged = !!(m.recipe?.rig && m.recipe?.clips && Object.keys(m.recipe.clips).length);
  const rig = rigged ? (() => { const R = validateRig(m.recipe.rig); return { R, skin: bindLayered(mesh, m.recipe, R) }; })() : null;
  const stand = rig && m.hero ? standPose(m.recipe, rig.R) : null;
  const shown = stand ? poseLayered(mesh, m.recipe, stand, rig).mesh : mesh; const dz = layeredSeat(mesh, m.seat !== false);
  const raw = m.toon ?? m.scene?.toon, toon = resolveToon(raw, { light: true }), light = resolveCharacterLight(m, { toon });
  const pal = m.recipe.palette || {}, gear = heldGear(m, rig, stand, dz, toon);
  if (light) {
    const normals = layeredShadingNormals(shown, m.recipe, stand ? { rest: mesh, rigid: rigidParts(mesh, rig.skin, rig.R, 'head') } : {});
    const pieces = characterLitPieces(shown, { light, normals, palette: pal, dz, rest: mesh, ...(occlusion ? {} : { neckShade: false }), ...(hairTop ? {} : { hairTop: false }) });   // the highlight's band rides the rest head
    const hairInk = raw?.ink !== false;   // the character ink is on unless the manifest says `toon.ink: false` (characterInk)
    // lit: the base swatch or its highlight (a third tone on the lit side), not the shade
    return { mesh, light, gear: gear.length, faces: [...pieces.map((p) => {
      const g = shown.groups[p.fi], base = pal[g] || shown.parts[p.part]?.tint, layer = drawLayer(shown, p, { hairInk });
      return { corners: p.refs.map((r) => r.p), fill: p.fill, group: g, part: p.part, ...(p.mark ? { noInk: true } : {}), ...(layer ? { layer } : {}),
        lit: p.mark ? null : p.fill === base || (!!light.highlight?.[g] && !!base && p.fill === (pal[`${g}Highlight`] || derivedHighlight(base))) };
    }), ...gear] };
  }
  // the studio faces, a face the swimsuit's seat panel cuts as its cells (layeredFaces' own cut: swimCells on the rest panels)
  const faces = [], panels = seatPanels(mesh);
  shown.faces.forEach((tri, fi) => {
    const corners = tri.map((vi) => { const v = shown.vertices[vi]; return [v[0], v[1], v[2] + dz]; });
    const n = cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])), part = shown.provenance[tri[0]].part;
    if (!(Math.hypot(n[0], n[1], n[2]) > 1e-14)) return;
    const cut = swimCells(corners, panels && panels.at(fi, shown.groups[fi]));
    if (cut) for (const c of cut) faces.push({ corners: c.corners, fill: null, group: c.inside ? 'Swim' : shown.groups[fi], part, lit: null });
    else faces.push({ corners, fill: null, group: shown.groups[fi], part, lit: null });
  });
  return { mesh, light: null, gear: gear.length, faces: [...faces, ...gear] };
}
/** HELD GEAR as the resolver bakes it (world-kinds.js `layered`, hero-gear.js): a rigged hero's `gear` mounted on its
 * bones at rest (gearMounts), carried by the stand's bone frames (boneFrames at rigNodesAt of the stand; the rest pose
 * without one), seated on the rest floor (`dz`), baked by the studio key (the World's default, banded by the toon dial)
 * in the body's render group. Lowered one mount at a time so each face knows its slot: palette group 'Gear', part
 * `gear.<slot>`, lit null (the character light never reaches it); the parity guard holds the concatenation to the
 * payload's tail, so a resolver that lowered them otherwise would refuse. No gear (or no rig) ⇒ none. */
function heldGear(m, rig, stand, dz, toon) {
  const mounts = rig && m.hero?.gear ? gearMounts(m.hero, rig.R) : [];
  if (!mounts.length) return [];
  const frames = stand ? boneFrames(rig.R, rig.R.joints, rigNodesAt(rig.R, stand).nodes) : null;
  const light = withBands(WORKBENCH_LIGHT, resolveToon(toon)?.bands);
  return mounts.flatMap((G) => gearFaces([G], { frames, light, dz, group: 'body' }).map((f) => ({ corners: f.corners, fill: f.fill, group: 'Gear', part: `gear.${G.slot}`, lit: null,
    ...(f.noInk ? { noInk: true } : {}), ...(f.layer ? { layer: f.layer } : {}) })));
}
const sameCorners = (f, o) => f.corners.length === o.corners.length && f.corners.every((c, k) => c.every((v, j) => v === o.corners[k][j]));

/** A manifest resolved as the World page resolves it: `{ hero, manifest, payload, faces, gear, mesh, ink }`, where
 * `faces` are the payload's static faces (fill, corners, noInk and layer as emitted) carrying their re-derived group and
 * part, the hero's held gear last (`gear` of them, group 'Gear', part gear.<slot>). The PARITY GUARD refuses when the
 * re-derivation differs from the payload by one face, coordinate, fill, layer or ink mark, the gear's faces included.
 * `predates` (a baseline's rules to emulate off, see the header): 'neck-shade' / 'hair-top' take the pieces derived
 * without the neck occlusion rule / the hair's top planes (every face off the neck / off the hair checked equal to the
 * payload's), 'draw-layers' drops each `layer`. */
async function resolveManifest(manifest, name, { predates = new Set() } = {}) {
  const { payload } = await resolveWorldScene({ ref: 'render-articulation', title: `anime hero · ${name}`, manifest });
  const shown = payload.faces.filter((f) => !f.studio); const own = resolverFaces(manifest), body = own.faces.length - own.gear;
  if (own.faces.length !== shown.length) throw new Error(`parity guard (${name}): the resolver emitted ${shown.length} static faces, the re-derivation ${own.faces.length}${own.gear ? ` (${body} of the figure, ${own.gear} of its held gear)` : ''}`);
  // every face, the held gear's too (always filled: the studio bake), by coordinate, fill, draw layer and ink mark
  shown.forEach((f, i) => {
    const o = own.faces[i];
    if ((o.fill !== null && (o.fill !== f.fill || (o.layer ?? null) !== (f.layer ?? null) || !!o.noInk !== !!f.noInk)) || !sameCorners(f, o)) throw new Error(`parity guard (${name}): ${i < body ? `static face ${i}` : `held gear face ${i - body} (${o.part})`} differs from the re-derivation`);
  });
  let faces = shown.map((f, i) => ({ ...f, group: own.faces[i].group, part: own.faces[i].part, lit: own.faces[i].lit }));
  const noNeck = predates.has('neck-shade'), noTop = predates.has('hair-top');
  if ((noNeck || noTop) && own.light) {
    const before = resolverFaces(manifest, { occlusion: !noNeck, hairTop: !noTop }).faces, off = (list) => list.filter((f) => !(noNeck && f.part === 'neck') && !(noTop && f.group === 'Hair'));
    const a = off(faces), b = off(before);
    if (a.length !== b.length || a.some((f, i) => f.fill !== b[i].fill || !sameCorners(f, b[i]))) throw new Error(`parity guard (${name}): without ${[noNeck && 'the neck occlusion rule', noTop && "the hair's top planes"].filter(Boolean).join(' and ')} a face they do not reach moved`);
    faces = before;
  }
  if (predates.has('draw-layers')) faces = faces.map(({ layer: _layer, ...f }) => f);
  const ink = payload.toon?.ink ? { color: payload.toon.ink.color ?? '#101015', width: payload.toon.ink.widthAbs ?? null } : null;
  return { hero: manifest.hero, manifest, payload, faces, gear: own.gear, mesh: own.mesh, light: own.light, ink, bytes: Buffer.byteLength(JSON.stringify(payload)) };
}
/** The anime hero of `cast` as the door mints it, with any of the door's `gesture` / `expression` words and a manifest
 * `toon` beside it. */
async function resolveHero(cast, { gesture, toon, expression } = {}) {
  const hero = heroRecord({ cast, head: 'anime', ...(gesture !== undefined ? { gesture } : {}), ...(expression !== undefined ? { expression } : {}) });
  return resolveManifest({ ...expandLayeredManifest({ kind: 'layered', hero }), ...(toon ? { toon } : {}) }, cast);
}

// ─── cameras ───────────────────────────────────────────────────────────────
/** az: degrees from the front (+y) toward +x (the figure's right); el: degrees above the target. A view with `keySide`
 * stands on the KEY's side (`side` +1: +x, the default key's; −1: −x) times its sign: the profile and the rear ¾ show the
 * lit side and move with the key, the shade profile the other side. */
const VIEWS = {
  threequarter: { az: 45, el: 4, label: '¾' },
  front: { az: 0, el: 2, label: 'front' },
  profile: { az: 90, el: 2, label: 'profile (key side)', keySide: 1 },
  shade: { az: 90, el: 2, label: 'profile (shade side)', keySide: -1 },
  rear: { az: 135, el: 20, label: 'rear ¾, 20° down', keySide: 1 },
};
function boxOf(faces, keep = null, corner = null) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) { if (keep && !keep(f)) continue; for (const p of f.corners) { if (corner && !corner(p)) continue; for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; } } }
  return { mn, mx, c: mn.map((v, k) => (v + mx[k]) / 2), size: mx.map((v, k) => v - mn[k]) };
}
const isHead = (f) => HEAD_RE.test(f.part);
/** the head's box: its parts' corners at or above the chin (the lowest corner of the face shell and the cranium core),
 * so hair hanging below the chin (a long cut) never moves or widens the frame */
function headBox(faces) {
  let chin = Infinity;
  for (const f of faces) if (f.part === 'face' || f.part === 'cranium') for (const p of f.corners) if (p[2] < chin) chin = p[2];
  const b = boxOf(faces, isHead, Number.isFinite(chin) ? (p) => p[2] >= chin : null);
  // a hero with no worn head (`head: 'none'`, a blank trunk) frames its part named `head`
  return Number.isFinite(b.mn[0]) ? b : boxOf(faces, (f) => f.part === 'head');
}
/** The per-cast LENS, frozen on a reference render (the rest figure) so every column of a cast shares the scale; each
 * render then aims it at its own head / figure centre. head: 16° vfov over the head box × 1.3; bust: the same lens 1.7×
 * as far, its frame's top a little over the head frame's; body: the figure `px` tall on a `w × h` canvas from the 22°
 * full-body distance. The head frame is `headPx` square (default --head). */
function lensOf(faces, headPx = HEAD_PX) {
  const h = headBox(faces), ext = Math.max(h.size[2] + 0.05, h.size[0], h.size[1]) * 1.3;
  const a = boxOf(faces), H = a.size[2], D = (H * 1.08 / 2) / Math.tan(rad(11));
  const body = (px, w, hh) => ({ distance: D, vfov: deg(2 * Math.atan((H / 2) * (hh / px) / D)), width: w, height: hh, ss: 4, floorZ: a.mn[2], H });
  const head = { distance: (ext / 2) / Math.tan(rad(8)), vfov: 16, width: headPx, height: headPx, ss: 2, ext };
  return { head, bust: { ...head, distance: head.distance * 1.7 }, body256: body(256, 160, 288), body128: body(128, 80, 144) };
}
/** the figure's own box, its held gear left out: the body cells aim across at it, so a blade held forward or out to
 * the side never pulls the frame off the feet (the lens's height and floor still come from the whole box) */
const figureBox = (faces) => boxOf(faces, (f) => f.group !== 'Gear');
function aim(lens, faces, name) {
  if (name === 'head' || name === 'bust') { const h = headBox(faces), L = lens[name]; return { ...L, target: [h.c[0], h.c[1], h.c[2] - 0.025 - (name === 'bust' ? 0.3 * L.ext : 0)] }; }
  const L = lens[name], a = figureBox(faces); return { ...L, target: [a.c[0], a.c[1], L.floorZ + L.H / 2] };
}
function orbit(fr, view, side = 1) {
  const v = VIEWS[view], a = rad(v.keySide ? v.keySide * side * v.az : v.az), e = rad(v.el), dir = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
  return { ...fr, pos: fr.target.map((t, k) => t + fr.distance * dir[k]) };
}
function camera({ pos, target, vfov }, W, H) {
  const fwd = unit(sub(target, pos)), right = unit(cross(fwd, [0, 0, 1])), up = cross(right, fwd);
  return { pos, fwd, right, up, f: (H / 2) / Math.tan(rad(vfov / 2)) };
}

// ─── the raster ────────────────────────────────────────────────────────────
/** a z-buffer over a face soup: per pixel the nearest face index and its view depth (perspective-correct); a triangle
 * reaching behind the camera plane is dropped whole (no near clip: only a floor strip under a World camera meets it) */
function rasterize(faces, cam, W, H) {
  const depth = new Float32Array(W * H).fill(Infinity), fid = new Int32Array(W * H).fill(-1);
  const proj = (p) => { const d = sub(p, cam.pos), z = dot(d, cam.fwd); return [W / 2 + cam.f * dot(d, cam.right) / z, H / 2 - cam.f * dot(d, cam.up) / z, z]; };
  faces.forEach((f, fi) => {
    const P = f.corners.map(proj);
    for (let t = 1; t + 1 < P.length; t++) {   // a fan (every layered face is a triangle; the studio floor a quad)
      const [x0, y0, z0] = P[0], [x1, y1, z1] = P[t], [x2, y2, z2] = P[t + 1];
      if (!(z0 > 1e-3 && z1 > 1e-3 && z2 > 1e-3)) continue;
      const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(den) <= 1e-12) continue;
      const ia = Math.max(0, Math.floor(Math.min(x0, x1, x2))), ib = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
      const ja = Math.max(0, Math.floor(Math.min(y0, y1, y2))), jb = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
      for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
        const x = i + 0.5, y = j + 0.5;
        const ba = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / den, bb = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / den, bc = 1 - ba - bb;
        if (ba < -1e-9 || bb < -1e-9 || bc < -1e-9) continue;
        const d = 1 / (ba / z0 + bb / z1 + bc / z2), k = j * W + i; if (!(d < depth[k])) continue;
        depth[k] = d; fid[k] = fi;
      }
    }
  });
  return { depth, fid };
}

/** The character ink in screen space: from every pixel of an inked face whose neighbour is empty, or deeper than the
 * ink width beyond the local slope (a second difference, so a grazing surface is no edge), an outward disc of the
 * ink width projected at that depth marks the pixels BEHIND it: the inverted hull's band past the silhouette and over
 * the farther surface at an occlusion, never over a nearer one. */
function inkBand(R, faces, cam, W, H, w) {
  const { depth, fid } = R, ink = new Uint8Array(W * H);
  const deeper = (k, q, p) => fid[q] < 0 || depth[q] - depth[k] > w + (p >= 0 && fid[p] >= 0 ? Math.max(0, depth[k] - depth[p]) * 1.5 : 0);
  // the draw layers' hull rule: a hair hull (hair, veil) skips pixels whose visible face is hair; a veil's, through pixels too
  const isHair = (q) => fid[q] >= 0 && (faces[fid[q]].layer === 'hair' || faces[fid[q]].layer === 'veil');
  const blocked = (layer, q) => (layer === 'hair' || layer === 'veil') && (isHair(q) || (layer === 'veil' && fid[q] >= 0 && faces[fid[q]].layer === 'through'));
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, fi = fid[k]; if (fi < 0 || faces[fi].noInk || faces[fi].studio || faces[fi].layer === 'through') continue;
    const layer = faces[fi].layer;
    let edge = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const q = jj * W + ii; if (blocked(layer, q)) continue;
      const pi = i - di, pj = j - dj, p = pi < 0 || pj < 0 || pi >= W || pj >= H ? -1 : pj * W + pi;
      if (deeper(k, q, p)) { edge = true; break; }
    }
    if (!edge) continue;
    const d = depth[k], r = w * cam.f / d, ri = Math.ceil(r), r2 = r * r;
    for (let dj = -ri; dj <= ri; dj++) for (let di = -ri; di <= ri; di++) {
      if (di * di + dj * dj > r2) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue;
      const q = jj * W + ii; if (blocked(layer, q)) continue;
      if (fid[q] < 0 || depth[q] - d > w) ink[q] = 1;
    }
  }
  return ink;
}
/** the draw layers' fill rule on a raster: a `through` face that wins the raster of every face but the veil takes the
 * pixel wherever the full raster's winner is a `veil` face (the brow drawn through the fringe; from behind the skull
 * wins that raster, so nothing moves) */
function throughVeil(R, faces, cam, W, H) {
  if (!faces.some((f) => f.layer === 'through')) return R;
  const idx = []; faces.forEach((f, i) => { if (f.layer !== 'veil') idx.push(i); });
  const RN = rasterize(idx.map((i) => faces[i]), cam, W, H);
  for (let k = 0; k < W * H; k++) {
    const n = RN.fid[k]; if (n < 0 || R.fid[k] < 0) continue;
    if (faces[idx[n]].layer === 'through' && faces[R.fid[k]].layer === 'veil') { R.fid[k] = idx[n]; R.depth[k] = RN.depth[k]; }
  }
  return R;
}

/** One cell: `{ rgb, cover, width, height, stats }`. mode 'fill' (the payload's fills + the ink), 'silhouette' (black,
 * no ink), 'value' (the fill render posterised to three values). */
function cell(R0, fr, mode = 'fill', { bg = BG, all = null } = {}) {
  const faces = all ?? R0.faces, SS = fr.ss, W = fr.width * SS, H = fr.height * SS, cam = camera(fr, W, H), R = throughVeil(rasterize(faces, cam, W, H), faces, cam, W, H);
  const ink = mode !== 'silhouette' && R0.ink ? inkBand(R, faces, cam, W, H, R0.ink.width ?? 0.0015 * boxOf(R0.faces).size[2]) : null;
  const INK = R0.ink ? hexRgb(R0.ink.color) : null, cache = new Map(), fillOf = (f) => { let c = cache.get(f.fill); if (!c) cache.set(f.fill, c = hexRgb(f.fill)); return c; };
  const big = new Float32Array(W * H * 3), cov = new Uint8Array(W * H), st = { Skin: [0, 0], Hair: [0, 0], face: [0, 0] };
  for (let k = 0; k < W * H; k++) {
    const fi = R.fid[k], f = fi >= 0 ? faces[fi] : null; let c = bg;
    if (f && !f.studio) cov[k] = 1;
    if (ink && ink[k]) c = INK;
    else if (f) {
      c = mode === 'silhouette' && !f.studio ? SIL : fillOf(f);
      if (f.lit != null && st[f.group]) { st[f.group][1]++; if (f.lit) st[f.group][0]++; }
      if (f.lit != null && f.group === 'Skin' && f.part === 'face') { st.face[1]++; if (f.lit) st.face[0]++; }
    }
    big[k * 3] = c[0]; big[k * 3 + 1] = c[1]; big[k * 3 + 2] = c[2];
  }
  const w = fr.width, h = fr.height, rgb = Buffer.alloc(w * h * 3), cover = new Float32Array(w * h), n = SS * SS;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = [0, 0, 0]; let cv = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const k = (y * SS + dy) * W + x * SS + dx; s[0] += big[k * 3]; s[1] += big[k * 3 + 1]; s[2] += big[k * 3 + 2]; cv += cov[k]; }
    for (let ch = 0; ch < 3; ch++) rgb[(y * w + x) * 3 + ch] = Math.round(s[ch] / n);
    cover[y * w + x] = cv / n;
  }
  if (mode === 'value') for (let i = 0; i < w * h; i++) {
    const v = cover[i] < 0.5 ? PAPER : VALUES[(() => { const L = lstar(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]); return L < 33 ? 0 : L < 66 ? 1 : 2; })()];
    rgb[i * 3] = v[0]; rgb[i * 3 + 1] = v[1]; rgb[i * 3 + 2] = v[2];
  }
  const stats = Object.fromEntries(Object.entries(st).filter(([, v]) => v[1]).map(([g, v]) => [g, +(v[0] / v[1]).toFixed(3)]));
  return { rgb, cover, width: w, height: h, stats };
}
/** a cell pixel-doubled `k`× (nearest neighbour: a 128 px cell keeps every pixel it has, at a size the sheet shows) */
function zoom(c, k) {
  if (!(k > 1)) return c;
  const w = c.width * k, h = c.height * k, rgb = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const at = (Math.floor(y / k) * c.width + Math.floor(x / k)) * 3; c.rgb.copy(rgb, (y * w + x) * 3, at, at + 3); }
  return { ...c, rgb, width: w, height: h };
}
/** CIE L* of an sRGB colour (0–255 channels) */
function lstar(r, g, b) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const Y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : Y * 24389 / 27;
}

// ─── the sheet ─────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function label(w, h, lines, { size = 14, bg = '#dcd8d0', weight = 400, pad = 8 } = {}) {
  const L = Array.isArray(lines) ? lines : [lines], lh = Math.round(size * 1.3);
  const t = L.map((s, i) => `<text x="${pad}" y="${pad + size + i * lh}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${i === 0 ? weight : 400}" fill="#23201d">${esc(s)}</text>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/>${t}</svg>`);
}
/** rows × columns of cells, labelled: columns [label | lines], rows [{ label, cells }] (a missing cell stays blank) */
/** words of `s` wrapped to lines of at most `n` characters */
function wrap(s, n) {
  const out = []; let line = '';
  for (const w of String(s).split(' ')) { if (line && line.length + 1 + w.length > n) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w; }
  if (line) out.push(line);
  return out;
}
async function sheet(name, { title, note, columns, rows, gutter = 230, file: fileAt = null }) {
  const pad = 6, headH = 40;
  const colLines = columns.map((c) => (Array.isArray(c) ? c : [c])), colH = 12 + 17 * Math.max(...colLines.map((l) => l.length));
  const colW = columns.map((_, c) => Math.max(...rows.map((r) => r.cells[c]?.width ?? 0)));
  const rowH = rows.map((r) => Math.max(...r.cells.map((c) => c?.height ?? 0), 17 * (Array.isArray(r.label) ? r.label.length : 1) + 16));
  const W = gutter + colW.reduce((s, v) => s + v + pad, 0) + pad;
  // the note wrapped to the sheet's width (13 px Helvetica runs about 6 px a character)
  if (note) note = (Array.isArray(note) ? note : [note]).flatMap((l) => wrap(l, Math.floor((W - 12) / 6.4)));
  const noteH = note ? 22 * note.length + 6 : 0, Ht = headH + noteH + colH + rowH.reduce((s, v) => s + v + pad, 0) + pad;
  const layers = [{ input: label(W, headH, title, { size: 19, weight: 700, bg: '#c9c4bb' }), left: 0, top: 0 }];
  if (note) layers.push({ input: label(W, noteH, note, { size: 13, bg: '#c9c4bb', pad: 6 }), left: 0, top: headH });
  let x = gutter + pad; const y0 = headH + noteH;
  colLines.forEach((l, c) => { layers.push({ input: label(colW[c], colH, l, { size: 12, weight: 700, pad: 5 }), left: x, top: y0 }); x += colW[c] + pad; });
  let y = y0 + colH + pad;
  rows.forEach((r, ri) => {
    layers.push({ input: label(gutter, rowH[ri], r.label, { size: 13, weight: 700 }), left: 0, top: y });
    let cx = gutter + pad;
    r.cells.forEach((c, ci) => { if (c) layers.push({ input: c.rgb, raw: { width: c.width, height: c.height, channels: 3 }, left: cx + Math.floor((colW[ci] - c.width) / 2), top: y + Math.floor((rowH[ri] - c.height) / 2) }); cx += colW[ci] + pad; });
    y += rowH[ri] + pad;
  });
  const file = fileAt ?? `${OUT}/${name}.png`;   // sheet mode writes beside the cards
  writeFileSync(file, await sharp({ create: { width: W, height: Ht, channels: 3, background: '#bdb8ae' } }).composite(layers).png().toBuffer());
  console.log(`wrote ${file}`);
}

// ─── the renders ───────────────────────────────────────────────────────────
const KEY = ANIME_CHARACTER_LIGHT.toLight;
const sideOf = (v) => (v[0] < 0 ? -1 : 1);
const angles = (v) => `${Math.round(deg(Math.asin(v[2])))}° up, ${Math.abs(Math.round(deg(Math.atan2(v[0], v[1]))))}° to ${v[0] < 0 ? '−x (the figure’s left)' : '+x (the figure’s right)'}`;
const HIGH = unit([sideOf(KEY) * Math.sin(rad(15)) * Math.cos(rad(55)), Math.cos(rad(15)) * Math.cos(rad(55)), Math.sin(rad(55))]);
const KEYS = [['the default key', null, KEY], ['its mirror', [-KEY[0], KEY[1], KEY[2]], [-KEY[0], KEY[1], KEY[2]]], ['high top-front', HIGH, HIGH]];
const DARK = (R) => hexRgb(R.payload.bg || '#0d1218');
const ROWS = [
  ['head', 'threequarter', 'fill', ['head · ¾', 'camera on +x (the figure’s right)']], ['head', 'front', 'fill', ['head · front']],
  ['head', 'profile', 'fill', ['head · profile', 'from the key’s side']], ['head', 'rear', 'fill', ['head · rear ¾, 20° down', 'the gameplay camera, key side']],
  ['body256', 'threequarter', 'fill', ['256 px · ¾']], ['body256', 'front', 'fill', ['256 px · front']], ['body128', 'threequarter', 'fill', ['128 px · ¾', 'shown pixel-doubled']],
  ['head', 'threequarter', 'dark', ['head · ¾ on the World backdrop', 'the payload’s own bg']], ['body256', 'threequarter', 'dark', ['256 px · ¾ on the World backdrop']],
  ['body256', 'threequarter', 'silhouette', ['silhouette · 256 px ¾']], ['body128', 'threequarter', 'value', ['3 values · 128 px ¾', 'L* < 33 / 33–66 / ≥ 66', 'shown pixel-doubled']],
];
/** the progression's rows (the head ¾ first) */
const PROGRESSION_ROWS = [
  ['head', 'threequarter', 'fill', ['head · ¾', 'camera on +x (the figure’s right)']], ['head', 'front', 'fill', ['head · front']],
  ['head', 'profile', 'fill', ['head · profile (key)', 'the key’s side']], ['head', 'shade', 'fill', ['head · profile (shade)', 'the shade side']],
  ['head', 'rear', 'fill', ['head · rear ¾, 20° down', 'the gameplay camera, key side']], ['bust', 'threequarter', 'fill', ['bust · ¾']],
  ['body256', 'threequarter', 'fill', ['256 px · ¾']], ['body256', 'front', 'fill', ['256 px · front']], ['body128', 'threequarter', 'fill', ['128 px · ¾', 'shown pixel-doubled']],
  ['body256', 'threequarter', 'silhouette', ['silhouette · 256 px ¾']], ['body128', 'threequarter', 'value', ['3 values · 128 px ¾', 'L* < 33 / 33–66 / ≥ 66', 'shown pixel-doubled']],
  ['head', 'threequarter', 'dark', ['head · ¾ on the World backdrop', 'the payload’s own bg']],
];
const EXPRESSIONS = ['neutral', 'blink', 'smile', 'open', 'angry', 'surprised', 'deadpan'];
const measures = [];
/** the hair's VALUE against the World page's own backdrop: its lit and shade tones (the commonest fill of its lit and
 * shaded faces) and the backdrop, as CIE L*, and the gaps between them (the shade side has to part from the dark) */
function hairValue(R) {
  const commonest = (lit) => { const n = new Map(); for (const f of R.faces) if (f.group === 'Hair' && f.lit === lit) n.set(f.fill, (n.get(f.fill) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
  const L = (hex) => +lstar(...hexRgb(hex)).toFixed(1), lit = commonest(true), shade = commonest(false), bg = R.payload.bg || '#0d1218';
  if (!lit || !shade) return null;
  return { lit, shade, backdrop: bg, L: { lit: L(lit), shade: L(shade), backdrop: L(bg) }, shadeFromBackdrop: +(L(shade) - L(bg)).toFixed(1), litFromShade: +(L(lit) - L(shade)).toFixed(1) };
}
/** the figures a gate reads off a column: the lit share of the hair at the rear ¾ (the gameplay camera) and the ¾, and
 * the hair's value against the backdrop */
const gatesOf = (R, share) => ({ ...(share['head · rear ¾, 20° down']?.Hair !== undefined ? { rearHairLit: share['head · rear ¾, 20° down'].Hair } : {}), ...(share['head · ¾']?.Hair !== undefined ? { threeQuarterHairLit: share['head · ¾'].Hair } : {}), ...(R.light ? { hairValue: hairValue(R) } : {}) });
const record = (cast, variant, R, cells) => { const litShare = Object.fromEntries(cells.map(([k, c]) => [k, c.stats])); measures.push({ cast, variant, gesture: R.hero.gesture ?? null, light: R.light ? { toLight: R.light.toLight.map((v) => +v.toFixed(4)) } : null, faces: R.faces.length, payloadBytes: R.bytes, ink: R.ink, litShare, gates: gatesOf(R, litShare) }); };
/** one column of cells: every row's frame, view and mode; `side` puts the profile and rear on a key's side */
const column = (R, lens, rows, side = sideOf(KEY)) => rows.map(([fr, view, mode]) => zoom(cell(R, orbit(aim(lens, R.faces, fr), view, side), mode === 'dark' ? 'fill' : mode, mode === 'dark' ? { bg: DARK(R) } : {}), fr === 'body128' ? 2 : 1));

// ─── CARD MODE: any hero the door accepts ──────────────────────────────────
const SPEC_FILE = argOf('--spec'), EXPR = process.argv.includes('--expr');
const CARD_OUT = resolve(argOf('--out') ?? `${OUT}/cast`);
const SPEC_KEYS = ['name', 'hero', 'toon', 'palette'];
/** mint_solid's own wrap on a failed mint (mint-solid.js mintSolidHandler) */
const MINT_WRAP = " — parameter manual: get_solid_vocab({ id: 'layered' }).";
class Refusal extends Error {}

/** The hero door without its database write, mirrored step for step (layered.js createLayeredHeroHandler →
 * createLayeredPlanHandler → createLayeredHandler, which end in the row write): the hero fields, heroRecord
 * (validateHeroSpec: the door's refusal list), heroPlanOf, the plan's expansion (expandLayeredManifest, checked equal to
 * the door's own plan), the toon light's check and the door's keep rule, planLayered (the recipe and rig gates), then
 * heroReadout on the mint's own mesh (the dress ledgers on the rest figure, as the door reads them). Throws Refusal with
 * the door's message where it refuses. */
function doorMint(input) {
  const heroSpec = Object.fromEntries(HERO_FIELDS.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
  let hero, plan;
  try { hero = heroRecord(heroSpec); } catch (err) { throw new Refusal(`${err.message}${MINT_WRAP}`); }
  try { plan = heroPlanOf(hero); } catch (err) { throw new Refusal(`${err.message} — manual: get_solid_vocab({ id: 'layered' }) (the Hero door section).${MINT_WRAP}`); }
  const title = input.title ?? `hero · ${hero.cast}${hero.head === 'anime' ? ` · anime${hero.look?.length ? ` · ${hero.look.join('+')}` : ''}` : ''}${hero.from ? ` · ${hero.from}` : ''}${hero.faceFrom ? ` · ${hero.faceFrom}` : ''}`;
  let expanded;
  try { expanded = expandLayeredManifest({ kind: 'layered', title, hero }); } catch (err) { throw new Refusal(`${err.message} — manual: get_solid_vocab({ id: 'layered' }).${MINT_WRAP}`); }
  if (JSON.stringify(expanded.plan) !== JSON.stringify(plan)) throw new Error('render-articulation: expandLayeredManifest generated another plan than the door\'s heroPlanOf (the card would not show what the door mints)');
  const { toon } = input;
  const lightErrs = toon && typeof toon === 'object' ? toonLightErrors(toon.light) : [];
  if (lightErrs.length) throw new Refusal(`toon refused:\n - ${lightErrs.join('\n - ')}\nThe character light — manual: get_solid_vocab({ id: 'layered' }) (the Spec section).${MINT_WRAP}`);
  const keepToon = !!resolveToon(toon, { light: true }) || (!!toon && typeof toon === 'object' && toon.ink === false && hero?.head === 'anime');
  // the row as the door stores it: the record as heroRecord returned it, the plan, the recipe, every dial at rest
  const manifest = { kind: 'layered', title, recipe: expanded.recipe, plan, hero, dials: expanded.dials, units: 'm', ...(toon != null && keepToon ? { toon } : {}) };
  let planned;
  try { planned = planLayered(manifest); } catch (err) { throw new Refusal(`${err.message}${MINT_WRAP}`); }
  manifest.ledger = persistedLayeredLedger(planned.stats.ledger);
  const dressed = hero.detail !== undefined || hero.adorn !== undefined;
  const atRest = !manifest.channels && Object.entries(manifest.recipe.dials || {}).every(([k, d]) => manifest.dials?.[k] === d.rest);
  const dressMesh = dressed ? (atRest ? planned.mesh : compileLayered(manifest.recipe, {})) : planned.mesh;
  const readout = heroReadout(hero, plan, planned.stats, [], { mesh: planned.mesh, recipe: manifest.recipe, dressMesh });
  return { hero, manifest, readout, toonDropped: toon != null && !keepToon };
}

/** the spec file: { name, hero, toon?, palette? }; `palette` is a hero field at the door, so it is folded into the hero */
function readSpec(file) {
  let spec;
  try { spec = JSON.parse(readFileSync(resolve(file), 'utf8')); } catch (err) { throw new Refusal(`--spec ${file}: ${err.message}`); }
  const errs = [];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Refusal(`--spec ${file}: a JSON object { name, hero, toon?, palette? }`);
  for (const k of Object.keys(spec)) if (!SPEC_KEYS.includes(k) && !k.startsWith('$')) errs.push(`${k}: not a spec field (have ${SPEC_KEYS.join(', ')}; a key starting with $ is a comment)`);
  if (typeof spec.name !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(spec.name)) errs.push('name: a slug (letters, digits, . _ -), the output folder\'s name');
  if (!spec.hero || typeof spec.hero !== 'object' || Array.isArray(spec.hero)) errs.push(`hero: an object of the hero door's fields (${HERO_FIELDS.join(', ')})`);
  else for (const k of Object.keys(spec.hero)) if (!HERO_FIELDS.includes(k)) errs.push(`hero.${k}: not a hero field (have ${HERO_FIELDS.join(', ')}); the door would pass it on to the manifest or drop it — the card takes \`toon\` at the spec's top level`);
  if (spec.palette !== undefined && (!spec.palette || typeof spec.palette !== 'object' || Array.isArray(spec.palette))) errs.push('palette: { <palette group>: "#rrggbb" } (it rides the hero: hero.palette)');
  if (errs.length) throw new Refusal(`spec refused (the card's own check, before the door):\n - ${errs.join('\n - ')}`);
  const hero = spec.palette ? { ...spec.hero, palette: { ...(spec.hero.palette || {}), ...spec.palette } } : { ...spec.hero };
  return { name: spec.name, hero, toon: spec.toon, raw: spec };
}

/** the words a spec used, as short strings (objects compact) */
const wordsOf = (hero, toon) => [...Object.entries(hero).map(([k, v]) => `${k} ${typeof v === 'string' ? v : JSON.stringify(v)}`), ...(toon !== undefined ? [`toon ${JSON.stringify(toon)}`] : [])];
async function writePng(file, W, H, layers) {
  writeFileSync(file, await sharp({ create: { width: W, height: H, channels: 3, background: '#bdb8ae' } }).composite(layers).png().toBuffer());
  console.log(`wrote ${file}`);
}
/** a labelled cell: the label strip above the image, `w` wide */
function placeCell(layers, c, x, y, w, lines, labH) {
  layers.push({ input: label(w, labH, lines, { size: 12, weight: 700, pad: 5 }), left: x, top: y });
  layers.push({ input: c.rgb, raw: { width: c.width, height: c.height, channels: 3 }, left: x + Math.floor((w - c.width) / 2), top: y + labH });
}
function titleBlock(W, lines) {
  const wrapped = lines.flatMap((l, i) => (i === 0 ? [l] : wrap(l, Math.floor((W - 16) / 6.9))));
  const H = 16 + Math.round(19 * 1.3) + 17 * (wrapped.length - 1) + 6;
  // the first line at the title size, the rest at 13 px
  const t = wrapped.map((s, i) => `<text x="8" y="${i === 0 ? 26 : 26 + 8 + i * 17}" font-family="Helvetica, Arial, sans-serif" font-size="${i === 0 ? 19 : 13}" font-weight="${i === 0 ? 700 : 400}" fill="#23201d">${esc(s)}</text>`).join('');
  return { H, input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#c9c4bb"/>${t}</svg>`) };
}

async function cardMain() {
  const t0 = Date.now();
  let S, D;
  try { S = readSpec(SPEC_FILE); D = doorMint({ ...S.hero, ...(S.toon !== undefined ? { toon: S.toon } : {}) }); }
  catch (err) { if (!(err instanceof Refusal)) throw err; console.error(`refused: ${err.message}`); process.exitCode = 1; return; }
  const dir = `${CARD_OUT}/${S.name}`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/readout.json`, JSON.stringify(D.readout, null, 1) + '\n'); console.log(`wrote ${dir}/readout.json`);
  const warnings = D.readout.warnings ?? [], advice = D.readout.faceMeasures?.features?.advice ?? [];
  console.log(`warnings (${warnings.length}):`); for (const w of warnings) console.log(`  - ${w}`);
  console.log(`advice (faceMeasures.features.advice, ${advice.length}):`); for (const a of advice) console.log(`  - ${a}${warnings.includes(a) ? '  (also in warnings)' : ''}`);
  if (D.toonDropped) console.log(`note: the door keeps no toon for ${JSON.stringify(S.toon)} (the dial reads it as nothing), so none is stored`);

  const R = await resolveManifest(D.manifest, S.name);   // the World resolver, parity-guarded
  const side = sideOf(R.light?.toLight ?? KEY), L = lensOf(R.faces, 256), L512 = lensOf(R.faces, 512);
  const at = (lens, fr, view, mode = 'fill', opts = {}) => cell(R, orbit(aim(lens, R.faces, fr), view, side), mode, opts);
  const big = at(L512, 'head', 'threequarter');
  const heads = [[at(L, 'head', 'front'), ['head · front']], [at(L, 'head', 'profile'), ['head · profile', 'the key’s side']],
    [at(L, 'head', 'rear'), ['head · rear ¾, 20° down', 'the gameplay camera, key side']], [at(L, 'head', 'threequarter', 'fill', { bg: DARK(R) }), ['head · ¾ on the World backdrop', 'the payload’s own bg']]];
  const lower = [[at(L, 'bust', 'threequarter'), ['bust · ¾']], [at(L, 'body256', 'threequarter'), ['body · ¾', '256 px tall']], [at(L, 'body256', 'front'), ['body · front', '256 px tall']],
    [at(L, 'body256', 'rear'), ['body · rear ¾, 20° down', 'the gameplay camera']],
    [at(L, 'body256', 'threequarter', 'silhouette'), ['silhouette · ¾']], [at(L, 'body256', 'threequarter', 'value'), ['3 values · ¾', 'L* < 33 / 33–66 / ≥ 66']]];

  // the sheet: title; the head ¾ at 512 beside a 2 × 2 of head cells at 256; the bust, the body (¾, front, rear ¾),
  // silhouette and values, the sheet as wide as the wider of the two rows
  const g = 8, labH = 34, W = Math.max(g + 512 + g + 2 * (256 + g), g + lower.reduce((s, [c]) => s + c.width + g, 0));
  const r = D.readout, eff = [r.head !== 'anime' && `head ${r.head}`, r.head === 'landmark' && `hair ${r.hair?.style}`, r.head === 'landmark' && `expression ${r.expression}`, r.base && `base ${r.base}`, r.proportions && `proportions ${r.proportions}`, r.look && `look ${r.look.join('+')}`, r.hairCut !== undefined && `hair ${r.hairCut ? `the ${r.hairCut} cut (the hair base)` : r.hair?.style ?? 'none'}`,
    r.head === 'anime' && `expression ${typeof S.hero.expression === 'string' ? S.hero.expression : Object.entries(r.expression || {}).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' ') || 'neutral'}`, r.gesture ? `stand ${r.gesture.word}` : 'the bind pose (no stand)', r.headsTall && `${r.headsTall} heads tall`, r.neck && `neck ${r.neck.form} ${r.neck.ofW} W`,
    r.gear && Object.keys(r.gear).length && `gear ${Object.entries(r.gear).map(([slot, it]) => `${slot} ${it.item}`).join(', ')}`].filter(Boolean);
  const T = titleBlock(W, [`${S.name}`, `words: ${wordsOf(S.hero, S.toon).join(' · ') || '(none: the door’s defaults)'}`, `the door read: ${eff.join(' · ')}`,
    `${warnings.length} warning${warnings.length === 1 ? '' : 's'} (readout.json) · ${R.faces.length} static faces${R.gear ? ` (${R.gear} of them held gear)` : ''}, parity-guarded against the World payload · ${r.budget ? `${r.budget.triangles} triangles` : ''}`]);
  const layers = [{ input: T.input, left: 0, top: 0 }];
  let y = T.H + g;
  placeCell(layers, big, g, y, 512, ['head · ¾ (512 px)', 'camera on +x (the figure’s right)'], labH);
  heads.forEach(([c, lines], i) => placeCell(layers, c, g + 512 + g + (i % 2) * (256 + g), y + Math.floor(i / 2) * (256 + labH + g), 256, lines, labH));
  y += Math.max(512 + labH, 2 * (256 + labH) + g) + g;
  let x = g; const rowH = Math.max(...lower.map(([c]) => c.height)) + labH;
  for (const [c, lines] of lower) { placeCell(layers, c, x, y, c.width, lines, labH); x += c.width + g; }
  y += rowH + g;
  await writePng(`${dir}/card.png`, W, y, layers);
  const tCard = (Date.now() - t0) / 1000;
  console.log(`card: ${tCard.toFixed(1)} s`);

  // --check-lens: the head ¾ once more at the REVIEW SHEETS' lens (the review sheets freeze it per cast on the
  // hero at gesture rest with toon.light false, at --head px, default 384), so a card can be laid pixel for pixel over
  // a review sheet's column
  if (process.argv.includes('--check-lens')) {
    const Dr = doorMint({ ...S.hero, gesture: 'rest', toon: { ...(S.toon && typeof S.toon === 'object' ? S.toon : {}), light: false } });
    const Rr = await resolveManifest(Dr.manifest, `${S.name} · rest, light off`), c = cell(R, orbit(aim(lensOf(Rr.faces), R.faces, 'head'), 'threequarter', side));
    writeFileSync(`${dir}/head-3q-review-lens.png`, await sharp(c.rgb, { raw: { width: c.width, height: c.height, channels: 3 } }).png().toBuffer());
    console.log(`wrote ${dir}/head-3q-review-lens.png (${c.width} px, the review sheets' lens)`);
  }

  if (EXPR) {
    const t1 = Date.now(), head = D.hero.head ?? 'landmark';
    const words = head === 'anime' ? Object.keys(ANIME_POSES) : head === 'landmark' ? Object.keys(LANDMARK_EXPRESSIONS) : [];
    if (!words.length) { console.log(`expressions: head '${typeof head === 'string' ? head : 'include'}' takes no expression words`); return; }
    const cells = [];
    for (const word of words) {
      let Rw;
      if (S.hero.expression === word) Rw = R;
      else {
        let Dw; try { Dw = doorMint({ ...S.hero, expression: word, ...(S.toon !== undefined ? { toon: S.toon } : {}) }); }
        catch (err) { if (!(err instanceof Refusal)) throw err; console.log(`expression ${word}: refused: ${err.message}`); continue; }
        Rw = await resolveManifest(Dw.manifest, `${S.name} · ${word}`);
      }
      cells.push([cell(Rw, orbit(aim(L, Rw.faces, 'head'), 'threequarter', side)), [word, ...(S.hero.expression === word ? ['the spec’s own'] : [])]]);
    }
    const per = 5, EW = g + per * (256 + g);
    const ET = titleBlock(EW, [`${S.name} · expressions`, `every expression word the ${head} head takes (hero.expression, the own layer: over a look’s pose); the rest of the spec as given; head ¾ at 256 px, one lens`]);
    const el = [{ input: ET.input, left: 0, top: 0 }];
    cells.forEach(([c, lines], i) => placeCell(el, c, g + (i % per) * (256 + g), ET.H + g + Math.floor(i / per) * (256 + labH + g), 256, lines, labH));
    await writePng(`${dir}/expressions.png`, EW, ET.H + g + Math.ceil(cells.length / per) * (256 + labH + g), el);
    console.log(`expressions: ${cells.length} words, ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  }
}
if (SPEC_FILE) await cardMain();

// ─── SHEET MODE: the cast side by side, one lens per row ───────────────────
/** --sheet <config.json>: { columns: [{ spec, summary }], title?, sheet?, expressions? } (spec paths relative to the
 * config). Every spec goes through the same door steps and parity guard as a card. Writes <out>/<sheet>.png (default
 * cast-sheet): one column per spec, rows head ¾ (320 px), head front and rear ¾ 20° down (256 px), body ¾ (256 px), the
 * body rear ¾ 20° down (the gameplay camera, key side) and the ¾ black silhouette; with --expr also
 * <out>/<expressions>.png (default cast-expressions): one row per spec, the head ¾ at 256 px for the spec's own
 * expression and every expression word the anime head takes. SAME FRAMING PER ROW: the head rows share one lens (the
 * largest head box of the cast, each aimed at its own head centre), the body rows one lens (the tallest figure with its
 * gear at 256 px, each aimed across at its own figure and standing on the same floor line), so heads and figures
 * compare in size. */
const SHEET_FILE = argOf('--sheet');
async function sheetMain() {
  const cfgFile = resolve(SHEET_FILE), cfg = JSON.parse(readFileSync(cfgFile, 'utf8')), base = dirname(cfgFile), t0 = Date.now();
  const cast = [];
  for (const col of cfg.columns) {
    let S, D;
    try { S = readSpec(resolve(base, col.spec)); D = doorMint({ ...S.hero, ...(S.toon !== undefined ? { toon: S.toon } : {}) }); }
    catch (err) { if (!(err instanceof Refusal)) throw err; console.error(`refused (${col.spec}): ${err.message}`); process.exitCode = 1; return; }
    const R = await resolveManifest(D.manifest, S.name);   // the World resolver, parity-guarded
    cast.push({ S, D, R, summary: col.summary ?? '', side: sideOf(R.light?.toLight ?? KEY) });
    console.log(`${S.name}: ${R.faces.length} static faces, ${D.readout.budget?.triangles ?? '?'} triangles, ${D.readout.headsTall ?? '?'} heads tall`);
  }
  // the shared lenses
  const exts = cast.map((c) => lensOf(c.R.faces, 256).head.ext), ext = Math.max(...exts);
  const headLens = (px) => ({ distance: (ext / 2) / Math.tan(rad(8)), vfov: 16, width: px, height: px, ss: 2, ext });
  const bodies = cast.map((c) => lensOf(c.R.faces, 256).body256), body = bodies.reduce((a, b) => (b.H > a.H ? b : a));
  console.log(`head lens: ext ${ext.toFixed(4)} m (per spec: ${cast.map((c, i) => `${c.S.name} ${exts[i].toFixed(4)}`).join(', ')}); body lens: H ${body.H.toFixed(3)} m (per spec: ${cast.map((c, i) => `${c.S.name} ${bodies[i].H.toFixed(3)}`).join(', ')})`);
  const headAt = (R, side, px, view, mode = 'fill') => { const h = headBox(R.faces); return cell(R, orbit({ ...headLens(px), target: [h.c[0], h.c[1], h.c[2] - 0.025] }, view, side), mode); };
  const bodyAt = (R, side, view, mode = 'fill') => { const a = figureBox(R.faces), z = boxOf(R.faces).mn[2]; return cell(R, orbit({ ...body, target: [a.c[0], a.c[1], z + body.H / 2] }, view, side), mode); };
  const colLabel = (c, n) => [c.S.name, ...wrap(c.summary, n)];
  const ROWS_SHEET = [
    [['head · ¾', '320 px, one lens', 'camera on +x'], (c) => headAt(c.R, c.side, 320, 'threequarter')],
    [['head · front', '256 px, one lens'], (c) => headAt(c.R, c.side, 256, 'front')],
    [['head · rear ¾, 20° down', 'the gameplay camera, key side', '256 px, one lens'], (c) => headAt(c.R, c.side, 256, 'rear')],
    [['body · ¾', '256 px (the tallest)', 'one lens, one floor line'], (c) => bodyAt(c.R, c.side, 'threequarter')],
    [['body · rear ¾, 20° down', 'the gameplay camera, key side', 'as the body row'], (c) => bodyAt(c.R, c.side, 'rear')],
    [['silhouette · ¾', 'as the body row'], (c) => bodyAt(c.R, c.side, 'threequarter', 'silhouette')],
  ];
  const grid = ROWS_SHEET.map(([, f]) => cast.map(f));
  const out = (n) => `${CARD_OUT}/${n}.png`; mkdirSync(CARD_OUT, { recursive: true });
  await sheet(cfg.sheet ?? 'cast-sheet', {
    title: cfg.title ?? 'cast · the specs side by side',
    note: [`each column is one spec through the hero door’s steps (no database), resolved by the World resolver under the parity guard. One lens per row: the head rows frame the largest head box of the cast (each aimed at its own head centre), the body rows the tallest figure at 256 px (each on the same floor line), so sizes compare. The rear ¾ stands on each spec’s key side. Triangles: ${cast.map((c) => `${c.S.name} ${c.D.readout.budget?.triangles ?? '?'}`).join(', ')}.`],
    columns: cast.map((c) => colLabel(c, 50)), rows: ROWS_SHEET.map(([lab], i) => ({ label: lab, cells: grid[i] })), gutter: 190, file: out(cfg.sheet ?? 'cast-sheet'),
  });
  console.log(`sheet: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (!EXPR) return;
  const t1 = Date.now(), words = Object.keys(ANIME_POSES), rows = [];
  for (const c of cast) {
    if ((c.D.hero.head ?? 'landmark') !== 'anime') { console.log(`${c.S.name}: not the anime head, no expression row`); continue; }
    const cells = [headAt(c.R, c.side, 256, 'threequarter')];
    for (const word of words) {
      let Dw; try { Dw = doorMint({ ...c.S.hero, expression: word, ...(c.S.toon !== undefined ? { toon: c.S.toon } : {}) }); }
      catch (err) { if (!(err instanceof Refusal)) throw err; console.log(`${c.S.name} · ${word}: refused: ${err.message}`); cells.push(null); continue; }
      const Rw = await resolveManifest(Dw.manifest, `${c.S.name} · ${word}`);
      cells.push(headAt(Rw, c.side, 256, 'threequarter'));
    }
    const said = (e) => (typeof e === 'string' ? e : Array.isArray(e) ? e.map(said).join(' + ') : e && typeof e === 'object' ? Object.entries(e).map(([k, v]) => `${k} ${v}`).join(', ') : String(e));
    const own = c.S.hero.expression === undefined ? 'none (the look’s pose)' : said(c.S.hero.expression);
    const amounts = Object.entries(c.D.readout.expression || {}).filter(([, v]) => typeof v === 'number' && v).map(([k, v]) => `${k} ${+v.toFixed(3)}`).join(', ') || 'all 0';
    rows.push({ label: [c.S.name, ...wrap(`own: ${own}`, 26), ...wrap(`the door read: ${amounts}`, 26)], cells });
    console.log(`${c.S.name}: expressions done`);
  }
  await sheet(cfg.expressions ?? 'cast-expressions', {
    title: `${cfg.title ?? 'cast'} · expressions`,
    note: ['one row per spec: the head ¾ at 256 px on one lens for all rows (the largest head box of the cast). The first column is the spec as written; each other column replaces the spec’s own expression layer with that word (hero.expression = word), the rest of the spec as given, each minted through the door and parity-guarded.'],
    columns: [['the spec’s own'], ...words.map((w) => [w])], rows, gutter: 190, file: out(cfg.expressions ?? 'cast-expressions'),
  });
  console.log(`expressions: ${((Date.now() - t1) / 1000).toFixed(1)} s`);
}
if (SHEET_FILE) await sheetMain();

// ─── the review sheets (without --spec or --sheet) ─────────────────────────
if (!SPEC_FILE && !SHEET_FILE) {
  const lenses = {}, defaults = {};
  for (const cast of CASTS) {
    const before = await resolveHero(cast, { gesture: 'rest', toon: { light: false } });
    lenses[cast] = lensOf(before.faces);
    defaults[cast] = await resolveHero(cast);
    if (ONLY.has('before-after')) {
      const still = await resolveHero(cast, { gesture: 'rest' });
      const b = column(before, lenses[cast], ROWS), r = column(still, lenses[cast], ROWS), a = column(defaults[cast], lenses[cast], ROWS);
      record(cast, 'before', before, ROWS.map((row, i) => [row[3][0], b[i]])); record(cast, 'light at rest', still, ROWS.map((row, i) => [row[3][0], r[i]])); record(cast, 'default', defaults[cast], ROWS.map((row, i) => [row[3][0], a[i]]));
      defaults[cast].cells = a; defaults[cast].still = r; defaults[cast].before = b;
    }
  }
  if (ONLY.has('before-after')) {
    await sheet('articulation-before-after', {
      title: 'eyes gate · before / after · the anime hero as the door mints it',
      note: ['before: the World as it was (toon.light false, gesture rest: the Lambert studio bake, no ink). light at rest: the character light alone (gesture rest). after: the default (the character light, iso-split two tones, the silhouette ink, the relaxed stand; the head lit in its own frame).',
        'software depth raster over the World payload’s own static faces (parity-guarded); the outline emulates the inverted hull at toon.ink.widthAbs, and the draw layers (brows and lids through the fringe, no hair outline over hair) per pixel. Same lens per cast. Profile and rear from the key’s side (+x).'],
      columns: CASTS.flatMap((c) => [[`${c} · before`, 'Lambert studio bake, rest'], [`${c} · light at rest`, 'character light, gesture rest'], [`${c} · after (default)`, 'character light, relaxed']]),
      rows: ROWS.map((row, i) => ({ label: row[3], cells: CASTS.flatMap((c) => [defaults[c].before[i], defaults[c].still[i], defaults[c].cells[i]]) })),
    });
  }
  if (ONLY.has('keys')) {
    const rows = ROWS.filter((r) => r[2] !== 'silhouette'), cols = [], cells = [];
    for (const cast of CASTS) for (const [name, toLight, v] of KEYS) {
      const R = toLight ? await resolveHero(cast, { toon: { light: { toLight } } }) : defaults[cast];
      const c = column(R, lenses[cast], rows, sideOf(v)); cells.push(c); record(cast, `key: ${name}`, R, rows.map((r, i) => [r[3][0], c[i]]));
      cols.push([`${cast} · ${name}`, `toLight [${v.map((x) => x.toFixed(2)).join(', ')}]`, angles(v)]);
    }
    await sheet('articulation-keys', {
      title: 'eyes gate · the key direction · pick the default (character space: +y front, +z up)',
      note: ['every column is the default hero (the relaxed stand, the default thresholds and shade swatches) with only toon.light.toLight changed; the ¾ camera stands on +x; the profile and rear ¾ stand on each column’s key side.',
        'the silhouette row is omitted: a key never moves it (see the before / after sheet).'],
      columns: cols, rows: rows.map((r, i) => ({ label: r[3], cells: cells.map((c) => c[i]) })),
    });
  }
  if (ONLY.has('progression')) {
    const dir = argOf('--baseline');
    if (!dir) console.log('progression: skipped (no --baseline <dir> holding anime-<cast>.json manifests)');
    else for (const cast of CASTS) {
      const file = `${resolve(dir)}/anime-${cast}.json`, { title: _title, ...stored } = JSON.parse(readFileSync(file, 'utf8'));
      const base = await resolveManifest(stored, `${cast} baseline`, { predates: PREDATES }), lens = lenses[cast];
      const b = column(base, lens, PROGRESSION_ROWS), a = column(defaults[cast], lens, PROGRESSION_ROWS);
      record(cast, 'progression: baseline', base, PROGRESSION_ROWS.map((row, i) => [row[3][0], b[i]])); record(cast, 'progression: default', defaults[cast], PROGRESSION_ROWS.map((row, i) => [row[3][0], a[i]]));
      const own = stored.toon?.light;
      await sheet(`articulation-progression-${cast}`, {
        title: `eyes gate · progression · ${cast} · the baseline → the door's default today`,
        note: [`baseline: ${file.split('/').slice(-3).join('/')} resolved as stored${own ? ' under its own toon.light' : ''}${PREDATES.size ? `, drawn without the rules it predates (${[...PREDATES].join(', ')})` : ''}. default: the anime hero as the door mints it today (every default channel on).`,
          'software depth raster over the World payload’s own static faces (parity-guarded); the outline emulates the inverted hull at toon.ink.widthAbs and the draw layers per pixel. One lens per cast; the head frame is the skull and the hair above the chin.'],
        columns: [[`${cast} · baseline`, own ? `its own light: Hair step ${own.thresholds?.Hair ?? '(default)'}, highlight ${own.highlight === false ? 'off' : 'default'}` : 'the default light'], [`${cast} · default today`, 'the door’s hero, relaxed']],
        rows: PROGRESSION_ROWS.map((row, i) => ({ label: row[3], cells: [b[i], a[i]] })),
      });
    }
  }
  if (ONLY.has('expressions')) {
    const cells = Object.fromEntries(CASTS.map((c) => [c, []]));
    for (const cast of CASTS) for (const word of EXPRESSIONS) {
      const R = word === (defaults[cast].hero.expression ?? 'neutral') ? defaults[cast] : await resolveHero(cast, { expression: word }), lens = lenses[cast];
      const c = [cell(R, orbit(aim(lens, R.faces, 'head'), 'threequarter')), cell(R, orbit(aim(lens, R.faces, 'head'), 'front'))];
      cells[cast].push(c); record(cast, `expression: ${word}`, R, [['head · ¾', c[0]], ['head · front', c[1]]]);
    }
    await sheet('articulation-expressions', {
      title: 'eyes gate · the expressions · the default hero, each expression word',
      note: ['the door’s default hero with only `expression` changed (the relaxed stand, the head lit in its own frame); one lens per cast.'],
      columns: CASTS.flatMap((c) => [[`${c} · head ¾`], [`${c} · head front`]]),
      rows: EXPRESSIONS.map((word, i) => ({ label: [word], cells: CASTS.flatMap((c) => cells[c][i]) })), gutter: 150,
    });
  }
  if (ONLY.has('stands')) {
    const cols = [['256 px · ¾'], ['256 px · front'], ['silhouette · ¾'], ['silhouette · front']], rows = [];
    for (const cast of CASTS) for (const word of GESTURE_WORDS) {
      const R = word === (defaults[cast].hero.gesture ?? 'relaxed') ? defaults[cast] : await resolveHero(cast, { gesture: word }), lens = lenses[cast];
      const c = [cell(R, orbit(aim(lens, R.faces, 'body256'), 'threequarter')), cell(R, orbit(aim(lens, R.faces, 'body256'), 'front')), cell(R, orbit(aim(lens, R.faces, 'body256'), 'threequarter'), 'silhouette'), cell(R, orbit(aim(lens, R.faces, 'body256'), 'front'), 'silhouette')];
      const g = gestureReadout(R.hero, R.mesh, R.manifest.recipe);
      const worst = g ? Object.entries(g.clearance.pairs).sort((a, b) => (b[1].depthMm - b[1].restDepthMm) - (a[1].depthMm - a[1].restDepthMm))[0] : null;
      rows.push({ label: [`${cast} · ${word}`, ...(g ? [`support ${g.support}`, `hand sink past rest: ${g.clearance.worstMm} mm${worst ? ` (${worst[0]})` : ''}`, ...Object.entries(g.freeSoleMm || {}).map(([S, mm]) => `free ${S} sole ${mm} mm`)] : ['the bind pose (no stand clip)'])], cells: c });
      record(cast, `gesture: ${word}`, R, [['256 px · ¾', c[0]]]);
    }
    await sheet('articulation-stands', {
      title: 'eyes gate · the stands · default light, each preset word',
      note: ['the static solid skinned at the one-key `gesture` clip (bindLayered → rigNodesAt → boneFrames → skinLayered), lit posed with the head in its own frame; relaxed per cast word, hand-on-hip and guard per cast for female and male.',
        'labels: the hero readout’s stand (gestureReadout): the worst hand / forearm sink beyond its rest overlap, the free sole against the floor.'],
      columns: cols, rows, gutter: 300,
    });
  }
  if (measures.length) writeFileSync(`${OUT}/articulation-measures.json`, JSON.stringify(measures, null, 1) + '\n');

  // ─── parity with the World page ────────────────────────────────────────────
  const PARITY = `${OUT}/parity`, SHOT = 900;
  /** the parity cameras: the World's own front camera (the payload's first), and the head ¾ at the head lens */
  function parityShots(R, lens) {
    const wf = R.payload.cameras[0].worldFraming, head = orbit(aim(lens, R.faces, 'head'), 'threequarter');
    return [{ id: 'world-front', pos: wf.cameraPosition, target: wf.lookAt, hfov: wf.horizontalFov }, { id: 'head-3q', pos: head.pos, target: head.target, hfov: head.vfov }];
  }
  const parityCell = (R, s) => cell(R, { pos: s.pos, target: s.target, vfov: s.hfov, width: SHOT, height: SHOT, ss: 2 }, 'fill', { bg: hexRgb(R.payload.bg || '#0d1218'), all: [...R.faces, ...R.payload.faces.filter((f) => f.studio)] });
  if (process.argv.includes('--parity') || argOf('--compare')) {
    mkdirSync(PARITY, { recursive: true });
    const cast = CASTS[0], R = defaults[cast] ?? await resolveHero(cast), shots = parityShots(R, lenses[cast]);
    writeFileSync(`${PARITY}/anime-${cast}.json`, JSON.stringify({ ...R.manifest, title: `anime hero · ${cast}` }));
    writeFileSync(`${PARITY}/shots.json`, JSON.stringify(shots.map((s) => ({ ...s, t: 0 })), null, 1));
    const raster = Object.fromEntries(shots.map((s) => [s.id, parityCell(R, s)]));
    for (const [id, c] of Object.entries(raster)) writeFileSync(`${PARITY}/raster-${id}.png`, await sharp(c.rgb, { raw: { width: c.width, height: c.height, channels: 3 } }).png().toBuffer());
    console.log(`wrote ${PARITY}: anime-${cast}.json, shots.json, raster-*.png`);
    const dir = argOf('--compare');
    if (dir) {
      const report = {};
      for (const s of shots) {
        const f = `${dir}/${s.id}.png`; if (!existsSync(f)) { console.log(`no capture ${f}`); continue; }
        const cap = await sharp(readFileSync(f)).removeAlpha().resize(SHOT, SHOT, { fit: 'fill' }).raw().toBuffer(), r = raster[s.id];
        const diff = Buffer.alloc(SHOT * SHOT * 3); let inside = 0, sum = 0, off = 0, all = 0;
        const eroded = (i) => { const x = i % SHOT, y = (i - x) / SHOT; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= SHOT || yy >= SHOT || r.cover[yy * SHOT + xx] < 1) return false; } return true; };
        for (let i = 0; i < SHOT * SHOT; i++) {
          let m = 0; for (let ch = 0; ch < 3; ch++) { const d = Math.abs(r.rgb[i * 3 + ch] - cap[i * 3 + ch]); m = Math.max(m, d); diff[i * 3 + ch] = Math.min(255, d * 3); }
          all += m; if (eroded(i)) { inside++; sum += m; if (m > 48) off++; }
        }
        report[s.id] = { figurePixels: inside, meanMaxChannelDiffInFigure: +(sum / inside).toFixed(2), figureShareOffBy48: +(off / inside).toFixed(4), meanMaxChannelDiffFrame: +(all / SHOT / SHOT).toFixed(2) };
        const strip = await sharp({ create: { width: SHOT * 3 + 12, height: SHOT, channels: 3, background: '#bdb8ae' } }).composite([
          { input: r.rgb, raw: { width: SHOT, height: SHOT, channels: 3 }, left: 0, top: 0 }, { input: cap, raw: { width: SHOT, height: SHOT, channels: 3 }, left: SHOT + 6, top: 0 },
          { input: diff, raw: { width: SHOT, height: SHOT, channels: 3 }, left: 2 * SHOT + 12, top: 0 }]).png().toBuffer();
        writeFileSync(`${PARITY}/parity-${basename(dir)}-${s.id}.png`, strip);
      }
      writeFileSync(`${PARITY}/parity-${basename(dir)}.json`, JSON.stringify(report, null, 1) + '\n');
      console.log(`parity (${basename(dir)}):`, JSON.stringify(report));
    }
  }
}
