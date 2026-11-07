process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/world and the loader: a world opened in a tab and not yet baked is answered at once with a page
 * that says so; a frame, a script, a download and a bake already held are answered as ever.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET } from './route.js';

const STAGE = { kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 6, d: 6, h: 4 }] };
const LOADER = 'LOADER';
const open = (ref, q = '', dest = 'document') => GET(new NextRequest(`http://localhost/api/sketches/${ref}/world${q}`, { headers: dest ? { 'sec-fetch-dest': dest } : {} }), { params: Promise.resolve({ ref }) });
const state = (r) => r.headers.get('X-Mojulo-World-Cache');

let n = 0;
const fresh = () => { const ref = `hall-${++n}`; SketchRepository.create({ ref, title: 'a <hall>', manifest: { ...STAGE, seed: 1000 + n } }); return ref; };

beforeEach(() => { closeDb(); getDb(); });

describe('GET /world: the loader', () => {
  it('answers a tab at once with the loader, its title escaped, never held by a browser', async () => {
    const r = await open(fresh());
    expect(state(r)).toBe(LOADER);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    const html = await r.text();
    expect(html).toContain('a &lt;hall&gt;');
    expect(html).toContain("searchParams.set('built', '1')");
    expect(() => new Function(/<script>([\s\S]*)<\/script>/.exec(html)[1])).not.toThrow();
  });

  it('answers a frame, a script, a download and a bake asked for with the world itself', async () => {
    for (const [q, dest] of [['', 'iframe'], ['', null], ['?download=1', 'document'], ['?built=1', 'document'], ['?nocache=1', 'document']]) {
      const r = await open(fresh(), q, dest);
      expect(state(r), `${q} ${dest}`).not.toBe(LOADER);
      expect(await r.text()).toContain('<canvas');
    }
  });

  it('opens the bake it asked for: a tab comes back to a bake already held, under the one key', async () => {
    const ref = fresh();
    expect(state(await open(ref))).toBe(LOADER);
    expect(state(await open(ref, '?built=1'))).toBe('MISS');
    const back = await open(ref);
    expect(state(back)).toBe('HIT');
  });
});
