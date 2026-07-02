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
import { renderSketchToSvg } from '@/lib/graph/sketch/sketch-svg';

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
export async function resolveSketchItem(item, { technical = false, surface = 'dark', vars = null } = {}) {
  const sketchRef = item?.metadata?.sketch_ref;
  if (!sketchRef) {
    return { svgInline: null, svgStandalone: null, dangling: true };
  }
  const sketch = SketchRepository.getByRef(sketchRef);
  if (!sketch || !sketch.manifest) {
    return { svgInline: null, svgStandalone: null, dangling: true };
  }
  const svgStandalone = await renderSketchToSvg(sketch.manifest, { technical, surface, vars });
  return {
    svgInline: stripXmlDecl(svgStandalone),
    svgStandalone,
    dangling: false,
  };
}
