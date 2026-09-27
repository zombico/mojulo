// The `store` world kind: one walkable shop from a concept card, graded and stamped.
//
// Manifest: { kind: 'store', title, card: '<seeded id>' | { …inline card }, width?, depth?, seed?,
//   degrade?, cast? }. `cast: false` leaves the card's mannequins out. The assessment rides the
// scene as `store.assessment` (the evaluateBuilding shape, register 'retail') beside the degrade
// stamps: advisory, never a refusal.

import { buildStandaloneStore, validateConceptCard } from './store-concept.js';
import { assessStoreConcept } from './store-assess.js';
import { resolveCard, SEEDED_CARDS } from './store-cards.js';

export const STORE_WORLD_DEFAULTS = { width: 24, depth: 40, seed: 1 };

/** Named manifest errors ([] = valid): an unknown seeded id, or the card validator's codes. */
export function validateStoreManifest(m = {}) {
  if (m.card == null) return [`store: card is required — a seeded id (${Object.keys(SEEDED_CARDS).join(', ')}) or an inline card`];
  const card = resolveCard(m.card);
  if (!card) return [`store: unknown card '${m.card}' (seeded: ${Object.keys(SEEDED_CARDS).join(', ')})`];
  const errs = validateConceptCard(card).map((e) => `store.card: ${e.code} — ${e.detail}`);
  for (const k of ['width', 'depth']) if (m[k] != null && !(Number.isFinite(m[k]) && m[k] >= 12 && m[k] <= 200)) errs.push(`store.${k}: a number of feet in [12, 200]`);
  return errs;
}

function storeCameras(s) {
  const { footprint: fp, entry, height: H } = s;
  const W = fp.x1 - fp.x0, D = fp.y1 - fp.y0, cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const [ex] = entry.world;
  return [
    { name: 'cutaway', worldFraming: { cameraPosition: [cx - 0.55 * W, fp.y0 - 0.55 * D, H + 1.25 * Math.max(W, D)], lookAt: [cx, cy, 0], horizontalFov: 55 } },
    { name: 'street', worldFraming: { cameraPosition: [ex - 3, fp.y0 - 16, 5.4], lookAt: [cx, cy * 0.8, 4.2], horizontalFov: 70 } },
    { name: 'door', worldFraming: { cameraPosition: [ex, fp.y0 + 2.5, 5.4], lookAt: [cx, fp.y1, 4.0], horizontalFov: 80 } },
  ];
}

export function assembleStoreWorldScene(m = {}, opts = {}) {
  const errs = validateStoreManifest(m);
  if (errs.length) throw new Error(errs.join('; '));
  const card = resolveCard(m.card);
  const cardUsed = m.cast === false ? { ...card, cast: [] } : card;
  const o = { ...STORE_WORLD_DEFAULTS, ...m };
  const s = buildStandaloneStore(cardUsed, { width: o.width, depth: o.depth, seed: o.seed, degrade: m.degrade ?? true });
  const assessment = assessStoreConcept(cardUsed, s);
  const viewBox = opts.viewBox || { width: 1120, height: 840 };
  const cameras = (opts.cameras || storeCameras(s)).map((c) => ({ ...c, worldFraming: { pictureCenter: [viewBox.width / 2, viewBox.height / 2], ...c.worldFraming } }));
  return {
    faces: s.faces, cameras, viewBox,
    title: opts.title || m.title || card.label || 'mojulo store',
    bg: opts.bg || '#11141a', inline: opts.inline ?? false, light: opts.light,
    walk: opts.walk === false ? false : { eye: 5.4, spawn: [s.entry.world[0], 3] },
    metersPerUnit: s.structure.metersPerUnit,
    store: {
      card: card.id,
      assessment: { ok: assessment.ok, findings: assessment.findings.map(({ id, register, severity, detail }) => ({ id, register, severity, detail })) },
      shedCells: s.sub.shed,
      fitted: s.fitOut.report.fitted,
      degraded: s.fitOut.report.degraded,
    },
  };
}
