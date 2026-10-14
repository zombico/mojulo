/**
 * LEVEL SIM — a level's world and bus stepped together in Node, in the page's order (scene/channels/events.js), with no
 * rendering: the walkers' zone facts and the cast's facts join the frame's events, the bus processes them, its watches,
 * timers and sagas run, the character intents it queued reach the world, then the world steps. For laws that play a
 * level through (a defence held, a race run) where the page would take minutes and a hidden tab barely ticks.
 *
 *   simLevel({ entities, events, colliders?, camera? }, { ground?, surface?, beat?, powers? }) → { world, bus, input, frame(dt, events?), run(seconds, at?) }
 *     `beat`: { every, lead } (audio.beat): the music's pulse on the bus from the level's own clock, as the page says it
 *     from its music's (beats/beat-clock.js); absent, no beat
 *     `at`: { <second>: [events] } pushed into the frame that reaches that time (an interact press: { type: 'use-<id>' })
 *     `input`: the pilot's held input every frame (set its fields: { fire: 1, … }), as the page's keys and mouse give it
 *
 * POWERS (game.powers: { target, grants: { <power>: { <rule knob>: number } } }): a power the bus hears picked up
 * (pickup:<power>) merges its knobs into its holder's rule once, as the page's game channel grants it (__grant).
 *
 * SCENES (events.scenes, scenes.js's program) play as the page plays them (channels/scene-channel.js): after the bus and
 * its ops, the runner hears the log since the last frame and steps with the frame's presses (`scene`: { next, held,
 * skip, move, pick }), its beats go to the bus and its camera ops to the cast; while one plays, the pilot's input is
 * held (the world steps on).
 *
 * A MENU UP FREEZES THE WORLD, as the page's does (channels/interact-channel.js __syncMenus: a menu whose var is 1 is
 * open, read after the frame; the next frame's clock is 0 for the bus's timers and sagas and for the world's step).
 *
 * Deterministic: a fixed dt (1/30 s), the bus's own content order, the world's seeded rules.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { buildBus } from '../worlds/event-bus.js';
import { beatsDue } from '../beats/beat-clock.js';
import { buildSceneRunner } from '../playscape/ui/scene-runner.js';

let E = null;
const B = buildBus();

export function simLevel({ entities = [], events = {}, colliders, camera } = {}, { ground = () => 0, surface = null, beat = null, powers = null } = {}) {
  E ??= composeLive();
  // the page's camera (payload.camera: { rule, target, … }), stepped last as the page steps it; a key never carries it
  const world = E.createWorld({ entities, ...(colliders ? { colliders } : {}), ...(camera && typeof camera.rule === 'string' ? { camera } : {}) });
  const bus = B.createBusState(events, events.entities);
  const hooks = { ground, ...(surface ? { surface } : {}) };
  let zonePrev, castPrev, t = 0;
  const pulse = beat && beat.every > 0 ? { n: 0 } : null;
  const menuVars = (events.menus || []).map((m) => m && (m.var || `ui-menu-${m.id}`)).filter(Boolean);
  let frozen = false, mt = 0;
  const input = {};
  const SR = Array.isArray(events.scenes) && events.scenes.length ? buildSceneRunner() : null;
  const scn = SR ? SR.create(events.scenes) : null;
  let scnSeen = 0, sceneCtl = {};
  const granted = {};
  const grant = (from) => {
    if (!powers || !powers.grants) return;
    for (let i = from; i < bus.log.length; i++) {
      const ev = bus.log[i], id = ev && typeof ev.type === 'string' && ev.type.startsWith('pickup:') ? ev.type.slice(7) : null;
      const g = id != null ? powers.grants[id] : null, e = world.byId[powers.target];
      if (!g || !e || granted[id]) continue;
      granted[id] = true;
      if (e.rule) Object.assign(e.rule, g);
      if (e.pilotRule && e.pilotRule !== e.rule) Object.assign(e.pilotRule, g);
    }
  };
  const process = (list) => { const n0 = bus.log.length; B.processEvents(bus, list); grant(n0); };
  const pump = (list) => {
    if (list.length) process(list);
    let w = B.watchEvents(bus);
    for (let k = 0; w.length && k < 8; k++) { process(w); w = B.watchEvents(bus); }
  };
  pump(events.initial || []);
  const frame = (dt, extra = []) => {
    // the beat reads the music, which plays on under a menu: its own clock, never frozen
    const incoming = [...extra, ...(pulse ? beatsDue(pulse, mt + (beat.lead || 0), beat.every) : [])];
    mt += dt;
    const z = B.deriveZoneEvents(world.entities, zonePrev, events.sources); zonePrev = z.prev; incoming.push(...z.events);
    const c = E.castFacts(world, castPrev); castPrev = c.prev; incoming.push(...c.events);
    pump(incoming);
    const live = frozen ? 0 : dt;
    pump(B.tickTimers(bus, live));
    pump(B.stepTime(bus, live));
    B.syncToCtrl(bus, world.entities, (ops) => E.castOps(world, ops));
    let held = false;
    if (scn) {
      SR.hear(scn, bus.log.slice(scnSeen).map((x) => x && x.type).filter((t) => typeof t === 'string'));
      scnSeen = bus.log.length;
      const o = SR.step(scn, dt, { ...sceneCtl, vars: bus.vars });
      sceneCtl = {};
      if (o.fire.length) { pump(o.fire.map((type) => ({ type }))); B.syncToCtrl(bus, world.entities, (ops) => E.castOps(world, ops)); }
      if (o.ops.length) E.castOps(world, o.ops);
      held = SR.view(scn).on;
    }
    E.stepWorld(world, held ? {} : input, live, hooks);
    t += live;
    frozen = menuVars.some((v) => bus.vars[v] === 1);
  };
  const run = (seconds, at = {}) => {
    const due = Object.keys(at).map(Number).sort((a, b) => a - b);
    for (let n = Math.round(seconds * 30); n > 0; n--) {
      const now = [];
      while (due.length && due[0] <= t + 1e-9) now.push(...at[due.shift()]);
      frame(1 / 30, now);
    }
  };
  return { world, bus, input, frame, run, get time() { return t; }, scene: (ctl) => { sceneCtl = ctl || {}; }, get sceneView() { return scn ? SR.view(scn) : null; } };
}
