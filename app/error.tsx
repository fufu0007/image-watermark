'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到错误报告服务
    console.error('Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          出错了
        </h2>
        <p className="text-gray-600 mb-6">
          {error.message || '发生了一些错误，请重试'}
        </p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            刷新页面
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  );
} 