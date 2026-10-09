/**
 * THE CIVILIZATION TUNNEL: BUILDINGS — a building intent tunnelled through a civilization's blocks: the building
 * elements (era/out-anchor-elements.js: the wall and its bond, the cap, the lights, the door, the details, the
 * ornaments) and its technology mounted on them (era/blocks.js: a mast on the roof, a status light by the door).
 *
 * A trait is a set of OPS on the candidate (an anchor's elements and composition, and its mounts), and a MEASURE on
 * the building spoken from it. The first trait to set a thing keeps it. A value the elements' rails do not allow is a
 * gap: the tunnel names it and what would close it (a new word on an element's rail, a new block).
 *
 *   BUILDING_TRAITS                 the traits, by the words that name them
 *   buildingDomain({ kitId, library, finish })   → a tunnel domain (gameworld/tunnel.js)
 *   tunnelBuilding(intent, { seed, base, kitId, library, finish }) → the tunnel's record, its plan the anchor to speak
 *
 * Pure; seeded dice only.
 */
import { tunnel } from './tunnel.js';
import { seedElements, ELEMENT_SETS, readElement } from '../era/out-anchor-elements.js';
import { decompileAnchor, roundTrip, speak } from '../era/out-anchor-structure.js';
import { structureStyle } from '../era/out-structures.js';
import { buildBlock, blockLaws } from '../era/blocks.js';
import { STARTER_BLOCKS } from '../era/tech-blocks.js';

const clone = (v) => JSON.parse(JSON.stringify(v));
const r3 = (v) => Math.round(v * 1000) / 1000;
const ORNAMENTS = ['sills', 'lintels', 'quoins', 'shutters', 'frame', 'stack', 'chimney', 'point', 'points', 'finial'];

/** The traits a building intent is read into. `ops` edit the candidate; `measure` reads the building spoken. */
export const BUILDING_TRAITS = Object.freeze({
  'flat-roof': { words: ['flat', 'flat-roofed', 'prefab', 'modular', 'habitat', 'bunker', 'outpost'], read: 'flat roofs behind a low edge',
    ops: [{ set: 'compose.mass.kind', to: 'block' }, { del: 'compose.mass.rise' }, { set: 'elements.roof', to: { kind: 'cap', form: 'flat', eave: 0.2, group: 'str:stone', value: 0.45 } }],
    measure: ({ L }) => ({ ok: L.vocab.cap === 'flat', value: L.vocab.cap ?? 'no cap' }) },
  modules: { words: ['modular', 'module', 'prefab', 'habitat', 'outpost'], read: 'joined modules: a main mass and one behind it, the main leading',
    ops: [{ set: 'compose.mass.kind', to: 'block' }, { del: 'compose.mass.rise' }, { del: 'compose.tiers' }, { set: 'compose.annex', to: { scale: 0.7 } }, { set: 'programme.grow', to: 1.8 },
      // a block needs a cap: a shell's 'none' becomes flat
      { set: 'elements.roof', to: { kind: 'cap', form: 'flat', eave: 0.2, group: 'str:stone', value: 0.45 }, when: ['elements.roof.form', 'none'] }],
    measure: ({ b }) => ({ ok: b.masses.length >= 2, value: `${b.masses.length} masses` }),
    // not yet two: the programme grows (more to hold) and the second module may be larger
    mend: (c) => { c.programme.grow = r3(Math.min(3, (c.programme.grow ?? 1) + 0.4)); if (c.anchor.compose.annex) c.anchor.compose.annex.scale = r3(Math.min(0.85, c.anchor.compose.annex.scale + 0.05)); return `programme × ${c.programme.grow} (modules)`; } },
  'panel-seams': { words: ['panel', 'panelled', 'paneled', 'prefab', 'modular', 'sci-fi', 'scifi', 'habitat', 'clad'], read: 'walls of panels: a grid of seams',
    ops: [{ each: 'elements.wall.storeys', set: 'bond', to: 'panels' }, { each: 'elements.wall.storeys', set: 'group', to: 'str:plaster' }],
    measure: ({ L }) => ({ ok: L.bonds.every((b) => b === 'panels'), value: L.bonds.join(', ') }) },
  raised: { words: ['raised', 'stilts', 'pads', 'habitat', 'outpost'], read: 'raised off the ground on a deep plinth',
    ops: [{ set: 'elements.socle', to: { kind: 'socle', h: 0.85, group: 'str:stone', value: 0.4 } }],
    measure: ({ L }) => ({ ok: (L.proportions.socle?.h ?? 0) >= 0.6, value: `${L.proportions.socle?.h ?? 0} m` }) },
  'small-lights': { words: ['small windows', 'slit', 'bunker', 'habitat', 'ports'], read: 'small, high lights',
    ops: [{ set: 'elements.lights.form', to: 'rect' }, { set: 'elements.lights.w', to: 0.8 }, { set: 'elements.lights.h', to: 0.7 }, { set: 'elements.lights.sill', to: 1.1 }, { set: 'elements.lights.group', to: 'str:opening' }, { set: 'elements.lights.value', to: 0.04 }, { set: 'elements.door.form', to: 'rect' }],
    measure: ({ L }) => ({ ok: L.proportions.opening.w * L.proportions.opening.h <= 0.7, value: `${L.proportions.opening.w} × ${L.proportions.opening.h} m` }) },
  plain: { words: ['plain', 'utilitarian', 'functional', 'prefab', 'sci-fi', 'scifi', 'modular'], read: 'no carved ornament: no sills, lintels, quoins, shutters, frames, stacks or finials',
    ops: ORNAMENTS.map((k) => ({ del: `elements.${k}` })),
    measure: ({ L }) => { const o = L.vocab.ornaments.filter((k) => ['sill', 'lintel', 'quoins', 'shutters', 'frame', 'chimney', 'point'].includes(k)); return { ok: !o.length, value: o.join(', ') || 'none' }; } },
  ribbed: { words: ['ribbed', 'framed', 'industrial', 'sci-fi', 'scifi'], read: 'ribs between the lights: a frame showing through the skin',
    ops: [{ set: 'elements.ribs', to: { kind: 'rib', count: 4, w: 0.22, share: 1, group: 'str:paint', value: 0.4 } }],
    measure: ({ L }) => ({ ok: L.vocab.ornaments.includes('rib'), value: L.vocab.ornaments.join(', ') || 'none' }) },
  banded: { words: ['banded', 'striped'], read: 'a band at every storey',
    ops: [{ set: 'elements.bands', to: { kind: 'band', w: 0.22, group: 'str:paint', value: 0.5 } }],
    measure: ({ L }) => ({ ok: L.vocab.ornaments.includes('band'), value: L.vocab.ornaments.join(', ') || 'none' }) },
  low: { words: ['low', 'single-storey', 'bunker', 'squat'], read: 'one storey',
    ops: [{ set: 'compose.storeys', to: 1 }],
    measure: ({ b }) => ({ ok: b.dims.n === 1, value: `${b.dims.n} storeys` }) },
  tall: { words: ['tall', 'tower', 'stacked'], read: 'three storeys',
    ops: [{ set: 'compose.storeys', to: 3 }],
    measure: ({ b }) => ({ ok: b.dims.n >= 3, value: `${b.dims.n} storeys` }) },
  airlock: { words: ['airlock', 'sealed', 'pressurised', 'pressurized', 'habitat'], read: 'a wide square door with a status light by it',
    ops: [{ set: 'elements.door', to: { kind: 'door', form: 'rect', w: 1.35, h: 2.2 } }, { mount: 'status-light', on: 'door' }],
    measure: ({ L, mounts }) => ({ ok: L.proportions.entry.w >= 1.3 && mounts.some((m) => m.block === 'status-light'), value: `door ${L.proportions.entry.w} m${mounts.some((m) => m.block === 'status-light') ? ', lit' : ''}` }) },
  mast: { words: ['mast', 'antenna', 'antennas', 'comms', 'relay', 'outpost'], read: 'a mast on the roof: it listens and tells',
    ops: [{ mount: 'roof-mast', on: 'roof' }],
    measure: ({ mounts }) => ({ ok: mounts.some((m) => m.roles.includes('sensor')), value: mounts.map((m) => m.block).join(', ') || 'none' }) },
  solar: { words: ['solar', 'powered', 'off-grid'], read: 'collector wings on the roof',
    ops: [{ mount: 'solar-wing', on: 'roof', n: 2 }],
    measure: ({ mounts }) => ({ ok: mounts.some((m) => m.roles.includes('source')), value: mounts.map((m) => m.block).join(', ') || 'none' }) },
});

// ── ops on a candidate ──────────────────────────────────────────────────────────────────────────────────────────────
const getAt = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setAt(o, path, v) { const ks = path.split('.'), last = ks.pop(); let a = o; for (const k of ks) a = a[k] ??= {}; a[last] = v; }
function delAt(o, path) { const ks = path.split('.'), last = ks.pop(), a = getAt(o, ks.join('.')); if (a && last in a) { delete a[last]; return true; } return false; }

export function buildingDomain({ kitId = 'isekai-meadow', library = STARTER_BLOCKS } = {}) {
  const domain = {
    id: 'buildings', TRAITS: BUILDING_TRAITS,
    /** The base: a civilization's language (an authored anchor id, or an anchor), or one drawn from the seed. */
    start(seed, base) { const A = typeof base === 'string' ? ELEMENT_SETS[base] : base ?? seedElements(seed); if (!A) throw new Error(`tunnel: buildings: '${base}' is not an anchor`); return { anchor: clone(A), programme: { use: 'dwelling', grow: 1 }, mounts: [], setBy: {} }; },
    pull(cand, T, id) {
      const c = clone(cand), changed = [];
      for (const op of T.ops) {
        if (op.mount) {
          if (!library[op.mount]) return { gap: { why: `no block '${op.mount}' in the civilization's library`, proposal: `a block '${op.mount}' (data: era/blocks.js), mounting on ${op.on}` } };
          if (!library[op.mount].mounts.includes(op.on === 'door' ? 'wall' : op.on)) return { gap: { why: `'${op.mount}' does not mount on a ${op.on}`, proposal: `let '${op.mount}' mount on ${op.on}, or a block that does` } };
          c.mounts.push({ block: op.mount, on: op.on, n: op.n ?? 1, by: id }); changed.push(`mount ${op.mount} on the ${op.on}`); continue;
        }
        if (op.when && getAt(c.anchor, op.when[0]) !== op.when[1]) continue;
        // the programme (what the building must hold) is the candidate's; everything else is the anchor's
        const root = (op.set ?? op.del ?? '').startsWith('programme.') ? c : c.anchor;
        const key = op.each ? `${op.each}.*.${op.set}` : op.set ?? op.del;
        if (c.setBy[key] && c.setBy[key] !== id) { changed.push(`${key}: kept from ${c.setBy[key]}`); continue; }
        if (op.del) { if (delAt(root, op.del)) changed.push(`drop ${op.del}`); c.setBy[key] = id; continue; }
        if (op.each) { for (const s of getAt(root, op.each) ?? []) s[op.set] = op.to; changed.push(`${key} = ${op.to}`); }
        else { setAt(root, op.set, clone(op.to)); changed.push(`${op.set} = ${typeof op.to === 'object' ? JSON.stringify(op.to) : op.to}`); }
        c.setBy[key] = id;
      }
      // the elements' rails and the grammar decide whether the civilization can say it
      try { for (const [eid, el] of Object.entries(c.anchor.elements)) readElement(eid, el); decompileAnchor(c.anchor); } catch (e) {
        return { gap: { why: e.message, proposal: gapProposal(e.message) } };
      }
      return { candidate: c, changed };
    },
    build(cand, seed) {
      const L = decompileAnchor(cand.anchor, 'tunnelled'), style = structureStyle(kitId, seed), b = roundTrip(L, style, seed);
      // the building the plan holds: the language spoken for its programme, on a lot deep enough for what it must hold
      // (a programme over one mass's floor is what makes it modular: the language speaks an annex)
      const A = L.anchor, M = A.pieces.find((p) => p.role === 'mass'), k = M.kind === 'block' ? 1 : Math.PI / 4, sh = M.tiers?.shrink ?? 1, grow = cand.programme.grow ?? 1;
      const area = r3(Array.from({ length: L.storeys }, (_, i) => k * M.w * M.d * sh ** (2 * i)).reduce((a, x) => a + x, 0) * 0.92 * grow);
      // a programme that grows is given a lot a little wider than the anchor reaches and deep enough for a second
      // module: the main mass stops at its reach, and what it cannot hold is spoken again behind it
      const lot = grow > 1 ? { w: r3(L.proportions.reach + 3.5), d: r3(L.proportions.reach * 2.4 + 5) } : A.lot;
      const B = speak(L, cand.programme.use, lot, style, seed, { depth: 3, band: [L.storeys, L.storeys], over: { area, full: true } }), main = B.masses[0], [x0, y0, x1, y1] = main.rect, mounts = [], faces = [...B.faces, ...B.tile];
      for (const [i, m] of cand.mounts.entries()) for (let k = 0; k < m.n; k++) {
        // on the roof: each mount its own row (front to back), its copies along it a wing's width apart
        const at = m.on === 'roof' ? [r3(x0 + 1.6 + k * 2.8), r3(y0 + 2 + i * 2.6), main.eave] : [r3((x0 + x1) / 2 + 1.1), r3(y0 - 0.12), r3((L.proportions.socle?.h ?? 0) + 2.45)];
        const x = buildBlock(library[m.block], { seed: seed + i * 7 + k, library, ring: B.ring, at });
        mounts.push({ block: m.block, on: m.on, at, built: x, roles: x.parts.flatMap((p) => [p.role, ...(p.children ?? []).map((c) => c.role)]).filter(Boolean), laws: blockLaws(library[m.block], x) });
        faces.push(...x.faces);
      }
      return { L, b: B, round: b.laws, mounts, faces };
    },
    measure: (T, id, built, cand) => T.measure({ ...built, cand }),
    laws(built) {
      const own = [...built.b.laws, ...built.round].filter((l) => l.law !== 'programme');
      return [...own, ...built.mounts.flatMap((m) => m.laws.filter((l) => l.law !== 'stands').map((l) => ({ ...l, law: `${m.block}:${l.law}` })))];
    },
    tweak(cand, failed, pass, seed) {
      const c = clone(cand), changed = [], E = c.anchor.elements, C = c.anchor.compose;
      for (const t of failed.traits) { const m = BUILDING_TRAITS[t.id].mend?.(c); if (m) changed.push(m); }
      for (const l of failed.laws) {
        if (l.law === 'reach') { C.mass.w = r3(Math.max(6, C.mass.w * 0.9)); C.mass.d = r3(Math.max(6, C.mass.d * 0.9)); changed.push(`mass to ${C.mass.w} × ${C.mass.d} m (reach)`); }
        else if (l.law === 'rhythm' && E.lights) { E.lights.bay = 2.8; changed.push('lights at 2.8 m bays (rhythm)'); }
        else if (l.law === 'one-leads' && C.annex) { C.annex.scale = r3(Math.max(0.45, C.annex.scale - 0.1)); changed.push(`annex at ${C.annex.scale} (one leads)`); }
        else if ((l.law === 'budget' || l.law === 'eye-spot')) { const k = ['frame', 'shutters', 'quoins', 'lintels', 'sills', 'ribs', 'bands'].find((x) => E[x]); if (k) { delete E[k]; changed.push(`drop ${k} (${l.law})`); } }
        else if (l.law === 'value-order' && E.roof?.value !== undefined) { E.roof.value = r3(Math.max(0.2, E.roof.value - 0.1)); changed.push(`cap value ${E.roof.value} (value order)`); }
      }
      // what is left (a household's draw, a mount's) is rolled again on the next seed
      return { candidate: c, changed: changed.length ? changed : [`reseed ${seed + 1}`], reseed: changed.length ? undefined : seed + 1 };
    },
    plan(cand, built, rec) {
      return { anchor: cand.anchor, mounts: cand.mounts.map(({ block, on, n }) => ({ block, on, n })), read: (rec.read.traits.map((t) => BUILDING_TRAITS[t.id].read)).join('; '), held: rec.held, gaps: rec.gaps.map((g) => g.trait) };
    },
  };
  return domain;
}

/** What would close a gap, read off the refusal: a word an element's rail lacks is a new word for that rail. */
function gapProposal(msg) {
  const m = msg.match(/element '([^']+)' \(([^)]+)\): (?:a )?(\w+) is ([^(]+)\(got ([^)]+)\)/);
  if (m) return `add ${m[5]} to the ${m[2]}'s ${m[3]} rail (${m[4].trim()}): one new word, drawn by its builder (era/out-anchor-elements.js), then every civilization can say it`;
  return 'a new element, or a looser rail: a deliberate addition at the gate';
}

/** Tunnel a building intent through a civilization's blocks. */
export function tunnelBuilding(intent, { seed = 1, base, kitId = 'isekai-meadow', library = STARTER_BLOCKS, passes = 6 } = {}) {
  return tunnel(buildingDomain({ kitId, library }), { intent, seed, base, passes });
}
