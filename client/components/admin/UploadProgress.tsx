"use client";

interface Props {
  progress: number;
  visible: boolean;
  label?: string;
}

export default function UploadProgress({
  progress,
  visible,
  label = "Uploading..."
}: Props) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-4 text-center text-4xl font-bold text-blue-600">
          Upload
        </div>

        <h3 className="mb-1 text-center text-lg font-bold text-gray-900">
          {label}
        </h3>
        <p className="mb-6 text-center text-sm text-gray-500">
          Please keep this page open
        </p>

        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between">
          <span className="text-xs text-gray-400">Uploading to Cloudinary</span>
          <span className="text-xs font-semibold text-blue-600">
            {progress}%
          </span>
        </div>

        {progress >= 100 && (
          <p className="mt-4 text-center text-sm font-medium text-green-600">
            Upload complete. Saving...
          </p>
        )}
      </div>
    </div>
  );
}
