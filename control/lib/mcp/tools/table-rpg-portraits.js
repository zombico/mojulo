/**
 * The table game's CHARACTERS AND PORTRAITS: each party member made a real character through the character loop, and
 * photographed for its book.
 *
 * Made: a member rolled on the egocube (its persona) is written as an egocube row from that very roll and made into a
 * character through the character door (create_character { egocube }), as the fight goal makes its fighters: a body
 * the operator can revise (update_character), walk, export, or put in another game. The game records it on the member
 * as `character: <ref>`; a member that already names one keeps it.
 *
 * Photographed: each member's character on its World page (the colour the dashboard shows: its palette, its toon light)
 * in headless Chromium, the turnaround the character bible's colour plates are taken with (character-renders.mjs): a
 * three-quarter figure for the party's line-up and a bust for its sheet, on the book's own paper. Kept in memory per
 * revision of the character and the paper. Chromium is an optional worker: without one, no photograph, and the sheets
 * keep their frame.
 *
 *   makePartyCharacters({ ref, tableRpg, title }) → { tableRpg, made: [{ id, sheet, character }] }   rows written
 *   tableRpgPortraits(manifest, { paper? }) → { portraits: { <id>: { figure, bust } }, missing: [{ id, why }] }
 *     figure and bust are image data URIs
 */
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readTableRpg } from '@/lib/graph/table-rpg/table-rpg-manifest';
import { childRef } from '@/lib/graph/gameworld/runner';
import { createSketchHandler } from './sketch-mint.js';
import { createCharacterHandler } from './create-character.js';

export async function makePartyCharacters({ ref, tableRpg, title }) {
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
  return { tableRpg: { ...tableRpg, party }, made };
}

const PHOTOS = new Map();   // key → Promise<{ figure, bust }>: a photograph is seconds; a book is read again and again
const SIZE = 420, FOCAL = 1400;

async function photograph(sketch, paper) {
  const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
  const { weldFaces, frameSource, orbitCamera } = await import('@/lib/graph/scene/wire-svg.js');
  const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');
  const { renderWorldFrames } = await import('@/lib/motion/world-frames.js');
  const sharp = (await import('sharp')).default;
  const { payload } = await resolveWorldScene(sketch);
  const faces = (payload?.faces ?? []).filter((f) => !f.studio);   // the workbench floor and grid are studio furniture
  if (!faces.length) throw new Error(`'${sketch.ref}' has no body to photograph`);
  const source = weldFaces(faces);
  const { target, distance } = frameSource(source, { focalPixels: FOCAL, size: SIZE });
  // the bust: aimed at the head and the shoulders (the top fifth of the body), from nearer
  let top = -Infinity, low = Infinity;
  for (const v of source.vertices) { if (v[2] > top) top = v[2]; if (v[2] < low) low = v[2]; }
  const bustTarget = [target[0], target[1], top - (top - low) * 0.13];
  const shots = [
    // the figure: its height filling nine tenths of the frame (the lens's half-height at a distance d is d·SIZE/2FOCAL)
    ['figure', orbitCamera({ azimuthDegrees: 155, elevationDegrees: 8, target, distance: ((top - low) * 0.56) / (SIZE / (2 * FOCAL)), focalPixels: FOCAL, size: SIZE })],
    ['bust', orbitCamera({ azimuthDegrees: 160, elevationDegrees: 4, target: bustTarget, distance: distance * 0.36, focalPixels: FOCAL, size: SIZE })],
  ];
  const page = emitThreeWorld({ ...payload, faces, sky: null, bg: paper, wireframe: false, walk: false, spin: false, decollide: true, hud: false, inline: true, capture: true, xr: null });
  const vfov = 2 * Math.atan((SIZE / 2) / FOCAL) * 180 / Math.PI;
  const { pngs } = await renderWorldFrames(page, shots.map(([, cam]) => ({ pos: cam.position, target: cam.meta.target, vfov })), { width: SIZE, height: SIZE, deviceScaleFactor: 2 });
  const out = {};
  for (let i = 0; i < shots.length; i++) out[shots[i][0]] = `data:image/jpeg;base64,${(await sharp(pngs[i]).jpeg({ quality: 86 }).toBuffer()).toString('base64')}`;
  return out;
}

export async function tableRpgPortraits(manifest, { paper = '#ffffff' } = {}) {
  const { module } = readTableRpg(manifest.tableRpg);
  const portraits = {}, missing = [];
  for (const p of module.party) {
    if (!p.character) { missing.push({ id: p.id, why: 'no character made for it (a member rolled on the egocube is made one when the game is minted; character: <ref> names one)' }); continue; }
    const row = SketchRepository.getByRef(p.character);
    if (!row) { missing.push({ id: p.id, why: `no character '${p.character}'` }); continue; }
    const key = `${row.ref}:${row.updatedAt}:${paper}`;
    if (!PHOTOS.has(key)) { const shot = photograph(row, paper); PHOTOS.set(key, shot); shot.catch(() => PHOTOS.delete(key)); }
    try { portraits[p.id] = await PHOTOS.get(key); } catch (err) { missing.push({ id: p.id, why: err.message.split('\n')[0] }); }
  }
  return { portraits, missing };
}
