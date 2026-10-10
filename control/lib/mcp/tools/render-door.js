/**
 * render_handoff — the external worker loop as one door: `{ medium: 'image' | 'mesh', op, … }` runs the same handler
 * the per-op tool runs (render-handoff.js, mesh-handoff.js). Those ten names stay registered and callable, unlisted, so
 * a worker script, a packet or a catalyst that names one keeps working; tools/list carries this one schema instead.
 */
import { registerTool } from '@/lib/mcp/server';
import {
  requestImageRenderHandler, pullImageRenderHandler, submitImageRenderHandler, acceptImageRenderHandler, rejectImageRenderHandler,
} from '@/lib/mcp/tools/render-handoff';
import {
  requestMeshRenderHandler, pullMeshRenderHandler, submitMeshRenderHandler, acceptMeshRenderHandler, rejectMeshRenderHandler,
} from '@/lib/mcp/tools/mesh-handoff';

export const RENDER_OPS = Object.freeze(['request', 'pull', 'submit', 'accept', 'reject']);
const HANDLERS = {
  image: { request: requestImageRenderHandler, pull: pullImageRenderHandler, submit: submitImageRenderHandler, accept: acceptImageRenderHandler, reject: rejectImageRenderHandler },
  mesh: { request: requestMeshRenderHandler, pull: pullMeshRenderHandler, submit: submitMeshRenderHandler, accept: acceptMeshRenderHandler, reject: rejectMeshRenderHandler },
};

/** The per-op tool a `{ medium, op }` names: `request_image_render`, … */
export const opToolName = (medium, op) => `${op}_${medium}_render`;

export async function renderHandoffHandler(input) {
  const { medium, op, ...args } = input && typeof input === 'object' ? input : {};
  if (!HANDLERS[medium]) throw new Error("render_handoff: `medium` is 'image' or 'mesh'");
  if (!RENDER_OPS.includes(op)) throw new Error(`render_handoff: \`op\` is one of ${RENDER_OPS.join(' | ')}`);
  return HANDLERS[medium][op](args);
}

export function registerRenderDoorTools() {
  registerTool({
    name: 'render_handoff',
    description:
      'The durable worker loop for an external generator: request → pull → submit → accept | reject. `medium: image` paints an '
      + 'image-outcome / sequential-art sketch (per target: page or panel); `mesh` sculpts a sketch\'s greybox (Meshy, Tripo, '
      + 'Hunyuan3D…). request `{ ref, target? }` parks it (survives restarts); pull `{ ref?, request_id? }` claims the oldest '
      + 'with its packet; submit `{ request_id, image_path | image_base64 | glb_path | glb_base64, worker_audit, source }`; '
      + 'accept / reject `{ request_id, accept_audit, source }`: the eyes gate, never by the submitting worker.',
    inputSchema: {
      type: 'object',
      properties: {
        medium: { type: 'string', enum: ['image', 'mesh'] },
        op: { type: 'string', enum: [...RENDER_OPS] },
        ref: { type: 'string' },
        target: { type: 'string', description: "image: 'page' or a panel id; omit for every target." },
        request_id: { type: 'string' },
        image_path: { type: 'string', description: 'Absolute PNG path on this host.' },
        image_base64: { type: 'string' },
        glb_path: { type: 'string', description: 'Absolute .glb path on this host.' },
        glb_base64: { type: 'string' },
        worker_audit: { type: 'object', description: "The worker's own claim, recorded, not trusted as acceptance." },
        accept_audit: { type: 'object', description: 'What was checked, or why it failed.' },
        source: { type: 'string', description: 'Worker or accepting agent identity.' },
        note: { type: 'string' },
      },
      required: ['medium', 'op'],
    },
    handler: renderHandoffHandler,
  });
}
