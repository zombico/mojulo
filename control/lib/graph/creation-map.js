/**
 * Creation map manifest — declarative shape of the app-creation paradigm.
 *
 * Each station is either an *input* the operator/agent provides, an *MCP
 * tool* that runs, or an *output* (filesystem write or DB row). Edges
 * connect tools to the inputs they consume and the outputs they produce.
 *
 * The manifest is hand-curated; what it asserts about the world (tool
 * names, DB enum membership) is validated at render time against the
 * live MCP registry and the live schema constants. See validate.js for
 * the failure modes and lite-template/integration/APP_CREATION_MAP_PLAN.md
 * for the bigger picture.
 *
 * When the paradigm shifts (new station, renamed tool, new node kind):
 *   1. Update the manifest below.
 *   2. If a new tool/kind is referenced, add it to `validates` so the
 *      validator confirms it resolves.
 *   3. If positions overlap, retune x/y/w/h. No layout engine.
 */

export const CREATION_MAP = {
  title: 'App Creation',
  // Vertical orientation: two lanes (install_scaffold pipeline on the left,
  // meta_context_commit pipeline on the right). Naturally expandable by
  // extending a lane downward — new stations slot in without reflowing
  // anything else.
  viewBox: { width: 960, height: 700 },

  // Stations carry both registers. `label` / `sublabel` / `items` are the
  // technical view (codebase names, exact payload shapes). `friendly` is the
  // operator-facing register tuned in 0.7.0 — what the piece *does* rather
  // than what it's *called*. Both must convey the same information; friendly
  // is a translation, not a simplification. The page toggles between them.
  stations: [
    {
      id: 'operator_inputs',
      kind: 'input',
      label: 'Operator / agent inputs',
      items: ['adapter_id', 'app.name', 'locator', 'host'],
      friendly: {
        label: 'What you (or your agent) decides',
        items: [
          'Which generator to use',
          'A name for the app',
          'Where it lives on disk',
          'Where it runs',
        ],
      },
      x: 24,
      y: 24,
      w: 400,
      h: 130,
    },
    {
      id: 'bindings',
      kind: 'input',
      label: 'Bindings',
      items: [
        'runner: { implementation }',
        'durability: { kind, git_url? }',
        'inference: { mode, provider? }',
        'mcp_self: { server_kind, entrypoint }',
      ],
      friendly: {
        label: 'How the app is wired up',
        items: [
          'How to run it',
          'Where it keeps state',
          'How it thinks (which model)',
          "Its own MCP entry point",
        ],
      },
      x: 456,
      y: 24,
      w: 400,
      h: 130,
    },
    {
      id: 'install_scaffold',
      kind: 'mcp_tool',
      tool: 'install_scaffold',
      label: 'install_scaffold',
      sublabel: 'MCP tool',
      friendly: {
        label: 'Lay down the starter files',
        sublabel: 'A tool the agent calls',
      },
      x: 74,
      y: 204,
      w: 300,
      h: 70,
    },
    {
      id: 'commit',
      kind: 'mcp_tool',
      tool: 'meta_context_commit',
      label: 'meta_context_commit',
      sublabel: 'type = app_materialization',
      friendly: {
        label: "Record the app in mojulo's memory",
        sublabel: 'Marks it as officially made',
      },
      x: 506,
      y: 204,
      w: 300,
      h: 80,
    },
    {
      id: 'scaffold_files',
      kind: 'filesystem',
      label: 'Filesystem',
      items: ['<artifact>/app-mcp/server.js', '<artifact>/.env'],
      friendly: {
        label: 'Files on disk',
        items: [
          "The app's MCP sidecar",
          'Its env file (secrets, settings)',
        ],
      },
      x: 24,
      y: 334,
      w: 400,
      h: 80,
    },
    {
      id: 'artifact_node',
      kind: 'db_row',
      table: 'meta_nodes',
      nodeKind: 'artifact',
      label: 'meta_nodes',
      items: ["kind = 'artifact'", 'payload: adapter_id, locator, host, app{name, bindings}'],
      friendly: {
        label: "App entry in mojulo's memory",
        items: [
          'The durable record of this app',
          'Holds the name, location, and wiring',
        ],
      },
      x: 456,
      y: 334,
      w: 400,
      h: 80,
    },
    {
      id: 'materialized_by_edge',
      kind: 'db_row',
      table: 'meta_edges',
      edgeKind: 'materialized_by',
      label: 'meta_edges',
      items: ["kind = 'materialized_by'", 'artifact → adapter'],
      friendly: {
        label: 'Link back to the maker',
        items: [
          'Connects the app to the generator that made it',
        ],
      },
      x: 456,
      y: 474,
      w: 400,
      h: 70,
    },
    {
      id: 'app_materialization_principle',
      kind: 'db_row',
      table: 'meta_principles',
      sourceEvent: 'app_materialization',
      label: 'meta_principles',
      items: ["source_event = 'app_materialization'", 'auto-summary, scoped to the artifact node'],
      friendly: {
        label: 'A note about why it was made',
        items: [
          'A short summary attached to the app',
          'For future audits and search',
        ],
      },
      x: 456,
      y: 604,
      w: 400,
      h: 80,
    },
  ],

  edges: [
    { from: 'operator_inputs', to: 'install_scaffold', label: 'targetDir, app_name', friendly: { label: 'name + location' } },
    { from: 'operator_inputs', to: 'commit', label: 'in payload', friendly: { label: 'name + location' } },
    { from: 'bindings', to: 'commit', label: 'in payload.app.bindings', friendly: { label: 'wiring choices' } },
    { from: 'install_scaffold', to: 'scaffold_files', label: 'writes', friendly: { label: 'creates' } },
    { from: 'commit', to: 'artifact_node', label: 'upserts', friendly: { label: 'creates' } },
    // The next two edges fan from commit past artifact_node (and past
    // materialized_by_edge) to land on stations further down the right
    // lane. Route them around the right side of the lane so they don't
    // pierce the intermediate stations.
    { from: 'commit', to: 'materialized_by_edge', label: 'creates', friendly: { label: 'links' }, via: 'right' },
    { from: 'commit', to: 'app_materialization_principle', label: 'creates', friendly: { label: 'writes a note' }, via: 'right' },
  ],

  // What the validator must confirm exists in live state. Renaming a tool
  // or removing a kind here without updating the manifest will surface as
  // a red banner on /graph.
  validates: {
    tools: ['install_scaffold', 'meta_context_commit'],
    nodeKinds: ['artifact'],
    edgeKinds: ['materialized_by'],
    sourceEvents: ['app_materialization'],
  },
};
