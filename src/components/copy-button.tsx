'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  /** Text to copy. A value starting with "/" is copied as an absolute URL on this origin. */
  value: string;
  /** What is being copied, for the accessible name ("Copy IP address"). */
  label: string;
  /** Show a text label next to the icon. */
  showText?: boolean;
  className?: string;
}

export function CopyButton({ value, label, showText = false, className }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    const text = value.startsWith('/') ? `${window.location.origin}${value}` : value;
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1600);
  }

  const status = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : '';

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={showText ? undefined : `Copy ${label}`}
      className={cn(
        'inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground',
        showText && 'border border-border px-3 text-sm',
        state === 'copied' && 'text-ok hover:text-ok',
        className,
      )}
    >
      {state === 'copied' ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {showText && <span>{state === 'copied' ? 'Copied' : label}</span>}
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </button>
  );
}
