/**
 * rail-shelf — primitives for locomotive transit: a train's cars solved from a brief and compiled to named surfaces, on
 * the vehicle ODM's pattern (car-designer/vehicle-odm.js). It starts at the front of a train: the cab car
 * (cab-odm.js the grammar, cab-surface.js the surface, cab-library.js the design cards), and the bogies under it
 * (bogie-odm.js, bogie-surface.js), the current collectors on its roof (panto-odm.js, panto-surface.js) and the
 * overhead line they reach (catenary.js), the cars behind it (car-odm.js, car-surface.js, their shell shared with the
 * cab's in body-shell.js) and the train they make coupled (consist.js); their shared geometry and finish rail-geom.js.
 */
export { solveCabDesign, halfWidthAt, frontAt, frontNormal, CAB_ARCHETYPES, CAB_KINDS, CAB_LIMITS, CAB_GAUGE, CAB_PANTOGRAPH_ZONE, CAB_GRAMMAR_VERSION } from './cab-odm.js';
export { compileCabSurface, finishRailFaces, railMaterial, CAB_LODS, CAB_LIVERIES, RAIL_MATERIALS } from './cab-surface.js';
export { CAB_LIBRARY, composeCab } from './cab-library.js';
export { solveBogieDesign, axlesOf, BOGIE_ARCHETYPES, BOGIE_KINDS, BOGIE_LIMITS, WHEEL_PROFILE, BOGIE_GRAMMAR_VERSION } from './bogie-odm.js';
export { compileBogieSurface, BOGIE_LODS } from './bogie-surface.js';
export { solvePantoDesign, pantoPose, PANTO_ARCHETYPES, PANTO_KINDS, PANTO_LIMITS, PANTO_GRAMMAR_VERSION } from './panto-odm.js';
export { compilePantoSurface, PANTO_LODS } from './panto-surface.js';
export { compileCatenary, wireAt } from './catenary.js';
export { solveCarDesign, CAR_ARCHETYPES, CAR_KINDS, CAR_LIMITS, CAR_GRAMMAR_VERSION } from './car-odm.js';
export { compileCarSurface, CAR_LODS, END_DEPTH } from './car-surface.js';
export { composeTrain, planTrain, TRAIN_PLANS } from './consist.js';
