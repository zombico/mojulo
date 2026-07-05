/**
 * game-manifest — validate + normalize the game manifest (game-metacontext.plan.md).
 *
 * A GAME rides the `sketches` table like every other mint (`kind: 'game'`, recipes-not-
 * renders): the manifest is the store schema + the promoted level list, small and
 * deterministic. The shell (game-shell.js) is emitted FROM it at artifact-staging time;
 * play state never comes back into this row (play data never enters mojulo).
 *
 *   { kind: 'game', title,
 *     store:  { slices: [{ name, kind: character|inventory|party|progression|flags, init? }] },
 *     levels: [{ ref, title?, gate? }] }   // order = play order; gate = declarative unlock
 *
 * Validation throws teaching errors (the create_game handler will surface them with a
 * pointer at the slice-cards). Gates are predicates evaluated by the store kernel
 * (evalGate): { flag, equals?, slice? } | { completed: ref, slice? }.
 */

import { buildGameStoreKernel } from './store-kernel.js';

const K = buildGameStoreKernel();

export function validateGameManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest must be an object'] };
  if (manifest.kind !== 'game') return { ok: false, errors: ["manifest.kind must be 'game'"] };
  if (!manifest.title || typeof manifest.title !== 'string') errors.push('manifest.title is required (string)');

  const sliceNames = new Set();
  const kindsByName = new Map();
  if (!manifest.store || !Array.isArray(manifest.store.slices) || !manifest.store.slices.length) {
    errors.push('store.slices is required: [{ name, kind, init? }] — the game\'s typed store (see the slice cards)');
  } else {
    manifest.store.slices.forEach((sl, i) => {
      const where = `store.slices[${i}]`;
      if (!sl || typeof sl !== 'object') { errors.push(`${where} must be { name, kind, init? }`); return; }
      if (!sl.name || typeof sl.name !== 'string') errors.push(`${where}.name is required (string)`);
      else if (sliceNames.has(sl.name)) errors.push(`${where}.name '${sl.name}' is duplicated`);
      else { sliceNames.add(sl.name); kindsByName.set(sl.name, sl.kind); }
      if (!K.SLICE_KINDS.includes(sl.kind)) errors.push(`${where}.kind must be one of: ${K.SLICE_KINDS.join(', ')}`);
      else if (sl.init !== undefined) {
        // initSlice throws a teaching error on shape faults — surface it as a validation error.
        try { K.createStore({ slices: [{ name: sl.name || `s${i}`, kind: sl.kind, init: sl.init }] }); }
        catch (e) { errors.push(`${where}.init: ${e.message}`); }
      }
    });
  }

  const refs = new Set();
  if (!Array.isArray(manifest.levels) || !manifest.levels.length) {
    errors.push('levels is required: [{ ref, title?, gate? }] — refs of promoted level sketches, in play order');
  } else {
    manifest.levels.forEach((lv, i) => {
      const where = `levels[${i}]`;
      if (!lv || typeof lv !== 'object' || !lv.ref || typeof lv.ref !== 'string') { errors.push(`${where} must be { ref, title?, gate? }`); return; }
      if (refs.has(lv.ref)) errors.push(`${where}.ref '${lv.ref}' is duplicated`);
      refs.add(lv.ref);
      const gate = lv.gate;
      if (gate !== undefined) {
        if (!gate || typeof gate !== 'object') { errors.push(`${where}.gate must be { flag, equals?, slice? } or { completed: ref, slice? }`); return; }
        const forms = ['flag', 'completed'].filter((k) => gate[k] !== undefined);
        if (forms.length !== 1) errors.push(`${where}.gate needs exactly one of flag | completed`);
        if (gate.completed !== undefined && typeof gate.completed !== 'string') errors.push(`${where}.gate.completed must be a level ref (string)`);
        if (gate.slice !== undefined && !sliceNames.has(gate.slice)) errors.push(`${where}.gate.slice '${gate.slice}' is not a declared slice`);
        else if (gate.slice !== undefined) {
          const want = gate.flag !== undefined ? 'flags' : 'progression';
          if (kindsByName.get(gate.slice) !== want) errors.push(`${where}.gate.slice '${gate.slice}' must be a ${want} slice`);
        }
        if (gate.slice === undefined) {
          const want = gate.flag !== undefined ? 'flags' : 'progression';
          if (![...kindsByName.values()].includes(want)) errors.push(`${where}.gate needs a ${want} slice in the store (none declared)`);
        }
      }
    });
    // gate.completed must reference a level in this game — a dangling ref can never unlock.
    manifest.levels.forEach((lv, i) => {
      if (lv && lv.gate && typeof lv.gate.completed === 'string' && !refs.has(lv.gate.completed)) {
        errors.push(`levels[${i}].gate.completed '${lv.gate.completed}' is not a level of this game`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

/** Fill defaults so the stored manifest is self-contained. Never mutates the input. */
export function normalizeGameManifest(manifest) {
  const m = JSON.parse(JSON.stringify(manifest));
  m.contractVersion = K.CONTRACT_VERSION;
  m.levels = m.levels.map((lv) => ({ title: lv.ref, ...lv }));
  return m;
}
