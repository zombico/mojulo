/**
 * The regions the historic cultures belong to, one row each: a label and the words people search with. A culture
 * card names its region (`region`); the entries list a region with more than one culture as a hub, and add the
 * region's words to each of its cultures' search lines.
 *
 * A new segment of the world (the Indus, Mesoamerica, medieval Europe, the steppe …) is a row here, before or
 * with its first culture. A culture naming a region with no row still gets its hub, under its id.
 *
 * A region may lie `within` a larger one (Franconia within the German lands within Europe). The ledger reads a
 * tradition's dates up that chain (../ledger/: a row's `spread` for the nearest region it names), so a way of
 * building can arrive in one land a century after another.
 */
export const REGIONS = {
  egypt: { label: 'Ancient Egypt', aliases: ['egypt', 'egyptian', 'pharaonic', 'nile', 'kemet', 'ancient egypt'] },
  greece: { label: 'The Hellenistic Greek world', aliases: ['greece', 'greek', 'hellenic', 'hellenistic', 'aegean', 'ancient greece'] },
  mesopotamia: { label: 'Mesopotamia', aliases: ['mesopotamia', 'mesopotamian', 'sumer', 'tigris', 'euphrates', 'iraq'] },
  china: { label: 'Ancient China', aliases: ['china', 'chinese', 'qin dynasty', 'wei river'] },
  italy: { label: 'Roman Italy', aliases: ['italy', 'roman', 'rome', 'ancient rome', 'roman empire', 'latin'] },
  europe: { label: 'Medieval and early modern Europe', aliases: ['europe', 'european', 'medieval', 'middle ages', 'early modern', 'renaissance'] },
  germany: { label: 'The German lands', within: 'europe', aliases: ['germany', 'german', 'holy roman empire', 'franconia', 'bavaria', 'swabia'] },
};

/** A region and the regions it lies within, nearest first: `['germany', 'europe']`. An unknown id is its own chain. */
export function regionChain(id) {
  const out = [];
  for (let r = id; r && !out.includes(r); r = REGIONS[r]?.within) out.push(r);
  return out;
}
