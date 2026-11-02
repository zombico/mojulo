import { describe, it, expect } from 'vitest';
import { vehicleTierOf, stampedTier } from './tier.js';
import { rideOf, rideableRows, rideRowOf, rideClassOf, loftCamera, rideLivery, rideWear, settingLivery } from './ride.js';
import { MILITARY_CLASSES } from '../car-designer/road-military.js';
import { CAMO_IDS, camoForSetting } from '../car-designer/livery-cut.js';
import { VEHICLES, handlesOf, rowOfHandle } from './roster.js';
import { buildsOf } from './builds.js';
import { RIDES } from '../gameworld/ride.js';
import { quickWorld, readQuick } from '../gameworld/quick.js';
import { quickVehicleWords } from './doors.js';
import { GAME_BODY_NAMES, gameBody } from '../gameworld/game-bodies.js';

// rows chosen in code: an assembled ride whose row also has a realistic loft, and a row with only the loft
const ids = Object.keys(VEHICLES);
const both = Object.keys(RIDES).find((k) => buildsOf(rowOfHandle('ride', k)).some((b) => b.via === 'loft'));
const loftOnly = rideableRows().find((id) => !handlesOf(id).ride);
const notDrivable = ids.find((id) => !rideableRows().includes(id) && !handlesOf(id).ride);

describe('the tier read: what the game says, first that speaks', () => {
  it('reads each signal, in order', () => {
    expect(vehicleTierOf({ quick: { tier: 'toy' }, juice: { fidelity: 'form' } })).toMatchObject({ tier: 'toy', from: 'operator' });
    expect(vehicleTierOf({ quick: { hero: { form: 'realistic' } }, juice: { fidelity: 'voxel' } })).toMatchObject({ tier: 'realistic', from: 'hero' });
    expect(vehicleTierOf({ quick: {} }, { heroSpec: { form: 'realistic' } })).toMatchObject({ tier: 'realistic', from: 'hero' });
    expect(vehicleTierOf({ characters: { hero: { form: 'realistic' } } }).from).toBe('hero');
    // the people's body rail: one rail that lays the realistic body and one that does not, found in code
    const realRail = GAME_BODY_NAMES.find((r) => gameBody(r, 'hero').spec.form === 'realistic'), otherRail = GAME_BODY_NAMES.find((r) => gameBody(r, 'hero').spec.form !== 'realistic');
    expect(vehicleTierOf({ quick: { body: realRail } })).toMatchObject({ tier: 'realistic', from: 'body' });
    expect(vehicleTierOf({ quick: { body: otherRail } }).from).not.toBe('body');
    expect(vehicleTierOf({ characters: { direction: { body: realRail } } }).from).toBe('body');
    expect(vehicleTierOf({ juice: { fidelity: 'form' } })).toMatchObject({ tier: 'realistic', from: 'juice' });
    expect(vehicleTierOf({ juice: { fidelity: 'voxel' } })).toMatchObject({ tier: 'toy', from: 'juice' });
    expect(vehicleTierOf({ quick: { pole: 'realistic' } })).toMatchObject({ tier: 'realistic', from: 'pole' });
    expect(vehicleTierOf({ quick: { pole: 0.9 } }).from).toBe('default');
    expect(vehicleTierOf({ style: { kit: { pole: 'voxel' } } })).toMatchObject({ tier: 'toy', from: 'kit' });
    expect(vehicleTierOf({ quick: { racers: 4 } })).toMatchObject({ tier: 'toy', from: 'racers' });
    expect(vehicleTierOf({})).toMatchObject({ tier: 'stylised', from: 'default' });
  });
  it('refuses a tier it does not have', () => {
    expect(() => vehicleTierOf({ quick: { tier: 'photoreal' } })).toThrow(/toy, stylised, realistic/);
  });
  it('stamps only what is not the default, and never over the operator\'s word', () => {
    expect(stampedTier({})).toBe(null);
    expect(stampedTier({ juice: { fidelity: 'form' } })).toBe('realistic');
    expect(stampedTier({ quick: { tier: 'stylised' }, juice: { fidelity: 'form' } })).toBe(null);
  });
});

describe('the ride: its row\'s build at the game\'s tier', () => {
  it('drives an assembled ride at the stylised tier, as it always did', () => {
    expect(rideOf({ ride: both })).toMatchObject({ kind: 'assembly', ride: both, tier: 'stylised' });
  });
  it('drives the same row\'s realistic loft at the realistic tier, on its class', () => {
    const r = rideOf({ ride: both, tier: 'realistic' });
    expect(r).toMatchObject({ kind: 'loft', tier: 'realistic', id: rowOfHandle('ride', both) });
    expect(handlesOf(r.id).physics).toContain(r.class);
  });
  it('drives a row with only a loft at any tier, saying it fell', () => {
    const r = rideOf({ ride: loftOnly });
    expect(r).toMatchObject({ kind: 'loft', id: loftOnly, tier: 'realistic' });
    expect(r.fell).toMatch(/no stylised build yet/);
  });
  it('refuses a row nothing can drive, naming the rows that can', () => {
    expect(rideRowOf(notDrivable)).toBe(null);
    expect(() => rideOf({ ride: notDrivable })).toThrow(/a vehicle the registry can drive/);
  });
  it('reads the class a ride\'s tuning plays, and chases a long vehicle farther', () => {
    expect(rideClassOf(loftOnly)).toBe(handlesOf(loftOnly).physics[0]);
    expect(loftCamera({ L: 12, H: 3.2 }).dist).toBeGreaterThan(loftCamera({ L: 4.5, H: 1.4 }).dist);
  });
});

describe('a quick world: the ride\'s words and its tier, written at mint', () => {
  const world = (quick, extra = {}) => quickWorld({ id: 'w', quick, ...extra });
  it('writes a row it can drive by its id, and keeps a legacy ride key as it was', () => {
    expect(quickVehicleWords({ goal: 'reach', ride: VEHICLES[loftOnly].label }).quick.ride).toBe(loftOnly);
    expect(world({ goal: 'reach', ride: both }).quick).toEqual({ goal: 'reach', ride: both });
  });
  it('stamps the tier the game reads when it is not the default', () => {
    expect(world({ goal: 'reach', ride: both }, { juice: { fidelity: 'form' } }).quick.tier).toBe('realistic');
    expect(world({ goal: 'reach', ride: both, tier: 'stylised' }, { juice: { fidelity: 'form' } }).quick.tier).toBe('stylised');
  });
  it('takes a tier only with a ride', () => {
    expect(() => readQuick({ goal: 'reach', tier: 'realistic' })).toThrow(/name a ride/);
    expect(() => readQuick({ goal: 'reach', ride: both, tier: 'photoreal' })).toThrow(/toy, stylised, realistic/);
  });
});

describe('a field vehicle\'s livery: the operator\'s word, or its setting\'s camo stamped at mint', () => {
  const field = rideableRows().find((id) => (handlesOf(id).physics ?? []).some((k) => MILITARY_CLASSES[k]));
  const world = (quick, style) => quickWorld({ id: 'w', quick, ...(style ? { style } : {}) });
  const kit = 'jungle-trail', camo = camoForSetting({ kit });
  it('stamps the setting\'s camo on a field vehicle a new world drives, and nothing where the setting says none', () => {
    expect(CAMO_IDS).toContain(camo);
    expect(settingLivery({ ride: field }, { style: { kit } })).toBe(camo);
    expect(world({ goal: 'reach', ride: field }, { kit }).quick.livery).toBe(camo);
    expect(world({ goal: 'reach', ride: field }).quick.livery).toBeUndefined();
    expect(world({ goal: 'reach', ride: both }, { kit }).quick.livery).toBeUndefined();
  });
  it('keeps the operator\'s word over the setting\'s, and refuses a livery a ride\'s build does not take', () => {
    const own = { pattern: CAMO_IDS.find((c) => c !== camo), marks: false };
    expect(world({ goal: 'reach', ride: field, livery: own }, { kit }).quick.livery).toEqual(own);
    expect(rideLivery({ ride: field, livery: own })).toMatchObject({ pattern: own.pattern, marks: false });
    expect(() => readQuick({ goal: 'reach', ride: both, livery: camo })).toThrow(/paints a field vehicle/);
    expect(() => readQuick({ goal: 'reach', livery: camo })).toThrow(/name a ride/);
  });
  it('takes a field vehicle\'s wear beside it, and refuses one on a ride its words do not weather', () => {
    expect(rideWear({ ride: field, wear: 'battered' })).toMatchObject({ level: 'battered' });
    expect(world({ goal: 'reach', ride: field, wear: 'pristine' }).quick.wear).toBe('pristine');
    expect(() => readQuick({ goal: 'reach', ride: both, wear: 'used' })).toThrow(/weathers a field vehicle/);
    expect(() => readQuick({ goal: 'reach', ride: field, wear: 'filthy' })).toThrow(/no level/);
  });
});
