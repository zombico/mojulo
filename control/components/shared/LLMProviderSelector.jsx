'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LLM_PROVIDERS } from '@/lib/llm-providers';

export default function LLMProviderSelector({
  provider,
  model,
  onProviderChange,
  onModelChange,
  providerError,
  modelError
}) {
  const t = useTranslations('wizard.resources');

  // Local draft for the model input. Committed on blur/Enter rather than per
  // keystroke: deny-listed model IDs are prefixes of real ones (`gpt-4.1` of
  // `gpt-4.1-mini`, `qwen3` of `qwen3:32b`), and the wizard context prunes
  // enabled protocols on every model change — a per-keystroke commit would
  // transiently match the deny-list mid-word and destructively un-toggle
  // the user's protocol selections.
  const [draft, setDraft] = useState(model || '');

  // Follow external model changes (provider switch seeding defaultModel,
  // edit-mode hydration).
  useEffect(() => {
    setDraft(model || '');
  }, [model]);

  const commitDraft = () => {
    const next = draft.trim();
    if (next !== model) onModelChange(next);
  };

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    onProviderChange(newProvider);

    // Auto-select default model for the new provider
    if (newProvider && LLM_PROVIDERS[newProvider]) {
      onModelChange(LLM_PROVIDERS[newProvider].defaultModel);
    }
  };

  const availableModels = provider && LLM_PROVIDERS[provider]
    ? LLM_PROVIDERS[provider].models
    : [];

  return (
    <div className="space-y-4">
      {/* Provider Selection */}
      <div>
        <label htmlFor="provider" className="block text-sm font-medium text-gray-300 mb-1">
          {t('provider')} <span className="text-red-400">*</span>
        </label>
        <select
          id="provider"
          value={provider}
          onChange={handleProviderChange}
          className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            providerError ? 'border-red-500' : 'border-gray-600'
          }`}
        >
          <option value="">{t('selectProvider')}</option>
          {Object.entries(LLM_PROVIDERS)
            .filter(([, config]) => !config.hidden)
            .map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
        </select>
        {providerError && (
          <p className="mt-1 text-sm text-red-400">{providerError}</p>
        )}
      </div>

      {/* Model Selection — free text with the curated list as suggestions.
          The convention lives above LLM_PROVIDERS in lib/llm-providers.js:
          any model ID the provider's API serves is valid; the list is
          guidance, not a wall, so new models need no mojulo release. */}
      {provider && (
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-300 mb-1">
            {t('model')} <span className="text-red-400">*</span>
          </label>
          <input
            id="model"
            type="text"
            list="model-suggestions"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === 'Enter') commitDraft(); }}
            placeholder={t('selectModel')}
            autoComplete="off"
            spellCheck={false}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              modelError ? 'border-red-500' : 'border-gray-600'
            }`}
          />
          <datalist id="model-suggestions">
            {availableModels.map((modelItem) => {
              // Handle both string models and object models (like Bedrock)
              const modelId = typeof modelItem === 'string' ? modelItem : modelItem.id;
              const modelName = typeof modelItem === 'string' ? modelItem : modelItem.name;
              return (
                <option key={modelId} value={modelId}>
                  {modelName}
                </option>
              );
            })}
          </datalist>
          <p className="mt-1 text-xs text-gray-500">{t('modelFreeTextHelper')}</p>
          {modelError && (
            <p className="mt-1 text-sm text-red-400">{modelError}</p>
          )}
        </div>
      )}
    </div>
  );
}
