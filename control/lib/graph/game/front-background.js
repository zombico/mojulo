/**
 * front-background — a START SCREEN's picture, brought by the person (game/front-stage.js `background`): the screen on
 * its own, with the game's name and its menu, in place of the character on its graphic ground (never both). The recipe names a stash image item, so it travels with the recipe and the dashboard's upload is one
 * way in; a picture the agent has as a file (`{ path }`) is filed into a stash by design_game's patch before it is
 * written, as create_cover files its art (image-outcomes/cover-upload.js).
 *
 *   patchStageBackgrounds(ops, { title })  → { patch, filed }: each op that sets a stage's background as { path } (at
 *                                            /front, /front/stage or /front/stage/background) with the picture filed and
 *                                            named { stash, item }; `filed` says which. Other ops pass as they are
 *   backgroundBytes(from)                  → { buffer, ext }: the picture's bytes and its extension (export_game), or
 *                                            throws, teaching
 *
 * Server side: the stash repository and the storage, through cover-upload.js.
 */
import { readArtFile, fileArt, uploadedArt, pictureHeader } from '../image-outcomes/cover-upload.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const filePicture = (B, title) => (isObj(B) && typeof B.path === 'string' ? fileArt(readArtFile(B.path), { title, label: 'start screen' }) : null);

export function patchStageBackgrounds(ops, { title = 'game' } = {}) {
  if (!Array.isArray(ops)) return { patch: ops, filed: [] };
  const filed = [];
  const patch = ops.map((op) => {
    if (!isObj(op) || !['set', 'add', 'replace'].includes(op.op) || typeof op.path !== 'string') return op;
    const swap = (B, put) => { const f = filePicture(B, title); if (!f) return op; filed.push({ path: B.path, ...f }); return { ...op, value: put(f) }; };
    if (op.path === '/front/stage/background') return swap(op.value, (f) => f);
    if (op.path === '/front/stage' && isObj(op.value)) return swap(op.value.background, (f) => ({ ...op.value, background: f }));
    if (op.path === '/front' && isObj(op.value) && isObj(op.value.stage)) return swap(op.value.stage.background, (f) => ({ ...op.value, stage: { ...op.value.stage, background: f } }));
    return op;
  });
  return { patch, filed };
}

export async function backgroundBytes(from) {
  const buffer = Buffer.from(await uploadedArt(from));
  const head = pictureHeader(buffer);
  if (!head) throw new Error(`front.stage.background: stash '${from.stash}' item ${from.item} is not a PNG, JPEG or WebP picture`);
  return { buffer, ext: head.type === 'jpeg' ? 'jpg' : head.type };
}
