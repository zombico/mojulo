/**
 * floorplan-principles — the universal principle layer.
 *
 * Mojulo is a principles engine: it already evaluates plans by LIVABILITY (assessLivability over
 * RELATIONSHIPS), by FLOW (assessFlow — desire lines), and by FENG SHUI (assessFlow's axial
 * through-shot / door confrontations / occluded centre / wet rest-corner / entry choke). Those
 * principles are the substance. The element model + schedules ("BIM") are the *formal projection*
 * that makes principle-satisfaction legible to a broad audience.
 *
 * This module is the single surface that gathers all of those — reusing the existing assessors,
 * not reinventing them — and tags each finding by REGISTER (which audience/lineage it speaks to)
 * and SEVERITY (invariant vs preferential). Type-specific building "programs" (restaurant, office)
 * become thin rule tables layered ON TOP of this shared, cross-typology bed of principles.
 *
 * See floorplan-bim.plan.md. scoreHouse() in floorplan-bim.js stays the compact residential grade;
 * evaluateBuilding() here is the richer, register-aware, multi-typology front door.
 */

import { buildElementModel, deriveSchedules } from './floorplan-bim.js';
import { structurizeFloorplan } from './floorplan-structure.js';
import { assessLivability, RELATIONSHIPS } from './floorplan-glyphs.js';
import { assessFlow } from './floorplan-flow.js';

const clamp01 = (n) => Math.max(0, Math.min(1, n));

// REGISTER — the lineage/audience a principle speaks to. The same finding reads as 'code' to a
// builder and as 'fengshui'/'livability' to a designer; BIM formalizes the qualitative ones.
export const REGISTERS = ['code', 'livability', 'flow', 'fengshui'];

// assessFlow folds flow + feng shui into one detector set; split them back out by rule lineage.
const FENG_SHUI_RULES = new Set([
  'axial-through-shot',          // sha chi / poison arrow — entry spears straight through
  'opposing-door-confrontation', // door clash
  'occluded-center',             // the heart of the home should stay open
  'wet-room-rest-corner',        // bath squatting the auspicious far rest corner
  'entry-choke',                 // ming tang / bright hall — keep space ahead of the door
]);
const flowRegister = (rule) => (FENG_SHUI_RULES.has(rule) ? 'fengshui' : 'flow');

// ── program rule helpers (read space.role over the walkable door graph) ───────────────────────
/** Can you walk from any `fromRole` space to any `toRole` space WITHOUT entering an `avoidRole`?
 *  Returns null if the rule doesn't apply (one side absent), else a boolean. */
function reachableAvoiding(model, fromRole, toRole, avoidRole) {
  const byId = new Map(model.spaces.map((s) => [s.id, s]));
  const starts = model.spaces.filter((s) => s.role === fromRole);
  const targets = new Set(model.spaces.filter((s) => s.role === toRole).map((s) => s.id));
  if (!starts.length || !targets.size) return null;
  const seen = new Set();
  const stack = starts.map((s) => s.id);
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    if (targets.has(id)) return true;
    for (const nb of byId.get(id)?.connects || []) {
      const nbSpace = byId.get(nb);
      if (!nbSpace || seen.has(nb) || nbSpace.role === avoidRole) continue;   // never route through the avoided role
      stack.push(nb);
    }
  }
  return false;
}

/** Does any space of `role` host an exterior door (its own exit to outside)? */
function roleHasExteriorDoor(model, role) {
  const ids = new Set(model.spaces.filter((s) => s.role === role).map((s) => s.id));
  return model.openings.some((o) => o.type === 'door' && o.exterior && o.connects.some((id) => ids.has(id)));
}

/** Does any space of `role` open onto a space whose role is in `circulationRoles`? */
function roleTouchesCirculation(model, role, circulationRoles) {
  const byId = new Map(model.spaces.map((s) => [s.id, s]));
  const set = new Set(circulationRoles);
  return model.spaces.filter((s) => s.role === role)
    .every((s) => (s.connects || []).some((id) => set.has(byId.get(id)?.role)));
}

// ── PROGRAMS — thin, type-specific rule tables layered on the universal principle bed ─────────
// Each rule reads space.role + the walkable graph and returns a finding (or null = passes / N/A).
// universality:'program' marks these as type-specific; register still names the lineage.
export const PROGRAMS = {
  residential: { label: 'residential', rules: [] },   // the universal bed already covers the home
  restaurant: {
    label: 'restaurant',
    rules: [
      (model) => {   // front-of-house / back-of-house separation (health-code + dignity)
        const ok = reachableAvoiding(model, 'dining', 'restroom', 'kitchenBOH');
        return ok === false
          ? { id: 'foh-boh-separation', register: 'flow', severity: 'invariant', detail: 'restroom is only reachable by walking through the kitchen' }
          : null;
      },
      (model) => {   // the kitchen needs its own back-of-house service/delivery exit
        if (!model.spaces.some((s) => s.role === 'kitchenBOH')) return null;
        return roleHasExteriorDoor(model, 'kitchenBOH') ? null
          : { id: 'kitchen-service-exit', register: 'code', severity: 'preferential', detail: 'kitchen has no back-of-house service exit' };
      },
    ],
  },
  office: {
    label: 'office',
    rules: [
      (model) => {   // meeting rooms should open onto the work floor / circulation, not be buried
        if (!model.spaces.some((s) => s.role === 'meetingRoom')) return null;
        return roleTouchesCirculation(model, 'meetingRoom', ['openOffice', 'circulation', 'reception']) ? null
          : { id: 'meeting-off-circulation', register: 'flow', severity: 'preferential', detail: 'a meeting room does not open onto the work floor / circulation' };
      },
    ],
  },
  mall: {
    label: 'mall',
    rules: [
      (model) => {   // every unit must have a storefront onto the concourse (not open only to another shop)
        const concourse = new Set(model.spaces.filter((s) => s.role === 'concourse').map((s) => s.id));
        if (!concourse.size) return null;
        const units = ['tenant', 'anchor', 'foodCourt', 'restroom'];
        const orphans = model.spaces
          .filter((s) => units.includes(s.role))
          .filter((s) => !(s.connects || []).some((id) => concourse.has(id)));
        return orphans.length
          ? { id: 'storefront-on-concourse', register: 'flow', severity: 'invariant',
            detail: `${orphans.length} unit(s) have no storefront onto the concourse (${orphans.map((o) => o.role).slice(0, 4).join(', ')})` }
          : null;
      },
      (model) => {   // restroom reachable from the concourse without walking through a shop
        const ok = reachableAvoiding(model, 'concourse', 'restroom', 'tenant');
        return ok === false
          ? { id: 'restroom-off-concourse', register: 'flow', severity: 'invariant', detail: 'restroom is only reachable by walking through a shop' }
          : null;
      },
      (model) => {   // anchors should cap the ends of the spine (draw footfall the full length)
        const fp = model.building.footprint;
        if (!fp) return null;
        const span = fp.y1 - fp.y0, tol = 0.25 * span;
        const stray = model.spaces.filter((s) => s.role === 'anchor').filter((s) => {
          const cy = s.footprint.y + s.footprint.h / 2;
          return (cy - fp.y0) > tol && (fp.y1 - cy) > tol;
        });
        return stray.length
          ? { id: 'anchors-at-termini', register: 'flow', severity: 'preferential', detail: `${stray.length} anchor(s) not at a concourse terminus` }
          : null;
      },
      (model) => {   // each storey's concourse must read as one continuous walkway (PER storey — a
                     // 2-level mall legitimately has one concourse per floor, linked only by escalator)
        for (const st of model.storeys || []) {
          const conc = model.spaces.filter((s) => s.role === 'concourse' && s.storey === st.id);
          if (conc.length < 2) continue;
          const ids = new Set(conc.map((s) => s.id));
          const byId = new Map(conc.map((s) => [s.id, s]));
          const seen = new Set();
          let comps = 0;
          for (const root of conc) {
            if (seen.has(root.id)) continue;
            comps += 1;
            const stack = [root.id];
            while (stack.length) {
              const id = stack.pop();
              if (seen.has(id)) continue;
              seen.add(id);
              for (const nb of byId.get(id)?.connects || []) if (ids.has(nb) && !seen.has(nb)) stack.push(nb);
            }
          }
          if (comps > 1) {
            return { id: 'concourse-continuity', register: 'code', severity: 'invariant', detail: `concourse on storey ${st.index} splits into ${comps} disconnected stretches` };
          }
        }
        return null;
      },
      (model) => {   // every upper level must be reachable from the ground concourse (escalator/stair)
        if ((model.storeys || []).length < 2) return null;
        const byId = new Map(model.spaces.map((s) => [s.id, s]));
        const roots = model.spaces.filter((s) => s.storey === 'storey:0' && s.role === 'concourse').map((s) => s.id);
        if (!roots.length) return null;
        const seen = new Set();
        const stack = [...roots];
        while (stack.length) {   // building-wide walk over the FULL connects graph (includes verticals)
          const id = stack.pop();
          if (seen.has(id)) continue;
          seen.add(id);
          for (const nb of byId.get(id)?.connects || []) if (!seen.has(nb)) stack.push(nb);
        }
        const stranded = model.spaces.filter((s) => s.storey !== 'storey:0' && !seen.has(s.id));
        return stranded.length
          ? { id: 'vertical-reachability', register: 'code', severity: 'invariant', detail: `${stranded.length} upper-level space(s) unreachable from the ground concourse (no escalator/stair)` }
          : null;
      },
    ],
  },
};

/**
 * Evaluate a floorplan against the universal principle bed (+, later, a program's own rules).
 * Reuses assessLivability + assessFlow verbatim and adds the structural/code principles the
 * element model exposes. Works on ANY typology that goes through structurizeFloorplan — houses,
 * restaurants, offices — because the universal principles read geometry + the walkable graph,
 * not residential semantics.
 *
 * @param input  a single-floor plan ({ rooms, halls, doors, width, height }) OR a multi-level
 *               structure ({ levels, transports, plans }) from e.g. buildMallLevels.
 * @param {{ program?: string, opts?: object }} cfg
 * @returns {{ ok, score, program, byRegister, findings }}
 *   findings: [{ id, register, universality, severity:'invariant'|'preferential', ok, detail }]
 */
export function evaluateBuilding(input = {}, cfg = {}) {
  const program = cfg.program || 'residential';
  const opts = cfg.opts || {};
  let model, plan, livFloors;
  if (Array.isArray(input.levels)) {                       // multi-level structure (escalators spliced in)
    model = buildElementModel(input, opts);
    livFloors = input.levels.map((l) => l.structure?.plan).filter(Boolean);
    plan = input.plans?.ground || livFloors[0] || { rooms: [], halls: [], doors: [] };   // flow reads the ground floor
  } else {                                                 // single-floor plan
    const s = structurizeFloorplan(input, opts);
    model = buildElementModel({ wallGraph: s.wallGraph, cells: s.cells, baseZ: s.baseZ }, opts);
    plan = { rooms: s.plan.rooms, halls: s.plan.halls || [], doors: s.plan.doors || [] };
    livFloors = [plan];
  }
  const sched = deriveSchedules(model);

  const findings = [];
  const add = (f) => findings.push({ universality: 'universal', ok: true, ...f });

  // ── CODE register — structural, every building ─────────────────────────────
  for (const r of sched.reachability) {
    for (const iso of r.isolated) {
      add({ id: 'reachability', register: 'code', severity: 'invariant', ok: false,
        detail: `${iso.name} has no walkable door (storey ${r.storey})` });
    }
  }
  // ── LIVABILITY register — proportion (comfort) + the existing livability invariants ─────────
  for (const sp of model.spaces) {
    const rel = RELATIONSHIPS[sp.glyph];
    if (!rel) continue;
    const short = Math.min(sp.footprint.w, sp.footprint.h);
    const aspect = Math.max(sp.footprint.w, sp.footprint.h) / Math.max(0.1, short);
    if (short < (rel.minDim ?? 0) - 0.25) {
      add({ id: 'min-dimension', register: 'livability', severity: 'preferential', ok: false,
        detail: `${sp.name} is ${short.toFixed(1)}ft narrow (< ${rel.minDim}ft)` });
    } else if (rel.maxAspect != null && aspect > rel.maxAspect + 0.15) {
      add({ id: 'proportion', register: 'livability', severity: 'preferential', ok: false,
        detail: `${sp.name} aspect ${aspect.toFixed(1)} > ${rel.maxAspect}` });
    }
  }
  for (const v of assessLivability(livFloors).violations) {   // assessLivability aggregates across floors
    add({ id: v.rule, register: 'livability', severity: 'invariant', ok: false, detail: v.detail });
  }
  // ── FLOW + FENG SHUI registers — the existing desire-line / feng-shui detectors ─────────────
  const flow = assessFlow(plan, opts);
  for (const v of flow.necessary) {
    add({ id: v.rule, register: flowRegister(v.rule), severity: 'invariant', ok: false, detail: v.detail });
  }
  for (const v of flow.preferential) {
    add({ id: v.rule, register: flowRegister(v.rule), severity: 'preferential', ok: false, detail: v.detail });
  }
  // ── PROGRAM register — type-specific rules layered on the universal bed ─────────────────────
  const prog = PROGRAMS[program] || PROGRAMS.residential;
  for (const rule of prog.rules) {
    const f = rule(model, plan);
    if (f) add({ universality: 'program', ok: false, ...f });
  }

  const invariants = findings.filter((f) => f.severity === 'invariant');
  const prefs = findings.filter((f) => f.severity === 'preferential');
  const score = clamp01(1 - 0.2 * invariants.length - 0.04 * prefs.length);
  const byRegister = Object.fromEntries(REGISTERS.map((reg) => {
    const fs = findings.filter((f) => f.register === reg);
    return [reg, { invariant: fs.filter((f) => f.severity === 'invariant').length,
      preferential: fs.filter((f) => f.severity === 'preferential').length }];
  }));

  return { ok: invariants.length === 0, score: Math.round(score * 100) / 100, program, byRegister, findings };
}
