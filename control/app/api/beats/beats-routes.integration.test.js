// End-to-end over the B9 HTTP namespace: mint → player (?rev=, grid, META) →
// annotate (POST) → meta → diff — the studio's whole data loop through the
// real route handlers against an in-memory SQLite.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { mintBeats, updateBeatsHandler, getBeatsHandler, annotateBeatsHandler } from '@/lib/mcp/tools/beats';
import { GET as playerGet } from './[ref]/route.js';
import * as annotationsRoute from './[ref]/annotations/route.js';
import { GET as metaGet } from './[ref]/meta/route.js';
import { GET as diffGet } from './[ref]/diff/route.js';

beforeEach(() => {
  closeDb();
});

const PATTERN = {
  kind: 'beats-pattern',
  bpm: 132,
  tracks: [{ name: 'kick', patch: 'kick', mask: [1, 0, 0, 0] }],
};

const req = (url) => ({ url: `http://localhost:3001${url}` });
const ctx = (ref) => ({ params: Promise.resolve({ ref }) });

describe('/api/beats/[ref] namespace (B9)', () => {
  it('player serves head and ?rev=, with grid + META riding the page', async () => {
    mintBeats({ kind: 'beats-pattern', title: 'Groove', params: PATTERN, ref: 'groove' });
    const head = (await getBeatsHandler({ ref: 'groove' })).manifest;
    const next = { ...head, bpm: 120 };
    await updateBeatsHandler({ ref: 'groove', manifest: next, note: 'slower' });

    const live = await (await playerGet(req('/api/beats/groove'), ctx('groove'))).text();
    expect(live).toContain('id="grid"');                          // B9.2 grid
    expect(live).toContain('"ref":"groove"');                     // META for annotate-here
    expect(live).toContain('120 BPM');
    const old = await (await playerGet(req('/api/beats/groove?rev=1'), ctx('groove'))).text();
    expect(old).toContain('132 BPM');
    expect(old).toContain('rev 1');

    const missing = await playerGet(req('/api/beats/groove?rev=7'), ctx('groove'));
    expect(missing.status).toBe(404);
  });

  it('<ref>.mid serves the score as an SMF, rev-aware', async () => {
    mintBeats({ kind: 'beats-pattern', title: 'Groove', params: PATTERN, ref: 'groove' });
    const res = await playerGet(req('/api/beats/groove.mid?loops=1'), ctx('groove.mid'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/midi');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe('MThd');
    const missing = await playerGet(req('/api/beats/groove.mid?rev=9'), ctx('groove.mid'));
    expect(missing.status).toBe(404);
  });

  it('MCP-written annotations flow to player markers + meta; diff answers "what changed"', async () => {
    mintBeats({ kind: 'beats-pattern', title: 'Groove', params: PATTERN, ref: 'groove' });
    // writes stay on the MCP: annotate_beats is the only write surface —
    // the HTTP route is read-only by design.
    expect(annotationsRoute.POST).toBeUndefined();
    await annotateBeatsHandler({
      ref: 'groove',
      action: 'add',
      anchor: { scope: 'time', bar: 1, step: 0, track: 'kick' },
      body: 'kick too loud',
      author: 'operator',
    });
    const listed = await (await annotationsRoute.GET(req('/api/beats/groove/annotations'), ctx('groove'))).json();
    expect(listed.annotations).toHaveLength(1);
    expect(listed.annotations[0].author).toBe('operator');

    // the open mark lands on the grid as a marker.
    const live = await (await playerGet(req('/api/beats/groove'), ctx('groove'))).text();
    expect(live).toContain('cell on mark');

    const head = (await getBeatsHandler({ ref: 'groove' })).manifest;
    await updateBeatsHandler({ ref: 'groove', manifest: { ...head, swing: 0.2 }, note: 'swung' });
    const meta = await (await metaGet(req('/api/beats/groove/meta'), ctx('groove'))).json();
    expect(meta.headRev).toBe(2);
    expect(meta.revisions).toHaveLength(2);
    expect(meta.annotations).toHaveLength(1);

    const diff = await (await diffGet(req('/api/beats/groove/diff?a=1&b=2'), ctx('groove'))).json();
    expect(diff.summary).toEqual(['swing: 0 → 0.2']);
  });
});
