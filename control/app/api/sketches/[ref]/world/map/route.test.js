process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET } from './route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'sk_road', title: '401 by Pearson', manifest: { kind: 'roadway', length: 1500 } });
  SketchRepository.create({ ref: 'sk_city', title: 'City', manifest: { kind: 'fractal-city', seed: 2 } });
});

const map = (ref, headers) => GET(new NextRequest(`http://localhost/api/sketches/${ref}/world/map`, { headers }), { params: Promise.resolve({ ref }) });

describe('GET /api/sketches/[ref]/world/map', () => {
  it('serves the roadway map with an ETag, and a 304 when the browser holds it', async () => {
    const res = await map('sk_road');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('401 by Pearson');
    expect(html).toContain('/api/sketches/sk_road/world?view=driver');
    const etag = res.headers.get('etag');
    expect((await map('sk_road', { 'if-none-match': etag })).status).toBe(304);
  }, 60000);
  it('404s a missing sketch and any kind but roadway', async () => {
    expect((await map('sk_missing')).status).toBe(404);
    expect((await map('sk_city')).status).toBe(404);
  });
});
