/**
 * THE LOOKS — kits that are not written by hand but composed (gameworld/tunnel-land.js): a look is a style card and its
 * swatches, made from the facets of a BASE kit it starts from, and it borrows from that base what it does not compose
 * (its craft rails, how it paints buildings, how it skins flora). A look is registered by the recipe that composes it,
 * under an id its content decides, so the same recipe always names the same look; registering the same id with other
 * content is refused. Every lookup that takes a kit id falls back here.
 *
 *   registerLook({ id, base, card, swatches, read? }) → the look
 *   lookOf(id)  → the look, or null
 */
const LOOKS = new Map();
const key = (v) => JSON.stringify(v);

export function registerLook(L) {
  if (!L || typeof L.id !== 'string' || !L.card || !L.swatches || typeof L.base !== 'string') throw new Error('looks: a look is { id, base, card, swatches }');
  const had = LOOKS.get(L.id);
  if (had) { if (key([had.base, had.card, had.swatches]) !== key([L.base, { ...L.card, id: L.id }, L.swatches])) throw new Error(`looks: '${L.id}' is another look already`); return had; }
  const look = Object.freeze({ id: L.id, base: L.base, read: L.read ?? '', card: Object.freeze({ ...L.card, id: L.id }), swatches: Object.freeze(L.swatches) });
  LOOKS.set(L.id, look);
  return look;
}
export const lookOf = (id) => LOOKS.get(id) ?? null;
/** A kit id's base: its own for a written kit, the look's base for a composed one. */
export const baseOf = (id) => LOOKS.get(id)?.base ?? id;
