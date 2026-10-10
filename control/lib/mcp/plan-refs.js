/**
 * Step references — a plan manifest's way to hand one call's result to a later call, so an agent writes a chain
 * (mint → export → measure → bind) once and the executor carries the refs. Anywhere inside a step's `args`, the object
 *
 *   { "$step": 0, "path": "/ref" }
 *
 * stands for the value at JSON Pointer `path` in step 0's result (`path` omitted: the whole result). A reference
 * names an EARLIER step only; compile refuses a forward or self reference, and execution refuses a pointer that finds
 * nothing (naming the step, the path and the keys that were there), so a chain fails at the link that broke.
 *
 * Pure: `stepRefErrors` is compile's check, `resolveStepRefs` execution's substitution. An object is a reference only
 * when its keys are `$step` and optionally `path`, so a recipe that merely carries a `$step` key beside others is left
 * as it is.
 */
import { parsePointer } from './tools/manifest-patch.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** True when `v` is a step reference. */
export function isStepRef(v) {
  return isObj(v) && Object.hasOwn(v, '$step') && Object.keys(v).every((k) => k === '$step' || k === 'path');
}

/** Every reference in `args`: `[{ at, ref }]`, `at` the pointer within args. */
export function stepRefsOf(args, at = '') {
  if (isStepRef(args)) return [{ at: at || '/', ref: args }];
  if (Array.isArray(args)) return args.flatMap((v, i) => stepRefsOf(v, `${at}/${i}`));
  if (isObj(args)) return Object.entries(args).flatMap(([k, v]) => stepRefsOf(v, `${at}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`));
  return [];
}

/** Compile's check for step `i`'s args: each reference names an earlier step and a well-formed pointer. */
export function stepRefErrors(args, i) {
  const errors = [];
  for (const { at, ref } of stepRefsOf(args)) {
    const where = `manifest[${i}].args${at === '/' ? '' : at}`;
    if (!Number.isInteger(ref.$step) || ref.$step < 0 || ref.$step >= i) {
      errors.push(`${where}: $step ${JSON.stringify(ref.$step)} must name an earlier step (0 to ${i - 1})${i === 0 ? ' — the first step has none' : ''}`);
      continue;
    }
    if (ref.path !== undefined && ref.path !== '') {
      try { parsePointer(ref.path, where); } catch (err) { errors.push(err.message); }
    }
  }
  return errors;
}

/** A step's result as data: tool handlers return objects, and a string result is read as JSON when it is JSON. */
function asData(result) {
  if (typeof result !== 'string') return result;
  try { return JSON.parse(result); } catch { return result; }
}

function lookup(result, path, step, where) {
  const data = asData(result);
  if (path === undefined || path === '') return data;
  let node = data;
  for (const seg of parsePointer(path, where)) {
    const next = Array.isArray(node) ? node[/^(0|[1-9]\d*)$/.test(seg) ? Number(seg) : NaN] : isObj(node) ? node[seg] : undefined;
    if (next === undefined) {
      const had = isObj(node) ? Object.keys(node).slice(0, 12).join(', ') : Array.isArray(node) ? `an array of ${node.length}` : typeof node;
      throw new Error(`${where}: step ${step}'s result has nothing at '${path}' (stopped at '${seg}'; there: ${had})`);
    }
    node = next;
  }
  return node;
}

/** `args` with every reference replaced by its value from `results` (by step index). → `{ args, resolved }`, `resolved`
 * mapping each reference's place in args to the value it took, for the execution log. */
export function resolveStepRefs(args, results, i) {
  const resolved = {};
  const walk = (v, at) => {
    if (isStepRef(v)) {
      const value = lookup(results[v.$step], v.path, v.$step, `manifest[${i}].args${at}`);
      resolved[at || '/'] = value;
      return value;
    }
    if (Array.isArray(v)) return v.map((x, k) => walk(x, `${at}/${k}`));
    if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, `${at}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`)]));
    return v;
  };
  return { args: walk(args, ''), resolved };
}
