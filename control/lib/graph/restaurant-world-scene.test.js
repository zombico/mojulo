import assert from 'node:assert';
import { test } from 'vitest';
import { resolveWorldScene, WALK_KINDS } from '@/lib/graph/worlds/world-scene';
import { renderSceneHtml } from '@/lib/graph/scene/scene-html';
import { classifyBucket, WORLD_RENDER_KINDS } from '@/lib/graph/sketch/sketch-manifest';

// A stored restaurant sketch is just a tiny recipe manifest (regenerated on render).
const SKETCH = {
  ref: 'sk_restaurant_test',
  title: 'Downtown Bistro',
  manifest: { kind: 'restaurant', seed: 7, width: 48, height: 64, material: 'brick' },
};

test('restaurant is a registered, world-bucketed, walkable kind', () => {
  assert.ok(WORLD_RENDER_KINDS.includes('restaurant'), 'in WORLD_RENDER_KINDS');
  assert.ok(WALK_KINDS.has('restaurant'), 'walkable');
  assert.equal(classifyBucket(SKETCH.manifest), 'world', 'classified into the world bucket');
});

test('resolveWorldScene dispatches a restaurant manifest to a three.js World payload', async () => {
  const { payload, kind } = await resolveWorldScene(SKETCH);
  assert.equal(kind, 'restaurant');
  assert.ok(payload && Array.isArray(payload.faces) && payload.faces.length > 0, 'faces generated');
  assert.ok(Array.isArray(payload.cameras) && payload.cameras.length > 0, 'cameras present');
  assert.ok(payload.walk, 'walk enabled');
});

test('renderSceneHtml dispatches a restaurant manifest to CSS-3D HTML', () => {
  const html = renderSceneHtml(SKETCH, {});
  assert.equal(typeof html, 'string');
  assert.ok(html.length > 1000 && html.includes('<'), 'returns an HTML document');
});
