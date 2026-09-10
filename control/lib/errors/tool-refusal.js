/**
 * ToolRefusal — a tool "no" that carries its own recovery.
 *
 * A plain Error reaches the model as one sentence and sends it back to the
 * manuals to work out what to do. A ToolRefusal renders as a JSON tool result
 * (isError: true) with a stable `code`, the offending value, and a
 * `next_action` naming the tool to call next — the "no(reason + next move)"
 * outcome class the studio grammar promises. `message` stays human-readable
 * so any path that only prints err.message (CLI, plan-step records, logs)
 * still says what to do.
 *
 * Lives under lib/errors so the db repositories can throw one without
 * importing the MCP layer; dispatchMcpRequest renders it via toToolResult().
 */

export class ToolRefusal extends Error {
  constructor({ code, reason, hint, ...rest }) {
    super(hint ? `${reason} ${hint}` : reason);
    this.name = 'ToolRefusal';
    this.code = code;
    this.payload = { code, reason, ...rest };
  }

  toToolResult() {
    return {
      content: [{ type: 'text', text: JSON.stringify(this.payload, null, 2) }],
      isError: true,
    };
  }
}

export function isToolRefusal(err) {
  return Boolean(err) && typeof err.toToolResult === 'function';
}

// The revision route per stored kind — the studio grammar's verb overrides:
// audio revises via update_beats; a voice register never revises (re-create);
// everything else revises in place with update_sketch.
function revisionFor(ref, kind) {
  const k = typeof kind === 'string' ? kind : '';
  if (k.startsWith('beats')) {
    return {
      next_action: {
        tool: 'update_beats',
        args: { ref },
        reason: 'Revise the existing beats artifact in place; the ref stays the same.',
      },
      read_first: {
        tool: 'get_beats',
        args: { ref },
        reason: 'Read the current recipe and revision index before writing.',
      },
      hint: `Revise it in place with update_beats({ ref: '${ref}', … }) after get_beats, or omit ref to mint a new one.`,
    };
  }
  if (k === 'voice-register') {
    return {
      next_action: {
        tool: 'create_voice',
        args: { ref: '<a different ref, or omit>' },
        reason: 'A voice register is never revised; mint a new one under a different ref.',
      },
      read_first: {
        tool: 'get_voice',
        args: { ref },
        reason: 'Read the existing register before deciding whether a new one is needed.',
      },
      hint: `A voice register is never revised — call create_voice again with a different ref (or omit ref) after get_voice({ ref: '${ref}' }).`,
    };
  }
  return {
    next_action: {
      tool: 'update_sketch',
      args: { ref },
      reason: 'Revise the existing sketch in place; the ref stays the same.',
    },
    read_first: {
      url: `/sketches/${ref}`,
      reason: 'The current render of the existing artifact.',
    },
    hint: `Revise it in place with update_sketch({ ref: '${ref}', … }), or omit ref to mint a new one.`,
  };
}

// A mint asked for a ref that is already taken. Thrown from
// SketchRepository.create so every sketch-backed mint (diagrams, views,
// worlds, solids, beats, voice) refuses the same way.
export function refExistsRefusal({ ref, kind }) {
  const { hint, ...recovery } = revisionFor(ref, kind);
  return new ToolRefusal({
    code: 'REF_EXISTS',
    reason: `A sketch with ref '${ref}' already exists.`,
    hint,
    ref,
    ...(kind ? { kind } : {}),
    ...recovery,
    alternative: 'Omit `ref` to mint a new artifact with a generated ref.',
  });
}
