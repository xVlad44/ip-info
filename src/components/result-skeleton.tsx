/** Loading placeholder shaped like ResultView, so nothing jumps when data lands. */
export function ResultSkeleton({ label = 'Looking up the address…' }: { label?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:p-7" aria-hidden="true">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-11 w-[min(22rem,80%)]" />
        <div className="skeleton h-6 w-[min(18rem,60%)]" />
      </div>
      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]" aria-hidden="true">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-6" style={{ width: `${88 - i * 7}%` }} />
          ))}
        </div>
        <div className="skeleton aspect-[4/3] min-h-[240px] w-full rounded-lg lg:aspect-auto lg:min-h-[340px]" />
      </div>
    </section>
  );
}
