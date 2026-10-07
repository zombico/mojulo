/**
 * furnishings/asset — a composed piece stored as a DISPLAY ASSET on a workbench row: `build: { type: 'furniture', … }`,
 * drawn on every read the way a room draws its furniture (construction/facades.js: no joints, pulls on, legs shaped)
 * and filled to its size exactly. It is for populating houses and for the procedural rooms, not for making: it carries
 * no construction report and no cut list, and says so (`buildable: false`). The jointed build is the furniture kind's
 * opt-in (`buildable: true`, a workbench frame).
 *
 *   build: { type: 'furniture', piece: 'sofa' | 'chair' | 'table' | 'casework', dials: { …the build's resolved dials },
 *            legs?: 'block' | …, size: [w, d, h] mm, fabric?, tint? }
 *
 * The dials are the truth (a lock: retuning the styles never moves it); a patch on `/build/dials/<dial>`,
 * `/build/legs`, `/build/fabric`, `/build/tint` or `/build/size` restyles it in place.
 */
import { FURNITURE_KINDS } from './forms.js';
import { validateBuild, expandBuild, LEG_SHAPES } from '../construction/furniture-builds.js';
import { fabricError } from '../construction/fabric.js';
import { lockedFurnitureFaces } from '../construction/facades.js';

const HEX = /^#[0-9a-f]{6}$/i;
const MM_PER = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
export const FURNITURE_ASSET_NOTE = 'a display piece, drawn from a furniture build: no joints, no construction report, '
  + 'not checked for building (mint the furniture kind with buildable: true for the jointed build)';

export function hasFurnitureAsset(manifest) {
  return !!(manifest && manifest.build && typeof manifest.build === 'object' && manifest.build.type === 'furniture');
}

/** A resolved lock (forms.js resolveFurniture) → the stored build. */
export function furnitureAssetBuild(locked) {
  return {
    type: 'furniture', piece: locked.kind, dials: locked.build,
    ...(locked.legs && locked.legs !== 'block' ? { legs: locked.legs } : {}),
    size: locked.sizeMm,
    ...(locked.fabric !== undefined ? { fabric: locked.fabric } : {}),
    ...(locked.tint !== undefined ? { tint: locked.tint } : {}),
  };
}

const lockOf = (b) => ({ kind: b.piece, build: b.dials, legs: b.legs || 'block', sizeMm: b.size, ...(b.fabric !== undefined ? { fabric: b.fabric } : {}), ...(b.tint !== undefined ? { tint: b.tint } : {}) });

/** Why a stored furniture build is malformed → string[], each naming what is valid. */
export function furnitureAssetErrors(b) {
  const e = [];
  if (!FURNITURE_KINDS[b.piece]) e.push(`build.piece: one of ${Object.keys(FURNITURE_KINDS).join(', ')}`);
  else if (!b.dials || b.dials.type !== FURNITURE_KINDS[b.piece].build) e.push(`build.dials: the ${b.piece} build's dials, { type: '${FURNITURE_KINDS[b.piece].build}', … }`);
  else e.push(...validateBuild(b.dials, 'build.dials'));
  if (b.legs !== undefined && !LEG_SHAPES.includes(b.legs)) e.push(`build.legs: one of ${LEG_SHAPES.join(', ')}`);
  if (!(Array.isArray(b.size) && b.size.length === 3 && b.size.every((v) => Number.isFinite(v) && v > 0))) e.push('build.size: [w, d, h] millimetres');
  if (b.fabric !== undefined && fabricError(b.fabric)) e.push(`build.${fabricError(b.fabric)}`);
  if (b.tint !== undefined && !HEX.test(b.tint)) e.push("build.tint: '#rrggbb'");
  if (!e.length) { try { expandBuild({ unit: 'mm', build: b.dials }); } catch (err) { e.push(`build.dials: ${err.message.replace(/^build: /, '')}`); } }
  return e;
}

/** The asset's faces in the workbench's unit (`units`, default mm), lit by `light`. Throws on a malformed build. */
export function furnitureAssetFaces(b, units = 'mm', light = null) {
  const errs = furnitureAssetErrors(b);
  if (errs.length) throw new Error(`Invalid furniture build:\n- ${errs.join('\n- ')}`);
  return lockedFurnitureFaces(lockOf(b), { unitMm: MM_PER[units] || 1, light, fit: true });
}

/** The readout for `stats.furniture`. */
export function furnitureAssetReadout(b) {
  return { piece: b.piece, buildable: false, ...(b.legs ? { legs: b.legs } : {}), size_mm: b.size, note: FURNITURE_ASSET_NOTE };
}
