/**
 * mint_building — one door for the house. A house is one recipe that gains
 * depth: a layout, then a dwelling (furnished, storeys), then its construction
 * (framing, roof, drainage), then a BIM model (export_model format 'ifc'). The
 * door takes the floorplan manifest create_sketch takes, unchanged, mints it
 * through the same mintSketch (so both doors store the same row), and answers
 * with `next`: the steps the recipe can take from here, each naming the card
 * that teaches it.
 */

import { registerTool } from '@/lib/mcp/server';
import { mintSketch } from '@/lib/mcp/tools/sketch-mint';
import { BUILDING_KINDS, buildingNext } from '@/lib/mcp/tools/building-next';

export function mintBuilding({ title, manifest, ref, folderRef } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error("mint_building requires { title, manifest }: a floorplan manifest (seed, or rooms[], or storeys / levels[]). Card: get_sketch_vocab({ id: 'floor-plan' }).");
  }
  // `kind` and the manifest's own `title` may be left out: each is added in front, in the order
  // the card writes them, only when absent — so a manifest create_sketch accepts is stored exactly
  // as create_sketch stores it.
  const front = {};
  if (manifest.kind === undefined) front.kind = 'floorplan';
  if (manifest.title === undefined && typeof title === 'string') front.title = title;
  const m = Object.keys(front).length ? { ...front, ...manifest } : manifest;
  if (!BUILDING_KINDS.includes(m.kind)) {
    throw new Error(
      `mint_building builds a house, apartment or room (kind 'floorplan'); '${m.kind}' is not one. ` +
      "A bespoke institutional building is mint_solid kind 'edifice'; a store, mall or restaurant is create_sketch; a city or campus is compose_world."
    );
  }
  const result = mintSketch({ title, manifest: m, ref, folderRef });
  return { ...result, next: buildingNext(m) };
}

async function mintBuildingHandler(input) {
  if (!input || typeof input !== 'object') throw new Error('mint_building requires { title, manifest }');
  const { title, manifest, ref, folder_ref: folderRef } = input;
  return mintBuilding({ title, manifest, ref, folderRef });
}

export function registerBuildingTools() {
  registerTool({
    name: 'mint_building',
    description:
      "Mint a walkable house, apartment or one furnished room → { ok, ref, url, next }. manifest: a floorplan from a `seed` (width / height in feet) or `rooms[]` { x, y, w, h, glyph }; `view`: 'exterior' | 'cutaway' | 'interior'. A house climbs in steps (furnish, storeys → framing, roof, drainage → IFC via export_model); `next` names the steps open from here and the card to read for each (get_sketch_vocab). Iterate with update_sketch.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown in the page header.' },
        manifest: {
          type: 'object',
          additionalProperties: true,
          description: "The floorplan recipe; kind 'floorplan' and its title may be left out. Card: floor-plan.",
        },
        ref: { type: 'string', description: 'Optional stable ref (1-64 chars of [A-Za-z0-9_-]); default `sk_<10-char>`. Errors if taken.' },
        folder_ref: { type: 'string', description: 'Optional `fld_<…>` folder to drop the house into.' },
      },
      required: ['title', 'manifest'],
    },
    handler: mintBuildingHandler,
  });
}
