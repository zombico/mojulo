/**
 * Pack dispatcher tools (tool-packs.plan.md P1-R — the stateless dispatcher).
 *
 * One registered tool per pack, always `listed: false` (packs mode lists the
 * packs via listTools() synthesis from the same packToolEntry, so the wire
 * shape has one source; flat mode stays byte-identical). Two behaviors:
 *
 *   pack_x({})                      → unveil: orientation body + member menu
 *   pack_x({ manual: name | [names] }) → those members' manuals
 *   pack_x({ tool, args })          → dispatch to the member, server-side
 *
 * The menu inlines a light member's manual and names a heavy one's size, so a
 * member's description + schema is read when the agent picks it, not with
 * every member it will never call. Unveil and manual are reads, not gates — no
 * session state; a model that already knows a member name may dispatch without
 * opening the pack first.
 *
 * Serialization: pack tools register `concurrent: true` (they hold no queue
 * slot) and every dispatch re-enters the writer chain with the MEMBER's own
 * flag via runToolSerialized — writers serialize exactly as if called
 * directly, long-polls bypass. See the helper's comment in server.js.
 */

import { registerTool, getRegisteredTool, runToolSerialized } from '@/lib/mcp/server';
import { isToolRefusal } from '@/lib/errors/tool-refusal';
import { instrumentedInvoke } from '@/lib/mcp/telemetry';
import { PACKS, SPINE, packToolEntry, dispatchTargets, homePackForTool, packInstallNotice, installNotice } from '@/lib/mcp/packs';
import { authNotice } from '@/lib/roles/enforce';
import { isRemovedBotTool, botToolMovedNotice } from '@/lib/mcp/bot-factory-moved';
import { formToolset } from '@/lib/mcp/tools/context';
import { hiddenInPluginProfile, pluginProfileToolNotice, toolFace } from '@/lib/mcp/plugin-profile';

// One line per member for the unveil's index: the FORM_TOOLSETS row cut at
// its first sentence. The full row is the flat-mode drawer's business
// (get_creative_toolset); here the authoritative text per tool is the member
// manual entry below, so the index only has to say which member is which.
const INDEX_LINE_MAX = 220;
function firstSentence(text) {
  const m = /(?<!\b(?:e\.g|i\.e|vs|etc|cf))\. (?=[A-Z`"'(])/.exec(text);
  let out = m ? text.slice(0, m.index + 1) : text;
  if (out.length > INDEX_LINE_MAX) {
    const cut = out.lastIndexOf(' ', INDEX_LINE_MAX);
    out = `${out.slice(0, cut > 80 ? cut : INDEX_LINE_MAX)}…`;
  }
  return out;
}

function memberIndex(body) {
  return body
    .split('\n')
    .map((line) => {
      const m = /^- `([a-z_]+)` — (.*)$/.exec(line);
      return m ? `- \`${m[1]}\` — ${firstSentence(m[2])}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

function packBody(pack) {
  if (pack.wing !== 'studio') return pack.body || '';
  // Studio bodies come from the FORM_TOOLSETS prose — one source with
  // get_creative_toolset. `forms` covers a pack serving several forms
  // (pack_motion carries motion + motion-comic). The unveil carries the form's
  // one-line `makes` plus a one-line member index; each member's full
  // description appears exactly once, in the manual.
  const forms = pack.forms || [pack.form];
  return forms
    .map((key) => {
      const form = formToolset(key);
      if (!form) return `(missing form body: ${key})`;
      return `**${form.title}** — ${form.makes}\n\n${memberIndex(form.body)}`;
    })
    .join('\n\n');
}

function memberManualEntry(name, { shared = false } = {}) {
  const tool = getRegisteredTool(name);
  if (!tool) return `### ${name}\n(unregistered)`;
  const home = shared ? homePackForTool(name) : null;
  const homeNote = home ? ` _(homed in ${home.id}; dispatchable here)_` : '';
  const face = toolFace(tool);
  const schema = JSON.stringify(face.inputSchema || { type: 'object', properties: {} });
  return `### ${name}${homeNote}\n${face.description || ''}\n\`inputSchema\`: ${schema}`;
}

// A member whose manual entry fits here is inlined in the menu (no second call
// for a small tool); a larger one is read on demand with `manual`. 800 B splits
// the members about 54 inline / 87 on demand.
export const INLINE_MANUAL_MAX = 800;

function sizeLabel(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// A heavy member's menu entry: what it is (unless the pack body's index already
// says, as studio packs do), and the size of the manual it will cost to read.
function heavyMenuEntry(pack, name, entry, { shared, indexed }) {
  const home = shared ? homePackForTool(name) : null;
  const homeNote = home ? ` _(homed in ${home.id}; dispatchable here)_` : '';
  const what = indexed ? '' : `\n${firstSentence(toolFace(getRegisteredTool(name)).description || '')}`;
  return `### ${name}${homeNote}${what}\nManual ${sizeLabel(entry.length)}: \`${pack.id}({ manual: '${name}' })\``;
}

function unveil(pack) {
  const memberSet = new Set(pack.members);
  const body = packBody(pack);
  // The Claude plugin profile's hidden members are not on the menu (no-op elsewhere).
  const menu = dispatchTargets(pack)
    .filter((name) => !hiddenInPluginProfile(name))
    .map((name) => {
      const shared = !memberSet.has(name);
      const entry = memberManualEntry(name, { shared });
      if (entry.length <= INLINE_MANUAL_MAX) return entry;
      return heavyMenuEntry(pack, name, entry, { shared, indexed: body.includes(`- \`${name}\` — `) });
    })
    .join('\n\n');
  return [
    `# ${pack.title} (${pack.id})`,
    body,
    `## Members — dispatch THROUGH this pack`,
    `Call \`${pack.id}({ tool: '<name>', args: { … } })\`. A small member's manual is inline below; read a larger one first with \`${pack.id}({ manual: '<name>' })\` (a list reads several). Spine tools (${SPINE.join(', ')}) are called directly, not through a pack.`,
    menu,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// Why `name` cannot be dispatched (or read) through this pack, or null when it
// can. One answer for dispatch and manual, so the two can't drift.
function routingProblem(pack, name, { reading = false } = {}) {
  // The Claude plugin profile: a member that build leaves out refuses, through any pack.
  const profileNotice = pluginProfileToolNotice(name);
  if (profileNotice) return profileNotice;
  const targets = new Set(dispatchTargets(pack));
  // A chatbot-factory member from the 2.x line, dispatched through any pack: say where it went.
  if (!targets.has(name) && isRemovedBotTool(name)) return botToolMovedNotice(name);
  if (targets.has(name)) return null;
  const home = homePackForTool(name);
  if (home && home.id !== pack.id) {
    return reading
      ? `'${name}' is not in ${pack.id} — it is homed in ${home.id}. Read it there: ${home.id}({ manual: '${name}' }).`
      : `'${name}' is not in ${pack.id} — it is homed in ${home.id}. Dispatch it there: ${home.id}({ tool: '${name}', args: { … } }).`;
  }
  if (SPINE.includes(name)) {
    return reading
      ? `'${name}' is a spine tool — call it directly; its schema is in tools/list.`
      : `'${name}' is a spine tool — call it directly, not through a pack.`;
  }
  return `'${name}' is not a member of ${pack.id}. Call ${pack.id}({}) for its menu, or semantic_search to locate the tool's home.`;
}

function manualFor(pack, manual) {
  const names = (Array.isArray(manual) ? manual : [manual]).filter((n) => typeof n === 'string' && n.length > 0);
  if (names.length === 0) throw new Error(`manual takes a member name or a list of them. Call ${pack.id}({}) for its menu.`);
  const memberSet = new Set(pack.members);
  const parts = [];
  let read = 0;
  for (const name of [...new Set(names)]) {
    const problem = routingProblem(pack, name, { reading: true });
    if (problem) {
      parts.push(`### ${name}\n${problem}`);
      continue;
    }
    parts.push(memberManualEntry(name, { shared: !memberSet.has(name) }));
    read += 1;
  }
  // Nothing readable: an error, as dispatch answers the same names.
  if (read === 0) throw new Error(parts.join('\n\n'));
  return [`Call \`${pack.id}({ tool: '<name>', args: { … } })\`.`, ...parts].join('\n\n');
}

// A member's own failure through a pack ends with where its manual is. A
// structured refusal renders itself (a JSON body) and a timeout is not an input
// problem, so both pass untouched.
function withManualPointer(err, pack, name) {
  if (!(err instanceof Error) || isToolRefusal(err)) return err;
  if (/ exceeded its \d+ms budget/.test(err.message)) return err;
  err.message = `${err.message}\nManual: ${pack.id}({ manual: '${name}' })`;
  return err;
}

async function dispatch(pack, input, context) {
  // Install gate (install-capabilities.plan.md — the iron wall): never RUN a
  // tool from an uninstalled pack, even when dispatched by name. Knowing the
  // pack exists is fine; executing its jobs here is not. Wing-level + terminal
  // so the model stops retrying instead of spinning.
  const packNotice = packInstallNotice(pack);
  if (packNotice) throw new Error(packNotice);
  const name = input.tool;
  const problem = routingProblem(pack, name);
  if (problem) throw new Error(problem);
  const member = getRegisteredTool(name);
  if (!member) throw new Error(`'${name}' is named in ${pack.id} but not registered — registry bug.`);
  // Belt-and-suspenders: a shared member homed in an uninstalled pack must not run
  // even when dispatched through an installed pack that merely lists it.
  const memberNotice = installNotice(name);
  if (memberNotice) throw new Error(memberNotice);
  // Authorization gate (roles-pack.plan.md Phase 2) — the third chokepoint.
  // Checked per MEMBER (its home pack, the deny-list, the key's flags), so a
  // shared member homed in an ungranted bay cannot run through a granted one.
  const authDenial = authNotice(name, context);
  if (authDenial) throw new Error(authDenial);
  try {
    return await runToolSerialized(member, () =>
      instrumentedInvoke(member, input.args || {}, context, {
        via: `pack:${pack.id}`,
        name,
      })
    );
  } catch (err) {
    throw withManualPointer(err, pack, name);
  }
}

export function registerPackTools() {
  for (const pack of PACKS) {
    registerTool({
      ...packToolEntry(pack),
      // Never listed from the registry: flat mode must stay byte-identical,
      // and packs mode lists packs via listTools() synthesis.
      listed: false,
      // No queue slot — member-level serialization happens in dispatch().
      concurrent: true,
      // The member's own call is timed inside dispatch(), so the pack's budget only has to outlast
      // it: the largest member budget (a render tool's), read at call time since members may
      // register after the packs. Undefined means the default.
      get timeoutMs() {
        const budgets = dispatchTargets(pack).map((name) => getRegisteredTool(name)?.timeoutMs || 0);
        return Math.max(0, ...budgets) || undefined;
      },
      handler: (input, context) => {
        // `manual` is a read and wins over `tool`: the agent asked to look first.
        if (input && input.manual !== undefined) return manualFor(pack, input.manual);
        if (!input || typeof input.tool !== 'string' || input.tool.length === 0) {
          return unveil(pack);
        }
        return dispatch(pack, input, context);
      },
    });
  }
}
