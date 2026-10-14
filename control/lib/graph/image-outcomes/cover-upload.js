/**
 * cover-upload — a cover's illustration from an image the operator uploaded, in place of a painted one. The image
 * worker is never involved: the operator adds the picture to a stash (the dashboard's add-image, POST
 * /api/stashes/<ref>/items) and the agent maps it onto the cover's illustration slot:
 *
 *   slots.illustration: { realizer: 'upload', from: { stash: '<stash ref>', item: <item id> } }
 *
 * The Claude plugin profile has no image worker, so its covers start with `realizer: 'placeholder'` (the palette
 * stand-in, nothing to paint) and take an upload this way. Server side (the stash repository, the storage).
 *
 *   readUploadFrom(from)        → { stash, item } or throws, teaching (shape only)
 *   checkUploadedArt(from)      → errors[]: the stash, the item and its being an image (create_cover's gate)
 *   uploadedArt(from)           → the image's bytes (the compositor's illustration layer), or throws, teaching
 */
import { StashRepository } from '@/lib/db/repositories/stashes';
import { downloadToBuffer } from '@/lib/storage';

const HOW = "an uploaded illustration is { stash: '<stash ref>', item: <image item id> }: add the picture to a stash on the dashboard (add image), then get_stash for its item id";

export function readUploadFrom(from) {
  if (!from || typeof from !== 'object' || typeof from.stash !== 'string' || !from.stash || !Number.isInteger(from.item)) throw new Error(HOW);
  return { stash: from.stash, item: from.item };
}

function itemOf(from) {
  const { stash, item } = readUploadFrom(from);
  const s = StashRepository.getByRef(stash);
  if (!s) return { error: `no stash '${stash}' (${HOW})` };
  const it = StashRepository.getItemById(item);
  if (!it || it.stashId !== s.id) return { error: `stash '${stash}' has no item ${item}` };
  if (it.type !== 'image') return { error: `item ${item} of '${stash}' is ${it.type}, not an image` };
  if (!it.mediaRef || it.mediaRef.startsWith('doc_')) return { error: `item ${item} of '${stash}' has no stored image bytes (re-add the picture on the dashboard)` };
  return { it };
}

export function checkUploadedArt(from) {
  try { const r = itemOf(from); return r.error ? [r.error] : []; }
  catch (err) { return [err.message]; }
}

export async function uploadedArt(from) {
  const r = itemOf(from);
  if (r.error) throw new Error(`cover illustration: ${r.error}`);
  return downloadToBuffer(r.it.mediaRef);
}
