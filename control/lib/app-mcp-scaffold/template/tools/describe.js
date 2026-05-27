// describe_app — the orientation tool every app-MCP ships with.
//
// Returns the app's identity (name, materialization ref, declared purpose)
// plus the live list of registered tools. The Apps pane in the control
// plane calls this to render the "what tools did the agent extend the
// scaffold with" panel; semantic recall over app tools also rides on the
// description text exposed here.
//
// Placeholders {{APP_NAME}}, {{MATERIALIZATION_REF}}, {{DECLARED_PURPOSE}}
// are substituted by the install helper at scaffold time. They become
// frozen constants in the materialized copy — the runtime values come from
// the scaffolded file, not from a re-read of contextmap (the sidecar runs
// even when the control plane is offline).

import { listRegisteredTools } from '../server.js';

const APP_NAME = '{{APP_NAME}}';
const MATERIALIZATION_REF = '{{MATERIALIZATION_REF}}';
const DECLARED_PURPOSE = '{{DECLARED_PURPOSE}}';

export const describeTool = {
  name: 'describe_app',
  description:
    'Return the app\'s identity (name, materialization ref, declared purpose) and the live list of registered tools. Use this to orient before calling any other app tool, or to inventory what the scaffold has been extended with.',
  inputSchema: { type: 'object', properties: {} },
  async handler() {
    return {
      name: APP_NAME,
      materialization_ref: MATERIALIZATION_REF,
      declared_purpose: DECLARED_PURPOSE,
      registered_tools: listRegisteredTools().map((t) => ({
        name: t.name,
        description: t.description,
      })),
    };
  },
};
