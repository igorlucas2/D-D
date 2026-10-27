import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton({
  cards = 3,
  withHeader = true,
}: {
  cards?: number;
  withHeader?: boolean;
}) {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      {withHeader ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Skeleton key={index} className="h-40 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function CampaignSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-[65vh] min-h-80 rounded-2xl" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
      <span className="sr-only">Carregando a mesa…</span>
    </div>
  );
}

export function SheetSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-2xl" />
      <span className="sr-only">Carregando a ficha…</span>
    </div>
  );
}
