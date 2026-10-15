interface Props {
  className?: string;
  label?: string;
}

export function BlockSkeleton({ className = "h-32", label }: Props) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-subtle ${className}`}
      role="status"
      aria-busy="true"
      aria-label={label ?? "Cargando"}
    />
  );
}

export function KpiSkeletonRow() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <BlockSkeleton key={i} className="h-20" label="Cargando KPI" />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <BlockSkeleton key={i} className="h-48" label="Cargando equipo" />
      ))}
    </div>
  );
}
