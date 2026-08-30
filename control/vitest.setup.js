// Test-environment install state.
//
// Since 2.0 the chatbot pack is OPT-IN: a default install has no bot factory
// (lib/mcp/packs.js, INSTALL_GROUPS.chatbot is marker-file gated). Almost every
// suite here tests a CAPABILITY, not the install gate, so the default for tests
// is a full workshop — otherwise hundreds of unrelated assertions would be
// asserting the advisory instead of the behaviour.
//
// This is a floor, not an override: it only fills MOJULO_PACKS when nothing set
// it, so a suite that deliberately exercises gating (packs.test.js sets the env
// per case, or passes an explicit env object that never reads process.env) still
// controls its own state.
process.env.MOJULO_PACKS ||= 'creative,chatbot';
