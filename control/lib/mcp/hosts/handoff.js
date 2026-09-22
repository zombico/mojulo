/**
 * The handoff note — what an export result says the NEXT MOVE is on THIS host.
 *
 * When mojulo runs inside the agent's own box (Claude Code on the web, a Codex
 * cloud task, Grok chat's sandbox) everything it writes lands on a disk the
 * operator never sees, and the dashboard's loopback URL is unreachable. On
 * every surface the HOST model publishes and the server never does: no MCP
 * content block creates an artifact, a file card or a PR. So the best a tool
 * result can do is name the file and say the door — and say it in this host's
 * words, not "open the URL".
 *
 * The door table is data on the host profile (`handoff` in
 * [registry.js](./registry.js), one row for the operator's machine and one for
 * the host's box). This module turns a row into a sentence. Pure: same input,
 * same note. The host id comes from the session's remembered clientInfo, or
 * from `MOJULO_HOST` for the CLI (`mcp-stdio.mjs call` never sees an
 * `initialize`). The SURFACE (local vs box) is the one thing clientInfo cannot
 * tell — Claude Code local, Claude Code on the web and Claude Desktop all say
 * "claude" — so it is `MOJULO_SURFACE=box|local` when the agent knows, and the
 * note states both rows, local first, when it does not. No sniffing of a host's
 * own environment markers: unverifiable, and a wrong guess misroutes.
 */

import { resolveAdapterId } from '@/lib/mcp/adapters/loader';
import { getClientInfo } from '@/lib/mcp/client-bindings';
import { hostProfileForAdapter, getHostProfile, hostHandoff } from './registry.js';

export const SURFACES = new Set(['local', 'box']);

/** Which host profile this call is talking to: explicit `host` on the context
 * or `MOJULO_HOST`, else the session's clientInfo → adapter → profile, else
 * null (the generic sentence). */
export function resolveHandoffHost(context = {}, env = process.env) {
  const explicit = context.host || env.MOJULO_HOST;
  if (explicit && getHostProfile(explicit)) return explicit;
  const info = context.mcpSessionId ? getClientInfo(context.mcpSessionId) : null;
  if (info?.name) {
    const adapterId = resolveAdapterId({ clientName: info.name });
    return hostProfileForAdapter(adapterId)?.id || null;
  }
  return null;
}

export function resolveHandoffSurface(context = {}, env = process.env) {
  const s = context.surface || env.MOJULO_SURFACE;
  return SURFACES.has(s) ? s : null;
}

const MiB = 1024 * 1024;
const fmtBytes = (n) => (n >= MiB ? `${(n / MiB).toFixed(1)} MiB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const extOf = (name) => { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : null; };

/** { fits, budget, over_by } for a byte count against a door's ceiling; null budget ⇒ fits. */
export function fitsBudget(bytes, budget) {
  if (!Number.isFinite(budget) || budget <= 0) return { fits: true, budget: null, over_by: 0 };
  const over = Math.max(0, (bytes || 0) - budget);
  return { fits: over === 0, budget, over_by: over };
}

// ── door → sentence ────────────────────────────────────────────────────────
// `a` is the artifact: { kind: 'page' | 'file' | 'folder', name, path, dir, bytes, download_url,
// courier? } — `courier` names a page that embeds the file and offers it (the bundle writes one).

function pageSentence(door, row, a, caveats) {
  const size = a.bytes != null ? ` (${fmtBytes(a.bytes)})` : '';
  switch (door) {
    case 'dashboard':
      return `open ${a.download_url || a.path} in the dashboard, or ${a.name} straight from file:// — no server, no network`;
    case 'artifact': {
      const cap = row.pageMaxBytes ? `, ≤ ${fmtBytes(row.pageMaxBytes)}` : '';
      const fit = fitsBudget(a.bytes, row.pageMaxBytes);
      if (!fit.fits) caveats.push(`${a.name} is ${fmtBytes(a.bytes)}, over this host's page limit by ${fmtBytes(fit.over_by)}: export with \`cdn: true\` (three.js off the page, ~1 MB) or lighten the recipe`);
      return `publish ${a.name}${size} with your Artifact tool (one self-contained HTML page${cap}); the operator opens it on claude.ai`;
    }
    case 'mcp-app':
      return `the host renders ${a.name}${size} inline as an MCP App; the file at ${a.path} is the fallback`;
    case 'hosted-publish':
      return `paste ${a.name}${size} into a hosted app to publish it; the file is at ${a.path}`;
    case 'local-preview':
      return `open ${a.path}${size} in the host's preview, or from file:// — no server, no network`;
    case 'file-card':
      return `hand ${a.name}${size} back as a file card; the operator opens it from file:// — no server, no network`;
    case 'none':
    default:
      return `this host shows no page; the file is at ${a.path}${size} and opens from file://`;
  }
}

function fileSentence(door, row, a, caveats) {
  const size = a.bytes != null ? ` (${fmtBytes(a.bytes)})` : '';
  const ext = extOf(a.name);
  switch (door) {
    case 'local':
      return `the ${a.kind === 'folder' ? 'folder' : 'file'} is at ${a.path}${size}; the operator opens it from disk`;
    case 'artifact-download': {
      const allowed = Array.isArray(row.downloadExtensions) ? row.downloadExtensions : null;
      if (allowed && ext && !allowed.includes(ext)) {
        caveats.push(`.${ext} is not on this host's download allowlist (${allowed.join(', ')}) and cannot ride as a supporting file either; \`export_model({ format: 'bundle' })\` zips it and writes a courier page that can offer it`);
      }
      const fit = fitsBudget(a.bytes, row.fileMaxBytes);
      if (!fit.fits) caveats.push(`${a.name} is over this host's file limit by ${fmtBytes(fit.over_by)}`);
      if (a.courier) {
        return `publish ${a.courier} with your Artifact tool declaring capabilities { downloads: true }; its Save button hands ${a.name}${size} to the operator through the viewer's download prompt — or push the outcome folder ${a.dir || a.path} to the branch`;
      }
      return `a page you publish can offer ${a.name}${size} through its downloads capability (the file must be embedded in the page: supporting files carry no archives or models), or push the outcome folder ${a.dir || a.path} to the branch`;
    }
    case 'git':
      return `commit ${a.dir || a.path}${size} to the branch; the PR is the handoff`;
    case 'file-card': {
      const fit = fitsBudget(a.bytes, row.fileMaxBytes);
      if (!fit.fits) caveats.push(`${a.name} is over this host's file-card limit by ${fmtBytes(fit.over_by)}`);
      const cap = row.fileMaxBytes ? `, ≤ ${fmtBytes(row.fileMaxBytes)}` : '';
      return `hand ${a.name}${size} back as a file card${cap}; the operator saves it`;
    }
    case 'none':
    default:
      return `this host has no file door; the file is at ${a.path}${size}`;
  }
}

function rowNote(row, a) {
  const caveats = [];
  const door = a.kind === 'page' ? row.page : row.file;
  const next = a.kind === 'page' ? pageSentence(door, row, a, caveats) : fileSentence(door, row, a, caveats);
  if (row.ephemeral) caveats.push('this box is reclaimed when the session ends — hand over recipe.json too; any host running mojulo re-mints it');
  return { door, next, caveats };
}

const GENERIC_NEXT = (a) => a.kind === 'page'
  ? `the page is at ${a.path}; it opens straight from file:// — no server, no network`
  : `the file is at ${a.path}`;

/**
 * The note. Returns { host, surface, door, next, caveats, fits? } and never
 * throws on an unknown host — the generic sentence is the fallback the tree
 * already had. `host` and `surface` are the RESOLVED values (null when
 * unknown), `artifact` is { kind, name, path, dir?, bytes?, download_url? }.
 */
export function handoffFor({ host = null, surface = null, artifact }) {
  const a = { ...artifact, name: artifact.name || (artifact.path ? artifact.path.split(/[\\/]/).pop() : 'the file') };
  const table = hostHandoff(host);
  const loopback = a.download_url
    ? `${a.download_url} is reachable only from the machine mojulo runs on`
    : null;
  if (!table) {
    return { host: host || null, surface: null, door: null, next: GENERIC_NEXT(a), caveats: loopback ? [loopback] : [] };
  }
  const rows = [];
  if (table.local && surface !== 'box') rows.push({ surface: 'local', row: table.local });
  if (table.box && surface !== 'local') rows.push({ surface: 'box', row: table.box });
  if (!rows.length) {
    // asked for a surface the profile has no row for — say so, fall back to the other
    const only = table.local ? { surface: 'local', row: table.local } : { surface: 'box', row: table.box };
    const r = rowNote(only.row, a);
    return { host, surface: only.surface, door: r.door, next: r.next, caveats: [`this host has no '${surface}' row; the ${only.surface} door is the one recorded`, ...r.caveats], verified: table.verified };
  }
  if (rows.length === 1) {
    const r = rowNote(rows[0].row, a);
    if (rows[0].surface === 'local' && loopback && rows[0].row.page !== 'dashboard') r.caveats.unshift(loopback);
    return { host, surface: rows[0].surface, door: r.door, next: r.next, caveats: r.caveats, verified: table.verified };
  }
  // surface unknown and the host has both rows: state both, local first; the agent knows
  // which machine it is on.
  const local = rowNote(rows[0].row, a);
  const box = rowNote(rows[1].row, a);
  return {
    host,
    surface: null,
    door: { local: local.door, box: box.door },
    next: `On the operator's machine: ${local.next}. Inside ${table.box.name}: ${box.next}.`,
    caveats: [...local.caveats.map((c) => `local: ${c}`), ...box.caveats.map((c) => `${table.box.name}: ${c}`)],
    verified: table.verified,
  };
}

/** `fits` for a tool result: the artifact's bytes against the resolved host's
 * box limit for its kind (page → pageMaxBytes, anything else → fileMaxBytes).
 * The box is where limits bite; `surface: 'local'` reads as no limit. */
export function fitsForContext(context, artifact, env = process.env) {
  const host = resolveHandoffHost(context, env);
  const surface = resolveHandoffSurface(context, env);
  const box = surface === 'local' ? null : hostHandoff(host)?.box || null;
  const key = artifact.kind === 'page' ? 'pageMaxBytes' : 'fileMaxBytes';
  const fit = fitsBudget(artifact.bytes, box ? box[key] : null);
  return { ...fit, ...(box && fit.budget ? { against: `${box.name} ${artifact.kind === 'page' ? 'page' : 'file'} limit` } : {}) };
}

/** One-call form for a tool result: resolves host + surface from the call
 * context and env, then notes. */
export function handoffForContext(context, artifact, env = process.env) {
  return handoffFor({ host: resolveHandoffHost(context, env), surface: resolveHandoffSurface(context, env), artifact });
}
