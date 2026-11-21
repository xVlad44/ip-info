import { Suspense } from 'react';
import { ResultSkeleton } from '@/components/result-skeleton';
import { SearchBar } from '@/components/SearchBar';
import { SelfReadout } from '@/components/self-readout';
import { TerminalTip } from '@/components/terminal-tip';

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">What is my IP address?</h1>
      <Suspense fallback={<ResultSkeleton label="Finding your address…" />}>
        <SelfReadout />
      </Suspense>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-12">
        <SearchBar label="Look up another address" />
        <TerminalTip />
      </div>
    </div>
  );
}
