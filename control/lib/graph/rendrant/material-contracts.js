/**
 * Material contracts normalizer — consensus chain Phase 6.
 *
 * Reads the expanded manifest and classifies marks into a single queryable
 * taxonomy: `materialContracts: [{ role, family, adapter, targetRoles,
 * phase, budget, source }]`. This is a CLASSIFIER, not a lowering layer.
 * Lowering already happened upstream in expandNeoRembrandt; this just tags
 * the existing output with a stable vocabulary.
 *
 * Two sources of family info, in priority order:
 *
 * 1. Empirical (Phase 4 recipe tags): marks emitted by recipes carry
 *    `materialContractFamily` directly. Phase 4 ships these for
 *    `portraitBust` (peach-profile / face-feature / hair / backdrop) and
 *    `roomInteriorTwoPoint` (room-plane). The family names live in the
 *    recipe code, not here — this classifier just forwards them.
 *
 * 2. A-priori (renderer-side primitives): blobPla / rBrush / fluidField /
 *    stickerField:cohere / stickerField:stringSpawn / fabricArmor leave
 *    enough metadata on their emitted marks that we can classify without
 *    explicit tagging. These map to the plan's families: joinery, motion,
 *    fiber, skin, surface.
 *
 * Per the plan: this is the smallest, most defensible Phase 6 — it doesn't
 * invent a vocabulary, it normalizes what recipes and adapters already
 * emit. Phase 4 recipes can iterate on the empirical families freely; this
 * classifier picks up whatever they tag.
 */

const A_PRIORI_FAMILIES = {
  joinery: 'joinery',
  motion: 'motion',
  fiber: 'fiber',
  skin: 'skin',
  surface: 'surface',
};

export function deriveMaterialContracts(expandedManifest) {
  const marks = Array.isArray(expandedManifest?.marks) ? expandedManifest.marks : [];
  const contracts = [];
  const seen = new Set();

  for (const mark of marks) {
    const contract = classifyMark(mark);
    if (!contract) continue;
    // De-dupe per (role, adapter) — shadow/highlight derivatives of the same
    // source mass shouldn't each emit their own contract.
    const key = `${contract.role || '(anonymous)'}::${contract.adapter || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contracts.push(contract);
  }

  return contracts;
}

export function summarizeMaterialContracts(contracts) {
  if (!Array.isArray(contracts) || contracts.length === 0) {
    return { count: 0, familyCounts: {}, phaseCounts: {}, families: [], phases: [] };
  }
  const familyCounts = {};
  const phaseCounts = {};
  for (const c of contracts) {
    if (c.family) familyCounts[c.family] = (familyCounts[c.family] || 0) + 1;
    if (c.phase) phaseCounts[c.phase] = (phaseCounts[c.phase] || 0) + 1;
  }
  return {
    count: contracts.length,
    familyCounts,
    phaseCounts,
    families: Object.keys(familyCounts).sort(),
    phases: Object.keys(phaseCounts).sort(),
  };
}

function classifyMark(mark) {
  if (!mark || typeof mark !== 'object') return null;
  // Diagnostic marks are not material contracts.
  if (mark.spatialPlanDiagnostic || mark.authorshipPreviewDiagnostic) return null;

  // 1. Empirical — Phase 4 recipe tag.
  if (typeof mark.materialContractFamily === 'string' && mark.materialContractFamily) {
    return {
      role: mark.role || null,
      family: mark.materialContractFamily,
      adapter: mark.generatedMass || mark.kind || null,
      targetRoles: collectTargetRoles(mark),
      phase: 'visible-skin',
      budget: collectBudget(mark),
      source: 'recipe-tag',
    };
  }

  // 2. blobPla — joinery (a-priori).
  if (mark.blobPlaAdapter === true) {
    return {
      role: mark.blobPlaRole || mark.role || null,
      family: A_PRIORI_FAMILIES.joinery,
      adapter: 'blobPla',
      targetRoles: [mark.sourceRole, mark.receiverRole].filter((r) => typeof r === 'string' && r),
      phase: 'construction-adapter',
      budget: null,
      source: 'a-priori',
      part: mark.blobPlaPart || null,
      supportBehavior: mark.supportBehavior || null,
    };
  }

  // 3. rBrush — joinery (a-priori).
  if (mark.rBrushMatter === true || mark.constructionKind === 'rBrush') {
    return {
      role: mark.rBrushRole || mark.role || null,
      family: A_PRIORI_FAMILIES.joinery,
      adapter: 'rBrush',
      targetRoles: [],
      phase: 'construction-adapter',
      budget: null,
      source: 'a-priori',
      mode: mark.rBrushMode || null,
      brushPhase: mark.rBrushPhase || null,
    };
  }

  // 4. fluidField — motion (a-priori).
  if (typeof mark.fluidFieldRole === 'string' && mark.fluidFieldRole) {
    return {
      role: mark.fluidFieldRole,
      family: A_PRIORI_FAMILIES.motion,
      adapter: 'fluidField',
      targetRoles: [],
      phase: 'construction-adapter',
      budget: collectBudget(mark),
      source: 'a-priori',
    };
  }

  // 5. stickerField stringSpawn variants — fiber / skin / surface.
  if (typeof mark.stringSpawnRole === 'string' && mark.stringSpawnRole) {
    const kind = mark.stringSpawnKind;
    let family;
    let adapter;
    let phase;
    if (kind === 'skin') {
      family = A_PRIORI_FAMILIES.skin;
      adapter = 'stickerField:cohere';
      phase = 'construction-adapter';
    } else if (kind === 'fabric-crease' || kind === 'fabric-pattern') {
      family = A_PRIORI_FAMILIES.surface;
      adapter = 'stickerField:fabric';
      phase = 'reconciliation';
    } else {
      family = A_PRIORI_FAMILIES.fiber;
      adapter = 'stickerField:stringSpawn';
      phase = 'construction-adapter';
    }
    return {
      role: mark.stringSpawnRole,
      family,
      adapter,
      targetRoles: [],
      phase,
      budget: null,
      source: 'a-priori',
      stringSpawnKind: kind || null,
    };
  }

  // 6. Standalone fabric physics / armor — surface (a-priori).
  if (mark.fabricPhysics === true || mark.fabricArmor === true) {
    return {
      role: mark.role || null,
      family: A_PRIORI_FAMILIES.surface,
      adapter: mark.fabricArmor === true ? 'fabric/armor' : 'fabric',
      targetRoles: [],
      phase: 'reconciliation',
      budget: null,
      source: 'a-priori',
    };
  }

  return null;
}

function collectTargetRoles(mark) {
  const roles = [];
  if (typeof mark.targetRole === 'string') roles.push(mark.targetRole);
  if (Array.isArray(mark.targetRoles)) {
    for (const r of mark.targetRoles) if (typeof r === 'string' && r) roles.push(r);
  }
  if (typeof mark.sourceRole === 'string' && mark.sourceRole) roles.push(mark.sourceRole);
  if (typeof mark.receiverRole === 'string' && mark.receiverRole) roles.push(mark.receiverRole);
  return [...new Set(roles)];
}

function collectBudget(mark) {
  const budget = {};
  if (Number.isFinite(Number(mark.count))) budget.count = Number(mark.count);
  if (mark.budgetMode) budget.mode = mark.budgetMode;
  if (Number.isFinite(Number(mark.density))) budget.density = Number(mark.density);
  if (Number.isFinite(Number(mark.maxMarks))) budget.maxMarks = Number(mark.maxMarks);
  return Object.keys(budget).length ? budget : null;
}
