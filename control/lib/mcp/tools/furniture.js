/**
 * mint_solid kind 'furniture' — a piece composed from the furniture grammar (graph/furnishings/forms.js): a style to
 * start from, or a kind, with forms swapped per slot, a finish and a size, resolved and LOCKED at mint (the build's
 * resolved dials, its cloth, tint and leg form), so retuning the styles later never moves a minted piece.
 *
 * By default the piece is a DISPLAY ASSET for populating houses (furnishings/asset.js): a workbench row whose
 * `build: { type: 'furniture', … }` is drawn the way a room draws its furniture and filled to its size exactly, flagged
 * `buildable: false` — no joints, no construction report, no cut list. `buildable: true` stores the jointed build
 * instead, one workbench frame, which the furniture report, the manual and the bill of materials read.
 */
import { resolveFurniture, FURNITURE_KINDS, FURNITURE_STYLES } from '@/lib/graph/furnishings/forms';
import { furnitureAssetBuild, FURNITURE_ASSET_NOTE } from '@/lib/graph/furnishings/asset';
import { mintWorkbench } from '@/lib/mcp/tools/workbench';
import { ensureExactKernel } from '@/lib/graph/polygonizer/field-exact';

const USAGE = "The furniture kind needs `like` (a style: get_solid_vocab({ id: 'furniture' }) lists them) or `piece` "
  + `(${Object.keys(FURNITURE_KINDS).join(' | ')}), with optional \`forms\` { <slot>: <form> }, \`finish\`, \`size\` [w, d, h] mm and \`buildable\`.`;

/** The lock as the workbench frame that stores it. */
export function furnitureFrame(locked, id) {
  return {
    ...(id ? { id } : {}),
    unit: 'mm',
    build: locked.build,
    ...(locked.fabric !== undefined ? { fabric: locked.fabric } : {}),
    ...(locked.tint !== undefined ? { tint: locked.tint } : {}),
    ...(locked.legs && locked.legs !== 'block' ? { legs: locked.legs } : {}),
  };
}

export async function createFurnitureHandler(input) {
  if (!input || typeof input !== 'object' || (!input.like && !input.piece)) throw new Error(USAGE);
  const { like, piece, forms, finish, size, buildable = false, title, ref, folder_ref: folderRef } = input;
  if (typeof buildable !== 'boolean') throw new Error('furniture: buildable is true (the jointed build) or false (a display piece, the default)');
  const r = resolveFurniture({ like: like || null, kind: piece || null, forms: forms || {}, finish: finish || {}, size: size || null });
  const name = title || (like ? FURNITURE_STYLES[like].label : r.locked.kind);
  const common = {
    piece: r.locked.kind, basis: r.basis, worn: r.worn, forms: r.forms, finish: r.finish, size_mm: r.locked.sizeMm, buildable,
  };
  if (!buildable) {
    const out = await mintWorkbench({ title: name, build: furnitureAssetBuild(r.locked), units: 'mm', ref, folderRef });
    return {
      ...out,
      furniture: {
        ...common,
        note: FURNITURE_ASSET_NOTE,
        next: 'Restyle in place with update_sketch: /build/dials/<dial> (arms, back, cushions, seats, shelves, drawers …), '
          + '/build/legs, /build/fabric, /build/tint, /build/size (filled exactly). To compose again from a style, mint again.',
      },
    };
  }
  await ensureExactKernel();                       // a frame's joints need Manifold loaded before the sync lowering
  const out = await mintWorkbench({ title: name, frames: [furnitureFrame(r.locked, like || r.locked.kind)], units: 'mm', ref, folderRef });
  // the build holds some sizes to what it can make (a sofa's back runs 680–1000 mm): say so, axis by axis
  const asked = r.locked.sizeMm;
  const built = out.stats && out.stats.size ? [out.stats.size.w, out.stats.size.d, out.stats.size.h] : null;
  const off = built ? ['w', 'd', 'h'].filter((_, k) => Math.abs(built[k] - asked[k]) / asked[k] > 0.05) : [];
  return {
    ...out,
    furniture: {
      ...common,
      ...(built ? { size_built_mm: built } : {}),
      ...(off.length ? { size_note: `built ${off.map((a) => `${a} ${built['wdh'.indexOf(a)]} mm (asked ${asked['wdh'.indexOf(a)]})`).join(', ')}: the ${r.locked.kind} build holds its proportions to what it can make; patch its dials (/frames/0/build/…) to go further` } : {}),
      next: 'Restyle in place with update_sketch on /frames/0 — /frames/0/build/<dial>, /frames/0/fabric, /frames/0/tint, '
        + "/frames/0/legs. To compose again from a style, mint again with `like` and the forms you want.",
    },
  };
}
