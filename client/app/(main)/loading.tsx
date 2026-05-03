export default function MainLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar skeleton */}
      <div className="h-16 bg-white border-b border-gray-200 animate-pulse" />

      {/* Content spinner */}
      <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    </div>
  );
}
