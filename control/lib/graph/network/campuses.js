/**
 * THE CAMPUSES — a complex (network/complex.js) by its name: the buildings a kind of place is made of, where each stands
 * beside the others, the look each wears (two a passage joins never alike: a walled-core dungeon's `distinct`), and what
 * joins them (the network's section, and a link that names its own: a hospital's public passages and its service
 * tunnel). A new campus is a row here, not code; `complex: { campus }` builds it, a `network` beside it changing the
 * row's (its own buildings are `buildings`, not a campus).
 *
 *   hospital  the emergency department at the front, the ward block beside it, the theatres beyond; the plant behind the
 *             wards; patients walk a public passage from one to the next, the plant's service tunnel comes in under the wards
 *   base      the hangar on the flight line, the barracks beside it, the armoury beyond, the command behind the barracks
 *             (the core); bunker tunnels between them, hardened where they pass under a building
 *
 *   CAMPUSES, CAMPUS_IDS
 *   campusOf(id) → { buildings, network } (refused by name)
 *
 * Pure data.
 */
const L = (construction, palette) => ({ construction, palette });

export const CAMPUSES = Object.freeze({
  hospital: Object.freeze({
    reads: 'an emergency department, a ward block and the theatres joined by a public passage below grade, the plant\'s service tunnel under the wards',
    buildings: [
      { id: 'emergency', use: 'emergency', at: [0, 0], look: L('science', 'science') },
      { id: 'wards', use: 'ward-block', at: { beside: 'emergency', side: '+x' }, look: L('everyday', 'everyday') },
      { id: 'plant', use: 'plant', at: { beside: 'wards', side: '+y' }, look: L('utility', 'everyday') },
      { id: 'theatres', use: 'theatres', at: { beside: 'wards', side: '+x' }, look: L('science', 'everyday') },
    ],
    network: { section: 'passage', links: [['emergency', 'wards'], ['wards', 'theatres'], { between: ['wards', 'plant'], section: 'service' }] },
  }),
  base: Object.freeze({
    reads: 'a hangar, the barracks, the armoury and the command (the core) joined by bunker tunnels',
    buildings: [
      { id: 'hangar', use: 'hangar-bay', at: [0, 0], look: L('military', 'military') },
      { id: 'barracks', use: 'barracks', at: { beside: 'hangar', side: '-x' }, look: L('everyday', 'military') },
      { id: 'armoury', use: 'armoury', at: { beside: 'barracks', side: '-x' }, look: L('bunker', 'military') },
      { id: 'command', use: 'command', at: { beside: 'barracks', side: '+y' }, look: L('science', 'military') },
    ],
    network: { section: 'bunker', links: [['hangar', 'barracks'], ['barracks', 'armoury'], ['barracks', 'command']] },
  }),
});
export const CAMPUS_IDS = Object.freeze(Object.keys(CAMPUSES));

/** A campus's buildings and network, as a complex takes them (copies: a recipe may change its own). */
export function campusOf(id) {
  const C = CAMPUSES[id];
  if (!C) throw new Error(`complex: campus '${id}' is not a campus (${CAMPUS_IDS.join(', ')})`);
  return { buildings: C.buildings.map((b) => ({ ...b, at: Array.isArray(b.at) ? [...b.at] : { ...b.at }, look: { ...b.look } })), network: { section: C.network.section, links: C.network.links.map((l) => (Array.isArray(l) ? [...l] : { ...l, between: [...l.between] })) } };
}
