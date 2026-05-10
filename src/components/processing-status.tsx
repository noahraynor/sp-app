'use client';

import type { SessionStatus } from '@/types';

const STEPS: { status: SessionStatus; label: string }[] = [
  { status: 'transcribing', label: 'Transcribing audio with speaker diarization...' },
  { status: 'generating_notes', label: 'Generating SOAP notes with Claude...' },
];

interface ProcessingStatusProps {
  currentStatus: SessionStatus;
}

export function ProcessingStatus({ currentStatus }: ProcessingStatusProps) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="mb-4 font-medium text-gray-900">Processing Session</h3>
      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const isActive = step.status === currentStatus;
          const isCompleted =
            STEPS.findIndex((s) => s.status === currentStatus) > index;

          return (
            <div key={step.status} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  isCompleted
                    ? 'bg-green-100 text-green-700'
                    : isActive
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className={`text-sm ${
                  isActive
                    ? 'font-medium text-gray-900'
                    : isCompleted
                      ? 'text-gray-500 line-through'
                      : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {isActive && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-gray-400">
        This may take a few minutes depending on recording length.
      </p>
    </div>
  );
}
