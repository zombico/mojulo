/**
 * mint_building — one door for the house. A house is one recipe that gains
 * depth: a layout, then a dwelling (furnished, storeys), then its construction
 * (framing, roof, drainage), then a BIM model (export_model format 'ifc'). The
 * door takes the floorplan manifest create_sketch takes, unchanged, mints it
 * through the same mintSketch (so both doors store the same row), and answers
 * with `next`: the house's open concerns by outcome (Concept, Layout, Drawings,
 * Build), each naming the field or export and the outcome card that teaches it.
 */

import { registerTool } from '@/lib/mcp/server';
import { mintSketch } from '@/lib/mcp/tools/sketch-mint';
import { BUILDING_KINDS } from '@/lib/mcp/tools/building-next';

export function mintBuilding({ title, manifest, ref, folderRef } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error("mint_building requires { title, manifest }: a floorplan manifest (seed, or rooms[], or storeys / levels[]). Card: get_sketch_vocab({ id: 'house-layout' }).");
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
  // the readout (design, inferred, next) comes from the recipe as stored, the same as create_sketch's
  return mintSketch({ title, manifest: m, ref, folderRef });
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
      "Mint a walkable house, apartment or one furnished room with its structure book (plans, sections, schedules, frame) → { ok, ref, url, design, next }. manifest: a floorplan from a `seed` (width / height in feet) or `rooms[]` { x, y, w, h, glyph }; `view`: 'exterior' | 'cutaway' | 'interior'. `next` names what is open by outcome (concept, layout, drawings, build): the field or export for each, and its card (get_sketch_vocab). Iterate with update_sketch.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown in the page header.' },
        manifest: {
          type: 'object',
          additionalProperties: true,
          description: "The floorplan recipe; kind 'floorplan' and its title may be left out. Card: house-layout.",
        },
        ref: { type: 'string', description: 'Optional stable ref (1-64 chars of [A-Za-z0-9_-]); default `sk_<10-char>`. Errors if taken.' },
        folder_ref: { type: 'string', description: 'Optional `fld_<…>` folder to drop the house into.' },
      },
      required: ['title', 'manifest'],
    },
    handler: mintBuildingHandler,
  });
}
