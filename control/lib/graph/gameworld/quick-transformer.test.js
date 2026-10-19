// A quick game's hero that TRANSFORMS (more than meets). The concepts: the block read and refused (which goals a car
// and a flier play, nothing beside the hero); the robot's rule and camera scaled to its height; a car lowered as one
// body with two forms on a trail; a flier seated in the air in its vehicle form; the cube's hero.
import { describe, it, expect } from 'vitest';
import { readQuick, quickWorld, quickTransformer, goalMechanics } from './quick.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { cubeOfWorld } from './intent.js';

const car = { vehicle: { supercar: { preset: 'razor' } } };
const suit = { robot: { variable: { palette: 'federal' } } };
const order = (q) => {
  const W = quickWorld({ id: 'w', quick: q }), G = readGameworld(W), s = gameStages(W)[0];
  return stageLevelOrder(G, s, { ref: 'x', goal: (ends) => goalMechanics(q, ends), ride: quickTransformer(q) }).args.manifest;
};

describe('a quick hero that transforms', () => {
  it('is read: a car plays a trail, a flier the fly goal, and nothing stands beside it', () => {
    expect(() => readQuick({ goal: 'reach', transformer: car })).not.toThrow();
    expect(() => readQuick({ goal: 'fly', transformer: suit })).not.toThrow();
    expect(() => readQuick({ goal: 'fly', transformer: car })).toThrow(/car's goals are reach/);
    expect(() => readQuick({ goal: 'reach', transformer: suit })).toThrow(/flier's goals are fly/);
    expect(() => readQuick({ goal: 'reach', transformer: car, ride: 'car' })).toThrow(/no ride beside it/);
    expect(() => readQuick({ goal: 'fly', transformer: { robot: { variable: { palette: 'mauve' } } } })).toThrow(/palette is one of/);
    expect(() => readQuick({ goal: 'reach', transformer: { vehicle: { boat: {} } } })).toThrow(/vehicle one of/);
    // its ways: a car's and a craft's schemes, a fuselage fold's dials, a jetski on a trail
    expect(() => readQuick({ goal: 'reach', transformer: { ...car, scheme: 'rear-foot' } })).not.toThrow();
    expect(() => readQuick({ goal: 'reach', transformer: { ...car, scheme: 'fuselage-fold' } })).toThrow(/a car transforms as car-bot or rear-foot/);
    expect(() => readQuick({ goal: 'fly', transformer: { vehicle: { craft: 'jetFighter' }, scheme: 'fuselage-fold', fold: 'back', legs: 'box' } })).not.toThrow();
    expect(() => readQuick({ goal: 'fly', transformer: { vehicle: { craft: 'jetFighter' }, legs: 'box' } })).toThrow(/fuselage fold's/);
    expect(() => readQuick({ goal: 'reach', transformer: { robot: { alien: { palette: 'void' } } } })).not.toThrow();
    expect(() => readQuick({ goal: 'fly', transformer: { robot: { alien: {} } } })).toThrow(/jetski's goals are reach/);
    expect(() => readQuick({ goal: 'reach', transformer: { robot: { alien: {} }, scheme: 'rear-foot' } })).toThrow(/folds its own way/);
  });

  it('scales the robot to its height, and gives a car its drive', () => {
    const small = quickTransformer({ goal: 'reach', transformer: { ...car, height: 4 } });
    const big = quickTransformer({ goal: 'reach', transformer: { ...car, height: 16 } });
    expect(big.forms.robot.rule.speed).toBeGreaterThan(small.forms.robot.rule.speed);
    expect(big.forms.robot.camera.dist).toBeGreaterThan(small.forms.robot.camera.dist);
    expect(small.forms.vehicle.rule.type).toBe('drive');
    expect(quickTransformer({ goal: 'fly', transformer: suit }).forms.vehicle).toBeUndefined();   // a flier's is the seat's
  });

  it('lowers a car-bot on a trail as one body with two forms', () => {
    const q = { goal: 'reach', transformer: car }, m = order(q);
    const hero = m.entities.find((e) => e.id === 'hero');
    expect(Object.keys(hero.forms)).toEqual(['robot', 'vehicle']);
    expect(hero.forms.robot.rule.type).toBe('platform');
    expect(hero.body).toEqual({ type: 'figure-rig', figure: 'ride' });
    expect(m.figures.ride.transformer.vehicle).toEqual(car.vehicle);
    expect(m.camera.target).toBe('hero');
  });

  it('seats a flier in the air in its vehicle form, on the airspace seat\'s rule', () => {
    const q = { goal: 'fly', transformer: suit }, m = order(q);
    const p = m.entities.find((e) => e.id === 'player');
    expect(p.form).toBe('vehicle');
    expect(p.forms.vehicle.rule.type).toBe('fly');
    expect(p.forms.robot.rule.type).toBe('platform');
    expect(m.figures.ride.transformer.robot).toEqual(suit.robot);
    expect(quickWorld({ id: 'w', quick: q }).levels.run.airspace.map.craft).toBe('jet');
  });

  it('is a transformer hero in the game\'s cube', () => {
    const { cube } = cubeOfWorld(quickWorld({ id: 'w', quick: { goal: 'reach', transformer: car } }));
    expect(cube.soul.hero).toBe('transformer');
  });
});
