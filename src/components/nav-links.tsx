'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'My IP', match: (p: string) => p === '/' || p.startsWith('/tools/my-ip') },
  { href: '/tools/ip-lookup', label: 'Lookup', match: (p: string) => p.startsWith('/tools/ip-lookup') || p.startsWith('/lookup') },
  { href: '/docs', label: 'API', match: (p: string) => p.startsWith('/docs') },
];

export function NavLinks() {
  const pathname = usePathname() ?? '/';
  return (
    <ul className="flex items-stretch justify-between sm:justify-start sm:gap-1">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <li key={l.href} className="flex-1 sm:flex-none">
            <Link
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center px-3 text-sm transition-colors sm:min-h-14 ${
                active
                  ? 'text-foreground shadow-[inset_0_-2px_0_var(--gold)]'
                  : 'text-muted-foreground hover:text-foreground hover:shadow-[inset_0_-1px_0_var(--line-strong)]'
              }`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
