/**
 * HEADROOM — how high what is walked under stands over the walk, held to the base model: the body the hero is drawn
 * from (the body chart's default stature, polygonizer/body-chart.js; the pilot's, egocube/mascot-pilot.js).
 *
 *   BODY_HEIGHT    the base model's height (m)
 *   AWNING_CLEAR   the least height of an awning's lowest edge (its valance, its hem, its fascia, its lip) over the
 *                  ground walked under it (m): the base model and half a body again, so a shade clears every hero
 *   clearUnits(metresPerUnit)   AWNING_CLEAR in a world's own units (a city's 3.66 m unit)
 *
 * A builder that hangs an awning lifts it to this (or flattens it where its storey has no room for its drop); it never
 * lowers one that already clears. Pure data.
 */
export const BODY_HEIGHT = 1.7;
export const AWNING_CLEAR = 2.55; // BODY_HEIGHT × 1.5 (written out: no float noise in a kernel's bytes)
export const clearUnits = (metresPerUnit) => AWNING_CLEAR / metresPerUnit;
