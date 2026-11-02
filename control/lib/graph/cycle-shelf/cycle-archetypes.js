/**
 * cycle-shelf/cycle-archetypes — the whole machines of the cycle shelf: the vehicles a rider sits astride and steers by
 * a bar (motorcycles, scooters and mopeds, bicycles and e-bikes, the ATV) and the three-wheelers a base machine becomes
 * with its add-ons (a sidecar, a trike axle, a cab, a carriage, a cargo box). The craft shelf's architecture on a shelf
 * of its own: a kind of part is a builder, a part is a row, a machine is a layout of parts on anchors, a look is a card.
 *
 * The vehicle registry's `cycle` handle (vehicle-registry/roster.js) names a key of this table; each key is claimed by
 * exactly one row (roster.test.js). Empty until the shelf's first machine is built: a new machine is a registry row
 * first, its archetype here after it.
 *
 * Pure data: no clock, no dice.
 */

export const CYCLE_ARCHETYPES = Object.freeze({});
