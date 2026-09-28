/**
 * The chatbot factory left mojulo in 3.0.0: the one notice every surface gives about it.
 *
 * The bot builder, wizard, deployers, fleet tools and the bot runtime are moving to their own
 * project. Until that ships they stay on the 2.x line. Everything that used to reach them answers
 * with BOT_FACTORY_MOVED, from this module, so the wording changes in one place:
 *
 *   - `mojulo install chatbot` (and its old alias `ops`) installs nothing and prints it;
 *   - a tools/call, pack dispatch, plan step or CLI call naming a REMOVED_BOT_TOOLS entry gets an
 *     in-band isError result carrying it, instead of a bare unknown-tool error;
 *   - meta_context_commit with type `artifact_materialization` (the bot-bound seal) returns it.
 *
 * The removed names never list: not in tools/list, get_tool_index, the routing cards or the packs.
 * This list is only here so a host that remembers one from 2.x is told where it went.
 *
 * Pure data with no imports: scripts/mcp-install.mjs loads it by relative path before the
 * `@/` loader or the tool registry exist.
 */

export const BOT_FACTORY_MOVED =
  'The chatbot factory (bot builder, wizard, deployers, fleet tools) is no longer part of mojulo as of 3.0.0. '
  + 'It is moving to its own project. Until that ships, it stays available on the 2.x line: npx -y mojulo@2. '
  + 'Bots you already deployed keep running; they are separate containers.';

// Every public tool name the chatbot factory registered on the 2.x line, and its three pack
// dispatchers. Only these answer with the notice; any other unknown name stays an unknown tool.
export const REMOVED_BOT_TOOLS = Object.freeze([
  // pack_bot_build
  'start_new_bot',
  'get_builder_session',
  'save_modular_bot',
  'compose_identity',
  'infer_intent',
  'recommend_protocols',
  'custom_protocol',
  'generate_form_schema',
  'generate_triage_config',
  'generate_appointment_config',
  'generate_optical_read_config',
  'process_documents',
  'upload_document_from_url',
  'poll_job',
  // pack_bot_operate
  'list_deployments',
  'get_deployment',
  'query_conversations',
  'get_conversation',
  'query_submissions',
  'export_conversations',
  'generate_bot_summary',
  'verify_chain',
  'inspect_bot_env',
  'set_suggested_prompts',
  // pack_fleet
  'fleet_query_conversations',
  'fleet_analytics_summary',
  'verify_fleet_chains',
  // the web chat builder's mid-turn narration and decisions (chat_turn only)
  'emit_chat_signal',
  'request_chat_decision',
  // the three pack dispatchers
  'pack_bot_build',
  'pack_bot_operate',
  'pack_fleet',
]);

const REMOVED = new Set(REMOVED_BOT_TOOLS);

/** True when `name` is a tool or pack the chatbot factory took with it. */
export function isRemovedBotTool(name) {
  return typeof name === 'string' && REMOVED.has(name);
}

/** The notice for one removed name: which tool was asked for, then BOT_FACTORY_MOVED. */
export function botToolMovedNotice(name) {
  return `'${name}' was part of the chatbot factory. ${BOT_FACTORY_MOVED}`;
}

/** The in-band tools/call result for a removed name (MCP spec: a tool failure is a result). */
export function botToolMovedResult(name) {
  return { content: [{ type: 'text', text: botToolMovedNotice(name) }], isError: true };
}
