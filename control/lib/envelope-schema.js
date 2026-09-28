// Canonical envelope shape for app inference (the agent-task queue validates
// every submitted envelope against it). The chatbot runtime kept a mirror
// (lite-template/helper/envelope-schema.js) until the chatbot factory left in
// 3.0.0; this file is now the only copy in mojulo.

export const ENVELOPE_SCHEMA = {
  type: 'object',
  required: ['answer'],
  additionalProperties: false,
  properties: {
    answer:      { type: 'string' },
    suggestions: { type: 'array', items: { type: 'string' } },

    form: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fields:    { type: 'object', additionalProperties: true },
        remaining: { type: 'integer', minimum: 0 },
        complete:  { type: 'boolean' },
      },
    },

    triage: {
      type: 'object',
      additionalProperties: false,
      properties: {
        deploymentId:  { type: 'string' },
        starterPrompt: { type: 'string' },
      },
    },

    appointment: {
      type: 'object',
      additionalProperties: false,
      properties: {
        showLaunchButton: { type: 'boolean' },
        calendarId:       { type: 'string' },
      },
    },

    extraction: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fields:           { type: 'object', additionalProperties: true },
        confidence:       { type: 'string', enum: ['high', 'medium', 'low'] },
        notes:            { type: 'string' },
        showUploadButton: { type: 'boolean' },
      },
    },
  },
};
