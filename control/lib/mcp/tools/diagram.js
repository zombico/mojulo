/**
 * Kernel diagram mint tool — the floor-1 "a bare, creative-absent mojulo can
 * still MAKE a diagram" capability (kernel-diagram-surface.plan.md).
 *
 * `mint_diagram` is the kernel counterpart to the creative `create_sketch`: it
 * validates + persists a box-and-arrow / chart diagram and returns a
 * `/sketches/<ref>` url. It imports ONLY kernel — the pure `@/lib/diagram-core`
 * (validator + grid expansion, shared with `sketch-manifest`'s dispatch so the
 * two can't drift) plus the kernel sketch store. No `lib/graph`, no `sharp`.
 *
 * It handles the CORE diagram only (stations / marks / edges / grid); the
 * creative-composition fields (`recipe` lowering, `polygonizer` constellation
 * grids) are refused with an advisory rather than silently dropped, so a diagram
 * minted here is byte-identical to the one `create_sketch` mints for the same
 * manifest (those transforms are no-ops for a plain diagram anyway). Enforced by
 * the binding test in diagram-core.binding.test.js.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import { expandGridLayout, validateDiagramManifest } from '@/lib/diagram-core';

/**
 * Validate + persist a core diagram manifest. Mirrors the diagram path of
 * create_sketch's mintSketch (expandGridLayout → validate → SketchRepository.create),
 * minus the creative-only transforms (which are no-ops for a plain diagram and
 * are refused below). Returns { ok, ref, url }.
 */
export function mintDiagram({ title, manifest, ref, folderRef } = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('`manifest` is required (object)');
  }
  // Creative-composition inputs are a studio concern (recipe lowering, CCA
  // constellation grids). mint_diagram is the kernel floor for box-arrow + chart
  // diagrams — refuse them cleanly rather than mint a manifest that create_sketch
  // would have expanded differently.
  if (manifest.recipe !== undefined) {
    throw new Error(
      '`manifest.recipe` (illustration recipe lowering) is a creative-pack feature. '
        + 'Author explicit stations/marks, or use create_sketch (run `mojulo install creative`).',
    );
  }
  if (manifest.polygonizer !== undefined) {
    throw new Error(
      '`manifest.polygonizer` (constellation composition) is a creative-pack feature. '
        + 'Author explicit stations/marks, or use create_sketch (run `mojulo install creative`).',
    );
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folderRef` must be a non-empty string or null if provided');
    }
    const folder = SketchFolderRepository.getByRef(folderRef);
    if (!folder) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }

  // Resolve grid `cell` placements to absolute x/y/w/h before validating +
  // storing (so the renderer only ever sees concrete coords), then validate
  // through the SAME kernel validator create_sketch delegates to.
  const finalized = expandGridLayout(manifest);
  const { ok, errors } = validateDiagramManifest(finalized);
  if (!ok) {
    throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({
      title,
      manifest: finalized,
      ref,
      folderRef: folderRef ?? null,
      bucket: null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
  };
}

async function mintDiagramHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('mint_diagram requires { title, manifest }');
  }
  const { title, manifest, ref, folder_ref: folderRef } = input;
  return mintDiagram({ title, manifest, ref, folderRef });
}

export function registerDiagramTools() {
  registerTool({
    name: 'mint_diagram',
    description:
      "Mint a flow-chart or data-chart diagram → a viewable /sketches/<ref> url. The KERNEL diagram maker, available even without the creative pack (a diagram is just SVG). Manifest: { title, viewBox: { width, height }, and stations[]+edges[] (boxes+arrows) and/or marks[] (chart primitives: rect/circle/wedge/line/text/…) — at least one }. Stations carry x/y/w/h; edges are { from, to, label?, via? }; optional grid { cols, rows } + per-node cell. For chart layout math query semantic_search({ kinds: ['sketch_vocab'] }). Returns { ok, ref, url }. (Illustration recipes, worlds, beats, and constellation marks are creative-pack features — use create_sketch.)",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown in the page header.' },
        manifest: {
          type: 'object',
          description:
            'Diagram manifest. Required: title, viewBox { width, height }. Provide stations[] (flow vocab) and/or marks[] (charts) — at least one. edges[] and grid are optional. Recipe/world/beats/constellation manifests are not accepted here.',
        },
        ref: {
          type: 'string',
          description:
            'Optional stable ref (1-64 chars of [A-Za-z0-9_-]). If omitted, a `sk_<…>` ref is generated. Errors if a sketch with this ref already exists.',
        },
        folder_ref: {
          type: 'string',
          description: 'Optional folder ref (`fld_<…>`) to drop this sketch into. Omit to leave it at root.',
        },
      },
      required: ['title', 'manifest'],
    },
    handler: mintDiagramHandler,
  });
}
