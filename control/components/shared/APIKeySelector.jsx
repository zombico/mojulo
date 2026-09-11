'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LLM_PROVIDERS } from '@/lib/llm-providers';

export default function APIKeySelector({
  provider,
  apiKey,
  apiKeyId,
  hasStoredApiKey = false,
  ollamaHost = '',
  onApiKeyChange,
  onApiKeyIdChange,
  onOllamaHostChange,
  error,
}) {
  const t = useTranslations('wizard.resources');
  const [savedApiKeys, setSavedApiKeys] = useState([]);
  const [loadingApiKeys, setLoadingApiKeys] = useState(false);
  const selectedSavedKeyId = apiKeyId || null;
  const selectedSavedKey = savedApiKeys.find((k) => k.id === selectedSavedKeyId) || null;
  // Edit-mode case: a credential is on file (server flag) but the user
  // hasn't typed a new one or picked a saved one this session. We display
  // the "existing key configured" status and let the user proceed without
  // re-entering. Goes away the moment they paste or pick.
  const showStoredApiKeyStatus = hasStoredApiKey && !selectedSavedKey && !apiKey;


  // Fetch saved API keys when provider changes
  useEffect(() => {
    if (provider) {
      fetchSavedApiKeys();
    } else {
      setSavedApiKeys([]);
    }
  }, [provider]);

  const fetchSavedApiKeys = async () => {
    try {
      setLoadingApiKeys(true);
      const response = await fetch(`/api/settings/api-keys?provider=${provider}`);
      if (response.ok) {
        const data = await response.json();
        setSavedApiKeys(data.keys || []);
      }
    } catch (error) {
      console.error('Error fetching saved API keys:', error);
    } finally {
      setLoadingApiKeys(false);
    }
  };

  // Picking a saved key stores only the opaque id — the plaintext value is
  // resolved server-side at deploy time so it never enters browser memory.
  const handleSelectSavedKey = (keyId) => {
    onApiKeyIdChange?.(keyId);
    onApiKeyChange('');
  };

  const handleClearSavedKey = () => {
    onApiKeyIdChange?.(null);
    onApiKeyChange('');
  };

  const handleManualInput = (e) => {
    onApiKeyIdChange?.(null);
    onApiKeyChange(e.target.value);
  };

  // Render Ollama-specific UI: a host URL field, no credentials. The host
  // is optional in the wizard — buildLLMConfig falls back to
  // LLM_PROVIDERS.ollama.defaultHost when blank. Saved hosts from settings
  // surface as picker chips below, the same shape the standard-provider
  // branch uses for saved API keys.
  if (provider === 'ollama') {
    const placeholder = LLM_PROVIDERS.ollama?.defaultHost || 'http://host.docker.internal:11434';
    const hostFieldDisabled = !!selectedSavedKey;
    return (
      <div className="space-y-3">
        <div className="p-3 bg-teal-900/20 border border-teal-800 rounded-md">
          <p className="text-xs text-teal-300">
            {t('ollamaNoCredsNeeded')}
          </p>
        </div>

        <div>
          <label htmlFor="ollamaHost" className="block text-sm font-medium text-gray-300 mb-1">
            {t('ollamaHost')}
          </label>
          <input
            id="ollamaHost"
            type="text"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            value={selectedSavedKey ? '' : (ollamaHost || '')}
            onChange={(e) => {
              // Typing in the manual field invalidates any saved-host
              // selection — same UX pattern as the standard-provider branch.
              onApiKeyIdChange?.(null);
              onOllamaHostChange?.(e.target.value);
            }}
            disabled={hostFieldDisabled}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            placeholder={selectedSavedKey ? t('ollamaHostSavedPlaceholder') : placeholder}
          />
          <p className="mt-1 text-xs text-gray-400">
            {t('ollamaHostHelper')}
          </p>
        </div>

        {selectedSavedKey && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-teal-400">
              {t('ollamaHostUsingSaved')} <span className="font-medium">{selectedSavedKey.name}</span>
            </p>
            <button
              type="button"
              onClick={handleClearSavedKey}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              {t('apiKeyClear')}
            </button>
          </div>
        )}

        {loadingApiKeys ? (
          <div className="text-sm text-gray-500">{t('apiKeyLoadingSaved')}</div>
        ) : savedApiKeys.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-300 mb-2">
              {t('ollamaHostOrUseSaved')}
            </p>
            <div className="flex flex-wrap gap-2">
              {savedApiKeys.map((key) => (
                <button
                  key={key.id}
                  type="button"
                  onClick={() => {
                    handleSelectSavedKey(key.id);
                    // Picking a saved host clears the manual field so wizard
                    // state stays in sync with what the user sees. Server-side
                    // resolution wins at deploy time either way, but the local
                    // formData should not carry a stale host alongside an
                    // apiKeyId reference.
                    onOllamaHostChange?.('');
                  }}
                  className={`px-3 py-2 text-sm rounded-md border transition ${
                    selectedSavedKeyId === key.id
                      ? 'bg-teal-900/50 border-teal-500 text-teal-300 font-medium'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-600'
                  }`}
                >
                  {key.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Standard API Key UI for other providers
  return (
    <div>
      <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
        {t('apiKey')} <span className="text-red-400">*</span>
      </label>

      <div className="relative">
        <input
          id="apiKey"
          name="mojulo-api-key"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          value={selectedSavedKey ? '' : (apiKey || '')}
          onChange={handleManualInput}
          className={`w-full px-3 py-2 bg-gray-700 border rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
            error ? 'border-red-500' : 'border-gray-600'
          }`}
          placeholder={
            selectedSavedKey
              ? t('apiKeySavedPlaceholder')
              : showStoredApiKeyStatus
              ? t('apiKeyExistingPlaceholder')
              : provider
              ? t('apiKeyEnter')
              : t('apiKeySelectProviderFirst')
          }
          disabled={!provider || !!selectedSavedKey}
        />
      </div>

      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}

      {selectedSavedKey ? (
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-teal-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            {t('apiKeyUsingSaved')} <span className="font-medium">{selectedSavedKey.name}</span>
          </p>
          <button
            type="button"
            onClick={handleClearSavedKey}
            className="text-xs text-red-400 hover:text-red-300 font-medium"
          >
            {t('apiKeyClear')}
          </button>
        </div>
      ) : showStoredApiKeyStatus ? (
        <div className="mt-1">
          <p className="text-xs text-teal-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            {t('apiKeyExistingConfigured')}
          </p>
        </div>
      ) : apiKey && !error ? (
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-green-400 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {t('apiKeyIsSet')}
          </p>
          <div className="group relative">
            <button
              type="button"
              className="text-teal-400 hover:text-teal-300 transition"
              title={t('apiKeyAbout')}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-gray-700 border border-gray-600 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <p className="text-xs text-gray-300">
                {t('apiKeyTooltip')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          {t('apiKeyEncryptedHelper')}
        </p>
      )}

      {/* Saved API Keys */}
      {loadingApiKeys ? (
        <div className="mt-3 text-sm text-gray-500">{t('apiKeyLoadingSaved')}</div>
      ) : savedApiKeys.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-300 mb-2">
            {t('apiKeyOrUseSaved')}
          </p>
          <div className="flex flex-wrap gap-2">
            {savedApiKeys.map((key) => (
              <button
                key={key.id}
                type="button"
                onClick={() => handleSelectSavedKey(key.id)}
                className={`px-3 py-2 text-sm rounded-md border transition ${
                  selectedSavedKeyId === key.id
                    ? 'bg-teal-900/50 border-teal-500 text-teal-300 font-medium'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  {key.name}
                  {selectedSavedKeyId === key.id && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
