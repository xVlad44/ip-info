import { CircleAlert, Clock, Unplug } from 'lucide-react';
import type { ErrorCode } from '@/lib/ip/types';
import { RetryButton } from './retry-button';

interface StatePanelProps {
  code: ErrorCode;
  message: string;
  retryAfter?: number;
  /** The address the user asked about, when there is one. */
  input?: string;
}

const COPY: Record<ErrorCode, { title: string; icon: typeof Clock; tone: 'warn' | 'danger' }> = {
  invalid_ip: { title: 'That isn’t an IP address', icon: CircleAlert, tone: 'danger' },
  rate_limited: { title: 'Too many lookups from your address', icon: Clock, tone: 'warn' },
  upstream_rate_limited: { title: 'The geolocation providers need a breather', icon: Clock, tone: 'warn' },
  upstream_unavailable: { title: 'Couldn’t reach the geolocation providers', icon: Unplug, tone: 'danger' },
  client_ip_unknown: { title: 'Couldn’t work out your address', icon: CircleAlert, tone: 'danger' },
  internal: { title: 'Something went wrong on the server', icon: CircleAlert, tone: 'danger' },
};

function nextStep(code: ErrorCode, retryAfter?: number): string {
  switch (code) {
    case 'invalid_ip':
      return 'Check for a typo. IPv4 looks like 8.8.8.8; IPv6 like 2001:4860:4860::8888.';
    case 'rate_limited':
    case 'upstream_rate_limited':
      return retryAfter ? `Try again in about ${retryAfter} s.` : 'Try again in a minute.';
    case 'upstream_unavailable':
      return 'Both providers failed or timed out. This is usually temporary; try again shortly.';
    default:
      return 'Try again in a moment.';
  }
}

export function StatePanel({ code, message, retryAfter, input }: StatePanelProps) {
  const { title, icon: Icon, tone } = COPY[code];
  const canRetry = code !== 'invalid_ip';
  return (
    <section
      role={code === 'invalid_ip' ? 'alert' : 'status'}
      className={`rounded-xl border p-5 sm:p-7 ${
        tone === 'warn' ? 'border-warn/35 bg-[var(--warn-surface)]' : 'border-danger/35 bg-[var(--danger-surface)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-1 size-5 shrink-0 ${tone === 'warn' ? 'text-warn' : 'text-danger'}`} aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          {input && (
            <p className="mt-1 font-mono text-[15px] break-all text-muted-foreground">
              {input}
            </p>
          )}
          <p className="mt-3 max-w-[62ch]">{message}</p>
          <p className="mt-1 max-w-[62ch] text-muted-foreground">{nextStep(code, retryAfter)}</p>
          {canRetry && <RetryButton className="mt-5" />}
        </div>
      </div>
    </section>
  );
}
