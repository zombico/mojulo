process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { unpackTile } from '@/lib/graph/city/city-tiles';
import { GET as getTile } from './route.js';
import { GET as getWorld } from '../route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'sk_city', title: 'City', manifest: { kind: 'fractal-city', seed: 2 } });
  SketchRepository.create({ ref: 'sk_night', title: 'Night', manifest: { kind: 'fractal-city', seed: 2, time: 'night' } });
  SketchRepository.create({ ref: 'sk_flow', title: 'Flow', manifest: { nodes: [], edges: [], viewBox: { width: 10, height: 10 } } });
});

const tile = (ref, q, headers) => getTile(new NextRequest(`http://localhost/api/sketches/${ref}/world/tile${q}`, { headers }), { params: Promise.resolve({ ref }) });
const world = (ref, q) => getWorld(new NextRequest(`http://localhost/api/sketches/${ref}/world${q}`), { params: Promise.resolve({ ref }) });

describe('GET /api/sketches/[ref]/world/tile', () => {
  it('serves a packed tile with an ETag, and a 304 when the browser holds it', async () => {
    const res = await tile('sk_city', '?t=0,0&lod=full');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    const etag = res.headers.get('etag');
    expect(etag).toMatch(/^"t-[0-9a-f]{32}"$/);
    const { header } = unpackTile(Buffer.from(await res.arrayBuffer()));
    expect(header).toMatchObject({ t: '0,0', lod: 'full' });
    const again = await tile('sk_city', '?t=0,0&lod=full', { 'if-none-match': etag });
    expect(again.status).toBe(304);
    const other = await tile('sk_city', '?t=0,0&lod=massing');
    expect(other.headers.get('etag')).not.toBe(etag);
  });

  it('refuses the wrong kind, a lit city, a bad lod and an off-grid tile', async () => {
    expect((await tile('sk_flow', '?t=0,0')).status).toBe(404);
    expect((await tile('sk_missing', '?t=0,0')).status).toBe(404);
    expect((await tile('sk_night', '?t=0,0')).status).toBe(404);
    expect((await tile('sk_city', '?t=0,0&lod=ultra')).status).toBe(400);
    expect((await tile('sk_city', '?t=99,0')).status).toBe(400);
    expect((await tile('sk_city', '?t=a,b')).status).toBe(400);
  });
});

describe('GET /api/sketches/[ref]/world?stream=1', () => {
  it('serves the horizon page for a plain city and says so', async () => {
    const res = await world('sk_city', '?stream=1');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-mojulo-world-stream')).toBe('on');
    const html = await res.text();
    expect(html).toContain('window.__mojStream');
    expect(html).toContain('/api/sketches/sk_city/world/tile');
  });

  it('stands down to the whole page under lit modes and names the reason', async () => {
    const res = await world('sk_night', '?stream=1');
    if (res.status !== 200) throw new Error(JSON.stringify(await res.json()));
    expect(res.headers.get('x-mojulo-world-stream')).toMatch(/^stood-down: .*time: night/);
    expect(await res.text()).not.toContain('__mojStream');
  });

  it('leaves a page without the flag untouched (no stream header, no block)', async () => {
    const res = await world('sk_city', '');
    expect(res.headers.get('x-mojulo-world-stream')).toBeNull();
    expect(await res.text()).not.toContain('__mojStream');
  });
});
