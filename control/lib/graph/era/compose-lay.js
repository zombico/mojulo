/**
 * THE DRESSING LAID (the scene composer at authoring time): a composed stage's things (compose-dress.js) laid into its
 * recipe as `props`, a sane default the operator then changes with update_sketch's own patch (by id: `remove`, `set`,
 * `add` into 'props'). Laid when a composed stage has none yet, or asks again (`props: 'reroll'`); a list already there
 * is the operator's and is kept; `props: false` lays none.
 *
 *   resolveProps(manifest) → the manifest with its `props` laid (a stage not composed, or one with its own, as it was)
 */
import { planStage } from './stage.js';
import { withProgram } from './programs.js';

export function resolveProps(manifest) {
  if (!manifest || manifest.kind !== 'stage' || manifest.compose === undefined) return manifest;
  if (Array.isArray(manifest.props) || manifest.props === false) return manifest;
  if (manifest.props !== undefined && manifest.props !== 'reroll') throw new Error("stage: props is a list of items, 'reroll' (laid again), or false (none)");
  const { props, ...m } = manifest;
  // (a building's program lowered to its rooms first, as the build lowers it)
  const plan = planStage(m.program !== undefined ? withProgram(m) : m);
  return { ...manifest, props: plan.props ?? [] };
}
