import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { SOUNDS, SOUND_IDS } from './roster.js';
import { familyCue } from './families.js';

// characterization pin: a family's output for given dials is a compatibility promise, as a kernel's is (a level that
// names `explosion` today hears the same blast tomorrow). Every roster row a family builds, its build hashed: a new row
// adds its line; a changed line is legitimate only when the step says that sound changes (say why beside it).
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

const PINS = {
  'explosion': '28a174d26a4d',
  'grenade-blast': 'e1725548113f',
  'big-explosion': '456154a2c3a6',
  'huge-explosion': '6479a63d19e3',
  'wreck-explosion': '39e445cdcc87',
  'metal-impact': 'd6d62726fec8',
  'stone-impact': '17e0d2c56fc4',
  'wood-impact': 'b5905916e233',
  'dirt-impact': '7bf169920351',
  'flesh-impact': '39e0812bffaf',
  'water-impact': '31034214dc24',
  'armor-hit': '6b70934960f0',
  'shield-hit': '3c3a7ad30409',
  'step-concrete': '818649682593',
  'step-metal': 'eff697365f68',
  'step-dirt': 'd8c4a58c17ad',
  'step-grass': 'e532cbf02159',
  'step-gravel': '9b0f59e72d40',
  'step-wood': '46ccccab195c',
  'step-snow': '52602f665277',
  'step-water': '72f41dee8414',
  'heavy-step': '57274c2b258a',
  'giant-step': 'b91a409cf64f',
  'blade-swing': '206ddb3f241e',
  'blade-hit': '607d1bfc49b6',
  'blade-clash': 'fd7c79d6f737',
  'energy-clash': '51baa0030cff',
  'block': '19728bc503c2',
  'blunt-swing': '7540803de853',
  'blunt-hit': '906e92950ed9',
  'punch': '7381b2fa2b09',
  'kick': '6b9780abcac9',
  'mag-out': '71188b705cf0',
  'mag-in': 'f72d07b4338b',
  'rack': 'f2a3c92ca265',
  'weapon-switch': '42fbe497a472',
  'dry-fire': 'c41857c10473',
  'bullet-flyby': 'f12799169973',
  'beam-flyby': 'c00f064e0a92',
  'rocket-flyby': '5397bc8f2579',
  'ricochet': '7fdab19129a3',
  'casing-drop': 'f8907dcb864d',
  'glass-break': 'c77844d50e27',
  'wood-break': '1c28702947e8',
  'stone-break': '00f23463cda1',
  'metal-tear': '71d7088f6e49',
  'collapse': 'a3aa1c63f52e',
  'fire-whoosh': 'df407c0027a0',
  'ice-crack': '770cbe561185',
  'lightning-strike': 'd1ace85f7c75',
  'water-splash': '8e7a481aa6af',
  'wind-gust': 'd13e4f12a1f0',
  'shield-up': '487216d7b10b',
  'shield-down': '725bec5be3df',
  'shield-break': '09ed122de6a4',
  'rocket-booster': '158612a9ea82',
  'ion-drive': 'b04246297d01',
  'car-engine': 'd7ba558abcc2',
  'motorbike-engine': '59c974d98996',
  'jet-engine': 'f16b3f41bf09',
  'prop-engine': 'f6e2860740de',
  'laser-beam': 'a3a580e45fe8',
  'plasma-beam': 'bebda8c62b26',
  'charge-hum': '436be84590fb',
  'fire-burning': 'c82454f24e39',
  'thruster-roar': '6a9a916a451a',
  'jump-servo': '64a1efcef8fe',
  'jump-launch': '13661074d3e5',
};

describe('the families\' builds, pinned', () => {
  it('every row a family builds is the build it was', () => {
    const now = Object.fromEntries(SOUND_IDS.filter((id) => SOUNDS[id].make).map((id) => [id, createHash('sha256').update(canon(familyCue(SOUNDS[id].make.family, SOUNDS[id].make.dials))).digest('hex').slice(0, 12)]));
    expect(now).toEqual(PINS);
  });
});
