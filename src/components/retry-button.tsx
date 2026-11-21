'use client';

import { LoaderCircle, RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

/** Re-runs the server render of the current page. */
export function RetryButton({ className, onRetry }: { className?: string; onRetry?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => (onRetry ? onRetry() : router.refresh()))}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-card px-4 font-medium transition-colors hover:border-gold-ink disabled:cursor-progress',
        className,
      )}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCw className="size-4" aria-hidden="true" />}
      {pending ? 'Retrying…' : 'Try again'}
    </button>
  );
}
