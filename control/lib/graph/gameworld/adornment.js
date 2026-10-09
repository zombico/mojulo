/**
 * THE HERO'S ADORNMENT — the third page of the hero, over the pinned base: equipment based on the main loop's final
 * design. The loop is the actions page (actions.js): the power set and its escalation. So an item exists because a power
 * needs it (`serves`), grows with the stage that unlocks it (`tiers`), may serve a second power as an alternate use
 * (`alt`), and is shown scaled up or down. A VARIATION is a named loadout, resolved to a hero-door fragment (`gear`, and
 * `scale`) that is forked over the base's spec; the bare base is never overwritten.
 *
 *   adornment: {
 *     items: [{
 *       id, slot: 'right' | 'left' | 'back' | 'hip',          // a held item (polygonizer/hero-gear.js)
 *       build: { item, style?, dials?, parts?, gem?, seed? },  // an equipment build, without its `type`
 *       serves: [power ids],                                   // what it exists for
 *       tiers?: { early?, mid?, late? },                       // build diffs, cumulative: each stage keeps the last's
 *       alt?: [{ id, use, serves?: [power ids], build? }],     // alternate uses: a build diff, tied to another power
 *     }],
 *     variations?: [{ id, items: [item ids], stage?, scale?: 'down' | 'up' | <number>, use?: { <item id>: <alt id> } }],
 *   }
 *
 * Pure. `readAdornment` reads the shape and refuses what the equipment kernel refuses (every build, every tier and every
 * alternate use is judged by `validateGear`, as the door judges it). `resolveAdornment` resolves the variations against
 * the resolved actions page and says what the loop leaves open: a power's item that does not exist, an item that arrives
 * before the power it serves, and the final design's powers that nothing carried serves. It advises; nothing refuses.
 */
import { validateGear, GEAR_SLOTS } from '../polygonizer/hero-gear.js';
import { EQUIPMENT_ITEMS } from '../equipment/expand.js';
import { STAGES } from './actions.js';

/** The words a variation's `scale` may be, as the hero door's `scale`; a number is taken as it is. */
export const SCALES = Object.freeze({ down: 0.8, up: 1.25 });
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

function readDiff(d, at, what) {
  if (!isObj(d)) throw err(`${at} is ${what}: { ${BUILD_KEYS.join(', ')} }, only what it changes`);
  for (const k of Object.keys(d)) if (!BUILD_KEYS.includes(k)) throw err(`${at}.${k} is not an equipment build word (${BUILD_KEYS.join(', ')})`);
  return { ...d };
}

function checkBuild(slot, build, at) {
  const errs = validateGear({ [slot]: build });
  if (errs.length) throw err(`${at}: ${errs.join('; ')}`);
}

const powerIds = (v, at) => {
  if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string' && x)) throw err(`${at} is a list of power ids (the hero's actions: the powers it exists for)`);
  return [...v];
};

/** Read the adornment page's shape and say what is wrong; every build is judged by the equipment kernel. */
export function readAdornment(A) {
  if (!isObj(A)) throw err(' is { items, variations? }');
  for (const k of Object.keys(A)) if (!['items', 'variations'].includes(k)) throw err(`.${k} is not part of the adornment page (items, variations)`);
  if (!Array.isArray(A.items) || !A.items.length) throw err('.items is a list of { id, slot, build, serves }: the equipment the main loop calls for');
  const seen = new Set();
  const items = A.items.map((it, i) => {
    const at = `.items[${i}]`;
    if (!isObj(it)) throw err(`${at} is { id, slot, build, serves, tiers?, alt? }`);
    for (const k of Object.keys(it)) if (!['id', 'slot', 'build', 'serves', 'tiers', 'alt'].includes(k)) throw err(`${at}.${k} is not part of an item (id, slot, build, serves, tiers, alt)`);
    if (!ID.test(it.id ?? '')) throw err(`${at}.id is a lowercase id ("wind-staff")`);
    if (seen.has(it.id)) throw err(`${at}.id '${it.id}' appears twice`);
    seen.add(it.id);
    if (!GEAR_SLOTS.includes(it.slot)) throw err(`${at}.slot is ${GEAR_SLOTS.map((s) => `'${s}'`).join(', ')}`);
    const build = readDiff(it.build, `${at}.build`, 'an equipment build');
    if (!EQUIPMENT_ITEMS.includes(build.item)) throw err(`${at}.build.item is ${EQUIPMENT_ITEMS.join(', ')}`);
    checkBuild(it.slot, build, `${at}.build`);
    const out = { id: it.id, slot: it.slot, build, serves: powerIds(it.serves, `${at}.serves`) };
    if (it.tiers !== undefined) {
      if (!isObj(it.tiers)) throw err(`${at}.tiers is { ${STAGES.join(', ')} }, each a build diff`);
      out.tiers = {};
      let grown = build;
      for (const s of STAGES) if (it.tiers[s] !== undefined) {
        out.tiers[s] = readDiff(it.tiers[s], `${at}.tiers.${s}`, 'a tier');
        grown = applyDiff(grown, out.tiers[s]);
        checkBuild(it.slot, grown, `${at}.tiers.${s}`);
      }
      for (const k of Object.keys(it.tiers)) if (!STAGES.includes(k)) throw err(`${at}.tiers.${k} is not a stage (${STAGES.join(', ')})`);
    }
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
  const out = { items };
  if (A.variations !== undefined) {
    if (!Array.isArray(A.variations)) throw err('.variations is a list of { id, items, stage?, scale?, use? }');
    const vseen = new Set();
    out.variations = A.variations.map((v, i) => {
      const at = `.variations[${i}]`;
      if (!isObj(v)) throw err(`${at} is { id, items, stage?, scale?, use? }`);
      for (const k of Object.keys(v)) if (!['id', 'items', 'stage', 'scale', 'use'].includes(k)) throw err(`${at}.${k} is not part of a variation (id, items, stage, scale, use)`);
      if (!ID.test(v.id ?? '')) throw err(`${at}.id is a lowercase id ("early-kit")`);
      if (vseen.has(v.id)) throw err(`${at}.id '${v.id}' appears twice`);
      vseen.add(v.id);
      if (!Array.isArray(v.items) || !v.items.length) throw err(`${at}.items is a list of item ids (${items.map((x) => x.id).join(', ')})`);
      const slots = new Set();
      for (const id of v.items) {
        const it = items.find((x) => x.id === id);
        if (!it) throw err(`${at}.items: '${id}' is not an item (${items.map((x) => x.id).join(', ')})`);
        if (slots.has(it.slot)) throw err(`${at}.items: two items fill the ${it.slot} slot`);
        slots.add(it.slot);
      }
      const o = { id: v.id, items: [...v.items] };
      if (v.stage !== undefined) { if (!STAGES.includes(v.stage)) throw err(`${at}.stage is ${STAGES.map((s) => `'${s}'`).join(' | ')}`); o.stage = v.stage; }
      if (v.scale !== undefined) {
        if (!(v.scale in SCALES) && !(typeof v.scale === 'number' && Number.isFinite(v.scale) && v.scale > 0)) throw err(`${at}.scale is ${Object.keys(SCALES).map((s) => `'${s}'`).join(', ')}, or a number above 0`);
        o.scale = v.scale;
      }
      if (v.use !== undefined) {
        if (!isObj(v.use)) throw err(`${at}.use is { <item id>: <alternate use id> }`);
        for (const [id, altId] of Object.entries(v.use)) {
          const it = items.find((x) => x.id === id);
          if (!it || !v.items.includes(id)) throw err(`${at}.use.${id}: not an item this variation carries`);
          if (!it.alt?.some((a) => a.id === altId)) throw err(`${at}.use.${id}: '${altId}' is not an alternate use of it (${(it.alt ?? []).map((a) => a.id).join(', ') || 'it has none'})`);
        }
        o.use = { ...v.use };
      }
      return o;
    });
  }
  return out;
}

/**
 * The page resolved against the actions page (`actions`: resolveActions' result): each variation as `{ id, items, stage,
 * scale, gear, use }` where `gear` is the hero door's (slot → build words, tiers and the chosen alternate use laid over)
 * and `scale` the number for the door's `scale` (null when the variation names none); and `open`, what the loop leaves
 * open: a power an item serves that is not a power, an item carried before the stage that gains what it serves, and the
 * final design's powers (the last stage laid out) that no item serves.
 */
export function resolveAdornment(A, actions) {
  const a = readAdornment(A), open = [];
  const ids = new Set((actions?.powers ?? []).map((p) => p.id));
  const gainedAt = new Map();
  for (const s of actions?.progression ?? []) for (const g of s.gains) if (!gainedAt.has(g)) gainedAt.set(g, s.stage);
  const served = new Set();
  for (const it of a.items) {
    for (const p of [...it.serves, ...(it.alt ?? []).flatMap((x) => x.serves ?? [])]) {
      served.add(p);
      if (!ids.has(p)) open.push(`item '${it.id}' serves '${p}', which is not a power (${[...ids].join(', ') || 'the hero has none yet'})`);
    }
  }
  const last = [...(actions?.progression ?? [])].reverse().find((s) => s.gains.length);
  for (const p of last?.gains ?? []) if (!served.has(p)) open.push(`the final design's power '${p}' (${last.stage}) is served by no item: carry something for it, or leave it bodily`);
  const variations = (a.variations ?? []).map((v) => {
    const stage = v.stage ?? STAGES[STAGES.length - 1], gear = {};
    for (const id of v.items) {
      const it = a.items.find((x) => x.id === id);
      gear[it.slot] = buildAt(it, stage, v.use?.[id]);
      for (const p of it.serves) {
        const at = gainedAt.get(p);
        if (at && STAGES.indexOf(at) > STAGES.indexOf(stage)) open.push(`variation '${v.id}' (${stage}) carries '${id}', which serves '${p}', gained at ${at}`);
      }
    }
    return { id: v.id, items: v.items, stage, scale: v.scale === undefined ? null : (SCALES[v.scale] ?? v.scale), gear, use: v.use ?? {} };
  });
  return { items: a.items, variations, open };
}
