/**
 * THE HERO'S ADORNMENT — the third page of the hero, over the pinned base: equipment based on the main loop's final
 * design. The loop is the actions page (actions.js): the power set and its escalation. So an item exists because a power
 * needs it (`serves`), grows with the stage that unlocks it (`tiers`), and may serve a second power as an alternate use
 * (`alt`). What the page conceives is the TEMPLATE of its class of gear: the world's equipment table (equipment.js) is
 * seeded from it, and equipped once the game's stats exist. The bare base is never overwritten.
 *
 *   adornment: {
 *     items: [{
 *       id, slot: 'right' | 'left' | 'back' | 'hip',          // where the hero carries it (polygonizer/hero-gear.js)
 *       build: { item, style?, dials?, parts?, gem?, seed? },  // an equipment build, without its `type`
 *       serves: [power ids],                                   // what it exists for
 *       tiers?: { early?, mid?, late? },                       // build diffs, cumulative: each stage keeps the last's
 *       alt?: [{ id, use, serves?: [power ids], build? }],     // alternate uses: a build diff, tied to another power
 *     }],
 *     bodily?: [power ids],                                    // powers the body carries: they need no item
 *   }
 *
 * Pure. `readAdornment` reads the shape and refuses what the equipment kernel refuses (every build, every tier and every
 * alternate use is judged by `validateGear`, as the door judges it). `resolveAdornment` reads the page against the
 * resolved actions page and says what the loop leaves open: a power an item serves that is not a power, and the final
 * design's powers that nothing carried serves. It advises; nothing refuses.
 */
import { validateGear, GEAR_SLOTS } from '../polygonizer/hero-gear.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { STAGES } from './actions.js';

const BUILD_KEYS = ['item', 'style', 'dials', 'parts', 'gem', 'seed'];
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (m) => new Error(`characters: hero.adornment${m}`);

/** A build diff laid over a build: dials and parts merge a level deep, every other key replaces. */
export function applyDiff(build, diff) {
  if (!diff) return build;
  const out = { ...build };
  for (const [k, v] of Object.entries(diff)) out[k] = (k === 'dials' || k === 'parts') && isObj(v) && isObj(build[k]) ? { ...build[k], ...v } : v;
  return out;
}

/** An item's build at a stage: the base build with each tier up to and including `stage` laid over it, in order. */
export function buildAt(item, stage, altId) {
  let b = item.build;
  const upto = stage ? STAGES.indexOf(stage) : STAGES.length - 1;
  for (const s of STAGES.slice(0, upto + 1)) b = applyDiff(b, item.tiers?.[s]);
  if (altId) b = applyDiff(b, item.alt.find((a) => a.id === altId).build);
  return b;
}

function readDiff(d, at, what, fail = err) {
  if (!isObj(d)) throw fail(`${at} is ${what}: { ${BUILD_KEYS.join(', ')} }, only what it changes`);
  for (const k of Object.keys(d)) if (!BUILD_KEYS.includes(k)) throw fail(`${at}.${k} is not an equipment build word (${BUILD_KEYS.join(', ')})`);
  return { ...d };
}

function checkBuild(slot, build, at, fail = err) {
  const errs = validateGear({ [slot]: build });
  if (errs.length) throw fail(`${at}: ${errs.join('; ')}`);
}

/**
 * A held build and its tiers, read and judged by the equipment kernel at `slot` (each tier over the last's): what an
 * adornment item and an equipment class share. `fail(message)` makes the page's own error. → { build, tiers? }
 */
export function readGearBuild({ build: b, tiers: t }, slot, at, fail = err) {
  const build = readDiff(b, `${at}.build`, 'an equipment build', fail);
  if (!EQUIPMENT_ITEMS.includes(build.item)) throw fail(`${at}.build.item is ${EQUIPMENT_ITEMS.join(', ')}`);
  checkBuild(slot, build, `${at}.build`, fail);
  if (t === undefined) return { build };
  if (!isObj(t)) throw fail(`${at}.tiers is { ${STAGES.join(', ')} }, each a build diff`);
  for (const k of Object.keys(t)) if (!STAGES.includes(k)) throw fail(`${at}.tiers.${k} is not a stage (${STAGES.join(', ')})`);
  const tiers = {};
  let grown = build;
  for (const s of STAGES) if (t[s] !== undefined) {
    tiers[s] = readDiff(t[s], `${at}.tiers.${s}`, 'a tier', fail);
    grown = applyDiff(grown, tiers[s]);
    checkBuild(slot, grown, `${at}.tiers.${s}`, fail);
  }
  return { build, tiers };
}

const powerIds = (v, at) => {
  if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string' && x)) throw err(`${at} is a list of power ids (the hero's actions: the powers it exists for)`);
  return [...v];
};

/** Read the adornment page's shape and say what is wrong; every build is judged by the equipment kernel. */
export function readAdornment(A) {
  if (!isObj(A)) throw err(' is { items, bodily? }');
  if (A.variations !== undefined) throw err('.variations: loadouts are retired; each item is the template of its class in the world\'s equipment table (equipment.js), equipped once the stats exist');
  for (const k of Object.keys(A)) if (!['items', 'bodily'].includes(k)) throw err(`.${k} is not part of the adornment page (items, bodily)`);
  if (A.bodily !== undefined && !(Array.isArray(A.bodily) && A.bodily.every((x) => typeof x === 'string' && x))) throw err('.bodily is a list of power ids the body carries, which need no item');
  if (!Array.isArray(A.items) || (!A.items.length && !A.bodily?.length)) throw err('.items is a list of { id, slot, build, serves }: the equipment the main loop calls for');
  const seen = new Set();
  const items = A.items.map((it, i) => {
    const at = `.items[${i}]`;
    if (!isObj(it)) throw err(`${at} is { id, slot, build, serves, tiers?, alt? }`);
    for (const k of Object.keys(it)) if (!['id', 'slot', 'build', 'serves', 'tiers', 'alt'].includes(k)) throw err(`${at}.${k} is not part of an item (id, slot, build, serves, tiers, alt)`);
    if (!ID.test(it.id ?? '')) throw err(`${at}.id is a lowercase id ("wind-staff")`);
    if (seen.has(it.id)) throw err(`${at}.id '${it.id}' appears twice`);
    seen.add(it.id);
    if (!GEAR_SLOTS.includes(it.slot)) throw err(`${at}.slot is ${GEAR_SLOTS.map((s) => `'${s}'`).join(', ')}`);
    const { build, tiers } = readGearBuild(it, it.slot, at);
    const out = { id: it.id, slot: it.slot, build, serves: powerIds(it.serves, `${at}.serves`), ...(tiers ? { tiers } : {}) };
    if (it.alt !== undefined) {
      if (!Array.isArray(it.alt)) throw err(`${at}.alt is a list of { id, use, serves?, build? }`);
      const altSeen = new Set();
      out.alt = it.alt.map((a, j) => {
        const aat = `${at}.alt[${j}]`;
        if (!isObj(a)) throw err(`${aat} is { id, use, serves?, build? }`);
        for (const k of Object.keys(a)) if (!['id', 'use', 'serves', 'build'].includes(k)) throw err(`${aat}.${k} is not part of an alternate use (id, use, serves, build)`);
        if (!ID.test(a.id ?? '')) throw err(`${aat}.id is a lowercase id ("vault-pole")`);
        if (altSeen.has(a.id)) throw err(`${aat}.id '${a.id}' appears twice`);
        altSeen.add(a.id);
        if (typeof a.use !== 'string' || !a.use.trim()) throw err(`${aat}.use is what it is used as, in words ("a pole to vault with")`);
        const o = { id: a.id, use: a.use.trim() };
        if (a.serves !== undefined) o.serves = powerIds(a.serves, `${aat}.serves`);
        if (a.build !== undefined) { o.build = readDiff(a.build, `${aat}.build`, 'an alternate build'); checkBuild(it.slot, applyDiff(build, o.build), `${aat}.build`); }
        return o;
      });
    }
    return out;
  });
  return { items, ...(A.bodily?.length ? { bodily: [...A.bodily] } : {}) };
}

/**
 * The page read against the actions page (`actions`: resolveActions' result) → `{ items, bodily, open }`, where `open` is
 * what the loop leaves open: a power an item serves that is not a power, and the final design's powers (the last stage
 * laid out) that no item serves and the body does not carry.
 */
export function resolveAdornment(A, actions) {
  const a = readAdornment(A), open = [];
  const ids = new Set((actions?.powers ?? []).map((p) => p.id));
  const none = () => [...ids].join(', ') || 'the hero has none yet';
  const served = new Set(a.bodily ?? []);
  for (const p of a.bodily ?? []) if (!ids.has(p)) open.push(`bodily '${p}' is not a power (${none()})`);
  for (const it of a.items) {
    for (const p of [...it.serves, ...(it.alt ?? []).flatMap((x) => x.serves ?? [])]) {
      served.add(p);
      if (!ids.has(p)) open.push(`item '${it.id}' serves '${p}', which is not a power (${none()})`);
    }
  }
  const last = [...(actions?.progression ?? [])].reverse().find((s) => s.gains.length);
  for (const p of last?.gains ?? []) if (!served.has(p)) open.push(`the final design's power '${p}' (${last.stage}) is served by no item: carry something for it, or leave it bodily`);
  return { items: a.items, bodily: a.bodily ?? [], open };
}
