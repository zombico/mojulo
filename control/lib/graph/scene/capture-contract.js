/**
 * capture-contract — the shared names of the headless capture bridge
 * (renderer-emitter.plan.md E3). The World page (scene-three.js capture block) and the
 * node drivers (lib/motion/world-frames.js) exchange method names, probe fields, and
 * screenshot selectors; before this module those names existed only as string literals
 * on both sides. The emitter interpolates the bridge names from here and the drivers
 * address the page through them, so a rename is a one-line change that CANNOT drift —
 * and emit-parse.test.js asserts a capture page actually publishes every name below.
 *
 * Page-internal globals (`__mojCtrl`, `__mojSim`, `__mojClock`) are listed for testers
 * and probe consumers but stay literal inside the channel scripts — they are shared
 * between in-page kernels, not across the node/browser seam, and renaming them means
 * editing the kernels in channels.js anyway.
 */

// the bridge global the capture page publishes on window
export const CAPTURE_GLOBAL = '__mojCapture';

// bridge surface: readiness flag + the three drivers + the waypoint compiler
export const CAPTURE_READY = 'ready';
export const CAPTURE_FRAME = 'frame';
export const CAPTURE_STEP = 'step';
export const CAPTURE_PROBE = 'probe';
export const CAPTURE_COMPILE_WALK_TO = 'compileWalkTo';

// probe() result shape (top level) and per-entity fields — the assertion surface
export const PROBE_FIELDS = ['t', 'entities', 'hud', 'bodies'];
export const PROBE_ENTITY_FIELDS = ['pos', 'heading', 'pitch', 'vel', 'moving', 'locomotion', 'gaitPhase'];
// conditional probe field (game-metacontext G4): present only when the game channel is live —
// `{ levelRef, ended, result, events }`. This is what makes a traversal a completability audit
// (game-audit.js probeShowsCompletion reads it); listed separately from PROBE_FIELDS because
// those are unconditional keys of every probe.
export const PROBE_GAME_FIELD = 'game';

// capture screenshot target + live-only overlays the bakes hide
export const WORLD_ROOT_SELECTOR = '#wrap';
export const WORLD_HIDE_SELECTORS = ['.hud', '.hint'];

// page-internal globals surfaced to probe consumers (literal in channels.js kernels)
export const CTRL_GLOBAL = '__mojCtrl';
export const SIM_GLOBAL = '__mojSim';
export const CLOCK_GLOBAL = '__mojClock';
