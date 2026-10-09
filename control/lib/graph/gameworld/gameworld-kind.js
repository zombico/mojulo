/**
 * THE GAMEWORLD KIND — a gameworld stored as a sketch row, so it is iterated in place like every recipe:
 * `create_sketch({ title, manifest: { kind: 'gameworld', id, …the world recipe } })`, then `update_sketch` with a
 * `manifest` or a `patch` (an approval is a patch on `/review/<part>`). The stored manifest is the recipe AS WRITTEN
 * (plus its `kind`); it is read on every mint and update by `readGameworld`, whose teaching errors are the refusal.
 * Nothing derived is stored: the book is resolved from the recipe on every read.
 *
 * Pure. `gameworldOf(manifest)` is the world recipe a manifest carries (its `kind` and the sketch's own `title` set
 * aside), the shape every reader and sheet in this folder takes.
 */
import { readGameworld } from './world.js';

export const GAMEWORLD_KIND = 'gameworld';
export const isGameworldKind = (kind) => kind === GAMEWORLD_KIND;

/** The world recipe a stored manifest carries. */
export function gameworldOf(manifest) {
  const { kind: _k, title: _t, ...world } = manifest ?? {};
  return world;
}

/** Read a gameworld manifest and say what is wrong; → the manifest to store, as written. Throws with the reader's
 * own message. */
export function normalizeGameworldManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error("a gameworld manifest is { kind: 'gameworld', id, …the world recipe }");
  if (!isGameworldKind(manifest.kind)) throw new Error(`a gameworld manifest's kind is '${GAMEWORLD_KIND}'`);
  readGameworld(gameworldOf(manifest));
  return manifest;
}
