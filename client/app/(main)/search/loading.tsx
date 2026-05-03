export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
      {/* Search bar skeleton */}
      <div className="h-12 w-full max-w-xl mx-auto bg-gray-200 rounded-xl mb-6" />

      {/* Filters */}
      <div className="flex gap-3 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 w-32 bg-gray-200 rounded-xl" />
        ))}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[3/4] w-full rounded-xl bg-gray-200 mb-2" />
            <div className="h-3.5 w-3/4 bg-gray-200 rounded mb-1" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
