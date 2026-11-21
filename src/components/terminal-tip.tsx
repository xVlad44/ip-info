import Link from 'next/link';
import { SITE_URL } from '@/lib/site';
import { CopyButton } from './copy-button';

export function TerminalTip() {
  const cmd = `curl ${SITE_URL}/api/me?format=text`;
  return (
    <section aria-labelledby="terminal-tip" className="flex flex-col gap-2">
      <h2 id="terminal-tip" className="eyebrow">
        From a terminal
      </h2>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card py-1 pl-3.5 pr-1">
        <code className="min-w-0 flex-1 overflow-x-auto py-2 font-mono text-[13.5px] whitespace-nowrap">
          <span className="select-none text-muted-foreground">$ </span>
          {cmd}
        </code>
        <CopyButton value={cmd} label="command" />
      </div>
      <p className="text-sm text-muted-foreground">
        JSON for any address, error codes and limits are in the{' '}
        <Link href="/docs" className="text-gold-ink underline decoration-line-strong underline-offset-4 hover:decoration-gold">
          API docs
        </Link>
        .
      </p>
    </section>
  );
}
