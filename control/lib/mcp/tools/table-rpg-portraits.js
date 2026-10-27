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
 * beast-kin on the hero and creature doors, a beast on the animal door, a mascot as a creature. A foe rolled alone on
 * the egocube is made as a member is. The game records each on its foe as `character: <ref>`. A body the loop cannot
 * make is said (`failed`), and the game goes on without it.
 *
 * Photographed: each member's character on its World page (the colour the dashboard shows: its palette, its toon light)
 * in headless Chromium, the turnaround the character bible's colour plates are taken with (character-renders.mjs): a
 * three-quarter figure for the party's line-up and a bust for its sheet, on the book's own paper. Kept in memory per
 * revision of the character and the paper. Chromium is an optional worker: without one, no photograph, and the sheets
 * keep their frame.
 *
 *   makeTableCharacters({ ref, tableRpg, title }) → { tableRpg, made: [{ id | foe, sheet, member?, character }],
 *     failed: [{ foe, why }] }   rows written
 *   tableRpgPortraits(manifest, { paper? }) → { portraits: { <id>: { figure, bust } }, foes: { <foe id>: { figure,
 *     bust } }, missing: [{ id | foe, why }] }   figure and bust are image data URIs, framed by the body's own extent
 *     (a figure standing or a beast on four feet, the bust at the top of it, its head)
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readTableRpg } from '@/lib/graph/table-rpg/table-rpg-manifest';
import { childRef } from '@/lib/graph/gameworld/runner';
import { createSketchHandler } from './sketch-mint.js';
import { createCharacterHandler } from './create-character.js';
import { castRequestOf, CAST_LEADERS, CAST_PATH } from '@/lib/graph/table-rpg/table-rpg-cast';

export async function makeTableCharacters({ ref, tableRpg, title }) {
  const { module } = readTableRpg(tableRpg);
  const made = [];
  const party = [];
  for (const p of module.party) {
    // the member as written, its rolled persona's roll kept (so the stored party reads back the same persona)
    const own = (tableRpg.party ?? []).find((q) => q.id === p.id) ?? { id: p.id, ...(p.role ? { role: p.role } : {}) };
    if (p.character || !p.egocube?.roll) { party.push(own); continue; }
    const sheetRef = childRef(ref, `${p.id}-sheet`), charRef = childRef(ref, p.id);
    await createSketchHandler({ title: `${title} · ${p.name} (sheet)`, ref: sheetRef, manifest: { kind: 'egocube', roll: p.egocube.roll } });
    await createCharacterHandler({ egocube: sheetRef, title: `${title} · ${p.name}`, ref: charRef });
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
        await createCharacterHandler({ egocube: castRef, member: CAST_PATH[part], title: `${title} · ${F.persona.name ?? F.name}`, ref: charRef });
        record(id, charRef);
        made.push({ foe: id, sheet: castRef, member: CAST_PATH[part], character: charRef });
      } catch (err) { failed.push({ foe: id, why: err.message.split('\n')[0] }); }
    }
  }
  for (const [id, F] of Object.entries(module.foes)) {
    if (leaders.has(id) || F.character || !F.egocube?.roll) continue;
    const sheetRef = childRef(ref, `foe-${id}-sheet`), charRef = childRef(ref, `foe-${id}`);
    try {
      await createSketchHandler({ title: `${title} · ${F.name ?? id} (sheet)`, ref: sheetRef, manifest: { kind: 'egocube', roll: F.egocube.roll } });
      await createCharacterHandler({ egocube: sheetRef, title: `${title} · ${F.name ?? id}`, ref: charRef });
      foes[id] = { ...(foes[id] ?? {}), egocube: { roll: F.egocube.roll }, character: charRef };
      made.push({ foe: id, sheet: sheetRef, character: charRef });
    } catch (err) { failed.push({ foe: id, why: err.message.split('\n')[0] }); }
  }
  return { tableRpg: { ...tableRpg, party, ...(Object.keys(foes).length ? { foes } : {}) }, made, failed };
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
  const bustTarget = [at(0), at(1), hi[2] - tall * B.drop];
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
    try { foes[id] = await shoot(F.character, paper, F.persona?.body); } catch (err) { missing.push({ foe: id, why: err.message.split('\n')[0] }); }
  }
  return { portraits, foes, missing };
}
