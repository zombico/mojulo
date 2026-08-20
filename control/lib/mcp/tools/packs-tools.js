/**
 * Pack dispatcher tools (tool-packs.plan.md P1-R — the stateless dispatcher).
 *
 * One registered tool per pack, always `listed: false` (packs mode lists the
 * packs via listTools() synthesis from the same packToolEntry, so the wire
 * shape has one source; flat mode stays byte-identical). Two behaviors:
 *
 *   pack_x({})                      → unveil: orientation body + member manual
 *   pack_x({ tool, args })          → dispatch to the member, server-side
 *
 * Unveil is a read, not a gate — no session state; a model that already knows
 * a member name may dispatch without opening the pack first.
 *
 * Serialization: pack tools register `concurrent: true` (they hold no queue
 * slot) and every dispatch re-enters the writer chain with the MEMBER's own
 * flag via runToolSerialized — writers serialize exactly as if called
 * directly, long-polls bypass. See the helper's comment in server.js.
 */

import { registerTool, getRegisteredTool, runToolSerialized } from '@/lib/mcp/server';
import { instrumentedInvoke } from '@/lib/mcp/telemetry';
import { PACKS, SPINE, packToolEntry, dispatchTargets, homePackForTool } from '@/lib/mcp/packs';
import { FORM_TOOLSETS } from '@/lib/mcp/tools/context';

function packBody(pack) {
  if (pack.wing !== 'studio') return pack.body || '';
  // Studio bodies come from the FORM_TOOLSETS prose — one source with
  // get_creative_toolset. `forms` covers a pack serving several forms
  // (pack_motion carries motion + motion-comic).
  const forms = pack.forms || [pack.form];
  return forms
    .map((key) => {
      const form = FORM_TOOLSETS[key];
      if (!form) return `(missing form body: ${key})`;
      return forms.length > 1 ? `**${form.title}** — ${form.makes}\n\n${form.body}` : form.body;
    })
    .join('\n\n');
}

function memberManualEntry(name, { shared = false } = {}) {
  const tool = getRegisteredTool(name);
  if (!tool) return `### ${name}\n(unregistered)`;
  const home = shared ? homePackForTool(name) : null;
  const homeNote = home ? ` _(homed in ${home.id}; dispatchable here)_` : '';
  const schema = JSON.stringify(tool.inputSchema || { type: 'object', properties: {} });
  return `### ${name}${homeNote}\n${tool.description || ''}\n\`inputSchema\`: ${schema}`;
}

function unveil(pack) {
  const memberSet = new Set(pack.members);
  const manual = dispatchTargets(pack)
    .map((name) => memberManualEntry(name, { shared: !memberSet.has(name) }))
    .join('\n\n');
  return [
    `# ${pack.title} (${pack.id})`,
    packBody(pack),
    `## Member manual — dispatch THROUGH this pack`,
    `Call \`${pack.id}({ tool: '<name>', args: { … } })\`. Spine tools (${SPINE.join(', ')}) are called directly, not through a pack.`,
    manual,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function dispatch(pack, input, context) {
  const name = input.tool;
  const targets = new Set(dispatchTargets(pack));
  if (!targets.has(name)) {
    const home = homePackForTool(name);
    if (home && home.id !== pack.id) {
      throw new Error(
        `'${name}' is not in ${pack.id} — it is homed in ${home.id}. Dispatch it there: ${home.id}({ tool: '${name}', args: { … } }).`
      );
    }
    if (SPINE.includes(name)) {
      throw new Error(`'${name}' is a spine tool — call it directly, not through a pack.`);
    }
    throw new Error(
      `'${name}' is not a member of ${pack.id}. Call ${pack.id}({}) for the member manual, or semantic_search to locate the tool's home.`
    );
  }
  const member = getRegisteredTool(name);
  if (!member) throw new Error(`'${name}' is named in ${pack.id} but not registered — registry bug.`);
  return runToolSerialized(member, () =>
    instrumentedInvoke(member, input.args || {}, context, {
      via: `pack:${pack.id}`,
      name,
    })
  );
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
      handler: (input, context) => {
        if (!input || typeof input.tool !== 'string' || input.tool.length === 0) {
          return unveil(pack);
        }
        return dispatch(pack, input, context);
      },
    });
  }
}
