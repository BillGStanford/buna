import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page space-y-6 py-10" role="status" aria-label="Loading opportunities">
      <Skeleton className="h-9 w-56" /><Skeleton className="h-44 w-full" />
      <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
    </div>
  );
}
