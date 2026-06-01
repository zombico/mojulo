/**
 * Deterministic sketch-manifest derivation — the "posterity" auto-mint seam.
 *
 * Pure functions: a plan or research book in, a sketch manifest out (the same
 * shape validateSketchManifest accepts and /sketches/<ref> renders). No DB, no
 * LLM — the layout is computed from structure alone, so a plan's compiled
 * manifest and a research book's items always produce the same diagram.
 *
 * Coupling stays one-way: plan-mode / research-mode import this + the sketch
 * persister; sketches never import plan or research. Mirrors the research→plan
 * asymmetry already in the codebase.
 */

function truncate(str, max) {
  if (typeof str !== 'string') return undefined;
  const s = str.trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function firstLine(str) {
  if (typeof str !== 'string') return undefined;
  const line = str.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
  return line;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Plan → left→right pipeline. The goal is an `input` station; each compiled
 * manifest call is an `mcp_tool` station, chained in order. Drawn from the
 * manifest, so it always reflects the spike that compiled.
 */
export function planToSketchManifest(plan) {
  const calls = Array.isArray(plan?.manifest) ? plan.manifest : [];
  const W = 210;
  const H = 96;
  const GAP = 64;
  const PADX = 40;
  const TOP = 48;

  const stations = [
    {
      id: 'goal',
      kind: 'input',
      label: 'Goal',
      ...(truncate(firstLine(plan?.goalMd) || plan?.title, 64)
        ? { sublabel: truncate(firstLine(plan?.goalMd) || plan?.title, 64) }
        : {}),
      x: PADX,
      y: TOP,
      w: W,
      h: H,
    },
  ];
  const edges = [];
  let prev = 'goal';
  calls.forEach((call, i) => {
    const id = `s${i}`;
    const note = truncate(call?.note, 64);
    stations.push({
      id,
      kind: 'mcp_tool',
      label: truncate(call?.tool, 40) || `step ${i + 1}`,
      ...(note ? { sublabel: note } : {}),
      x: PADX + (i + 1) * (W + GAP),
      y: TOP,
      w: W,
      h: H,
    });
    edges.push({ from: prev, to: id });
    prev = id;
  });

  const count = stations.length;
  const width = PADX * 2 + count * W + (count - 1) * GAP;
  const height = TOP * 2 + H;
  return {
    title: `Plan: ${plan?.title || plan?.planRef || 'untitled'}`,
    viewBox: { width, height },
    stations,
    edges,
  };
}

function itemStationKind(kind) {
  if (kind === 'screencap') return 'filesystem';
  if (kind === 'summary' || kind === 'note') return 'db_row';
  if (kind === 'sketch') return 'mcp_tool';
  return 'input';
}

const ITEM_CAP = 24;

/**
 * Research book → hub-spoke. The synthesized thesis is a central `db_row`
 * station; each bound item is a spoke on the left that feeds into it. Drawn at
 * synthesis time so each append-only abstract snapshot gets its own diagram.
 *
 * @param {object} book   - { session, items } (abstracts not needed here)
 * @param {string} thesis - the abstract text being synthesized (the hub label)
 */
export function researchToSketchManifest(book, thesis) {
  const session = book?.session || {};
  const allItems = Array.isArray(book?.items) ? book.items : [];
  const items = allItems.slice(-ITEM_CAP); // most recent if the book is large
  const more = allItems.length - items.length;

  const IW = 230;
  const IH = 64;
  const IGAP = 20;
  const PADX = 40;
  const TOP = 40;
  const GUTTER = 170;
  const HUBW = 240;
  const HUBH = 120;

  const stations = [];
  const edges = [];
  items.forEach((it, i) => {
    const id = `i${i}`;
    const body = truncate(firstLine(it?.body), 60);
    stations.push({
      id,
      kind: itemStationKind(it?.kind),
      label: truncate(it?.title, 40) || capitalize(it?.kind || 'item'),
      ...(body ? { sublabel: body } : {}),
      x: PADX,
      y: TOP + i * (IH + IGAP),
      w: IW,
      h: IH,
    });
    edges.push({ from: id, to: 'thesis' });
  });

  const colHeight = items.length ? items.length * (IH + IGAP) - IGAP : IH;
  const hubX = PADX + IW + GUTTER;
  const hubY = TOP + Math.max(0, (colHeight - HUBH) / 2);
  stations.push({
    id: 'thesis',
    kind: 'db_row',
    label: 'Thesis',
    ...(truncate(firstLine(thesis), 64) ? { sublabel: truncate(firstLine(thesis), 64) } : {}),
    ...(more > 0 ? { items: [`+${more} earlier item${more === 1 ? '' : 's'}`] } : {}),
    x: hubX,
    y: hubY,
    w: HUBW,
    h: HUBH,
  });

  const width = hubX + HUBW + PADX;
  const height = TOP * 2 + Math.max(colHeight, HUBH);
  return {
    title: `Research: ${session.title || session.researchRef || 'untitled'}`,
    viewBox: { width, height },
    stations,
    edges,
  };
}

// Test seam.
export const _internals = { truncate, firstLine, itemStationKind, ITEM_CAP };
