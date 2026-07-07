/**
 * game-audit — the verification layer that gates promotion (game-metacontext.plan.md, G4).
 *
 * Two checks, different natures, both feeding `create_game`'s promotion gate:
 *
 *  1. CONTRACT DRY-RUN (pure, always-on). Prove a level's declared `produces` contract is
 *     internally COHERENT and STORE-COMPATIBLE: synthesize the maximal outcome envelope the
 *     contract permits (every declared event at its cap), seed a store rich enough that
 *     state-dependent events have targets (grant before consume, recruit before dismiss), and
 *     confirm it validates + applies. Catches a contract that could never emit a valid
 *     envelope — a mint-time authoring error, not a play-time surprise. No browser.
 *
 *  2. COMPLETABILITY (evidence-based). A level is only truly "beatable" if a RUN through it
 *     reaches `result: 'success'`. That can't be judged statically — the level is arbitrary
 *     world+game code — so it needs a real playthrough. The evidence is a stored `forge_motion`
 *     TRAVERSAL of that level (its ticks/waypoints ARE a replayable recipe) whose final probe
 *     carries `game.result === 'success'` (the probe surface added to __mojCapture in G4).
 *     `readTraversalAudit` reads that stored evidence; `create_game` verifies it.
 *
 * Everything here is pure except `readTraversalAudit`, which only reads two JSON files a
 * traversal already wrote — no rendering, no browser, in the mint path.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildGameStoreKernel } from './store-kernel.js';
import { outcomeDirFor } from '@/lib/outcomes/paths';

const K = buildGameStoreKernel();

/**
 * Contract dry-run: can this level's declared contract emit at least one valid, applicable
 * outcome against this game's store? Pure. Returns { ok, errors, envelope } (the synthesized
 * envelope is returned for transparency / testing).
 */
export function dryRunContract(store, contract) {
  const events = (contract && contract.produces && contract.produces.events) || [];
  // Seed a working store from the game's declared init, then guarantee targets for the
  // state-dependent events so the dry-run tests COMPOSABILITY, not incidental empty-store state.
  let state = K.createStore(store);
  const kindByName = new Map((store.slices || []).map((s) => [s.name, s.kind]));
  const seed = [];
  for (const e of events) {
    if (e.type === 'consume') seed.push({ type: 'grant', slice: e.slice, item: '__dryrun__', count: (e.max || 1) + 1 });
    if (e.type === 'dismiss') seed.push({ type: 'recruit', slice: e.slice, member: { id: '__dryrun__', name: 'Dry Run' } });
  }
  if (seed.length) {
    const s = K.applyEvents(store, state, seed);
    if (!s.ok) return { ok: false, errors: ['dry-run seed failed: ' + s.errors.join('; ')] }; // unreachable in practice
    state = s.state;
  }

  // party setStat/levelUp need a SURVIVOR member, distinct from the dismiss victim (__dryrun__),
  // so a contract that both dismisses and levels up a party is still composable. Seed it first.
  for (const e of events) {
    if ((e.type === 'setStat' || e.type === 'levelUp') && kindByName.get(e.slice) === 'party') {
      const s = K.applyEvents(store, state, [{ type: 'recruit', slice: e.slice, member: { id: '__target__', name: 'Dry Run Target' } }]);
      if (s.ok) state = s.state;
    }
  }

  // Build the maximal envelope: each declared event at its cap, targeting seeded entities where
  // the event is state-dependent. Non-state events use synthetic-but-valid params.
  const synth = [];
  for (const e of events) {
    const n = e.max || 1;
    const kind = kindByName.get(e.slice);
    for (let i = 0; i < n; i++) {
      if (e.type === 'grant') synth.push({ type: 'grant', slice: e.slice, item: 'reward', count: 1 });
      else if (e.type === 'consume') synth.push({ type: 'consume', slice: e.slice, item: '__dryrun__', count: 1 });
      else if (e.type === 'setStat') synth.push({ type: 'setStat', slice: e.slice, id: kind === 'party' ? '__target__' : undefined, stat: 'hp', delta: 1 });
      else if (e.type === 'levelUp') synth.push({ type: 'levelUp', slice: e.slice, id: kind === 'party' ? '__target__' : undefined, by: 1 });
      else if (e.type === 'setFlag') synth.push({ type: 'setFlag', slice: e.slice, key: 'dryrun', value: true });
      else if (e.type === 'promote') synth.push({ type: 'promote', slice: e.slice, ref: contract.levelRef, result: 'success' });
      else if (e.type === 'recruit') synth.push({ type: 'recruit', slice: e.slice, member: { id: 'recruit' + i, name: 'Recruit' } });
      else if (e.type === 'dismiss') { if (i === 0) synth.push({ type: 'dismiss', slice: e.slice, id: '__dryrun__' }); }
    }
  }

  const envelope = { contractVersion: K.CONTRACT_VERSION, levelRef: contract.levelRef, seed: 1, result: 'success', events: synth };
  const r = K.applyOutcome(store, state, contract, envelope);
  if (!r.ok) {
    return { ok: false, errors: r.errors.map((m) => `the declared produces contract can't emit a valid outcome: ${m}`), envelope };
  }
  return { ok: true, errors: [], envelope };
}

/**
 * Read a traversal's final probe and judge completion. Pure.
 * @param {object} finalProbe  the last entry of a traversal's probe stream
 * @returns {{ completable: boolean, result: string|null, reason: string }}
 */
export function probeShowsCompletion(finalProbe) {
  if (!finalProbe || typeof finalProbe !== 'object') return { completable: false, result: null, reason: 'no probe' };
  const g = finalProbe.game;
  if (!g) return { completable: false, result: null, reason: 'the run recorded no game outcome — is this a traversal of a level (a world minted with a `game:` channel)?' };
  if (!g.ended) return { completable: false, result: null, reason: 'the run ended before the level did — the traversal never reached a win/lose condition' };
  if (g.result !== 'success') return { completable: false, result: g.result, reason: `the run ended in '${g.result}', not 'success'` };
  return { completable: true, result: 'success', reason: 'the run reached result: success' };
}

/**
 * Load the completability evidence a stored `forge_motion` traversal wrote: its recipe.json
 * (to confirm the traversal was of THIS level) and probes.json (the final probe's game outcome).
 * @param {string} motionRef  the mo_… ref of a traversal of the level
 * @param {string} levelRef   the level the audit must be OF
 * @returns {{ ok: boolean, completable?: boolean, result?: string, reason: string }}
 */
export function readTraversalAudit(motionRef, levelRef) {
  const dir = outcomeDirFor(motionRef);
  const recipePath = join(dir, 'recipe.json');
  const probesPath = join(dir, 'probes.json');
  if (!existsSync(recipePath)) return { ok: false, reason: `no traversal '${motionRef}' on disk (run forge_motion with a world_ref + shot.motion:'traversal' first)` };
  let recipe;
  try { recipe = JSON.parse(readFileSync(recipePath, 'utf8')); }
  catch (e) { return { ok: false, reason: `traversal '${motionRef}' recipe is unreadable: ${e.message}` }; }
  if (recipe.shot && recipe.shot.motion !== 'traversal') return { ok: false, reason: `'${motionRef}' is a ${recipe.shot.motion} motion, not a traversal — completability needs a played run` };
  const wref = recipe.subject && recipe.subject.world_ref;
  if (wref !== levelRef) return { ok: false, reason: `traversal '${motionRef}' is of world '${wref}', not level '${levelRef}'` };
  if (!existsSync(probesPath)) return { ok: false, reason: `traversal '${motionRef}' wrote no probes.json — no outcome to read` };
  let probes;
  try { probes = JSON.parse(readFileSync(probesPath, 'utf8')); }
  catch (e) { return { ok: false, reason: `traversal '${motionRef}' probes are unreadable: ${e.message}` }; }
  if (!Array.isArray(probes) || !probes.length) return { ok: false, reason: `traversal '${motionRef}' has an empty probe stream` };
  const judged = probeShowsCompletion(probes[probes.length - 1]);
  return { ok: true, completable: judged.completable, result: judged.result, reason: judged.reason };
}

/**
 * Compile a level's MECHANIC-derived audits (game-mechanics.plan.md, M3) into a runnable
 * forge_motion traversal plan that would prove completability — the "auto-generated audit". A
 * success-terminal mechanic carries its win condition as an audit hint:
 *   { kind:'walkto', target:[x,y,z] }  (reach-exit) → a waypoint route to the exit
 *   { kind:'idle', seconds }           (survive)    → N idle ticks past the timer
 * The compiled plan is a `shot` the traversal runner executes; its final probe's game.result must
 * read 'success'. Pure. Returns { ok, plan, reason }.
 */
export function compileMechanicAudit(contract, { fps = 12 } = {}) {
  const audits = (contract && Array.isArray(contract.audits)) ? contract.audits : [];
  const walkto = audits.find((a) => a && a.kind === 'walkto' && Array.isArray(a.target));
  if (walkto) {
    return { ok: true, plan: { motion: 'traversal', fps, waypoints: [[walkto.target[0], walkto.target[1]]], expect: 'success', via: walkto.mechanic || 'reach-exit' } };
  }
  const idle = audits.find((a) => a && a.kind === 'idle' && Number.isFinite(a.seconds));
  if (idle) {
    // idle past the timer + a small margin so the countdown watch fires within the run.
    const n = Math.ceil(idle.seconds * fps) + fps;
    return { ok: true, plan: { motion: 'traversal', fps, ticks: Array.from({ length: n }, () => ({})), expect: 'success', via: idle.mechanic || 'survive' } };
  }
  return { ok: false, reason: 'no auto-auditable mechanic audit on this level (needs a reach-exit or survive terminal)' };
}

/**
 * The full promotion audit for one level. Always runs the dry-run; establishes completability from
 * (in priority) a supplied stored traversal (motionRef), else an AUTO-RUN of the compiled mechanic
 * audit (when `autoRun` is provided — M3), else the allow_unaudited waiver. Async because autoRun
 * drives a real traversal. Pure except the evidence read / autoRun.
 * @param {(a:{levelRef,plan})=>Promise<object>} [autoRun]  runs a traversal plan, returns its final probe
 * @returns {Promise<{ ref, dryRun, completable, result, reason, promotable, autoAuditPlan? }>}
 */
export async function auditLevel({ ref, store, contract, motionRef, allowUnaudited = false, autoRun = null }) {
  const dryRun = dryRunContract(store, contract);
  let completable = null; let result = null; let reason; let autoAuditPlan;
  if (motionRef) {
    const ev = readTraversalAudit(motionRef, ref);
    if (!ev.ok) { completable = false; reason = ev.reason; }
    else { completable = ev.completable; result = ev.result; reason = ev.reason; }
  } else {
    const compiled = compileMechanicAudit(contract);
    if (compiled.ok) autoAuditPlan = compiled.plan;
    if (autoRun && compiled.ok) {
      try {
        const probe = await autoRun({ levelRef: ref, plan: compiled.plan });
        const judged = probeShowsCompletion(probe);
        completable = judged.completable; result = judged.result;
        reason = `auto-audit (${compiled.plan.via}): ${judged.reason}`;
      } catch (e) {
        completable = false; reason = `auto-audit failed to run: ${e.message}`;
      }
    } else if (allowUnaudited) {
      reason = 'promoted WITHOUT a completability audit (allow_unaudited)';
    } else if (compiled.ok) {
      reason = `no completability evidence — this level is auto-auditable (${compiled.plan.via}): set auto_audit:true, or run forge_motion({ subject:{ world_ref:'${ref}' }, shot:${JSON.stringify(compiled.plan)} }) and pass its motion_ref`;
    } else {
      reason = `no completability evidence — run forge_motion({ subject:{ world_ref:'${ref}' }, shot:{ motion:'traversal', waypoints|ticks } }) to the win condition and pass its motion_ref, or set allow_unaudited:true`;
    }
  }
  const promotable = dryRun.ok && (completable === true || (completable === null && allowUnaudited));
  return { ref, dryRun, completable, result, reason, promotable, autoAuditPlan };
}
