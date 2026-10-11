/**
 * mint_building — one door for a building. A house is one recipe that gains
 * depth: a layout, then a dwelling (furnished, storeys), then its construction
 * (framing, roof, drainage), then a BIM model (export_model format 'ifc'). A
 * store, a restaurant, a mall and a school are buildings too: each is read as the building
 * it is (its occupancy, rooms named by role, its program's grade) and gets the
 * same structure book, sheets and schedules (lib/graph/structure/programs.js).
 * The door takes the manifest create_sketch takes, unchanged, mints it through
 * the same mintSketch (so both doors store the same row), and answers with
 * `next`: the building's open concerns by outcome, each naming the field or
 * export and the outcome card that teaches it.
 */

import { registerTool } from '@/lib/mcp/server';
import { mintSketch } from '@/lib/mcp/tools/sketch-mint';
import { BUILDING_KINDS, buildingRead, buildingNext, buildingSays } from '@/lib/mcp/tools/building-next';
import { mintSchoolComplex } from '@/lib/mcp/tools/scene-school';

export function mintBuilding({ title, manifest, ref, folderRef } = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error("mint_building requires { title, manifest }: a floorplan manifest (seed, or rooms[], or storeys / levels[]), or { kind: 'store', card } | { kind: 'restaurant', seed } | { kind: 'mall' }. Cards: get_sketch_vocab({ id: 'house-layout' }) · ({ id: 'building-commercial' }).");
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
      `mint_building builds a house, apartment or room (kind 'floorplan'), a store, a restaurant, a mall or a school ('school-complex'); '${m.kind}' is not one. ` +
      "A bespoke institutional building is mint_solid kind 'edifice'; a city or campus is compose_world."
    );
  }
  // a school is minted by its own door (compose_world's school base), so both store the same row; its readout is the
  // building's, read from the recipe as stored
  if (m.kind === 'school-complex') {
    const res = mintSchoolComplex({ ...m, title: m.title ?? title, ref, folderRef });
    const read = buildingRead(res.recipe);
    const next = buildingNext(res.recipe, read);
    return { ok: true, ref: res.ref, url: res.url, ...buildingSays(read), ...(next ? { next } : {}) };
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
      "Mint a walkable building with its structure book (plans, sections, schedules; a house's frame) → { ok, ref, url, design, next }. A house, apartment or one furnished room: a floorplan from a `seed` (width / height in feet) or `rooms[]` { x, y, w, h, glyph }; `view`: 'exterior' | 'cutaway' | 'interior'. A shop: kind 'store' { card }; 'restaurant' { seed }; 'mall' { levels: 1 | 2, cards }. A school: 'school-complex' { seed, pattern }. `next` names what is open by outcome (concept, layout, drawings, build) and its card (get_sketch_vocab). Iterate with update_sketch.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown in the page header.' },
        manifest: {
          type: 'object',
          additionalProperties: true,
          description: "The building's recipe: a floorplan (kind 'floorplan' and its title may be left out; card house-layout), or kind 'store' | 'restaurant' | 'mall' | 'school-complex' (card building-commercial).",
        },
        ref: { type: 'string', description: 'Optional stable ref (1-64 chars of [A-Za-z0-9_-]); default `sk_<10-char>`. Errors if taken.' },
        folder_ref: { type: 'string', description: 'Optional `fld_<…>` folder to drop the house into.' },
      },
      required: ['title', 'manifest'],
    },
    handler: mintBuildingHandler,
  });
}
