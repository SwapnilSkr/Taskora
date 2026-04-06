import { Skeleton } from '@/components/ui/skeleton'

/** Shown while a lazy-loaded route or heavy view chunk is loading. */
export function RoutePageFallback() {
  return (
    <div
      className="bg-background flex w-full min-h-[32vh] flex-col gap-3 px-3 py-6 sm:min-h-[40vh] sm:px-5 md:px-7"
      aria-busy
      aria-label="Loading page"
    >
      <Skeleton className="h-7 w-44 max-w-full rounded-md" />
      <Skeleton className="h-28 w-full max-w-2xl rounded-lg" />
      <Skeleton className="h-52 w-full rounded-lg opacity-80" />
    </div>
  )
}
