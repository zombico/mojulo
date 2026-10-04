// Experimental carrier, deliberately outside production graph dispatch.
// A reusable closure so the preview and Node verification execute the same kernel.
export function buildParticleVacuum(template) {
  const finite = (x) => typeof x === 'number' && Number.isFinite(x);
  const vec = (v) => Array.isArray(v) && v.length === 3 && v.every(finite);
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const scale = (v, s) => v.map((x) => x * s);
  const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
  const decay = 1.4, duration = 5;
  function validate(particles, events, time) {
    if (!finite(time) || time < 0) throw Error('time must be finite and nonnegative');
    const ids = new Set();
    for (const p of particles) {
      if (typeof p.id !== 'string' || ids.has(p.id) || !vec(p.anchor)) throw Error('unique particle id and finite anchor required');
      ids.add(p.id);
    }
    const eventIds = new Set();
    for (const e of events) {
      if (typeof e.id !== 'string' || eventIds.has(e.id) || !finite(e.time) || e.time < 0 || !vec(e.center) || !finite(e.radius) || e.radius <= 0 || !vec(e.impulse)) throw Error('invalid contact event');
      eventIds.add(e.id);
    }
  }
  function carrier(p, hits, time) {
    let center = p.anchor.slice(), phase = 0, excitation = 0, active = false;
    for (const h of hits) {
      const age = time - h.time;
      if (age < 0) continue;
      const t = Math.min(age, duration);
      // Integrated exponentially decaying velocity: no accumulated frame-step error.
      center = add(center, scale(h.impulse, (1 - Math.exp(-decay * t)) / decay));
      phase += t * 5 * h.weight;
      if (age < duration) { active = true; excitation += h.weight * Math.exp(-decay * t); }
    }
    return { id: p.id, center, phase, excitation, active };
  }
  function sample(particles, events, time) {
    validate(particles, events, time);
    const hits = new Map(particles.map((p) => [p.id, []]));
    const ordered = events.filter((e) => e.time <= time).slice().sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const e of ordered) {
      // Contacts test CURRENT centers at event time, including earlier impulses.
      // Ties execute in stable id order; authored events are a log, not live collision facts.
      for (const p of particles) {
        const history = hits.get(p.id);
        const d = distance(carrier(p, history, e.time).center, e.center);
        if (d > e.radius) continue;
        const weight = 1 - d / e.radius;
        if (weight > 0) history.push({ time: e.time, weight, impulse: scale(e.impulse, weight) });
      }
    }
    return particles.map((p) => {
      const state = carrier(p, hits.get(p.id), time);
      const c = Math.cos(state.phase), s = Math.sin(state.phase);
      const r = 1 + 0.35 * state.excitation * Math.sin(state.phase);
      const polylines = template.map((line) => line.map(([x, y, z]) => add(state.center, [r * (x * c - y * s), r * (x * s + y * c), r * z])));
      return { ...state, contacts: hits.get(p.id).length, polylines };
    });
  }
  return { sample, duration };
}
