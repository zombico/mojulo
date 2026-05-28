'use client';

/**
 * DecisionCard
 *
 * Renders a mid-turn structured decision the agent-routed worker raised via
 * `request_chat_decision` (delivered over SSE as a `decision` event). The
 * operator picks an option (and/or types free text); the answer is POSTed back
 * through `respondToDecision`, which unblocks the worker. Once answered, the
 * card disables and shows the chosen value.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function DecisionCard({ message, onRespond }) {
  const t = useTranslations('chatBuilder.decision');
  const { promptId, question, options = [], allowText, answered, answer } = message;
  const [text, setText] = useState('');

  const handleOption = (optionId) => {
    if (answered) return;
    onRespond?.(promptId, { selected: optionId });
  };

  const handleTextSubmit = () => {
    if (answered || !text.trim()) return;
    onRespond?.(promptId, { text: text.trim() });
  };

  const chosenOption = answered && answer?.selected
    ? options.find((o) => o.id === answer.selected)
    : null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] w-full bg-gradient-to-br from-amber-950/40 to-gray-800 border border-amber-700/60 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <QuestionIcon className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-400">
            {t('label')}
          </span>
        </div>

        <p className="text-sm text-gray-100 mb-3 whitespace-pre-wrap break-words">{question}</p>

        {options.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {options.map((opt) => {
              const isChosen = chosenOption?.id === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleOption(opt.id)}
                  disabled={answered}
                  title={opt.description || undefined}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition ${
                    isChosen
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : answered
                        ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-gray-800 border-amber-700/70 text-amber-200 hover:bg-amber-900/40 hover:border-amber-600'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {allowText && !answered && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSubmit();
                }
              }}
              placeholder={t('textPlaceholder')}
              className="flex-1 text-sm bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-600"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!text.trim()}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 transition"
            >
              {t('submit')}
            </button>
          </div>
        )}

        {answered && (
          <div className="mt-1 text-xs text-amber-300/80">
            {chosenOption
              ? `${t('answeredPrefix')} ${chosenOption.label}`
              : answer?.text
                ? `${t('answeredText')}: ${answer.text}`
                : t('answeredText')}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
