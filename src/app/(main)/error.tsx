'use client';

import { CircleAlert } from 'lucide-react';
import { RetryButton } from '@/components/retry-button';

export default function MainError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section role="alert" className="rounded-xl border border-danger/35 bg-[var(--danger-surface)] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-1 size-5 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold">This page failed to load</h1>
          <p className="mt-2 max-w-[62ch] text-muted-foreground">
            The server or your connection dropped the request. Nothing was lost; try again.
          </p>
          <RetryButton className="mt-5" onRetry={reset} />
        </div>
      </div>
    </section>
  );
}
