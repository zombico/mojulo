#!/usr/bin/env node
/**
 * LEVEL 0, THE APPROACH — the starter's first segment as one page: the geocube's land and nothing built on it, the
 * controls told where they are first needed, and two places that ask for a sneak (level0.json: a chokepoint, an
 * outpost). Its cover is what a patrol parked and laid and what the land grew; its ways through are FOUND, not drawn:
 * the planner (level0-plan.mjs on gameworld/stealth-routes.js) searches each point and says whether the first try is
 * seen, whether a way unseen is left, what it costs, and whether there is a second.
 *
 *   cd control
 *   node scripts/spikes/mission/level0.mjs --out /abs/dir [--plan] [--hero <ref>] [--guard <ref>] [--vault …] [--roll …]
 *     [--climb …] [--crouch a,b] [--prone a,b] [--next level-1-perimeter.html] [--capture]
 *
 * `--plan`: the plan alone (its laws printed, its map written as level-0-plan.svg), no page; it needs the land's facts,
 * kept beside the page from the last build (level-0-facts.json), else it lays the land first. A change to level0.json is
 * tried with `--plan` in a second, and built once it holds.
 */
import { register } from 'node:module';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
register('../../mcp-stdio-loader.mjs', import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const { options, database, starterRoom, groundOf, writePage, boxFaces } = await import('./lib.mjs');
const o = options(process.argv.slice(2)), out = path.resolve(o.opt('--out', 'level-0'));
database(o.opt('--hero'), o.opt('--guard'));
const { planLevel, planSvg, coverOf, watchersOf, GUARD, spineFrom, spineOf, placeRecipe, seatStairs, reliefAt, structureBoxes, towerFaces, STRUCTURE, tallGrassOf } = await import('./level0-plan.mjs');
const { assembleStageScene } = await import('../../../lib/graph/era/stage.js');
const { readGameworld } = await import('../../../lib/graph/gameworld/index.js');
const { gameStages } = await import('../../../lib/graph/gameworld/levels.js');
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const factsFile = path.join(out, 'level-0-facts.json');
const L0 = JSON.parse(fss.readFileSync(path.join(here, 'level0.json'), 'utf8')), M1 = JSON.parse(fss.readFileSync(path.join(here, 'level1.json'), 'utf8')), W0 = JSON.parse(fss.readFileSync(path.join(here, 'world.json'), 'utf8'));
const r2 = (p) => p.map((v) => +v.toFixed(2));

// THE LAND, as the rail lays the level's section, asked for as the geocube's own path in the seventh generation
const { wcd: _game, ...rest } = W0;
const G = readGameworld({ ...rest, style: { ...W0.style, geocube: L0.cube }, levels: { infiltration: M1.level } });
const stage0 = gameStages(G).find((s) => s.node === L0.section)?.manifest;
if (!stage0) { console.error(`level 0: the rail lays no section '${L0.section}'`); process.exit(1); }
// (the trail at the recipe's run: its length, so a level that wants a longer approach asks for it)
// (and its GORGE, `gorge`: a cliff face down each side of the field, the high side out, as the trail's ground edits
// (era/out-ground.js `cliff`): the land boxed in, the field between them as it was)
const G0 = L0.gorge, gorgeEdits = G0 ? [['west', 'left'], ['east', 'right']].map(([k, side]) => ({ op: 'cliff', path: [[G0[k], G0.from], [G0[k], G0.to]], height: G0.height, side, face: G0.face, reach: G0.reach })) : [];
// (and its WIDTH, `width`: the walked way in metres, the kit's footpath where the level says none)
const trail0 = { ...stage0.trail, ...(L0.run ? { run: L0.run } : {}), ...(L0.width ? { width: L0.width } : {}), ...(gorgeEdits.length ? { ground: { ...(stage0.trail.ground ?? {}), edits: [...(stage0.trail.ground?.edits ?? []), ...gorgeEdits] } } : {}) };
const stage = { ...stage0, trail: trail0 };
// THE RECIPE SET DOWN ON THIS LAND: its places are said along the trail, read off the trail's own line (a dry lay of
// the stage, a second or two; the plan alone reads the line kept from the last build)
const facts0 = o.has('--plan') && fss.existsSync(factsFile) ? JSON.parse(fss.readFileSync(factsFile, 'utf8')) : null;
const spine = facts0?.spine ? spineOf(facts0.spine) : spineFrom(assembleStageScene(stage).faces);
const L = placeRecipe(L0, spine);
const cover = coverOf(L);
const report = (plan) => { for (const P of plan.points) { const R = P.routes, w = (x) => (x ? `${x.seconds} s (waits ${x.waits}, crouches ${x.crouch} m, crawls ${x.crawl} m, ${x.detour}× the straight way)` : 'none'); console.log(`level 0: ${P.id}: first try ${R.direct?.seen ? `seen by ${R.direct.seen.by} after ${R.direct.seen.t} s` : 'not seen'} · unseen ${w(R.sneak)} · second ${w(R.other)}${R.taken ? ` · with a takedown ${R.taken.down ? `(${R.taken.down.by} at ${R.taken.down.t} s) ` : ''}${w(R.taken)}` : ''}`); } for (const l of plan.laws) console.log(`level 0:   ${l.holds ? 'holds' : 'ADVISED'} · ${l.law}: ${l.says}`); };
const fieldOf = (colliders) => { const B = colliders.filter((c) => /^bound:/.test(c.of ?? '')); return B.length === 4 ? [Math.min(...B.map((c) => c.max[0])), Math.min(...B.map((c) => c.max[1])), Math.max(...B.map((c) => c.min[0])), Math.max(...B.map((c) => c.min[1]))] : [-8, 0, 30, 75.5]; };

if (facts0) {
  const F = facts0;
  if (F.relief) seatStairs(L, reliefAt(F.relief));   // (each tower's flight down to the land at its foot, as the page's)
  const plan = planLevel(L, F.colliders, F.field);
  report(plan); await fs.writeFile(path.join(out, 'level-0-plan.svg'), planSvg(L, plan, F.field, F.trail, F.relief));
  console.log(`level 0: ${path.join(out, 'level-0-plan.svg')}`); process.exit(0);
}

const { room, hero: h0, guard: g0 } = await starterRoom(o);
// (backup: the starter's guard, minted asleep, sent down the trail when a call goes through: alarm.js)
const backupIds = Array.from({ length: L.backup?.count ?? 0 }, (_, k) => `backup-${k + 1}`);
// (`occlusion`: the seventh generation's live contact occlusion, on by default; `--no-occlusion` or the recipe's
// `occlusion: false` leaves it out, its prepass a second draw of the whole scene every frame)
// (`--perf '{…}'` over the recipe's performance, to try what a setting costs without editing the level)
const Pf = { ...(L0.performance ?? {}), ...(o.opt('--perf') ? JSON.parse(o.opt('--perf')) : {}) }, occl = o.has('--no-occlusion') ? false : Pf.occlusion ?? L0.occlusion;
// (what the page may cost: its shadows' tier, the contact occlusion, the grass's real reach; and its bodies' shadows:
// `bodies: 'blob'` draws no body into the live light's map each frame, a soft pool at each one's feet instead)
// (`bodies: 'pilot'`: the body the player pilots casts its live shadow, every other a soft pool at its feet)
const POOL = { feet: true, occlude: true, r: 0.5, alpha: 0.42, fade: 1.5 };
const bodyShadows = Pf.bodies === 'blob' ? { actors: false, hour: true, ...POOL } : Pf.bodies === 'pilot' ? { actors: 'pilot', hour: true, ...POOL } : { actors: true, hour: true };
const costs = { ...(occl !== undefined ? { occlusion: occl } : {}), ...(Pf.light ? { light: { tier: Pf.light } } : {}), ...(Number.isFinite(Pf.cone) ? { cone: Pf.cone } : {}), ...(Pf.parallax === false || Pf.parallax === 'cliffs' ? { parallax: Pf.parallax } : {}), ...(Number.isFinite(Pf.density) ? { density: Pf.density } : {}), ...(Pf.far ? { farFigures: Pf.far } : {}) };
// (the cube a preset's id, or the preset with the level's own changes: `{ from, biocube?, outside? }`)
const scene = { kind: 'geocube', cube: { ...(typeof L.cube === 'string' ? { from: L.cube } : L.cube), era: 'gen-7' }, show: 'path', seed: stage.seed, trail: stage.trail, hour: L.hour, shadows: bodyShadows, ...costs, ...(tallGrassOf(L) ? { tallGrass: tallGrassOf(L) } : {}), ...(L.path ? { path: Object.fromEntries(Object.entries(L.path).filter(([k]) => k !== 'reads')) } : {}), ...(L.air ? { air: L.air } : {}), ...(L.farGrass ? { farGrass: L.farGrass } : {}), ...(L.audio ? { audio: Object.fromEntries(Object.entries(L.audio).filter(([k]) => k !== 'reads')) } : {}), ...(L.screen ? { screen: L.screen } : {}), ...(L.radar?.map ? { radar: { map: L.radar.map } } : {}), parked: cover.parked,
  figures: room.manifest.figures, entities: [L.radar?.range ? { ...h0, rule: { ...h0.rule, radarRange: L.radar.range } } : h0, ...L.watchers.map((w) => ({ ...g0, id: w.id })), ...backupIds.map((id) => ({ ...g0, id, dormant: true }))], fxStyle: room.manifest.fxStyle, figureGrade: room.manifest.figureGrade };
const { payload } = await resolveWorldScene({ ref: 'steel-serpents-level-0', title: `${L.name} · Steel Serpents`, manifest: scene }, { era: 'gen-7', live: true });

// THE GROUND: everything stands on the land as it was laid
const ground = groundOf(payload), zAt = (p) => ground(p[0], p[1]) ?? 0, on = (p, lift = 0) => r2([p[0], p[1], zAt(p) + lift]);
const field = fieldOf(payload.colliders), trail = (payload.anchors ?? []).filter((a) => a.kind === 'beat').map((a) => a.at);
await fs.mkdir(out, { recursive: true });
// THE LAND'S RELIEF for the plan (the grass map's heights, a metre a cell over the field): where a bank stands, a patch of
// grass on it grows only on its level top, and the search reads the ground as flat
const relief = (() => {
  const G = payload.form?.land?.grass; if (!G) return null;
  const px = Buffer.from(G.px, 'base64'), [nx, ny] = G.size, zAt = (x, y) => { const i = Math.round((x - G.origin[0]) / G.cell), j = Math.round((y - G.origin[1]) / G.cell); if (i < 0 || j < 0 || i >= nx || j >= ny) return null; const q = (j * nx + i) * 4; return G.z[0] + ((px[q] * 256 + px[q + 1]) / 65535) * G.z[1]; };
  const [X0, Y0, X1, Y1] = field, W = Math.ceil(X1 - X0), H = Math.ceil(Y1 - Y0), z = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const v = zAt(X0 + i + 0.5, Y0 + j + 0.5); z.push(v == null ? null : Math.round(v * 100) / 100); }
  return { origin: [X0, Y0], size: [W, H], z };
})();
// (how each patch of tall grass stands: its share of level green ground, where its grass grows; one under half is no cover)
for (const [k, P] of (payload.tallGrassRead ?? []).entries()) if (P.share !== undefined) console.log(`level 0: grass ${L.grass?.[k]?.id ?? k}: ${Math.round(P.share * 100)}% level ground${P.share < 0.5 ? ' — too little grows: no cover here, move it' : P.share < 0.75 ? ' — thin in places' : ''}`);
await fs.writeFile(factsFile, JSON.stringify({ field, trail, spine: spine.samples, colliders: payload.colliders.filter((c) => /^(shrub|bound)/.test(c.of ?? '')), ...(relief ? { relief } : {}) }));
// (each tower's stair seated on the land: its flight down to where its foot lands, read off the relief as the plan reads it)
if (relief) seatStairs(L, reliefAt(relief));
for (const t of L.structures ?? []) if (t.drop) console.log(`level 0: ${t.id}'s stair lands ${t.drop} m under its base: ${Math.round(((t.height ?? STRUCTURE.tower.height) + t.drop) / STRUCTURE.tower.stair.rise)} risers`);
const plan = planLevel(L, payload.colliders, field);
report(plan); await fs.writeFile(path.join(out, 'level-0-plan.svg'), planSvg(L, plan, field, trail, relief));
if (o.has('--plan')) process.exit(0);

// what is parked is set on the ground under it (the recipe gave it no height), its box with it
const parkedIds = payload.entities.filter((e) => /^parked-/.test(e.id)).map((e) => e.id);
payload.entities = payload.entities.map((e) => { const k = parkedIds.indexOf(e.id); if (k < 0) return e; const z = zAt(e.transform.pos); return { ...e, transform: { ...e.transform, pos: [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + z] } }; });
payload.colliders = payload.colliders.map((c) => { if (c.of || !cover.parked.length) return c; const z = zAt([(c.min[0] + c.max[0]) / 2, (c.min[1] + c.max[1]) / 2]); return { ...c, min: [c.min[0], c.min[1], c.min[2] + z - 0.6], max: [c.max[0], c.max[1], c.max[2] + z] }; });
// what is laid: a box on the ground, a body to see and a collider to hide behind
const LOOK = { log: 0x5b4630, crate: 0x6b6a4a };
for (const b of cover.laid) {
  const z = zAt(b.at), low = b.size[2] < 0.7;
  payload.entities.push({ id: `cover-${b.id}`, rule: { type: 'static' }, transform: { pos: [b.at[0], b.at[1], z + b.size[2] / 2], heading: 0 }, body: { type: 'mesh', shape: 'box', size: b.size, color: low ? LOOK.log : LOOK.crate, marker: false } });
  payload.colliders.push({ of: `cover:${b.id}`, min: [b.at[0] - b.size[0] / 2, b.at[1] - b.size[1] / 2, z - 0.4], max: [b.at[0] + b.size[0] / 2, b.at[1] + b.size[1] / 2, z + b.size[2]] });
}
// THE STRUCTURES: sandbags, wire and towers, as the static world's own faces on the ground (cheap; a tower's deck is
// ground a guard stands on) and their boxes as colliders (a tower's deck and rails are walked under)
const extraFaces = [];
// (each face's colour under the land's own light at the level's hour, as the stage bakes its painted groups: its fill
// times the sky's light and the sun's (or the moon's) by how the face turns to it; a level at night is dark with its land)
const LT = payload.form?.land?.light, SD = payload.form?.land?.sun;
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), enc = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const bakeFill = (hex, n) => {
  if (!LT || !SD) return hex;
  const l = Math.hypot(...SD) || 1, c = Math.max(0, (n[0] * SD[0] + n[1] * SD[1] + n[2] * SD[2]) / l);
  return '#' + [1, 3, 5].map((i, k) => Math.round(Math.max(0, Math.min(1, enc(lin(parseInt(hex.slice(i, i + 2), 16) / 255) * (LT.ambient[k] + LT.sun[k] * c)))) * 255).toString(16).padStart(2, '0')).join('');
};
const baked = (faces) => faces.map((f) => { const fill = bakeFill(f.fill, f.normal); return { ...f, fill, cornerFills: f.cornerFills.map(() => fill) }; });
for (const t of L.structures ?? []) {
  const z = zAt(t.at ?? t.from);
  // (a tower drawn as it is built, level0-plan.js towerFaces: posts, bracing, planks, rails, its stair and roof; its boxes
  // still its colliders, its stair's treads and its deck's frame among them, and its rails: the search never meets them
  // (over its band), and on the page they keep a body on the deck it has climbed to, a body under it walking clear)
  if (t.kind === 'tower') extraFaces.push(...baked(towerFaces(t).map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], +(c[2] + z).toFixed(4)]) }))));
  for (const b of structureBoxes(t)) {
    if (t.kind !== 'tower') extraFaces.push(...baked(boxFaces([b.min[0], b.min[1], z + b.min[2] - (b.min[2] ? 0 : 0.3)], [b.max[0], b.max[1], z + b.max[2]], b.fill, `cover:${t.kind}`)));
    if (b.walk !== false || b.rail) payload.colliders.push({ of: `cover:${t.id}`, min: [b.min[0], b.min[1], z + b.min[2] - 0.4], max: [b.max[0], b.max[1], z + b.max[2]] });
  }
}
payload.faces = [...(payload.faces ?? []), ...extraFaces];
// THE FLOODLIGHTS (`floods`, the form land's: scene/channels/form-floods.js): each hung over a structure's deck (`on`, a
// tower) or at a place along the trail `height` metres up, aimed at a place along the trail on the ground; laid here, where
// the ground's height is known, as the towers are
if (L.floods && payload.form?.land) {
  const { readFloods } = await import('../../../lib/graph/scene/channels/form-floods.js');
  payload.form.land.floods = readFloods(L.floods.map((f) => {
    // (over a tower, on a mast 3.2 m over its deck: the deck's metre of rail then stands under every ray of the beam,
    // where hung lower it laid its shadow across most of it)
    const T = f.on && (L.structures ?? []).find((t) => t.id === f.on), base = T ? T.at : f.at, deck = T ? zAt(base) + (T.height ?? STRUCTURE.tower.height) : zAt(base);
    const top = T ? (T.height ?? STRUCTURE.tower.height) + (f.height ?? 3.2) : (f.height ?? 6);
    return { at: r2([base[0], base[1], zAt(base) + top]), aim: on(f.aim), mast: +deck.toFixed(2), ...Object.fromEntries(Object.entries(f).filter(([k]) => ['colour', 'power', 'cone', 'reach', 'shadow'].includes(k))) };
  }));
}
const deckOf = (w) => { const T = w.on && (L.structures ?? []).find((t) => t.id === w.on); return T ? zAt(T.at) + (T.height ?? STRUCTURE.tower.height) : null; };
// THE WATCHERS: the starter's guard on each round (a patrol between its posts; a post stood still, looking one way)
const W = Object.fromEntries(L.watchers.map((w) => [w.id, w]));
const mission = {
  hints: L.hints.map((h) => ({ at: on(h.at), says: h.says, radius: h.radius ?? 3.5 })),
  // (the level's supplies, laid on the trail as its other places are: a ration, rounds; mission.js \`gives\`)
  items: (L.supplies ?? []).map((x) => ({ id: x.id, name: x.name, look: x.look, gives: x.gives, at: on(x.at) })),
  exits: [{ id: 'trail-end', name: 'On to the base', at: on(L.exit, 0.3), radius: 3, to: o.opt('--next', 'level-1-perimeter.html'), door: 'trailhead' }],
  objectives: [{ id: 'reach', says: 'follow the trail up to the base, unseen', done: 'the-base' }],
};
payload.entities = payload.entities.map((e) => {
  if (e.id === 'hero') return { ...e, rule: { ...e.rule, step: 0.35, mission }, transform: { pos: on(L.start, 0.3), heading: Math.PI / 2 } };
  // (the garrison's alarm on every guard of it: the level's numbers over the starter's, its backup and where it comes from)
  const alarm = { ...(e.rule.alarm ?? {}), ...(L.alarm ?? {}), ...(backupIds.length ? { backup: backupIds, from: on(L.backup.from, 0.2) } : {}) };
  if (backupIds.includes(e.id)) return { ...e, rule: { ...e.rule, alarm }, transform: { pos: on(L.backup.from, 0.2), heading: -Math.PI / 2 } };
  const w = W[e.id]; if (!w) return e;
  const to = w.kind === 'patrol' ? w.to : w.facing, heading = Math.atan2(to[1] - w.at[1], to[0] - w.at[0]);
  return { ...e, rule: { ...e.rule, alarm, speed: w.kind === 'patrol' ? (w.speed ?? GUARD.speed) : 0, sightCone: w.cone ?? GUARD.cone, sightRange: w.range ?? GUARD.range,
    // (a patrol walks its round from `at` to `to` and back, as the planner walks it: its ends given, never a stretch
    // centred on where it stands; and its look round at each end where it says one)
    foe: { ...e.rule.foe, stretch: w.kind === 'patrol' ? +Math.hypot(to[0] - w.at[0], to[1] - w.at[1]).toFixed(2) : 10, ...(w.kind === 'patrol' ? { ends: [on(w.at, 0.2), on(to, 0.2)] } : {}),
      ...(w.look ? { patrol: { ...(e.rule.foe?.patrol ?? {}), look: w.look } } : {}) }, ...(w.on ? { guardRadius: 0.3 } : {}), ...(w.near ? { near: w.near } : {}) }, transform: { pos: deckOf(w) != null ? r2([w.at[0], w.at[1], deckOf(w) + 0.05]) : on(w.at, 0.2), heading } };
});
console.log(`level 0: start ${on(L.start)} · exit ${on(L.exit)} · watchers ${watchersOf(L).map((w) => w.id).join(', ')} · parked ${parkedIds.length} · laid ${cover.laid.length} · form ${payload.form ? 'yes' : 'NO'}`);
const page = await writePage(payload, room, path.join(out, 'level-0-approach.html'), { capture: o.has('--capture'), events: { ...(room.manifest.events ?? {}), hud: [] } });
console.log(`level 0: ${page.file} (${page.mb} MB) · entities ${payload.entities.map((e) => e.id).join(', ')}`);
process.exit(0);
