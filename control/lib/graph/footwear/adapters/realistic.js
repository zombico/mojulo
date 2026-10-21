/**
 * THE REALISTIC FOOT (`form: 'realistic'`, the form field's body): its foot, toes and shank re-sampled onto the field,
 * each segment's stations `u` 0 to 2. The upper is a field garment (body-relational-garment.js): leather close over the
 * foot's forms, `covers: null` with a window ('boot': the shaft up the shank, the foot's top rings tucked under it round
 * the ankle, since the foot's skin runs on inside the shank's; 'shoe': from the collar down).
 *
 *   realisticFoot(recipe, R, build, map) → the adapter (../index.js)
 *   footwear(recipe, R, build, map, spec, { id, group }) → wearFootwear on it
 *
 * Pure and deterministic.
 */
import { fieldGarment } from '../../polygonizer/body-relational-garment.js';
import { wearFootwear } from '../index.js';

/** the upper's leather: close, over the foot's forms (the operator's choice of the close boot) */
const UPPER = { ease: 0.004, looser: 1.2, reach: 0.02, taut: false, span: 0.04, along: 2, soft: true };

export function realisticFoot(recipe, R, build, map) {
  const J = recipe.rig?.joints ?? {}, at = (k) => J[k]?.at ?? J[k];
  return {
    sides: ['R', 'L'],
    seg: (kind, S) => `${kind}${S}`,
    joints: (S) => ({ ankle: at(`ankle${S}`), toeBase: at(`toeBase${S}`), toeTip: at(`toeTip${S}`) }),
    bare: (name) => recipe.parts[name],
    upper(F, { id, group }) {
      const boot = F.height === 'boot', window = boot ? { shank: [2 - 2 * (F.shaft ?? 0.3), 2] } : { foot: [2 * (F.collar ?? 0.15), 2] };
      return fieldGarment(recipe, R, build, map, { id, covers: null, on: boot ? ['foot', 'toes', 'shank'] : ['foot', 'toes'], window, ...UPPER, group }).parts;
    },
    u: (_kind, share) => 2 * share,
  };
}

/** The footwear on the realistic body. */
export const footwear = (recipe, R, build, map, spec = 'boots', opts = {}) => wearFootwear(realisticFoot(recipe, R, build, map), spec, opts);
