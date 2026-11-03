/**
 * craft shelf characterization net: one hash per builder path (a part chosen from the inventory in code, as the
 * concept tests choose it) and one whole assembled craft. An inventory row is a part number: a craft minted from
 * it regenerates on every read, so its recipe is a compatibility promise over minted rows. The pins hash the
 * emitted RECIPE (the workbench lowerers under it have their own pins). Re-pin ONLY alongside a change that says
 * a part's emission changes, and log it here.
 *
 * Log:
 *   - Fidelity pass (unreleased, so folded in): sections at 24 points, wing planforms and folds, flat-paneled
 *     space hulls, canopies and foils; every pin re-pinned, new builder paths pinned.
 *   - Detail pass (unreleased, folded in): material finishes by colour role, control surfaces cut out and
 *     hinged, gear and canopy joints, panel seams, cabin windows and doors, greebles, fan blades, nav
 *     lights, straight cabin barrels; every pin re-pinned.
 *   - The drone parts joined the shelf (drone-odm.js): their builder paths pinned; no existing pin moved.
 *   - The multirotor family (unreleased, folded in): new builder paths pinned; the camera gimbal's glass given a real
 *     thickness (it rounded to nothing on a bigger gimbal), the probe's vent its cowl, and every straight drone lathe
 *     two cross-sections (a straight profile needs no more; an X8 cost 56k triangles), so the drone pins re-pinned.
 *   - The drone looks: the EO/IR ball's builder path pinned; no other pin moved.
 *   - The boat parts joined the shelf (boat-odm.js): their builder paths pinned; no existing pin moved. The centre
 *     console's (the remote outboard, the console, the seat) pinned when they joined, and the T-top's; no existing pin moved.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CRAFT_ODM, assembleCraft, resolveCraftPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const PINS = {
  'fus-light-single': 'dced859864dd9c76',
  'wing-light-high': '6ac126dc574bf08d',
  'stab-light': '5835abd4ba6f28f3',
  'fin-light': '07a2f96cf435b3c6',
  'eng-piston-flat4': 'a4af2c7e596312f3',
  'eng-piston-v12': '65d0a25420b636c2',
  'eng-turboprop': '2d34c6f2cb26e2c9',
  'eng-turbofan-small': '98e5ab752e6c9f24',
  'eng-turbofan-afterburning': '24a7fe4bd7277f35',
  'prop-2-fixed': '8b4540797427877d',
  'gear-spring-light': '5320d4723666bc03',
  'gear-nose-light': '9130d9f0de2e5c83',
  'gear-bogie-widebody': 'a306218950f4c7cd',
  'canopy-bubble-warbird': '5f1829c9ae1e4ca5',
  'pylon-underwing-narrowbody': '71f9ed62c9e134c1',
  'pylon-aft-stub': '472cb6cda58bd691',
  'gun-rotary-20': '3cfd993450b19374',
  'gun-heavy-mg': 'fbb61e17dfdbe26c',
  'missile-aam-short': '6ab675084c8b4c34',
  'hull-snub-wedge': 'e7c202776be23c6e',
  'hull-ball-pod': '17e27a3caa5a842f',
  'panel-hex': '021cc4d838bff8d5',
  'drive-pod-light': 'cdf5a8a809321950',
  'drive-ion-twin': '80d1a6900d8e8422',
  'drive-bell-main': '2ea525e3275cff68',
  'drive-nacelle-long': 'bbdbbe5ac74a130a',
  'rcs-quad': '4c9fd5db2154f136',
  'strut-light': '3f0d8071e9632247',
  'arm-panel': 'e4489dc89e4decc7',
  'crossbar-nacelle': 'b872f763a5fc5639',
  'canopy-ball-window': 'e8b13b61b2920686',
  'launcher-torpedo': '485796c3a414e11c',
  'turret-ion-dorsal': '7cfd156fe66f8b26',
  'intake-half-cone': '3703cc7f2d7f4dc6',
  'intake-chin': '4f4aaee982b5285d',
  'intake-side-d': '3459babb4c86b684',
  'eng-radial-18': '304899c7427b23ad',
  // the drone parts (drone-parts.js): their builder paths pinned when they joined the shelf
  'frame-shell-camera': '38afd6e99918dcc5',
  'arm-fold-camera-front': '9aa99f9cd96cd86a',
  'motor-1806': '9e29b764e6244eb6',
  'rotor-2-9in-ccw': 'e6b7a71a1d7d5142',
  'guard-ring-9in': '932f635320a34275',
  'gimbal-3axis-camera': '9a132523b7a5b763',
  'mast-gps-puck': 'c9596da31b70579d',
  'frame-plate-fpv': 'ec3dc7444837a8d5',
  'arm-plate-fpv': 'afb79a00457bdbb1',
  'frame-box-enterprise': 'a4a86c41f2c051d6',
  'arm-tube-enterprise': '4a99373dc741aa02',
  'mast-paddle-enterprise': '86bb96701bc9aace',
  'gear-skid-enterprise': '29817727afbb18a4',
  'frame-hub-heavy': 'c4b9cc6b0b91b33b',
  'box-cargo-heavy': '5ef4ac3f289cc5bb',
  'lidar-puck': '6fe890cbfff115da',
  'sprayer-10l': '50775e8131dbb96d',
  'duct-15in': '00678fcf0fca31f7',
  'winch-parcel': 'd5eacb29acc38c56',
  'motor-vent-probe': 'e8d0ae806e057d3b',
  'eye-probe': '6e299153a70e5b86',
  'eoir-ball-small': 'a83be3ba6c538c86',
  // the boat parts (boat-parts.js): their builder paths pinned when they joined the shelf
  'hull-skiff-v14': '204500e874a8e297',
  'outboard-20-tiller': '7102b33c3fef79a4',
  'tank-portable-45l': '9567ccfb41323421',
  // the centre console's new builder paths: the remote outboard, the console, the cooler seat
  'outboard-90-remote': 'be1036d23afe511c',
  'console-cc-17': 'd153014a55fb989b',
  'seat-cooler-120': 'eb87cc30eb527062',
  // the T-top's builder path, pinned when it joined
  'top-t-cc-17': '7a337c0beca48ba5',
  'craft:lightSingle': 'cbbad5fe3c255c1d',
};

const PROCEDURES = (() => {
  const seen = new Map();
  for (const [sku, row] of Object.entries(CRAFT_ODM)) {
    const key = `${row.kind}/${row.build.family || (row.build.vertical ? 'vertical' : 'surface')}`;
    if (!seen.has(key)) seen.set(key, sku);
  }
  return [...seen.values()];
})();

describe('craft shelf emission pins', () => {
  it('pins exactly one part per builder path', () => {
    expect(Object.keys(PINS).filter((k) => k !== 'craft:lightSingle').sort()).toEqual([...PROCEDURES].sort());
  });

  it.each(PROCEDURES)('%s', (sku) => {
    expect(hash(resolveCraftPart(sku, { seat: 'mount' }))).toBe(PINS[sku]);
  });

  it('craft:lightSingle', () => {
    expect(hash(assembleCraft('lightSingle').manifest)).toBe(PINS['craft:lightSingle']);
  });
});
