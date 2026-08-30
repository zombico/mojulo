/**
 * Background warm of the gallery's baked images: the scene/world PNG still, and
 * the turntable strip behind it.
 *
 * The world/scene-bucket kinds (fractal cities, transit hubs, workbenches,
 * turntables) can't render live per gallery card, so the Library shows a baked
 * PNG via /api/sketches/<ref>/png?scale=1 and — when a card is asked to turn —
 * a 16-frame strip via /api/sketches/<ref>/turntable.png. Both are otherwise
 * baked LAZILY on first view, a headless-Chromium render the first viewer waits
 * on.
 *
 * `warmScenePng` fires those bakes in the BACKGROUND right after a world/scene
 * sketch is created or its manifest is edited, so the card is a warm disk-cache
 * hit instead of a first-view render. It is intentionally:
 *   • fire-and-forget — returns synchronously; the creating agent never waits on
 *     Chromium. If the gallery is opened before the bake finishes, the lazy
 *     on-demand path runs exactly as it does today (no regression).
 *   • render-mode-gated — only 'world' / 'scene' kinds bake here; SVG/diagram
 *     kinds rasterize cheaply with sharp on demand and need no warming.
 *   • error-swallowing — a failed warm just means the next view re-bakes.
 *   • scale-1 only — that's what the gallery requests. The scale-2 "Download PNG"
 *     target stays lazy (a deliberate click where a short wait is fine).
 *   • ordered still-then-strip — the cheap image the card shows at rest lands
 *     first; the strip (16 frames, the heavier bake) follows behind it, one at a
 *     time via the bake queue in turntable-bake.js.
 *
 * The heavy rasterizers (puppeteer + sharp) are loaded with deferred import()s so
 * merely importing this helper from a mint tool stays cheap until a warm fires.
 */

import { isPolygomerManjiTree, sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';

// Warming spawns a headless Chromium. Skip it under the test runner (vitest sets
// VITEST) so the mint-tool unit tests don't each launch a browser in the
// background, and honor an explicit opt-out for constrained hosts.
function warmingDisabled() {
  return Boolean(
    process.env.VITEST ||
      process.env.NODE_ENV === 'test' ||
      process.env.MOJULO_DISABLE_SCENE_WARM,
  );
}

/**
 * Pre-bake the scale-1 PNG and the turntable strip for a freshly created/updated
 * sketch, in the background. Safe to call for any sketch — it no-ops unless the
 * kind renders as a heavy 'world' / 'scene'. Never throws and never returns a
 * value to await.
 *
 * @param {{ ref?: string, manifest?: object }} sketch
 */
export function warmScenePng(sketch) {
  if (warmingDisabled()) return;
  if (!sketch || !sketch.manifest) return;
  const mode = sketchRenderMode(sketch.manifest);
  if (mode !== 'world' && mode !== 'scene') return;
  // Polygomer stills bake from the cheap manji SVG path (no Chromium, no PNG
  // cache) — nothing worth pre-warming. Their turntable still is worth it: the
  // manji-tree has a World form, so the card can turn even though the still is
  // vector.
  const stillWorthWarming = !isPolygomerManjiTree(sketch.manifest);

  // Fire-and-forget. The IIFE keeps the heavy imports + bakes entirely off the
  // caller's path; any failure (no Chromium, ineligible scene, write error) is
  // swallowed so the lazy paths bake on first view instead.
  void (async () => {
    if (stillWorthWarming) {
      try {
        const { rasterizeSketchToPng } = await import('@/lib/graph/sketch/sketch-png');
        await rasterizeSketchToPng(sketch, { scale: 1 });
      } catch {
        /* ignore — the on-demand /png path will bake on first view */
      }
    }
    if (process.env.MOJULO_DISABLE_TURNTABLE_WARM) return;
    try {
      const { bakeTurntableStrip } = await import('@/lib/graph/sketch/turntable-bake');
      await bakeTurntableStrip(sketch);
    } catch {
      /* ignore — the on-demand /turntable.png path will bake on first hover */
    }
  })();
}
