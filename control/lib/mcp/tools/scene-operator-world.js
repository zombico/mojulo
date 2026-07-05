/**
 * create_operator_world — mint a walkable world FROM THE OPERATOR'S OWN STATE.
 *
 * Every other world tool starts from an invented recipe (a seed, a list of entities). This one starts
 * from a persisted representation of what the operator has actually built: the Connected Services union
 * view (skills + materialized mcp-orbit solutions, each with the MCP servers it calls and the
 * capabilities it still needs). It is the first tool where the main MCP hands mojulo's own context to a
 * world — you walk your solution graph.
 *
 * Snapshot semantics: the tool reads the live union view at mint time and bakes the projected graph
 * ({ nodes, edges }) into the stored `kind: 'operator-world'` manifest — a tiny recipe, no geometry, in
 * keeping with the substrate. Re-run the tool to re-snapshot after the operator wires up more services.
 *
 * Stored manifest: { kind:'operator-world', nodes:[{id,type,label,present,at}], edges:[{from,to,present}] }
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { listConnectedServices } from '@/lib/connected-services/loader';
import { assembleOperatorWorldScene, projectOperatorWorld } from '@/lib/graph/worlds/operator-world';

export function mintOperatorWorld({ title, ref, folderRef, services } = {}) {
  const list = Array.isArray(services) ? services : listConnectedServices().services;
  const { nodes, edges } = projectOperatorWorld(list);

  const manifest = {
    kind: 'operator-world',
    ...(title ? { title } : {}),
    nodes,
    edges,
  };

  // validate the recipe renders (throws on a malformed graph); no geometry persisted beyond the recipe.
  assembleOperatorWorldScene(manifest, {});

  let sketch;
  try {
    sketch = SketchRepository.create({ title: title || 'operator world', manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) throw new Error(`A sketch with ref '${ref}' already exists`);
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  const mcpNodes = nodes.filter((n) => n.type === 'mcp');
  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${enc}/world`,
    url: `/sketches/${enc}`,
    recipe: manifest,
    stats: {
      services: nodes.filter((n) => n.type === 'service').length,
      mcpTargets: mcpNodes.length,
      wired: mcpNodes.filter((n) => n.present).length,
      gaps: mcpNodes.filter((n) => !n.present).length,
      edges: edges.length,
      empty: nodes.length === 0,
    },
  };
}

export async function createOperatorWorldHandler(input) {
  const { title, ref, folder_ref: folderRef } = input || {};
  return mintOperatorWorld({ title, ref, folderRef });
}
