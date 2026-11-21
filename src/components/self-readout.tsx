import { lookupSelf } from '@/lib/server/page-lookup';
import { ResultView } from './result-view';
import { StatePanel } from './state-panel';

/** The visitor's own address. Async server component; wrap it in <Suspense>. */
export async function SelfReadout() {
  const me = await lookupSelf();
  if (!me.ok) return <StatePanel code={me.error.code} message={me.error.message} retryAfter={me.error.retryAfter} />;
  return <ResultView result={me.result} kind="self" />;
}
