// Isolate to an in-memory SQLite — must run before any import that pulls in
// db/index.js. Same pattern as create-view.test.js / create-game.test.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { BeatsRevisionRepository, BeatsAnnotationRepository } from '@/lib/db/repositories/beats';
import {
  mintBeats,
  getBeatsHandler,
  updateBeatsHandler,
  annotateBeatsHandler,
  diffBeatsHandler,
} from './beats.js';
import { updateSketchHandler, diffSketchesHandler } from './sketches.js';
import { diffBeatsManifests } from '@/lib/graph/beats/beats-diff';

beforeEach(() => {
  closeDb();
});

// the B9.0 exit fixture: a pattern whose bar-2 kick can be muted in one edit.
const KICK_MASK = Array.from({ length: 32 }, (_, i) => (i % 4 === 0 ? 1 : 0));
const PATTERN = {
  kind: 'beats-pattern',
  bpm: 132,
  swing: 0.1,
  tracks: [
    { name: 'kick', patch: 'kick', mask: KICK_MASK },
    { name: 'stab', patch: 'sawStab', mask: [0, 0, 1, 0], notes: [['A3', 'C4', 'E4']] },
  ],
};

function mintPattern(ref = 'groove') {
  return mintBeats({ kind: 'beats-pattern', title: 'Groove', params: PATTERN, ref });
}

describe('B9.0 — read + edit', () => {
  it('create_beats writes revision 1 and routes to the studio URL', () => {
    const out = mintPattern();
    expect(out.url).toBe('/beats/groove');
    expect(out.playerUrl).toBe('/api/beats/groove');
    const revs = BeatsRevisionRepository.list('groove');
    expect(revs).toHaveLength(1);
    expect(revs[0].note).toBe('minted');
  });

  it('get_beats returns the recipe, revision index, and annotations', async () => {
    mintPattern();
    const out = await getBeatsHandler({ ref: 'groove' });
    expect(out.kind).toBe('beats-pattern');
    expect(out.rev).toBe(1);
    expect(out.manifest.tracks[0].mask).toHaveLength(32);   // normalized grid
    expect(out.revisions).toHaveLength(1);
    expect(out.annotations).toEqual([]);
    await expect(getBeatsHandler({ ref: 'groove', rev: 9 })).rejects.toThrow(/No revision 9/);
    await expect(getBeatsHandler({ ref: 'nope' })).rejects.toThrow(/No sketch exists/);
  });

  it("update_beats: 'mute bar 2's kick' is one legible edit → rev 2, both revisions readable", async () => {
    mintPattern();
    const head = (await getBeatsHandler({ ref: 'groove' })).manifest;
    const muted = JSON.parse(JSON.stringify(head));
    muted.tracks[0].mask = muted.tracks[0].mask.map((v, i) => (i >= 16 ? 0 : v));
    const out = await updateBeatsHandler({ ref: 'groove', manifest: muted, note: "mute bar 2's kick" });
    expect(out.rev).toBe(2);
    // head row = the new manifest; rev 1 still the original.
    const now = await getBeatsHandler({ ref: 'groove' });
    expect(now.manifest.tracks[0].mask.slice(16).every((v) => v === 0)).toBe(true);
    const was = await getBeatsHandler({ ref: 'groove', rev: 1 });
    expect(was.manifest.tracks[0].mask[16]).toBe(1);
    expect(now.revisions.map((r) => r.rev)).toEqual([2, 1]);
    expect(now.revisions[0].note).toBe("mute bar 2's kick");
  });

  it('update_beats validates through the create gate and teaches', async () => {
    mintPattern();
    await expect(
      updateBeatsHandler({ ref: 'groove', manifest: { ...PATTERN, bpm: 9000 } }),
    ).rejects.toThrow(/bpm must be a number in \[20, 300\].*get_beats_vocab/s);
    // nothing appended on a failed edit.
    expect(BeatsRevisionRepository.list('groove')).toHaveLength(1);
  });

  it('pre-B9 artifacts (no revision rows) get their head backfilled on first edit', async () => {
    // simulate an old mint: a sketches row with no beats_revisions.
    SketchRepository.create({ ref: 'oldie', title: 'Oldie', manifest: { ...PATTERN, title: 'Oldie', steps: 32 } });
    await updateBeatsHandler({ ref: 'oldie', manifest: { ...PATTERN, swing: 0.2 }, note: 'more swing' });
    const revs = BeatsRevisionRepository.list('oldie');
    expect(revs.map((r) => r.rev)).toEqual([2, 1]);
    expect(revs[1].note).toMatch(/backfilled/);
  });

  it('update_sketch / diff_sketches refuse beats refs and point at the domain tools', async () => {
    mintPattern();
    mintBeats({ kind: 'beats-pattern', title: 'Other', params: PATTERN, ref: 'other' });
    await expect(updateSketchHandler({ ref: 'groove', title: 'Renamed' })).rejects.toThrow(/update_beats/);
    await expect(diffSketchesHandler({ left_ref: 'groove', right_ref: 'other' })).rejects.toThrow(/diff_beats/);
  });
});

describe('B9.1 — annotations', () => {
  it('add / list / resolve round-trips; update_beats resolves atomically with the fix', async () => {
    mintPattern();
    const added = await annotateBeatsHandler({
      ref: 'groove',
      action: 'add',
      anchor: { scope: 'time', bar: 2, step: 0, track: 'kick' },
      body: 'bar 2 kick feels wrong',
    });
    expect(added.annotation.status).toBe('open');
    expect(added.annotation.author).toBe('agent');
    expect(added.annotation.rev).toBe(1);

    const listed = await annotateBeatsHandler({ ref: 'groove', action: 'list' });
    expect(listed.annotations).toHaveLength(1);

    const head = (await getBeatsHandler({ ref: 'groove' })).manifest;
    const muted = JSON.parse(JSON.stringify(head));
    muted.tracks[0].mask = muted.tracks[0].mask.map((v, i) => (i >= 16 ? 0 : v));
    const out = await updateBeatsHandler({
      ref: 'groove',
      manifest: muted,
      note: 'answer the kick note',
      resolveAnnotations: [added.annotation.id],
    });
    expect(out.resolvedAnnotations).toBe(1);
    const after = await annotateBeatsHandler({ ref: 'groove', action: 'list' });
    expect(after.annotations[0].status).toBe('resolved');
    expect(after.annotations[0].resolvedRev).toBe(2);
  });

  it('anchors validate as the union', async () => {
    mintPattern();
    await expect(annotateBeatsHandler({ ref: 'groove', action: 'add', body: 'x', anchor: { scope: 'nowhere' } }))
      .rejects.toThrow(/anchor.scope must be one of/);
    await expect(annotateBeatsHandler({ ref: 'groove', action: 'add', body: 'x', anchor: { scope: 'time' } }))
      .rejects.toThrow(/needs bar/);
    await expect(annotateBeatsHandler({ ref: 'groove', action: 'add', body: 'x', anchor: { scope: 'track' } }))
      .rejects.toThrow(/needs track/);
  });
});

describe('B9.3 — the musical diff', () => {
  it('diffing the B9.0 exit revisions reports exactly the kick-mask change and nothing else', async () => {
    mintPattern();
    const head = (await getBeatsHandler({ ref: 'groove' })).manifest;
    const muted = JSON.parse(JSON.stringify(head));
    muted.tracks[0].mask = muted.tracks[0].mask.map((v, i) => (i >= 16 ? 0 : v));
    await updateBeatsHandler({ ref: 'groove', manifest: muted, note: 'mute bar 2 kick' });

    const out = await diffBeatsHandler({ refA: 'groove@1', refB: 'groove@2' });
    expect(out.same).toBe(false);
    expect(out.summary).toEqual(['kick: bar 2 steps 0, 4, 8, 12 removed']);
    expect(out.report.rows.changed.kick.mask.removed).toEqual([16, 20, 24, 28]);
    expect(out.report.rows.added).toEqual([]);
    expect(out.report.rows.removed).toEqual([]);
  });

  it('refuses a self-diff, resolves head vs rev, and reports header/track deltas', async () => {
    mintPattern();
    await expect(diffBeatsHandler({ refA: 'groove', refB: 'groove' })).rejects.toThrow(/same manifest/);

    const head = (await getBeatsHandler({ ref: 'groove' })).manifest;
    const next = JSON.parse(JSON.stringify(head));
    next.bpm = 128;
    next.tracks[1].tone = 0.4;   // darken the stab (B5.2 macro round-trips)
    next.tracks.push({ name: 'hat', patch: 'hat', mask: Array.from({ length: 32 }, (_, i) => (i % 2 ? 0.5 : 0)), level: -4 });
    await updateBeatsHandler({ ref: 'groove', manifest: next, note: 'faster, darker, hats' });

    const out = await diffBeatsHandler({ refA: 'groove@1', refB: 'groove' });
    expect(out.revB).toBe(2);
    expect(out.summary).toContain('bpm: 132 → 128');
    expect(out.summary).toContain('stab: tone null → 0.4');
    expect(out.summary.some((l) => l.includes("track 'hat' added"))).toBe(true);
  });

  it('diffBeatsManifests is pure and reports no differences for identical manifests', () => {
    const report = diffBeatsManifests(PATTERN, PATTERN);
    expect(report.same).toBe(true);
    expect(report.summary).toEqual(['no musical differences']);
  });
});

describe('export_beats format: midi', () => {
  it('renders a deterministic SMF url + bytes (write:false leaves disk alone)', async () => {
    mintPattern();
    const { exportBeatsHandler } = await import('./beats.js');
    const out = await exportBeatsHandler({ ref: 'groove', format: 'midi', loops: 1, write: false });
    expect(out.ok).toBe(true);
    expect(out.format).toBe('midi');
    expect(out.url).toBe('/api/beats/groove.mid?loops=1');
    expect(out.bytes).toBeGreaterThan(50);
    expect(out.tracks).toBe(2);
    expect(out.path).toBeUndefined();
  });

  it('teaches on sfx (wav-only) and rejects unknown formats', async () => {
    const { exportBeatsHandler } = await import('./beats.js');
    mintBeats({ kind: 'beats-sfx', title: 'Foley', params: { cues: { ding: [{ type: 'sweep', from: 'C6', to: 'E6' }] } }, ref: 'foley' });
    const out = await exportBeatsHandler({ ref: 'foley', format: 'midi', write: false });
    expect(out.ok).toBe(false);
    expect(out.reason).toMatch(/wav instead/);
    await expect(exportBeatsHandler({ ref: 'foley', format: 'ogg' })).rejects.toThrow(/must be 'wav'/);
  });
});
