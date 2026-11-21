'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

/**
 * Icons switch on the `.dark` class via CSS, not on JS state, so the server
 * and client render identical markup (no hydration mismatch, no flash).
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      className={className}
      aria-label="Switch between light and dark theme"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="hidden size-[18px] dark:block" aria-hidden="true" />
      <Moon className="block size-[18px] dark:hidden" aria-hidden="true" />
    </button>
  );
}
