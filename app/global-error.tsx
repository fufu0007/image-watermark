'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              系统错误
            </h2>
            <p className="text-gray-600 mb-4">
              {error.message || '系统发生错误，请刷新页面重试'}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      </body>
    </html>
  );
} 