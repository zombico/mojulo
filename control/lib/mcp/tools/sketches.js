/**
 * create_sketch — operator agent mints a flow-charty diagram on demand.
 *
 * The agent POSTs a manifest (same shape the curated app-creation map at
 * /graph uses); we persist it and return a `/sketches/<ref>` URL the agent
 * hands to the user. Renders via the existing CreationMap.jsx SVG layer —
 * no new renderer, no library deps.
 *
 * Deliberately NOT integrated into forward_context / Ring 6 / contextmap.
 * Sketches are scratch visualizations, not structural decisions. If the
 * surface earns its place later we promote it; until then, the agent
 * discovers it via the protocol-level tools/list response.
 *
 * See lite-template/integration/app-system/0527/SKETCHBOOK_PLAN.md.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import {
  validateSketchManifest,
  STATION_KINDS,
  EDGE_VIA_VALUES,
} from '@/lib/graph/sketch-manifest';

export async function createSketchHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_sketch requires { title, manifest }');
  }
  const { title, manifest, ref } = input;
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  const { ok, errors } = validateSketchManifest(manifest);
  if (!ok) {
    throw new Error(`Invalid manifest:\n - ${errors.join('\n - ')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref });
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

export function registerSketchTools() {
  registerTool({
    name: 'create_sketch',
    description:
      "Mint a flow-charty diagram the operator can view in the control-plane UI. Use this to depict a workflow, a data flow, a decision chain, or any structure that's easier shown than described — without rearchitecting an overlay. The manifest mirrors the curated app-creation-map at /graph. Stations are positioned with explicit x/y/w/h (pixel coords inside the viewBox). Station kinds are " +
      STATION_KINDS.map((k) => `\`${k}\``).join(' | ') +
      " — pick the closest fit (e.g. `mcp_tool` for any callable/process, `filesystem` for files/payloads/messages-in-motion, `db_row` for durable records, `input` for parameters/preconditions). Edges are `{ from, to, label?, via?, curvature? }`; `label` is the verb (e.g. \"writes\", \"reads\", \"triggers\"). The default path is an S-curve that goes between the two stations — fine when the straight line is clear, but it will slice through any station that happens to sit between the endpoints. Use `via` to route around when that happens: `via: 'right' | 'left' | 'top' | 'bottom'` exits the source on that side, runs along a channel just outside both stations' extents on that side, and re-enters the target from the same side. Pick the side opposite to whatever's in the way (right/left for vertical lanes, top/bottom for horizontal lanes). Use `curvature` (0.2 – 3, default 1) to swoop the default S-curve harder (> 1) or flatten it toward straight (< 1) — useful when two stations are close and the default curve looks awkward. Returns `{ ok, ref, url }` — hand the `url` to the user so they can open the sketch. The sketch persists across restarts at `/sketches/<ref>`.",
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title shown in the page header.',
        },
        ref: {
          type: 'string',
          description:
            'Optional stable ref (1-64 chars of [A-Za-z0-9_-]). If omitted, a `sk_<10-char>` ref is generated. Errors if a sketch with this ref already exists.',
        },
        manifest: {
          type: 'object',
          description:
            'Diagram manifest. Required keys: title, viewBox: { width, height }, stations[], edges[].',
          properties: {
            title: { type: 'string' },
            viewBox: {
              type: 'object',
              properties: {
                width: { type: 'number' },
                height: { type: 'number' },
              },
              required: ['width', 'height'],
            },
            stations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique within this manifest; referenced by edges.' },
                  kind: { type: 'string', enum: STATION_KINDS },
                  label: { type: 'string' },
                  sublabel: { type: 'string' },
                  items: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Bullet rows shown inside the station box.',
                  },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  w: { type: 'number' },
                  h: { type: 'number' },
                },
                required: ['id', 'kind', 'label', 'x', 'y', 'w', 'h'],
              },
            },
            edges: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string', description: 'Source station id.' },
                  to: { type: 'string', description: 'Destination station id.' },
                  label: { type: 'string', description: 'Edge verb (e.g. "writes", "reads", "triggers").' },
                  via: {
                    type: 'string',
                    enum: EDGE_VIA_VALUES,
                    description:
                      "Route around a channel outside the lane. Pick the side opposite to whatever station is in the way: 'right'/'left' for vertical lanes (when an edge skips stations stacked vertically), 'top'/'bottom' for horizontal lanes (when an edge skips stations laid out horizontally).",
                  },
                  curvature: {
                    type: 'number',
                    minimum: 0.2,
                    maximum: 3,
                    description:
                      "Multiplier on the default S-curve's control-point offset. 1 (default) is the original curve; > 1 swoops harder so the curve clears territory near the straight line; < 1 flattens toward straight (good for short hops where a tight S looks awkward). Ignored when `via` is set.",
                  },
                },
                required: ['from', 'to'],
              },
            },
          },
          required: ['title', 'viewBox', 'stations'],
        },
      },
      required: ['title', 'manifest'],
    },
    handler: createSketchHandler,
  });
}
