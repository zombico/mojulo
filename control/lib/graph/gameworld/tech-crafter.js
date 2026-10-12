/**
 * THE TECHNOLOGY CRAFTER — what a civilization fields beside its buildings. The building tunnel (tunnel-buildings.js)
 * makes what it lives in, the technology tunnel (tunnel-tech.js) its machines; the crafter makes what it MOVES in,
 * what it RAISES to be seen and what it FIGHTS with:
 *
 *   vehicle     what carries its people and goods: wheeled, tracked, walkers, rail, hover, rotorcraft, winged craft,
 *               airships, ships, drawn carts; armoured, armed, carrying cargo, under sail or steam
 *   structure   its conspicuous tech-structures, the static works a level is read by: towers, gates and portals,
 *               spans, wind and water wheels, cooling stacks and furnace stacks, great dishes, barriers, launch gantries
 *   weapon      what it fights with: in the hand (blades, polearms, axes, bows, staves, guns, shields), crewed (cannon,
 *               siege engines, ballistae, launchers) and emplaced (turrets)
 *
 * One loop per kind, the tunnel's (gameworld/tunnel.js): an intent is read into a FORM (what it is: a walker, a gate,
 * a ballista, each with its variant), the FUNCTIONS it shows (era/blocks.js: a weapon strikes, a shield guards, a
 * gate lets you through) and MODIFIERS (how it looks doing it); a layout grammar per form lays a part for every read
 * at the kind's scale; the laws assess it (blockLaws, and for a structure `stands-out`: its signature reads from
 * across the level, at the far ring); a tweak thickens what was lost, leads what should lead, thins what is over
 * budget; the plan is a block the civilization's library keeps.
 *
 * Where each kind is judged: a vehicle at mid (it goes by); a structure at mid, and at far for standing out; a hand
 * weapon at arm's length (the `held` tier: a blade is a line at six metres); a crewed or emplaced weapon at near,
 * where it is met. A hand weapon a character can carry names its equipment class (`carries`: equipment.js).
 *
 *   CRAFT_KINDS                                   the kinds, each its read and its forms
 *   CRAFT_TRAITS                                  { vehicle, structure, weapon }: the traits, by the words that name them
 *   craftDomain(kind, { library })                → a tunnel domain
 *   craftTech(kind, intent, { seed, id, library }) → the tunnel's record; its plan { block, kind, form, variant, dials, carries? }
 *   craftKindOf(intent)                           → the kind whose form the words name first, or null
 *
 * Conceptual and visual only: a function is what the eye must find, never how it would work. Pure; seeded dice only.
 */
import { tunnel, readIntent } from './tunnel.js';
import { buildBlock, blockLaws, readBlock, FUNCTIONS, PRIMITIVES } from '../era/blocks.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';

const r2 = (v) => Math.round(v * 1000) / 1000;
const clone = (v) => JSON.parse(JSON.stringify(v));
/** A form trait (what it is, and which of its kind), a function trait, a modifier. */
const X = (form, variant, words, read, generic) => ({ form, variant, words, read, ...(generic ? { generic: true } : {}) });
const F = (fn, words, read) => ({ fn, words, read: read ?? FUNCTIONS[fn].read });
const M = (words, read, set) => ({ words, read, set });
const BARE = M(['bare', 'plain', 'sleek', 'clean', 'minimal', 'crude', 'makeshift', 'rough', 'primitive', 'scrap'], 'bare: little on it', { many: 0.15 });
const BUSY = M(['busy', 'detailed', 'greebled', 'worn', 'ornate', 'ceremonial', 'gilded', 'decorated', 'engraved'], 'busy: many small things on it', { many: 0.85 });

// ── the kinds ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const CRAFT_KINDS = Object.freeze({
  vehicle: { read: 'what carries its people and goods', judged: 'at mid: it goes by', forms: ['wheeled', 'tracked', 'walker', 'rail', 'hover', 'rotor', 'winged', 'airship', 'ship', 'drawn'] },
  structure: { read: 'its conspicuous tech-structures: the works a level is read by', judged: 'at mid, and its signature at far: it stands out', forms: ['tower', 'gate', 'portal', 'bridge', 'windmill', 'waterwheel', 'stack', 'dish', 'barrier', 'launch'] },
  weapon: { read: 'what it fights with, in the hand, crewed and emplaced', judged: 'in the hand at arm\'s length; crewed and emplaced at near, where it is met', forms: ['blade', 'polearm', 'axe', 'bow', 'staff', 'gun', 'shield', 'cannon', 'siege', 'ballista', 'launcher', 'turret'] },
});
export const CRAFT_KIND_IDS = Object.freeze(Object.keys(CRAFT_KINDS));

export const CRAFT_TRAITS = Object.freeze({
  vehicle: Object.freeze({
    car: X('wheeled', 'car', ['car', 'truck', 'jeep', 'van', 'bus', 'lorry', 'automobile', 'motorcar', 'wheeled', 'apc'], 'a body and its cab on wheels', true),
    tracked: X('tracked', 'tracked', ['tracked', 'tank', 'crawler', 'treads', 'halftrack', 'bulldozer'], 'a hull on a track pair'),
    walker: X('walker', 'walker', ['walker', 'mech', 'strider', 'legged', 'spider', 'stomper'], 'a body raised on jointed legs'),
    train: X('rail', 'train', ['train', 'locomotive', 'tram', 'railcar', 'monorail', 'rail', 'railway'], 'a long body on bogies, on its rails'),
    hover: X('hover', 'hover', ['hover', 'hovercraft', 'skimmer', 'hoverbike', 'speeder', 'grav', 'antigrav'], 'a body over its cushion skirt, fans behind'),
    rotor: X('rotor', 'rotor', ['helicopter', 'gyrocopter', 'rotorcraft', 'copter', 'gunship', 'chopper'], 'a cabin under a rotor, a tail boom, skids'),
    winged: X('winged', 'winged', ['plane', 'aircraft', 'airplane', 'aeroplane', 'glider', 'jet', 'fighter', 'biplane', 'ornithopter', 'flyer'], 'a fuselage and its wings, a tail, wheels under'),
    airship: X('airship', 'airship', ['airship', 'zeppelin', 'dirigible', 'balloon', 'blimp'], 'an envelope that lifts a gondola'),
    ship: X('ship', 'ship', ['ship', 'barge', 'galley', 'longship', 'frigate', 'galleon', 'junk', 'ferry', 'steamer', 'steamship', 'warship', 'sloop', 'schooner', 'clipper', 'dhow'], 'a hull on the water'),
    boat: X('ship', 'boat', ['boat', 'canoe', 'raft', 'dinghy', 'skiff', 'rowboat'], 'a small hull, rowed'),
    drawn: X('drawn', 'drawn', ['cart', 'wagon', 'chariot', 'carriage', 'coach', 'rickshaw', 'sledge', 'caravan'], 'a body on two wheels and the shafts it is drawn by'),
    sail: M(['sail', 'sails', 'sailing', 'frigate', 'galleon', 'sloop', 'schooner', 'clipper', 'junk', 'dhow', 'yacht'], 'under sail: a mast and its sail', { sail: true }),
    steam: M(['steam', 'steam-powered', 'coal', 'steamer', 'steamship', 'locomotive', 'diesel', 'smoke'], 'a stack: it burns to go', { stack: true }),
    armoured: M(['armoured', 'armored', 'armour', 'armor', 'plated', 'ironclad', 'tank', 'war', 'apc', 'battle'], 'armoured: plates hung on its sides', { armour: true }),
    armed: M(['armed', 'gun', 'guns', 'cannon', 'turret', 'tank', 'war', 'warship', 'gunship', 'fighter', 'battle', 'attack'], 'armed: a gun on a mount', { armed: true }),
    cargo: M(['cargo', 'freight', 'supply', 'hauling', 'goods', 'trade', 'merchant'], 'it carries goods: crates on it', { cargo: true }),
    heavy: M(['heavy', 'big', 'large', 'massive', 'great', 'giant'], 'heavy: a size up', { scale: 1.3 }),
    small: M(['small', 'light', 'scout', 'compact', 'personal', 'one-man', 'little'], 'small: a size down', { scale: 0.75 }),
    vessel: M(['huge', 'colossal', 'capital', 'flagship', 'land-train', 'mobile', 'fortress', 'mothership'], 'a vessel: building scale, and it goes', { tier: 'vessel' }),
    busy: BUSY, bare: BARE,
  }),
  structure: Object.freeze({
    tower: X('tower', 'tower', ['tower', 'spire', 'pylon', 'mast', 'obelisk', 'needle', 'column', 'lighthouse', 'watchtower', 'beacon-tower'], 'a shaft that rises, and what it carries at the top', true),
    gate: X('gate', 'gate', ['gate', 'gateway', 'arch', 'archway', 'gatehouse'], 'two piers and the lintel across them: the way through'),
    portal: X('portal', 'portal', ['portal', 'stargate', 'warpgate', 'ring', 'wormhole'], 'a ring stood on its base: the way through'),
    bridge: X('bridge', 'bridge', ['bridge', 'span', 'viaduct', 'causeway', 'overpass'], 'a deck on its piers'),
    aqueduct: X('bridge', 'aqueduct', ['aqueduct', 'canal', 'pipeline'], 'a deck on its piers, a channel along it'),
    windmill: X('windmill', 'windmill', ['windmill', 'windpump', 'wind-wheel'], 'a tower and its sails turned to the wind'),
    waterwheel: X('waterwheel', 'waterwheel', ['waterwheel', 'watermill', 'water-wheel', 'mill'], 'a house and its wheel in the race'),
    cooling: X('stack', 'cooling', ['reactor', 'cooling', 'cooling-tower', 'nuclear', 'powerplant'], 'a waisted stack beside its plant'),
    stacks: X('stack', 'stacks', ['furnace', 'forge', 'foundry', 'smokestack', 'chimney', 'kiln', 'smelter', 'stacks', 'refinery', 'works'], 'a works and its chimneys'),
    dish: X('dish', 'dish', ['telescope', 'observatory', 'array', 'antenna', 'dish', 'listening'], 'a great dish on its pedestal'),
    barrier: X('barrier', 'barrier', ['wall', 'barrier', 'fence', 'forcefield', 'palisade', 'rampart', 'shield-wall', 'cordon'], 'pylons and the plates or fields between them'),
    launch: X('launch', 'launch', ['launch', 'launchpad', 'gantry', 'spaceport', 'rocket', 'silo'], 'a pad, its gantry and the rocket stood beside it'),
    signal: F('signal', ['beacon', 'relay', 'signal', 'comms', 'transmitter', 'semaphore', 'heliograph']),
    light: F('light', ['lighthouse', 'light', 'lamp', 'searchlight', 'lantern', 'flare']),
    sense: F('sense', ['radar', 'scanner', 'sensor', 'lookout', 'observatory', 'telescope', 'watchtower']),
    strike: F('strike', ['gun', 'guns', 'cannon', 'turret', 'battery', 'defence', 'defense', 'artillery', 'laser'], 'a gun at the top: a barrel and its mount'),
    power: F('power', ['power', 'generator', 'solar', 'turbine', 'reactor', 'nuclear', 'powerplant', 'windmill', 'windpump', 'waterwheel', 'watermill', 'mill']),
    energy: M(['energy', 'force', 'forcefield', 'field', 'plasma', 'warp', 'stargate', 'warpgate', 'wormhole'], 'a field of light across its opening', { field: true }),
    lattice: M(['lattice', 'truss', 'girder', 'skeletal', 'steel', 'iron'], 'lattice: a frame, not a shell', { lattice: true }),
    tall: M(['tall', 'towering', 'soaring', 'high'], 'tall: half again', { tall: true }),
    colossal: M(['colossal', 'huge', 'giant', 'great', 'massive', 'vast', 'monumental'], 'colossal: a size up', { scale: 1.35 }),
    small: M(['small', 'little', 'minor', 'modest'], 'small: a size down', { scale: 0.75 }),
    busy: BUSY, bare: BARE,
  }),
  weapon: Object.freeze({
    sword: X('blade', 'sword', ['sword', 'blade', 'sabre', 'saber', 'katana', 'scimitar', 'cutlass', 'falchion', 'longsword', 'broadsword', 'rapier'], 'a blade on a hilt: its grip, its guard'),
    dagger: X('blade', 'dagger', ['dagger', 'knife', 'dirk', 'stiletto', 'machete', 'shortsword'], 'a short blade on a hilt'),
    greatsword: X('blade', 'greatsword', ['greatsword', 'claymore', 'zweihander', 'two-handed'], 'a long blade on a long hilt'),
    spear: X('polearm', 'spear', ['spear', 'pike', 'lance', 'javelin', 'polearm'], 'a point on a long shaft'),
    halberd: X('polearm', 'halberd', ['halberd', 'glaive', 'partisan', 'poleaxe', 'bardiche', 'naginata'], 'a blade and a point on a long shaft'),
    trident: X('polearm', 'trident', ['trident', 'fork'], 'three tines on a long shaft'),
    axe: X('axe', 'axe', ['axe', 'axes', 'hatchet', 'tomahawk', 'battleaxe'], 'a blade on a haft'),
    hammer: X('axe', 'hammer', ['hammer', 'warhammer', 'mace', 'maul', 'club', 'cudgel', 'flail'], 'a head on a haft'),
    bow: X('bow', 'bow', ['bow', 'bows', 'longbow', 'shortbow', 'recurve'], 'two limbs from a riser, strung'),
    crossbow: X('bow', 'crossbow', ['crossbow', 'arbalest'], 'a bow across a stock'),
    staff: X('staff', 'staff', ['staff', 'stave', 'wand', 'rod', 'sceptre', 'scepter'], 'a shaft and its head'),
    rifle: X('gun', 'rifle', ['rifle', 'rifles', 'musket', 'carbine', 'blaster', 'shotgun', 'arquebus', 'smg'], 'a barrel on a stock'),
    gun: X('gun', 'rifle', ['gun', 'guns', 'firearm', 'firearms'], 'a barrel on a stock', true),
    pistol: X('gun', 'pistol', ['pistol', 'pistols', 'revolver', 'handgun', 'sidearm', 'flintlock'], 'a short barrel on a grip'),
    shield: X('shield', 'shield', ['shield', 'pavise', 'kite', 'scutum'], 'a face to stand behind, and its grip'),
    buckler: X('shield', 'buckler', ['buckler', 'targe', 'round'], 'a round face and its grip'),
    cannon: X('cannon', 'cannon', ['cannon', 'howitzer', 'artillery', 'field-gun', 'fieldgun', 'bombard', 'culverin'], 'a barrel on a wheeled carriage'),
    mortar: X('cannon', 'mortar', ['mortar'], 'a short barrel raised steeply on its bed'),
    trebuchet: X('siege', 'trebuchet', ['trebuchet', 'counterweight'], 'a long arm on a frame, its counterweight'),
    catapult: X('siege', 'catapult', ['catapult', 'mangonel', 'onager', 'siege'], 'a throwing arm and its cup on a frame'),
    ballista: X('ballista', 'ballista', ['ballista', 'scorpion', 'springald', 'bolt-thrower'], 'a great bow across a stock on its stand'),
    launcher: X('launcher', 'launcher', ['launcher', 'rocket', 'rockets', 'missile', 'missiles'], 'a pod of tubes on a mount'),
    turret: X('turret', 'turret', ['turret', 'emplacement', 'battery', 'flak', 'sentry', 'autocannon', 'gatling'], 'a housing on its ring, its barrels out'),
    energy: M(['laser', 'beam', 'ray', 'plasma', 'energy', 'pulse', 'ion', 'particle', 'arc', 'blaster'], 'it fires light: coils on its barrel', { energy: true }),
    twin: M(['twin', 'double', 'dual'], 'two barrels', { barrels: 2 }),
    multi: M(['multi', 'triple', 'gatling', 'rotary', 'volley', 'repeating', 'multi-barrel'], 'many barrels', { barrels: 4 }),
    long: M(['long', 'longbow', 'great', 'heavy'], 'long: a third again', { long: 1.3 }),
    short: M(['short', 'sawn-off', 'stubby', 'compact'], 'short: a third less', { long: 0.7 }),
    automated: M(['automated', 'automatic', 'sentry', 'robotic', 'autonomous'], 'it aims itself: a sensor on it', { sensor: true }),
    busy: BUSY, bare: BARE,
  }),
});

// what each form is, before any word adds to it
const FORM = {
  // vehicles
  wheeled: { fns: ['move'] }, tracked: { fns: ['move'] }, walker: { fns: ['move'] }, rail: { fns: ['move'] }, hover: { fns: ['move'] },
  rotor: { fns: ['move'] }, winged: { fns: ['move'] }, airship: { fns: ['move'] }, ship: { fns: ['move'], mounts: ['water'] }, drawn: { fns: ['move'] },
  // structures
  tower: { fns: [] }, gate: { fns: ['pass'] }, portal: { fns: ['pass'] }, bridge: { fns: ['pass'] }, windmill: { fns: ['power'] }, waterwheel: { fns: ['power'] },
  stack: { fns: [], variants: { cooling: ['power'], stacks: ['make'] } }, dish: { fns: ['sense'] }, barrier: { fns: ['guard'] }, launch: { fns: ['lift'] },
  // weapons
  blade: { fns: ['strike'], held: true }, polearm: { fns: ['strike'], held: true }, axe: { fns: ['strike'], held: true }, bow: { fns: ['strike'], held: true },
  staff: { fns: ['strike'], held: true }, gun: { fns: ['strike'], held: true }, shield: { fns: ['guard'], held: true },
  cannon: { fns: ['strike'] }, siege: { fns: ['strike'] }, ballista: { fns: ['strike'] }, launcher: { fns: ['strike'] }, turret: { fns: ['strike'], tier: 'installation' },
};
const DEFAULT = { vehicle: ['wheeled', 'car'], structure: ['tower', 'tower'], weapon: ['blade', 'sword'] };
/** The equipment class a hand weapon is carried as (equipment.js), where there is one. */
const CARRIES = { 'blade/sword': 'sword', 'blade/dagger': 'dagger', 'blade/greatsword': 'greatsword', 'bow/bow': 'bow', 'staff/staff': 'staff', 'shield/shield': 'shield', 'shield/buckler': 'shield' };

// ── the grammars ────────────────────────────────────────────────────────────────────────────────────────────────────
// a grammar's working set: the parts, the signature, a piece's own factor (the tunnel thickens what was lost)
function kit(c) {
  const parts = [], sig = [], used = new Set(), k = (id) => { used.add(id); return c.thick?.[id] ?? 1; };
  const add = (p, s) => { parts.push(p); if (s) sig.push(p.id); return p; };
  return { parts, sig, k, add, used };
}
const fnsOf = (c) => [...new Set([...FORM[c.form].fns, ...(FORM[c.form].variants?.[c.variant] ?? []), ...c.functions, ...(c.armour ? ['guard'] : []), ...(c.armed ? ['strike'] : []), ...(c.cargo ? ['store'] : []), ...(c.sensor ? ['sense'] : [])])];

/** A vehicle: its body and what it goes on or by, then what it carries and wears. */
function composeVehicle(c) {
  const u = (c.tier === 'vessel' ? 2.2 : 1) * (c.scale ?? 1), { parts, sig, k, add, used } = kit(c), ws = c.lean ? 8 : 10, ds = c.lean ? 8 : 12;
  const box = (id, role, size, at, group, value, { sig: on, ...more } = {}) => add({ id, prim: 'box', role, size: size.map(r2), at: at.map(r2), group, value, ...more }, on);
  let L, D, H, z0, top, front, lead = 'body', screen = true;
  const wheels = (r, w, n, x0, step, z = 0, id = 'wheels', role = 'running') => { for (const s of [-1, 1]) add({ id: `${id}-${s < 0 ? 'l' : 'r'}`, prim: 'wheel', role, r: r2(r), w: r2(w), sides: ws, at: [r2(x0), r2(s * (D / 2 + w / 2 - 0.05 * u)), z], ...(n > 1 ? { repeat: { n, step: [r2(step), 0, 0] } } : {}), group: 'tech:frame', value: 0.22 }, s < 0); };
  switch (c.form) {
    case 'wheeled': {
      L = 4.2 * u * k('body'); D = 2 * u * k('body'); H = 1.1 * u * k('body');
      const r = 0.45 * u * k('wheels-l'), n = L > 5 * u ? 3 : 2;
      z0 = r2(r * 1.05); wheels(r, 0.35 * u, n, -L / 2 + 1.2 * r, (L - 2.4 * r) / (n - 1));
      box('body', 'body', [L, D, H], [0, 0, z0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 0.8 * u)), sig: true });
      top = z0 + H;
      box('cab', 'body', [1.4 * u, D * 0.9, 0.8 * u], [L / 2 - 0.8 * u, 0, top], 'tech:skin', 0.8);
      front = [L / 2 + 0.03 * u, top + 0.4 * u]; top += 0.8 * u;
      break;
    }
    case 'tracked': {
      L = 4.6 * u * k('body'); D = 2.4 * u * k('body'); H = 1 * u * k('body');
      const r = 0.42 * u * k('track-l'), tw = 0.55 * u;
      z0 = r2(2 * r * 0.85);
      for (const s of [-1, 1]) add({ id: `track-${s < 0 ? 'l' : 'r'}`, prim: 'track', role: 'running', len: r2(L * 0.98), r: r2(r), w: r2(tw), sides: c.lean ? 3 : 4, at: [0, r2(s * (D / 2 - tw / 2 + 0.05 * u)), 0], group: 'tech:frame', value: 0.22 }, s < 0);
      box('body', 'body', [L, D * 0.92, H], [0, 0, z0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 0.8 * u)), sig: true });
      top = z0 + H; front = [L / 2 + 0.03 * u, z0 + H * 0.7];
      box('hatch', 'trim', [1.2 * u, 1 * u, 0.3 * u], [-L / 4, 0, top], 'tech:trim', 0.5, { many: 0.4 });
      break;
    }
    case 'walker': {
      L = 2.8 * u * k('body'); D = 2 * u * k('body'); H = 1.4 * u * k('body');
      z0 = r2(2.6 * u);
      const r = 0.38 * u * k('thigh-l'), kx = L / 2 - 0.4 * u, out = D / 2 + 0.9 * u;
      for (const [s, side] of [[-1, 'l'], [1, 'r']]) {
        add({ id: `thigh-${side}`, prim: 'tube', role: 'running', r: r2(r), sides: 6, from: [0, r2(s * D / 2), r2(z0 + 0.3 * u)], to: [0, r2(s * out), r2(z0 + 0.7 * u)], at: [r2(-kx), 0, 0], repeat: { n: 2, step: [r2(2 * kx), 0, 0] }, group: 'tech:frame', value: 0.4 }, s < 0);
        add({ id: `shin-${side}`, prim: 'tube', role: 'running', r: r2(r * 0.85), sides: 6, from: [0, r2(s * out), r2(z0 + 0.7 * u)], to: [0, r2(s * (out + 0.2 * u)), r2(0.2 * u)], at: [r2(-kx), 0, 0], repeat: { n: 2, step: [r2(2 * kx), 0, 0] }, group: 'tech:frame', value: 0.4 });
        add({ id: `foot-${side}`, prim: 'box', role: 'running', size: [r2(0.8 * u), r2(0.8 * u), r2(0.25 * u)], at: [r2(-kx), r2(s * (out + 0.2 * u)), 0], repeat: { n: 2, step: [r2(2 * kx), 0, 0] }, group: 'tech:frame', value: 0.35 });
      }
      box('body', 'body', [L, D, H], [0, 0, z0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 0.8 * u)), sig: true });
      top = z0 + H; front = [L / 2 + 0.03 * u, z0 + H * 0.65];
      break;
    }
    case 'rail': {
      L = 6.4 * u * k('body'); D = 2.2 * u * k('body'); H = 1.8 * u * k('body');
      const r = 0.42 * u * k('bogies-l');
      box('rails', 'running', [L * 1.3, D * 0.7, 0.18 * u], [0, 0, 0], 'tech:frame', 0.3);
      z0 = r2(0.18 * u + 2 * r);
      for (const s of [-1, 1]) add({ id: `bogies-${s < 0 ? 'l' : 'r'}`, prim: 'wheel', role: 'running', r: r2(r), w: r2(0.25 * u), sides: ws, at: [r2(-L / 2 + 1.2 * u), r2(s * D * 0.3), r2(0.18 * u)], repeat: { n: 2, step: [r2(L - 2.4 * u), 0, 0] }, group: 'tech:frame', value: 0.22 }, s < 0);
      box('body', 'body', [L, D, H], [0, 0, z0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 0.8 * u)), sig: true });
      box('roof', 'trim', [L * 0.94, D * 0.8, 0.22 * u], [0, 0, z0 + H], 'tech:skin', 0.8, { many: 0.3 });
      top = z0 + H + 0.22 * u; front = [L / 2 + 0.03 * u, z0 + H * 0.7];
      break;
    }
    case 'hover': {
      L = 3.8 * u * k('body'); D = 2.2 * u * k('body'); H = 0.9 * u * k('body');
      const sh = 0.8 * u * k('skirt');
      box('skirt', 'running', [L * 1.12 * k('skirt'), D * 1.12 * k('skirt'), sh], [0, 0, 0], 'tech:frame', 0.3, { sig: true });
      z0 = r2(sh);
      box('body', 'body', [L * 0.78, D * 0.74, H], [-L * 0.08, 0, z0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 0.8 * u)) });
      lead = 'skirt';
      top = z0 + H;
      add({ id: 'fans', prim: 'drum', role: 'running', r: r2(0.55 * u), h: r2(0.5 * u), axis: 'x', sides: ds, at: [r2(-L / 2 - 0.5 * u), r2(-0.65 * u), r2(top)], repeat: { n: 2, step: [0, r2(1.3 * u), 0] }, group: 'tech:frame', value: 0.4 });
      front = [L / 2 + 0.03 * u, z0 + H * 0.7];
      break;
    }
    case 'rotor': {
      L = 2.8 * u * k('body'); D = 1.6 * u * k('body'); H = 1.4 * u * k('body');
      z0 = r2(0.45 * u);
      for (const s of [-1, 1]) add({ id: `skid-${s < 0 ? 'l' : 'r'}`, prim: 'tube', role: 'mount', r: r2(0.06 * u), sides: 6, from: [r2(-L / 2), r2(s * D * 0.45), r2(0.06 * u)], to: [r2(L / 2 + 0.3 * u), r2(s * D * 0.45), r2(0.06 * u)], group: 'tech:frame', value: 0.35 });
      add({ id: 'struts', prim: 'box', role: 'mount', size: [r2(0.12 * u), r2(D * 0.9), r2(z0)], at: [r2(-L / 4), 0, 0], repeat: { n: 2, step: [r2(L / 2), 0, 0] }, group: 'tech:frame', value: 0.35 });
      box('body', 'body', [L, D, H], [0, 0, z0], 'tech:body', 0.72, { sig: true });
      top = z0 + H;
      const tl = 3.2 * u * k('tail');
      add({ id: 'tail', prim: 'drum', role: 'body', r: r2(0.38 * u * k('tail')), h: r2(tl), axis: 'x', sides: c.lean ? 6 : 8, at: [r2(-L / 2 - tl), 0, r2(z0 + H * 0.6)], group: 'tech:skin', value: 0.75 }, true);
      add({ id: 'tail-fin', prim: 'fin', role: 'trim', l: r2(0.9 * u), h: r2(1.1 * u), t: r2(0.06 * u), at: [r2(-L / 2 - tl), 0, r2(z0 + H * 0.6)], group: 'tech:skin', value: 0.8 });
      add({ id: 'mast', prim: 'drum', role: 'frame', r: r2(0.14 * u), h: r2(0.5 * u), sides: 8, at: [0, 0, r2(top)], group: 'tech:frame', value: 0.45 });
      add({ id: 'rotor', prim: 'panel', role: 'running', size: [r2(3 * u), r2(0.3 * u)], t: r2(0.05 * u), aim: [0, 0, 1], at: [0, 0, r2(top + 0.5 * u)], repeat: { n: c.many > 0.6 ? 4 : 2, around: r2(1.5 * u) }, group: 'tech:frame', value: 0.3 });
      front = [L / 2 + 0.03 * u, z0 + H * 0.65]; top += 0.6 * u;
      break;
    }
    case 'winged': {
      L = 5.6 * u * k('body'); D = 0.95 * u * k('body'); H = D;
      const r = D / 2, gear = 0.28 * u;
      z0 = r2(0.75 * u);
      add({ id: 'body', prim: 'drum', role: 'body', r: r2(r), h: r2(L), axis: 'x', sides: ds, at: [r2(-L / 2), 0, r2(z0 + r)], group: 'tech:body', value: 0.72 }, true);
      const span = 8.6 * u * k('wings'), chord = 1.6 * u * k('wings');
      add({ id: 'wings', prim: 'panel', role: 'running', size: [r2(chord), r2(span)], t: r2(0.1 * u), aim: [0, 0, 1], at: [r2(0.3 * u), 0, r2(z0 + r * 0.6)], group: 'tech:skin', value: 0.8 }, true);
      add({ id: 'tailplane', prim: 'panel', role: 'running', size: [r2(0.8 * u), r2(2.4 * u)], t: r2(0.06 * u), aim: [0, 0, 1], at: [r2(-L / 2 + 0.4 * u), 0, r2(z0 + r)], group: 'tech:skin', value: 0.8 });
      add({ id: 'tail-fin', prim: 'fin', role: 'trim', l: r2(1.1 * u), h: r2(1.2 * u), t: r2(0.08 * u), at: [r2(-L / 2), 0, r2(z0 + 2 * r)], group: 'tech:skin', value: 0.8 });
      add({ id: 'gear', prim: 'wheel', role: 'mount', r: r2(gear), w: r2(0.18 * u), sides: c.lean ? 6 : 8, at: [r2(0.6 * u), r2(-0.9 * u), 0], repeat: { n: 2, step: [0, r2(1.8 * u), 0] }, group: 'tech:frame', value: 0.25 });
      add({ id: 'nose-gear', prim: 'wheel', role: 'mount', r: r2(gear * 0.8), w: r2(0.14 * u), sides: c.lean ? 6 : 8, at: [r2(L / 2 - 0.6 * u), 0, 0], group: 'tech:frame', value: 0.25 });
      add({ id: 'gear-legs', prim: 'box', role: 'mount', size: [r2(0.1 * u), r2(0.1 * u), r2(z0 + r * 0.4)], at: [r2(0.6 * u), r2(-0.9 * u), 0], repeat: { n: 2, step: [0, r2(1.8 * u), 0] }, group: 'tech:frame', value: 0.35 });
      add({ id: 'prop', prim: 'drum', role: 'running', r: r2(r * 0.7), h: r2(0.3 * u), axis: 'x', sides: c.lean ? 6 : 8, at: [r2(L / 2), 0, r2(z0 + r)], group: 'tech:frame', value: 0.4 });
      top = z0 + 2 * r; front = [L / 2 - 1.2 * u, z0 + 2 * r]; screen = false;
      add({ id: 'canopy', prim: 'drum', role: 'readout', r: r2(r * 0.6), h: r2(1.2 * u), axis: 'x', sides: c.lean ? 6 : 8, at: [r2(L / 2 - 2.2 * u), 0, r2(z0 + 1.6 * r)], group: 'tech:glass', value: 0.12 });
      lead = 'wings';
      break;
    }
    case 'airship': {
      L = 3.2 * u * k('body'); D = 1.5 * u * k('body'); H = 1.1 * u * k('body');
      z0 = 0;
      box('body', 'body', [L, D, H], [0, 0, 0], 'tech:body', 0.72, { sig: true });
      const R = 1.7 * u * k('envelope'), EL = 9.5 * u * k('envelope'), zc = H + 0.8 * u + R;
      add({ id: 'envelope', prim: 'drum', role: 'running', r: r2(R), h: r2(EL), axis: 'x', sides: c.lean ? 10 : 14, at: [r2(-EL / 2), 0, r2(zc)], group: 'tech:skin', value: 0.82 }, true);
      add({ id: 'cables', prim: 'tube', role: 'frame', r: r2(0.03 * u), sides: 4, from: [r2(-L / 2), r2(-D / 2), r2(H)], to: [r2(-L), r2(-R * 0.6), r2(zc - R * 0.8)], repeat: { n: 2, step: [r2(L), 0, 0] }, group: 'tech:cable', value: 0.3 });
      add({ id: 'fin', prim: 'fin', role: 'trim', l: r2(1.6 * u), h: r2(1.4 * u), t: r2(0.1 * u), at: [r2(-EL / 2), 0, r2(zc + R * 0.7)], group: 'tech:skin', value: 0.8 });
      add({ id: 'engines', prim: 'drum', role: 'running', r: r2(0.3 * u), h: r2(0.8 * u), axis: 'x', sides: c.lean ? 6 : 8, at: [r2(-L / 2 - 0.9 * u), r2(-D / 2 - 0.4 * u), r2(H * 0.5)], repeat: { n: 2, step: [0, r2(D + 0.8 * u), 0] }, group: 'tech:frame', value: 0.4 });
      top = H; front = [L / 2 + 0.03 * u, H * 0.6]; lead = 'envelope';
      break;
    }
    case 'ship': {
      // a ship at the hero's scale: 16 m a hull (a galley, a frigate, a steamer), a boat 6.5 m
      const sz = c.variant === 'boat' ? 0.4 : 1, hs = u * sz;
      L = 16 * hs * k('body'); D = 4.6 * hs * k('body'); H = 2.4 * hs * k('body');
      z0 = 0;
      box('body', 'body', [L, D, H], [0, 0, 0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 0.8 * u)), sig: true });
      add({ id: 'bow', prim: 'cone', role: 'body', r: r2(D / 2), r2: 0, h: r2(H), sides: 4, at: [r2(L / 2), 0, 0], group: 'tech:body', value: 0.7 });
      add({ id: 'rudder', prim: 'fin', role: 'running', l: r2(0.7 * u), h: r2(H * 0.9), t: r2(0.1 * u), yaw: 180, at: [r2(-L / 2), 0, 0], group: 'tech:frame', value: 0.4 });
      top = H;
      box('house', 'body', [L * 0.25, D * 0.7, 2.2 * hs], [-L * 0.28, 0, top], 'tech:skin', 0.8);
      front = [-L * 0.28 + L * 0.125 + 0.03 * u, top + 1.3 * hs]; screen = false;
      // a ship with nothing else to go by is rowed
      if (!c.sail && !c.stack) add({ id: 'oars', prim: 'tube', role: 'running', r: r2(0.1 * hs), sides: 4, from: [0, r2(-D / 2), r2(H * 0.8)], to: [r2(-0.6 * hs), r2(-D / 2 - 3.4 * hs), 0], at: [r2(-L * 0.25), 0, 0], repeat: { n: c.many > 0.6 ? 7 : 5, step: [r2(1.6 * hs), 0, 0] }, group: 'tech:frame', value: 0.4 });
      if (!c.sail && !c.stack) add({ id: 'oars-r', prim: 'tube', role: 'running', r: r2(0.1 * hs), sides: 4, from: [0, r2(D / 2), r2(H * 0.8)], to: [r2(-0.6 * hs), r2(D / 2 + 3.4 * hs), 0], at: [r2(-L * 0.25), 0, 0], repeat: { n: c.many > 0.6 ? 7 : 5, step: [r2(1.6 * hs), 0, 0] }, group: 'tech:frame', value: 0.4 });
      break;
    }
    case 'drawn': {
      L = 2.4 * u * k('body'); D = 1.5 * u * k('body'); H = 0.8 * u * k('body');
      const r = 0.62 * u * k('wheels-l');
      z0 = r2(r * 0.9); wheels(r, 0.14 * u, 1, 0, 0);
      box('body', 'body', [L, D, H], [0, 0, z0], 'tech:body', 0.72, { sig: true });
      top = z0 + H;
      add({ id: 'shafts', prim: 'tube', role: 'mount', r: r2(0.06 * u), sides: 6, from: [r2(L / 2), r2(-0.45 * u), r2(z0 + 0.1 * u)], to: [r2(L / 2 + 2 * u), r2(-0.45 * u), r2(0.7 * u)], repeat: { n: 2, step: [0, r2(0.9 * u), 0] }, group: 'tech:frame', value: 0.35 });
      add({ id: 'yoke', prim: 'box', role: 'mount', size: [r2(0.12 * u), r2(1.1 * u), r2(0.12 * u)], at: [r2(L / 2 + 2 * u), 0, r2(0.64 * u)], group: 'tech:frame', value: 0.35 });
      add({ id: 'prop', prim: 'box', role: 'mount', size: [r2(0.12 * u), r2(0.12 * u), r2(0.7 * u)], at: [r2(L / 2 + 2 * u), 0, 0], group: 'tech:frame', value: 0.35 });
      front = [L / 2, top]; screen = false;
      break;
    }
  }
  // ── what it carries and wears ──
  const fns = fnsOf(c);
  if (screen) add({ id: 'screen', prim: 'panel', role: 'readout', size: [r2(Math.min(D * 0.7, 1.4 * u)), r2(0.45 * u)], t: r2(0.04 * u), aim: [1, 0, 0.2], at: [r2(front[0]), 0, r2(front[1])], group: 'tech:glass', value: 0.12 });
  if (c.armour) {
    if (['winged', 'rotor', 'airship'].includes(c.form)) box('plates', 'armour', [L * 0.6, D * 1.04, 0.2 * u], [0, 0, z0 - 0.05 * u], 'tech:trim', 0.55);
    else for (const s of [-1, 1]) box(`plates-${s < 0 ? 'l' : 'r'}`, 'armour', [L * 0.9, 0.14 * u, H * 0.55], [0, s * (D / 2 + 0.12 * u), z0 + H * 0.05], 'tech:trim', 0.55);
  }
  if (c.armed) {
    if (c.form === 'winged') add({ id: 'guns', prim: 'tube', role: 'weapon', r: r2(0.1 * u), sides: 6, from: [r2(0.4 * u), r2(-2 * u), r2(z0 + D * 0.2)], to: [r2(1.8 * u), r2(-2 * u), r2(z0 + D * 0.2)], repeat: { n: 2, step: [0, r2(4 * u), 0] }, group: 'tech:frame', value: 0.4 }),
    add({ id: 'pylons', prim: 'box', role: 'mount', size: [r2(0.8 * u), r2(0.2 * u), r2(0.2 * u)], at: [r2(0.8 * u), r2(-2 * u), r2(z0 + D * 0.15)], repeat: { n: 2, step: [0, r2(4 * u), 0] }, group: 'tech:frame', value: 0.4 });
    else if (c.form === 'rotor') add({ id: 'guns', prim: 'tube', role: 'weapon', r: r2(0.09 * u), sides: 6, from: [r2(L / 2 - 0.2 * u), r2(-D / 2 - 0.25 * u), r2(z0 + 0.2 * u)], to: [r2(L / 2 + 0.9 * u), r2(-D / 2 - 0.25 * u), r2(z0 + 0.2 * u)], repeat: { n: 2, step: [0, r2(D + 0.5 * u), 0] }, group: 'tech:frame', value: 0.4 }),
    add({ id: 'pylons', prim: 'box', role: 'mount', size: [r2(0.6 * u), r2(D + 0.6 * u), r2(0.12 * u)], at: [r2(L / 2 - 0.4 * u), 0, r2(z0 + 0.12 * u)], group: 'tech:frame', value: 0.4 });
    else {
      const tx = c.form === 'ship' ? L * 0.22 : c.form === 'airship' ? 0 : -L * 0.05, tz = c.form === 'airship' ? -0.01 : top;
      if (c.form === 'airship') add({ id: 'turret', prim: 'drum', role: 'mount', r: r2(0.4 * u), h: r2(0.35 * u), sides: ds, at: [r2(L / 2 - 0.4 * u), 0, r2(H)], group: 'tech:frame', value: 0.5 });
      else add({ id: 'turret', prim: 'drum', role: 'mount', r: r2(0.7 * u * k('turret')), h: r2(0.5 * u), sides: ds, at: [r2(tx), 0, r2(tz)], group: 'tech:body', value: 0.66 });
      const bz = c.form === 'airship' ? H + 0.18 * u : top + 0.28 * u, bx = c.form === 'airship' ? L / 2 - 0.1 * u : tx + 0.4 * u;
      add({ id: 'barrel', prim: 'drum', role: 'weapon', r: r2(0.12 * u * k('barrel')), h: r2(1.9 * u), axis: 'x', sides: 8, at: [r2(bx), 0, r2(bz)], group: 'tech:frame', value: 0.4 });
    }
  }
  if (c.cargo) box('crates', 'store', [0.8 * u, 0.8 * u, 0.7 * u], [-L / 2 + 0.6 * u, -0.45 * u, c.form === 'ship' ? top : top], 'tech:skin', 0.6, { repeat: { n: c.many > 0.6 ? 3 : 2, step: [r2(0.9 * u), 0, 0] } });
  if (c.stack) add({ id: 'stack', prim: 'drum', role: 'source', r: r2(0.3 * u), h: r2(1.4 * u), sides: c.lean ? 6 : 8, at: [r2(c.form === 'ship' ? -L * 0.05 : -L / 2 + 0.6 * u), r2(c.form === 'rail' ? 0 : 0.5 * u), r2(top)], group: 'tech:frame', value: 0.45 });
  if (c.sail && !['winged', 'rotor', 'airship'].includes(c.form)) {
    const mh = (c.form === 'ship' ? 11 * (c.variant === 'boat' ? 0.45 : 1) : 5.5) * u * k('sail'), mx = c.form === 'ship' ? L * 0.05 : 0;
    add({ id: 'mast', prim: 'tube', role: 'frame', r: r2(0.1 * u), sides: 6, from: [r2(mx), 0, r2(top)], to: [r2(mx), 0, r2(top + mh)], group: 'tech:frame', value: 0.45 });
    add({ id: 'sail', prim: 'panel', role: 'running', size: [r2(D * 1.3 * k('sail')), r2(mh * 0.7)], t: r2(0.04 * u), aim: [1, 0, 0], at: [r2(mx + 0.15 * u), 0, r2(top + mh * 0.55)], group: 'tech:skin', value: 0.85 }, true);
    if (c.form === 'ship') lead = 'body';
  }
  // what a busier one wears, and its status light
  if (['wheeled', 'tracked', 'rail', 'hover'].includes(c.form)) add({ id: 'rail', prim: 'box', role: 'trim', size: [r2(L * 0.8), r2(0.08 * u), r2(0.25 * u)], at: [0, r2(-D / 2 - 0.04 * u), r2(z0 + H * 0.4)], group: 'tech:trim', value: 0.5, many: 0.7 });
  if (!['airship', 'winged'].includes(c.form)) add({ id: 'vents', prim: 'box', role: 'trim', size: [r2(0.4 * u), r2(0.4 * u), r2(0.2 * u)], at: [r2(-L / 2 + 0.4 * u), r2(D / 2 - 0.4 * u), r2(c.form === 'ship' ? H : z0 + H)], repeat: { n: 'round(1 + 2 * many)', step: [r2(0.6 * u), 0, 0] }, group: 'tech:trim', value: 0.5, many: 0.4 });
  add({ id: 'status', prim: 'lamp', role: 'status', r: r2(Math.max(0.08, 0.12 * u)), at: [r2(c.form === 'winged' ? -L / 2 + 0.3 * u : c.form === 'airship' ? 0 : front[0] - 0.4 * u), 0, r2(c.form === 'airship' ? H : c.form === 'winged' ? z0 + 2 * D + 0.3 * u : top)], group: 'str:accent', value: 0.9 });
  // building scale is a vessel's, whatever its words said: over 12 m long, it is met as one
  return { parts, sig, lead, used, fns, tier: c.tier === 'vessel' || L > 12 ? 'vessel' : 'machine', mounts: FORM[c.form].mounts ?? ['ground'] };
}

/** A tech-structure: its form, raised at landmark scale, and what it carries at the top. */
function composeStructure(c) {
  const u = (c.scale ?? 1) * (c.tall ? 1.35 : 1), { parts, sig, k, add, used } = kit(c), ds = c.lean ? 8 : 12, fns = fnsOf(c);
  const box = (id, role, size, at, group, value, { sig: on, ...more } = {}) => add({ id, prim: 'box', role, size: size.map(r2), at: at.map(r2), group, value, ...more }, on);
  let crown, lead;
  const glass = c.field ? { group: 'tech:glass', value: 0.2 } : { group: 'tech:skin', value: 0.6 };
  switch (c.form) {
    case 'tower': {
      const H = 18 * u * (c.tall ? 1.1 : 1);
      box('pad', 'mount', [5.5 * u, 5.5 * u, 0.6 * u], [0, 0, 0], 'tech:frame', 0.5);
      if (c.lattice) add({ id: 'shaft', prim: 'truss', role: 'frame', from: [0, 0, r2(0.6 * u)], to: [0, 0, r2(H)], w: r2(2.8 * u * k('shaft')), member: r2(0.22 * u), group: 'tech:frame', value: 0.45 }, true);
      else add({ id: 'shaft', prim: 'cone', role: 'body', r: r2(2.1 * u * k('shaft')), r2: r2(1.3 * u * k('shaft')), h: r2(H - 0.6 * u), sides: c.lean ? 8 : 10, at: [0, 0, r2(0.6 * u)], group: 'tech:body', value: 0.72 }, true);
      add({ id: 'deck', prim: 'drum', role: 'trim', r: r2(2 * u), h: r2(0.4 * u), sides: ds, at: [0, 0, r2(H)], group: 'tech:trim', value: 0.55 });
      add({ id: 'bands', prim: 'ring', role: 'trim', r: r2(2 * u), tube: r2(0.12 * u), sides: ds, at: [0, 0, r2(H * 0.33)], repeat: { n: 2, step: [0, 0, r2(H * 0.33)] }, group: 'tech:trim', value: 0.5, many: 0.5 });
      crown = [0, 0, H + 0.4 * u]; lead = 'shaft';
      break;
    }
    case 'gate': {
      const span = 9.2 * u, ph = 10 * u, pw = 2.35 * u * k('pier-l');
      for (const s of [-1, 1]) box(`pier-${s < 0 ? 'l' : 'r'}`, 'pier', [pw, pw, ph], [0, s * (span / 2 + pw / 2), 0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, u)), sig: s < 0 });
      box('lintel', 'span', [3.2 * u, span + 2 * pw + 1.4 * u, 3.2 * u * k('lintel')], [0, 0, ph], 'tech:skin', 0.8, { sig: true });
      if (c.field) box('leaf', 'trim', [0.3 * u, span * 0.98, ph * 0.96], [0, 0, 0], c.field ? 'tech:glass' : 'tech:skin', c.field ? 0.2 : 0.55);
      crown = [0, 0, ph + 3.2 * u * k('lintel')]; lead = 'lintel';
      break;
    }
    case 'portal': {
      const R = 4.8 * u * k('ring'), tube = 1.25 * u * k('ring'), bz = 1 * u;
      box('base', 'pier', [3.4 * u, 2 * R + 1.6 * u, bz], [0, 0, 0], 'tech:frame', 0.55);
      add({ id: 'ring', prim: 'ring', role: 'span', r: r2(R), tube: r2(tube), axis: 'x', sides: c.lean ? 16 : 20, at: [0, 0, r2(bz + R + tube)], group: 'tech:body', value: 0.72 }, true);
      const n = c.many > 0.6 ? 9 : 7;
      for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (2 * Math.PI * i) / n; add({ id: `chevron-${i + 1}`, prim: 'lamp', role: 'trim', r: r2(0.32 * u), at: [r2(0.6 * u), r2(R * Math.cos(a)), r2(bz + R + tube + R * Math.sin(a) - 0.32 * u)], group: 'tech:light', value: 0.85, many: 0.3 }); }
      if (c.field) add({ id: 'field', prim: 'panel', role: 'trim', size: [r2(R * 1.5), r2(R * 1.5)], t: r2(0.05 * u), aim: [1, 0, 0], at: [0, 0, r2(bz + R + tube)], group: 'tech:glass', value: 0.2 });
      crown = [0, 0, bz + 2 * (R + tube)]; lead = 'ring';
      break;
    }
    case 'bridge': {
      const L = 30 * u, dz = 8 * u, dw = 5 * u, pw = 2.35 * u * k('piers');
      box('deck', 'span', [L, dw, 3 * u * k('deck')], [0, 0, dz], 'tech:body', 0.72, { seams: r2(Math.max(0.3, 2 * u)), sig: true });
      box('piers', 'pier', [pw, dw * 0.6, dz], [-L / 2 + 2.2 * u, 0, 0], 'tech:frame', 0.6, { repeat: { n: 3, step: [r2((L - 4.4 * u) / 2), 0, 0] }, sig: true });
      const rz = dz + 3 * u * k('deck');
      if (c.lattice) add({ id: 'trusses', prim: 'truss', role: 'frame', from: [r2(-L / 2), r2(-(dw / 2 - 0.4 * u)), r2(rz + 1.5 * u)], to: [r2(L / 2), r2(-(dw / 2 - 0.4 * u)), r2(rz + 1.5 * u)], w: r2(3 * u), member: r2(0.2 * u), repeat: { n: 2, step: [0, r2(dw - 0.8 * u), 0] }, group: 'tech:frame', value: 0.45 });
      else for (const s of [-1, 1]) box(`rail-${s < 0 ? 'l' : 'r'}`, 'trim', [L, 0.3 * u, 1.1 * u], [0, s * (dw / 2 - 0.15 * u), rz], 'tech:trim', 0.5, { many: 0.3 });
      if (c.variant === 'aqueduct') box('channel', 'trim', [L, dw * 0.5, 0.5 * u], [0, 0, rz], 'tech:glass', 0.3);
      crown = [L / 2 - 1.3 * u, 0, rz + (c.lattice ? 3 * u : 1.1 * u)]; lead = c.lattice ? 'trusses' : 'deck';
      break;
    }
    case 'windmill': {
      const H = 11 * u, sw = 2.4 * u * k('sails-v'), sl = 16 * u;
      add({ id: 'body', prim: 'cone', role: 'body', r: r2(3.2 * u * k('body')), r2: r2(2 * u * k('body')), h: r2(H), sides: 8, at: [0, 0, 0], group: 'tech:body', value: 0.72 }, true);
      add({ id: 'cap', prim: 'cone', role: 'trim', r: r2(2.4 * u), r2: 0, h: r2(2.4 * u), sides: 8, at: [0, 0, r2(H)], group: 'tech:skin', value: 0.8 });
      add({ id: 'hub', prim: 'drum', role: 'source', r: r2(0.6 * u), h: r2(1.4 * u), axis: 'x', sides: 8, at: [r2(2 * u), 0, r2(H - 0.4 * u)], group: 'tech:frame', value: 0.6 });
      add({ id: 'sails-v', prim: 'panel', role: 'source', size: [r2(sw), r2(sl)], t: r2(0.1 * u), seams: r2(Math.max(0.1, 0.8 * u)), aim: [1, 0, 0], at: [r2(3.5 * u), 0, r2(H - 0.4 * u)], group: 'tech:skin', value: 0.85 }, true);
      add({ id: 'sails-h', prim: 'panel', role: 'source', size: [r2(sl), r2(sw)], t: r2(0.1 * u), seams: r2(Math.max(0.1, 0.8 * u)), aim: [1, 0, 0], at: [r2(3.6 * u), 0, r2(H - 0.4 * u)], group: 'tech:skin', value: 0.85 });
      add({ id: 'shaft', prim: 'tube', role: 'carrier', r: r2(0.18 * u), sides: 6, from: [r2(2.6 * u), r2(-1.4 * u), r2(H - 1 * u)], to: [r2(3.4 * u), r2(-1.4 * u), 0], group: 'tech:cable', value: 0.3 });
      box('door', 'trim', [0.2 * u, 1.4 * u, 2.4 * u], [3.1 * u, 0, 0], 'tech:trim', 0.4);
      crown = [0, 0, H + 2.4 * u]; lead = 'body';
      break;
    }
    case 'waterwheel': {
      const R = 4.2 * u * k('wheel');
      box('body', 'body', [6 * u, 5 * u, 5 * u], [0, 0, 0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, u)), sig: true });
      add({ id: 'roof', prim: 'cone', role: 'trim', r: r2(4.1 * u), r2: 0, h: r2(2.6 * u), sides: 4, yaw: 45, at: [0, 0, r2(5 * u)], group: 'tech:skin', value: 0.8 });
      add({ id: 'wheel', prim: 'wheel', role: 'source', r: r2(R), w: r2(1.6 * u), sides: c.lean ? 12 : 16, at: [0, r2(2.5 * u + 1 * u), 0], group: 'tech:frame', value: 0.4 }, true);
      box('race', 'carrier', [14 * u, 2.2 * u, 0.8 * u], [0, 3.5 * u, 0], 'tech:glass', 0.3);
      crown = [0, 0, 7.6 * u]; lead = 'wheel';
      break;
    }
    case 'stack': {
      if (c.variant === 'cooling') {
        const r = 5.2 * u * k('stack');
        add({ id: 'stack', prim: 'cone', role: 'source', r: r2(r), r2: r2(r * 0.62), h: r2(13 * u), sides: c.lean ? 10 : 14, at: [0, 0, 0], group: 'tech:body', value: 0.72 }, true);
        add({ id: 'stack-lip', prim: 'cone', role: 'source', r: r2(r * 0.62), r2: r2(r * 0.74), h: r2(6 * u), sides: c.lean ? 10 : 14, at: [0, 0, r2(13 * u)], group: 'tech:body', value: 0.74 });
        box('plant', 'body', [8 * u, 6 * u, 5 * u], [r * 1 + 6 * u, 0, 0], 'tech:skin', 0.75, { seams: r2(Math.max(0.3, u)) });
        add({ id: 'pipes', prim: 'tube', role: 'carrier', r: r2(0.5 * u), sides: 6, from: [r2(r * 0.9), r2(-1.2 * u), r2(2 * u)], to: [r2(r + 2 * u), r2(-1.2 * u), r2(2 * u)], repeat: { n: 2, step: [0, r2(2.4 * u), 0] }, group: 'tech:cable', value: 0.3 });
        crown = [r + 6 * u, 0, 5 * u]; lead = 'stack';
      } else {
        const W = 11 * u * k('works');
        box('works', 'body', [W, 7 * u, 6 * u], [0, 0, 0], 'tech:body', 0.72, { seams: r2(Math.max(0.3, u)), sig: true });
        const n = c.many > 0.6 ? 3 : 2, cr = 1.25 * u * k('chimneys');
        add({ id: 'chimneys', prim: 'drum', role: 'trim', r: r2(cr), h: r2(15 * u), sides: c.lean ? 8 : 10, at: [r2(-W / 2 + 2 * u), r2(1.5 * u), 0], repeat: { n, step: [r2((W - 4 * u) / Math.max(1, n - 1)), 0, 0] }, group: 'tech:frame', value: 0.6 }, true);
        add({ id: 'hopper', prim: 'cone', role: 'intake', r: r2(1.2 * u), r2: r2(2.2 * u), h: r2(2 * u), sides: 4, at: [r2(-W / 4), r2(-1.6 * u), r2(6 * u)], group: 'tech:skin', value: 0.8 });
        add({ id: 'glow', prim: 'lamp', role: 'lamp', r: r2(0.6 * u), at: [r2(W / 2 + 0.1 * u), 0, r2(1.2 * u)], group: 'tech:light', value: 0.9 });
        add({ id: 'belt', prim: 'track', role: 'outlet', len: r2(5 * u), r: r2(0.5 * u), w: r2(1.4 * u), at: [r2(W / 2 + 2.6 * u), 0, 0], group: 'tech:frame', value: 0.3 });
        crown = [0, -1.6 * u, 6 * u]; lead = 'works';
      }
      break;
    }
    case 'dish': {
      const R = 7 * u * k('dish'), pz = 7 * u;
      box('pad', 'mount', [9 * u, 9 * u, 0.8 * u], [0, 0, 0], 'tech:frame', 0.5);
      add({ id: 'pedestal', prim: 'drum', role: 'frame', r: r2(1.4 * u * k('pedestal')), h: r2(pz - 0.8 * u), sides: c.lean ? 8 : 10, at: [0, 0, r2(0.8 * u)], group: 'tech:frame', value: 0.5 }, true);
      add({ id: 'yoke', prim: 'box', role: 'frame', size: [r2(2 * u), r2(4 * u), r2(1.6 * u)], at: [0, 0, r2(pz)], group: 'tech:frame', value: 0.5 });
      const aim = [0.45, -0.5, 0.74];
      add({ id: 'dish', prim: 'dish', role: 'sensor', r: r2(R), depth: r2(R * 0.28), sides: c.lean ? 12 : 16, aim, at: [0, 0, r2(pz + 1.6 * u + R * 0.7)], group: 'tech:skin', value: 0.86 }, true);
      add({ id: 'feed', prim: 'tube', role: 'sensor', r: r2(0.12 * u), sides: 4, from: [0, 0, r2(pz + 1.6 * u + R * 0.7)], to: [r2(aim[0] * R * 0.7), r2(aim[1] * R * 0.7), r2(pz + 1.6 * u + R * 0.7 + aim[2] * R * 0.7)], group: 'tech:frame', value: 0.4 });
      crown = [0, 0, pz + 1.6 * u]; lead = 'dish';
      break;
    }
    case 'barrier': {
      const n = 4, step = 7 * u, h = 8 * u, pr = 1.15 * u * k('pylons');
      add({ id: 'pylons', prim: 'drum', role: 'pier', r: r2(pr), h: r2(h), sides: c.lean ? 6 : 8, at: [r2(-step * (n - 1) / 2), 0, 0], repeat: { n, step: [r2(step), 0, 0] }, group: 'tech:body', value: 0.72 });
      add({ id: 'plates', prim: 'panel', role: 'armour', size: [r2(step * 0.94), r2(h * 0.86 * k('plates'))], t: r2(0.3 * u), aim: [0, 1, 0], at: [r2(-step * (n - 2) / 2), 0, r2(h * 0.43 * k('plates') + 0.3 * u)], repeat: { n: n - 1, step: [r2(step), 0, 0] }, ...glass }, true);
      add({ id: 'caps', prim: 'lamp', role: 'trim', r: r2(0.5 * u), at: [r2(-step * (n - 1) / 2), 0, r2(h)], repeat: { n, step: [r2(step), 0, 0] }, group: 'tech:light', value: 0.85, many: 0.5 });
      crown = [r2(step * (n - 1) / 2), 0, h + 1 * u]; lead = 'plates';
      break;
    }
    case 'launch': {
      const RH = 17 * u * k('rocket'), rr = 1.5 * u * k('rocket');
      box('pad', 'mount', [8 * u, 8 * u, 0.6 * u], [-1.5 * u, 0, 0], 'tech:frame', 0.5);
      add({ id: 'gantry', prim: 'truss', role: 'boom', from: [r2(-4.6 * u), 0, r2(1 * u)], to: [r2(-4.6 * u), 0, r2(1 * u + RH + 4 * u)], w: r2(3.2 * u * k('gantry')), member: r2(0.25 * u), group: 'tech:frame', value: 0.45 }, true);
      box('arm', 'hook', [3.2 * u, 1.2 * u, 1.2 * u], [-2.6 * u, 0, 1 * u + RH * 0.8], 'tech:trim', 0.55);
      add({ id: 'rocket', prim: 'drum', role: 'body', r: r2(rr), h: r2(RH), sides: c.lean ? 8 : 12, at: [0, 0, r2(1 * u)], group: 'tech:body', value: 0.72 }, true);
      add({ id: 'nose', prim: 'cone', role: 'body', r: r2(rr), r2: 0, h: r2(4 * u), sides: c.lean ? 8 : 12, at: [0, 0, r2(1 * u + RH)], group: 'tech:skin', value: 0.82 });
      add({ id: 'fins', prim: 'fin', role: 'trim', l: r2(1.6 * u), h: r2(3 * u), t: r2(0.2 * u), at: [0, 0, r2(1 * u)], repeat: { n: 3, around: r2(rr) }, group: 'tech:skin', value: 0.8 });
      crown = [-4.6 * u, 0, 1 * u + RH + 4 * u]; lead = 'gantry';
      break;
    }
  }
  // ── the top: what it carries where it is highest ──
  const [cx, cy, cz] = crown;
  let status = cz, beacon = fns.includes('signal') || (c.form === 'tower' && !fns.some((f) => ['light', 'sense', 'strike', 'power'].includes(f)));
  if (fns.includes('light') && c.form !== 'stack') {
    add({ id: 'lantern', prim: 'drum', role: 'lamp', r: r2(1.2 * u), h: r2(1.8 * u), sides: c.lean ? 6 : 8, at: [r2(cx), r2(cy), r2(cz)], group: 'tech:light', value: 0.9 });
    add({ id: 'lantern-roof', prim: 'cone', role: 'trim', r: r2(1.5 * u), r2: 0, h: r2(1.2 * u), sides: c.lean ? 6 : 8, at: [r2(cx), r2(cy), r2(cz + 1.8 * u)], group: 'tech:skin', value: 0.8 });
    status = cz + 3 * u;
  }
  if (fns.includes('sense') && c.form !== 'dish') {
    add({ id: 'top-dish', prim: 'dish', role: 'sensor', r: r2(1.7 * u), depth: r2(0.5 * u), aim: [0.5, -0.6, 0.62], at: [r2(cx + 0.8 * u), r2(cy - 0.8 * u), r2(status + 1.4 * u)], group: 'tech:skin', value: 0.86 });
    add({ id: 'top-mast', prim: 'tube', role: 'frame', r: r2(0.15 * u), sides: 6, from: [r2(cx), r2(cy), r2(status)], to: [r2(cx), r2(cy), r2(status + 2.4 * u)], group: 'tech:frame', value: 0.45 });
    status += 2.4 * u;
  }
  if (fns.includes('strike')) {
    add({ id: 'gun-house', prim: 'box', role: 'mount', size: [r2(2.4 * u), r2(2 * u), r2(1.2 * u)], at: [r2(cx), r2(cy), r2(status)], group: 'tech:body', value: 0.66 });
    add({ id: 'gun-barrels', prim: 'drum', role: 'weapon', r: r2(0.22 * u), h: r2(3 * u), axis: 'x', sides: 8, at: [r2(cx + 1.2 * u), r2(cy - 0.4 * u), r2(status + 0.6 * u)], repeat: { n: 2, step: [0, r2(0.8 * u), 0] }, group: 'tech:frame', value: 0.4 });
    status += 1.2 * u;
  }
  if (fns.includes('power') && !['windmill', 'waterwheel', 'stack'].includes(c.form)) {
    add({ id: 'wings', prim: 'panel', role: 'source', size: [r2(2.4 * u), r2(4.4 * u)], t: r2(0.08 * u), seams: r2(Math.max(0.12, 0.6 * u)), aim: [0, -0.55, 0.84], at: [r2(cx), r2(cy), r2(status + 0.8 * u)], group: 'tech:glass', value: 0.16 });
    add({ id: 'cable', prim: 'tube', role: 'carrier', r: r2(0.08 * u), sides: 4, from: [r2(cx + 1.4 * u), r2(cy + 1.4 * u), r2(status)], to: [r2(cx + 1.4 * u), r2(cy + 1.4 * u), 0.05], group: 'tech:cable', value: 0.3 });
    status += 1.6 * u;
  }
  if (beacon) add({ id: 'beacon-mast', prim: 'tube', role: 'frame', r: r2(0.12 * u), sides: 6, from: [r2(cx), r2(cy), r2(status)], to: [r2(cx), r2(cy), r2(status + 2 * u)], group: 'tech:frame', value: 0.45 }), status += 2 * u;
  add({ id: 'status', prim: 'lamp', role: beacon ? 'beacon' : 'status', r: r2(Math.max(0.12, (beacon ? 0.6 : 0.25) * u * k('status'))), at: [r2(cx), r2(cy), r2(status)], group: 'str:accent', value: 0.9 });
  return { parts, sig, lead, used, fns: beacon && !fns.includes('signal') ? [...fns, 'signal'] : fns, tier: 'landmark', mounts: ['ground'] };
}

/** A weapon: in the hand (stood point up, or laid along x when it is aimed), crewed, or emplaced. */
function composeWeapon(c) {
  const s = (c.scale ?? 1) * (c.long ?? 1), { parts, sig, k, add, used } = kit(c), held = !!FORM[c.form].held, fns = fnsOf(c), v = c.variant;
  const box = (id, role, size, at, group, value, { sig: on, ...more } = {}) => add({ id, prim: 'box', role, size: size.map(r2), at: at.map(r2), group, value, ...more }, on);
  const tube = (id, role, r, from, to, group, value, { sig: on, ...more } = {}) => add({ id, prim: 'tube', role, r: r2(r), sides: 6, from: from.map(r2), to: to.map(r2), group, value, ...more }, on);
  const n = Math.max(1, c.barrels ?? 1);
  // energyAt: where coils go on a barrel [x0, z, len, r] (along x); glowAt: on a blade or a head [z, r] (round z)
  let lead, status = null, energyAt = null, glowAt = null;
  switch (c.form) {
    case 'blade': {
      const L = { dagger: 0.28, sword: 0.82, greatsword: 1.25 }[v] * s, W = { dagger: 0.036, sword: 0.052, greatsword: 0.066 }[v] * k('blade'), gl = v === 'greatsword' ? 0.34 : v === 'dagger' ? 0.11 : 0.17;
      add({ id: 'pommel', prim: 'drum', role: 'grip', r: r2(0.028), h: 0.04, sides: 8, at: [0, 0, 0], group: 'tech:trim', value: 0.55 });
      add({ id: 'grip', prim: 'drum', role: 'grip', r: r2(0.018 * k('grip')), h: r2(gl), sides: 8, at: [0, 0, 0.04], group: 'tech:cable', value: 0.35 }, true);
      box('guard', 'trim', [0.03, W * (v === 'dagger' ? 2.6 : 3.4), 0.025], [0, 0, 0.04 + gl], 'tech:trim', 0.55);
      const b0 = 0.07 + gl;
      add({ id: 'blade', prim: 'panel', role: 'weapon', size: [r2(W), r2(L)], t: 0.008, aim: [0, 1, 0], at: [0, 0, r2(b0 + L / 2)], group: 'tech:frame', value: 0.62 }, true);
      for (const [id, yaw] of [['tip', 0], ['tip-b', 180]]) add({ id, prim: 'fin', role: 'weapon', l: r2(W / 2), h: r2(W * 1.6), t: 0.008, yaw, at: [0, 0, r2(b0 + L)], group: 'tech:frame', value: 0.62 });
      lead = 'blade'; glowAt = [b0 + 0.02, W * 0.9];
      break;
    }
    case 'polearm': {
      const L = 2.1 * s, r = 0.02 * k('shaft');
      tube('shaft', 'grip', r, [0, 0, 0], [0, 0, L], 'tech:cable', 0.4, { sig: true });
      if (v === 'trident') {
        box('crossbar', 'weapon', [0.04, 0.24, 0.04], [0, 0, L], 'tech:frame', 0.6, { sig: true });
        for (const [i, y] of [[1, -0.11], [2, 0], [3, 0.11]]) add({ id: `tine-${i}`, prim: 'cone', role: 'weapon', r: 0.016, r2: 0, h: 0.32, sides: 4, at: [0, y, r2(L + 0.04)], group: 'tech:frame', value: 0.62 });
        lead = 'shaft'; glowAt = [L - 0.04, 0.04];
      } else {
        add({ id: 'point', prim: 'cone', role: 'weapon', r: r2(0.04 * k('point')), r2: 0, h: 0.34, sides: 4, at: [0, 0, r2(L)], group: 'tech:frame', value: 0.62 }, true);
        glowAt = [L - 0.02, 0.045];
        if (v === 'halberd') add({ id: 'head', prim: 'panel', role: 'weapon', size: [0.24, 0.22], t: 0.01, aim: [0, 1, 0], at: [0.13, 0, r2(L - 0.14)], group: 'tech:frame', value: 0.62 });
        add({ id: 'socket', prim: 'drum', role: 'trim', r: 0.026, h: 0.12, sides: 6, at: [0, 0, r2(L - 0.12)], group: 'tech:trim', value: 0.5, many: 0.3 });
        lead = 'shaft';
      }
      break;
    }
    case 'axe': {
      const L = 0.8 * s;
      tube('haft', 'grip', 0.017 * k('haft'), [0, 0, 0], [0, 0, L], 'tech:cable', 0.4, { sig: true });
      if (v === 'axe') add({ id: 'head', prim: 'panel', role: 'weapon', size: [r2(0.22 * k('head')), r2(0.24 * k('head'))], t: 0.012, aim: [0, 1, 0], at: [0.1, 0, r2(L - 0.11)], group: 'tech:frame', value: 0.62 }, true);
      else box('head', 'weapon', [0.2 * k('head'), 0.1 * k('head'), 0.13 * k('head')], [0, 0, L - 0.13], 'tech:frame', 0.62, { sig: true });
      add({ id: 'wrap', prim: 'drum', role: 'trim', r: 0.022, h: 0.14, sides: 6, at: [0, 0, 0.04], group: 'tech:trim', value: 0.45, many: 0.5 });
      lead = 'head'; glowAt = [L - 0.18, 0.03];
      break;
    }
    case 'bow': {
      if (v === 'crossbow') {
        box('stock', 'grip', [0.72, 0.05 * k('stock'), 0.07], [0, 0, 0], 'tech:cable', 0.4, { sig: true });
        for (const [sd, y] of [['l', -1], ['r', 1]]) tube(`limb-${sd}`, 'weapon', 0.017 * k('limb-l'), [0.32, 0, 0.06], [0.24, y * 0.36, 0.06], 'tech:frame', 0.6, { sig: sd === 'l' });
        tube('string', 'trim', 0.003, [0.24, -0.36, 0.06], [0.08, 0, 0.07], 'tech:cable', 0.3);
        tube('string-b', 'trim', 0.003, [0.24, 0.36, 0.06], [0.08, 0, 0.07], 'tech:cable', 0.3);
        box('trigger', 'trim', [0.02, 0.02, 0.06], [-0.1, 0, -0.04], 'tech:trim', 0.5);
        lead = 'stock'; energyAt = [-0.1, 0.035, 0.3, 0.05];
      } else {
        const h = 1.5 * s;
        add({ id: 'riser', prim: 'drum', role: 'grip', r: r2(0.022 * k('riser')), h: 0.16, sides: 8, at: [0, 0, r2(h / 2 - 0.08)], group: 'tech:cable', value: 0.4 }, true);
        // the stave, one piece from tip to tip through the riser; the string a line behind it
        tube('stave', 'weapon', 0.017 * k('stave'), [0, 0, 0], [0, 0, h], 'tech:frame', 0.6, { sig: true });
        for (const [id, z, d] of [['tip-up', h, 1], ['tip-down', 0, -1]]) tube(id, 'trim', 0.012, [0, 0, z - d * 0.1], [0.05, 0, z], 'tech:frame', 0.55, { many: 0.4 });
        tube('string', 'trim', 0.003, [-0.18, 0, h - 0.04], [-0.18, 0, 0.04], 'tech:cable', 0.3);
        tube('arrow', 'trim', 0.006, [-0.18, 0, h / 2], [0.5, 0, h / 2], 'tech:cable', 0.35, { many: 0.5 });
        lead = 'stave'; glowAt = [h / 2 + 0.1, 0.03];
      }
      break;
    }
    case 'staff': {
      const L = 1.7 * s;
      tube('shaft', 'grip', 0.021 * k('shaft'), [0, 0, 0], [0, 0, L], 'tech:cable', 0.4, { sig: true });
      add({ id: 'head', prim: 'lamp', role: 'weapon', r: r2(0.055 * k('head')), at: [0, 0, r2(L + 0.02)], group: 'tech:light', value: 0.9 }, true);
      add({ id: 'prongs', prim: 'ring', role: 'trim', r: 0.07, tube: 0.008, sides: 8, at: [0, 0, r2(L + 0.07)], group: 'tech:trim', value: 0.5, many: 0.3 });
      lead = 'shaft'; glowAt = [L - 0.1, 0.035];
      break;
    }
    case 'gun': {
      if (v === 'pistol') {
        box('grip', 'grip', [0.04, 0.034 * k('grip'), 0.11], [0, 0, 0], 'tech:cable', 0.4, { sig: true });
        box('slide', 'weapon', [0.2 * s, 0.034 * k('slide'), 0.045], [0.06, 0, 0.11], 'tech:frame', 0.6, { sig: true });
        add({ id: 'barrel', prim: 'drum', role: 'weapon', r: 0.011, h: 0.04, axis: 'x', sides: 6, at: [r2(0.06 + 0.1 * s), 0, 0.135], group: 'tech:frame', value: 0.4 });
        energyAt = [0.07, 0.135, 0.08 * s, 0.016]; lead = 'slide';
      } else {
        const Lb = 0.62 * s;
        box('stock', 'grip', [0.38, 0.05 * k('stock'), 0.13], [-0.32, 0, 0], 'tech:cable', 0.4, { sig: true });
        box('receiver', 'weapon', [0.26, 0.044, 0.07], [0.0, 0, 0.06], 'tech:frame', 0.62);
        add({ id: 'barrel', prim: 'tube', role: 'weapon', r: r2(0.016 * k('barrel')), sides: 6, from: [0.17, 0, 0.093], to: [r2(0.17 + Lb), 0, 0.093], group: 'tech:frame', value: 0.6 }, true);
        box('handle', 'grip', [0.04, 0.032, 0.06], [-0.07, 0, -0.01], 'tech:cable', 0.4);
        box('magazine', 'trim', [0.05, 0.03, 0.09], [0.08, 0, -0.04], 'tech:trim', 0.5, { many: 0.4 });
        add({ id: 'scope', prim: 'drum', role: 'trim', r: 0.02, h: 0.16, axis: 'x', sides: 6, at: [-0.06, 0, 0.16], group: 'tech:glass', value: 0.2, many: 0.6 });
        energyAt = [0.22, 0.093, Lb * 0.6, 0.032]; lead = 'stock';
      }
      break;
    }
    case 'shield': {
      // an energy shield's face is a field, its rim a ring of light
      const face = c.energy ? { group: 'tech:glass', value: 0.2 } : { group: 'tech:skin', value: 0.8 };
      if (v === 'buckler') add({ id: 'face', prim: 'drum', role: 'armour', r: r2(0.24 * s * k('face')), h: 0.04, axis: 'x', sides: c.lean ? 10 : 14, at: [-0.02, 0, r2(0.24 * s)], ...face }, true);
      else add({ id: 'face', prim: 'panel', role: 'armour', size: [r2(0.6 * s * k('face')), r2(0.9 * s * k('face'))], t: 0.03, aim: [1, 0, 0], at: [0, 0, r2(0.45 * s)], ...face }, true);
      add({ id: 'boss', prim: 'drum', role: 'trim', r: 0.07, h: 0.05, axis: 'x', sides: 8, at: [0.015, 0, r2(v === 'buckler' ? 0.24 * s : 0.5 * s)], group: 'tech:trim', value: 0.55, many: 0.2 });
      tube('grip', 'grip', 0.015, [-0.05, -0.09, v === 'buckler' ? 0.24 * s : 0.5 * s], [-0.05, 0.09, v === 'buckler' ? 0.24 * s : 0.5 * s], 'tech:cable', 0.35);
      add({ id: c.energy ? 'coils' : 'rim', prim: 'ring', role: 'trim', r: r2(0.25 * s), tube: 0.012, axis: 'x', sides: 12, at: [0.02, 0, r2(v === 'buckler' ? 0.24 * s : 0.45 * s)], ...(c.energy ? { group: 'tech:light', value: 0.85 } : { group: 'tech:trim', value: 0.5, many: 0.6 }) });
      lead = 'face';
      break;
    }
    case 'cannon': {
      if (v === 'mortar') {
        box('bed', 'mount', [0.8 * s, 0.8 * s, 0.22 * s], [0, 0, 0], 'tech:body', 0.66, { sig: true });
        add({ id: 'barrel', prim: 'tube', role: 'weapon', r: r2(0.32 * s * k('barrel')), sides: 10, from: [0, 0, r2(0.22 * s)], to: [r2(0.4 * s), 0, r2(1.4 * s)], group: 'tech:frame', value: 0.6 }, true);
        glowAt = [0.8 * s, 0.4 * s, 0.17 * s]; lead = 'barrel'; status = [-0.4 * s, 0, 0.4 * s];
      } else {
        const Lb = 2.2 * s;
        for (const sd of [-1, 1]) box(`cheek-${sd < 0 ? 'l' : 'r'}`, 'mount', [1.5 * s, 0.12 * s, 0.55 * s], [0, sd * 0.32 * s, 0.5 * s], 'tech:body', 0.66);
        add({ id: 'wheels', prim: 'wheel', role: 'mount', r: r2(0.62 * s * k('wheels')), w: r2(0.12 * s), sides: c.lean ? 10 : 12, at: [0.1, r2(-0.5 * s), 0], repeat: { n: 2, step: [0, r2(s), 0] }, group: 'tech:frame', value: 0.3 }, true);
        tube('trail', 'mount', 0.1 * s, [-0.6 * s, 0, 0.55 * s], [-2 * s, 0, 0.06], 'tech:frame', 0.4);
        add({ id: 'barrel', prim: 'tube', role: 'weapon', r: r2(0.17 * s * k('barrel')), sides: 10, from: [r2(-0.6 * s), 0, r2(1.1 * s)], to: [r2(-0.6 * s + Lb), 0, r2(1.3 * s)], group: 'tech:frame', value: 0.6 }, true);
        energyAt = [0.2 * s, 1.18 * s, Lb * 0.5, 0.36 * s]; lead = 'wheels'; status = [-1.1 * s, 0, 0.9 * s];
      }
      break;
    }
    case 'siege': {
      box('rails', 'mount', [v === 'trebuchet' ? 3.6 * s : 2.8 * s, 0.22 * s * k('rails'), 0.24 * s], [0, -0.8 * s, 0], 'tech:frame', 0.55, { repeat: { n: 2, step: [0, r2(1.6 * s), 0] } });
      if (v === 'trebuchet') {
        const pz = 3.4 * s;
        for (const sd of [-1, 1]) for (const [x, id] of [[-1, 'a'], [1, 'b']]) tube(`leg-${sd < 0 ? 'l' : 'r'}${id}`, 'mount', 0.1 * s, [x * 1.1 * s, sd * 0.8 * s, 0.3 * s], [0, sd * 0.8 * s, pz], 'tech:frame', 0.45);
        tube('axle', 'mount', 0.08 * s, [0, -0.9 * s, pz], [0, 0.9 * s, pz], 'tech:frame', 0.45);
        add({ id: 'arm', prim: 'tube', role: 'weapon', r: r2(0.17 * s * k('arm')), sides: 6, from: [r2(1.2 * s), 0, r2(pz - 0.8 * s)], to: [r2(-3.6 * s), 0, r2(pz + 2.6 * s)], group: 'tech:frame', value: 0.6 }, true);
        box('weight', 'trim', [0.7 * s, 0.7 * s, 0.8 * s], [1.2 * s, 0, pz - 1.7 * s], 'tech:body', 0.66);
        tube('sling', 'trim', 0.02 * s, [-3.4 * s, 0, pz + 2.4 * s], [-3.1 * s, 0, pz + 0.8 * s], 'tech:cable', 0.3);
        lead = 'arm';
      } else {
        for (const sd of [-1, 1]) box(`post-${sd < 0 ? 'l' : 'r'}`, 'mount', [0.22 * s, 0.22 * s, 1.5 * s], [0.4 * s, sd * 0.8 * s, 0.3 * s], 'tech:frame', 0.45);
        box('stop', 'mount', [0.24 * s, 1.84 * s, 0.24 * s], [0.4 * s, 0, 1.8 * s], 'tech:frame', 0.5);
        add({ id: 'arm', prim: 'tube', role: 'weapon', r: r2(0.17 * s * k('arm')), sides: 6, from: [r2(-1.3 * s), 0, r2(0.45 * s)], to: [r2(0.6 * s), 0, r2(2.2 * s)], group: 'tech:frame', value: 0.6 }, true);
        add({ id: 'cup', prim: 'dish', role: 'weapon', r: r2(0.32 * s), depth: r2(0.14 * s), sides: 8, aim: [0.5, 0, 0.86], at: [r2(0.65 * s), 0, r2(2.2 * s)], group: 'tech:body', value: 0.66 });
        if (c.many >= 0.5) for (const sd of [-1, 1]) add({ id: `wheels-${sd < 0 ? 'l' : 'r'}`, prim: 'wheel', role: 'mount', r: r2(0.35 * s), w: r2(0.1 * s), sides: 10, at: [r2(-1.3 * s), r2(sd * 1.0 * s), 0], repeat: { n: 2, step: [r2(2.6 * s), 0, 0] }, group: 'tech:frame', value: 0.3 });
        lead = 'arm';
      }
      status = [1.6 * s, 0, 0.3 * s];
      break;
    }
    case 'ballista': {
      const z = 1.15 * s;
      for (const [i, a] of [[1, 0], [2, 2.094], [3, 4.189]]) tube(`leg-${i}`, 'mount', 0.07 * s, [r2(Math.cos(a) * 0.9 * s), r2(Math.sin(a) * 0.9 * s), 0], [0, 0, z], 'tech:frame', 0.45);
      box('stock', 'mount', [2 * s, 0.22 * s * k('stock'), 0.2 * s], [0, 0, z], 'tech:body', 0.66, { sig: true });
      for (const [sd, y] of [['l', -1], ['r', 1]]) tube(`limb-${sd}`, 'weapon', 0.1 * s * k('limb-l'), [0.75 * s, y * 0.14 * s, z + 0.12 * s], [0.5 * s, y * 1.15 * s, z + 0.16 * s], 'tech:frame', 0.6, { sig: sd === 'l' });
      tube('string', 'trim', 0.012 * s, [0.5 * s, -1.15 * s, z + 0.16 * s], [-0.3 * s, 0, z + 0.22 * s], 'tech:cable', 0.3);
      tube('string-b', 'trim', 0.012 * s, [0.5 * s, 1.15 * s, z + 0.16 * s], [-0.3 * s, 0, z + 0.22 * s], 'tech:cable', 0.3);
      tube('bolt', 'trim', 0.03 * s, [-0.3 * s, 0, z + 0.24 * s], [1.3 * s, 0, z + 0.24 * s], 'tech:frame', 0.5, { many: 0.3 });
      add({ id: 'winch', prim: 'drum', role: 'trim', r: r2(0.12 * s), h: r2(0.5 * s), axis: 'y', sides: 8, at: [r2(-0.9 * s), r2(-0.25 * s), r2(z + 0.2 * s)], group: 'tech:frame', value: 0.45, many: 0.5 });
      lead = 'stock'; status = [-1 * s, 0, z + 0.2 * s];
      break;
    }
    case 'launcher': {
      add({ id: 'base', prim: 'drum', role: 'mount', r: r2(0.8 * s), h: r2(0.5 * s), sides: c.lean ? 8 : 12, at: [0, 0, 0], group: 'tech:frame', value: 0.55 });
      box('yoke', 'mount', [0.5 * s, 1.5 * s, 0.6 * s], [0, 0, 0.5 * s], 'tech:frame', 0.5);
      const cols = c.barrels ? Math.max(2, n) : 3;
      box('pod', 'mount', [1.4 * s, (0.4 * cols + 0.2) * s * k('pod'), 1.0 * s], [0, 0, 1.1 * s], 'tech:body', 0.66, { sig: true });
      for (const [row, z] of [['a', 1.35 * s], ['b', 1.8 * s]]) add({ id: `tubes-${row}`, prim: 'drum', role: 'weapon', r: r2(0.15 * s), h: r2(0.24 * s), axis: 'x', sides: 8, at: [r2(0.7 * s), r2(-(cols - 1) * 0.2 * s), r2(z)], repeat: { n: cols, step: [0, r2(0.4 * s), 0] }, group: 'tech:frame', value: 0.4 }, row === 'a');
      lead = 'pod'; status = [-0.6 * s, 0, 2.1 * s];
      break;
    }
    case 'turret': {
      box('pad', 'mount', [2.8 * s, 2.8 * s, 0.25 * s], [0, 0, 0], 'tech:frame', 0.5);
      add({ id: 'ring', prim: 'drum', role: 'mount', r: r2(1.2 * s), h: r2(0.5 * s), sides: c.lean ? 10 : 14, at: [0, 0, r2(0.4 * s)], group: 'tech:frame', value: 0.55 });
      box('housing', 'mount', [2.7 * s * k('housing'), 2.2 * s * k('housing'), 1.3 * s * k('housing')], [0, 0, 0.75 * s], 'tech:body', 0.7, { seams: r2(Math.max(0.3, 0.6 * s)), sig: true });
      const nb = Math.max(1, c.barrels ?? 1), bz = 0.75 * s + 0.68 * s * k('housing');
      add({ id: 'barrels', prim: 'drum', role: 'weapon', r: r2(0.13 * s * k('barrels')), h: r2(2.6 * s), axis: 'x', sides: 8, at: [r2(1.1 * s * k('housing')), r2(-(nb - 1) * 0.18 * s), r2(bz)], ...(nb > 1 ? { repeat: { n: nb, step: [0, r2(0.36 * s), 0] } } : {}), group: 'tech:frame', value: 0.45 }, true);
      energyAt = [1.6 * s, bz, 1.6 * s, 0.34 * s]; lead = 'housing'; status = [-0.8 * s, 0, 0.75 * s + 1.3 * s * k('housing')];
      if (c.sensor) add({ id: 'eye', prim: 'dish', role: 'sensor', r: r2(0.34 * s), depth: r2(0.12 * s), sides: 8, aim: [1, 0, 0.2], at: [r2(0.6 * s), r2(0.75 * s), r2(0.75 * s + 1.5 * s * k('housing'))], group: 'tech:skin', value: 0.85 });
      break;
    }
  }
  // more barrels on a hand gun or a cannon: a second barrel beside the first
  if (c.barrels && c.barrels > 1 && ['gun', 'cannon'].includes(c.form) && v !== 'pistol') {
    const B = parts.find((p) => p.id === 'barrel');
    if (B?.prim === 'tube') B.at = [0, r2(-(n - 1) * B.r * 1.1), 0], B.repeat = { n, step: [0, r2(B.r * 2.2), 0] };
  }
  // what fires light: coils along the barrel, or round a blade or a head; in the hand they are collars (a ring is
  // too big a primitive for a hand), on a crewed weapon rings
  const coil = (at, r, axis, step) => add(held
    ? { id: 'coils', prim: 'drum', role: 'trim', r: r2(Math.max(0.02, r)), h: 0.02, axis, sides: 6, at: at.map(r2), repeat: { n: 2, step: step.map(r2) }, group: 'tech:light', value: 0.85 }
    : { id: 'coils', prim: 'ring', role: 'trim', r: r2(r), tube: r2(Math.max(0.02, r * 0.12)), axis, sides: 8, at: at.map(r2), repeat: { n: 2, step: step.map(r2) }, group: 'tech:light', value: 0.85 });
  if (c.energy && energyAt) { const [x0, z, len, r] = energyAt; coil([x0, 0, z], held ? r * 0.7 : r * 0.5, 'x', [len / 2, 0, 0]); }
  else if (c.energy && glowAt) coil([glowAt[2] ?? 0, 0, glowAt[0]], glowAt[1], 'z', [0, 0, held ? -0.05 : -0.2]);
  // a crewed or emplaced weapon carries the status light; a hand weapon wears none
  if (status) add({ id: 'status', prim: 'lamp', role: 'status', r: r2(Math.max(0.06, 0.1 * s)), at: status.map(r2), group: 'str:accent', value: 0.9 });
  const tier = held ? 'held' : FORM[c.form].tier ?? (c.tier === 'installation' ? 'installation' : 'machine');
  return { parts, sig, lead, used, fns, tier, mounts: held ? ['hand'] : ['ground'], ...(held ? {} : { ring: 'near' }) };
}

const COMPOSE = { vehicle: composeVehicle, structure: composeStructure, weapon: composeWeapon };

/** A crafted thing's block from a candidate: its kind's grammar, every number inside its primitive's rail. */
// a piece's section, scaled: what a factor the grammar did not size by itself does to it (its length stays)
const SECTION = ['r', 'r2', 'tube', 'w', 'depth', 'member', 'l', 'h'];
function scaled(p, f) {
  for (const key of SECTION) if (typeof p[key] === 'number' && !(key === 'h' && ['drum', 'cone'].includes(p.prim))) p[key] = r2(p[key] * f);
  if (Array.isArray(p.size)) p.size = p.size.map((v) => r2(v * f));
}
export function composeCraft(c) {
  const g = COMPOSE[c.kind](c);
  for (const p of g.parts) {
    if (c.thick?.[p.id] && !g.used.has(p.id)) scaled(p, c.thick[p.id]);
    if (c.slim?.[p.id]) scaled(p, c.slim[p.id]);
  }
  for (const p of g.parts) for (const [key, [lo, hi]] of Object.entries(PRIMITIVES[p.prim].rails)) {
    if (typeof p[key] === 'number') p[key] = r2(Math.min(hi, Math.max(lo, p[key])));
    else if (Array.isArray(p[key])) p[key] = p[key].map((x) => (typeof x === 'number' ? r2(Math.min(hi, Math.max(lo, x))) : x));
  }
  return readBlock({ id: c.id, read: c.read, tier: g.tier, functions: g.fns, mounts: g.mounts, ...(g.ring ? { ring: g.ring } : {}), parts: g.parts, sig: [...new Set(g.sig)], lead: g.lead });
}

// ── the domain ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** A structure stands out: from across the level (the far ring) its signature is geometry, and it is eight metres or more. */
export function standsOut(block, built, { seed = 1, library = STARTER_BLOCKS } = {}) {
  const far = buildBlock(block, { seed, ring: 'far', library, many: built.params.many }), lost = (block.sig ?? []).filter((id) => far.parts.find((p) => p.id === id)?.shown !== 'geometry');
  const big = Math.max(...built.box.size);
  return { law: 'stands-out', want: 'a tech-structure is seen across the level: 8 m or more, its signature geometry at far', ok: !lost.length && big >= 8, value: lost.length ? `lost at far: ${lost.join(', ')}` : big < 8 ? `${big} m` : `${big} m, all shown at far` };
}

export function craftDomain(kind, { library = STARTER_BLOCKS } = {}) {
  if (!CRAFT_KINDS[kind]) throw new Error(`crafter: '${kind}' is not a kind of craft (${CRAFT_KIND_IDS.join(', ')})`);
  const TRAITS = CRAFT_TRAITS[kind];
  return {
    id: `craft-${kind}`, TRAITS,
    start: (seed, base) => ({ id: base?.id ?? kind, read: base?.read ?? '', kind, form: DEFAULT[kind][0], variant: DEFAULT[kind][1], formBy: null, functions: [], scale: 1, many: 0.5, thick: {}, setBy: {}, ...(base ?? {}) }),
    pull(cand, T, id) {
      const c = clone(cand), changed = [];
      if (T.form) {
        // a thing is one form. A word that names a kind in general (a tower, a gun) gives way to one that names it; of
        // two that name it, the last is the thing (a forcefield gate is a gate), and the first says how it looks
        if (c.formBy && c.formBy !== id) {
          const was = TRAITS[c.formBy];
          if (T.generic && !was.generic) { c.absorbed = [...(c.absorbed ?? []), id]; changed.push(`a ${c.variant} already: '${id}' says no more`); return { candidate: c, changed }; }
          c.absorbed = [...(c.absorbed ?? []), c.formBy];
          changed.push(`'${c.formBy}' gives way: the last form named is the thing`);
        }
        c.form = T.form; c.variant = T.variant; c.formBy = id; changed.push(`a ${T.variant} (${T.form})`);
      } else if (T.fn) { if (!c.functions.includes(T.fn)) { c.functions.push(T.fn); changed.push(`shows ${T.fn}`); } }
      else for (const [k, v] of Object.entries(T.set)) { if (c.setBy[k] && c.setBy[k] !== id) { changed.push(`${k}: kept from ${c.setBy[k]}`); continue; } c[k] = v; c.setBy[k] = id; changed.push(`${k} = ${v}`); }
      return { candidate: c, changed };
    },
    build(cand, seed) {
      const c = clone(cand);
      c.read ||= `${c.variant}: ${CRAFT_TRAITS[kind][c.formBy ?? Object.keys(TRAITS).find((t) => TRAITS[t].variant === c.variant)]?.read ?? c.form}`;
      const block = composeCraft(c), b = buildBlock(block, { seed, library, many: c.many });
      const laws = blockLaws(block, b);
      if (kind === 'structure') laws.push(standsOut(block, b, { seed, library }));
      return { block, b, laws };
    },
    measure(T, id, built, cand) {
      const B = built.block, has = (pid) => built.b.parts.some((p) => p.id === pid && p.shown !== 'absent'), role = (r) => built.b.parts.some((p) => p.role === r && p.shown !== 'absent');
      if (T.form) return { ok: (cand.form === T.form && cand.variant === T.variant) || (cand.absorbed ?? []).includes(id), value: `${cand.variant} (${cand.form})` };
      if (T.fn) { const l = built.laws.find((x) => x.law === 'functions-read'); const miss = !l.ok && l.value.includes(`${T.fn}:`); return { ok: B.functions.includes(T.fn) && !miss, value: miss ? l.value : `shows ${T.fn}` }; }
      const s = T.set;
      if (s.armour) return { ok: role('armour'), value: role('armour') ? 'plated' : 'no plates' };
      if (s.armed) return { ok: role('weapon'), value: role('weapon') ? 'armed' : 'no gun' };
      if (s.cargo) return { ok: role('store'), value: role('store') ? 'crates' : 'nothing carried' };
      if (s.sail) return { ok: has('sail'), value: has('sail') ? 'under sail' : `a ${cand.variant} takes no sail` };
      if (s.stack) return { ok: has('stack'), value: has('stack') ? 'a stack' : 'no stack' };
      if (s.energy) return { ok: has('coils'), value: has('coils') ? 'coils' : `a ${cand.variant} fires nothing` };
      if (s.field) return { ok: ['field', 'leaf', 'plates'].some(has) && ['gate', 'portal', 'barrier'].includes(cand.form), value: ['gate', 'portal', 'barrier'].includes(cand.form) ? 'a field across it' : `a ${cand.variant} has no opening to fill` };
      if (s.lattice) return { ok: B.parts.some((p) => p.prim === 'truss'), value: B.parts.some((p) => p.prim === 'truss') ? 'a lattice' : `a ${cand.variant} is not framed` };
      if (s.barrels) { const p = built.b.parts.find((x) => x.role === 'weapon' && /barrel|tubes/.test(x.id)); return { ok: !!p && (p.n >= s.barrels || cand.form === 'launcher'), value: p ? `${p.n} barrels` : 'no barrel' }; }
      if (s.sensor) return { ok: role('sensor'), value: role('sensor') ? 'it aims itself' : `a ${cand.variant} has nowhere to carry its eye` };
      if (s.tier) return { ok: B.tier === s.tier, value: B.tier };
      if (s.tall) return { ok: true, value: `${built.b.box.size[2]} m high` };
      if (s.long) return { ok: true, value: `× ${s.long}` };
      if (s.scale) return { ok: true, value: `× ${s.scale}` };
      if (s.many !== undefined) return { ok: Math.abs(built.b.params.many - s.many) < 1e-9, value: `many ${built.b.params.many}` };
      return { ok: true, value: '' };
    },
    laws: (built) => built.laws,
    tweak(cand, failed, pass, seed) {
      const c = clone(cand), changed = [];
      const thicken = (id, by = 1.25) => { c.thick = { ...(c.thick ?? {}), [id]: r2((c.thick?.[id] ?? 1) * by) }; changed.push(`${id} × ${c.thick[id]}`); };
      for (const l of failed.laws) {
        if (l.law === 'one-leads') {
          const [lead, next] = [String(l.value).split(' ')[0], String(l.value).split(' over ')[1]?.split(' ')[0]];
          thicken(lead, 1.15); changed[changed.length - 1] += ' (one leads)';
          if (next && !(composeCraft(cand).sig ?? []).includes(next)) { c.slim = { ...(c.slim ?? {}), [next]: r2((c.slim?.[next] ?? 1) * 0.85) }; changed.push(`${next} × ${c.slim[next]} (gives way)`); }
        }
        else if (l.law === 'reads-at-ring' || (l.law === 'stands-out' && /^lost/.test(l.value))) {
          for (const id of String(l.value).replace(/^lost( at far)?: /, '').split(', ').filter(Boolean)) thicken(id), changed[changed.length - 1] += ` (${l.law === 'stands-out' ? 'stands out' : 'reads at its ring'})`;
        }
        else if (l.law === 'stands-out') { c.scale = r2((c.scale ?? 1) * 1.25); changed.push(`a size up, × ${c.scale} (stands out)`); }
        else if (l.law === 'budget') { if (c.many > 0) { c.many = r2(Math.max(0, c.many - 0.3)); changed.push(`many ${c.many} (budget)`); } else if (!c.lean) { c.lean = true; changed.push('fewer sides (budget)'); } }
      }
      return { candidate: c, changed: changed.length ? changed : [`reseed ${seed + 1}`], reseed: changed.length ? undefined : seed + 1 };
    },
    plan: (cand, built) => ({ block: built.block, kind, form: cand.form, variant: cand.variant, dials: dialsOf(cand), ...(CARRIES[`${cand.form}/${cand.variant}`] && EQUIPMENT_ITEMS.includes(CARRIES[`${cand.form}/${cand.variant}`]) ? { carries: CARRIES[`${cand.form}/${cand.variant}`] } : {}) }),
  };
}

/** What the words set on a thing, beyond its form: the dials a chassis grammar reads (tech-chassis.js). */
const DIALS = ['scale', 'tall', 'lattice', 'armour', 'armed', 'cargo', 'sail', 'stack', 'energy', 'field', 'barrels', 'long', 'sensor', 'tier', 'many'];
const dialsOf = (c) => Object.fromEntries(DIALS.filter((k) => c[k] !== undefined && !(k === 'scale' && c[k] === 1) && !(k === 'many' && c[k] === 0.5)).map((k) => [k, c[k]]));

/** A name for a crafted thing from its intent: its first few words, hyphenated. */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').filter((w) => !['a', 'an', 'the', 'of', 'and', 'with', 'that'].includes(w)).slice(0, 4).join('-') || 'craft';

/** Craft an intent of a kind into a block: the tunnel's record, its plan { block, kind, form, variant, carries? }. */
export function craftTech(kind, intent, { seed = 1, id, library = STARTER_BLOCKS, passes = 8 } = {}) {
  return tunnel(craftDomain(kind, { library }), { intent, seed, passes, base: { id: id ?? slug(intent), read: intent } });
}

/** The kind whose form the words name first ("a war wagon" a vehicle, "a gun tower" a structure), or null. */
export function craftKindOf(intent) {
  let best = null;
  for (const kind of CRAFT_KIND_IDS) {
    const r = readIntent({ id: kind, TRAITS: CRAFT_TRAITS[kind] }, intent), first = r.traits.find((t) => CRAFT_TRAITS[kind][t.id].form);
    if (!first) continue;
    // the form named last is the thing ("a gun tower": a tower that carries a gun); a tie goes to the kind listed first
    const at = r.words.lastIndexOf(first.word) >= 0 ? r.words.lastIndexOf(first.word) : r.words.findIndex((w) => w.replace(/s$/, '') === first.word);
    if (!best || at > best.at) best = { kind, at };
  }
  return best?.kind ?? null;
}
