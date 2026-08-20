/**
 * Sketch resolver — turns a `sketch`-typed stash item into a published page
 * element. Resolves the item's `metadata.sketch_ref` to a sketch row, renders
 * the manifest through `renderSketchToSvg`, and returns both the standalone
 * SVG (for writing to a file) and the inline body (for embedding in HTML).
 *
 * Used by the `picture_book` and `slide_deck` publication kinds. See
 * lib/outcomes/PUBLISHER.plan.md for the resolver contract.
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';

// The render engine (sketch/image → SVG/PNG) is the creative pack's job. This
// resolver is the one true office→render bridge (install-capabilities.plan.md
// P3b), so it loads the renderers LAZILY — lib/outcomes (office) carries no
// static dependency on lib/graph, and an ops-only install degrades with an
// advisory instead of failing to load.
async function loadRenderers() {
  try {
    const [svg, stored, manifest, finalPage] = await Promise.all([
      import('@/lib/sketch-svg'),
      import('@/lib/graph/sketch/stored-sketch-svg'),
      import('@/lib/graph/image-outcomes/manifest'),
      import('@/lib/graph/image-outcomes/final-page'),
    ]);
    return {
      renderSketchToSvg: svg.renderSketchToSvg,
      renderStoredSketchSvg: stored.renderStoredSketchSvg,
      isImageOutcomesKind: manifest.isImageOutcomesKind,
      KIND_CHARACTER_SHEET: manifest.KIND_CHARACTER_SHEET,
      compositeFinalForSketch: finalPage.compositeFinalForSketch,
    };
  } catch {
    throw new Error('Embedding a rendered sketch/image in a cooked report needs the creative pack (render engine), which is not installed on this host.');
  }
}

/**
 * Strip the `<?xml ?>` declaration so the SVG can be inlined into HTML.
 * Standalone .svg files want the decl; an HTML host doesn't.
 */
export function stripXmlDecl(svg) {
  return svg.replace(/^\s*<\?xml[^?]*\?>\s*/i, '');
}

/**
 * Resolve a sketch-typed stash item.
 *
 * @param {object} item — the stash item; must have `metadata.sketch_ref`
 * @param {object} [opts]
 * @param {boolean} [opts.technical=false] — passed to renderSketchToSvg
 * @param {'dark'|'light'} [opts.surface='dark'] — passed to renderSketchToSvg;
 *   light surfaces (e.g. the instruction_manual diagram band) re-resolve text
 *   vars to dark ink so default-colored labels stay legible.
 * @param {Object<string,string>} [opts.vars] — presentation-theme CSS-var
 *   overrides (paper/blueprint/…) merged over the surface base, so an embedded
 *   sketch's ink/accent matches the published page's theme.
 * @returns {Promise<{ svgInline: string|null, svgStandalone: string|null, dangling: boolean }>}
 *   When the sketch_ref doesn't resolve (missing/corrupt), returns dangling=true
 *   with both SVG fields null — the caller is responsible for rendering a
 *   placeholder.
 */
export async function resolveSketchItem(item, { technical = false, surface = 'dark', vars = null, preferFinalRender = false } = {}) {
  const sketchRef = item?.metadata?.sketch_ref;
  if (!sketchRef) {
    return { svgInline: null, svgStandalone: null, png: null, dangling: true };
  }
  const sketch = SketchRepository.getByRef(sketchRef);
  if (!sketch || !sketch.manifest) {
    return { svgInline: null, svgStandalone: null, png: null, dangling: true };
  }
  const { renderSketchToSvg, renderStoredSketchSvg, isImageOutcomesKind, KIND_CHARACTER_SHEET, compositeFinalForSketch } = await loadRenderers();
  // Image-outcomes kinds (AI-painted comic pages / directed shots) are not
  // CreationMap diagrams: their SVG form is the director scaffold, and —
  // once the render worker has bound every target — a composited FINAL page
  // exists. `preferFinalRender` (the comic cook passes it) publishes the
  // final PNG when complete and falls back to the scaffold, which maps
  // faithfully onto the comic's roughest fidelity stage (the nēmu).
  if (isImageOutcomesKind(sketch.manifest.kind)) {
    if (preferFinalRender && sketch.manifest.kind !== KIND_CHARACTER_SHEET) {
      const { png } = await compositeFinalForSketch(sketch);
      if (png) return { svgInline: null, svgStandalone: null, png, dangling: false };
    }
    const svgStandalone = await renderStoredSketchSvg(sketch);
    return { svgInline: stripXmlDecl(svgStandalone), svgStandalone, png: null, dangling: false };
  }
  const svgStandalone = await renderSketchToSvg(sketch.manifest, { technical, surface, vars });
  return {
    svgInline: stripXmlDecl(svgStandalone),
    svgStandalone,
    png: null,
    dangling: false,
  };
}
