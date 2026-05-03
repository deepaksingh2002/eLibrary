export default function BookDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:py-12 animate-pulse">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Left: cover skeleton */}
        <div className="lg:col-span-1">
          <div className="aspect-[3/4] w-full rounded-xl bg-gray-200" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-16 rounded-full bg-gray-200" />
            <div className="h-6 w-12 rounded-full bg-gray-200" />
          </div>
        </div>

        {/* Right: text skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-9 w-3/4 bg-gray-200 rounded-xl" />
          <div className="h-6 w-1/3 bg-gray-200 rounded" />
          <div className="h-4 w-1/4 bg-gray-200 rounded" />
          <div className="mt-6 h-24 bg-gray-100 rounded-xl" />
          <div className="h-12 w-48 bg-gray-200 rounded-xl" />
          <div className="h-12 w-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
