/**
 * create_beats / get_beats_vocab — the Mojulo Beats entry point (beats.plan.md).
 *
 * The audio sibling of the visual mints: one dispatcher tool over four manifest
 * kinds (beats-ambient | beats-composition | beats-pattern | beats-sfx), the create_view
 * discipline — a new kind costs a beats-vocab card, not a new registration.
 * Artifacts ride the `sketches` table as STORAGE (kind-discriminated recipes,
 * no blobs; synthesized WebAudio regenerated per request) but surface as their
 * own thing: the /beats/<ref> studio over the /api/beats/<ref> player. The
 * sketch framing never reaches the operator.
 *
 * Per-kind parameter manuals live in beats-vocab cards, indexed under
 * source_kind='beats_vocab' — semantic_search to find, get_beats_vocab to read.
 * Errors teach: a failed mint points at the kind's card.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { BeatsRevisionRepository, BeatsAnnotationRepository } from '@/lib/db/repositories/beats';
import { BEATS_KINDS, isBeatsKind, validateBeatsManifest, normalizeBeatsManifest } from '@/lib/graph/beats/beats-manifest';
import { renderBeatsOffline } from '@/lib/graph/beats/beats-render';
import { renderBeatsMidi } from '@/lib/graph/beats/beats-midi';
import { diffBeatsManifests } from '@/lib/graph/beats/beats-diff';
import { getBeatsVocabCatalog } from '@/lib/graph/beats/beats-vocab/loader';
import { exportsBaseDir } from './exports-dir';

// Fetch a sketch row and insist it's a beats artifact — the shared entrance
// for every read/edit/annotate/diff tool below. Errors teach the mint path.
function requireBeatsSketch(ref) {
  if (!ref || typeof ref !== 'string') throw new Error('`ref` is required (string)');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) throw new Error(`No sketch exists at ref '${ref}'`);
  if (!sketch.manifest || !isBeatsKind(sketch.manifest.kind)) {
    throw new Error(
      `'${ref}' is not a beats artifact (kind: ${sketch.manifest?.kind ?? 'none'}). `
      + 'Beats refs are minted by create_beats; sketch/view kinds are edited with update_sketch.',
    );
  }
  return sketch;
}

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
  // B9: every beats artifact carries a revision history from birth.
  BeatsRevisionRepository.append({ ref: sketch.ref, manifest: finalized, note: 'minted' });

  return {
    ok: true,
    ref: sketch.ref,
    url: `/beats/${encodeURIComponent(sketch.ref)}`,
    playerUrl: `/api/beats/${encodeURIComponent(sketch.ref)}`,
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

/**
 * export_beats — render a stored beats artifact to a .wav (B8, the audio
 * sibling of export_model). Export-only: the recipe stays the source of truth;
 * the WAV is a deterministic derived render (same manifest + options → the
 * same bytes), regenerated on demand — never imported back.
 */
export async function exportBeatsHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('export_beats requires { ref }');
  }
  const { ref, format = 'wav', bars, loops, cue, tail, write = true } = input;
  if (!ref || typeof ref !== 'string') {
    throw new Error('`ref` is required (string)');
  }
  if (format !== 'wav' && format !== 'midi') {
    throw new Error("`format` must be 'wav' (audio render) or 'midi' (the score, for DAWs/notation) if provided");
  }
  if (typeof write !== 'boolean') {
    throw new Error('`write` must be a boolean if provided');
  }
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) {
    throw new Error(`No sketch exists at ref '${ref}'`);
  }
  if (!sketch.manifest || !isBeatsKind(sketch.manifest.kind)) {
    return {
      ok: false,
      eligible: false,
      ref,
      kind: sketch.manifest?.kind ?? null,
      reason:
        'Audio export covers beats artifacts only (manifest.kind beats-ambient | beats-composition | '
        + 'beats-pattern | beats-sfx, minted via create_beats). For 3D geometry use export_model.',
    };
  }

  // MIDI leg (the musician handoff): the score, deterministic, built on the
  // same pure plan the WAV replays — swing/feel/velocities travel.
  if (format === 'midi') {
    let rendered;
    try {
      rendered = renderBeatsMidi(sketch.manifest, { bars, loops });
    } catch (err) {
      return { ok: false, eligible: false, ref, kind: sketch.manifest.kind, reason: err.message };
    }
    const query = [];
    if (bars !== undefined) query.push(`bars=${bars}`);
    if (loops !== undefined) query.push(`loops=${loops}`);
    const result = {
      ok: true,
      ref,
      kind: sketch.manifest.kind,
      format: 'midi',
      url: `/api/beats/${encodeURIComponent(ref)}.mid${query.length ? `?${query.join('&')}` : ''}`,
      bytes: rendered.mid.length,
      ...rendered.meta,
    };
    if (write) {
      const dir = exportsBaseDir();
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${ref}.mid`);
      await fs.writeFile(file, rendered.mid);
      result.path = file;
    }
    return result;
  }

  const rendered = await renderBeatsOffline(sketch.manifest, { bars, loops, cue, tail });

  const query = [];
  if (bars !== undefined) query.push(`bars=${bars}`);
  if (loops !== undefined) query.push(`loops=${loops}`);
  if (rendered.meta.cue) query.push(`cue=${encodeURIComponent(rendered.meta.cue)}`);
  if (tail !== undefined) query.push(`tail=${tail}`);
  const url = `/api/sketches/${encodeURIComponent(ref)}/beats.wav${query.length ? `?${query.join('&')}` : ''}`;

  const result = {
    ok: true,
    ref,
    kind: sketch.manifest.kind,
    format: 'wav',
    url,
    bytes: rendered.wav.length,
    duration_s: Number(rendered.durationSeconds.toFixed(3)),
    sample_rate: rendered.sampleRate,
    ...rendered.meta,
  };
  if (write) {
    const dir = exportsBaseDir();
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${ref}${rendered.meta.cue ? `.${rendered.meta.cue}` : ''}.wav`);
    await fs.writeFile(file, rendered.wav);
    result.path = file;
  }
  return result;
}

// ── B9: the iteration loop — read, edit, annotate, diff ─────────────────────

const ANCHOR_SCOPES = new Set(['artifact', 'track', 'time', 'cue']);

// anchor union: { scope:'artifact' } | { scope:'track', track } |
// { scope:'time', bar, step?, track?, timeSec? } | { scope:'cue', cue }.
function validateAnchor(anchor) {
  if (anchor === undefined || anchor === null) return { scope: 'artifact' };
  if (typeof anchor !== 'object' || Array.isArray(anchor)) {
    throw new Error('`anchor` must be an object like { scope: "time", bar: 2, track: "kick" }');
  }
  if (!ANCHOR_SCOPES.has(anchor.scope)) {
    throw new Error(`anchor.scope must be one of: ${[...ANCHOR_SCOPES].join(', ')}`);
  }
  if (anchor.scope === 'track' && (typeof anchor.track !== 'string' || !anchor.track)) {
    throw new Error("a 'track' anchor needs track: '<channel/part/track name>'");
  }
  if (anchor.scope === 'cue' && (typeof anchor.cue !== 'string' || !anchor.cue)) {
    throw new Error("a 'cue' anchor needs cue: '<cueId>'");
  }
  if (anchor.scope === 'time') {
    if (!Number.isInteger(anchor.bar) || anchor.bar < 1) {
      throw new Error("a 'time' anchor needs bar: a 1-based integer (seeded performances make bar N reproducible)");
    }
    if (anchor.step !== undefined && (!Number.isInteger(anchor.step) || anchor.step < 0)) {
      throw new Error('anchor.step must be a 0-based sixteenth index within the bar');
    }
    if (anchor.track !== undefined && (typeof anchor.track !== 'string' || !anchor.track)) {
      throw new Error('anchor.track must be a row name (string)');
    }
    if (anchor.timeSec !== undefined && !Number.isFinite(anchor.timeSec)) {
      throw new Error('anchor.timeSec must be a number (seconds)');
    }
  }
  const out = { scope: anchor.scope };
  for (const k of ['track', 'cue', 'bar', 'step', 'timeSec']) {
    if (anchor[k] !== undefined) out[k] = anchor[k];
  }
  return out;
}

function headRev(ref) {
  const list = BeatsRevisionRepository.list(ref);
  return list.length ? list[0].rev : 0;
}

export async function getBeatsHandler(input) {
  const { ref, rev } = input && typeof input === 'object' ? input : {};
  const sketch = requireBeatsSketch(ref);
  let manifest = sketch.manifest;
  let atRev = headRev(ref) || null;
  if (rev !== undefined) {
    if (!Number.isInteger(rev) || rev < 1) throw new Error('`rev` must be a positive integer');
    const revision = BeatsRevisionRepository.get(ref, rev);
    if (!revision) {
      const revs = BeatsRevisionRepository.list(ref).map((r) => r.rev);
      throw new Error(`No revision ${rev} for '${ref}'${revs.length ? ` (revisions: ${revs.join(', ')})` : ' (this artifact predates revision tracking — its first update_beats will backfill rev 1)'}`);
    }
    manifest = revision.manifest;
    atRev = rev;
  }
  return {
    ok: true,
    ref,
    kind: manifest.kind,
    title: sketch.title,
    rev: atRev,
    manifest,
    revisions: BeatsRevisionRepository.list(ref),
    annotations: BeatsAnnotationRepository.list(ref),
    url: `/beats/${encodeURIComponent(ref)}`,
    playerUrl: `/api/beats/${encodeURIComponent(ref)}${atRev ? `?rev=${atRev}` : ''}`,
  };
}

export async function updateBeatsHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('update_beats requires { ref, manifest?, title?, folder_ref?, note?, resolveAnnotations? }');
  }
  const { ref, manifest, title, folder_ref: folderRef, note, resolveAnnotations } = input;
  const sketch = requireBeatsSketch(ref);
  if (manifest === undefined && title === undefined && folderRef === undefined && !Array.isArray(resolveAnnotations)) {
    throw new Error('At least one of `manifest`, `title`, `folder_ref`, or `resolveAnnotations` must be provided');
  }
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw new Error('`title` must be a non-empty string if provided');
  }
  if (note !== undefined && typeof note !== 'string') {
    throw new Error('`note` must be a string (the revision message) if provided');
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) throw new Error('`folder_ref` must be a non-empty string or null if provided');
    if (!SketchFolderRepository.getByRef(folderRef)) throw new Error(`Folder '${folderRef}' not found`);
  }
  if (resolveAnnotations !== undefined && (!Array.isArray(resolveAnnotations) || !resolveAnnotations.every((id) => Number.isInteger(id)))) {
    throw new Error('`resolveAnnotations` must be an array of annotation ids (integers) if provided');
  }

  let finalized;
  if (manifest !== undefined) {
    // full-manifest replace, through the same gate as create (no patch-op
    // language: read with get_beats, edit the JSON, write — grids are legible).
    const next = { ...manifest, title: title ?? manifest.title ?? sketch.title };
    if (next.kind === undefined) next.kind = sketch.manifest.kind;
    const { ok, errors } = validateBeatsManifest(next);
    if (!ok) {
      throw new Error(`Invalid ${next.kind} recipe:\n - ${errors.join('\n - ')} — parameter manual: get_beats_vocab({ id: '${next.kind}' }).`);
    }
    finalized = normalizeBeatsManifest(next);
  }

  let rev = headRev(ref);
  if (finalized !== undefined) {
    // pre-B9 artifacts have no rev 1 — backfill the current head as history
    // before appending, so the first edit still yields a comparable pair.
    if (rev === 0) {
      BeatsRevisionRepository.append({ ref, manifest: sketch.manifest, note: 'pre-revision head (backfilled)' });
    }
    const written = BeatsRevisionRepository.append({ ref, manifest: finalized, note: note || null });
    rev = written.rev;
  }

  SketchRepository.update({
    ref,
    title: title !== undefined ? title.trim() : (finalized ? finalized.title : undefined),
    manifest: finalized,
    folderRef,
  });

  let resolved = 0;
  if (Array.isArray(resolveAnnotations) && resolveAnnotations.length) {
    resolved = BeatsAnnotationRepository.resolve({ ref, ids: resolveAnnotations, resolvedRev: rev || null });
  }

  return {
    ok: true,
    ref,
    rev: rev || null,
    resolvedAnnotations: resolved,
    url: `/beats/${encodeURIComponent(ref)}`,
    playerUrl: `/api/beats/${encodeURIComponent(ref)}`,
  };
}

export async function annotateBeatsHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('annotate_beats requires { ref, action: add | resolve | list, ... }');
  }
  const { ref, action = 'list', anchor, body, ids } = input;
  requireBeatsSketch(ref);
  if (action === 'add') {
    if (typeof body !== 'string' || !body.trim()) throw new Error('`body` is required for add (markdown)');
    const row = BeatsAnnotationRepository.add({
      ref,
      rev: headRev(ref) || 1,
      anchor: validateAnchor(anchor),
      body: body.trim(),
      author: input.author === 'operator' ? 'operator' : 'agent',
    });
    return { ok: true, ref, annotation: row };
  }
  if (action === 'resolve') {
    if (!Array.isArray(ids) || !ids.length || !ids.every((id) => Number.isInteger(id))) {
      throw new Error('`ids` is required for resolve (array of annotation ids)');
    }
    const resolved = BeatsAnnotationRepository.resolve({ ref, ids, resolvedRev: headRev(ref) || null });
    return { ok: true, ref, resolved };
  }
  if (action === 'list') {
    return { ok: true, ref, annotations: BeatsAnnotationRepository.list(ref) };
  }
  throw new Error(`annotate_beats: unknown action '${action}' (add | resolve | list)`);
}

// 'ref' or 'ref@rev' → { ref, rev|null }.
function parseRefRev(spec, name) {
  if (!spec || typeof spec !== 'string') throw new Error(`\`${name}\` is required (a beats ref, optionally 'ref@rev')`);
  const m = /^(.*)@(\d+)$/.exec(spec);
  if (!m) return { ref: spec, rev: null };
  return { ref: m[1], rev: Number(m[2]) };
}

function manifestAt({ ref, rev }, name) {
  const sketch = requireBeatsSketch(ref);
  if (rev === null) return { manifest: sketch.manifest, rev: headRev(ref) || null };
  const revision = BeatsRevisionRepository.get(ref, rev);
  if (!revision) {
    const revs = BeatsRevisionRepository.list(ref).map((r) => r.rev);
    throw new Error(`${name}: no revision ${rev} for '${ref}'${revs.length ? ` (revisions: ${revs.join(', ')})` : ''}`);
  }
  return { manifest: revision.manifest, rev };
}

export async function diffBeatsHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error("diff_beats requires { refA, refB } (each a beats ref, optionally 'ref@rev')");
  }
  const specA = parseRefRev(input.refA, 'refA');
  const specB = parseRefRev(input.refB, 'refB');
  if (specA.ref === specB.ref && specA.rev === specB.rev) {
    throw new Error('refA and refB resolve to the same manifest — diff two refs, or the same ref at different revisions (ref@2 vs ref@3)');
  }
  const a = manifestAt(specA, 'refA');
  const b = manifestAt(specB, 'refB');
  const report = diffBeatsManifests(a.manifest, b.manifest);
  return {
    ok: true,
    refA: specA.ref,
    revA: a.rev,
    refB: specB.ref,
    revB: b.rev,
    same: report.same,
    summary: report.summary,
    report,
  };
}

export function registerBeatsTools() {
  registerTool({
    name: 'create_beats',
    description:
      'Mint a MUSICAL artifact — synthesized WebAudio from a tiny deterministic recipe, played at its '
      + '/beats/<ref> studio (no media bytes stored; every sound is computed at play time). One tool, four '
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

  registerTool({
    name: 'get_beats',
    description:
      'Read a beats artifact back as its full recipe — the read half of the revise loop (B9). Returns '
      + 'the manifest (head, or a specific `rev`), the revision index [{ rev, note, created_at }], and '
      + 'its annotations (open first) so an edit can answer the marks. Reach for "show me the tune\'s '
      + 'recipe", "what did the operator flag", or before ANY update_beats — read, edit the JSON, write. '
      + 'Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Beats sketch ref.' },
        rev: { type: 'integer', minimum: 1, description: 'Optional revision to read (default: head).' },
      },
      required: ['ref'],
    },
    handler: getBeatsHandler,
  });

  registerTool({
    name: 'update_beats',
    description:
      'Revise a beats artifact — the edit half of the loop (B9). Full-manifest replace through the same '
      + 'musical validation as create_beats (teaching errors); every manifest change snapshots a revision '
      + 'with `note` as its message, and old revisions stay playable (?rev= on the player and .wav). Pass '
      + '`resolveAnnotations: [ids]` to close the marks this edit answers. Grids make edits legible: '
      + '"mute bar 2\'s kick" is a mask edit, not tuple surgery. Read first with get_beats. Reach for '
      + '"edit/revise/tweak/fix the tune", "mute that track", "swap the progression".',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Beats sketch ref to revise.' },
        manifest: { type: 'object', description: 'The full replacement recipe (kind defaults to the current one; validated + normalized like create).' },
        title: { type: 'string', description: 'Optional new title.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to move under.' },
        note: { type: 'string', description: "The revision message — what changed and why (e.g. 'muted bar 2 kick per note #3')." },
        resolveAnnotations: { type: 'array', items: { type: 'integer' }, description: 'Annotation ids this revision resolves.' },
      },
      required: ['ref'],
    },
    handler: updateBeatsHandler,
  });

  registerTool({
    name: 'annotate_beats',
    description:
      'Mark a beats artifact in musical terms (B9.1) — the ONLY write surface for marks (the /beats/<ref> '
      + 'studio and player render them read-only). action=add attaches commentary at an anchor '
      + '({ scope: "artifact" } | { scope: "track", track } | { scope: "time", bar, step?, track? } | '
      + '{ scope: "cue", cue }; seeded performances make bar N reproducible even for generative kinds); '
      + "pass author:'operator' when relaying the user's own note. action=resolve closes marks by id "
      + '(update_beats resolveAnnotations does this atomically with the fixing edit); action=list reads '
      + 'them, open first. Reach for "note that the drop feels early", "flag bar 3", "list the open notes".',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Beats sketch ref.' },
        action: { type: 'string', enum: ['add', 'resolve', 'list'], description: 'What to do (default list).' },
        anchor: { type: 'object', description: 'add: where the mark lives (default { scope: "artifact" }).' },
        body: { type: 'string', description: 'add: the note (markdown).' },
        author: { type: 'string', enum: ['agent', 'operator'], description: 'add: who is speaking (default agent).' },
        ids: { type: 'array', items: { type: 'integer' }, description: 'resolve: annotation ids to close.' },
      },
      required: ['ref'],
    },
    handler: annotateBeatsHandler,
  });

  registerTool({
    name: 'diff_beats',
    description:
      'Structured MUSICAL diff between two beats manifests (B9.3) — a report, not a picture: tempo/swing/'
      + 'key deltas, tracks added/removed, per-track patch/macro changes, pattern grids compared cell-wise '
      + '("kick: bar 2 steps 12, 14 removed"), progression and cue changes. Each side is a ref or '
      + "'ref@rev', so it also answers \"what changed between revision 3 and 4\". For SVG/diagram kinds "
      + 'use diff_sketches instead. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        refA: { type: 'string', description: "Left side: a beats ref, optionally 'ref@rev'." },
        refB: { type: 'string', description: "Right side: a beats ref, optionally 'ref@rev'." },
      },
      required: ['refA', 'refB'],
    },
    handler: diffBeatsHandler,
  });

  registerTool({
    name: 'export_beats',
    description:
      'Render a stored beats artifact to a file — the audio sibling of export_model. Two formats, both '
      + 'export-only and deterministic (the recipe stays the source of truth; same manifest + options → '
      + "the same bytes): `format:'wav'` (default) re-synthesizes the AUDIO through the same kernel the "
      + "player uses; `format:'midi'` writes the SCORE as a Standard MIDI File — the musician handoff, "
      + 'openable in any DAW or notation tool (MuseScore renders it as sheet music). MIDI carries tempo, '
      + 'every note with swing/feel/velocity baked in, track names, GM program guesses, and drum hits on '
      + 'channel 10 — but not synthesis timbre (pair it with the .wav); beats-sfx is wav-only (foley '
      + 'choreography, not a score). Duration per kind: composition = its own score length; ambient = '
      + '`bars` (default one progression cycle); pattern = `loops` (default 2); sfx = one `cue` per call. '
      + '`tail` seconds of ring-out append to wav (default 2). Returns url + bytes plus an on-disk `path` '
      + 'when `write` (default true); the url regenerates per request. Reach for "export this beat", '
      + '"give me the audio file", "export the MIDI / sheet music / bring it into my DAW".',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Existing beats sketch ref to render.' },
        format: { type: 'string', enum: ['wav', 'midi'], default: 'wav', description: "'wav' = the audio render; 'midi' = the score (SMF) for DAWs / notation tools." },
        bars: { type: 'integer', minimum: 1, description: 'beats-ambient only: bars to render (default: one progression cycle).' },
        loops: { type: 'integer', minimum: 1, description: 'beats-pattern only: pattern repetitions (default 2).' },
        cue: { type: 'string', description: 'beats-sfx only: which cue to render (default: the only cue).' },
        tail: { type: 'number', minimum: 0, maximum: 30, description: 'Seconds of reverb/ring-out appended after the last event (default 2).' },
        write: {
          type: 'boolean',
          default: true,
          description:
            'When true (default), write the .wav to disk (under control/data/exports, or $MOJULO_EXPORTS_DIR) '
            + 'and return its `path`. Set false to render metadata + the download URL without touching disk.',
        },
      },
      required: ['ref'],
    },
    handler: exportBeatsHandler,
  });
}
