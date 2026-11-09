/**
 * THE CAR SHELF — the personal and family cars a game puts on its roads, composed: a body style (car-bodies.js), a
 * design language (car-languages.js), a trim and its parts (car-trims.js) and a paint (car-paints.js) over a class's
 * true numbers (roads/vehicles.js), named configurations in a library of cards (car-library.js), built as a body
 * (car-body.js, car-parts.js) on its wheels (car-wheels.js) and compiled to the realistic loft's shape (car-figure.js).
 * The vehicle registry's rows name the cards (vehicle-registry/roster.js `car`); a loft's recipe carries one
 * ({ loft: { car } }).
 */
export { BODY_STYLES, BODY_STYLE_IDS, bodyStyle } from './car-bodies.js';
export { CAR_LANGUAGES, CAR_LANGUAGE_IDS, carLanguage } from './car-languages.js';
export { CAR_TRIMS, CAR_TRIM_IDS, PART_WORDS, PART_SLOTS, carTrim, readParts } from './car-trims.js';
export { CAR_PALETTES, PALETTE_IDS, PAINT_FINISHES, PAINT_SCHEMES, PAINT_NAMES, readPaint } from './car-paints.js';
export { CAR_CARDS, CAR_CARD_IDS, CAR_SPEC_KEYS, carClass, composeCar, readCarSpec } from './car-library.js';
export { carBody, bodyShape } from './car-body.js';
export { carWheel, CAR_WHEEL_STYLES } from './car-wheels.js';
export { compileCar, carMaterials, carCensus } from './car-figure.js';
