'use client';

import { ArrowRight, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { parseIp } from '@/lib/ip/parse';

const EXAMPLES = ['1.1.1.1', '2606:4700:4700::1111', '192.168.1.1'];

interface SearchBarProps {
  defaultValue?: string;
  label?: string;
  autoFocus?: boolean;
  showExamples?: boolean;
}

/**
 * Validates with the same parser the API uses, so bad input never costs a
 * request. Works without JavaScript too: the form GETs /tools/ip-lookup?ip=,
 * which redirects to the lookup page.
 */
export function SearchBar({ defaultValue = '', label = 'Look up an IP address', autoFocus = false, showExamples = true }: SearchBarProps) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(raw: string) {
    const input = raw.trim();
    if (input === '') {
      setError('Enter an IPv4 or IPv6 address.');
      return;
    }
    if (input.toLowerCase() === 'me') {
      setError(null);
      startTransition(() => router.push('/tools/my-ip'));
      return;
    }
    const parsed = parseIp(input);
    if (!parsed) {
      const shown = input.length > 48 ? `${input.slice(0, 45)}…` : input;
      setError(`“${shown}” isn’t an IPv4 or IPv6 address. Example: 8.8.8.8 or 2001:4860:4860::8888.`);
      return;
    }
    setError(null);
    startTransition(() => router.push(`/lookup/${parsed.canonical}`));
  }

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <form
      role="search"
      action="/tools/ip-lookup"
      method="get"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
    >
      <label htmlFor={id} className="eyebrow mb-2 block">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name="ip"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="8.8.8.8 or 2001:db8::1"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : showExamples ? hintId : undefined}
          className="h-12 min-w-0 flex-1 rounded-md border border-input bg-card px-3.5 font-mono text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:border-ring aria-invalid:border-danger"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-gold px-4 font-medium text-on-gold transition-colors hover:bg-[#f2c674] disabled:cursor-progress disabled:opacity-80 sm:px-5"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="size-4" aria-hidden="true" />
          )}
          <span>{pending ? 'Looking up…' : 'Look up'}</span>
        </button>
      </div>
      <div className="mt-2 min-h-6 text-sm" aria-live="polite">
        {error ? (
          <p id={errorId} className="text-danger">
            {error}
          </p>
        ) : showExamples ? (
          <p id={hintId} className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
            <span>Try</span>
            {EXAMPLES.map((ex, i) => (
              <span key={ex} className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setValue(ex);
                    go(ex);
                  }}
                  className="min-h-8 rounded-sm px-1 font-mono text-[13px] text-gold-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold"
                >
                  {ex}
                </button>
                {i < EXAMPLES.length - 1 && <span aria-hidden="true">·</span>}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </form>
  );
}
