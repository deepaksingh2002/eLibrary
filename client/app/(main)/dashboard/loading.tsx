export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 h-28">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-2.5 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Shelf skeletons */}
      {[0, 1].map((s) => (
        <div key={s} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="h-4 w-36 bg-gray-200 rounded mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2, 3].map((b) => (
              <div key={b} className="flex-shrink-0 w-32">
                <div className="aspect-[3/4] bg-gray-200 rounded-xl mb-2" />
                <div className="h-3 w-full bg-gray-200 rounded mb-1" />
                <div className="h-2.5 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
