/**
 * rocket-archetypes — the launch vehicles the shelf's launch parts build (rocket-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES, in their own realm (`launch`) and
 * their own roles (ROCKET_ROLES: a launcher lifts a payload, a crew launcher a crew). Each is laid out along its own +y
 * from its first stage's tail and stood on its tail (`stand: 'vertical'`): its reference is its figures on the pad, its
 * height the stack's, its span and its length the widest it stands across (its boosters, its wings, its flaps). The
 * winged orbiter alone (`orbiter`) stands on its gear as an aircraft does.
 *
 * A row is a class, not a type, and wears no agency's or company's markings: a reusable medium launcher's class, the
 * same carrying a crew capsule, a three-core heavy, a stainless super-heavy and its ship, a winged orbiter's stack on its
 * tank and its boosters, a heavy-lift crew rocket and its abort tower.
 */

export const ROCKET_ROLES = Object.freeze({
  launcher: Object.freeze({ label: 'launcher', mission: 'lift a payload from the pad to orbit', realms: Object.freeze(['launch']) }),
  crew: Object.freeze({ label: 'crew launcher', mission: 'carry a crew to orbit and bring them home', realms: Object.freeze(['launch']) }),
});

const UP = 'vertical';
export const ROCKET_ARCHETYPES = {
  mediumLauncher: {
    realm: 'launch', role: 'launcher', stand: UP, palette: 'launchWhite', class: 'medium launcher', label: 'reusable two-stage medium launcher', classOf: 'reusable medium launcher class (3.66 m, 549 t)',
    reference: { span: 5.2, length: 5.2, height: 69.0, mtow: 549000 },
    bom: { 'rocket-stage': 2, 'rocket-engine': 1, 'rocket-fins': 1, 'rocket-legs': 1, 'rocket-fairing': 1 },
    layout: [
      { id: 'stage1', sku: 'stage-medium-1' },
      { id: 'engines', sku: 'eng-octaweb-9', at: 'stage1.engines' },
      { id: 'fins', sku: 'gridfins-medium', at: 'stage1.fins' },
      { id: 'legs', sku: 'legs-medium', at: 'stage1.legs' },
      { id: 'stage2', sku: 'stage-medium-2', at: 'stage1.top' },
      { id: 'fairing', sku: 'fairing-medium', at: 'stage2.top' },
    ],
  },
  crewLauncher: {
    realm: 'launch', role: 'crew', stand: UP, palette: 'launchWhite', class: 'crew launcher', label: 'reusable medium launcher and crew capsule', classOf: 'reusable medium launcher with a four-seat crew capsule (3.66 m)',
    reference: { span: 4.3, length: 4.3, height: 64.0, mtow: 549000 },
    bom: { 'rocket-stage': 2, 'rocket-engine': 1, 'rocket-fins': 1, 'rocket-legs': 1, 'rocket-capsule': 1 },
    layout: [
      { id: 'stage1', sku: 'stage-medium-1' },
      { id: 'engines', sku: 'eng-octaweb-9', at: 'stage1.engines' },
      { id: 'fins', sku: 'gridfins-medium', at: 'stage1.fins' },
      { id: 'legs', sku: 'legs-medium', at: 'stage1.legs' },
      { id: 'stage2', sku: 'stage-medium-2', at: 'stage1.top' },
      { id: 'capsule', sku: 'capsule-crew', at: 'stage2.top' },
    ],
  },
  heavyLauncher: {
    realm: 'launch', role: 'launcher', stand: UP, palette: 'launchWhite', class: 'heavy launcher', label: 'three-core heavy launcher', classOf: 'three-core reusable heavy launcher class (12.2 m across, 1420 t)',
    reference: { span: 12.4, length: 5.2, height: 69.0, mtow: 1420000 },
    bom: { 'rocket-stage': 4, 'rocket-engine': 3, 'rocket-fins': 3, 'rocket-legs': 3, 'rocket-fairing': 1 },
    layout: [
      { id: 'core', sku: 'stage-medium-centre' },
      { id: 'engines', sku: 'eng-octaweb-9', at: 'core.engines' },
      { id: 'fins', sku: 'gridfins-medium', at: 'core.fins' },
      { id: 'legs', sku: 'legs-medium', at: 'core.legs' },
      { id: 'side', sku: 'stage-medium-side', at: 'core.side', pair: true },
      { id: 'sideEngines', sku: 'eng-octaweb-9', at: 'side.engines', pair: true },
      { id: 'sideFins', sku: 'gridfins-medium', at: 'side.fins', pair: true },
      { id: 'sideLegs', sku: 'legs-medium', at: 'side.legs', pair: true },
      { id: 'stage2', sku: 'stage-medium-2', at: 'core.top' },
      { id: 'fairing', sku: 'fairing-medium', at: 'stage2.top' },
    ],
  },
  superHeavy: {
    realm: 'launch', role: 'launcher', stand: UP, palette: 'stainlessSteel', class: 'super-heavy launcher', label: 'stainless super-heavy booster and ship', classOf: 'fully reusable super-heavy class (9 m, 5000 t)',
    reference: { span: 17.0, length: 9.9, height: 122.0, mtow: 5000000 },
    bom: { 'rocket-stage': 2, 'rocket-engine': 2, 'rocket-fins': 3 },
    layout: [
      { id: 'booster', sku: 'stage-super-booster' },
      { id: 'engines', sku: 'eng-raptor-33', at: 'booster.engines' },
      { id: 'fins', sku: 'gridfins-super', at: 'booster.fins' },
      { id: 'ship', sku: 'stage-super-ship', at: 'booster.top' },
      { id: 'shipEngines', sku: 'eng-raptor-6', at: 'ship.engines' },
      { id: 'flapsFore', sku: 'flaps-ship-fore', at: 'ship.flapsFore' },
      { id: 'flapsAft', sku: 'flaps-ship-aft', at: 'ship.flapsAft' },
    ],
  },
  shuttleStack: {
    realm: 'launch', role: 'crew', stand: UP, palette: 'orbiterWhite', class: 'winged orbiter stack', label: 'winged orbiter on its external tank and boosters', classOf: 'winged reusable orbiter stack class (56 m, 2030 t)',
    reference: { span: 23.8, length: 25.0, height: 56.1, mtow: 2030000 },
    bom: { 'rocket-stage': 1, 'rocket-booster': 2, 'rocket-orbiter': 1 },
    layout: [
      { id: 'tank', sku: 'stage-external-tank' },
      { id: 'srb', sku: 'srb-four', at: 'tank.side', pair: true },
      { id: 'orbiter', sku: 'orbiter-stacked', at: 'tank.orbiter', roll: 180 },
    ],
  },
  orbiter: {
    realm: 'launch', role: 'crew', palette: 'orbiterWhite', class: 'winged orbiter', label: 'winged orbiter on its gear', classOf: 'winged reusable orbiter class (37 m, double delta)',
    reference: { span: 23.8, length: 37.24, height: 17.25, mtow: 110000 },
    bom: { 'rocket-orbiter': 1 },
    layout: [{ id: 'orbiter', sku: 'orbiter-winged' }],
  },
  crewHeavy: {
    realm: 'launch', role: 'crew', stand: UP, palette: 'launchWhite', class: 'heavy-lift crew rocket', label: 'heavy-lift crew rocket and its abort tower', classOf: 'heavy-lift crew rocket class (98 m, 2600 t)',
    reference: { span: 18.0, length: 8.8, height: 98.0, mtow: 2600000 },
    bom: { 'rocket-stage': 2, 'rocket-engine': 1, 'rocket-booster': 2, 'rocket-capsule': 1 },
    layout: [
      { id: 'core', sku: 'stage-heavy-core' },
      { id: 'engines', sku: 'eng-core-4', at: 'core.engines' },
      { id: 'srb', sku: 'srb-five', at: 'core.side', pair: true },
      { id: 'upper', sku: 'stage-heavy-upper', at: 'core.top' },
      { id: 'capsule', sku: 'capsule-deep', at: 'upper.top' },
    ],
  },
};
