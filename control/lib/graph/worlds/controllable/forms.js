/**
 * forms.js — FORMS: one body that changes what it is (more-than-meets). An entity carries `forms`, a rule per form
 * ({ robot: { rule: { type: 'platform', … } }, vehicle: { rule: { type: 'drive', … } } }), and plays one at a time.
 * The `transform` input (B, the left stick's click) turns the pilot into its next form:
 *
 *   • THE BEAT: `transformDur` s (0.8) the body is the transformation's — owned (no rule, no weapon), invincible,
 *     its clip `transform:<to>` played 0 → 1 (the figure bakes it: transformation/compose.js), carried on by the
 *     momentum it had, easing off; a ground form settles onto the ground as it ends.
 *   • THE SWAP: at the beat's end the form's rule becomes the entity's rule (and its pilot rule, so a respawn or a
 *     pilot swap keeps the form), and the speed crosses over along the heading: a walker's velocity is a car's
 *     speed and a craft's airspeed (at least its take-off speed, so a jet form flies at once), and back.
 *   • BUSY: a body mid-swing, mid-dodge, mid-tackle, in a clash, reeling or downed does not transform.
 *
 * Facts: form, transforming, transformT (0 … 1 through the beat), transformTo, and the edges transformStart and
 * transformed (the frame it began, the frame it ended). `e.wantTransform` (a form name or true) asks for one from
 * outside the input (a mind, a bus op). An entity without `forms` is untouched: a world without one steps
 * byte-identically.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; after the maneuvers, before the mind.
 */

export function buildForms(E) {
  const { fwdXY, fwd3, resolveBlocking, registerNormalize, registerPreStep, registerBodyOwner } = E;

  registerNormalize((ent, raw) => {
    const F = raw.forms;
    if (!F || typeof F !== 'object') return;
    const names = Object.keys(F).filter((k) => F[k] && F[k].rule && F[k].rule.type);
    if (names.length < 2) return;
    ent.forms = {};
    for (const k of names) ent.forms[k] = { ...F[k], rule: { ...F[k].rule } };
    ent.formOrder = names;
    ent.form = names.includes(raw.form) ? raw.form : names[0];
    ent.transformDur = raw.transformDur > 0 ? raw.transformDur : 0.8;
    ent.transformT = null;
    ent.rule = ent.forms[ent.form].rule;   // the pilotable hoist reads this as the pilot rule
  });

  const busy = (e) => e.swingT != null || e.dodgeT != null || e.tackleT != null || e.clashT != null || e.staggerT != null
    || e.cineT != null || e.downed || e.jumpCharge >= 0;

  // the world velocity a body has under its rule
  function carried(e) {
    const r = e.rule || {}, t = e.transform;
    if (r.type === 'drive' || r.type === 'racer') { const f = fwdXY(t.heading); return [f[0] * (e.speed || 0), f[1] * (e.speed || 0), 0]; }
    if (r.type === 'fly') { const f = fwd3(t.heading, t.pitch || 0); const v = e.airspeed || 0; return [f[0] * v, f[1] * v, f[2] * v]; }
    // a walker moves its body directly: its velocity is last frame's motion (the beat's owner measures it)
    return e.formVel ? e.formVel.slice() : [0, 0, 0];
  }

  function beginTransform(e, to) {
    if (!e.forms || e.transformT != null || busy(e)) return false;
    const order = e.formOrder;
    const next = typeof to === 'string' && e.forms[to] && to !== e.form ? to : order[(order.indexOf(e.form) + 1) % order.length];
    e.transformVel = carried(e);
    e.transformT = 0;
    e.transformFrom = e.form;
    e.transformTo = next;
    e.transformStart = true;
    e.transforming = true;
    e.boosting = false; e.hovering = false; e.braking = false; e.throttle = 0;
    return true;
  }

  function finishTransform(e) {
    const to = e.transformTo, F = e.forms[to], r = F.rule, t = e.transform;
    const piloted = e.pilotable && e.rule === e.pilotRule;
    e.form = to;
    e.rule = r;
    if (piloted) e.pilotRule = r;
    const v = e.transformVel || [0, 0, 0], f = fwdXY(t.heading), sp = Math.max(0, v[0] * f[0] + v[1] * f[1]);
    if (r.type === 'drive' || r.type === 'racer') {
      e.speed = sp; e.vel = [0, 0, 0]; e.tilt = null; t.pitch = 0;
      e.locomotion = 'drive';
    } else if (r.type === 'fly') {
      const stall = r.stallSpeed > 0 ? r.stallSpeed : 18, off = r.takeoffSpeed > 0 ? r.takeoffSpeed : Math.round(stall * 1.25);
      e.airspeed = Math.max(sp, F.launch ?? off * 1.1);
      e.airborne = true;
      t.pos[2] += F.lift ?? 0;
      e.vel = [0, 0, 0];
      e.locomotion = 'fly';
    } else {
      e.vel = [v[0], v[1], v[2]];
      e.speed = 0; e.airspeed = 0; e.tilt = null; t.pitch = 0;
      e.locomotion = 'forward';
    }
    e.transformT = null; e.transformVel = null; e.transformFrom = null;
    e.transforming = false; e.transformed = true;
    if (e.cineT == null) e.invincible = false;
  }

  // the pilot's B press, or any body's own ask
  registerPreStep('transform', (state, input) => {
    if (input.transform && state.pilotId) { const p = state.byId[state.pilotId]; if (p) beginTransform(p); }
    for (const e of state.entities) {
      if (e.wantTransform) { beginTransform(e, e.wantTransform); e.wantTransform = null; }
    }
  }, 32);

  // the beat: the body is the transformation's until it lands in its new form
  registerBodyOwner('transform', (e, input, dt, state, world) => {
    if (!e.forms) return false;
    const p = e.transform.pos;
    if (e.transformT == null) {
      if (e.transformed) e.transformed = false;
      // last frame's motion (what a walker carries into its next form)
      if (e.formPrev && dt > 0) e.formVel = [(p[0] - e.formPrev[0]) / dt, (p[1] - e.formPrev[1]) / dt, (p[2] - e.formPrev[2]) / dt];
      e.formPrev = [p[0], p[1], p[2]];
      return false;
    }
    e.formPrev = null; e.formVel = null;
    if (e.transformT > 0) e.transformStart = false;
    e.transformT = Math.min(1, e.transformT + dt / e.transformDur);
    const t = e.transform, v = e.transformVel, k = Math.max(0, 1 - dt * 1.2);
    v[0] *= k; v[1] *= k;
    t.pos[0] += v[0] * dt; t.pos[1] += v[1] * dt;
    const R = e.forms[e.transformTo].rule, eye = R.eye ?? 0;
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, R.collideHeight ?? 3, R.collideRadius ?? 0, world.colliders, R.step ?? 0.3);
    // a ground form settles onto the ground through the beat; an air form keeps its height
    if (R.type !== 'fly' && !R.space && world && world.ground) {
      const gz = world.ground([t.pos[0], t.pos[1], t.pos[2] + 3]);
      if (gz != null) t.pos[2] += (gz + eye - t.pos[2]) * Math.min(1, dt * 6);
    }
    e.locomotion = `transform:${e.transformTo}`;
    e.gaitPhase = e.transformT;
    e.moving = true;
    e.invincible = true;
    if (e.transformT >= 1) finishTransform(e);
    return true;
  }, 35);

  Object.assign(E, { beginTransform });
}
