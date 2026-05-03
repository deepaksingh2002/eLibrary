export default function AdminLoading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar skeleton */}
      <div className="hidden md:block w-56 bg-white border-r border-gray-100 animate-pulse p-6">
        <div className="h-5 w-28 bg-gray-200 rounded mb-6" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-gray-100 rounded-xl mb-2" />
        ))}
      </div>

      {/* Main content skeleton */}
      <main className="flex-1 p-8 animate-pulse">
        <div className="h-7 w-48 bg-gray-200 rounded mb-6" />

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 h-28">
              <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
              <div className="h-7 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-2.5 w-24 bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        {/* Chart placeholder */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 h-64 flex items-center justify-center">
          <div className="h-full w-full bg-gray-100 rounded-xl" />
        </div>
      </main>
    </div>
  );
}
