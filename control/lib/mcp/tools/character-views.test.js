// In-memory SQLite + no semantic index — must run before importing db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

// The compare step (character-views.js) with a stub drawing in place of the browser: the views a read asks for, the
// cameras turned about the hero's own front camera, one image block per view, words and the World page when nothing
// can draw, never a browser fetched for it, and nothing added to an answer that is not a character's.
import { describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/index.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { StashRepository } from '@/lib/db/repositories/stashes';
import { chromiumFetchAllowed, withChromiumFetch } from '@/lib/graph/scene/chromium-consent';
import { viewsForRead, viewSpecs, withCaptureViews, withReferenceViews, VIEW_TURNS } from './character-views.js';

getDb();

const FRONT = { name: 'front', worldFraming: { cameraPosition: [0, 3, 1.7], lookAt: [0, 0.2, 0.8], horizontalFov: 38 } };
const stubRender = (calls) => async (row, views) => { calls.push({ ref: row.ref, views, fetch: chromiumFetchAllowed() }); return views.map((view) => ({ view, png: Buffer.from(`png:${view}`) })); };
const noBrowser = async () => { throw new Error('no Chromium on this machine'); };
const heroRow = (hero) => SketchRepository.create({ title: 'h', manifest: { kind: 'layered', hero } });

describe('the views a read is drawn at', () => {
  it('draws the picture\'s view, the back when the picture did not show it, and a turnaround as three', () => {
    expect(viewsForRead({})).toEqual(['front']);
    expect(viewsForRead({ view: 'three-quarter', unseen: ['back', 'feet'] })).toEqual(['three-quarter', 'back']);
    expect(viewsForRead({ view: 'back', unseen: ['the back of the cape'] })).toEqual(['back']);
    expect(viewsForRead({ view: 'turnaround' })).toEqual(['front', 'side', 'back']);
  });

  it('turns the hero\'s own front camera about the vertical through its look-at, keeping its distance, height and lens', () => {
    const [front, back, side] = viewSpecs({ cameras: [FRONT] }, ['front', 'back', 'side']).map((s) => s.spec);
    expect(front.pos).toEqual([0, 3, 1.7]);
    expect(back.pos[0]).toBeCloseTo(0); expect(back.pos[1]).toBeCloseTo(-2.6); expect(back.pos[2]).toBeCloseTo(1.7);
    expect(Math.hypot(side.pos[0], side.pos[1] - 0.2)).toBeCloseTo(2.8);
    expect(new Set([front.vfov, back.vfov, side.vfov]).size).toBe(1);
    expect(Object.keys(VIEW_TURNS)).toEqual(['front', 'three-quarter', 'side', 'back']);
    expect(() => viewSpecs({ cameras: [] }, ['front'])).toThrow(/front camera/);
  });
});

describe('answers drawn back to the agent', () => {
  it('answers a character capture with one image per view, in order, drawn with no browser fetched even under consent', async () => {
    const row = heroRow({ cast: 'female' }), calls = [];
    const capture = withCaptureViews(async () => ({ ok: true, target: 'character', ref: row.ref }), { render: stubRender(calls) });
    const { value: out } = await withChromiumFetch(() => capture({ target: 'character', insights: { view: 'front', unseen: ['back'] } }));
    expect(out.content.map((c) => c.type)).toEqual(['text', 'image', 'image']);
    expect(JSON.parse(out.content[0].text).views.drawn).toEqual(['front', 'back']);
    expect(Buffer.from(out.content[2].data, 'base64').toString()).toBe('png:back');
    expect(calls).toEqual([{ ref: row.ref, views: ['front', 'back'], fetch: false }]);
  });

  it('says so and gives the World page when nothing can draw, and the call still answers', async () => {
    const row = heroRow({ cast: 'male' });
    const out = await withCaptureViews(async () => ({ ok: true, target: 'character', ref: row.ref }), { render: noBrowser })({ target: 'character', insights: {} });
    expect(out.ok).toBe(true);
    expect(out.content).toBeUndefined();
    expect(out.views).toMatchObject({ drawn: false, world_url: `/api/sketches/${row.ref}/world` });
    expect(out.views.why).toMatch(/no Chromium/);
  });

  it('adds nothing to another target\'s capture or to an update of a hero not made from a picture', async () => {
    const calls = [], render = stubRender(calls);
    const pose = { ok: true, target: 'pose', cage_ref: 'sk_x' };
    expect(await withCaptureViews(async () => pose, { render })({ target: 'pose' })).toBe(pose);
    const plain = heroRow({ cast: 'male' }), body = { ok: true, ref: plain.ref };
    expect(await withReferenceViews(async () => body, { render })({ ref: plain.ref })).toBe(body);
    expect(calls).toEqual([]);
  });

  it('answers an update of a hero made from a picture at the views its filed read asks for', async () => {
    const stash = StashRepository.mint({ title: 'ref' });
    const row = heroRow({ cast: 'female', reference: { likeness: 'original', stash: stash.stashRef } });
    StashRepository.gather({ stashRef: stash.stashRef, type: 'sketch', title: 'read', metadata: { sketch_ref: row.ref, label: 'read', reference_target: 'character', hero_ref: row.ref, insights: { view: 'side', unseen: ['back'] } } });
    const calls = [];
    const out = await withReferenceViews(async () => ({ ok: true, ref: row.ref }), { render: stubRender(calls) })({ ref: row.ref });
    expect(JSON.parse(out.content[0].text).views.drawn).toEqual(['side', 'back']);
    expect(calls[0].views).toEqual(['side', 'back']);
  });
});
