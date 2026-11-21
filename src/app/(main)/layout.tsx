import { SiteFooter, SiteHeader } from '@/components/site-chrome';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-gold px-4 py-3 font-medium text-on-gold focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
