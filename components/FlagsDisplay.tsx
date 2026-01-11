'use client';

import { Flag } from '@/types/scoring';

interface FlagsDisplayProps {
  flags: Flag[];
  context?: 'pre_run' | 'during_run' | 'post_run';
}

export default function FlagsDisplay({ flags, context }: FlagsDisplayProps) {
  // Filter flags that apply to the current context (or show all if no context specified)
  const relevantFlags = context
    ? flags.filter((flag) => flag.appliesTo.includes(context))
    : flags;

  if (relevantFlags.length === 0) {
    return null;
  }

  // Group flags by severity
  const cautionFlags = relevantFlags.filter((flag) => flag.severity === 'caution');
  const infoFlags = relevantFlags.filter((flag) => flag.severity === 'info');

  return (
    <div className="space-y-3 md:space-y-4">
      {cautionFlags.length > 0 && (
        <div className="bg-yellow-50 p-3 md:p-4 rounded-lg border border-yellow-200">
          <h3 className="text-xs md:text-sm font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <span>⚠️</span>
            <span>Caution Flags</span>
          </h3>
          <ul className="space-y-2">
            {cautionFlags.map((flag, index) => (
              <li key={index} className="text-xs md:text-sm text-yellow-700">
                <span className="font-medium">{flag.name}:</span> {flag.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {infoFlags.length > 0 && (
        <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
          <h3 className="text-xs md:text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            <span>Information Flags</span>
          </h3>
          <ul className="space-y-2">
            {infoFlags.map((flag, index) => (
              <li key={index} className="text-xs md:text-sm text-blue-700">
                <span className="font-medium">{flag.name}:</span> {flag.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
