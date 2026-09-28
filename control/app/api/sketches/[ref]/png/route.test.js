import { describe, it, expect, vi, beforeEach } from 'vitest';

// The route's only download door is withChromiumFetch; these tests check who gets to open it.
const calls = vi.hoisted(() => ({ withFetch: 0, render: [] }));

vi.mock('@/lib/db/repositories/sketches', () => ({
  SketchRepository: { getByRef: (ref) => ({ ref, title: 'Castle', manifest: { kind: 'city' } }) },
}));
vi.mock('@/lib/graph/sketch/sketch-png', () => ({
  rasterizeSketchToPng: async (_sketch, opts) => {
    calls.render.push(opts);
    return Buffer.from('png');
  },
}));
vi.mock('@/lib/graph/scene/chromium-consent', () => ({
  withChromiumFetch: async (fn) => {
    calls.withFetch += 1;
    return { value: await fn(), fetched: null };
  },
}));

const { GET, isExplicitRequest } = await import('./route.js');

function get(query = '', headers = {}) {
  const request = new Request(`http://127.0.0.1:3001/api/sketches/castle/png${query}`, { headers });
  return GET(request, { params: Promise.resolve({ ref: 'castle' }) });
}

beforeEach(() => {
  calls.withFetch = 0;
  calls.render = [];
});

describe('GET /api/sketches/[ref]/png — Chrome for Testing consent', () => {
  it('a cross-site <img> never opens the download', async () => {
    const res = await get('', { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'image', 'sec-fetch-mode': 'no-cors' });
    expect(res.status).toBe(200);
    expect(calls.render).toHaveLength(1);
    expect(calls.withFetch).toBe(0);
    // Same for a same-site page on another port (localhost:5173 → 127.0.0.1:3001 is same-site).
    await get('', { 'sec-fetch-site': 'same-site', 'sec-fetch-dest': 'image' });
    expect(calls.withFetch).toBe(0);
  });

  it('the dashboard link, a typed URL, a clicked link and an agent fetch may download', async () => {
    await get('', { 'sec-fetch-site': 'same-origin' });
    await get('', { 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate' });
    await get('', { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-user': '?1' });
    await get('');
    expect(calls.withFetch).toBe(4);
  });

  it('the inline form never downloads', async () => {
    await get('?inline=1', { 'sec-fetch-site': 'same-origin' });
    expect(calls.withFetch).toBe(0);
  });

  it('rounds ?scale so the bake cache stays bounded', async () => {
    await get('?scale=1.37&inline=1');
    await get('?scale=9&inline=1');
    await get('?scale=0.2&inline=1');
    expect(calls.render.map((o) => o.scale)).toEqual([1, 4, 1]);
  });

  it('isExplicitRequest reads only the fetch-metadata headers', () => {
    expect(isExplicitRequest(new Headers())).toBe(true);
    expect(isExplicitRequest(new Headers({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }))).toBe(false);
  });
});
