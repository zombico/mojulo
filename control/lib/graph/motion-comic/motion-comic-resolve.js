/**
 * motion-comic asset resolution — turn every placed source into a
 * self-contained data URI (plus, for sequential-art pages, the panel/zone
 * geometry the player maps balloons through). Runs server-side at
 * serve/export time; the emitter itself stays pure.
 *
 * The canonical grain is the PANEL CROP (`{ pageRef, panel }`) — a motion
 * comic has no pages, it is bound by panels only. Whole-sketch faces
 * (`{ ref }`) remain valid for any-kind companions (a figure, a chart).
 *
 * Face policy ('auto'): an image-outcomes page prefers its finished
 * final.png (every render target bound — panel crops are cut out of it) and
 * falls back to the deterministic scaffold — the nēmu look is a legitimate
 * fidelity, so a worker-less page still plays. SVG/diagram kinds embed their
 * SVG; heavy 3D kinds (world/scene render modes) embed their baked PNG still.
 */

import sharp from 'sharp';

import { renderStoredSketchSvg } from '@/lib/graph/sketch/stored-sketch-svg';
import { rasterizeSketchToPng } from '@/lib/graph/sketch/sketch-png';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
import { compositeFinalForSketch } from '@/lib/graph/image-outcomes/final-page';
import { isImageOutcomesKind, KIND_SEQUENTIAL_ART } from '@/lib/graph/image-outcomes/manifest';
import { collectMotionComicSources } from './motion-comic-manifest';

function panelBoundsOf(sketch, panelId, ref) {
  const panel = (sketch.manifest.panels || []).find((p) => p.id === panelId);
  if (!panel?.bounds) throw new Error(`page '${ref}' has no panel '${panelId}'`);
  return panel.bounds;
}

async function svgDataUri(sketch, { panelId } = {}) {
  const svg = await renderStoredSketchSvg(sketch, panelId ? { panelId } : {});
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

async function pngDataUri(sketch, { panelId } = {}) {
  const png = await rasterizeSketchToPng(sketch, panelId ? { scale: 2, panelId } : { scale: 2 });
  return `data:image/png;base64,${png.toString('base64')}`;
}

// The finished composite, whole or cut down to one panel's bounds.
async function finalDataUri(sketch, { panelId, ref } = {}) {
  const composite = await compositeFinalForSketch(sketch);
  if (!composite?.png) return null;
  if (!panelId) return `data:image/png;base64,${composite.png.toString('base64')}`;
  const bounds = panelBoundsOf(sketch, panelId, ref);
  const viewBox = sketch.manifest.viewBox;
  const image = sharp(composite.png);
  const meta = await image.metadata();
  const sx = meta.width / viewBox.width;
  const sy = meta.height / viewBox.height;
  const left = Math.max(0, Math.round(bounds.x * sx));
  const top = Math.max(0, Math.round(bounds.y * sy));
  const extracted = await image.extract({
    left,
    top,
    width: Math.min(meta.width - left, Math.round(bounds.w * sx)),
    height: Math.min(meta.height - top, Math.round(bounds.h * sy)),
  }).png().toBuffer();
  return `data:image/png;base64,${extracted.toString('base64')}`;
}

async function resolveFace(sketch, face, ref, panelId) {
  if (face === 'svg') return svgDataUri(sketch, { panelId });
  if (face === 'png') return pngDataUri(sketch, { panelId });
  if (face === 'final') {
    const uri = await finalDataUri(sketch, { panelId, ref });
    if (!uri) {
      throw new Error(
        `source '${ref}' face 'final': not every render target is bound yet — bind the renders, or use face 'svg' for the scaffold`,
      );
    }
    return uri;
  }
  // 'auto'
  if (isImageOutcomesKind(sketch.manifest.kind)) {
    const uri = await finalDataUri(sketch, { panelId, ref });
    if (uri) return uri;
    return svgDataUri(sketch, { panelId });
  }
  const mode = sketchRenderMode(sketch.manifest);
  if (mode === 'svg' || mode === 'diagram') return svgDataUri(sketch, {});
  return pngDataUri(sketch, {});
}

/**
 * @param {object} manifest — a normalized motion-comic manifest
 * @param {(ref: string) => ({ manifest: object } | null)} getSketch
 * @returns {Promise<object>} assets keyed `${sceneId}/${placementId}` for the emitter
 */
export async function resolveMotionComicAssets(manifest, getSketch) {
  const sources = collectMotionComicSources(manifest);
  const assets = {};
  const faceCache = new Map(); // `${ref} ${face} ${panel}` → data uri
  for (const [ref, uses] of sources) {
    const sketch = getSketch(ref);
    if (!sketch?.manifest) throw new Error(`motion-comic source '${ref}' not found`);
    let pageMeta;
    if (sketch.manifest.kind === KIND_SEQUENTIAL_ART) {
      const zonesByPanel = {};
      for (const panel of sketch.manifest.panels || []) {
        zonesByPanel[panel.id] = (panel.bubbleZones || []).map((z) => ({
          x: z.x, y: z.y, w: z.w, h: z.h, label: z.label || '', lettering: z.lettering,
        }));
      }
      pageMeta = { pageViewBox: sketch.manifest.viewBox, zonesByPanel };
    }
    for (const use of uses) {
      const cacheKey = `${ref} ${use.face} ${use.panel || ''}`;
      if (!faceCache.has(cacheKey)) {
        faceCache.set(cacheKey, await resolveFace(sketch, use.face, ref, use.panel));
      }
      const asset = {
        src: faceCache.get(cacheKey),
        ...(pageMeta || {}),
      };
      if (use.panel !== undefined) {
        asset.panelBounds = panelBoundsOf(sketch, use.panel, ref);
      }
      // assetId is the placement id for base/show art and `<id>#v<n>` for a
      // swap's nth variant — each variant carries its own entry.
      assets[`${use.sceneId}/${use.assetId}`] = asset;
    }
  }
  return assets;
}
