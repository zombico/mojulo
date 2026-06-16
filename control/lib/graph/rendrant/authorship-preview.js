/**
 * Authorship preview — pre-expansion gate (consensus chain Phase 5a).
 *
 * Manifest-only validator that runs BEFORE expensive expansion. Catches
 * authorship errors that would make the post-expansion preflight verdict
 * meaningless: missing shot contract under planning-valid mode, declared
 * gravity bodies without declared supports, hall mandala without axis-mundi,
 * shot glyphs missing required topology fields, etc.
 *
 * Independent of marks. Same input shape as `validateSpatialPlan` would see
 * but only reads declarations (not resolution). Used by:
 *   - expandNeoRembrandt (renderer side) — surfaces verdict into chain metadata
 *   - polygonizer's runPlanningTurn (model side) — gates turn 2 on a passed
 *     authorship verdict, repairs turn 1 when blocked
 *
 * Immutable in the back-edge sense: once produced, downstream stages may not
 * revise the verdict. Reconciliation operates strictly within authorshipPreview
 * bounds (see plan §1).
 */

const ACTIVE_GATE_MODES = new Set(['planning-valid']);

export function runAuthorshipPreview(manifest) {
  const polygonizer = manifest?.polygonizer || {};
  const planning = polygonizer.spatialPlanning || polygonizer.rendrantPipeline || {};
  const materializationGate = planning.materializationGate || (planning.mode === 'plan-before-skin' ? 'planning-valid' : 'legacy-open');
  const gateActive = ACTIVE_GATE_MODES.has(materializationGate);

  const checks = [];
  pushCheck(checks, viewBoxCheck(manifest));
  pushCheck(checks, shotContractDeclaredCheck(manifest));
  pushChecks(checks, shotGlyphTopologyChecks(polygonizer));
  pushCheck(checks, hallMandalaAxisMundiCheck(polygonizer));
  pushChecks(checks, gravityBodyDeclaredSupportChecks(polygonizer));
  pushChecks(checks, roomRequiredRoleChecks(polygonizer));
  pushCheck(checks, materializationGateModeCheck(materializationGate));

  const blocking = checks.filter((check) => check.ok === false && check.gating === true);
  const advisory = checks.filter((check) => check.ok === false && check.gating !== true);
  const verdict = gateActive && blocking.length > 0 ? 'blocked' : 'passed';

  return {
    immutable: true,
    phase: 'pre-expansion',
    verdict,
    gateActive,
    materializationGate,
    checks,
    blockingCount: blocking.length,
    advisoryCount: advisory.length,
  };
}

function pushCheck(out, check) {
  if (check) out.push(check);
}

function pushChecks(out, list) {
  if (!Array.isArray(list)) return;
  for (const check of list) pushCheck(out, check);
}

function viewBoxCheck(manifest) {
  const vb = manifest?.viewBox;
  const ok = vb && Number.isFinite(Number(vb.width)) && Number(vb.width) > 0
    && Number.isFinite(Number(vb.height)) && Number(vb.height) > 0;
  return {
    role: 'view-box-declared',
    ok: Boolean(ok),
    gating: true,
    reason: ok ? 'manifest declares finite positive viewBox' : 'manifest.viewBox must declare finite positive width and height',
  };
}

function shotContractDeclaredCheck(manifest) {
  const polygonizer = manifest?.polygonizer || {};
  const hasShotGlyph = Boolean(polygonizer.shotGlyph) || (Array.isArray(polygonizer.shotGlyphs) && polygonizer.shotGlyphs.length > 0);
  const hasViewBox = Boolean(manifest?.viewBox);
  const ok = hasShotGlyph || hasViewBox;
  return {
    role: 'shot-contract-declared',
    ok,
    gating: true,
    reason: ok
      ? 'shot contract has at least one of shotGlyph(s) or viewBox'
      : 'planning-valid manifests require polygonizer.shotGlyph(s) or manifest.viewBox',
  };
}

function shotGlyphTopologyChecks(polygonizer) {
  const glyphs = collectShotGlyphs(polygonizer);
  if (!glyphs.length) return [];
  const out = [];
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i];
    const id = glyph?.id || glyph?.label || `shotGlyph[${i}]`;
    const topology = glyph?.topology || {};
    for (const field of ['cameraVector', 'lightEntry', 'support']) {
      out.push({
        role: `${id}:shot-glyph-${kebab(field)}`,
        ok: Boolean(topology[field]),
        gating: true,
        glyphId: id,
        field,
        reason: topology[field]
          ? `shotGlyph '${id}' declares topology.${field}`
          : `shotGlyph '${id}' must declare topology.${field}`,
      });
    }
  }
  return out;
}

function hallMandalaAxisMundiCheck(polygonizer) {
  const hall = polygonizer?.mandalaPatternLayer?.hallMandala || polygonizer?.hallMandala;
  if (!hall || typeof hall !== 'object' || Array.isArray(hall)) return null;
  const ok = Boolean(hall.axisMundi);
  return {
    role: 'hall-mandala-has-axis-mundi',
    ok,
    gating: true,
    reason: ok
      ? 'hallMandala declares axisMundi'
      : 'declared hallMandala must include axisMundi',
  };
}

function gravityBodyDeclaredSupportChecks(polygonizer) {
  const gravity = polygonizer?.metamandala?.gravity;
  const bodies = Array.isArray(gravity?.bodies) ? gravity.bodies : [];
  if (!bodies.length) return [];
  return bodies.map((body, idx) => {
    const targetRole = body?.targetRole || body?.role || body?.bodyRole || `body[${idx}]`;
    const supportRole = body?.surfaceRole || body?.supportRole || body?.on || body?.onRole;
    const ok = Boolean(supportRole);
    return {
      role: `${targetRole}:declared-gravity-has-support`,
      ok,
      gating: true,
      targetRole,
      supportRole: supportRole || null,
      reason: ok
        ? `gravity body '${targetRole}' declares supportRole '${supportRole}'`
        : `gravity body '${targetRole}' must declare supportRole / surfaceRole / on / onRole`,
    };
  });
}

function roomRequiredRoleChecks(polygonizer) {
  const room = polygonizer?.roomConcept || polygonizer?.roomPlanning;
  if (!room || typeof room !== 'object') return [];
  const required = Array.isArray(room.requiredRoles) ? room.requiredRoles
    : Array.isArray(room.fullFrameRoles) ? room.fullFrameRoles : [];
  if (!required.length) return [];
  const constellationNodes = Array.isArray(polygonizer?.constellation?.nodes) ? polygonizer.constellation.nodes : [];
  const nodeRoles = new Set(constellationNodes.map((node) => node?.role).filter(Boolean));
  return required.map((role) => {
    const ok = nodeRoles.has(role);
    return {
      role: `${role}:room-required-role-has-anchor`,
      ok,
      // Advisory: room-required roles may resolve later from form-authored constellations
      // or twoPointCamera pinnedElements; we only gate when constellation is declared.
      gating: constellationNodes.length > 0,
      requiredRole: role,
      reason: ok
        ? `required room role '${role}' has a constellation anchor`
        : `required room role '${role}' has no matching constellation node`,
    };
  });
}

function materializationGateModeCheck(mode) {
  const known = new Set(['planning-valid', 'legacy-open']);
  const ok = known.has(mode);
  return {
    role: 'materialization-gate-mode',
    ok,
    gating: false,
    mode,
    reason: ok ? `materializationGate '${mode}' is known` : `materializationGate '${mode}' is not a recognized value`,
  };
}

function collectShotGlyphs(polygonizer) {
  if (Array.isArray(polygonizer?.shotGlyphs) && polygonizer.shotGlyphs.length) return polygonizer.shotGlyphs;
  if (polygonizer?.shotGlyph) return [polygonizer.shotGlyph];
  return [];
}

function kebab(name) {
  return String(name).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
