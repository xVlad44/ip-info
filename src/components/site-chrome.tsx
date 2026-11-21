import Link from 'next/link';
import { Github } from 'lucide-react';
import { PORTFOLIO_URL, SOURCE_URL } from '@/lib/site';
import { NavLinks } from './nav-links';
import { ThemeToggle } from './theme-toggle';

/** Crosshair mark: the one piece of drawing the app owns. */
export function Mark({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const iconLink =
  'inline-flex size-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground';

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center gap-x-6 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-auto flex min-h-14 items-center gap-2.5 font-mono text-[15px] font-medium tracking-tight"
        >
          <Mark className="size-5 text-gold-ink" />
          <span>
            ip<span className="text-muted-foreground">.xvlad.dev</span>
          </span>
        </Link>
        <nav aria-label="Main" className="order-3 w-full border-t border-border sm:order-none sm:w-auto sm:border-0">
          <NavLinks />
        </nav>
        <div className="flex items-center">
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className={iconLink} aria-label="Source code on GitHub">
            <Github className="size-[18px]" aria-hidden="true" />
          </a>
          <ThemeToggle className={iconLink} />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3 px-4 py-6 font-mono text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          A tool by{' '}
          <a href={PORTFOLIO_URL} className="text-foreground underline decoration-line-strong hover:decoration-gold">
            xvlad.dev
          </a>
          {' · '}
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong hover:text-foreground hover:decoration-gold">
            source
          </a>
        </p>
        <p>
          Data:{' '}
          <a href="https://freeipapi.com" target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong hover:text-foreground">
            FreeIPAPI
          </a>
          {', '}
          <a href="https://ipapi.co" target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong hover:text-foreground">
            ipapi.co
          </a>
          {' · Map © '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline decoration-line-strong hover:text-foreground">
            OpenStreetMap
          </a>
        </p>
      </div>
    </footer>
  );
}
