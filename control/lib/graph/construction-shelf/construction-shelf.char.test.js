/**
 * construction shelf characterization net: one hash per builder path (a part chosen from the inventory in code, the
 * first of each kind and family), a ram's rod, and one whole assembled machine at its rest pose. An inventory row is a
 * part number and an archetype a machine: a machine minted from them regenerates on every read, so its recipe is a
 * compatibility promise over minted rows. The pins hash the emitted RECIPE (the workbench lowerers under it have their
 * own pins). Re-pin ONLY alongside a change that says a part's emission changes, and log it here.
 *
 * Log:
 *   - The shelf's first machine, the crawler excavator (unreleased): every builder path pinned.
 *   - The bulldozer (unreleased): its hull, its blade and its ripper pinned; the crawler's optional seat and trunnions
 *     moved no existing pin.
 *   - The wheel loader, the skid steer and the compact track loader (unreleased): the frames, the tyre, the arms, the
 *     bellcrank, the loader buckets and the rubber track pinned; the bucket's and the crawler's new families moved no
 *     existing pin.
 *   - The forklift, the telehandler, the mini excavator and the backhoe loader (unreleased): their chassis, the mast,
 *     the carriage, the boom's section, the mini's upper, the canopy, the swing post and frame, the stabiliser leg
 *     pinned. A part drawn at another size (the mini's and the backhoe's fronts) is its design's builder path, scaled,
 *     and is pinned through its machine. The crawler's inner trunnions and blade rams' bases, and a ram's allowances
 *     shrinking on a short one, moved no existing pin.
 *   - The tool swap and the wheeled excavator (unreleased): the breaker, the grapple, the auger, the forks, the sweeper
 *     and the wheeled chassis pinned, the wheeled excavator and one composed machine (the excavator with its breaker);
 *     a carrier's parts set where the first part it drops stood moved no existing pin.
 *   - The haulers (unreleased): the truck chassis, its cab, the tipper's body and its telescopic hoist (and a stage of it),
 *     the mixer's drum, the articulated dumper's front and rear frames and its rock body, the haul truck's frame and
 *     body pinned, and the four machines; a ram's lengths moving to the chain, and a telescopic ram's own lengths,
 *     moved no existing pin.
 *   - The lifters (unreleased): the crane carrier, its superstructure, the counterweight's slabs, the outrigger's beam
 *     and its jack, the hook block, the rope, and the tower crane's base, mast section, slewing unit, head, jib,
 *     counter-jib and trolley pinned, and the two cranes. The truck cab's bumper was a box of no length (its corners
 *     not numbers); drawn across the cab, it re-pins the cab and the tipper and the mixer that carry it. A crane
 *     boom's sheaves, an entry's turn, a plumb body and a rope moved no other pin.
 *   - The finishers (unreleased): the roller's frames and its drum, the grader's frames, its drawbar, its circle, its
 *     saddle and its moldboard pinned, and the two machines; the wheelbase read off a roller's drums moved no pin.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CON_ODM, assembleMachine, resolveConPart } from './index.js';

const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const PINS = {
  'crawler-ex20': '05f07d9590a13be7',
  'slew-ex20': '80f6f844b98806ce',
  'house-ex20': 'f0a8ac66f39a5d53',
  'cab-ex': 'c479457064ed6bb7',
  'cw-ex20': '12757e2786aa3a87',
  'boom-mono-57': '2c5d01e3e59f74c1',
  'stick-29': '2656c622c0d4b556',
  'bucket-dig-ex20': '733eb2d0a86adf3c',
  'link-dogbone-ex20': 'a766f837c2a4f264',
  'link-h-ex20': 'bac5ddc1526f19cc',
  'ram-boom-ex20': '9282f70628a24f5c',
  'hull-dz20': '32b46be169e5ed75',
  'blade-su-dz20': 'dbdf3d5863c186c2',
  'ripper-dz20': '74a4c3efe94db994',
  'frame-rear-wl15': '7404394c4e166221',
  'frame-front-wl15': '470ca22b5669ee3b',
  'wheel-otr-235': '8e80080646d5fcdf',
  'arms-zbar-wl15': '8665283c29968f54',
  'crank-zbar-wl15': '0731a3bd25aa6700',
  'bucket-gp-wl15': '5bc7a988579b7926',
  'chassis-ss33': '0364791569161e28',
  'arms-radial-ss33': '6251f97a9c1dc67d',
  'bucket-gp-ss18': '17051cc9ea2ac1b8',
  'crawler-ctl': 'd8e503c0089040ed',
  'chassis-fl25': 'd39f302e493be309',
  'mast-outer-33': '9d85d1f429fb271a',
  'carriage-fl25': '1668398384b10b3d',
  'chassis-th': 'a41735185dcf7f39',
  'boom-th-outer': '13478109b9922785',
  'breaker-ex20': 'fd42e709379cb029',
  'grapple-ex20': '150647a24884fbd6',
  'auger-ex20': 'e0f0448243d92f8d',
  'forks-ss18': 'd940f2fd1d034716',
  'sweeper-ss18': '1e29f298dc376497',
  'chassis-wex19': 'b9a7f80e27e6695b',
  'house-mini27': '8d1fd561a038cfd3',
  'canopy-mini': '6c60d8e59455e746',
  'post-mini27': '7d2d2fde3ce79eae',
  'chassis-bh85': 'fe937875cde41d60',
  'frame-bh85': 'c794a1a8971fc065',
  'leg-bh-r': '2590b3b373250198',
  'ram-boom-ex20.rod': 'ee3b8d6daeffb743',
  'chassis-tp84': '5ef327e645d4fcf4',
  'cab-truck': '70b8d695a80c9eb5',
  'body-tp84': '562109146c9d1405',
  'ram-tip-tp84': '224f1f5db0c9817e',
  'ram-tip-tp84.stage1': '6c5b68fe3747c1d6',
  'drum-mx8': 'a05deeec314ca9df',
  'adt-front30': '3382ebbc704da751',
  'adt-rear30': 'e35244614626b423',
  'body-adt30': '242e0cecaabe2cbe',
  'frame-haul100': 'd5165e9d72a554a3',
  'body-haul100': '8d27a33af6919a4f',
  'chassis-at60': 'b5bd1515a7a15cce',
  'house-at60': 'fcde7c9603fc3a06',
  'cw-at60': 'f4e64e45ec2b921e',
  'outrigger-at60': '07e05b66e7ab0ad2',
  'jack-at60': '7818278a906d219f',
  'hook-at60': '2b720ad960117574',
  'rope-at60': '26016b9ee20809a1',
  'base-tc': '350d1f38689db7e5',
  'mast-tc': 'a8f967e755b47923',
  'slew-tc': '1a9928d1238a5a6b',
  'head-tc': 'b5f19e37a0a7eb45',
  'jib-tc60': '691ff33937263397',
  'cjib-tc': '95802ec6e55e6e02',
  'trolley-tc': '3122a4fd64fa9265',
  'frame-rear-rl10': '0c48cc1d7c750bae',
  'frame-front-rl10': '7f8a565ce9aad4d4',
  'drum-rl10': 'e11650024f12dc1f',
  'frame-rear-gr17': '02b29f3985832cda',
  'frame-front-gr17': 'fc646ddc6b4071db',
  'drawbar-gr17': '6fff8f01afbad309',
  'circle-gr17': 'd1c502c023c8b70f',
  'saddle-gr17': 'ea452b75a100c835',
  'moldboard-gr17': '719f7ec4225e8360',
  'con:crawlerExcavator': '0eefeb9e723f41ef',
  'con:bulldozer': '94272ebad7ce55a9',
  'con:wheelLoader': '8850036d94e7ed84',
  'con:skidSteer': 'c501524697326176',
  'con:forklift': '57af123b17a85088',
  'con:telehandler': 'f928511393be0dff',
  'con:miniExcavator': 'f8d36541e6c4434b',
  'con:backhoeLoader': '3de6f9e6f20e0f31',
  'con:compactTrackLoader': 'c2f22ee973a96c2e',
  'con:wheeledExcavator': '8c317d51e544b82d',
  'con:tipperTruck': '42224024f1b525ce',
  'con:mixerTruck': 'ecdf9946381d54c0',
  'con:articulatedDumpTruck': '52a235b814da1955',
  'con:haulTruck': '70f1b6a62a583ed4',
  'con:mobileCrane': 'e6701022b17ca8f5',
  'con:towerCrane': '09060cd6a3c5622b',
  'con:roadRoller': 'bd00b2a14b44fae3',
  'con:motorGrader': '4c9676d53dd07840',
  'con:crawlerExcavator+breaker': '153954592e6736b8',
};

const PROCEDURES = (() => {
  const seen = new Map();
  for (const [sku, row] of Object.entries(CON_ODM)) {
    const key = `${row.kind}/${row.build.family}`;
    if (!seen.has(key)) seen.set(key, sku);
  }
  return [...seen.values()];
})();
const RAM = PROCEDURES.find((s) => CON_ODM[s].kind === 'con-ram');

describe('construction shelf emission pins', () => {
  it('pins exactly one part per builder path, a ram\'s rod and a telescopic ram\'s stage', () => {
    expect(Object.keys(PINS).filter((k) => !k.startsWith('con:') && !k.includes('.')).sort()).toEqual([...PROCEDURES].sort());
  });
  it.each(PROCEDURES)('%s', (sku) => {
    expect(hash(resolveConPart(sku))).toBe(PINS[sku]);
  });
  it('a ram\'s rod', () => {
    expect(hash(resolveConPart(RAM, { part: 'rod' }))).toBe(PINS[`${RAM}.rod`]);
  });
  it('a telescopic ram\'s stage', () => {
    // (the first ram of nested stages, a tipper's hoist)
    const ram = PROCEDURES.find((s) => CON_ODM[s].kind === 'con-ram' && (CON_ODM[s].dims.stages ?? 2) > 2);
    expect(hash(resolveConPart(ram, { part: 'stage1' }))).toBe(PINS[`${ram}.stage1`]);
  });
  it.each(Object.keys(PINS).filter((k) => k.startsWith('con:')))('%s', (k) => {
    // (a machine composed by the door: its archetype and its tool, 'crawlerExcavator+breaker')
    const [a, tool] = k.slice(4).split('+');
    expect(hash(assembleMachine(a, tool ? { tool } : {}).manifest)).toBe(PINS[k]);
  });
});
