/**
 * The table game's CHARACTERS AND PORTRAITS: each party member, and each leader of its cast, made a real character
 * through the character loop, and photographed for its book.
 *
 * Made: a member rolled on the egocube (its persona) is written as an egocube row from that very roll and made into a
 * character through the character door (create_character { egocube }), as the fight goal makes its fighters: a body
 * the operator can revise (update_character), walk, export, or put in another game. The game records it on the member
 * as `character: <ref>`; a member that already names one keeps it.
 * The CAST (table-rpg-cast.js) is written as an egocube cast row from the very request the game reads, and each of its
 * leaders (the mastermind, the lieutenant, the rival) made by its member path, whatever its body: a person or a
 * beast-kin on the hero and creature doors, a beast on the animal door (a game creature by its oozes), a mascot as a
 * creature. A foe that is a beast (`beast: { species, ooze? }`) is made on the animal door, its oozes the mutagen's; a
 * foe rolled alone on the egocube is made as a member is. The game records each on its foe as `character: <ref>`. A body the loop cannot
 * make is said (`failed`), and the game goes on without it.
 *
 * Photographed: each member's character on its World page (the colour the dashboard shows: its palette, its toon light)
 * in headless Chromium, the turnaround the character bible's colour plates are taken with (character-renders.mjs): a
 * three-quarter figure for the party's line-up and a bust for its sheet, on the book's own paper. Kept in memory per
 * revision of the character and the paper. Chromium is an optional worker: without one, no photograph, and the sheets
 * keep their frame.
 *
 * ARMS: a member made on the hero door holds its class's weapon (or the artifact it starts with) as the equipment
 * kernel makes it, in the game's arms style; a person of the cast its role's arms in the foes' style (table-rpg-gear.js).
 * ARTIFACTS: each item with a `build` is minted as an equipment item (`mint_solid { kind: 'equipment' }`), recorded on
 * its item as `artifact: <ref>`, and photographed as an object.
 *
 *   makeTableCharacters({ ref, tableRpg, title }) → { tableRpg, made: [{ id | foe | item, sheet?, member?, character |
 *     artifact }], failed: [{ foe | item, why }] }   rows written
 *   tableRpgPortraits(manifest, { paper? }) → { portraits: { <id>: { figure, bust } }, foes: { <foe id>: { figure,
 *     bust } }, items: { <item id>: { figure, frame: 'tall' | 'square' } }, missing: [{ id | foe | item, why }] }   image data URIs, framed by the
 *     body's own extent (a figure standing or a beast on four feet, the bust at its head; an object its longest run)
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readTableRpg } from '@/lib/graph/table-rpg/table-rpg-manifest';
import { childRef } from '@/lib/graph/gameworld/runner';
import { createSketchHandler } from './sketch-mint.js';
import { createCharacterHandler } from './create-character.js';
import { castRequestOf, beastWords, CAST_LEADERS, CAST_PATH } from '@/lib/graph/table-rpg/table-rpg-cast';
import { beastMovesOf } from '@/lib/graph/egocube/moves.js';
import { egocubeCreate, rollStored } from '@/lib/graph/egocube/kind.js';
import { itemBuildOf, memberGear, foeGear } from '@/lib/graph/table-rpg/table-rpg-gear';
import { mintSolidHandler } from './mint-solid.js';

// arms in hand for a person on the hero door (the hero's `gear`: the equipment kernel's builds); a body below the hero
// door, a beast or a mascot holds nothing
const armed = (cube, gear, member) => (gear && egocubeCreate(rollStored(cube), member ? { member } : {}).create.as === 'hero' ? { spec: { gear } } : {});

export async function makeTableCharacters({ ref, tableRpg, title }) {
  const { module, K } = readTableRpg(tableRpg);
  const made = [];
  const party = [];
  for (const p of module.party) {
    // the member as written, its rolled persona's roll kept (so the stored party reads back the same persona)
    const own = (tableRpg.party ?? []).find((q) => q.id === p.id) ?? { id: p.id, ...(p.role ? { role: p.role } : {}) };
    if (p.character || !p.egocube?.roll) { party.push(own); continue; }
    const sheetRef = childRef(ref, `${p.id}-sheet`), charRef = childRef(ref, p.id);
    await createSketchHandler({ title: `${title} · ${p.name} (sheet)`, ref: sheetRef, manifest: { kind: 'egocube', roll: p.egocube.roll } });
    // the member holds its class's weapon as the equipment kernel makes it (or the artifact it starts with), in the
    // game's arms style
    const kp = K.party.find((q) => q.id === p.id);
    await createCharacterHandler({ egocube: sheetRef, title: `${title} · ${p.name}`, ref: charRef, ...armed({ kind: 'egocube', roll: p.egocube.roll }, memberGear(module, K, kp)) });
    made.push({ id: p.id, sheet: sheetRef, character: charRef });
    party.push({ ...own, egocube: { roll: p.egocube.roll }, character: charRef });
  }
  // the cast's leaders, by their member paths in a cast row of the very request the game reads; a foe rolled alone
  const foes = { ...(tableRpg.foes ?? {}) }, failed = [];
  const record = (id, character) => { foes[id] = { ...(foes[id] ?? {}), character }; };
  const request = castRequestOf(module), leaders = request ? new Set(CAST_LEADERS.map((part) => module.cast.as[part])) : new Set();
  if (request) {
    const castRef = childRef(ref, 'cast');
    await createSketchHandler({ title: `${title} · the cast`, ref: castRef, manifest: { kind: 'egocube', cast: request } });
    for (const part of CAST_LEADERS) {
      const id = module.cast.as[part], F = module.foes[id];
      if (F.character) continue;
      const charRef = childRef(ref, `cast-${part}`);
      try {
        await createCharacterHandler({ egocube: castRef, member: CAST_PATH[part], title: `${title} · ${F.persona.name ?? F.name}`, ref: charRef, ...armed({ kind: 'egocube', cast: request }, foeGear(module, F), CAST_PATH[part]) });
        record(id, charRef);
        made.push({ foe: id, sheet: castRef, member: CAST_PATH[part], character: charRef });
      } catch (err) { failed.push({ foe: id, why: err.message.split('\n')[0] }); }
    }
  }
  // a foe that is a beast: the animal door, the species made a game creature by its oozes, on its two gaits
  for (const [id, F] of Object.entries(module.foes)) {
    if (leaders.has(id) || F.character || !F.beast) continue;
    const charRef = childRef(ref, `foe-${id}`);
    try {
      await createCharacterHandler({ as: 'animal', spec: { species: F.beast.species, motion: beastMovesOf(F.beast.species).motion, ...(F.beast.ooze !== undefined ? { ooze: F.beast.ooze } : {}) }, title: `${title} · ${F.name ?? id} (${beastWords(F.beast).slice(2)})`, ref: charRef });
      record(id, charRef);
      made.push({ foe: id, character: charRef });
    } catch (err) { failed.push({ foe: id, why: err.message.split('\n')[0] }); }
  }
  for (const [id, F] of Object.entries(module.foes)) {
    if (leaders.has(id) || F.character || F.beast || !F.egocube?.roll) continue;
    const sheetRef = childRef(ref, `foe-${id}-sheet`), charRef = childRef(ref, `foe-${id}`);
    try {
      await createSketchHandler({ title: `${title} · ${F.name ?? id} (sheet)`, ref: sheetRef, manifest: { kind: 'egocube', roll: F.egocube.roll } });
      await createCharacterHandler({ egocube: sheetRef, title: `${title} · ${F.name ?? id}`, ref: charRef });
      foes[id] = { ...(foes[id] ?? {}), egocube: { roll: F.egocube.roll }, character: charRef };
      made.push({ foe: id, sheet: sheetRef, character: charRef });
    } catch (err) { failed.push({ foe: id, why: err.message.split('\n')[0] }); }
  }
  // the ARTIFACTS: each item with a build minted as an equipment item of its own (a workbench row the kernel expands),
  // recorded on its item as `artifact: <ref>`
  const items = { ...(tableRpg.items ?? {}) };
  for (const id of Object.keys(module.items ?? {})) {
    const build = itemBuildOf(module, id), I = module.items[id];
    if (!build || I.artifact) continue;
    const itemRef = childRef(ref, `item-${id}`);
    try {
      await mintSolidHandler({ kind: 'equipment', spec: build, title: `${title} · ${I.name ?? id}`, ref: itemRef });
      items[id] = { ...(items[id] ?? {}), artifact: itemRef };
      made.push({ item: id, artifact: itemRef });
    } catch (err) { failed.push({ item: id, why: err.message.split('\n')[0] }); }
  }
  return { tableRpg: { ...tableRpg, party, ...(Object.keys(foes).length ? { foes } : {}), ...(Object.keys(items).length ? { items } : {}) }, made, failed };
}

const PHOTOS = new Map();   // key → Promise<{ figure, bust }>: a photograph is seconds; a book is read again and again
const SIZE = 420, FOCAL = 1400;

async function photograph(sketch, paper, body = 'person') {
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { weldFaces, frameSource, orbitCamera } = await import('@/lib/graph/scene/wire-svg.js');
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
  const { renderWorldFrames } = await import('@/lib/motion/world-frames.js');
  const sharp = (await import('sharp')).default;
  const { payload } = await resolveWorldScene(sketch);
  const faces = (payload?.faces ?? []).filter((f) => !f.studio);   // the workbench floor and grid are studio furniture
  if (!faces.length) throw new Error(`'${sketch.ref}' has no body to photograph`);
  const source = weldFaces(faces);
  const { distance } = frameSource(source, { focalPixels: FOCAL, size: SIZE });
  // the body's extent: how tall, how long (a figure stands; a beast is longer than it is tall)
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of source.vertices) for (let k = 0; k < 3; k++) { if (v[k] < lo[k]) lo[k] = v[k]; if (v[k] > hi[k]) hi[k] = v[k]; }
  // across, the body's run between its 2nd and 98th percentiles: a tail, a whisker or a cape's tip does not widen it
  const span = (k) => { const xs = source.vertices.map((v) => v[k]).sort((a, b) => a - b); return [xs[Math.floor(xs.length * 0.02)], xs[Math.floor(xs.length * 0.98)]]; };
  const [sx, sy] = [span(0), span(1)];
  const tall = hi[2] - lo[2], long = Math.max(sx[1] - sx[0], sy[1] - sy[0]), lens = SIZE / (2 * FOCAL);
  // the bust: aimed at the head, the top of the body wherever it stands (the top tenth's middle), from nearer
  const crown = source.vertices.filter((v) => v[2] >= hi[2] - tall * 0.1);
  const at = (k) => crown.reduce((a, v) => a + v[k], 0) / crown.length;
  const upright = tall >= long, center = [(sx[0] + sx[1]) / 2, (sy[0] + sy[1]) / 2, (lo[2] + hi[2]) / 2];
  // a mascot's head is half of it: its bust is the head whole; a person's the head and shoulders; a beast's its head
  const B = body === 'mascot' ? { drop: 0.3, half: 0.34 } : upright ? { drop: 0.13, half: null } : { drop: 0.13, half: Math.max(tall * 0.42, long * 0.22) / tall };
  let bustTarget = [at(0), at(1), hi[2] - tall * B.drop];
  // a long body's head is where its plan seats it (a species' neckTop, the head carried forward of it), not its top: a
  // wing, a horn or a crest can stand higher than the head
  const J = sketch.manifest?.plan?.joints, nt = J?.neckTop, nb = J?.neckBase;
  if (!upright && nt && nb) {
    const d = [nt[0] - nb[0], nt[1] - nb[1]], n = Math.hypot(d[0], d[1]) || 1, f = [d[0] / n, d[1] / n];
    const head = source.vertices.filter((v) => (v[0] - nt[0]) * f[0] + (v[1] - nt[1]) * f[1] >= 0 && Math.hypot(v[0] - nt[0], v[1] - nt[1], v[2] - nt[2]) < long * 0.3);
    const inside = nt.every((c, k) => c >= lo[k] - 0.05 && c <= hi[k] + 0.05);
    if (inside && head.length >= 8) bustTarget = [0, 1, 2].map((k) => head.reduce((a, v) => a + v[k], 0) / head.length);
  }
  // an object (an artifact) is one shot, seen a little from above: a long upright one (a staff, a sword, a bow) in a
  // tall frame its height fills, anything else in a square
  if (body === 'object') {
    // (by its whole extent: an axe's blade is a few vertices beside a haft's thousands, and must not be trimmed away)
    const across = Math.max(hi[0] - lo[0], hi[1] - lo[1]), whole = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const tallOne = tall > across * 1.6, W = tallOne ? Math.round(SIZE * 0.45) : SIZE, H = tallOne ? Math.round(SIZE * 1.3) : SIZE, lensH = H / (2 * FOCAL);
    const cam = orbitCamera({ azimuthDegrees: 140, elevationDegrees: 18, target: whole, distance: Math.max(tall * 0.53, across * 0.55 * (H / W)) / lensH, focalPixels: FOCAL, size: H });
    const page = emitThreeWorld({ ...payload, faces, sky: null, bg: paper, wireframe: false, walk: false, spin: false, decollide: true, hud: false, inline: true, capture: true, xr: null });
    const { pngs } = await renderWorldFrames(page, [{ pos: cam.position, target: cam.meta.target, vfov: 2 * Math.atan((H / 2) / FOCAL) * 180 / Math.PI }], { width: W, height: H, deviceScaleFactor: 2 });
    return { figure: `data:image/jpeg;base64,${(await sharp(pngs[0]).jpeg({ quality: 86 }).toBuffer()).toString('base64')}`, frame: tallOne ? 'tall' : 'square' };
  }
  const shots = [
    // the figure: its height filling nine tenths of the frame (the lens's half-height at a distance d is d·SIZE/2FOCAL),
    // or a long body its length, seen three-quarters, aimed at the middle of its extent
    ['figure', orbitCamera({ azimuthDegrees: 155, elevationDegrees: upright ? 8 : 14, target: center, distance: Math.max(tall * 0.56, long * 0.5) / lens, focalPixels: FOCAL, size: SIZE })],
    ['bust', orbitCamera({ azimuthDegrees: 160, elevationDegrees: 4, target: bustTarget, distance: B.half === null ? distance * 0.36 : (tall * B.half) / lens, focalPixels: FOCAL, size: SIZE })],
  ];
  const page = emitThreeWorld({ ...payload, faces, sky: null, bg: paper, wireframe: false, walk: false, spin: false, decollide: true, hud: false, inline: true, capture: true, xr: null });
  const vfov = 2 * Math.atan((SIZE / 2) / FOCAL) * 180 / Math.PI;
  const { pngs } = await renderWorldFrames(page, shots.map(([, cam]) => ({ pos: cam.position, target: cam.meta.target, vfov })), { width: SIZE, height: SIZE, deviceScaleFactor: 2 });
  const out = {};
  for (let i = 0; i < shots.length; i++) out[shots[i][0]] = `data:image/jpeg;base64,${(await sharp(pngs[i]).jpeg({ quality: 86 }).toBuffer()).toString('base64')}`;
  return out;
}

async function shoot(characterRef, paper, body) {
  const row = SketchRepository.getByRef(characterRef);
  if (!row) throw new Error(`no character '${characterRef}'`);
  const key = `${row.ref}:${row.updatedAt}:${paper}`;
  if (!PHOTOS.has(key)) { const shot = photograph(row, paper, body); PHOTOS.set(key, shot); shot.catch(() => PHOTOS.delete(key)); }
  return PHOTOS.get(key);
}

export async function tableRpgPortraits(manifest, { paper = '#ffffff' } = {}) {
  const { module } = readTableRpg(manifest.tableRpg);
  const portraits = {}, foes = {}, missing = [];
  for (const p of module.party) {
    if (!p.character) { missing.push({ id: p.id, why: 'no character made for it (a member rolled on the egocube is made one when the game is minted; character: <ref> names one)' }); continue; }
    try { portraits[p.id] = await shoot(p.character, paper); } catch (err) { missing.push({ id: p.id, why: err.message.split('\n')[0] }); }
  }
  // the foes that are characters: the cast's leaders, a foe rolled alone, one the module names
  for (const [id, F] of Object.entries(module.foes)) {
    if (!F.character) continue;
    try { foes[id] = await shoot(F.character, paper, F.persona?.body ?? (F.beast ? 'beast' : undefined)); } catch (err) { missing.push({ foe: id, why: err.message.split('\n')[0] }); }
  }
  // the artifacts: each item minted as an object, one shot
  const items = {};
  for (const [id, I] of Object.entries(module.items ?? {})) {
    if (!I.artifact) continue;
    try { items[id] = await shoot(I.artifact, paper, 'object'); } catch (err) { missing.push({ item: id, why: err.message.split('\n')[0] }); }
  }
  return { portraits, foes, items, missing };
}
