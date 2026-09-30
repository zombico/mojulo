// construction/finishes — the colours of what is not wood: steel, concrete and reinforcing bar.
//
// Steel is drawn in its finish: the blue-black mill scale it leaves the rolling mill in, a red-oxide shop primer,
// hot-dip galvanizing, weathering steel's rust, stainless, or any paint. Concrete is its cement's grey (or a named mix),
// rebar its rust unless epoxy-coated or galvanized. One flat colour each; timber's figure stays timber's.
import { hexRgb } from './timber.js';

export const STEEL_FINISHES = Object.freeze({
  mill: [78, 83, 90], primer: [148, 62, 46], galvanized: [174, 180, 184], weathering: [126, 66, 40], stainless: [196, 200, 204],
});
export const CONCRETE_FINISHES = Object.freeze({
  grey: [178, 175, 168], white: [222, 219, 210], dark: [128, 126, 122], ochre: [196, 170, 128],
});
export const REBAR_FINISHES = Object.freeze({ black: [110, 72, 54], epoxy: [74, 122, 86], galvanized: [168, 174, 178] });

const TABLES = { steel: STEEL_FINISHES, concrete: CONCRETE_FINISHES, rebar: REBAR_FINISHES };
const DEFAULT = { steel: 'mill', concrete: 'grey', rebar: 'black' };

/** Why a finish is invalid for a material, or null. A name from its table or { paint: '#rrggbb' }. */
export function materialFinishError(material, finish) {
  if (finish === undefined) return null;
  const t = TABLES[material];
  if (typeof finish === 'string' && t[finish]) return null;
  if (finish && typeof finish === 'object' && Object.keys(finish).length === 1 && hexRgb(finish.paint)) return null;
  return `a ${material} finish is one of ${Object.keys(t).join(', ')}, or { paint: '#rrggbb' }`;
}

/** The flat colour [r, g, b] a steel, concrete or rebar part wears. */
export function materialRgb(material, finish) {
  if (finish && typeof finish === 'object' && finish.paint) return hexRgb(finish.paint);
  const t = TABLES[material];
  return (t[typeof finish === 'string' ? finish : DEFAULT[material]] || t[DEFAULT[material]]).slice();
}
