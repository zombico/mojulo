// The surfaces a track's bands are laid in (track.js draws them, surface.js reads them under a tyre).
/** The surfaces a band is laid in: their tile, and what a tyre finds there (surface.js): `mu`, the share of the tyre's
 *  dry-asphalt grip; `roll`, its rolling resistance over asphalt's. [E]: gravel and grass about 0.55–0.7 of asphalt's
 *  grip and several times its rolling, sand the least grip and the most drag. */
export const SURFACES = Object.freeze({
  asphalt: Object.freeze({ texture: 'asphalt-aged', hex: '#c4c6c8', mu: 1, roll: 1 }),
  kerb: Object.freeze({ mu: 0.95, roll: 1.3 }),
  gravel: Object.freeze({ texture: 'soil-gravel', hex: '#e2ddd2', mu: 0.65, roll: 3.5 }),
  grass: Object.freeze({ texture: 'grass-dry', hex: '#e9e6d6', mu: 0.55, roll: 4 }),
  dirt: Object.freeze({ texture: 'soil-dirt', hex: '#e6e0d4', mu: 0.7, roll: 2.5 }),
  sand: Object.freeze({ texture: 'soil-sand', hex: '#ebe6da', mu: 0.5, roll: 8 }),
});
