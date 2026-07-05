/**
 * create_beats / get_beats_vocab — the Mojulo Beats entry point (beats.plan.md).
 *
 * The audio sibling of the visual mints: one dispatcher tool over four manifest
 * kinds (beats-ambient | beats-composition | beats-pattern | beats-sfx), the create_view
 * discipline — a new kind costs a beats-vocab card, not a new registration.
 * Artifacts ride the `sketches` table (kind-discriminated recipes, no blobs;
 * synthesized WebAudio regenerated per request) and play at /sketches/<ref>
 * via the /api/sketches/<ref>/beats player page.
 *
 * Per-kind parameter manuals live in beats-vocab cards, indexed under
 * source_kind='beats_vocab' — semantic_search to find, get_beats_vocab to read.
 * Errors teach: a failed mint points at the kind's card.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { BEATS_KINDS, validateBeatsManifest, normalizeBeatsManifest } from '@/lib/graph/beats/beats-manifest';
import { getBeatsVocabCatalog } from '@/lib/graph/beats/beats-vocab/loader';

export function mintBeats({ kind, title, params, ref, folderRef } = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folderRef` must be a non-empty string or null if provided');
    }
    if (!SketchFolderRepository.getByRef(folderRef)) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }
  const manifest = { ...(params && typeof params === 'object' ? params : {}), kind, title };
  const { ok, errors } = validateBeatsManifest(manifest);
  if (!ok) {
    throw new Error(`Invalid ${kind} recipe:\n - ${errors.join('\n - ')}`);
  }
  const finalized = normalizeBeatsManifest(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest: finalized, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    playerUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/beats`,
  };
}

export async function createBeatsHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_beats requires an object: { kind, title, params }');
  }
  const { kind, title, params, ref, folder_ref: folderRef } = input;
  if (!BEATS_KINDS.includes(kind)) {
    throw new Error(
      `create_beats: unknown kind '${kind}'. Known kinds: ${BEATS_KINDS.join(', ')}. ` +
        `Find one by intent via semantic_search({ kinds: ['beats_vocab'] }), then read its ` +
        `parameter manual via get_beats_vocab({ id: '<kind>' }).`,
    );
  }
  try {
    return mintBeats({ kind, title, params, ref, folderRef });
  } catch (err) {
    // Error-as-drawer: a failed mint points at the kind's parameter manual.
    throw new Error(`${err.message} — parameter manual: get_beats_vocab({ id: '${kind}' }).`);
  }
}

export async function getBeatsVocabHandler(input) {
  const { id } = input && typeof input === 'object' ? input : {};
  const catalog = getBeatsVocabCatalog();
  if (id) {
    const card = catalog.get(id);
    if (!card) {
      throw new Error(`get_beats_vocab: unknown card '${id}'. Known: ${[...catalog.keys()].join(', ')}`);
    }
    return { ok: true, card };
  }
  return {
    ok: true,
    cards: [...catalog.values()].map(({ id: cid, name, summary, when }) => ({ id: cid, name, summary, when })),
  };
}

export function registerBeatsTools() {
  registerTool({
    name: 'create_beats',
    description:
      'Mint a MUSICAL artifact — synthesized WebAudio from a tiny deterministic recipe, played at '
      + '/sketches/<ref> (no media bytes stored; every sound is computed at play time). One tool, four '
      + 'kinds: `beats-ambient` (a seeded generative music loop — tempo/key/progression/channels; the '
      + 'world-soundtrack primitive), `beats-composition` (an explicit note-event score — a specific '
      + 'melody/jingle/fanfare, no dice), `beats-pattern` (a step-sequencer groove loop — tracks × '
      + 'sixteenth velocity masks with note contours; drum machine / house / garage / techno beats), '
      + '`beats-sfx` (named foley cues built from four chiptune gestures: '
      + 'sweep/flutter/burst/thump — pickups, lasers, impacts, charge-ups; the world-SFX primitive). Pick '
      + '`kind`; the kind\'s own recipe goes in `params` — find a kind by intent via '
      + "semantic_search({ kinds: ['beats_vocab'] }) and read its parameter manual via "
      + 'get_beats_vocab({ id: \'<kind>\' }) before passing params. Wire into a world via the world '
      + 'manifest\'s `audio` channel ({ soundtrack: { beatsRef } }, sfx cues on bus events). Reach for '
      + '"give this world music / a soundtrack", "compose a tune", "make a pickup/laser/charge sound".',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: BEATS_KINDS, description: 'Which musical artifact. Parameter manual: get_beats_vocab({ id: kind }).' },
        title: { type: 'string', description: 'Title for the resulting artifact.' },
        params: { type: 'object', description: "The kind's own recipe (see its beats-vocab card). Validated by the mint; a failed mint returns the card pointer." },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: ['kind', 'title', 'params'],
    },
    handler: createBeatsHandler,
  });

  registerTool({
    name: 'get_beats_vocab',
    description:
      'Read a beats-vocab card in full — the routing phrases + parameter manual for one `create_beats` '
      + 'kind (beats-ambient / beats-composition / beats-pattern / beats-sfx: recipe shape, patch shelf, effects chains, '
      + 'gesture vocabulary, musical guidance). Pass `id` for one card; omit for the index rows '
      + "{ id, name, summary, when }. Discover cards by intent via semantic_search({ kinds: ['beats_vocab'] }); "
      + 'this reader returns the full body. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Card id (= the create_beats kind).' },
      },
      required: [],
    },
    handler: getBeatsVocabHandler,
  });
}
