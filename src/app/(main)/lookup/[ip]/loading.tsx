import { ResultSkeleton } from '@/components/result-skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-10">
      <ResultSkeleton />
    </div>
  );
}
