process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/world for a terrain world that follows its source. Claims under test: a repeat load is a
 * server cache HIT and a browser 304; after the promoted painting is edited, the terrain world's key moves with it,
 * so the next load is baked afresh (MISS) under a new ETag, and the old ETag no longer answers 304.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET } from './route.js';

const PAINTING = { kind: 'painted-landscape', heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'rt', landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 3, side: 'right' }] };

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'sk_painting', title: 'ridge', manifest: PAINTING });
  SketchRepository.create({ ref: 'sk_world', title: 'ridge world', manifest: { kind: 'terrain', from: { ref: 'sk_painting' } } });
});

const world = (ref, headers) => GET(new NextRequest(`http://localhost/api/sketches/${ref}/world`, { headers }), { params: Promise.resolve({ ref }) });

describe('GET /world: a terrain world follows its source past the caches', () => {
  it('a repeat is a HIT and a 304; an edit to the painting bakes afresh under a new ETag', async () => {
    const first = await world('sk_world'); expect(first.status).toBe(200);
    const etag = first.headers.get('etag'); expect(etag).toBeTruthy();
    expect((await world('sk_world')).headers.get('x-mojulo-world-cache')).toBe('HIT');
    expect((await world('sk_world', { 'if-none-match': etag })).status).toBe(304);
    SketchRepository.update({ ref: 'sk_painting', manifest: { ...PAINTING, landform: [{ ...PAINTING.landform[0], throw: 6 }] } });
    const after = await world('sk_world');
    expect(after.headers.get('x-mojulo-world-cache')).toBe('MISS'); expect(after.headers.get('etag')).not.toBe(etag);
    expect((await world('sk_world', { 'if-none-match': etag })).status).toBe(200);
  }, 120_000);
});
